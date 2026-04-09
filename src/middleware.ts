import { type NextRequest, NextResponse } from "next/server";
import { isAdmin, parseSession, SESSION_COOKIE } from "@/lib/auth";
import { decryptApiKey } from "@/lib/crypto-edge";
import { buildCsp } from "@/lib/csp";

/**
 * PROXY_TIMEOUT_MS guard — athena#110
 *
 * Evaluated once at module init. Changes require a container restart.
 *
 * Guard formula handles all malformed operator inputs:
 *   - Unset (undefined/null): defaults to 5000ms via ?? operator
 *   - NaN (non-numeric string): Number("notanumber") = NaN; falsy → fallback 5000
 *   - 0: Number("0") = 0; falsy → fallback 5000
 *   - Empty string: Number("") = 0; falsy → fallback 5000
 *   - < 1000ms (below floor): Math.max(1000, ...) clamps to 1000ms minimum
 *   - Valid numeric string: used as-is
 *
 * When the guard activates (input is invalid or below floor), a WARNING is logged
 * with the raw input value and the effective value so on-call engineers have signal.
 */
const _rawProxyTimeout = process.env.PROXY_TIMEOUT_MS;
const PROXY_TIMEOUT_MS: number = ((): number => {
	const parsed = Number(_rawProxyTimeout ?? 5000) || 5000;
	const effective = Math.max(1000, parsed);
	if (_rawProxyTimeout !== undefined && effective !== Number(_rawProxyTimeout)) {
		console.warn(`[Middleware] PROXY_TIMEOUT_MS value '${_rawProxyTimeout}' is invalid or below minimum; using ${effective}ms`);
	}
	return effective;
})();

/**
 * CSP NONCE — platform#18 (Security Headers)
 *
 * buildCsp() is imported from @/lib/csp (athena#108 extraction).
 *
 * A cryptographic nonce is generated per-request and injected into:
 *   1. The `Content-Security-Policy` response header (via `'nonce-{value}'` in script-src)
 *   2. The `x-nonce` request header, so layout.tsx can forward it to Next.js <Script> components
 *      and any inline <script> blocks.
 *
 * This CSP is NOT set on API routes (/api/*). It applies only to page (HTML) responses.
 */

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
	/**
	 * Admin proxy routes — athena#51 (P0 SECURITY fix).
	 *
	 * These proxy to Kratos Admin, Hydra Admin, and IAM Kratos Admin APIs which
	 * expose full identity/OAuth2 management (create/delete identities, create
	 * OAuth2 clients, revoke sessions, read metadata_admin, etc.).
	 *
	 * Previously these routes were listed in isProxyRoute() which bypassed the
	 * auth gate entirely, leaving them unauthenticated. Now they require both
	 * a valid session AND the admin role.
	 */
	"/api/kratos-admin",
	"/api/hydra-admin",
	"/api/iam-kratos-admin",
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
 * Routes handled by the Ory proxy below — PUBLIC proxy endpoints only.
 *
 * SECURITY (athena#51): Admin proxy routes (/api/kratos-admin/,
 * /api/hydra-admin/, /api/iam-kratos-admin/) are intentionally EXCLUDED
 * from this list. They MUST go through the auth + admin role gate in the
 * middleware function below. Previously these were listed here which
 * bypassed auth entirely — that was the root cause of athena#51.
 *
 * Only the public Ory endpoints (which serve unauthenticated flows like
 * login, registration, recovery) are exempt from the Athena auth gate.
 */
