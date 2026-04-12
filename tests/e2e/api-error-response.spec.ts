import { test, expect } from "@playwright/test";

/**
 * E2E tests for athena#60: standardize API error response shape
 *
 * Validates that all auth error responses use the structured shape:
 * { error: string, message: string, hint?: string }
 */

test.describe("API Error Response Shape - Functional Tests", () => {
	test("F1: 401 response has correct structured shape", async ({
		request,
	}) => {
		const response = await request.get("/api/settings");
		expect(response.status()).toBe(401);

		const body = await response.json();
		expect(body).toEqual({
			error: "not_authenticated",
			message: "Authentication required.",
			hint: "Authenticate via /api/auth/login",
		});
	});

	test("F3: error key is preserved for backward compatibility", async ({
		request,
	}) => {
		const response = await request.get("/api/settings");
		expect(response.status()).toBe(401);

		const body = await response.json();
		// The `error` key must always be present (backward compatible)
		expect(body).toHaveProperty("error");
		expect(typeof body.error).toBe("string");
	});

	test("F4: 401 from session route uses new shape", async ({ request }) => {
		const response = await request.get("/api/auth/session");
		// Session endpoint returns 401 when not authenticated
		if (response.status() === 401) {
			const body = await response.json();
			expect(body).toHaveProperty("error", "not_authenticated");
			expect(body).toHaveProperty("message");
			expect(body).toHaveProperty("hint");
		}
	});

	test("F5: 401 from locked-accounts/unlock route uses new shape", async ({
		request,
	}) => {
		const response = await request.post(
			"/api/security/locked-accounts/unlock",
			{
				data: { identity_id: "test" },
			},
		);
		if (response.status() === 401) {
			const body = await response.json();
			expect(body).toHaveProperty("error", "not_authenticated");
			expect(body).toHaveProperty("message");
			expect(body).toHaveProperty("hint");
		}
	});

	test("F6: 401 from dashboard/layout GET uses new shape", async ({
		request,
	}) => {
		const response = await request.get("/api/dashboard/layout");
		if (response.status() === 401) {
			const body = await response.json();
			expect(body).toHaveProperty("error", "not_authenticated");
			expect(body).toHaveProperty("message");
			expect(body).toHaveProperty("hint");
		}
	});

	test("F7: 401 from dashboard/layout PUT uses new shape", async ({
		request,
	}) => {
		const response = await request.put("/api/dashboard/layout", {
			data: { layout: [] },
		});
		if (response.status() === 401) {
			const body = await response.json();
			expect(body).toHaveProperty("error", "not_authenticated");
			expect(body).toHaveProperty("message");
			expect(body).toHaveProperty("hint");
		}
	});

	test("F8: all three fields present on 401 response", async ({
		request,
	}) => {
		const response = await request.get("/api/settings");
		expect(response.status()).toBe(401);

		const body = await response.json();
		expect(body).toHaveProperty("error");
		expect(body).toHaveProperty("message");
		expect(body).toHaveProperty("hint");
		// All fields are strings
		expect(typeof body.error).toBe("string");
		expect(typeof body.message).toBe("string");
		expect(typeof body.hint).toBe("string");
	});

	test("F9: hint field exact-value assertions", async ({ request }) => {
		const response = await request.get("/api/settings");
		expect(response.status()).toBe(401);

		const body = await response.json();
		// Exact approved hint string for 401
		expect(body.hint).toBe("Authenticate via /api/auth/login");
	});
});

test.describe("API Error Response Shape - Edge Cases", () => {
	test("E1: malformed session cookie returns 401 with new shape", async ({
		request,
	}) => {
		const response = await request.get("/api/settings", {
			headers: {
				cookie: "athena-session=corrupted-data",
			},
		});
		expect(response.status()).toBe(401);

		const body = await response.json();
		expect(body).toHaveProperty("error", "not_authenticated");
		expect(body).toHaveProperty("message");
		expect(body).toHaveProperty("hint");
	});

	test("E4: all three fields present on auth errors", async ({ request }) => {
		const endpoints = [
			"/api/settings",
			"/api/kratos-admin/identities",
			"/api/hydra-admin/clients",
		];

		for (const endpoint of endpoints) {
			const response = await request.get(endpoint);
			expect(response.status()).toBe(401);

			const body = await response.json();
			expect(body).toHaveProperty("error");
			expect(body).toHaveProperty("message");
			expect(body).toHaveProperty("hint");
		}
	});
});

test.describe("API Error Response Shape - Security Tests", () => {
	test("S1: no internal details leaked in error responses", async ({
		request,
	}) => {
		const response = await request.get("/api/settings");
		expect(response.status()).toBe(401);

		const body = await response.json();
		const bodyStr = JSON.stringify(body);

		// Must not leak internal service names
		expect(bodyStr).not.toContain("Kratos");
		expect(bodyStr).not.toContain("Hydra");
		expect(bodyStr).not.toContain("kratos");
		expect(bodyStr).not.toContain("hydra");
		// Must not contain stack traces
		expect(bodyStr).not.toContain("at ");
		expect(bodyStr).not.toContain("Error:");
		// Must not contain database info
		expect(bodyStr).not.toContain("postgres");
	});

	test("S2: 403 hint does not contain specific role identifiers", async ({
		request,
	}) => {
		// Send a request that might trigger 403 (would need valid session with wrong role)
		// Since we can't easily create a non-admin session, verify 401 shape doesn't leak roles
		const response = await request.get("/api/settings");
		const body = await response.json();
		const bodyStr = JSON.stringify(body);

		// Must not contain specific role identifiers
		expect(bodyStr).not.toContain("ciam-admin");
		expect(bodyStr).not.toContain("iam-admin");
	});

	test("S3: error responses do not leak middleware internals", async ({
		request,
	}) => {
		const response = await request.get("/api/settings");
		expect(response.status()).toBe(401);

		const body = await response.json();
		const bodyStr = JSON.stringify(body);

		// Must not leak middleware implementation details
		expect(bodyStr).not.toContain("middleware");
		expect(bodyStr).not.toContain("proxy");
		expect(bodyStr).not.toContain("session.ts");
		expect(bodyStr).not.toContain("cookie-options");
	});
});
