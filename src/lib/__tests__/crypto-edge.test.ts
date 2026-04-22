/**
 * Unit tests for lib/crypto-edge.ts (Web Crypto API AES-GCM, used in Edge middleware).
 *
 * The edge crypto only exposes `decryptApiKey` (decrypt only — middleware is read-only).
 * To test the decrypt path, we first encrypt using the Node crypto lib (crypto.ts)
 * since they use the same ENCRYPTION_KEY + SHA-256-derived key format.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { encryptApiKey } from "../crypto";
import { decryptApiKey as decryptEdge } from "../crypto-edge";

describe("crypto-edge decryptApiKey", () => {
	it("returns empty string for empty input", async () => {
		expect(await decryptEdge("")).toBe("");
	});

	it("returns the value as-is when it does not match the encrypted format (plain text)", async () => {
		expect(await decryptEdge("plain-text")).toBe("plain-text");
		expect(await decryptEdge("only:two")).toBe("only:two");
		expect(await decryptEdge("four:parts:here:extra")).toBe("four:parts:here:extra");
	});

	it("decrypts a value encrypted with the Node crypto lib (same ENCRYPTION_KEY)", async () => {
		const plaintext = "edge-round-trip-value";
		const encrypted = encryptApiKey(plaintext);
		const decrypted = await decryptEdge(encrypted);
		expect(decrypted).toBe(plaintext);
	});

	it("returns the raw value when decryption throws (invalid cipher bytes)", async () => {
		const fake = "AAAA:BBBB:CCCC";
		const result = await decryptEdge(fake);
		// On decryption failure, the function returns the original value
		expect(result).toBe(fake);
	});
});

describe("crypto-edge missing ENCRYPTION_KEY", () => {
	const originalKey = process.env.ENCRYPTION_KEY;

	beforeEach(() => {
		delete process.env.ENCRYPTION_KEY;
	});

	afterEach(() => {
		process.env.ENCRYPTION_KEY = originalKey;
	});

	it("returns the raw value when ENCRYPTION_KEY is missing (throws caught internally)", async () => {
		const fake = "abc:def:ghi";
		const result = await decryptEdge(fake);
		expect(result).toBe(fake);
	});
});
