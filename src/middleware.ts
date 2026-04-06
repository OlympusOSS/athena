import { type NextRequest, NextResponse } from "next/server";
import { isAdmin, parseSession, SESSION_COOKIE } from "@/lib/auth";
import { decryptApiKey } from "@/lib/crypto-edge";

/**
 * CSP NONCE — platform#18 (Security Headers)
 *
 * A cryptographic nonce is generated per-request and injected into:
 *   1. The `Content-Security-Policy` response header (via `'nonce-{value}'` in script-src)
 *   2. The `x-nonce` request header, so layout.tsx can forward it to Next.js <Script> components
 *      and any inline <script> blocks.
 *
 * Framing policy ownership (DA/Security condition C3):
 *   - `frame-ancestors 'none'` in the CSP is the AUTHORITATIVE framing policy for Athena.
 *   - `X-Frame-Options: DENY` set by Caddy is the legacy-browser fallback ONLY.
 *   - Future framing policy changes MUST update this CSP. Changing the Caddyfile alone has
 *     no effect in modern browsers because CSP frame-ancestors takes precedence.
 *
 * `unsafe-inline` in style-src (DA/Security condition C2 / SR-1):
 *   - `'unsafe-inline'` in style-src is a known pragmatic allowance for CSS-in-JS and
 *     Canvas component styles. This is a CSS injection risk (lower-severity than XSS).
 *   - A follow-on ticket (athena#<n>) tracks removing this allowance via nonce-based styles.
 *     See OlympusOSS/athena issues for the follow-on ticket.
 *
 * This CSP is NOT set on API routes (/api/*). It applies only to page (HTML) responses.
 */
function buildCsp(nonce: string): string {
	const directives = [
		"default-src 'self'",
		`script-src 'self' 'nonce-${nonce}'`,
		"style-src 'self' 'unsafe-inline'",
		"connect-src 'self'",
		"img-src 'self' data:",
		"font-src 'self'",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		// frame-ancestors is authoritative for framing policy — see note above
		"frame-ancestors 'none'",
	];
	return directives.join("; ");
}

/**
 * Routes that require the "admin" role.
 * All other authenticated routes only require a valid session (any role).
 *
 * CSRF strategy (V5 mitigation, athena#49 Security Review):
 * All mutation endpoints under these prefixes are protected by the admin session
 * cookie set with SameSite=Lax, HttpOnly, and Secure attributes (see src/lib/session.ts).
 * SameSite=Lax is intentional — SameSite=Strict would break the OAuth2 callback flow
 * because the browser's redirect from the IdP (a cross-origin navigation) would strip
 * the session cookie before the callback handler can read it. Lax allows cookies on
 * top-level cross-site navigations (GET redirects) while still blocking cross-site
 * form submissions (POST/PATCH/DELETE) from third-party pages.
 * Fetch-based CSRF (e.g., forged XHR from an attacker's origin) is independently blocked
 * by CORS — the /api/connections/ routes do not emit Access-Control-Allow-Origin headers
 * for third-party origins, so cross-origin fetch requests are rejected by the browser
 * before they reach the server.
 *
 * athena#49: /api/connections/social protects all four social connection endpoints
 * (GET full config, POST, PATCH /:provider, DELETE /:provider).
 * The public unauthenticated endpoint /api/connections/public is registered in
 * isPublicRoute() below — NOT here.
 */
const ADMIN_PREFIXES = [
	"/api/settings",
	"/api/encrypt",
	"/api/config",
	"/api/security",
	"/api/connections/social",
	"/api/mfa",
	/**
	 * /api/clients — M2M OAuth2 client management routes (athena#50 / athena#77).
	 *
	 * This prefix covers all four M2M routes:
	 *   GET    /api/clients/m2m
	 *   POST   /api/clients/m2m
	 *   POST   /api/clients/m2m/:id/rotate-secret
	 *   DELETE /api/clients/m2m/:id
	 *
	 * The isAdminRoute() check uses startsWith(prefix + "/") which means
	 * "/api/clients" covers "/api/clients/m2m", "/api/clients/m2m/abc/rotate-secret", etc.
	 *
	 * athena#77: This prefix is a BLOCKING prerequisite for athena#50 (M2M routes must
	 * not be reachable without admin role verification). Shipping athena#50 without this
	 * line would leave all M2M endpoints unprotected.
	 */
	"/api/clients",
];

