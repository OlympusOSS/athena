/**
 * Unit + integration tests for GET /api/settings/:key and DELETE /api/settings/:key
 *
 * Covers QA plan scenarios: F12, F13, F14, F15, F16, F17, F18.
 * Edge cases: E7, E8.
 * Bug fix: athena#58 — response now includes `encrypted: boolean` field.
 *
 * Strategy: mock @olympusoss/sdk to avoid DB calls.
 */

import type { Setting } from "@olympusoss/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET } from "../[key]/route";

// use vi.hoisted() so variables are available in the hoisted vi.mock factory
const { mockListSettings, mockGetSecretSetting, mockDeleteSetting } = vi.hoisted(() => ({
	mockListSettings: vi.fn(),
	mockGetSecretSetting: vi.fn(),
	mockDeleteSetting: vi.fn(),
}));

vi.mock("@olympusoss/sdk", () => ({
	listSettings: mockListSettings,
	getSecretSetting: mockGetSecretSetting,
	deleteSetting: mockDeleteSetting,
}));

function buildGetRequest(key: string, params: { decrypt?: boolean } = {}): [Request, { params: Promise<{ key: string }> }] {
	const url = new URL(`http://localhost:4001/api/settings/${encodeURIComponent(key)}`);
	if (params.decrypt) url.searchParams.set("decrypt", "true");
	return [new Request(url.toString()), { params: Promise.resolve({ key }) }];
}

function buildDeleteRequest(key: string): [Request, { params: Promise<{ key: string }> }] {
	return [new Request(`http://localhost:4001/api/settings/${encodeURIComponent(key)}`, { method: "DELETE" }), { params: Promise.resolve({ key }) }];
}

const unencryptedSetting: Setting = {
	key: "foo.bar",
	value: "hello",
	encrypted: false,
	category: "general",
	updated_at: new Date(),
};

const encryptedSetting: Setting = {
	key: "secret.key",
	value: "CIPHERTEXT_VALUE_HERE",
	encrypted: true,
	category: "auth",
	updated_at: new Date(),
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("GET /api/settings/:key — basic fetch", () => {
	it("F12: returns single setting by key with encrypted field (athena#58 fix)", async () => {
		mockListSettings.mockResolvedValue([unencryptedSetting]);
		const [req, ctx] = buildGetRequest("foo.bar");
		const res = await GET(req, ctx);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.key).toBe("foo.bar");
		expect(body.value).toBe("hello");
		expect(body.encrypted).toBe(false);
	});

	it("athena#58: response includes encrypted=true for encrypted settings", async () => {
		mockListSettings.mockResolvedValue([encryptedSetting]);
		const [req, ctx] = buildGetRequest("secret.key");
		const res = await GET(req, ctx);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.encrypted).toBe(true);
	});

	it("F13: returns 404 when key not found", async () => {
		mockListSettings.mockResolvedValue([]);
		const [req, ctx] = buildGetRequest("nonexistent");
		const res = await GET(req, ctx);
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error).toBe("Setting not found");
	});
});

describe("GET /api/settings/:key?decrypt=true", () => {
	it("F14: without ?decrypt=true, encrypted setting returns ciphertext (not plaintext)", async () => {
		mockListSettings.mockResolvedValue([encryptedSetting]);
		const [req, ctx] = buildGetRequest("secret.key"); // no decrypt param
		const res = await GET(req, ctx);
		expect(res.status).toBe(200);
		const body = await res.json();
		// Should return raw ciphertext, not decrypted value
		expect(body.value).toBe("CIPHERTEXT_VALUE_HERE");
		// getSecretSetting should NOT have been called
		expect(mockGetSecretSetting).not.toHaveBeenCalled();
	});

	it("F15: with ?decrypt=true on encrypted setting, calls getSecretSetting", async () => {
		mockListSettings.mockResolvedValue([encryptedSetting]);
		mockGetSecretSetting.mockResolvedValue("my-secret");
		const [req, ctx] = buildGetRequest("secret.key", { decrypt: true });
		const res = await GET(req, ctx);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.value).toBe("my-secret");
		expect(mockGetSecretSetting).toHaveBeenCalledWith("secret.key");
	});

	it("F16: with ?decrypt=true on non-encrypted setting, returns raw value (passthrough)", async () => {
		mockListSettings.mockResolvedValue([unencryptedSetting]);
		const [req, ctx] = buildGetRequest("foo.bar", { decrypt: true });
		const res = await GET(req, ctx);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.value).toBe("hello");
		// getSecretSetting should NOT be called when encrypted=false
		expect(mockGetSecretSetting).not.toHaveBeenCalled();
	});

	it("E8: corrupted ciphertext — getSecretSetting returns null — route returns 404", async () => {
		mockListSettings.mockResolvedValue([encryptedSetting]);
		mockGetSecretSetting.mockResolvedValue(null); // decrypt failed
		const [req, ctx] = buildGetRequest("secret.key", { decrypt: true });
		const res = await GET(req, ctx);
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error).toBe("Setting not found");
	});

	it("E7: decrypt=true on non-encrypted value returns raw value without decryption call", async () => {
		// Same as F16 — explicit test for the passthrough path
		const setting: Setting = { key: "plain", value: "rawvalue", encrypted: false, category: "general", updated_at: new Date() };
		mockListSettings.mockResolvedValue([setting]);
		const [req, ctx] = buildGetRequest("plain", { decrypt: true });
		const res = await GET(req, ctx);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.value).toBe("rawvalue");
		expect(mockGetSecretSetting).not.toHaveBeenCalled();
	});
});

describe("DELETE /api/settings/:key", () => {
	it("F17: deletes existing setting — returns success with key", async () => {
		mockDeleteSetting.mockResolvedValue(undefined);
		const [req, ctx] = buildDeleteRequest("foo.bar");
		const res = await DELETE(req, ctx);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);
		expect(body.key).toBe("foo.bar");
		expect(mockDeleteSetting).toHaveBeenCalledWith("foo.bar");
	});

	it("F18: deleting non-existent key returns success (idempotent)", async () => {
		// SDK's deleteSetting does not throw on missing key
		mockDeleteSetting.mockResolvedValue(undefined);
		const [req, ctx] = buildDeleteRequest("nonexistent");
		const res = await DELETE(req, ctx);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);
	});

	it("DELETE error path — SDK throws — returns 500", async () => {
		mockDeleteSetting.mockRejectedValue(new Error("DB error"));
		const [req, ctx] = buildDeleteRequest("foo.bar");
		const res = await DELETE(req, ctx);
		expect(res.status).toBe(500);
	});

	it("GET error path — listSettings throws — returns 500", async () => {
		mockListSettings.mockRejectedValue(new Error("DB connection refused"));
		const [req, ctx] = buildGetRequest("foo.bar");
		const res = await GET(req, ctx);
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.error).toBe("Failed to get setting");
	});
});
