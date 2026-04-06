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
	// NEXT_PUBLIC_APP_URL is always set per-instance (CIAM=3001, IAM=4001).
	// The fallback must NOT default to the other instance's URL.
	const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.APP_INSTANCE === "CIAM" ? "http://localhost:3001" : "http://localhost:4001");
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

	// oauth_state and pkce_verifier are short-lived flow-state tokens, not session credentials.
	// They must NOT use buildSessionCookieOptions from lib/cookie-options.ts — that helper is
	// designed for athena-session and uses sameSite: 'strict' and maxAge: 28800s, both of which
	// are incorrect for these cookies.
	//
	// sameSite: 'lax' is required (not 'strict') because the OAuth2 callback is a cross-origin
	// top-level navigation redirect from Hydra back to Athena. With sameSite: 'strict', the
	// browser drops both cookies on that redirect, breaking CSRF verification and the PKCE
	// exchange for all users.
	//
	// maxAge: 300 (5 minutes) — implementation reason: these cookies only need to survive the
	// browser round-trip from the login redirect to Hydra and back, which takes seconds in
	// practice. 5 minutes is already generous for this window. Security reason: a shorter
	// lifetime minimizes the attack surface window for a stolen oauth_state or pkce_verifier.
	// If either cookie is intercepted, the window during which it can be submitted to the
	// callback route is bounded to 300 seconds — the authorization code at Hydra may still
	// be valid for up to 10 minutes, but the stolen cookie becomes useless after 5.
	// Do not increase this value — a longer maxAge extends exposure without functional benefit.
	//
	// secure: without this flag, the browser transmits the CSRF state token and PKCE verifier
	// over plain HTTP on any same-origin HTTP resource load — including mixed-content subrequests
	// on an otherwise HTTPS page — regardless of whether the server is HTTPS-terminated. An
	// attacker with a position to observe HTTP traffic on the same origin can intercept both
	// tokens and attempt a CSRF attack or PKCE exchange completion. The Secure flag ensures
	// the browser only sends these cookies over TLS. Omitted in development (NODE_ENV !== 'production')
	// so localhost dev over HTTP continues to work without TLS. Fix for hera#33.
	response.cookies.set("oauth_state", state, {
		httpOnly: true,
		path: "/",
		maxAge: 300,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
	});

	// Store the code_verifier so the callback can complete the PKCE exchange.
	// See comment above for the full rationale on sameSite, maxAge, and secure attributes.
	response.cookies.set("pkce_verifier", codeVerifier, {
		httpOnly: true,
		path: "/",
		maxAge: 300,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
	});

	return response;
}
