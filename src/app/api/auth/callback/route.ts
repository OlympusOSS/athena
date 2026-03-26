import { getSecretSetting, getSettingOrDefault } from "@olympusoss/sdk";
import { type NextRequest, NextResponse } from "next/server";

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

	// Configurable auth Hydra — defaults to IAM Hydra (admins are IAM identities)
	const hydraUrl = process.env.AUTH_HYDRA_URL || process.env.IAM_HYDRA_PUBLIC_URL || "http://localhost:4102";
	const redirectUri = `${appUrl}/api/auth/callback`;

	let clientId: string;
	let clientSecret: string;
	try {
		clientId = await getSettingOrDefault("oauth.client_id", process.env.OAUTH_CLIENT_ID || "");
		const vaultSecret = await getSecretSetting("oauth.client_secret");
		clientSecret = vaultSecret || process.env.OAUTH_CLIENT_SECRET || "";
	} catch {
		clientId = process.env.OAUTH_CLIENT_ID || "";
		clientSecret = process.env.OAUTH_CLIENT_SECRET || "";
	}
	const kratosAdminUrl = process.env.AUTH_KRATOS_ADMIN_URL || process.env.IAM_KRATOS_ADMIN_URL || "http://localhost:4101";

	try {
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

		response.cookies.set("athena-session", JSON.stringify(sessionData), {
			httpOnly: true,
			path: "/",
			maxAge: tokens.expires_in || 3600,
			sameSite: "lax",
		});

		response.cookies.delete("oauth_state");

		return response;
	} catch (err) {
		console.error("OAuth callback error:", err);
		return NextResponse.redirect(new URL("/api/auth/login", appUrl));
	}
}
