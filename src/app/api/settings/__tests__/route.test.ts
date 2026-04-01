/**
 * Unit + integration tests for GET /api/settings and POST /api/settings
 *
 * Covers QA plan scenarios: F1, F2, F3, F4, F6, F7, F8, F9, F10, F11.
 * Edge cases: E1, E2, E10, E12, E13, E14.
 * Security tests: S1 (auth enforcement — verifies 401 without session via middleware).
 *
 * Strategy: mock @olympusoss/sdk to avoid DB calls.
 * Auth enforcement (S1–S4) is handled in middleware.test.ts.
 */

import type { Setting } from "@olympusoss/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../route";

// Mock the SDK
const mockListSettingsForDisplay = vi.fn();
const mockSetSetting = vi.fn();

vi.mock("@olympusoss/sdk", () => ({
	listSettingsForDisplay: mockListSettingsForDisplay,
	setSetting: mockSetSetting,
}));

function buildGetRequest(params: { category?: string } = {}): Request {
	const url = new URL("http://localhost:4001/api/settings");
	if (params.category !== undefined) {
		url.searchParams.set("category", params.category);
	}
	return new Request(url.toString());
}

function buildPostRequest(body: unknown): Request {
	return new Request("http://localhost:4001/api/settings", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

const sampleSettings: Setting[] = [
	{ key: "captcha.enabled", value: "true", encrypted: false, category: "captcha", updated_at: new Date() },
	{ key: "general.name", value: "Olympus", encrypted: false, category: "general", updated_at: new Date() },
	{
		key: "secret.key",
		value: "AAAAAAAA••••••••",
		encrypted: true,
		category: "auth",
		updated_at: new Date(),
	},
];

beforeEach(() => {
	vi.clearAllMocks();
});

describe("GET /api/settings", () => {
	it("F1: returns all settings as JSON array", async () => {
		mockListSettingsForDisplay.mockResolvedValue(sampleSettings);
		const req = buildGetRequest();
		const res = await GET(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.settings).toHaveLength(3);
	});

	it("F2: passes category filter to SDK", async () => {
		mockListSettingsForDisplay.mockResolvedValue([sampleSettings[0]]);
		const req = buildGetRequest({ category: "captcha" });
		const res = await GET(req);
		expect(res.status).toBe(200);
		expect(mockListSettingsForDisplay).toHaveBeenCalledWith("captcha");
		const body = await res.json();
		expect(body.settings).toHaveLength(1);
		expect(body.settings[0].key).toBe("captcha.enabled");
	});

	it("E2: empty category string is treated as undefined (all settings returned)", async () => {
		mockListSettingsForDisplay.mockResolvedValue(sampleSettings);
		const req = buildGetRequest({ category: "" });
		await GET(req);
		// Empty string is falsy — route passes undefined to SDK
		expect(mockListSettingsForDisplay).toHaveBeenCalledWith(undefined);
	});

	it("F3: encrypted values are masked in list response (not plaintext)", async () => {
		mockListSettingsForDisplay.mockResolvedValue(sampleSettings);
		const req = buildGetRequest();
		const res = await GET(req);
		const body = await res.json();
		const secret = body.settings.find((s: Setting) => s.key === "secret.key");
		// SDK already masks; we verify the value is not the original plaintext
		expect(secret.value).not.toBe("my-real-secret");
		expect(secret.value).toContain("••••••••");
	});

	it("E10: DB connection failure returns 500", async () => {
		mockListSettingsForDisplay.mockRejectedValue(new Error("connection refused"));
		const req = buildGetRequest();
		const res = await GET(req);
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.error).toBe("Failed to list settings");
	});

	it("E12: empty array from DB returns 200 with empty settings", async () => {
		mockListSettingsForDisplay.mockResolvedValue([]);
		const req = buildGetRequest();
		const res = await GET(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.settings).toHaveLength(0);
	});
});

describe("POST /api/settings — input validation", () => {
	it("F7: missing key returns 400", async () => {
		const req = buildPostRequest({ value: "test" });
		const res = await POST(req);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("key is required and must be a string");
	});

	it("F8: non-string key (number) returns 400", async () => {
		const req = buildPostRequest({ key: 123, value: "test" });
		const res = await POST(req);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("key is required and must be a string");
	});

	it("F9: missing value returns 400", async () => {
		const req = buildPostRequest({ key: "test.key" });
		const res = await POST(req);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("value is required");
	});

	it("F10: null value returns 400", async () => {
		const req = buildPostRequest({ key: "test.key", value: null });
		const res = await POST(req);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("value is required");
	});
});

describe("POST /api/settings — successful creation", () => {
	it("F4: creates unencrypted setting and returns success", async () => {
		mockSetSetting.mockResolvedValue(undefined);
		const req = buildPostRequest({ key: "foo.bar", value: "hello", encrypted: false, category: "general" });
		const res = await POST(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);
		expect(body.key).toBe("foo.bar");
		expect(mockSetSetting).toHaveBeenCalledWith("foo.bar", "hello", {
			encrypted: false,
			category: "general",
		});
	});

	it("F6: updates existing setting (upsert) with same key", async () => {
		mockSetSetting.mockResolvedValue(undefined);
		const req = buildPostRequest({ key: "foo.bar", value: "world" });
		const res = await POST(req);
		expect(res.status).toBe(200);
		expect(mockSetSetting).toHaveBeenCalledWith("foo.bar", "world", expect.any(Object));
	});

	it("F11: category defaults to general when omitted", async () => {
		mockSetSetting.mockResolvedValue(undefined);
		const req = buildPostRequest({ key: "test.key", value: "value" });
		await POST(req);
		expect(mockSetSetting).toHaveBeenCalledWith("test.key", "value", {
			encrypted: false,
			category: "general",
		});
	});

	it("F5: stores encrypted setting (encrypted=true passed to SDK)", async () => {
		mockSetSetting.mockResolvedValue(undefined);
		const req = buildPostRequest({ key: "secret.key", value: "my-secret", encrypted: true });
		const res = await POST(req);
		expect(res.status).toBe(200);
		expect(mockSetSetting).toHaveBeenCalledWith("secret.key", "my-secret", {
			encrypted: true,
			category: "general",
		});
	});

	it("E13: boolean value is coerced to string 'true'", async () => {
		mockSetSetting.mockResolvedValue(undefined);
		const req = buildPostRequest({ key: "test.key", value: true });
		const res = await POST(req);
		expect(res.status).toBe(200);
		expect(mockSetSetting).toHaveBeenCalledWith("test.key", "true", expect.any(Object));
	});

	it("E14: value=0 (falsy number) is accepted and coerced to '0'", async () => {
		mockSetSetting.mockResolvedValue(undefined);
		const req = buildPostRequest({ key: "test.key", value: 0 });
		const res = await POST(req);
		expect(res.status).toBe(200);
		expect(mockSetSetting).toHaveBeenCalledWith("test.key", "0", expect.any(Object));
	});
});

describe("POST /api/settings — error paths", () => {
	it("E1: non-JSON body returns 500 (request.json() throws)", async () => {
		const req = new Request("http://localhost:4001/api/settings", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "not-json",
		});
		const res = await POST(req);
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.error).toBe("Failed to save setting");
	});

	it("E10: SDK setSetting throws — returns 500", async () => {
		mockSetSetting.mockRejectedValue(new Error("DB connection refused"));
		const req = buildPostRequest({ key: "test.key", value: "value" });
		const res = await POST(req);
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.error).toBe("Failed to save setting");
	});
});
