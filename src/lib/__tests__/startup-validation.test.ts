/**
 * Unit tests for startup-validation.ts (athena#99).
 *
 * Covers QA plan scenarios: F4 (missing key fatal), F5 (no fallback),
 * F6 (same-value warning), F7 (raw string comparison), F18 (empty string),
 * Security S5 (no ENCRYPTION_KEY fallback), DX-99-1 (actionable errors).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Re-import for each test to ensure fresh module state
const loadModule = async () => {
	// Clear module cache to get fresh import
	const mod = await import("../startup-validation");
	return mod;
};

describe("validateSessionSigningKey — missing key", () => {
	const originalKey = process.env.SESSION_SIGNING_KEY;

	beforeEach(() => {
		delete process.env.SESSION_SIGNING_KEY;
	});

	afterEach(() => {
		if (originalKey !== undefined) {
			process.env.SESSION_SIGNING_KEY = originalKey;
		}
	});

	it("F4: throws when SESSION_SIGNING_KEY is not set", async () => {
		const { validateSessionSigningKey } = await loadModule();
		expect(() => validateSessionSigningKey()).toThrow(
			"SESSION_SIGNING_KEY is required. Generate one with: openssl rand -base64 32",
		);
	});

	it("F18: throws when SESSION_SIGNING_KEY is empty string", async () => {
		process.env.SESSION_SIGNING_KEY = "";
		const { validateSessionSigningKey } = await loadModule();
		expect(() => validateSessionSigningKey()).toThrow(
			"SESSION_SIGNING_KEY is required",
		);
	});

	it("F18: throws when SESSION_SIGNING_KEY is whitespace only", async () => {
		process.env.SESSION_SIGNING_KEY = "   ";
		const { validateSessionSigningKey } = await loadModule();
		expect(() => validateSessionSigningKey()).toThrow(
			"SESSION_SIGNING_KEY is required",
		);
	});

	it("DX-99-1: error message includes fix command", async () => {
		const { validateSessionSigningKey } = await loadModule();
		expect(() => validateSessionSigningKey()).toThrow(
			"openssl rand -base64 32",
		);
	});

	it("F5/S5: does not fall back to ENCRYPTION_KEY", async () => {
		// ENCRYPTION_KEY is set in vitest.config.ts, but SESSION_SIGNING_KEY is unset.
		// The function must still throw — proving no fallback to ENCRYPTION_KEY.
		expect(process.env.ENCRYPTION_KEY).toBeTruthy();
		const { validateSessionSigningKey } = await loadModule();
		expect(() => validateSessionSigningKey()).toThrow(
			"SESSION_SIGNING_KEY is required",
		);
	});
});

describe("validateSessionSigningKey — same value as ENCRYPTION_KEY", () => {
	const originalSigningKey = process.env.SESSION_SIGNING_KEY;
	const originalEncryptionKey = process.env.ENCRYPTION_KEY;

	afterEach(() => {
		if (originalSigningKey !== undefined) {
			process.env.SESSION_SIGNING_KEY = originalSigningKey;
		}
		if (originalEncryptionKey !== undefined) {
			process.env.ENCRYPTION_KEY = originalEncryptionKey;
		}
	});

	it("F6: logs ERROR when SESSION_SIGNING_KEY === ENCRYPTION_KEY", async () => {
		const sameValue = "identical-key-value-for-testing-99";
		process.env.SESSION_SIGNING_KEY = sameValue;
		process.env.ENCRYPTION_KEY = sameValue;

		// Spy on console.error to capture logger output
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const { validateSessionSigningKey } = await loadModule();
		validateSessionSigningKey(); // Should not throw — just log

		// The logger.error() call goes through console.error
		const errorCalls = errorSpy.mock.calls.map((args) => args.join(" "));
		const hasSameKeyWarning = errorCalls.some(
			(msg) => msg.includes("same value") || msg.includes("key separation"),
		);
		expect(hasSameKeyWarning).toBe(true);

		errorSpy.mockRestore();
	});

	it("F7: same-value check uses raw string comparison (no transformation)", async () => {
		// Use keys that would be equal after some transformations (e.g. trim,
		// lowercase) but are NOT equal as raw strings.
		process.env.SESSION_SIGNING_KEY = "KeyValue123";
		process.env.ENCRYPTION_KEY = "keyvalue123"; // Different case

		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const { validateSessionSigningKey } = await loadModule();
		validateSessionSigningKey();

		// Should NOT log a warning because the raw strings are different
		const errorCalls = errorSpy.mock.calls.map((args) => args.join(" "));
		const hasSameKeyWarning = errorCalls.some(
			(msg) => msg.includes("same value") || msg.includes("key separation"),
		);
		expect(hasSameKeyWarning).toBe(false);

		errorSpy.mockRestore();
	});

	it("DX-99-1: same-value warning includes fix command", async () => {
		const sameValue = "identical-key-value-for-testing-99";
		process.env.SESSION_SIGNING_KEY = sameValue;
		process.env.ENCRYPTION_KEY = sameValue;

		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const { validateSessionSigningKey } = await loadModule();
		validateSessionSigningKey();

		const errorCalls = errorSpy.mock.calls.map((args) => args.join(" "));
		const hasFixCommand = errorCalls.some((msg) =>
			msg.includes("openssl rand -base64 32"),
		);
		expect(hasFixCommand).toBe(true);

		errorSpy.mockRestore();
	});
});

describe("validateSessionSigningKey — valid configuration", () => {
	it("does not throw when SESSION_SIGNING_KEY is set and different from ENCRYPTION_KEY", async () => {
		// Both keys are set in vitest.config.ts with different values
		const { validateSessionSigningKey } = await loadModule();
		expect(() => validateSessionSigningKey()).not.toThrow();
	});
});
