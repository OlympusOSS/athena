# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Authentication Flow >> unauthenticated request to root redirects to login
- Location: tests/e2e/auth.spec.ts:4:6

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
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test.describe("Authentication Flow", () => {
  4  | 	test("unauthenticated request to root redirects to login", async ({
  5  | 		page,
  6  | 	}) => {
> 7  | 		const response = await page.goto("/");
     |                               ^ Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
  8  | 		// Should redirect to login or show auth-required state
  9  | 		expect(response?.status()).toBeLessThan(500);
  10 | 	});
  11 | 
  12 | 	test("GET /api/auth/login redirects to Hydra authorize endpoint", async ({
  13 | 		request,
  14 | 	}) => {
  15 | 		const response = await request.get("/api/auth/login", {
  16 | 			maxRedirects: 0,
  17 | 		});
  18 | 		// Login should redirect (302) to Hydra's /oauth2/auth
  19 | 		expect(response.status()).toBe(307);
  20 | 		const location = response.headers().location || "";
  21 | 		expect(location).toContain("/oauth2/auth");
  22 | 		expect(location).toContain("response_type=code");
  23 | 		expect(location).toContain("code_challenge_method=S256");
  24 | 	});
  25 | 
  26 | 	test("login sets oauth_state and pkce_verifier cookies", async ({
  27 | 		request,
  28 | 	}) => {
  29 | 		const response = await request.get("/api/auth/login", {
  30 | 			maxRedirects: 0,
  31 | 		});
  32 | 		const cookies = response.headers()["set-cookie"] || "";
  33 | 		expect(cookies).toContain("oauth_state");
  34 | 		expect(cookies).toContain("pkce_verifier");
  35 | 		expect(cookies).toContain("HttpOnly");
  36 | 		expect(cookies.toLowerCase()).toContain("samesite=lax");
  37 | 	});
  38 | 
  39 | 	test("GET /api/auth/logout clears session", async ({ request }) => {
  40 | 		const response = await request.get("/api/auth/logout", {
  41 | 			maxRedirects: 0,
  42 | 		});
  43 | 		// Logout should redirect (clear session + redirect to Hydra logout or home)
  44 | 		expect([200, 302, 307]).toContain(response.status());
  45 | 	});
  46 | });
  47 | 
```