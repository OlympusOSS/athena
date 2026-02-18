import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4003";
	const hydraUrl = process.env.IAM_HYDRA_PUBLIC_URL || "http://localhost:4102";

	// Read session to get tokens for revocation
	const sessionCookie = request.cookies.get("athena-session")?.value;

	if (sessionCookie) {
		try {
			const session = JSON.parse(sessionCookie);
			const clientId = process.env.OAUTH_CLIENT_ID || "athena-iam-client";
			const clientSecret = process.env.OAUTH_CLIENT_SECRET || "athena-iam-secret";

			// Revoke the access token
			if (session.accessToken) {
				await fetch(`${hydraUrl}/oauth2/revoke`, {
					method: "POST",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
						Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
					},
					body: new URLSearchParams({
						token: session.accessToken,
					}).toString(),
				}).catch((err) => console.error("Token revocation failed:", err));
			}
		} catch (err) {
			console.error("Logout error:", err);
		}
	}

	const response = NextResponse.redirect(new URL("/api/auth/login", appUrl));

	// Clear the session cookie
	response.cookies.delete("athena-session");

	return response;
}
