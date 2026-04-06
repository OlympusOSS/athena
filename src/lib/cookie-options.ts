/**
 * Shared session cookie options helper.
 *
 * Single source of truth for all `athena-session` cookie attributes.
 * All auth routes (callback, logout) must import from here — no inline
 * cookie option objects are permitted in auth route handlers.
 *
 * Security attributes enforced:
 *   - httpOnly: true           — blocks JavaScript access (XSS protection)
 *   - sameSite: "strict"       — prevents cross-site cookie transmission (CSRF protection)
 *   - secure: production-only  — HTTPS-only transmission in production (MITM protection)
 *   - maxAge cap: 28800s (8h)  — admin sessions never persist for more than 8 hours
 *
 * The `secure` flag is conditionally set so localhost dev (HTTP) continues
 * to work without TLS. In production the flag is always true.
 *
 * Passing maxAge=0 is the cookie-deletion pattern (used by the logout route).
 * Math.min(0, 28800) === 0, so the cap is safe for the clear case.
 *
 * Scope: this helper is for `athena-session` only. The `oauth_state` and
 * `pkce_verifier` flow-state tokens in the login route must NOT use this helper.
 * They require sameSite: 'lax' (not 'strict') because the OAuth2 callback is a
 * cross-origin top-level navigation from Hydra — 'strict' would cause the browser
 * to drop both cookies on the redirect, breaking CSRF verification and the PKCE
 * exchange for all users. They also require maxAge: 300s (not 28800s) to minimize
 * the attack surface window for stolen tokens. See /api/auth/login/route.ts for
 * those cookies' explicit options objects.
 */
export function buildSessionCookieOptions(maxAge: number): {
	httpOnly: boolean;
	path: string;
	sameSite: "strict";
	secure: boolean;
	maxAge: number;
} {
	return {
		httpOnly: true,
		path: "/",
		sameSite: "strict",
		secure: process.env.NODE_ENV === "production",
		// Cap at 8 hours (28800s) to prevent multi-day admin sessions.
		// maxAge=0 (cookie deletion) is preserved by Math.min.
		maxAge: Math.min(maxAge, 28800),
	};
}

/**
 * Returns cookie options for clearing the session (maxAge=0).
 * Convenience wrapper that makes the deletion intent explicit.
 */
export function buildSessionClearOptions(): ReturnType<typeof buildSessionCookieOptions> {
	return buildSessionCookieOptions(0);
}
