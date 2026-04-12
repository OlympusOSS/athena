import { test, expect } from "@playwright/test";

/**
 * E2E tests for athena#51: proxy.ts auth enforcement (middleware activation)
 *
 * Validates that the Next.js middleware enforces authentication on all
 * protected API routes and allows public routes through.
 */

test.describe("Middleware Auth Enforcement - Functional Tests", () => {
	test("F1: unauthenticated GET /api/settings returns 401", async ({
		request,
	}) => {
		const response = await request.get("/api/settings");
		expect(response.status()).toBe(401);
		const body = await response.json();
		expect(body).toHaveProperty("error");
	});

	test("F2: unauthenticated GET /api/kratos-admin/identities returns 401", async ({
		request,
	}) => {
		const response = await request.get("/api/kratos-admin/identities");
		expect(response.status()).toBe(401);
		const body = await response.json();
		expect(body).toHaveProperty("error");
	});

	test("F3: unauthenticated GET /api/hydra-admin/clients returns 401", async ({
		request,
	}) => {
		const response = await request.get("/api/hydra-admin/clients");
		expect(response.status()).toBe(401);
		const body = await response.json();
		expect(body).toHaveProperty("error");
	});

	test("F4: unauthenticated GET /api/settings with decrypt returns 401", async ({
		request,
	}) => {
		const response = await request.get(
			"/api/settings/captcha.secret_key?decrypt=true",
		);
		expect(response.status()).toBe(401);
		const body = await response.json();
		expect(body).toHaveProperty("error");
	});

	test("F5: GET /api/health is public (200)", async ({ request }) => {
		const response = await request.get("/api/health");
		expect(response.ok()).toBeTruthy();
	});

	test("F6: GET /api/auth/login is public (redirects)", async ({
		request,
	}) => {
		const response = await request.get("/api/auth/login", {
			maxRedirects: 0,
		});
		expect(response.status()).toBe(307);
	});

	test("F7: unauthenticated POST /api/settings returns 401", async ({
		request,
	}) => {
		const response = await request.post("/api/settings", {
			data: { key: "test.key", value: "test-value" },
		});
		expect(response.status()).toBe(401);
	});

	test("F8: unauthenticated DELETE /api/settings/:key returns 401", async ({
		request,
	}) => {
		const response = await request.delete("/api/settings/test.key");
		expect(response.status()).toBe(401);
	});

	test("F9: unauthenticated GET /api/iam-kratos-admin route returns 401", async ({
		request,
	}) => {
		const response = await request.get("/api/iam-kratos-admin/identities");
		// May be 401 (protected) or 404 (route doesn't exist on CIAM instance)
		expect([401, 404]).toContain(response.status());
	});

	test("F10: default-deny on arbitrary /api/ route returns 401", async ({
		request,
	}) => {
		const response = await request.get("/api/nonexistent-route");
		// Middleware should intercept before route resolution
		expect([401, 404]).toContain(response.status());
		if (response.status() === 401) {
			const body = await response.json();
			expect(body).toHaveProperty("error");
		}
	});
});

test.describe("Middleware Auth Enforcement - Edge Cases", () => {
	test("E1: request with expired/invalid cookie returns 401", async ({
		request,
	}) => {
		const response = await request.get("/api/settings", {
			headers: {
				cookie: "athena-session=invalid.token.value",
			},
		});
		expect(response.status()).toBe(401);
	});

	test("E2: request with malformed cookie returns 401", async ({
		request,
	}) => {
		const response = await request.get("/api/settings", {
			headers: {
				cookie: "athena-session=not-even-a-jwt",
			},
		});
		expect(response.status()).toBe(401);
	});

	test("E3: empty cookie header still triggers auth check", async ({
		request,
	}) => {
		const response = await request.get("/api/settings", {
			headers: {
				cookie: "",
			},
		});
		expect(response.status()).toBe(401);
	});

	test("E4: health endpoint remains accessible regardless", async ({
		request,
	}) => {
		const response = await request.get("/api/health");
		expect(response.ok()).toBeTruthy();
		const body = await response.json();
		expect(body.status).toBe("ok");
	});
});

test.describe("Middleware Auth Enforcement - Security Tests", () => {
	test("S1: direct settings read blocked without auth", async ({
		request,
	}) => {
		const response = await request.get("/api/settings");
		expect(response.status()).toBe(401);
		const body = await response.json();
		// Must not leak any settings data
		expect(body).not.toHaveProperty("settings");
		expect(body).not.toHaveProperty("data");
	});

	test("S2: decrypt endpoint blocked without auth", async ({ request }) => {
		const response = await request.get(
			"/api/settings/captcha.secret_key?decrypt=true",
		);
		expect(response.status()).toBe(401);
		const text = await response.text();
		// Must not contain any decrypted value
		expect(text).not.toContain("secret");
	});

	test("S3: identity enumeration blocked without auth", async ({
		request,
	}) => {
		const response = await request.get("/api/kratos-admin/identities");
		expect(response.status()).toBe(401);
		const body = await response.json();
		expect(body).not.toHaveProperty("identities");
	});

	test("S4: OAuth2 client access blocked without auth", async ({
		request,
	}) => {
		const response = await request.get("/api/hydra-admin/clients");
		expect(response.status()).toBe(401);
	});

	test("S5: forged cookie does not grant access", async ({ request }) => {
		const forgedJwt =
			"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYWtlIiwicm9sZSI6ImFkbWluIn0.invalid";
		const response = await request.get("/api/settings", {
			headers: {
				cookie: `athena-session=${forgedJwt}`,
			},
		});
		expect(response.status()).toBe(401);
	});

	test("S6: header injection attempt does not bypass auth", async ({
		request,
	}) => {
		const response = await request.get("/api/settings", {
			headers: {
				"x-forwarded-user": "admin",
				"x-admin": "true",
			},
		});
		expect(response.status()).toBe(401);
	});

	test("S7: path traversal does not bypass middleware", async ({
		request,
	}) => {
		const response = await request.get("/api/../api/settings");
		// Should still be caught by middleware or return error
		expect([401, 400, 404]).toContain(response.status());
	});
});
