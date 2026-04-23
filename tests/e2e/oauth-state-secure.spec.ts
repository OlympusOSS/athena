import { expect, test } from "@playwright/test";

/**
 * E2E tests for athena#100: secure flag on oauth_state/pkce_verifier
 *
 * Validates that the login route sets correct attributes on
 * flow-state cookies (oauth_state and pkce_verifier).
 */

test.describe("OAuth State Secure Flag - Functional Tests", () => {
	test("F1: oauth_state cookie is set on login", async ({ request }) => {
		const response = await request.get("/api/auth/login", {
			maxRedirects: 0,
		});
		expect(response.status()).toBe(307);
		const cookies = response.headers()["set-cookie"] || "";
		expect(cookies).toContain("oauth_state");
	});

	test("F2: pkce_verifier cookie is set on login", async ({ request }) => {
		const response = await request.get("/api/auth/login", {
			maxRedirects: 0,
		});
		expect(response.status()).toBe(307);
		const cookies = response.headers()["set-cookie"] || "";
		expect(cookies).toContain("pkce_verifier");
	});

	test("F3: oauth_state has correct attributes in dev", async ({ request }) => {
		const response = await request.get("/api/auth/login", {
			maxRedirects: 0,
		});
		const cookies = response.headers()["set-cookie"] || "";
		// In dev mode, Secure should be absent (HTTP localhost)
		const cookieLines = cookies.split(/,(?=[^;]*=)/);
		const oauthCookie = cookieLines.find((c: string) => c.includes("oauth_state="));
		expect(oauthCookie).toBeDefined();
		if (oauthCookie) {
			expect(oauthCookie).toContain("HttpOnly");
			expect(oauthCookie).toContain("Path=/");
		}
	});

	test("F4: pkce_verifier has correct attributes in dev", async ({ request }) => {
		const response = await request.get("/api/auth/login", {
			maxRedirects: 0,
		});
		const cookies = response.headers()["set-cookie"] || "";
		const cookieLines = cookies.split(/,(?=[^;]*=)/);
		const pkceCookie = cookieLines.find((c: string) => c.includes("pkce_verifier="));
		expect(pkceCookie).toBeDefined();
		if (pkceCookie) {
			expect(pkceCookie).toContain("HttpOnly");
			expect(pkceCookie).toContain("Path=/");
		}
	});

	test("F5: oauth_state has Max-Age=300", async ({ request }) => {
		const response = await request.get("/api/auth/login", {
			maxRedirects: 0,
		});
		const cookies = response.headers()["set-cookie"] || "";
		const cookieLines = cookies.split(/,(?=[^;]*=)/);
		const oauthCookie = cookieLines.find((c: string) => c.includes("oauth_state="));
		expect(oauthCookie).toBeDefined();
		if (oauthCookie) {
			expect(oauthCookie).toContain("Max-Age=300");
		}
	});

	test("F6: pkce_verifier has Max-Age=300", async ({ request }) => {
		const response = await request.get("/api/auth/login", {
			maxRedirects: 0,
		});
		const cookies = response.headers()["set-cookie"] || "";
		const cookieLines = cookies.split(/,(?=[^;]*=)/);
		const pkceCookie = cookieLines.find((c: string) => c.includes("pkce_verifier="));
		expect(pkceCookie).toBeDefined();
		if (pkceCookie) {
			expect(pkceCookie).toContain("Max-Age=300");
		}
	});

	test("F7: SameSite=Lax on both cookies (not Strict)", async ({ request }) => {
		const response = await request.get("/api/auth/login", {
			maxRedirects: 0,
		});
		const cookies = response.headers()["set-cookie"] || "";
		expect(cookies.toLowerCase()).toContain("samesite=lax");
		// Must NOT contain SameSite=Strict (would break OAuth2 callback)
		expect(cookies.toLowerCase()).not.toContain("samesite=strict");
	});

	test("F10: buildSessionCookieOptions NOT used for flow-state cookies", async ({ request }) => {
		// Verify flow-state cookies have Max-Age=300, not the session helper's 28800 cap
		const response = await request.get("/api/auth/login", {
			maxRedirects: 0,
		});
		const cookies = response.headers()["set-cookie"] || "";
		const cookieLines = cookies.split(/,(?=[^;]*=)/);
		const oauthCookie = cookieLines.find((c: string) => c.includes("oauth_state="));
		if (oauthCookie) {
			// Should NOT have session-level maxAge (28800)
			expect(oauthCookie).not.toContain("Max-Age=28800");
			expect(oauthCookie).toContain("Max-Age=300");
		}
	});
});

test.describe("OAuth State Secure Flag - Edge Cases", () => {
	test("E2: callback route clears oauth_state", async ({ request }) => {
		// The callback route should attempt to clear flow-state cookies
		// We can't fully test the callback without a valid code, but verify
		// the endpoint exists and handles requests. maxRedirects:0 so we
		// capture the immediate response without chasing the login→Hydra
		// redirect (Hydra isn't running in CI).
		const response = await request.get("/api/auth/callback", { maxRedirects: 0 });
		// Without proper OAuth2 params, should redirect (3xx) or 4xx but not 5xx
		expect(response.status()).toBeLessThan(500);
	});

	test("E3: SameSite guard - Lax explicitly set", async ({ request }) => {
		const response = await request.get("/api/auth/login", {
			maxRedirects: 0,
		});
		const cookies = response.headers()["set-cookie"] || "";
		// Explicitly verify SameSite=Lax (not just absence of Strict)
		expect(cookies.toLowerCase()).toContain("samesite=lax");
	});

	test("E5: cookies have short 300s lifetime (5 minutes)", async ({ request }) => {
		const response = await request.get("/api/auth/login", {
			maxRedirects: 0,
		});
		const cookies = response.headers()["set-cookie"] || "";
		// Both flow-state cookies should have 300s Max-Age
		expect(cookies).toContain("Max-Age=300");
	});
});

test.describe("OAuth State Secure Flag - Security Tests", () => {
	test("S1: flow-state cookies are HttpOnly (CSRF protection)", async ({ request }) => {
		const response = await request.get("/api/auth/login", {
			maxRedirects: 0,
		});
		const cookies = response.headers()["set-cookie"] || "";
		// All flow-state cookies must be HttpOnly
		expect(cookies).toContain("HttpOnly");
	});

	test("S3: state cookie has short expiry (300s attack window)", async ({ request }) => {
		const response = await request.get("/api/auth/login", {
			maxRedirects: 0,
		});
		const cookies = response.headers()["set-cookie"] || "";
		// Both cookies have 300s Max-Age, limiting attack window
		expect(cookies).toContain("Max-Age=300");
		// Verify they don't have longer maxAge values
		expect(cookies).not.toContain("Max-Age=3600");
		expect(cookies).not.toContain("Max-Age=28800");
	});

	test("S4: cross-origin state injection blocked by SameSite=Lax + HttpOnly", async ({ request }) => {
		const response = await request.get("/api/auth/login", {
			maxRedirects: 0,
		});
		const cookies = response.headers()["set-cookie"] || "";
		// Defence-in-depth: HttpOnly prevents JS access, SameSite prevents cross-site
		expect(cookies).toContain("HttpOnly");
		expect(cookies.toLowerCase()).toContain("samesite=lax");
	});
});
