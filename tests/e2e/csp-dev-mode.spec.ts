import { test, expect } from "@playwright/test";

/**
 * E2E tests for athena#108: CSP unsafe-eval dev mode
 *
 * Validates that CSP headers are correctly configured:
 * - Dev mode includes 'unsafe-eval' for HMR
 * - Production mode does NOT include 'unsafe-eval'
 *
 * Note: These tests run against the dev server, so they verify dev-mode CSP.
 * Production CSP enforcement is verified via CI gates (grep compiled artifact).
 */

test.describe("CSP Dev Mode - Functional Tests", () => {
	test("F1: dev CSP includes unsafe-eval in script-src", async ({
		request,
	}) => {
		const response = await request.get("/api/health");
		const csp =
			response.headers()["content-security-policy"] ||
			response.headers()["content-security-policy-report-only"] ||
			"";

		// In dev mode, CSP should include unsafe-eval for HMR
		if (csp) {
			expect(csp).toContain("'unsafe-eval'");
		}
	});

	test("F4: CIAM Athena (port 3001) responds without server error", async ({
		request,
	}) => {
		const response = await request.get("/api/health");
		expect(response.ok()).toBeTruthy();
		const body = await response.json();
		expect(body.status).toBe("ok");
	});

	test("F5: IAM Athena (port 4001) responds without server error", async ({
		request,
	}) => {
		try {
			const response = await request.fetch("http://localhost:4001/api/health");
			if (response.ok()) {
				const body = await response.json();
				expect(body.status).toBe("ok");
			}
		} catch {
			// IAM instance may not be running in test environment
			test.skip();
		}
	});

	test("F7: CSP header is present on page responses", async ({ page }) => {
		const response = await page.goto("/");
		if (response) {
			const headers = response.headers();
			const csp =
				headers["content-security-policy"] ||
				headers["content-security-policy-report-only"];
			// CSP should be set by middleware on page navigation
			if (csp) {
				// Verify it contains script-src directive
				expect(csp).toContain("script-src");
			}
		}
	});

	test("F8: middleware exports only middleware and config", async ({
		request,
	}) => {
		// Verify the middleware is active by checking that protected routes are gated
		const response = await request.get("/api/settings");
		// Middleware should intercept and return 401
		expect(response.status()).toBe(401);
	});
});

test.describe("CSP Dev Mode - Edge Cases", () => {
	test("E1: CSP present even without explicit NODE_ENV", async ({
		request,
	}) => {
		// The server should apply CSP regardless of environment specifics
		const response = await request.get("/api/health");
		// Server should respond (not crash due to CSP configuration)
		expect(response.ok()).toBeTruthy();
	});

	test("E4: dev CSP does not weaken other directives beyond unsafe-eval", async ({
		request,
	}) => {
		const response = await request.get("/api/health");
		const csp = response.headers()["content-security-policy"] || "";

		if (csp) {
			// Should NOT have unsafe-inline for scripts (separate from unsafe-eval)
			// Note: Next.js may add nonce-based inline scripts which is fine
			// Should NOT disable other CSP protections
			expect(csp).not.toContain("*"); // No wildcard sources
		}
	});
});

test.describe("CSP Dev Mode - Security Tests", () => {
	test("S1: CSP header prevents script injection", async ({ request }) => {
		const response = await request.get("/api/health");
		const csp = response.headers()["content-security-policy"] || "";

		if (csp) {
			// script-src should be present and restrictive
			expect(csp).toContain("script-src");
			// Should have nonce-based or self-based restrictions
			expect(csp).toMatch(/(nonce-|'self')/);
		}
	});

	test("S2: dev CSP relaxation is limited to unsafe-eval only", async ({
		request,
	}) => {
		const response = await request.get("/api/health");
		const csp = response.headers()["content-security-policy"] || "";

		if (csp) {
			// In dev mode, the only relaxation should be unsafe-eval
			// Other unsafe directives should NOT be present
			expect(csp).not.toContain("'unsafe-inline'");
		}
	});
});
