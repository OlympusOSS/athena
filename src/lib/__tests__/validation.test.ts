/**
 * Unit tests for lib/social-connections/validation.ts.
 * Covers the validateProvider, validateClientId, validateClientSecret,
 * validateScopes, and validateEnabled helpers.
 */

import { describe, expect, it } from "vitest";
import {
	ALLOWED_PROVIDERS,
	DEFAULT_SCOPES_BY_PROVIDER,
	DISPLAY_NAME_BY_PROVIDER,
	PROVIDER_ORDER,
	type SocialProvider,
	validateClientId,
	validateClientSecret,
	validateEnabled,
	validateProvider,
	validateScopes,
} from "../social-connections/validation";

describe("validateProvider", () => {
	it("returns valid=true for allowed provider 'google'", () => {
		expect(validateProvider("google")).toEqual({ valid: true });
	});

	it("rejects non-string values", () => {
		const r = validateProvider(123);
		expect(r.valid).toBe(false);
		expect(r.error).toMatch(/required/);
	});

	it("rejects null", () => {
		const r = validateProvider(null);
		expect(r.valid).toBe(false);
	});

	it("rejects empty / whitespace strings", () => {
		const a = validateProvider("");
		const b = validateProvider("   ");
		expect(a.valid).toBe(false);
		expect(b.valid).toBe(false);
	});

	it("rejects providers not on the allowlist", () => {
		const r = validateProvider("facebook");
		expect(r.valid).toBe(false);
		expect(r.error).toMatch(/unknown provider/);
	});
});

describe("validateClientId", () => {
	it("accepts valid client_id with alphanumerics + dots + hyphens + underscores + @", () => {
		expect(validateClientId("abc-123.x_y@host")).toEqual({ valid: true });
	});

	it("rejects non-string", () => {
		expect(validateClientId(42).valid).toBe(false);
		expect(validateClientId(undefined).valid).toBe(false);
	});

	it("rejects empty / whitespace", () => {
		expect(validateClientId("").valid).toBe(false);
		expect(validateClientId("   ").valid).toBe(false);
	});

	it("rejects > 512 characters", () => {
		const long = "a".repeat(513);
		const r = validateClientId(long);
		expect(r.valid).toBe(false);
		expect(r.error).toMatch(/512/);
	});

	it("rejects strings with invalid characters", () => {
		const r = validateClientId("bad char");
		expect(r.valid).toBe(false);
		expect(r.error).toMatch(/invalid characters/);
	});
});

describe("validateClientSecret", () => {
	it("accepts non-empty string", () => {
		expect(validateClientSecret("s3cr3t!")).toEqual({ valid: true });
	});

	it("rejects non-string / empty / whitespace", () => {
		expect(validateClientSecret(null).valid).toBe(false);
		expect(validateClientSecret("").valid).toBe(false);
		expect(validateClientSecret("   ").valid).toBe(false);
	});

	it("rejects > 4096 characters", () => {
		const r = validateClientSecret("x".repeat(4097));
		expect(r.valid).toBe(false);
		expect(r.error).toMatch(/4096/);
	});
});

describe("validateScopes", () => {
	it("accepts allowed subset for provider", () => {
		expect(validateScopes(["openid", "email"], "google")).toEqual({ valid: true });
	});

	it("rejects non-array", () => {
		expect(validateScopes("openid", "google").valid).toBe(false);
	});

	it("rejects empty array", () => {
		expect(validateScopes([], "google").valid).toBe(false);
	});

	it("rejects array containing non-strings", () => {
		const r = validateScopes(["openid", 42], "google");
		expect(r.valid).toBe(false);
		expect(r.error).toMatch(/invalid scope/);
	});

	it("rejects array containing not-allowed scopes", () => {
		const r = validateScopes(["openid", "admin"], "google" as SocialProvider);
		expect(r.valid).toBe(false);
		expect(r.error).toMatch(/admin/);
	});
});

describe("validateEnabled", () => {
	it("accepts true", () => {
		expect(validateEnabled(true)).toEqual({ valid: true });
	});

	it("accepts false", () => {
		expect(validateEnabled(false)).toEqual({ valid: true });
	});

	it("rejects non-boolean", () => {
		expect(validateEnabled("true").valid).toBe(false);
		expect(validateEnabled(1).valid).toBe(false);
		expect(validateEnabled(null).valid).toBe(false);
		expect(validateEnabled(undefined).valid).toBe(false);
	});
});

describe("exported constants", () => {
	it("ALLOWED_PROVIDERS contains google (V1)", () => {
		expect(ALLOWED_PROVIDERS).toContain("google");
	});

	it("DEFAULT_SCOPES_BY_PROVIDER.google matches the expected shape", () => {
		expect(DEFAULT_SCOPES_BY_PROVIDER.google).toEqual(expect.arrayContaining(["openid", "email", "profile"]));
	});

	it("DISPLAY_NAME_BY_PROVIDER.google = 'Google'", () => {
		expect(DISPLAY_NAME_BY_PROVIDER.google).toBe("Google");
	});

	it("PROVIDER_ORDER starts with 'google' (V1)", () => {
		expect(PROVIDER_ORDER[0]).toBe("google");
	});
});
