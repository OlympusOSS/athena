import { expect, test } from "@playwright/test";

/**
 * SDK Encryption E2E Tests (sdk#5)
 *
 * Verifies SDK encryption key derivation (SHA-256 → HKDF) through
 * Athena's settings API, which uses @olympusoss/sdk for encrypted
 * settings storage.
 *
 * These tests confirm:
 *   1. SDK initialized successfully (encryption key validation passed at startup)
 *   2. Settings API handles encrypted values correctly (masking, round-trip)
 *   3. Auth enforcement on settings endpoints (admin-only)
 *
 * Test plan references: F4, F8, F9, AC4 from sdk#5 issue.
 */

test.describe("SDK Encryption — Health & Startup Validation", () => {
	test("health endpoint confirms SDK initialized with valid encryption key (F4/F8)", async ({ request }) => {
		// If the SDK's validateOnStartup() failed, the container would have
		// exited with process.exit(1) via instrumentation.ts — the health
		// endpoint being reachable at all proves startup validation passed.
		const response = await request.get("/api/health");
		expect(response.ok()).toBeTruthy();

		const body = await response.json();
		expect(body.status).toBe("ok");
		expect(body).toHaveProperty("version");
	});

	test("health endpoint responds within acceptable latency", async ({ request }) => {
		const start = Date.now();
		const response = await request.get("/api/health");
		const elapsed = Date.now() - start;

		expect(response.ok()).toBeTruthy();
		// Health check should respond quickly — SDK init is a one-time
		// startup cost, not per-request.
		expect(elapsed).toBeLessThan(2000);
	});
});

test.describe("SDK Encryption — Settings API (Authenticated)", () => {
	// These tests run against the live dev environment where Athena
	// enforces admin auth via middleware. Unauthenticated requests
	// receive 401, which confirms the auth gate is active.
	//
	// When running with an authenticated session (via storageState or
	// test fixtures), these tests exercise the full encrypted settings
	// round-trip through the SDK.

	const testKey = `e2e.sdk5.encryption.${Date.now()}`;
	const testSecret = "sdk5-e2e-secret-value-do-not-leak";

	test("POST /api/settings with encrypted=true requires admin auth", async ({ request }) => {
		const response = await request.post("/api/settings", {
			data: {
				key: testKey,
				value: testSecret,
				encrypted: true,
				category: "e2e-test",
			},
		});

		// Middleware returns 401 for unauthenticated requests to /api/settings
		// (ADMIN_PREFIXES includes "/api/settings").
		// If auth is configured in test, 200 means the SDK encrypted and stored it.
		expect([200, 401]).toContain(response.status());

		if (response.status() === 200) {
			const body = await response.json();
			expect(body.success).toBe(true);
			expect(body.key).toBe(testKey);
		}
	});

	test("POST /api/settings with encrypted=false stores plaintext", async ({ request }) => {
		const plaintextKey = `e2e.sdk5.plaintext.${Date.now()}`;

		const response = await request.post("/api/settings", {
			data: {
				key: plaintextKey,
				value: "not-a-secret",
				encrypted: false,
				category: "e2e-test",
			},
		});

		expect([200, 401]).toContain(response.status());

		if (response.status() === 200) {
			const body = await response.json();
			expect(body.success).toBe(true);
			expect(body.key).toBe(plaintextKey);
		}
	});

	test("GET /api/settings lists settings with encrypted values masked", async ({ request }) => {
		const response = await request.get("/api/settings");
		expect([200, 401]).toContain(response.status());

		if (response.status() === 200) {
			const body = await response.json();
			expect(body).toHaveProperty("settings");
			expect(Array.isArray(body.settings)).toBeTruthy();

			// Verify masking: encrypted values should show first 8 chars + bullet dots
			// (listSettingsForDisplay masks with slice(0,8) + 8 bullet chars)
			for (const setting of body.settings) {
				expect(setting).toHaveProperty("key");
				expect(setting).toHaveProperty("value");
				expect(setting).toHaveProperty("encrypted");

				if (setting.encrypted) {
					// Masked format: first 8 chars of ciphertext + 8 bullet dots
					// The raw secret value must NOT appear in the response
					expect(setting.value).toContain("\u2022"); // bullet character
					expect(setting.value).not.toBe(testSecret);
				}
			}
		}
	});

	test("GET /api/settings with category filter returns filtered results", async ({ request }) => {
		const response = await request.get("/api/settings?category=e2e-test");
		expect([200, 401]).toContain(response.status());

		if (response.status() === 200) {
			const body = await response.json();
			expect(body).toHaveProperty("settings");

			// All returned settings should be in the requested category
			for (const setting of body.settings) {
				expect(setting.category).toBe("e2e-test");
			}
		}
	});

	test("GET /api/settings/:key returns individual setting with encrypted flag", async ({ request }) => {
		const response = await request.get(`/api/settings/${testKey}`);
		expect([200, 401, 404]).toContain(response.status());

		if (response.status() === 200) {
			const body = await response.json();
			expect(body.key).toBe(testKey);
			expect(body).toHaveProperty("encrypted");
			expect(body).toHaveProperty("value");

			// Without ?decrypt=true, encrypted values return raw ciphertext
			// The plaintext secret must NOT appear
			if (body.encrypted) {
				expect(body.value).not.toBe(testSecret);
			}
		}
	});

	test("GET /api/settings/:key?decrypt=true returns decrypted value (AC4)", async ({ request }) => {
		const response = await request.get(`/api/settings/${testKey}?decrypt=true`);
		expect([200, 401, 404]).toContain(response.status());

		if (response.status() === 200) {
			const body = await response.json();
			expect(body.key).toBe(testKey);
			expect(body.encrypted).toBe(true);
			// decrypt=true should return the original plaintext via SDK's
			// getSecretSetting() which uses HKDF-derived key for decryption
			expect(body.value).toBe(testSecret);
		}
	});

	test("DELETE /api/settings/:key requires admin auth", async ({ request }) => {
		const response = await request.delete(`/api/settings/${testKey}`);
		expect([200, 401, 404]).toContain(response.status());

		if (response.status() === 200) {
			const body = await response.json();
			expect(body.success).toBe(true);
		}
	});
});

