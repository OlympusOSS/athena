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
	const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4003";
	const hydraPublicUrl = process.env.NEXT_PUBLIC_IAM_HYDRA_PUBLIC_URL || "http://localhost:4102";
	// IAM Hydra admin URL — needed to revoke login/consent sessions server-side
	const iamHydraAdminUrl = process.env.IAM_HYDRA_ADMIN_URL || "http://localhost:4103";

	// Read session to get ID token for RP-Initiated Logout
	const sessionCookie = request.cookies.get("athena-session")?.value;
	let idToken: string | null = null;
	let subject: string | null = null;

	if (sessionCookie) {
		try {
			const session = JSON.parse(sessionCookie);
			idToken = session.idToken || null;
			subject = session.user?.kratosIdentityId || null;
		} catch (err) {
			console.error("Failed to parse session cookie:", err);
		}
	}

	// Decode subject from ID token if not in session data
	if (!subject && idToken) {
		try {
			const parts = idToken.split(".");
			if (parts.length === 3) {
				const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
				subject = claims.sub || null;
			}
		} catch {
			// Ignore decode errors
		}
	}

	// Revoke Hydra login & consent sessions BEFORE redirecting to Hydra's
	// RP-Initiated Logout. This ensures that even if Hydra skips the
	// logout_url callback, the user cannot be auto-logged back in.
	if (subject) {
		await Promise.all([revokeHydraLoginSessions(iamHydraAdminUrl, subject), revokeHydraConsentSessions(iamHydraAdminUrl, subject)]);
	}

	const postLogoutRedirectUri = `${appUrl}/api/auth/login`;

	if (idToken) {
		// RP-Initiated Logout: redirect to Hydra to invalidate the login session
		const logoutUrl = new URL("/oauth2/sessions/logout", hydraPublicUrl);
		logoutUrl.searchParams.set("id_token_hint", idToken);
		logoutUrl.searchParams.set("post_logout_redirect_uri", postLogoutRedirectUri);

		const response = NextResponse.redirect(logoutUrl.toString());
		response.cookies.delete("athena-session");
		return response;
	}

	// Fallback: no ID token available, just clear cookie and redirect to login
	const response = NextResponse.redirect(new URL("/api/auth/login", appUrl));
	response.cookies.delete("athena-session");
	return response;
}
