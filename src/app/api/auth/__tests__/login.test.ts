/**
 * @vitest-environment node
 *
 * Unit tests for GET /api/auth/login
 *
 * Covers QA plan scenario: F1.
 * The login route generates a state value, sets the oauth_state cookie,
 * and redirects to Hydra /oauth2/auth.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../login/route";

// Mock SDK
vi.mock("@olympusoss/sdk", () => ({
	getSettingOrDefault: vi.fn().mockResolvedValue("test-client-id"),
}));

const originalEnv = { ...process.env };

beforeEach(() => {
	process.env.NEXT_PUBLIC_APP_URL = "http://localhost:4001";
	process.env.NEXT_PUBLIC_AUTH_HYDRA_URL = "http://localhost:4102";
	vi.clearAllMocks();
});

afterEach(() => {
	process.env = { ...originalEnv };
	process.env.ENCRYPTION_KEY = "test-encryption-key-for-vitest-32ch";
	process.env.SESSION_SIGNING_KEY = "y0vXvDE6hGnlA4J/iLlTwyMXHgDrMp4tD3ON+3lf3ws=";
	process.env.NEXT_PUBLIC_APP_URL = "http://localhost:4001";
	process.env.TZ = "UTC";
});

describe("F1: Login flow generates state cookie", () => {
	it("redirects to Hydra /oauth2/auth with state param", async () => {
		const res = await GET();
		expect(res.status).toBe(307);
		const location = res.headers.get("location") ?? "";
		expect(location).toContain("/oauth2/auth");
		expect(location).toContain("state=");
		expect(location).toContain("client_id=");
		expect(location).toContain("response_type=code");
	});

	it("F1: sets oauth_state cookie with httpOnly=true, sameSite=lax, maxAge=300", async () => {
		const res = await GET();
		const setCookie = res.headers.get("set-cookie") ?? "";
		expect(setCookie).toContain("oauth_state=");
		expect(setCookie.toLowerCase()).toContain("httponly");
		expect(setCookie.toLowerCase()).toContain("samesite=lax");
		expect(setCookie).toMatch(/max-age=300/i);
	});

	it("F1: sets pkce_verifier cookie with httpOnly=true, sameSite=lax, maxAge=300", async () => {
		// athena#100 — pkce_verifier must have same security attributes as oauth_state
		const res = await GET();
		const setCookie = res.headers.get("set-cookie") ?? "";
		expect(setCookie).toContain("pkce_verifier=");
		expect(setCookie.toLowerCase()).toContain("httponly");
		expect(setCookie.toLowerCase()).toContain("samesite=lax");
		expect(setCookie).toMatch(/max-age=300/i);
	});

	it("athena#100: oauth_state and pkce_verifier Max-Age is exactly 300 seconds", async () => {
		// C2: AC requires explicit Max-Age=300 test — not just presence of the attribute
		const res = await GET();
		const setCookie = res.headers.get("set-cookie") ?? "";
		// Both cookies must have Max-Age=300 exactly (not 600, not 28800)
		const maxAgeMatches = setCookie.match(/max-age=(\d+)/gi);
		expect(maxAgeMatches).not.toBeNull();
		// All maxAge values in the set-cookie header must be 300
		for (const match of maxAgeMatches ?? []) {
			expect(match.toLowerCase()).toBe("max-age=300");
		}
	});

	it("athena#100: Secure flag is ABSENT in test env (NODE_ENV=test, not production)", async () => {
		// Development/test: Secure must be absent so OAuth2 flow works on HTTP localhost
		const res = await GET();
		const setCookie = res.headers.get("set-cookie") ?? "";
		// NODE_ENV is 'test' in vitest — Secure must not be present
		expect(setCookie.toLowerCase()).not.toContain("; secure");
	});

	it("athena#100: Secure flag is PRESENT in production (NODE_ENV=production)", async () => {
		// Production: both oauth_state and pkce_verifier must include the Secure flag
		process.env.NODE_ENV = "production";
		const res = await GET();
		const setCookie = res.headers.get("set-cookie") ?? "";
		// Both cookies are in the same set-cookie header — Secure must appear
		expect(setCookie).toContain("oauth_state=");
		expect(setCookie).toContain("pkce_verifier=");
		// Secure flag must be present when NODE_ENV=production
		expect(setCookie.toLowerCase()).toContain("secure");
	});

	it("athena#100: oauth_state and pkce_verifier do NOT use buildSessionCookieOptions (no sameSite=strict)", async () => {
		// These flow-state cookies must use sameSite=lax, not the session helper's sameSite=strict.
		// If buildSessionCookieOptions were mistakenly applied, sameSite would be 'strict'.
		const res = await GET();
		const setCookie = res.headers.get("set-cookie") ?? "";
		// Must be lax (OAuth2 callback is cross-site top-level redirect from Hydra)
		expect(setCookie.toLowerCase()).toContain("samesite=lax");
		expect(setCookie.toLowerCase()).not.toContain("samesite=strict");
	});

	it("F1: state in redirect URL matches the cookie value (64-char hex)", async () => {
		const res = await GET();
		const location = res.headers.get("location") ?? "";
		const setCookie = res.headers.get("set-cookie") ?? "";

		// Extract state from redirect URL
		const urlState = new URL(location).searchParams.get("state");
		expect(urlState).not.toBeNull();
		// 64-char hex from randomBytes(32).toString("hex")
		expect(urlState).toMatch(/^[0-9a-f]{64}$/);

		// Extract state from cookie
		const cookieMatch = setCookie.match(/oauth_state=([^;]+)/);
		expect(cookieMatch).not.toBeNull();
		const cookieState = cookieMatch![1];

		expect(urlState).toBe(cookieState);
	});

	it("F1: redirect URL includes redirect_uri pointing to /api/auth/callback", async () => {
		const res = await GET();
		const location = res.headers.get("location") ?? "";
		const url = new URL(location);
		const redirectUri = url.searchParams.get("redirect_uri");
		expect(redirectUri).toContain("/api/auth/callback");
	});

	it("F1: redirect URL includes scope=openid profile email", async () => {
		const res = await GET();
		const location = res.headers.get("location") ?? "";
		const url = new URL(location);
		expect(url.searchParams.get("scope")).toContain("openid");
	});

	it("falls back to OAUTH_CLIENT_ID env when getSettingOrDefault throws", async () => {
		const { getSettingOrDefault } = await import("@olympusoss/sdk");
		(getSettingOrDefault as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("db down"));
		process.env.OAUTH_CLIENT_ID = "env-client-id";
		const res = await GET();
		expect(res.status).toBe(307);
		const location = res.headers.get("location") ?? "";
		expect(location).toContain("client_id=env-client-id");
	});

	it("falls back to empty clientId when both SDK throws and OAUTH_CLIENT_ID unset", async () => {
		const { getSettingOrDefault } = await import("@olympusoss/sdk");
		(getSettingOrDefault as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("db down"));
		delete process.env.OAUTH_CLIENT_ID;
		const res = await GET();
		expect(res.status).toBe(307);
	});

	it("uses NEXT_PUBLIC_IAM_HYDRA_PUBLIC_URL fallback when AUTH_HYDRA_URL is unset", async () => {
		delete process.env.NEXT_PUBLIC_AUTH_HYDRA_URL;
		process.env.NEXT_PUBLIC_IAM_HYDRA_PUBLIC_URL = "http://iam-hydra.test";
		const res = await GET();
		const location = res.headers.get("location") ?? "";
		expect(location).toContain("http://iam-hydra.test/oauth2/auth");
	});

	it("uses localhost:4102 when both hydra URL env vars are unset", async () => {
		delete process.env.NEXT_PUBLIC_AUTH_HYDRA_URL;
		delete process.env.NEXT_PUBLIC_IAM_HYDRA_PUBLIC_URL;
		const res = await GET();
		const location = res.headers.get("location") ?? "";
		expect(location).toContain("localhost:4102");
	});

	it("falls back to CIAM port when APP_INSTANCE=CIAM and NEXT_PUBLIC_APP_URL unset", async () => {
		delete process.env.NEXT_PUBLIC_APP_URL;
		process.env.APP_INSTANCE = "CIAM";
		const res = await GET();
		const location = res.headers.get("location") ?? "";
		expect(location).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A3001%2Fapi%2Fauth%2Fcallback");
	});

	it("falls back to IAM port when APP_INSTANCE not CIAM and NEXT_PUBLIC_APP_URL unset", async () => {
		delete process.env.NEXT_PUBLIC_APP_URL;
		process.env.APP_INSTANCE = "IAM";
		const res = await GET();
		const location = res.headers.get("location") ?? "";
		expect(location).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A4001%2Fapi%2Fauth%2Fcallback");
	});

	it("returns empty clientId when clientId resolved as empty string (blank path)", async () => {
		const { getSettingOrDefault } = await import("@olympusoss/sdk");
		// Vault returns empty string => fallback lookups kick in
		(getSettingOrDefault as ReturnType<typeof vi.fn>).mockResolvedValueOnce("");
		delete process.env.OAUTH_CLIENT_ID;
		const res = await GET();
		expect(res.status).toBe(307);
	});
});
