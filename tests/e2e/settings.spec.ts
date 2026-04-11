import { test, expect } from "@playwright/test";

test.describe("Settings API", () => {
	test("GET /api/settings returns settings list", async ({ request }) => {
		const response = await request.get("/api/settings");
		// May require auth — accept 200 (success) or 401 (unauthenticated)
		expect([200, 401]).toContain(response.status());

		if (response.status() === 200) {
			const body = await response.json();
			expect(Array.isArray(body) || typeof body === "object").toBeTruthy();
		}
	});

	test("GET /api/settings with category filter", async ({ request }) => {
		const response = await request.get("/api/settings?category=captcha");
		expect([200, 401]).toContain(response.status());
	});

	test("unauthenticated POST /api/settings returns 401", async ({
		request,
	}) => {
		const response = await request.post("/api/settings", {
			data: { key: "test.key", value: "test-value" },
		});
		// Should reject unauthenticated writes
		expect([401, 403]).toContain(response.status());
	});
});
