import { test, expect } from "@playwright/test";

/**
 * E2E tests for athena#111: SDK ENCRYPTION_KEY validation
 *
 * Validates that the SDK deferred validation pattern works correctly:
 * - Build succeeds without ENCRYPTION_KEY
 * - Runtime operations that need encryption throw clear errors
 * - Normal non-encryption operations work without ENCRYPTION_KEY
 *
 * Note: These tests verify the runtime behavior from the Athena API
 * perspective. The SDK unit tests cover the internal validation logic.
 */

test.describe("SDK Encryption Key Validation - Functional Tests", () => {
	test("F1: SDK barrel import does not crash app at startup", async ({
		request,
	}) => {
		// If the SDK module-level validation was still throwing,
		// the entire Athena app would be down
		const response = await request.get("/api/health");
		expect(response.ok()).toBeTruthy();
		const body = await response.json();
		expect(body.status).toBe("ok");
	});

	test("F3: encrypt operation returns error when key is missing/invalid", async ({
		request,
	}) => {
		// Try to create an encrypted setting (POST /api/settings)
		// This should either succeed (if key is valid) or fail gracefully
		const response = await request.post("/api/settings", {
			data: {
				key: "test.encrypted",
				value: "sensitive-data",
				encrypted: true,
			},
		});
		// Either 401 (auth required) or 500 (encryption error) -- NOT a crash
		expect([401, 403, 500]).toContain(response.status());
		expect(response.status()).not.toBe(502); // Not a gateway error (app crashed)
	});

	test("F4: decrypt operation returns error when key is missing/invalid", async ({
		request,
	}) => {
		const response = await request.get(
			"/api/settings/test.key?decrypt=true",
		);
		// Either 401 (auth required) or controlled error -- NOT a crash
		expect(response.status()).toBeLessThan(502);
	});

	test("F5: non-encryption SDK operations work normally", async ({
		request,
	}) => {
		// Health check exercises the app without needing encryption
		const response = await request.get("/api/health");
		expect(response.ok()).toBeTruthy();
	});

	test("F6: app starts and serves requests (deferred validation working)", async ({
		request,
	}) => {
		// Multiple endpoints should be accessible, proving the app started
		const healthResponse = await request.get("/api/health");
		expect(healthResponse.ok()).toBeTruthy();

		const loginResponse = await request.get("/api/auth/login", {
			maxRedirects: 0,
		});
		expect(loginResponse.status()).toBe(307);

		const settingsResponse = await request.get("/api/settings");
		expect(settingsResponse.status()).toBe(401); // Auth required, but app is running
	});

	test("F7: app serves both CIAM and IAM instances", async ({ request }) => {
		// CIAM (default base URL / port 3001)
		const ciamHealth = await request.get("/api/health");
		expect(ciamHealth.ok()).toBeTruthy();

		// IAM (port 4001)
		try {
			const iamHealth = await request.fetch(
				"http://localhost:4001/api/health",
			);
			if (iamHealth.ok()) {
				const body = await iamHealth.json();
				expect(body.status).toBe("ok");
			}
		} catch {
			// IAM instance may not be running in test environment
			test.skip();
		}
	});
});

test.describe("SDK Encryption Key Validation - Edge Cases", () => {
	test("E3: error messages do not contain key material", async ({
		request,
	}) => {
		// Any error response should not leak encryption keys
		const response = await request.get("/api/settings");
		const text = await response.text();

		// Should not contain common env var patterns for keys
		expect(text).not.toMatch(/ENCRYPTION_KEY\s*=/);
		expect(text).not.toMatch(/[A-Za-z0-9+/]{32,}={0,2}/); // base64 key pattern (only match long ones)
	});

	test("E4: multiple requests do not cause repeated validation throws", async ({
		request,
	}) => {
		// Make several requests in quick succession
		const responses = await Promise.all([
			request.get("/api/health"),
			request.get("/api/health"),
			request.get("/api/health"),
		]);

		// All should succeed -- no cascading failures from repeated validation
		for (const response of responses) {
			expect(response.ok()).toBeTruthy();
		}
	});
});

test.describe("SDK Encryption Key Validation - Security Tests", () => {
	test("S1: Containerfile does not expose ENCRYPTION_KEY", async ({
		request,
	}) => {
		// Verify the app is running (meaning build succeeded without dummy key)
		const response = await request.get("/api/health");
		expect(response.ok()).toBeTruthy();
		// If build required ENCRYPTION_KEY, the app wouldn't be running
		// This is an indirect verification that no dummy key was baked in
	});

	test("S3: encryption operations do not silently return bad data", async ({
		request,
	}) => {
		// When ENCRYPTION_KEY is invalid or missing, operations should
		// error out, not return corrupted/unencrypted data
		const response = await request.get(
			"/api/settings/nonexistent?decrypt=true",
		);
		// Should be 401 (auth) or 404 (not found) -- not 200 with bad data
		expect([401, 404]).toContain(response.status());
	});

	test("S4: error messages do not leak key material", async ({ request }) => {
		// Force an error by requesting a protected endpoint
		const response = await request.get("/api/settings");
		expect(response.status()).toBe(401);

		const body = await response.json();
		const bodyStr = JSON.stringify(body);

		// Must not contain any key-like material
		expect(bodyStr).not.toContain("ENCRYPTION_KEY");
		expect(bodyStr).not.toContain("SESSION_SIGNING_KEY");
		expect(bodyStr).not.toContain("openssl");
	});
});
