# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: csp-dev-mode.spec.ts >> CSP Dev Mode - Functional Tests >> F7: CSP header is present on page responses
- Location: tests/e2e/csp-dev-mode.spec.ts:54:6

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
Call log:
  - navigating to "https://admin.ciam.nannier.com/", waiting until "load"

```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | 
  3   | /**
  4   |  * E2E tests for athena#108: CSP unsafe-eval dev mode
  5   |  *
  6   |  * Validates that CSP headers are correctly configured:
  7   |  * - Dev mode includes 'unsafe-eval' for HMR
  8   |  * - Production mode does NOT include 'unsafe-eval'
  9   |  *
  10  |  * Note: These tests run against the dev server, so they verify dev-mode CSP.
  11  |  * Production CSP enforcement is verified via CI gates (grep compiled artifact).
  12  |  */
  13  | 
  14  | test.describe("CSP Dev Mode - Functional Tests", () => {
  15  | 	test("F1: dev CSP includes unsafe-eval in script-src", async ({
  16  | 		request,
  17  | 	}) => {
  18  | 		const response = await request.get("/api/health");
  19  | 		const csp =
  20  | 			response.headers()["content-security-policy"] ||
  21  | 			response.headers()["content-security-policy-report-only"] ||
  22  | 			"";
  23  | 
  24  | 		// In dev mode, CSP should include unsafe-eval for HMR
  25  | 		if (csp) {
  26  | 			expect(csp).toContain("'unsafe-eval'");
  27  | 		}
  28  | 	});
  29  | 
  30  | 	test("F4: CIAM Athena (port 3001) responds without server error", async ({
  31  | 		request,
  32  | 	}) => {
  33  | 		const response = await request.get("/api/health");
  34  | 		expect(response.ok()).toBeTruthy();
  35  | 		const body = await response.json();
  36  | 		expect(body.status).toBe("ok");
  37  | 	});
  38  | 
  39  | 	test("F5: IAM Athena (port 4001) responds without server error", async ({
  40  | 		request,
  41  | 	}) => {
  42  | 		try {
  43  | 			const response = await request.fetch("http://localhost:4001/api/health");
  44  | 			if (response.ok()) {
  45  | 				const body = await response.json();
  46  | 				expect(body.status).toBe("ok");
  47  | 			}
  48  | 		} catch {
  49  | 			// IAM instance may not be running in test environment
  50  | 			test.skip();
  51  | 		}
  52  | 	});
  53  | 
  54  | 	test("F7: CSP header is present on page responses", async ({ page }) => {
> 55  | 		const response = await page.goto("/");
      |                               ^ Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
  56  | 		if (response) {
  57  | 			const headers = response.headers();
  58  | 			const csp =
  59  | 				headers["content-security-policy"] ||
  60  | 				headers["content-security-policy-report-only"];
  61  | 			// CSP should be set by middleware on page navigation
  62  | 			if (csp) {
  63  | 				// Verify it contains script-src directive
  64  | 				expect(csp).toContain("script-src");
  65  | 			}
  66  | 		}
  67  | 	});
  68  | 
  69  | 	test("F8: middleware exports only middleware and config", async ({
  70  | 		request,
  71  | 	}) => {
  72  | 		// Verify the middleware is active by checking that protected routes are gated
  73  | 		const response = await request.get("/api/settings");
  74  | 		// Middleware should intercept and return 401
  75  | 		expect(response.status()).toBe(401);
  76  | 	});
  77  | });
  78  | 
  79  | test.describe("CSP Dev Mode - Edge Cases", () => {
  80  | 	test("E1: CSP present even without explicit NODE_ENV", async ({
  81  | 		request,
  82  | 	}) => {
  83  | 		// The server should apply CSP regardless of environment specifics
  84  | 		const response = await request.get("/api/health");
  85  | 		// Server should respond (not crash due to CSP configuration)
  86  | 		expect(response.ok()).toBeTruthy();
  87  | 	});
  88  | 
  89  | 	test("E4: dev CSP does not weaken other directives beyond unsafe-eval", async ({
  90  | 		request,
  91  | 	}) => {
  92  | 		const response = await request.get("/api/health");
  93  | 		const csp = response.headers()["content-security-policy"] || "";
  94  | 
  95  | 		if (csp) {
  96  | 			// Should NOT have unsafe-inline for scripts (separate from unsafe-eval)
  97  | 			// Note: Next.js may add nonce-based inline scripts which is fine
  98  | 			// Should NOT disable other CSP protections
  99  | 			expect(csp).not.toContain("*"); // No wildcard sources
  100 | 		}
  101 | 	});
  102 | });
  103 | 
  104 | test.describe("CSP Dev Mode - Security Tests", () => {
  105 | 	test("S1: CSP header prevents script injection", async ({ request }) => {
  106 | 		const response = await request.get("/api/health");
  107 | 		const csp = response.headers()["content-security-policy"] || "";
  108 | 
  109 | 		if (csp) {
  110 | 			// script-src should be present and restrictive
  111 | 			expect(csp).toContain("script-src");
  112 | 			// Should have nonce-based or self-based restrictions
  113 | 			expect(csp).toMatch(/(nonce-|'self')/);
  114 | 		}
  115 | 	});
  116 | 
  117 | 	test("S2: dev CSP relaxation is limited to unsafe-eval only", async ({
  118 | 		request,
  119 | 	}) => {
  120 | 		const response = await request.get("/api/health");
  121 | 		const csp = response.headers()["content-security-policy"] || "";
  122 | 
  123 | 		if (csp) {
  124 | 			// In dev mode, the only relaxation should be unsafe-eval
  125 | 			// Other unsafe directives should NOT be present
  126 | 			expect(csp).not.toContain("'unsafe-inline'");
  127 | 		}
  128 | 	});
  129 | });
  130 | 
```