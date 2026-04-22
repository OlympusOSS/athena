/**
 * Unit tests for lib/crypto.ts (Node crypto AES-256-GCM).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptApiKey, encryptApiKey } from "../crypto";

describe("encryptApiKey / decryptApiKey round-trip", () => {
	it("returns an empty string for undefined input", () => {
		expect(encryptApiKey(undefined)).toBe("");
	});

	it("returns an empty string for empty string input on encrypt", () => {
		expect(encryptApiKey("")).toBe("");
	});

	it("returns an empty string for empty string input on decrypt", () => {
		expect(decryptApiKey("")).toBe("");
	});

	it("round-trips a plain value through encrypt/decrypt", () => {
		const value = "super-secret-api-key-value";
		const encrypted = encryptApiKey(value);
		// Format: iv:authTag:encryptedData
		const parts = encrypted.split(":");
		expect(parts.length).toBe(3);
		const decrypted = decryptApiKey(encrypted);
		expect(decrypted).toBe(value);
	});

	it("produces different ciphertext per call (random IV)", () => {
		const value = "same-value";
		const a = encryptApiKey(value);
		const b = encryptApiKey(value);
		expect(a).not.toBe(b);
		expect(decryptApiKey(a)).toBe(value);
		expect(decryptApiKey(b)).toBe(value);
	});

	it("returns values that do NOT match the encrypted format unchanged (backwards compatibility)", () => {
		expect(decryptApiKey("plain-text-value")).toBe("plain-text-value");
		expect(decryptApiKey("only:two-parts")).toBe("only:two-parts");
		expect(decryptApiKey("has:four:parts:here")).toBe("has:four:parts:here");
	});

	it("returns raw value when decryption fails (malformed cipher bytes)", () => {
		// Three parts so it looks encrypted, but bytes are garbage
		const tampered = "AAAA:BBBB:CCCC";
		const result = decryptApiKey(tampered);
		// On failure, the function returns the value as-is
		expect(result).toBe(tampered);
	});
});

describe("encryption key requirement", () => {
	const originalKey = process.env.ENCRYPTION_KEY;

	beforeEach(() => {
		delete process.env.ENCRYPTION_KEY;
	});

	afterEach(() => {
		process.env.ENCRYPTION_KEY = originalKey;
	});

	it("throws if ENCRYPTION_KEY is missing on encrypt", () => {
		expect(() => encryptApiKey("some-value")).toThrow(/ENCRYPTION_KEY/);
	});

	it("returns the raw value on decrypt when ENCRYPTION_KEY is missing", () => {
		// Create a value that looks encrypted, but without a key, getEncryptionKey throws.
		// The catch returns the value as-is.
		const fake = "abc:def:ghi";
		const result = decryptApiKey(fake);
		expect(result).toBe(fake);
	});
});
