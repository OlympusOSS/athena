import { getSettingOrDefault } from "@olympusoss/sdk";
import { type NextRequest, NextResponse } from "next/server";
import { signSession } from "@/lib/session";

export async function GET(request: NextRequest) {
	const code = request.nextUrl.searchParams.get("code");
	const state = request.nextUrl.searchParams.get("state");

	const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4001";

	if (!code) {
		return NextResponse.redirect(new URL("/api/auth/login", appUrl));
	}

	const storedState = request.cookies.get("oauth_state")?.value;
	if (!state || state !== storedState) {
		console.error("OAuth state mismatch");
		return NextResponse.redirect(new URL("/api/auth/login", appUrl));
	}

	// PKCE: retrieve the code_verifier stored during the login initiation
	const codeVerifier = request.cookies.get("pkce_verifier")?.value;
	if (!codeVerifier) {
		console.error("PKCE code_verifier cookie missing");
		return NextResponse.redirect(new URL("/api/auth/login", appUrl));
	}

	// Configurable auth Hydra — defaults to IAM Hydra (admins are IAM identities)
	const hydraUrl = process.env.AUTH_HYDRA_URL || process.env.IAM_HYDRA_PUBLIC_URL || "http://localhost:4102";
	const redirectUri = `${appUrl}/api/auth/callback`;

	let clientId: string;
	try {
		clientId = await getSettingOrDefault("oauth.client_id", process.env.OAUTH_CLIENT_ID || "");
	} catch {
		clientId = process.env.OAUTH_CLIENT_ID || "";
	}
	const kratosAdminUrl = process.env.AUTH_KRATOS_ADMIN_URL || process.env.IAM_KRATOS_ADMIN_URL || "http://localhost:4101";

	try {
		// Public client: no client_secret, no Basic auth header. PKCE code_verifier is sent instead.
		const tokenRes = await fetch(`${hydraUrl}/oauth2/token`, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				grant_type: "authorization_code",
				code,
				redirect_uri: redirectUri,
				client_id: clientId,
				code_verifier: codeVerifier,
			}).toString(),
		});

		if (!tokenRes.ok) {
			const error = await tokenRes.text();
			console.error("Token exchange failed:", error);
			return NextResponse.redirect(new URL("/api/auth/login", appUrl));
		}

		const tokens = await tokenRes.json();

		// Fetch verified claims from Hydra's userinfo endpoint.
		// The access_token has already been validated by Hydra at the token endpoint;
		// presenting it here lets Hydra return authoritative, signature-verified claims.
		// PROHIBITION: the id_token MUST NOT be decoded for any claim retrieval — all
		// claims come exclusively from this response. See architecture-brief-jwks-verification.md.
		const userinfoRes = await fetch(`${hydraUrl}/userinfo`, {
			headers: {
				Authorization: `Bearer ${tokens.access_token}`,
			},
		});

		if (!userinfoRes.ok) {
			const error = await userinfoRes.text();
			console.error("Userinfo fetch failed:", error);
			return NextResponse.redirect(new URL("/api/auth/login", appUrl));
		}

		const userinfo = await userinfoRes.json();
		const sub: string = userinfo.sub || "";
		let email: string = userinfo.email || "";

		let role = "viewer";
		let displayName = email;
		if (sub) {
			try {
				const identityRes = await fetch(`${kratosAdminUrl}/admin/identities/${sub}`, {
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

		const signedCookie = await signSession(sessionData);
		response.cookies.set("athena-session", signedCookie, {
			httpOnly: true,
			path: "/",
			maxAge: tokens.expires_in || 3600,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
		});

		response.cookies.delete("oauth_state");
		response.cookies.delete("pkce_verifier");

		return response;
	} catch (err) {
		console.error("OAuth callback error:", err);
		return NextResponse.redirect(new URL("/api/auth/login", appUrl));
	}
}
