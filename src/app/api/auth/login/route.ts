import { randomBytes } from "node:crypto";
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

	const authUrl = new URL("/oauth2/auth", hydraPublicUrl);
	authUrl.searchParams.set("client_id", clientId);
	authUrl.searchParams.set("response_type", "code");
	authUrl.searchParams.set("scope", "openid profile email");
	authUrl.searchParams.set("redirect_uri", redirectUri);
	authUrl.searchParams.set("state", state);

	const response = NextResponse.redirect(authUrl.toString());

	response.cookies.set("oauth_state", state, {
		httpOnly: true,
		path: "/",
		maxAge: 300,
		sameSite: "lax",
	});

	return response;
}
