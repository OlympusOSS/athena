import { type NextRequest, NextResponse } from "next/server";
import { isAdmin, parseSession, SESSION_COOKIE } from "@/lib/auth";

/**
 * Routes that require the "admin" role.
 * All other matched routes only require a valid session (any role).
 */
const ADMIN_PREFIXES = ["/api/settings", "/api/encrypt", "/api/config"];

function isAdminRoute(pathname: string): boolean {
	return ADMIN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// --- 1. Parse & validate session cookie -----------------------------------
	const session = parseSession(request.cookies.get(SESSION_COOKIE)?.value);

	if (!session) {
		return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
	}

	// --- 2. Role-based protection for admin routes ----------------------------
	if (isAdminRoute(pathname) && !isAdmin(session)) {
		return NextResponse.json({ error: "Forbidden: admin role required" }, { status: 403 });
	}

	// --- 3. Attach user info as request headers for downstream routes ---------
	const headers = new Headers(request.headers);
	headers.set("x-user-email", session.user.email);
	headers.set("x-user-role", session.user.role);
	headers.set("x-user-id", session.user.kratosIdentityId);

	return NextResponse.next({ request: { headers } });
}

/**
 * Match all API routes EXCEPT:
 *  - /api/auth/*  (login, callback, logout, session — public auth flow)
 *  - /api/health  (unauthenticated health check for load balancers)
 */
export const config = {
	matcher: ["/api/((?!auth|health).*)"],
};
