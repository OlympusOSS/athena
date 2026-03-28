/**
 * Shared authentication types and helpers for middleware and API routes.
 *
 * The session cookie ("athena-session") is set in /api/auth/callback and
 * contains an OAuth2 token set plus a user object with role information
 * fetched from Kratos at login time.
 */

/** Shape of the user object stored inside the session cookie. */
export interface SessionUser {
	kratosIdentityId: string;
	email: string;
	role: string;
	displayName: string;
}

/** Full session payload persisted in the athena-session cookie. */
export interface SessionData {
	accessToken: string;
	idToken: string;
	refreshToken: string;
	expiresIn: number;
	user: SessionUser;
}

/** Name of the session cookie — must stay in sync with the callback route. */
export const SESSION_COOKIE = "athena-session";

/** Roles that are considered "admin" for route-protection purposes. */
const ADMIN_ROLES = new Set(["admin"]);

/**
 * Parse and validate the raw session cookie value.
 * Returns the typed session data, or null if the cookie is missing / malformed.
 */
export function parseSession(raw: string | undefined): SessionData | null {
	if (!raw) return null;

	try {
		const data = JSON.parse(raw) as SessionData;

		// Minimum viability check — the callback always sets these fields.
		if (!data.accessToken || !data.user?.email || !data.user?.role) {
			return null;
		}

		return data;
	} catch {
		return null;
	}
}

/** Returns true when the session user holds an admin role. */
export function isAdmin(session: SessionData): boolean {
	return ADMIN_ROLES.has(session.user.role);
}
