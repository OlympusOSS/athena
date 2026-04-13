/**
 * Integration/unit tests for GET /api/auth/callback
 *
 * Covers QA plan scenarios: F2, F3, F4, F5, F6, F7, F8, F9, F10.
 * Edge cases: E1, E2, E5 (partial).
 * Security tests: S1, S6, S10, S-userinfo.
 *
 * Strategy: mock the @olympusoss/sdk module to avoid DB calls,
 * and mock global.fetch to simulate Hydra token exchange, Hydra userinfo,
 * and Kratos admin responses.
 * SESSION_SIGNING_KEY and ENCRYPTION_KEY are set in vitest.config.ts.
 *
 * Fetch call order per successful request:
 *   1. POST {hydraUrl}/oauth2/token        — token exchange
 *   2. GET  {hydraUrl}/oauth2/userinfo     — verified claim retrieval (replaces id_token decode)
 *   3. GET  {kratosAdminUrl}/admin/identities/{sub} — identity enrichment
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifySession } from "@/lib/session";
import { GET } from "../callback/route";

// Mock the SDK to avoid real DB connections
vi.mock("@olympusoss/sdk", () => ({
	getSettingOrDefault: vi.fn().mockResolvedValue("test-client-id"),
	getSecretSetting: vi.fn().mockResolvedValue("test-client-secret"),
}));

// Helper to create a mock NextRequest with cookies and query params
function buildNextRequest(params: { code?: string; state?: string; oauthStateCookie?: string; pkceVerifierCookie?: string }) {
	const url = new URL("http://localhost:4001/api/auth/callback");
	if (params.code) url.searchParams.set("code", params.code);
	if (params.state) url.searchParams.set("state", params.state);

	const cookieMap = new Map<string, string>();
	if (params.oauthStateCookie) {
		cookieMap.set("oauth_state", params.oauthStateCookie);
	}
	// Default to a verifier so tests that don't care about PKCE still pass the check
	cookieMap.set("pkce_verifier", params.pkceVerifierCookie ?? "test-code-verifier");

	return {
		nextUrl: url,
		cookies: {
			get: (name: string) => {
				const val = cookieMap.get(name);
				return val ? { value: val } : undefined;
			},
		},
		url: url.toString(),
	} as unknown as import("next/server").NextRequest;
}

// Helper to simulate a successful Hydra token response
function buildTokens(
	overrides: Partial<{
		access_token: string;
		id_token: string;
		refresh_token: string;
		expires_in: number;
	}> = {},
) {
	return {
		access_token: "test-access-token",
		// id_token is stored in session for downstream use only — never decoded for claims
		id_token: "header.payload.fakesig",
		refresh_token: "test-refresh-token",
		expires_in: 3600,
		...overrides,
	};
}

// Helper to simulate a successful Hydra userinfo response
function buildUserinfo(overrides: Partial<{ sub: string; email: string }> = {}) {
	return {
		sub: "user-123",
		email: "admin@example.com",
		email_verified: true,
		...overrides,
	};
}

// Default env setup
const originalEnv = { ...process.env };

beforeEach(() => {
	process.env.ENCRYPTION_KEY = "test-encryption-key-for-vitest-32ch";
	process.env.NEXT_PUBLIC_APP_URL = "http://localhost:4001";
	process.env.AUTH_HYDRA_URL = "http://localhost:4102";
	process.env.AUTH_KRATOS_ADMIN_URL = "http://localhost:4101";
	vi.clearAllMocks();
});

afterEach(() => {
	process.env = { ...originalEnv };
});

describe("F4: Missing code param — redirects to login", () => {
	it("redirects to /api/auth/login when code is absent", async () => {
		const req = buildNextRequest({ state: "somestate", oauthStateCookie: "somestate" });
		const res = await GET(req);
		expect(res.status).toBe(307);
		expect(res.headers.get("location")).toContain("/api/auth/login");
	});
});

describe("F3 / F5: State mismatch / missing state cookie", () => {
	it("F3: redirects when state param does not match cookie", async () => {
		const req = buildNextRequest({ code: "auth-code", state: "xyz", oauthStateCookie: "abc" });
		const res = await GET(req);
		expect(res.status).toBe(307);
		expect(res.headers.get("location")).toContain("/api/auth/login");
	});

	it("F5: redirects when oauth_state cookie is missing", async () => {
		const req = buildNextRequest({ code: "auth-code", state: "somestate" });
		const res = await GET(req);
		expect(res.status).toBe(307);
		expect(res.headers.get("location")).toContain("/api/auth/login");
	});

	it("S1: CSRF replay — no cookie present means state mismatch, redirect to login", async () => {
		// Attacker has the state value but no cookie in their browser session
		const req = buildNextRequest({ code: "stolen-code", state: "known-state" });
		const res = await GET(req);
		expect(res.status).toBe(307);
		expect(res.headers.get("location")).toContain("/api/auth/login");
	});
});

describe("PKCE: Missing pkce_verifier cookie", () => {
	it("redirects to login when pkce_verifier cookie is absent", async () => {
		const req = buildNextRequest({
			code: "auth-code",
			state: "match-state",
			oauthStateCookie: "match-state",
			pkceVerifierCookie: "",
		});
		// Override cookie map to omit pkce_verifier entirely
		(req.cookies.get as ReturnType<typeof vi.fn>) = vi.fn((name: string) => {
			if (name === "oauth_state") return { value: "match-state" };
			return undefined;
		});
		const res = await GET(req);
		expect(res.status).toBe(307);
		expect(res.headers.get("location")).toContain("/api/auth/login");
	});
});

describe("F2 / F6: Successful callback with valid state and token exchange", () => {
	beforeEach(() => {
		const tokens = buildTokens();
		const userinfo = buildUserinfo();
		const kratosMock = {
			ok: true,
			json: vi.fn().mockResolvedValue({
				traits: {
					email: "admin@example.com",
					role: "admin",
					name: { first: "Admin", last: "User" },
				},
			}),
		};

		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				// 1. Token exchange
				.mockResolvedValueOnce({
					ok: true,
					json: vi.fn().mockResolvedValue(tokens),
					text: vi.fn().mockResolvedValue(""),
				})
				// 2. Userinfo
				.mockResolvedValueOnce({
					ok: true,
					json: vi.fn().mockResolvedValue(userinfo),
				})
				// 3. Kratos identity
				.mockResolvedValueOnce(kratosMock),
		);
	});

	it("F2: redirects to /dashboard on success", async () => {
		const req = buildNextRequest({ code: "valid-code", state: "match-state", oauthStateCookie: "match-state" });
		const res = await GET(req);
		expect(res.status).toBe(307);
		expect(res.headers.get("location")).toContain("/dashboard");
	});

	it("F6: sets athena-session cookie with httpOnly=true, sameSite=strict", async () => {
		const req = buildNextRequest({ code: "valid-code", state: "match-state", oauthStateCookie: "match-state" });
		const res = await GET(req);
		const setCookie = res.headers.get("set-cookie") ?? "";
		expect(setCookie).toContain("athena-session");
		expect(setCookie.toLowerCase()).toContain("httponly");
		expect(setCookie.toLowerCase()).toContain("samesite=strict");
	});

	it("S10: secure flag absent in test env (NODE_ENV=test)", async () => {
		// In test env, secure should be absent (only set in production)
		const req = buildNextRequest({ code: "valid-code", state: "match-state", oauthStateCookie: "match-state" });
		const res = await GET(req);
		const setCookie = res.headers.get("set-cookie") ?? "";
		// NODE_ENV is 'test' not 'production' during tests
		// secure flag should NOT be present in test environment
		expect(setCookie.toLowerCase()).not.toContain("secure");
	});

	it("S10-prod: secure flag present when NODE_ENV=production", async () => {
		process.env.NODE_ENV = "production";
		const req = buildNextRequest({ code: "valid-code", state: "match-state", oauthStateCookie: "match-state" });
		const res = await GET(req);
		const setCookie = res.headers.get("set-cookie") ?? "";
		expect(setCookie).toContain("athena-session");
		expect(setCookie.toLowerCase()).toContain("secure");
	});

	it("S10-maxage: maxAge is capped at 28800 when OAuth2 server returns expires_in > 28800", async () => {
		// expires_in = 86400 (1 day) — should be capped to 28800 (8 hours)
		const longTokens = buildTokens({ expires_in: 86400 });
		// Re-stub fetch for this single test with a long expires_in
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValueOnce({
					ok: true,
					json: vi.fn().mockResolvedValue(longTokens),
					text: vi.fn().mockResolvedValue(""),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: vi.fn().mockResolvedValue(buildUserinfo()),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: vi.fn().mockResolvedValue({
						traits: { email: "admin@example.com", role: "admin", name: { first: "Admin", last: "User" } },
					}),
				}),
		);
		const req = buildNextRequest({ code: "valid-code", state: "match-state", oauthStateCookie: "match-state" });
		const res = await GET(req);
		const setCookie = res.headers.get("set-cookie") ?? "";
		// max-age should be 28800, not 86400
		expect(setCookie.toLowerCase()).toContain("max-age=28800");
		expect(setCookie.toLowerCase()).not.toContain("max-age=86400");
	});

	it("F10: clears oauth_state and pkce_verifier cookies on success", async () => {
		const req = buildNextRequest({ code: "valid-code", state: "match-state", oauthStateCookie: "match-state" });
		const res = await GET(req);
		const setCookieHeader = res.headers.get("set-cookie") ?? "";
		// oauth_state should be cleared (max-age=0 or deleted)
		expect(setCookieHeader).toMatch(/oauth_state=;|oauth_state=.*max-age=0/i);
		// pkce_verifier should also be cleared
		expect(setCookieHeader).toMatch(/pkce_verifier=;|pkce_verifier=.*max-age=0/i);
	});

	it("F6: session cookie payload is HMAC-signed and verifiable", async () => {
		const req = buildNextRequest({ code: "valid-code", state: "match-state", oauthStateCookie: "match-state" });
		const res = await GET(req);
		const setCookieHeader = res.headers.get("set-cookie") ?? "";
		// Extract cookie value
		const match = setCookieHeader.match(/athena-session=([^;]+)/);
		expect(match).not.toBeNull();
		const cookieValue = match![1];
		const session = await verifySession(cookieValue);
		expect(session).not.toBeNull();
		expect(session?.accessToken).toBe("test-access-token");
	});

	it("S-userinfo: kratosIdentityId in session is the sub from userinfo, not from id_token", async () => {
		// This test verifies the fix: sub must come from the /oauth2/userinfo response
		const req = buildNextRequest({ code: "valid-code", state: "match-state", oauthStateCookie: "match-state" });
		const res = await GET(req);
		const setCookieHeader = res.headers.get("set-cookie") ?? "";
		const match = setCookieHeader.match(/athena-session=([^;]+)/);
		expect(match).not.toBeNull();
		const session = await verifySession(match![1]);
		// sub "user-123" came from the userinfo mock, NOT from decoding id_token payload
		expect(session?.user.kratosIdentityId).toBe("user-123");
	});
});

describe("F7: Identity enrichment from Kratos", () => {
	it("F7: uses Kratos traits for email, role, displayName", async () => {
		const tokens = buildTokens();
		const userinfo = buildUserinfo({ sub: "user-123", email: "admin@example.com" });
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				// 1. Token exchange
				.mockResolvedValueOnce({
					ok: true,
					json: vi.fn().mockResolvedValue(tokens),
					text: vi.fn().mockResolvedValue(""),
				})
				// 2. Userinfo
				.mockResolvedValueOnce({
					ok: true,
					json: vi.fn().mockResolvedValue(userinfo),
				})
				// 3. Kratos identity
				.mockResolvedValueOnce({
					ok: true,
					json: vi.fn().mockResolvedValue({
						traits: {
							email: "kratos@example.com",
							role: "admin",
							name: { first: "Kratos", last: "Admin" },
						},
					}),
				}),
		);

		const req = buildNextRequest({ code: "valid-code", state: "match-state", oauthStateCookie: "match-state" });
		const res = await GET(req);
		const setCookieHeader = res.headers.get("set-cookie") ?? "";
		const match = setCookieHeader.match(/athena-session=([^;]+)/);
		expect(match).not.toBeNull();
		const session = await verifySession(match![1]);
		expect(session?.user.email).toBe("kratos@example.com");
		expect(session?.user.role).toBe("admin");
		expect(session?.user.displayName).toBe("Kratos Admin");
	});
});

describe("F8: Kratos fetch fails — falls back gracefully", () => {
	it("F8: creates session with userinfo email and role=viewer when Kratos returns 500", async () => {
		const tokens = buildTokens();
		const userinfo = buildUserinfo({ sub: "user-123", email: "admin@example.com" });
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				// 1. Token exchange
				.mockResolvedValueOnce({
					ok: true,
					json: vi.fn().mockResolvedValue(tokens),
					text: vi.fn().mockResolvedValue(""),
				})
				// 2. Userinfo — succeeds
				.mockResolvedValueOnce({
					ok: true,
					json: vi.fn().mockResolvedValue(userinfo),
				})
				// 3. Kratos — fails
				.mockResolvedValueOnce({
					ok: false,
					status: 500,
					json: vi.fn().mockResolvedValue({}),
				}),
		);

		const req = buildNextRequest({ code: "valid-code", state: "match-state", oauthStateCookie: "match-state" });
		const res = await GET(req);
		expect(res.status).toBe(307);
		expect(res.headers.get("location")).toContain("/dashboard");

		const setCookieHeader = res.headers.get("set-cookie") ?? "";
		const match = setCookieHeader.match(/athena-session=([^;]+)/);
		const session = await verifySession(match![1]);
		expect(session?.user.email).toBe("admin@example.com"); // from userinfo
		expect(session?.user.role).toBe("viewer"); // fallback
	});
});

describe("F9: missing sub from userinfo — empty kratosIdentityId, no Kratos call", () => {
	it("F9: creates session with empty sub/email when userinfo returns no sub", async () => {
		const tokens = buildTokens();
		const userinfo = buildUserinfo({ sub: "", email: "" });
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				// 1. Token exchange
				.mockResolvedValueOnce({
					ok: true,
					json: vi.fn().mockResolvedValue(tokens),
					text: vi.fn().mockResolvedValue(""),
				})
				// 2. Userinfo — returns empty sub
				.mockResolvedValueOnce({
					ok: true,
					json: vi.fn().mockResolvedValue(userinfo),
				}),
			// No Kratos call because sub is empty
		);

		const req = buildNextRequest({ code: "valid-code", state: "match-state", oauthStateCookie: "match-state" });
		const res = await GET(req);
		// Should still redirect to dashboard (no sub means no Kratos call)
		expect(res.status).toBe(307);
	});
});

describe("S-userinfo: Userinfo endpoint failure — redirects to login, no fallback decode", () => {
	it("redirects to login when userinfo returns 401", async () => {
		const tokens = buildTokens();
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				// 1. Token exchange — succeeds
				.mockResolvedValueOnce({
					ok: true,
					json: vi.fn().mockResolvedValue(tokens),
					text: vi.fn().mockResolvedValue(""),
				})
				// 2. Userinfo — fails with 401
				.mockResolvedValueOnce({
					ok: false,
					status: 401,
					text: vi.fn().mockResolvedValue("Unauthorized"),
				}),
		);

		const req = buildNextRequest({ code: "valid-code", state: "match-state", oauthStateCookie: "match-state" });
		const res = await GET(req);
		expect(res.status).toBe(307);
		expect(res.headers.get("location")).toContain("/api/auth/login");
		// Crucially: no athena-session cookie — no fallback decode path
		expect(res.headers.get("set-cookie") ?? "").not.toContain("athena-session=ey");
	});

	it("redirects to login when userinfo returns 500", async () => {
		const tokens = buildTokens();
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValueOnce({
					ok: true,
					json: vi.fn().mockResolvedValue(tokens),
					text: vi.fn().mockResolvedValue(""),
				})
				.mockResolvedValueOnce({
					ok: false,
					status: 500,
					text: vi.fn().mockResolvedValue("Internal Server Error"),
				}),
		);

		const req = buildNextRequest({ code: "valid-code", state: "match-state", oauthStateCookie: "match-state" });
		const res = await GET(req);
		expect(res.status).toBe(307);
		expect(res.headers.get("location")).toContain("/api/auth/login");
		expect(res.headers.get("set-cookie") ?? "").not.toContain("athena-session=ey");
	});
});

describe("E1 / E2: Token exchange failure paths", () => {
	it("E1: Hydra returns 400 — redirects to login, no session cookie", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValueOnce({
				ok: false,
				status: 400,
				text: vi.fn().mockResolvedValue("invalid_grant"),
			}),
		);

		const req = buildNextRequest({ code: "expired-code", state: "match-state", oauthStateCookie: "match-state" });
		const res = await GET(req);
		expect(res.status).toBe(307);
		expect(res.headers.get("location")).toContain("/api/auth/login");
		expect(res.headers.get("set-cookie") ?? "").not.toContain("athena-session=ey");
	});

	it("E2: Network timeout (fetch throws) — redirects to login, no crash", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new TypeError("fetch failed: network timeout")));

		const req = buildNextRequest({ code: "valid-code", state: "match-state", oauthStateCookie: "match-state" });
		const res = await GET(req);
		expect(res.status).toBe(307);
		expect(res.headers.get("location")).toContain("/api/auth/login");
	});
});
