import { type NextRequest, NextResponse } from "next/server";

/**
 * Revoke all Hydra OAuth2 login sessions for a subject via the admin API.
 * Non-throwing — logs errors but allows logout to proceed.
 */
async function revokeHydraLoginSessions(hydraAdminUrl: string, subject: string): Promise<void> {
	try {
		const res = await fetch(`${hydraAdminUrl}/admin/oauth2/auth/sessions/login?subject=${encodeURIComponent(subject)}`, { method: "DELETE" });
		if (!res.ok && res.status !== 404 && res.status !== 204) {
			const text = await res.text().catch(() => "");
			console.error(`Failed to revoke Hydra login sessions for ${subject} (${res.status}): ${text}`);
		}
	} catch (err) {
		console.error(`Error revoking Hydra login sessions for ${subject}:`, err);
	}
}

/**
 * Revoke all Kratos sessions for a given identity via the admin API.
 * This prevents auto-login via a lingering ory_kratos_session cookie.
 * Non-throwing — logs errors but allows logout to proceed.
 */
async function revokeKratosSessions(kratosAdminUrl: string, identityId: string): Promise<void> {
	try {
		const res = await fetch(`${kratosAdminUrl}/admin/identities/${identityId}/sessions`, { method: "DELETE" });
		if (!res.ok && res.status !== 404 && res.status !== 204) {
			const text = await res.text().catch(() => "");
			console.error(`Failed to revoke Kratos sessions for ${identityId} (${res.status}): ${text}`);
		}
	} catch (err) {
		console.error(`Error revoking Kratos sessions for ${identityId}:`, err);
	}
}

/**
 * Revoke all Hydra OAuth2 consent sessions for a subject via the admin API.
 * Non-throwing — logs errors but allows logout to proceed.
 */
async function revokeHydraConsentSessions(hydraAdminUrl: string, subject: string): Promise<void> {
	try {
		const res = await fetch(`${hydraAdminUrl}/admin/oauth2/auth/sessions/consent?subject=${encodeURIComponent(subject)}&all=true`, {
			method: "DELETE",
		});
		if (!res.ok && res.status !== 404 && res.status !== 204) {
			const text = await res.text().catch(() => "");
			console.error(`Failed to revoke Hydra consent sessions for ${subject} (${res.status}): ${text}`);
		}
	} catch (err) {
		console.error(`Error revoking Hydra consent sessions for ${subject}:`, err);
	}
}

export async function GET(request: NextRequest) {
	const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4001";
	// Configurable auth Hydra/Kratos admin URLs — defaults to IAM
	const iamHydraAdminUrl = process.env.AUTH_HYDRA_ADMIN_URL
		|| process.env.IAM_HYDRA_ADMIN_URL
		|| "http://localhost:4103";
	const iamKratosAdminUrl = process.env.AUTH_KRATOS_ADMIN_URL
		|| process.env.IAM_KRATOS_ADMIN_URL
		|| "http://localhost:4101";

	// Read session to extract subject for server-side session revocations
	const sessionCookie = request.cookies.get("athena-session")?.value;
	let subject: string | null = null;

	if (sessionCookie) {
		try {
			const session = JSON.parse(sessionCookie);
			subject = session.user?.kratosIdentityId || null;

			// Fallback: decode subject from ID token if not in session data
			if (!subject && session.idToken) {
				const parts = session.idToken.split(".");
				if (parts.length === 3) {
					const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
					subject = claims.sub || null;
				}
			}
		} catch (err) {
			console.error("Failed to parse session cookie:", err);
		}
	}

	// Revoke ALL sessions — Kratos, Hydra login, and Hydra consent — BEFORE
	// redirecting to Hydra's RP-Initiated Logout. This ensures the user
	// cannot be auto-logged back in via a lingering ory_kratos_session cookie.
	if (subject) {
		await Promise.all([
			revokeKratosSessions(iamKratosAdminUrl, subject),
			revokeHydraLoginSessions(iamHydraAdminUrl, subject),
			revokeHydraConsentSessions(iamHydraAdminUrl, subject),
		]);
	}

	// Cookie deletion helper — must match the attributes used when setting the cookie
	// so the browser recognises it as the same cookie and actually removes it.
	function clearSessionCookie(response: NextResponse) {
		response.cookies.set("athena-session", "", {
			httpOnly: true,
			path: "/",
			maxAge: 0,
			sameSite: "lax",
		});
	}

	// Return a small HTML page that clears the cookie (via Set-Cookie header on
	// a 200 response) and then redirects client-side.  Using a 200 + meta-refresh
	// instead of a 307 redirect ensures the browser ALWAYS processes the
	// Set-Cookie header before navigating away — some browsers can drop
	// Set-Cookie on rapid redirect chains, which caused the cookie to survive
	// logout and silently re-authenticate the user.
	const loginUrl = new URL("/api/auth/login", appUrl).toString();
	const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${loginUrl}"></head><body></body></html>`;
	const response = new NextResponse(html, {
		status: 200,
		headers: { "Content-Type": "text/html; charset=utf-8" },
	});
	clearSessionCookie(response);
	return response;
}
