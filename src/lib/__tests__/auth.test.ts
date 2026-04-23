/**
 * @vitest-environment node
 *
 * Unit tests for auth.ts (SESSION_COOKIE, parseSession, isAdmin).
 * Runs under node env so crypto.subtle uses Node's real Web Crypto impl —
 * jsdom's shim has platform-specific HMAC-verify bugs.
 */

import { describe, expect, it } from "vitest";
import { isAdmin, parseSession, SESSION_COOKIE } from "../auth";
import { signSession } from "../session";

describe("auth.ts exports", () => {
	it("SESSION_COOKIE is the expected constant", () => {
		expect(SESSION_COOKIE).toBe("athena-session");
	});
});

describe("parseSession", () => {
	it("returns null for undefined cookie", async () => {
		const result = await parseSession(undefined);
		expect(result).toBeNull();
	});

	it("returns null for empty string cookie", async () => {
		const result = await parseSession("");
		expect(result).toBeNull();
	});

	it("returns null for malformed cookie", async () => {
		const result = await parseSession("not.a.valid.cookie");
		expect(result).toBeNull();
	});

	it("returns session data for a valid HMAC-signed cookie", async () => {
		const cookie = await signSession({
			accessToken: "at",
			idToken: "it",
			refreshToken: "rt",
			expiresIn: 3600,
			user: {
				kratosIdentityId: "id",
				email: "a@b.com",
				role: "admin",
				displayName: "Admin User",
			},
		});
		const result = await parseSession(cookie);
		expect(result).not.toBeNull();
		expect(result?.user.email).toBe("a@b.com");
	});
});

describe("isAdmin", () => {
	it("returns true when user.role === 'admin'", () => {
		expect(isAdmin({ user: { role: "admin" } })).toBe(true);
	});

	it("returns false for non-admin role", () => {
		expect(isAdmin({ user: { role: "user" } })).toBe(false);
		expect(isAdmin({ user: { role: "viewer" } })).toBe(false);
		expect(isAdmin({ user: { role: "" } })).toBe(false);
	});
});
