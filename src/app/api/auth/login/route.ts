import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

export async function GET() {
	const hydraPublicUrl = process.env.NEXT_PUBLIC_IAM_HYDRA_PUBLIC_URL || "http://localhost:4102";
	const clientId = process.env.OAUTH_CLIENT_ID || "athena-iam-client";
	const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4003";
	const redirectUri = `${appUrl}/api/auth/callback`;

	// Generate CSRF state parameter
	const state = randomBytes(32).toString("hex");

	const authUrl = new URL("/oauth2/auth", hydraPublicUrl);
	authUrl.searchParams.set("client_id", clientId);
	authUrl.searchParams.set("response_type", "code");
	authUrl.searchParams.set("scope", "openid profile email");
	authUrl.searchParams.set("redirect_uri", redirectUri);
	authUrl.searchParams.set("state", state);

	const response = NextResponse.redirect(authUrl.toString());

	// Store state in httpOnly cookie for CSRF verification
	response.cookies.set("oauth_state", state, {
		httpOnly: true,
		path: "/",
		maxAge: 300, // 5 minutes
		sameSite: "lax",
	});

	return response;
}