function isProxyRoute(pathname: string): boolean {
	return pathname.startsWith("/api/kratos/") || pathname.startsWith("/api/iam-kratos/") || pathname.startsWith("/api/hydra/");
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
			signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
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
		// Log full error details server-side only — never expose to client (athena#109 / Security C3)
		console.error(`[Middleware] Failed to proxy ${request.nextUrl.pathname}:`, error);
		console.error(`[Middleware] Error details:`, {
			message: error instanceof Error ? error.message : "Unknown error",
			stack: error instanceof Error ? error.stack : undefined,
			name: error instanceof Error ? error.name : undefined,
		});

		// Handle proxy timeout — stale TCP connections (platform#65 / athena#109)
		// Security C3: body must not contain serviceName, baseUrl, or internal error text.
		if (error instanceof Error && error.name === "TimeoutError") {
			return NextResponse.json(
				{
					error: "gateway_timeout",
					message: "Upstream service did not respond within the timeout window.",
				},
				{ status: 504 },
			);
		}

		// Handle fetch/network errors (e.g. ECONNREFUSED, DNS failure).
		// Security C3 DA extension: generic error path must also not leak upstream URLs or details.
		if (error instanceof TypeError && error.message.includes("fetch")) {
			return NextResponse.json(
				{
					error: "bad_gateway",
					message: "Unable to reach upstream service.",
				},
				{ status: 502 },
			);
		}

		// Generic catch — unknown errors. No internal details in response (Security C3 DA extension).
		return NextResponse.json(
			{
				error: "proxy_error",
				message: "An unexpected error occurred.",
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

	// --- Public routes (no auth required) ------------------------------------
	if (isPublicRoute(pathname)) {
		return NextResponse.next();
	}

	// --- Public Ory proxy routes (no Athena auth — Ory handles its own) ------
	if (isProxyRoute(pathname)) {
		return routeProxy(request, pathname);
	}

	// --- Auth enforcement for all remaining API routes -----------------------
	// This covers both regular API routes AND admin proxy routes (athena#51).
	const session = await parseSession(request.cookies.get(SESSION_COOKIE)?.value);

	if (!session) {
		// athena#60: standardized error shape — machine-readable code, message, hint
		// hint must NOT contain role names or internal service identifiers (Security C3)
		return NextResponse.json(
			{
				error: "not_authenticated",
				message: "Authentication required.",
				hint: "Authenticate via /api/auth/login",
			},
			{ status: 401 },
		);
	}

	if (isAdminRoute(pathname) && !isAdmin(session)) {
		// athena#60: 403 hint must NOT name specific role identifiers (Security C3 / DA condition)
		return NextResponse.json(
			{
				error: "forbidden",
				message: "Admin access required.",
				hint: "Contact your administrator to request access.",
			},
			{ status: 403 },
		);
	}

	// --- Admin proxy routes: auth passed, now proxy to upstream ---------------
	// athena#51: These routes require a valid admin session before proxying.
	// The proxy happens AFTER auth enforcement, not instead of it.
	if (pathname.startsWith("/api/kratos-admin/") || pathname.startsWith("/api/iam-kratos-admin/") || pathname.startsWith("/api/hydra-admin/")) {
		return routeProxy(request, pathname);
	}

	// --- Regular authenticated API routes ------------------------------------
	// Forward user info to downstream route handlers
	const headers = new Headers(request.headers);
	headers.set("x-user-email", session.user.email);
	headers.set("x-user-role", session.user.role);
	headers.set("x-user-id", session.user.kratosIdentityId);

	return NextResponse.next({ request: { headers } });
}

/**
 * Route a request to the appropriate Ory proxy service based on pathname.
 *
 * Factored out of the main middleware function to allow both public and
 * authenticated proxy routes to share the same routing logic (athena#51).
 */
function routeProxy(request: NextRequest, pathname: string): Promise<NextResponse> {
	// Kratos public
	if (pathname.startsWith("/api/kratos/")) {
		const kratosPublicUrl = process.env.KRATOS_PUBLIC_URL || "http://localhost:3100";
		return proxyToService(request, kratosPublicUrl, "/api/kratos", "Kratos");
	}

	// Kratos admin (auth enforced before reaching here — athena#51)
	if (pathname.startsWith("/api/kratos-admin/")) {
		const kratosAdminUrl = process.env.KRATOS_ADMIN_URL || "http://localhost:3101";
		return proxyToService(request, kratosAdminUrl, "/api/kratos-admin", "Kratos");
	}

	// IAM Kratos public
	if (pathname.startsWith("/api/iam-kratos/")) {
		const iamKratosPublicUrl = process.env.IAM_KRATOS_PUBLIC_URL || "http://localhost:4100";
		return proxyToService(request, iamKratosPublicUrl, "/api/iam-kratos", "Kratos");
	}

	// IAM Kratos admin (auth enforced before reaching here — athena#51)
	if (pathname.startsWith("/api/iam-kratos-admin/")) {
		const iamKratosAdminUrl = process.env.IAM_KRATOS_ADMIN_URL || "http://localhost:4101";
		return proxyToService(request, iamKratosAdminUrl, "/api/iam-kratos-admin", "Kratos");
	}

	// Hydra public
	if (pathname.startsWith("/api/hydra/")) {
		const hydraPublicUrl = process.env.HYDRA_PUBLIC_URL || "http://localhost:3102";
		return proxyToService(request, hydraPublicUrl, "/api/hydra", "Hydra");
	}

	// Hydra admin (auth enforced before reaching here — athena#51)
	if (pathname.startsWith("/api/hydra-admin/")) {
		const hydraAdminUrl = process.env.HYDRA_ADMIN_URL || "http://localhost:3103";
		return proxyToService(request, hydraAdminUrl, "/api/hydra-admin", "Hydra");
	}

	// Fallback — should not be reached if isProxyRoute() and admin proxy checks are consistent
	return Promise.resolve(NextResponse.next());
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
