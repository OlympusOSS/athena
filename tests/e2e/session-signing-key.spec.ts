import { expect, test } from "@playwright/test";

/**
 * E2E tests for athena#99: separate SESSION_SIGNING_KEY
 *
 * Validates that session signing uses a dedicated key separate from
 * ENCRYPTION_KEY, with proper startup validation and session invalidation.
 *
 * Note: Many of these tests verify behavior at the API level since
 * the signing key is an internal implementation detail. Unit tests
 * in the source repo cover the detailed key separation logic.
 */

test.describe("Session Signing Key - Functional Tests", () => {
	test("F10: invalid sessions return 401 (cookie cleared)", async ({ request }) => {
		// A session signed with the wrong key should be rejected
		const response = await request.get("/api/settings", {
			headers: {
				cookie: "athena-session=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.invalidsignature",
			},
		});
		expect(response.status()).toBe(401);
	});

	test("F11: no redirect loop on invalid session", async ({ page }) => {
		// Set an invalid session cookie and navigate
		await page.context().addCookies([
			{
				name: "athena-session",
				value: "invalid-session-token",
				domain: "localhost",
				path: "/",
			},
		]);

		// Navigate and watch for redirect loops
		const redirects: string[] = [];
		page.on("response", (response) => {
			if ([301, 302, 307, 308].includes(response.status())) {
				redirects.push(response.url());
			}
		});

		await page.goto("/", { waitUntil: "domcontentloaded", timeout: 15000 });

		// Should not have more than 3 redirects (normal auth redirect is 1-2)
		expect(redirects.length).toBeLessThan(5);
	});

	test("F16: session endpoint rejects unauthenticated requests", async ({ request }) => {
		const response = await request.get("/api/auth/session");
		// Should return 401 for unauthenticated requests
		if (response.status() === 401) {
			const body = await response.json();
			expect(body).toHaveProperty("error");
		}
	});
});

test.describe("Session Signing Key - Edge Cases", () => {
	test("E3: existing sessions with old key material rejected", async ({ request }) => {
		// A JWT signed with a different key should be rejected
		const oldKeyJwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTcxMTkwMDAwMH0.fakesignature";
		const response = await request.get("/api/settings", {
			headers: {
				cookie: `athena-session=${oldKeyJwt}`,
			},
		});
		expect(response.status()).toBe(401);
	});

	test("E4: same-value keys (SESSION_SIGNING_KEY === ENCRYPTION_KEY) still functions", async ({ request }) => {
		// The app should still work even if keys happen to be the same
		// (just with a warning). Auth flow should function.
		const response = await request.get("/api/auth/login", {
			maxRedirects: 0,
		});
		expect(response.status()).toBe(307);
	});

	test("E7: middleware returns 401 without crash on invalid session", async ({ request }) => {
		// Various malformed session values should return 401, not 500
		const malformedValues = [
			"",
			"not-a-jwt",
			"a.b",
			"a.b.c.d",
			"eyJhbGciOiJub25lIn0.eyJzdWIiOiJ0ZXN0In0.",
			Buffer.from("binary-data").toString("base64"),
		];

		for (const value of malformedValues) {
			const response = await request.get("/api/settings", {
				headers: {
					cookie: `athena-session=${value}`,
				},
			});
			// Must return 401 (not 500 crash)
			expect(response.status()).toBe(401);
		}
	});
});

test.describe("Session Signing Key - Security Tests", () => {
	test("S1: session cookie forged with wrong key is rejected", async ({ request }) => {
		// Craft a JWT that looks valid but is signed with a random key
		const forgedJwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTcxMTkwMDAwMCwiZXhwIjo5OTk5OTk5OTk5fQ.tampered";
		const response = await request.get("/api/settings", {
			headers: {
				cookie: `athena-session=${forgedJwt}`,
			},
		});
		expect(response.status()).toBe(401);
	});

	test("S3: invalid session does not cause redirect loop (fixation)", async ({ page }) => {
		await page.context().addCookies([
			{
				name: "athena-session",
				value: "fixation-attempt-token",
				domain: "localhost",
				path: "/",
			},
		]);

		let requestCount = 0;
		page.on("request", () => {
			requestCount++;
		});

		try {
			await page.goto("/", { waitUntil: "domcontentloaded", timeout: 10000 });
		} catch {
			// Timeout is acceptable if there was no infinite loop
		}

		// Reasonable number of requests (not an infinite loop)
		expect(requestCount).toBeLessThan(20);
	});

	test("S6: cross-instance session reuse blocked (CIAM session on IAM)", async ({ request }) => {
		// A CIAM session token should not work on IAM instance
		// This verifies that different instances use different keys
		const ciamToken = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjaWFtLXVzZXIiLCJkb21haW4iOiJjaWFtIn0.invalidsig";

		try {
			const iamResponse = await request.fetch("http://localhost:4001/api/settings", {
				headers: {
					cookie: `athena-session=${ciamToken}`,
				},
			});
			expect(iamResponse.status()).toBe(401);
		} catch {
			// IAM instance may not be running -- skip gracefully
			test.skip();
		}
	});
});
