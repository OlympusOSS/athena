/**
 * @vitest-environment node
 *
 * Unit tests for GET /api/auth/session
 *
 * Covers QA plan scenarios: F11, F12, F13.
 * Security tests: S3 (tampered cookie), S9 (unauthenticated access).
 *
 * SESSION_SIGNING_KEY and ENCRYPTION_KEY are set in vitest.config.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionData } from "@/lib/session";
import { signSession } from "@/lib/session";
import { GET } from "../session/route";

const validSession: SessionData = {
	accessToken: "access-token",
	idToken: "header.eyJzdWIiOiJ1c2VyLTEyMyIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20ifQ.sig",
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
	vi.restoreAllMocks();
});

afterEach(() => {
	process.env = { ...originalEnv };
	process.env.ENCRYPTION_KEY = "test-encryption-key-for-vitest-32ch";
	process.env.SESSION_SIGNING_KEY = "y0vXvDE6hGnlA4J/iLlTwyMXHgDrMp4tD3ON+3lf3ws=";
	process.env.NEXT_PUBLIC_APP_URL = "http://localhost:4001";
	process.env.TZ = "UTC";
});

function buildRequest(cookieValue?: string) {
	const cookieMap = new Map<string, string>();
	if (cookieValue !== undefined) {
		cookieMap.set("athena-session", cookieValue);
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

describe("F11: Valid session returns user object", () => {
	it("returns 200 with user data for a valid signed session", async () => {
		const cookie = await signSession(validSession);
		const req = buildRequest(cookie);
		const res = await GET(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.user).toBeDefined();
		expect(body.user.email).toBe("admin@example.com");
		expect(body.user.role).toBe("admin");
		expect(body.user.kratosIdentityId).toBe("user-123");
		expect(body.user.displayName).toBe("Admin User");
	});
});

describe("F12: Missing cookie returns 401", () => {
	it("returns 401 with error when no athena-session cookie", async () => {
		const req = buildRequest(undefined);
		const res = await GET(req);
		expect(res.status).toBe(401);
		const body = await res.json();
		// athena#60: standardized error shape
		expect(body.error).toBe("not_authenticated");
		expect(body.hint).toBe("Authenticate via /api/auth/login");
	});
});

describe("F13: Tampered cookie returns 401", () => {
	it("S3: returns 401 for a cookie with tampered payload", async () => {
		const cookie = await signSession(validSession);
		const dotIndex = cookie.lastIndexOf(".");
		const sig = cookie.slice(dotIndex + 1);
		const payload = cookie.slice(0, dotIndex);
		const tampered = `X${payload.slice(1)}.${sig}`;
		const req = buildRequest(tampered);
		const res = await GET(req);
		expect(res.status).toBe(401);
	});

	it("S3: returns 401 for a completely forged cookie", async () => {
		const fakePayload = Buffer.from(JSON.stringify(validSession)).toString("base64url");
		const fakeSig = Buffer.from("fakesig").toString("base64url");
		const forged = `${fakePayload}.${fakeSig}`;
		const req = buildRequest(forged);
		const res = await GET(req);
		expect(res.status).toBe(401);
	});

	it("returns 401 for a cookie with no dot separator", async () => {
		const req = buildRequest("notacookieatall");
		const res = await GET(req);
		expect(res.status).toBe(401);
	});
});

describe("S9: Unauthenticated access to /api/auth/session after middleware fix", () => {
	it("session route itself returns 401 for requests with no cookie (double-gate)", async () => {
		// The middleware passes /api/auth/* as public routes.
		// The session route itself must enforce auth via verifySession.
		const req = buildRequest(undefined);
		const res = await GET(req);
		expect(res.status).toBe(401);
		const body = await res.json();
		// athena#60: standardized error shape
		expect(body.error).toBe("not_authenticated");
		expect(body.hint).toBe("Authenticate via /api/auth/login");
	});
});
