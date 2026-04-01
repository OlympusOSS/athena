import { createHash, randomBytes } from "node:crypto";
import { getSettingOrDefault } from "@olympusoss/sdk";
import { NextResponse } from "next/server";

export async function GET() {
	// Configurable auth Hydra — defaults to IAM Hydra (admins are IAM identities)
	const hydraPublicUrl = process.env.NEXT_PUBLIC_AUTH_HYDRA_URL || process.env.NEXT_PUBLIC_IAM_HYDRA_PUBLIC_URL || "http://localhost:4102";

	let clientId: string;
	try {
		clientId = await getSettingOrDefault("oauth.client_id", process.env.OAUTH_CLIENT_ID || "");
	} catch {
		clientId = process.env.OAUTH_CLIENT_ID || "";
	}
	if (!clientId) {
		clientId = process.env.OAUTH_CLIENT_ID || "";
	}
	const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4001";
	const redirectUri = `${appUrl}/api/auth/callback`;

	const state = randomBytes(32).toString("hex");

	// PKCE: generate code_verifier and derive code_challenge (S256)
	const codeVerifier = randomBytes(32).toString("base64url");
	const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

	const authUrl = new URL("/oauth2/auth", hydraPublicUrl);
	authUrl.searchParams.set("client_id", clientId);
	authUrl.searchParams.set("response_type", "code");
	authUrl.searchParams.set("scope", "openid profile email");
	authUrl.searchParams.set("redirect_uri", redirectUri);
	authUrl.searchParams.set("state", state);
	authUrl.searchParams.set("code_challenge", codeChallenge);
	authUrl.searchParams.set("code_challenge_method", "S256");

	const response = NextResponse.redirect(authUrl.toString());

	response.cookies.set("oauth_state", state, {
		httpOnly: true,
		path: "/",
		maxAge: 300,
		sameSite: "lax",
	});

	// Store the code_verifier so the callback can complete the PKCE exchange
	response.cookies.set("pkce_verifier", codeVerifier, {
		httpOnly: true,
		path: "/",
		maxAge: 300,
		sameSite: "lax",
	});

	return response;
}