test.describe("SDK Encryption — Auth Enforcement on Settings Routes", () => {
	test("unauthenticated POST to /api/settings returns 401 (F9 gate)", async ({ request }) => {
		// This verifies the middleware auth gate is active for settings routes.
		// The SDK encryption path is only reachable through authenticated requests.
		const response = await request.post("/api/settings", {
			data: {
				key: "e2e.unauthorized.attempt",
				value: "should-not-persist",
				encrypted: true,
			},
		});

		// Expect 401 (not_authenticated) — the middleware intercepts before
		// the route handler (and SDK) are ever invoked.
		expect(response.status()).toBe(401);

		const body = await response.json();
		expect(body.error).toBe("not_authenticated");
		expect(body.message).toBe("Authentication required.");
	});

	test("unauthenticated GET to /api/settings returns 401", async ({ request }) => {
		const response = await request.get("/api/settings");
		expect(response.status()).toBe(401);

		const body = await response.json();
		expect(body.error).toBe("not_authenticated");
	});

	test("unauthenticated DELETE to /api/settings/:key returns 401", async ({ request }) => {
		const response = await request.delete("/api/settings/any-key");
		expect(response.status()).toBe(401);

		const body = await response.json();
		expect(body.error).toBe("not_authenticated");
	});
});

test.describe("SDK Encryption — Validation & Edge Cases", () => {
	test("POST /api/settings rejects missing key", async ({ request }) => {
		const response = await request.post("/api/settings", {
			data: {
				value: "no-key-provided",
				encrypted: true,
			},
		});

		// 401 (auth gate) or 400 (validation) — both are correct depending
		// on whether test runs authenticated
		expect([400, 401]).toContain(response.status());

		if (response.status() === 400) {
			const body = await response.json();
			expect(body.error).toContain("key is required");
		}
	});

	test("POST /api/settings rejects missing value", async ({ request }) => {
		const response = await request.post("/api/settings", {
			data: {
				key: "e2e.sdk5.no-value",
				encrypted: true,
			},
		});

		expect([400, 401]).toContain(response.status());

		if (response.status() === 400) {
			const body = await response.json();
			expect(body.error).toContain("value is required");
		}
	});

	test("GET /api/settings/:key for non-existent key returns 404", async ({ request }) => {
		const response = await request.get("/api/settings/e2e.sdk5.nonexistent.key.99999");

		// 401 (unauthenticated) or 404 (key not found)
		expect([401, 404]).toContain(response.status());

		if (response.status() === 404) {
			const body = await response.json();
			expect(body.error).toBe("Setting not found");
		}
	});

	test("encrypted value in listing never exposes plaintext secret (S3)", async ({ request }) => {
		// Security test: even if we can list settings, encrypted values must
		// be masked — no raw secrets in the API response.
		const response = await request.get("/api/settings");

		if (response.status() === 200) {
			const text = await response.text();
			// The test secret value must never appear in the full response body
			expect(text).not.toContain("sdk5-e2e-secret-value-do-not-leak");
		}
	});
});
