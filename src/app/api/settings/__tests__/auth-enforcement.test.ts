/**
 * Security/regression tests for auth enforcement on settings API routes.
 *
 * Covers QA plan security tests: S1, S2, S3, S4.
 * These tests verify that middleware (athena#51 fix) properly gates settings routes.
 *
 * Strategy: test the middleware logic directly by importing it and simulating requests.
 * This is a regression guard — the dead middleware bug (athena#51) must never silently recur.
 *
 * ENCRYPTION_KEY is set in vitest.config.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { middleware } from "@/middleware";
import { signSession } from "@/lib/session";
import type { SessionData } from "@/lib/session";

// Mock the crypto-edge module (not available in Node test environment)
vi.mock("@/lib/crypto-edge", () => ({
	decryptApiKey: vi.fn().mockResolvedValue(null),
}));

const originalEnv = { ...process.env };

beforeEach(() => {
	process.env.ENCRYPTION_KEY = "test-encryption-key-for-vitest-32ch";
	vi.clearAllMocks();
});

afterEach(() => {
	process.env = { ...originalEnv };
});

const adminSession: SessionData = {
	accessToken: "access-token",
	idToken: "header.payload.sig",
	refreshToken: "refresh-token",
	expiresIn: 3600,
	user: {
		kratosIdentityId: "admin-user-id",
		email: "admin@example.com",
		role: "admin",
		displayName: "Admin User",
	},
};

const viewerSession: SessionData = {
	...adminSession,
	user: { ...adminSession.user, role: "viewer" },
};

function buildMiddlewareRequest(path: string, sessionCookie?: string, method = "GET") {
	const url = new URL(`http://localhost:4001${path}`);
	const cookieMap = new Map<string, string>();
	if (sessionCookie) {
		cookieMap.set("athena-session", sessionCookie);
	}
	return {
		nextUrl: url,
		url: url.toString(),
		method,
		headers: new Headers(),
		cookies: {
			get: (name: string) => {
				const val = cookieMap.get(name);
				return val ? { value: val } : undefined;
			},
		},
		arrayBuffer: async () => new ArrayBuffer(0),
	} as unknown as import("next/server").NextRequest;
}

describe("S1: Unauthenticated GET /api/settings returns 401 (post athena#51 fix)", () => {
	it("returns 401 when no session cookie is present", async () => {
		const req = buildMiddlewareRequest("/api/settings");
		const res = await middleware(req);
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.error).toBe("Not authenticated");
	});
});

describe("S2: Unauthenticated GET /api/settings/key?decrypt=true returns 401", () => {
	it("returns 401 before reaching the route handler", async () => {
		const req = buildMiddlewareRequest("/api/settings/oauth.client_secret?decrypt=true");
		const res = await middleware(req);
		expect(res.status).toBe(401);
	});
});

describe("S3: Unauthenticated POST /api/settings returns 401", () => {
	it("POST with no session returns 401", async () => {
		const req = buildMiddlewareRequest("/api/settings", undefined, "POST");
		const res = await middleware(req);
		expect(res.status).toBe(401);
	});
});

describe("S4: Viewer role returns 403 on admin routes", () => {
	it("viewer role gets 403 on /api/settings", async () => {
		const cookie = await signSession(viewerSession);
		const req = buildMiddlewareRequest("/api/settings", cookie);
		const res = await middleware(req);
		expect(res.status).toBe(403);
		const body = await res.json();
		expect(body.error).toBe("Forbidden: admin role required");
	});

	it("admin role proceeds through /api/settings (returns NextResponse.next)", async () => {
		const cookie = await signSession(adminSession);
		const req = buildMiddlewareRequest("/api/settings", cookie);
		const res = await middleware(req);
		// Middleware should call NextResponse.next() for valid admin sessions
		// next() responses have status 200 by default
		expect(res.status).toBe(200);
	});
});

describe("Public routes are not gated (/api/auth/*)", () => {
	it("/api/auth/login is accessible without a session", async () => {
		const req = buildMiddlewareRequest("/api/auth/login");
		const res = await middleware(req);
		// Public route — should not return 401; middleware calls NextResponse.next()
		expect(res.status).not.toBe(401);
	});

	it("/api/auth/callback is accessible without a session", async () => {
		const req = buildMiddlewareRequest("/api/auth/callback?code=abc&state=xyz");
		const res = await middleware(req);
		expect(res.status).not.toBe(401);
	});

	it("/api/health is accessible without a session", async () => {
		const req = buildMiddlewareRequest("/api/health");
		const res = await middleware(req);
		expect(res.status).not.toBe(401);
	});
});
