/**
 * Shared authentication types and helpers for middleware and API routes.
 *
 * The session cookie ("athena-session") is HMAC-signed. Use
 * `parseSession()` (which delegates to `verifySession()`) to read it —
 * never JSON.parse the raw cookie value directly.
 */

import { verifySession } from "./session";

// Re-export types so existing imports from "@/lib/auth" keep working.
export type { SessionData, SessionUser } from "./session";

/** Name of the session cookie — must stay in sync with the callback route. */
export const SESSION_COOKIE = "athena-session";

/** Roles that are considered "admin" for route-protection purposes. */
const ADMIN_ROLES = new Set(["admin"]);

/**
 * Parse, verify, and validate the raw session cookie value.
 * Returns the typed session data, or null if the cookie is missing,
 * malformed, or the HMAC signature is invalid.
 */
export async function parseSession(raw: string | undefined) {
	return verifySession(raw);
}

/** Returns true when the session user holds an admin role. */
export function isAdmin(session: { user: { role: string } }): boolean {
	return ADMIN_ROLES.has(session.user.role);
}