function isAdminRoute(pathname: string): boolean {
	return ADMIN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Routes that skip auth entirely (public auth flow + health check).
 *
 * /api/connections/public — unauthenticated Hera endpoint for social provider list
 * (athena#49 G2: separate route, not query-param branching on /api/connections/social)
 */
function isPublicRoute(pathname: string): boolean {
	return pathname.startsWith("/api/auth") || pathname === "/api/health" || pathname === "/api/connections/public";
}

/**
 * Routes handled by the Ory proxy below — auth is not enforced here
 * because these proxy to Kratos/Hydra which have their own auth.
 */
function isProxyRoute(pathname: string): boolean {
	return (
		pathname.startsWith("/api/kratos/") ||
		pathname.startsWith("/api/kratos-admin/") ||
		pathname.startsWith("/api/iam-kratos/") ||
		pathname.startsWith("/api/iam-kratos-admin/") ||
		pathname.startsWith("/api/hydra/") ||
		pathname.startsWith("/api/hydra-admin/")
	);
}

async function proxyToService(request: NextRequest, baseUrl: string, pathPrefix: string, serviceName: string): Promise<NextResponse> {
	try {
		const targetPath = request.nextUrl.pathname.replace(pathPrefix, "");
		const targetUrl = `${baseUrl}${targetPath}${request.nextUrl.search}`;

		const requestHeaders = new Headers(request.headers);

		["x-forwarded", "x-real-ip"].forEach((prefix) => {
			for (const key of [...requestHeaders.keys()]) {
				if (key.startsWith(prefix)) requestHeaders.delete(key);
			}
		});

		for (const h of ["host", "connection", "upgrade"]) {
			requestHeaders.delete(h);
		}

		let authorizationHeader: string | undefined;
		if (serviceName === "Kratos") {
			const kratosApiKeyEncrypted = process.env.KRATOS_API_KEY || undefined;
			if (kratosApiKeyEncrypted) {
				const kratosApiKey = await decryptApiKey(kratosApiKeyEncrypted);
				if (kratosApiKey) {
					authorizationHeader = `Bearer ${kratosApiKey}`;
				}
			}
		} else if (serviceName === "Hydra") {
			const hydraApiKeyEncrypted = process.env.HYDRA_API_KEY || undefined;
			if (hydraApiKeyEncrypted) {
				const hydraApiKey = await decryptApiKey(hydraApiKeyEncrypted);
				if (hydraApiKey) {
					authorizationHeader = `Bearer ${hydraApiKey}`;
				}
			}
		}

		if (authorizationHeader) {
			requestHeaders.set("Authorization", authorizationHeader);
		}

		const response = await fetch(targetUrl, {
			method: request.method,
			headers: requestHeaders,
			body: request.method !== "GET" && request.method !== "HEAD" ? await request.arrayBuffer() : undefined,
		});

		// Handle different response types
		if (response.status === 204) {
			const responseHeaders = new Headers();
			response.headers.forEach((value, key) => {
				if (key.toLowerCase() !== "content-encoding" && key.toLowerCase() !== "transfer-encoding") {
					responseHeaders.set(key, value);
				}
			});

			return new NextResponse(null, {
				status: 204,
				headers: responseHeaders,
			});
		}

		// Handle successful responses with content
		const responseBody = await response.arrayBuffer();
		const responseHeaders = new Headers();

		// Copy response headers selectively to avoid Next.js Edge Runtime issues
		// The 'location' header from Ory Hydra's 201 responses causes "Invalid URL" TypeErrors
		// in the Edge Runtime, which then returns 500 errors to the frontend. We filter to only
		// include essential headers that are safe for the Edge Runtime to process.
		const safeHeaders = ["content-type", "cache-control", "etag", "last-modified", "vary", "link", "set-cookie"];
		response.headers.forEach((value, key) => {
			const lowerKey = key.toLowerCase();
			// Only copy safe headers and custom x-* headers (excluding forwarding headers)
			if (safeHeaders.includes(lowerKey) || (lowerKey.startsWith("x-") && !lowerKey.startsWith("x-forwarded") && !lowerKey.startsWith("x-real-ip"))) {
				responseHeaders.set(key, value);
			}
		});

		return new NextResponse(responseBody, {
			status: response.status,
			statusText: response.statusText,
			headers: responseHeaders,
		});
	} catch (error) {
		console.error(`[Middleware] Failed to proxy ${request.nextUrl.pathname}:`, error);
		console.error(`[Middleware] Error details:`, {
			message: error instanceof Error ? error.message : "Unknown error",
			stack: error instanceof Error ? error.stack : undefined,
			name: error instanceof Error ? error.name : undefined,
		});

		// Handle fetch errors
		if (error instanceof TypeError && error.message.includes("fetch")) {
			return NextResponse.json(
				{
					error: "Network Error",
					message: error.message,
					details: `Unable to reach ${serviceName} at ${baseUrl}. Please check your ${serviceName} configuration.`,
				},
				{ status: 502 },
			);
		}

		return NextResponse.json(
			{
				error: "Proxy Error",
				message: error instanceof Error ? error.message : "Unknown error",
				details: `Failed to proxy request to ${serviceName} at ${baseUrl}`,
				errorType: error instanceof Error ? error.name : "Unknown",
			},
			{ status: 500 },
		);
	}
}

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// --- CSP nonce injection for page (HTML) responses ------------------------
	// Only inject on non-API routes. API routes don't serve HTML and don't need CSP.
	if (!pathname.startsWith("/api/")) {
		const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
		const csp = buildCsp(nonce);

		const requestHeaders = new Headers(request.headers);
		// Forward the nonce to layout.tsx via request header so it can be passed
		// to <Script> components and inline <script> blocks as the `nonce` attribute.
		requestHeaders.set("x-nonce", nonce);

		const response = NextResponse.next({ request: { headers: requestHeaders } });
		response.headers.set("Content-Security-Policy", csp);
		return response;
	}

	// --- Auth enforcement for non-proxy, non-public API routes ----------------
	if (pathname.startsWith("/api/") && !isPublicRoute(pathname) && !isProxyRoute(pathname)) {
		const session = await parseSession(request.cookies.get(SESSION_COOKIE)?.value);

		if (!session) {
			return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
		}

		if (isAdminRoute(pathname) && !isAdmin(session)) {
			return NextResponse.json({ error: "Forbidden: admin role required" }, { status: 403 });
		}

		// Forward user info to downstream route handlers
		const headers = new Headers(request.headers);
		headers.set("x-user-email", session.user.email);
		headers.set("x-user-role", session.user.role);
		headers.set("x-user-id", session.user.kratosIdentityId);

		return NextResponse.next({ request: { headers } });
	}

	// Handle Kratos public API proxying
	if (pathname.startsWith("/api/kratos/")) {
		const kratosPublicUrl = process.env.KRATOS_PUBLIC_URL || "http://localhost:3100";
		return proxyToService(request, kratosPublicUrl, "/api/kratos", "Kratos");
	}

	// Handle Kratos admin API proxying
	if (pathname.startsWith("/api/kratos-admin/")) {
		const kratosAdminUrl = process.env.KRATOS_ADMIN_URL || "http://localhost:3101";
		return proxyToService(request, kratosAdminUrl, "/api/kratos-admin", "Kratos");
	}

	// Handle IAM Kratos public API proxying (used by IAM Athena for identity management)
	if (pathname.startsWith("/api/iam-kratos/")) {
		const iamKratosPublicUrl = process.env.IAM_KRATOS_PUBLIC_URL || "http://localhost:4100";

		return proxyToService(request, iamKratosPublicUrl, "/api/iam-kratos", "Kratos");
	}

	// Handle IAM Kratos admin API proxying (used by IAM Athena for identity management)
	if (pathname.startsWith("/api/iam-kratos-admin/")) {
		const iamKratosAdminUrl = process.env.IAM_KRATOS_ADMIN_URL || "http://localhost:4101";

		return proxyToService(request, iamKratosAdminUrl, "/api/iam-kratos-admin", "Kratos");
	}

	// Handle Hydra public API proxying
	if (pathname.startsWith("/api/hydra/")) {
		const hydraPublicUrl = process.env.HYDRA_PUBLIC_URL || "http://localhost:3102";
		return proxyToService(request, hydraPublicUrl, "/api/hydra", "Hydra");
	}

	// Handle Hydra admin API proxying
	if (pathname.startsWith("/api/hydra-admin/")) {
		const hydraAdminUrl = process.env.HYDRA_ADMIN_URL || "http://localhost:3103";
		return proxyToService(request, hydraAdminUrl, "/api/hydra-admin", "Hydra");
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		// Page routes — CSP nonce is injected on all page (HTML) responses.
		// Excludes Next.js internal routes (_next/static, _next/image, favicon.ico)
		// which don't serve HTML and should not be interrupted by middleware.
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
		// API routes — auth enforcement and proxy routing
		"/api/kratos/:path*",
		"/api/kratos-admin/:path*",
		"/api/iam-kratos/:path*",
		"/api/iam-kratos-admin/:path*",
		"/api/hydra/:path*",
		"/api/hydra-admin/:path*",
		// M2M client management routes (athena#50 / athena#77)
		"/api/clients/:path*",
		"/api/((?!auth|health).*)",
	],
};
