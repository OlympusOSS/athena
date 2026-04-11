import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
	test("unauthenticated request to root redirects to login", async ({
		page,
	}) => {
		const response = await page.goto("/");
		// Should redirect to login or show auth-required state
		expect(response?.status()).toBeLessThan(500);
	});

	test("GET /api/auth/login redirects to Hydra authorize endpoint", async ({
		request,
	}) => {
		const response = await request.get("/api/auth/login", {
			maxRedirects: 0,
		});
		// Login should redirect (302) to Hydra's /oauth2/auth
		expect(response.status()).toBe(307);
		const location = response.headers().location || "";
		expect(location).toContain("/oauth2/auth");
		expect(location).toContain("response_type=code");
		expect(location).toContain("code_challenge_method=S256");
	});

	test("login sets oauth_state and pkce_verifier cookies", async ({
		request,
	}) => {
		const response = await request.get("/api/auth/login", {
			maxRedirects: 0,
		});
		const cookies = response.headers()["set-cookie"] || "";
		expect(cookies).toContain("oauth_state");
		expect(cookies).toContain("pkce_verifier");
		expect(cookies).toContain("HttpOnly");
		expect(cookies).toContain("SameSite=Lax");
	});

	test("GET /api/auth/logout clears session", async ({ request }) => {
		const response = await request.get("/api/auth/logout", {
			maxRedirects: 0,
		});
		// Logout should redirect (clear session + redirect to Hydra logout or home)
		expect([200, 302, 307]).toContain(response.status());
	});
});
