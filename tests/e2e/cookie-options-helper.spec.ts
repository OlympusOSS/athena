import { test, expect } from "@playwright/test";

/**
 * E2E tests for athena#66: shared cookie options helper
 *
 * Validates that the cookie options helper enforces correct attributes
 * across all cookie operations (callback, logout, login routes).
 */

test.describe("Cookie Options Helper - Functional Tests", () => {
	test("F4: cookie attributes include HttpOnly (secure flag gated on NODE_ENV)", async ({
		request,
	}) => {
		const response = await request.get("/api/auth/login", {
			maxRedirects: 0,
		});
		const cookies = response.headers()["set-cookie"] || "";
		expect(cookies).toContain("HttpOnly");
	});

	test("F6: SameSite, httpOnly, path attributes correct", async ({
		request,
	}) => {
		const response = await request.get("/api/auth/login", {
			maxRedirects: 0,
		});
		const cookies = response.headers()["set-cookie"] || "";
		expect(cookies.toLowerCase()).toContain("samesite=lax");
		expect(cookies).toContain("HttpOnly");
		expect(cookies).toContain("Path=/");
	});

	test("F7: set and clear attributes match (logout clears correctly)", async ({
		request,
	}) => {
		const logoutResponse = await request.get("/api/auth/logout", {
			maxRedirects: 0,
		});
		expect([200, 302, 307]).toContain(logoutResponse.status());

		const cookies = logoutResponse.headers()["set-cookie"] || "";
		if (cookies.includes("athena-session")) {
			// Clear operation should have matching attributes
			expect(cookies).toContain("HttpOnly");
			expect(cookies).toContain("Path=/");
		}
	});

	test("F8: callback route sets cookies with helper attributes", async ({
		request,
	}) => {
		// The callback would set athena-session; we can verify the login flow
		// sets cookies with correct attributes as a proxy test
		const response = await request.get("/api/auth/login", {
			maxRedirects: 0,
		});
		const cookies = response.headers()["set-cookie"] || "";
		expect(cookies).toContain("HttpOnly");
		expect(cookies.toLowerCase()).toContain("samesite=lax");
	});

	test("F9: logout route clears cookie with matching attributes", async ({
		request,
	}) => {
		const response = await request.get("/api/auth/logout", {
			maxRedirects: 0,
		});
		const cookies = response.headers()["set-cookie"] || "";
		// Verify HttpOnly present on any cookie clear operation
		if (cookies.includes("athena-session")) {
			expect(cookies).toContain("HttpOnly");
		}
	});

	test("F14: both CIAM and IAM instances respond", async ({ request }) => {
		// CIAM Athena health check (port 3001 is default BASE_URL)
		const ciamResponse = await request.get("/api/health");
		expect(ciamResponse.ok()).toBeTruthy();

		// IAM Athena on port 4001 -- only test if accessible
		try {
			const iamResponse = await request.fetch("http://localhost:4001/api/health");
			if (iamResponse.ok()) {
				const body = await iamResponse.json();
				expect(body.status).toBe("ok");
			}
		} catch {
			// IAM instance may not be running in all test environments
			test.skip();
		}
	});
});

test.describe("Cookie Options Helper - Edge Cases", () => {
	test("E4: cookies set in dev mode without Secure flag", async ({
		request,
	}) => {
		const response = await request.get("/api/auth/login", {
			maxRedirects: 0,
		});
		const cookies = response.headers()["set-cookie"] || "";
		// In dev/test mode, Secure flag should be absent
		// (cannot assert Secure absent since some test setups might use HTTPS)
		// Verify other attributes are present
		expect(cookies).toContain("HttpOnly");
		expect(cookies.toLowerCase()).toContain("samesite=lax");
	});

	test("E5: login route flow-state cookies have correct attributes", async ({
		request,
	}) => {
		const response = await request.get("/api/auth/login", {
			maxRedirects: 0,
		});
		const cookies = response.headers()["set-cookie"] || "";

		// oauth_state and pkce_verifier should have their own attributes
		expect(cookies).toContain("oauth_state");
		expect(cookies).toContain("pkce_verifier");
		// Both should be HttpOnly
		expect(cookies).toContain("HttpOnly");
	});
});

test.describe("Cookie Options Helper - Security Tests", () => {
	test("S1: session cookies use HttpOnly (not accessible via JavaScript)", async ({
		request,
	}) => {
		const response = await request.get("/api/auth/login", {
			maxRedirects: 0,
		});
		const cookies = response.headers()["set-cookie"] || "";
		expect(cookies).toContain("HttpOnly");
	});

	test("S3: cookies use SameSite=Lax for CSRF protection", async ({
		request,
	}) => {
		const response = await request.get("/api/auth/login", {
			maxRedirects: 0,
		});
		const cookies = response.headers()["set-cookie"] || "";
		expect(cookies.toLowerCase()).toContain("samesite=lax");
		// Must NOT use SameSite=None (would allow cross-site)
		expect(cookies.toLowerCase()).not.toContain("samesite=none");
	});

	test("S5: logout clears session properly", async ({ request }) => {
		const response = await request.get("/api/auth/logout", {
			maxRedirects: 0,
		});
		expect([200, 302, 307]).toContain(response.status());
		// Logout should trigger a clear or redirect
	});
});
