import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	const code = request.nextUrl.searchParams.get("code");
	const state = request.nextUrl.searchParams.get("state");

	const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4003";

	if (!code) {
		return NextResponse.redirect(new URL("/api/auth/login", appUrl));
	}

	// Verify CSRF state
	const storedState = request.cookies.get("oauth_state")?.value;
	if (!state || state !== storedState) {
		console.error("OAuth state mismatch");
		return NextResponse.redirect(new URL("/api/auth/login", appUrl));
	}

	const hydraUrl = process.env.IAM_HYDRA_PUBLIC_URL || "http://localhost:4102";
	const clientId = process.env.OAUTH_CLIENT_ID || "athena-iam-client";
	const clientSecret = process.env.OAUTH_CLIENT_SECRET || "athena-iam-secret";
	const redirectUri = `${appUrl}/api/auth/callback`;
	const iamKratosAdminUrl = process.env.IAM_KRATOS_ADMIN_URL || "http://localhost:4101";

	try {
		// Exchange authorization code for tokens
		const tokenRes = await fetch(`${hydraUrl}/oauth2/token`, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
			},
			body: new URLSearchParams({
				grant_type: "authorization_code",
				code,
				redirect_uri: redirectUri,
			}).toString(),
		});

		if (!tokenRes.ok) {
			const error = await tokenRes.text();
			console.error("Token exchange failed:", error);
			return NextResponse.redirect(new URL("/api/auth/login", appUrl));
		}

		const tokens = await tokenRes.json();

		// Decode ID token to get subject (identity ID)
		let sub = "";
		let email = "";
		if (tokens.id_token) {
			const parts = tokens.id_token.split(".");
			if (parts.length === 3) {
				const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
				sub = claims.sub || "";
				email = claims.email || "";
			}
		}

		// Fetch full identity from IAM Kratos admin API to get role and name
		let role = "viewer";
		let displayName = email;
		if (sub) {
			try {
				const identityRes = await fetch(`${iamKratosAdminUrl}/admin/identities/${sub}`, {
					headers: { Accept: "application/json" },
				});

				if (identityRes.ok) {
					const identity = await identityRes.json();
					const traits = identity.traits || {};
					email = traits.email || email;
					role = traits.role || "viewer";
					const firstName = traits.name?.first || "";
					const lastName = traits.name?.last || "";
					displayName = [firstName, lastName].filter(Boolean).join(" ") || email;
				}
			} catch (err) {
				console.error("Failed to fetch identity from Kratos:", err);
			}
		}

		// Build session data
		const sessionData = {
			accessToken: tokens.access_token,
			idToken: tokens.id_token,
			refreshToken: tokens.refresh_token,
			expiresIn: tokens.expires_in,
			user: {
				kratosIdentityId: sub,
				email,
				role,
				displayName,
			},
		};

		const response = NextResponse.redirect(new URL("/dashboard", appUrl));

		// Store session in httpOnly cookie
		response.cookies.set("athena-session", JSON.stringify(sessionData), {
			httpOnly: true,
			path: "/",
			maxAge: tokens.expires_in || 3600,
			sameSite: "lax",
		});

		// Clear the OAuth state cookie
		response.cookies.delete("oauth_state");

		return response;
	} catch (err) {
		console.error("OAuth callback error:", err);
		return NextResponse.redirect(new URL("/api/auth/login", appUrl));
	}
}
