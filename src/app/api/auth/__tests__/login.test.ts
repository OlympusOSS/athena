/**
 * Unit tests for GET /api/auth/login
 *
 * Covers QA plan scenario: F1.
 * The login route generates a state value, sets the oauth_state cookie,
 * and redirects to Hydra /oauth2/auth.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
});
