/**
 * Unit tests for auth.ts (SESSION_COOKIE, parseSession, isAdmin).
 */

import { describe, expect, it } from "vitest";
import { isAdmin, parseSession, SESSION_COOKIE } from "../auth";
import { signSession } from "../session";

// DIAGNOSTIC: print env at module load so we can compare local vs CI output.
// Will be removed once the CI env mystery is resolved.
// eslint-disable-next-line no-console
console.log(
	`[DIAG auth.test] SESSION_SIGNING_KEY=${process.env.SESSION_SIGNING_KEY?.slice(0, 8)}... ENCRYPTION_KEY=${process.env.ENCRYPTION_KEY?.slice(0, 8)}... TZ=${process.env.TZ}`,
);

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
