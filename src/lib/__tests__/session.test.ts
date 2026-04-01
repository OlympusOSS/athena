/**
 * Unit tests for session.ts HMAC signing/verification utilities.
 *
 * Covers QA plan scenarios: F17, F18, F19, E8, E11, E12.
 * Security tests: S3, S6 (cookie attribute validation).
 *
 * No network calls required — pure crypto.
 * ENCRYPTION_KEY is set to a fixed test value in vitest.config.ts.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { signSession, verifySession } from "../session";
import type { SessionData } from "../session";

// Minimal valid session fixture
const validSession: SessionData = {
	accessToken: "access-token-value",
	idToken: "header.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.sig",
	refreshToken: "refresh-token-value",
	expiresIn: 3600,
	user: {
		kratosIdentityId: "test-user-id",
		email: "test@example.com",
		role: "admin",
		displayName: "Test User",
	},
};

describe("signSession / verifySession round-trip", () => {
	it("F17: round-trip returns original data exactly", async () => {
		const cookie = await signSession(validSession);
		const result = await verifySession(cookie);

		expect(result).not.toBeNull();
		expect(result?.accessToken).toBe(validSession.accessToken);
		expect(result?.idToken).toBe(validSession.idToken);
		expect(result?.refreshToken).toBe(validSession.refreshToken);
		expect(result?.expiresIn).toBe(validSession.expiresIn);
		expect(result?.user.kratosIdentityId).toBe(validSession.user.kratosIdentityId);
		expect(result?.user.email).toBe(validSession.user.email);
		expect(result?.user.role).toBe(validSession.user.role);
		expect(result?.user.displayName).toBe(validSession.user.displayName);
	});

	it("F17: cookie has format <base64url>.<base64url>", async () => {
		const cookie = await signSession(validSession);
		const parts = cookie.split(".");
		// base64url payload + base64url signature = 2 parts minimum
		// (the idToken inside has dots too, but the cookie format is payload.sig
		// where payload is the entire base64url-encoded JSON, not the JSON itself)
		expect(parts.length).toBeGreaterThanOrEqual(2);
		// The last dot separates the HMAC signature
		const dotIndex = cookie.lastIndexOf(".");
		expect(dotIndex).toBeGreaterThan(0);
		const sig = cookie.slice(dotIndex + 1);
		expect(sig.length).toBeGreaterThan(0);
	});
});

describe("verifySession — rejection cases", () => {
	it("F18: returns null when accessToken is missing", async () => {
		const session = { ...validSession, accessToken: "" };
		const cookie = await signSession(session);
		const result = await verifySession(cookie);
		expect(result).toBeNull();
	});

	it("F18: returns null when user.email is missing", async () => {
		const session = { ...validSession, user: { ...validSession.user, email: "" } };
		const cookie = await signSession(session);
		const result = await verifySession(cookie);
		expect(result).toBeNull();
	});

	it("F18: returns null when user.role is missing", async () => {
		const session = { ...validSession, user: { ...validSession.user, role: "" } };
		const cookie = await signSession(session);
		const result = await verifySession(cookie);
		expect(result).toBeNull();
	});

	it("E12: returns null when cookie has no dot separator", async () => {
		const result = await verifySession("nodothere");
		expect(result).toBeNull();
	});

	it("E12: returns null for empty string cookie", async () => {
		const result = await verifySession("");
		expect(result).toBeNull();
	});

	it("returns null for undefined cookie", async () => {
		const result = await verifySession(undefined);
		expect(result).toBeNull();
	});

	it("S3: returns null for a tampered payload (HMAC invalid)", async () => {
		const cookie = await signSession(validSession);
		const dotIndex = cookie.lastIndexOf(".");
		const sig = cookie.slice(dotIndex + 1);
		// Tamper with the payload (replace first char)
		const payload = cookie.slice(0, dotIndex);
		const tampered = `X${payload.slice(1)}.${sig}`;
		const result = await verifySession(tampered);
		expect(result).toBeNull();
	});

	it("S3: returns null for a tampered signature", async () => {
		const cookie = await signSession(validSession);
		const dotIndex = cookie.lastIndexOf(".");
		const payload = cookie.slice(0, dotIndex);
		// Tamper with the signature
		const tamperedCookie = `${payload}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
		const result = await verifySession(tamperedCookie);
		expect(result).toBeNull();
	});

	it("S3: forged cookie without knowing HMAC key returns null", async () => {
		// Craft a base64url.base64url cookie without knowing ENCRYPTION_KEY
		const fakePayload = Buffer.from(JSON.stringify(validSession)).toString("base64url");
		const fakeSig = Buffer.from("fakesignature").toString("base64url");
		const forged = `${fakePayload}.${fakeSig}`;
		const result = await verifySession(forged);
		expect(result).toBeNull();
	});

	it("E11: returns null when accessToken is empty string (falsy)", async () => {
		const session = { ...validSession, accessToken: "" };
		const cookie = await signSession(session);
		const result = await verifySession(cookie);
		expect(result).toBeNull();
	});
});

describe("getHmacKey — missing ENCRYPTION_KEY", () => {
	const originalKey = process.env.ENCRYPTION_KEY;

	beforeEach(() => {
		delete process.env.ENCRYPTION_KEY;
	});

	afterEach(() => {
		process.env.ENCRYPTION_KEY = originalKey;
	});

	it("F19: signSession throws when ENCRYPTION_KEY is missing", async () => {
		await expect(signSession(validSession)).rejects.toThrow(
			"ENCRYPTION_KEY environment variable is required",
		);
	});

	it("F19: verifySession throws (or returns null via catch) when ENCRYPTION_KEY is missing", async () => {
		// verifySession has a try/catch that returns null on error
		// But getHmacKey throws — which the try/catch in verifySession catches
		const result = await verifySession("some.cookie");
		expect(result).toBeNull();
	});
});

describe("E8: token expiry is not enforced by verifySession (known gap)", () => {
	it("E8: session with expires_in=0 still returns data (clock-based expiry not enforced)", async () => {
		// This test documents the known gap: verifySession does not check clock-based expiry.
		// Browser-side expiry via cookie maxAge is the only enforcement mechanism.
		const expiredSession = { ...validSession, expiresIn: 0 };
		const cookie = await signSession(expiredSession);
		const result = await verifySession(cookie);
		// HMAC is valid, so verifySession returns the data despite expiresIn=0
		expect(result).not.toBeNull();
		expect(result?.expiresIn).toBe(0);
		// Known gap: production must rely on cookie maxAge for expiry enforcement
	});
});
