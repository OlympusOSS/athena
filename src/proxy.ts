import { type NextRequest, NextResponse } from "next/server";
import { decryptApiKey } from "@/lib/crypto-edge";

// Routes that don't require authentication
const PUBLIC_PATHS = ["/login", "/auth/error", "/auth/recovery"];

function isPublicPath(pathname: string): boolean {
	if (PUBLIC_PATHS.includes(pathname)) return true;
	return false;
}

function isApiPath(pathname: string): boolean {
	return pathname.startsWith("/api/");
}

async function checkIamSession(request: NextRequest): Promise<boolean> {
	const iamKratosUrl = process.env.IAM_KRATOS_PUBLIC_URL || "http://localhost:7000";

	try {
		const cookieHeader = request.headers.get("cookie") || "";
		const response = await fetch(`${iamKratosUrl}/sessions/whoami`, {
			headers: {
				cookie: cookieHeader,
			},
		});
		return response.ok;
	} catch {
		return false;
	}
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
			const kratosApiKeyEncrypted =
				request.cookies.get("kratos-api-key")?.value || request.headers.get("x-kratos-api-key") || process.env.KRATOS_API_KEY || undefined;
			if (kratosApiKeyEncrypted) {
				// Decrypt the API key (handles both encrypted and plain text values)
				const kratosApiKey = await decryptApiKey(kratosApiKeyEncrypted);
				if (kratosApiKey) {
					authorizationHeader = `Bearer ${kratosApiKey}`;
				}
			}
		} else if (serviceName === "Hydra") {
			const hydraApiKeyEncrypted =
				request.cookies.get("hydra-api-key")?.value || request.headers.get("x-hydra-api-key") || process.env.HYDRA_API_KEY || undefined;
			if (hydraApiKeyEncrypted) {
				// Decrypt the API key (handles both encrypted and plain text values)
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
			// Don't follow redirects for IamKratos so we can capture set-cookie headers
			// (e.g., Kratos logout returns 302 with set-cookie to clear the session)
			...(serviceName === "IamKratos" && { redirect: "manual" as const }),
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
		const safeHeaders = ["content-type", "cache-control", "etag", "last-modified", "vary", "link"];
		response.headers.forEach((value, key) => {
			const lowerKey = key.toLowerCase();
			// Only copy safe headers and custom x-* headers (excluding forwarding headers)
			if (safeHeaders.includes(lowerKey) || (lowerKey.startsWith("x-") && !lowerKey.startsWith("x-forwarded") && !lowerKey.startsWith("x-real-ip"))) {
				responseHeaders.set(key, value);
			}
		});

		// Forward set-cookie headers for auth flows (needed for session cookies)
		if (serviceName === "IamKratos") {
			const setCookieValues: string[] = [];
			response.headers.forEach((value, key) => {
				if (key.toLowerCase() === "set-cookie") {
					setCookieValues.push(value);
				}
			});
			for (const cookie of setCookieValues) {
				responseHeaders.append("set-cookie", cookie);
			}
		}

		return new NextResponse(responseBody, {
			status: response.status,
			statusText: response.statusText,
			headers: responseHeaders,
		});
	} catch (error) {
		console.error(`[Proxy] Failed to proxy ${request.nextUrl.pathname}:`, error);
		console.error(`[Proxy] Error details:`, {
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

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// ── API Proxy Routes ──

	// Handle Kratos public API proxying
	if (pathname.startsWith("/api/kratos/")) {
		const kratosPublicUrlRaw =
			request.cookies.get("kratos-public-url")?.value ||
			request.headers.get("x-kratos-public-url") ||
			process.env.KRATOS_PUBLIC_URL ||
			"http://localhost:5000";

		const kratosPublicUrl = decodeURIComponent(kratosPublicUrlRaw);
		return proxyToService(request, kratosPublicUrl, "/api/kratos", "Kratos");
	}

	// Handle Kratos admin API proxying
	if (pathname.startsWith("/api/kratos-admin/")) {
		const kratosAdminUrlRaw =
			request.cookies.get("kratos-admin-url")?.value ||
			request.headers.get("x-kratos-admin-url") ||
			process.env.KRATOS_ADMIN_URL ||
			"http://localhost:5001";

		const kratosAdminUrl = decodeURIComponent(kratosAdminUrlRaw);
		return proxyToService(request, kratosAdminUrl, "/api/kratos-admin", "Kratos");
	}

	// Handle IAM Kratos public API proxying (internal IAM auth flows)
	if (pathname.startsWith("/api/iam-kratos/")) {
		const iamKratosPublicUrl = process.env.IAM_KRATOS_PUBLIC_URL || "http://localhost:7000";
		return proxyToService(request, iamKratosPublicUrl, "/api/iam-kratos", "IamKratos");
	}

	// Handle Hydra public API proxying
	if (pathname.startsWith("/api/hydra/")) {
		const hydraPublicUrlRaw =
			request.cookies.get("hydra-public-url")?.value ||
			request.headers.get("x-hydra-public-url") ||
			process.env.HYDRA_PUBLIC_URL ||
			"http://localhost:5002";

		const hydraPublicUrl = decodeURIComponent(hydraPublicUrlRaw);
		return proxyToService(request, hydraPublicUrl, "/api/hydra", "Hydra");
	}

	// Handle Hydra admin API proxying
	if (pathname.startsWith("/api/hydra-admin/")) {
		const hydraAdminUrlRaw =
			request.cookies.get("hydra-admin-url")?.value ||
			request.headers.get("x-hydra-admin-url") ||
			process.env.HYDRA_ADMIN_URL ||
			"http://localhost:5003";

		const hydraAdminUrl = decodeURIComponent(hydraAdminUrlRaw);
		return proxyToService(request, hydraAdminUrl, "/api/hydra-admin", "Hydra");
	}

	// ── Authentication Guard ──

	// Skip auth check for public paths and API routes (handled above)
	if (isPublicPath(pathname) || isApiPath(pathname)) {
		return NextResponse.next();
	}

	// Check iam-kratos session for all other routes
	const hasValidSession = await checkIamSession(request);

	if (!hasValidSession) {
		const loginUrl = new URL("/login", request.url);
		loginUrl.searchParams.set("return_to", pathname);
		return NextResponse.redirect(loginUrl);
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		// Match all paths except static files and Next.js internals
		"/((?!_next/static|_next/image|favicon).*)",
	],
};
