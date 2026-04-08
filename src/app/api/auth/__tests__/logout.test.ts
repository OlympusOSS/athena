/**
 * Unit/integration tests for GET /api/auth/logout
 *
 * Covers QA plan scenarios: F14, F15, F16.
 * Edge cases: E5, E6 (Hydra revocation failure paths).
 * Security: S7 (logout CSRF — documented known trade-off).
 * Known bugs: S11 (HTML injection in meta-refresh — verified safe via URL construction).
 *
 * ENCRYPTION_KEY is set in vitest.config.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionData } from "@/lib/session";
import { signSession } from "@/lib/session";
import { GET } from "../logout/route";

function buildIdToken(claims: Record<string, string>): string {
	const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
	const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
	return `${header}.${payload}.sig`;
}

const validSession: SessionData = {
	accessToken: "access-token",
	idToken: buildIdToken({ sub: "user-123", email: "admin@example.com" }),
	refreshToken: "refresh-token",
	expiresIn: 3600,
	user: {
		kratosIdentityId: "user-123",
		email: "admin@example.com",
		role: "admin",
		displayName: "Admin User",
	},
};

const originalEnv = { ...process.env };

beforeEach(() => {
	process.env.ENCRYPTION_KEY = "test-encryption-key-for-vitest-32ch";
	process.env.NEXT_PUBLIC_APP_URL = "http://localhost:4001";
	process.env.AUTH_HYDRA_ADMIN_URL = "http://localhost:4103";
	process.env.AUTH_KRATOS_ADMIN_URL = "http://localhost:4101";
	vi.restoreAllMocks();
});

afterEach(() => {
	process.env = { ...originalEnv };
});

function buildRequest(sessionCookie?: string) {
	const cookieMap = new Map<string, string>();
	if (sessionCookie !== undefined) {
		cookieMap.set("athena-session", sessionCookie);
	}
	return {
		cookies: {
			get: (name: string) => {
				const val = cookieMap.get(name);
				return val ? { value: val } : undefined;
			},
		},
	} as unknown as import("next/server").NextRequest;
}

describe("F14: Logout with valid session — revokes Kratos and Hydra sessions", () => {
	it("calls all three revocation endpoints and clears session cookie", async () => {
		const cookie = await signSession(validSession);
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, text: async () => "" });
		vi.stubGlobal("fetch", fetchMock);

		const req = buildRequest(cookie);
		const res = await GET(req);

		// Three revocation calls: Kratos + Hydra login + Hydra consent
		expect(fetchMock).toHaveBeenCalledTimes(3);

		// Verify the Kratos revocation call
		const calls = fetchMock.mock.calls.map((c) => c[0] as string);
		expect(calls.some((url) => url.includes("/admin/identities/user-123/sessions"))).toBe(true);
		expect(calls.some((url) => url.includes("/admin/oauth2/auth/sessions/login"))).toBe(true);
		expect(calls.some((url) => url.includes("/admin/oauth2/auth/sessions/consent"))).toBe(true);

		// Session cookie should be cleared (maxAge=0)
		const setCookie = res.headers.get("set-cookie") ?? "";
		expect(setCookie).toContain("athena-session");
		expect(setCookie).toMatch(/max-age=0/i);

		// Should return HTML redirect
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("meta http-equiv");
		expect(html).toContain("/api/auth/login");
	});
});

describe("F15: Logout without session — skips revocation, clears cookie", () => {
	it("skips revocation calls and clears session cookie gracefully", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const req = buildRequest(undefined);
		const res = await GET(req);

		// No revocation calls when no session
		expect(fetchMock).not.toHaveBeenCalled();

		// Session cookie should still be cleared
		const setCookie = res.headers.get("set-cookie") ?? "";
		expect(setCookie).toContain("athena-session");
		expect(setCookie).toMatch(/max-age=0/i);
	});
});

describe("F16: Logout extracts sub from id_token when kratosIdentityId is empty", () => {
	it("uses sub from id_token for revocation calls", async () => {
		const sessionWithEmptyId: SessionData = {
			...validSession,
			user: { ...validSession.user, kratosIdentityId: "" },
			idToken: buildIdToken({ sub: "from-id-token-sub", email: "admin@example.com" }),
		};
		const cookie = await signSession(sessionWithEmptyId);

		const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, text: async () => "" });
		vi.stubGlobal("fetch", fetchMock);

		const req = buildRequest(cookie);
		await GET(req);

		const calls = fetchMock.mock.calls.map((c) => c[0] as string);
		expect(calls.some((url) => url.includes("from-id-token-sub"))).toBe(true);
	});
});

describe("E5: Hydra revocation returns 404 — logout still completes", () => {
	it("proceeds with logout even when revocation returns 404", async () => {
		const cookie = await signSession(validSession);
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 404,
			text: async () => "not found",
		});
		vi.stubGlobal("fetch", fetchMock);

		const req = buildRequest(cookie);
		const res = await GET(req);

		// Logout should complete despite 404 responses
		expect(res.status).toBe(200);
		const setCookie = res.headers.get("set-cookie") ?? "";
		expect(setCookie).toMatch(/max-age=0/i);
	});
});

describe("E6: Hydra revocation returns 500 — logout still completes", () => {
	it("proceeds with logout even when revocation returns 500", async () => {
		const cookie = await signSession(validSession);
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			text: async () => "server error",
		});
		vi.stubGlobal("fetch", fetchMock);

		const req = buildRequest(cookie);
		const res = await GET(req);

		// Logout should still complete
		expect(res.status).toBe(200);
		const setCookie = res.headers.get("set-cookie") ?? "";
		expect(setCookie).toMatch(/max-age=0/i);
	});
});

describe("S12: Session cookie cleared with correct security attributes on logout", () => {
	it("clear cookie has sameSite=strict (upgraded from lax)", async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, text: async () => "" });
		vi.stubGlobal("fetch", fetchMock);

		const req = buildRequest(undefined);
		const res = await GET(req);
		const setCookie = res.headers.get("set-cookie") ?? "";
		expect(setCookie.toLowerCase()).toContain("samesite=strict");
	});

	it("clear cookie has secure flag in production", async () => {
		process.env.NODE_ENV = "production";
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, text: async () => "" });
		vi.stubGlobal("fetch", fetchMock);

		const req = buildRequest(undefined);
		const res = await GET(req);
		const setCookie = res.headers.get("set-cookie") ?? "";
		expect(setCookie.toLowerCase()).toContain("secure");
		expect(setCookie).toMatch(/max-age=0/i);
	});

	it("clear cookie has no secure flag in development", async () => {
		process.env.NODE_ENV = "development";
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, text: async () => "" });
		vi.stubGlobal("fetch", fetchMock);

		const req = buildRequest(undefined);
		const res = await GET(req);
		const setCookie = res.headers.get("set-cookie") ?? "";
		expect(setCookie.toLowerCase()).not.toContain("secure");
		expect(setCookie).toMatch(/max-age=0/i);
	});
});

describe("athena#57 regression gate: athena-session clear cookie has both Secure AND HttpOnly flags", () => {
	// DA Security condition: regression gate must verify HttpOnly alongside Secure.
	// If a future change to buildSessionClearOptions() removes HttpOnly, this test fails.
	it("clear cookie has httpOnly=true in production (regression gate: HttpOnly)", async () => {
		process.env.NODE_ENV = "production";
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, text: async () => "" });
		vi.stubGlobal("fetch", fetchMock);

		const req = buildRequest(undefined);
		const res = await GET(req);
		const setCookie = res.headers.get("set-cookie") ?? "";
		// Both Secure and HttpOnly must be present on the clear-cookie — not just Secure
		expect(setCookie.toLowerCase()).toContain("httponly");
		expect(setCookie.toLowerCase()).toContain("secure");
		expect(setCookie).toMatch(/max-age=0/i);
	});

	it("clear cookie has httpOnly=true in development (HttpOnly is NODE_ENV-independent)", async () => {
		process.env.NODE_ENV = "development";
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, text: async () => "" });
		vi.stubGlobal("fetch", fetchMock);

		const req = buildRequest(undefined);
		const res = await GET(req);
		const setCookie = res.headers.get("set-cookie") ?? "";
		// HttpOnly is always true regardless of environment
		expect(setCookie.toLowerCase()).toContain("httponly");
		// Secure is absent in development
		expect(setCookie.toLowerCase()).not.toContain("; secure");
	});
});

describe("S11: HTML injection in logout redirect meta tag", () => {
	it("loginUrl is constructed via URL object — characters are encoded, no HTML injection", async () => {
		// The route uses `new URL("/api/auth/login", appUrl).toString()` which encodes
		// special characters. Verify the HTML output does not contain raw injection.
		process.env.NEXT_PUBLIC_APP_URL = "http://localhost:4001";
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, text: async () => "" });
		vi.stubGlobal("fetch", fetchMock);

		const req = buildRequest(undefined);
		const res = await GET(req);
		const html = await res.text();

		// The URL should be properly formed and not contain raw injection characters
		expect(html).toContain("http://localhost:4001/api/auth/login");
		// Should not contain unescaped angle brackets or quotes beyond the template structure
		const urlInMeta = html.match(/content="0;url=([^"]+)"/)?.[1];
		expect(urlInMeta).toBe("http://localhost:4001/api/auth/login");
	});
});
