/**
 * Unit + integration tests for social connection API routes (athena#49)
 *
 * Covers QA plan scenarios: F11, F12, F13, F14, F16, F25, F26, F27, F28
 * Edge cases: E5, E6, E7, E8, E13, E17
 * Security tests: S1, S5 (input validation)
 *
 * Strategy: mock @olympusoss/sdk and reload-client to avoid DB/network calls.
 * Auth enforcement (F4, F5, S1, S2) is handled by middleware (middleware.test.ts).
 *
 * Test suite covers:
 * - validateProvider: allowlist rejection, unknown slug, empty string
 * - validateClientId: empty, over-length, invalid chars
 * - validateClientSecret: empty, over-length
 * - validateScopes: invalid scope values
 * - maskSecret: strips plaintext, replaces with masked constant
 * - toPublicConnection: omits client_id, client_secret, scopes
 * - POST route: validation errors, SDK calls, secretChanged flag, reloadStatus
 * - GET public route: enabled providers only, response normalization (V9)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { MASKED_SECRET, maskSecret, toPublicConnection } from "@/lib/social-connections/serializers";
// --- Validation module tests ---
import { ALLOWED_PROVIDERS, validateClientId, validateClientSecret, validateProvider, validateScopes } from "@/lib/social-connections/validation";

describe("validateProvider", () => {
	it("accepts allowed providers", () => {
		for (const provider of ALLOWED_PROVIDERS) {
			expect(validateProvider(provider).valid).toBe(true);
		}
	});

	it("rejects unknown provider slug (E5)", () => {
		const result = validateProvider("invalidprovider");
		expect(result.valid).toBe(false);
		expect(result.error).toMatch(/unknown provider/);
	});

	it("rejects path traversal attempt (E5)", () => {
		expect(validateProvider("../admin").valid).toBe(false);
		expect(validateProvider("'; DROP TABLE--").valid).toBe(false);
	});

	it("rejects empty string", () => {
		expect(validateProvider("").valid).toBe(false);
		expect(validateProvider(null).valid).toBe(false);
		expect(validateProvider(undefined).valid).toBe(false);
	});
});

describe("validateClientId", () => {
	it("accepts valid client IDs", () => {
		expect(validateClientId("123456789-abc.apps.googleusercontent.com").valid).toBe(true);
		expect(validateClientId("client-id_123.test@domain.com").valid).toBe(true);
	});

	it("rejects empty client_id (F11)", () => {
		const result = validateClientId("");
		expect(result.valid).toBe(false);
		expect(result.error).toMatch(/required/);
	});

	it("rejects client_id over 512 chars (E6)", () => {
		const longId = "a".repeat(513);
		const result = validateClientId(longId);
		expect(result.valid).toBe(false);
		expect(result.error).toMatch(/512/);
	});

	it("rejects client_id with invalid characters", () => {
		expect(validateClientId("client<script>id").valid).toBe(false);
		expect(validateClientId("client id with space").valid).toBe(false);
	});
});

describe("validateClientSecret", () => {
	it("accepts valid secrets", () => {
		expect(validateClientSecret("GOCSPX-abcdefgh1234567890").valid).toBe(true);
		expect(validateClientSecret("a".repeat(4096)).valid).toBe(true);
	});

	it("rejects empty secret (F12)", () => {
		const result = validateClientSecret("");
		expect(result.valid).toBe(false);
		expect(result.error).toMatch(/required/);
	});

	it("rejects secret over 4096 chars (E7)", () => {
		const longSecret = "a".repeat(4097);
		const result = validateClientSecret(longSecret);
		expect(result.valid).toBe(false);
		expect(result.error).toMatch(/4096/);
	});
});

describe("validateScopes", () => {
	it("accepts valid Google scopes", () => {
		expect(validateScopes(["openid", "email", "profile"], "google").valid).toBe(true);
	});

	it("rejects invalid scope values (E8)", () => {
		const result = validateScopes(["openid", "email", "profile", "admin"], "google");
		expect(result.valid).toBe(false);
		expect(result.error).toMatch(/invalid scope/);
	});

	it("rejects empty scopes array", () => {
		expect(validateScopes([], "google").valid).toBe(false);
	});

	it("rejects non-array input", () => {
		expect(validateScopes("openid", "google").valid).toBe(false);
		expect(validateScopes(null, "google").valid).toBe(false);
	});
});

// --- Serializer tests ---

describe("maskSecret", () => {
	it("replaces client_secret with masked constant (F14)", () => {
		const raw = {
			provider: "google",
			display_name: "Google",
			enabled: true,
			client_id: "123.apps.googleusercontent.com",
			client_secret: "GOCSPX-plaintext",
			scopes: ["openid", "email", "profile"],
			order: 1,
		};

		const masked = maskSecret(raw);
		expect(masked.client_secret).toBe(MASKED_SECRET);
		// Ensure plaintext is gone
		expect(JSON.stringify(masked)).not.toContain("GOCSPX-plaintext");
	});

	it("works when client_secret is undefined", () => {
		const raw = {
			provider: "google",
			display_name: "Google",
			enabled: true,
			client_id: "123.apps.googleusercontent.com",
			scopes: ["openid"],
			order: 1,
		};
		const masked = maskSecret(raw);
		expect(masked.client_secret).toBe(MASKED_SECRET);
	});
});

describe("toPublicConnection", () => {
	it("returns only provider, display_name, enabled (F26)", () => {
		const result = toPublicConnection({
			provider: "google",
			display_name: "Google",
			enabled: true,
		});

		expect(result).toEqual({ provider: "google", display_name: "Google", enabled: true });
		// Verify client_id and scopes are absent
		expect("client_id" in result).toBe(false);
		expect("scopes" in result).toBe(false);
		expect("client_secret" in result).toBe(false);
	});
});

// --- Route-level tests (mocked SDK) ---

const { mockListSettings, mockGetSetting, mockSetSetting, mockDeleteSetting } = vi.hoisted(() => ({
	mockListSettings: vi.fn(),
	mockGetSetting: vi.fn(),
	mockSetSetting: vi.fn(),
	mockDeleteSetting: vi.fn(),
}));

const { mockTriggerReload } = vi.hoisted(() => ({
	mockTriggerReload: vi.fn(),
}));

const { mockAuditSocialConnection } = vi.hoisted(() => ({
	mockAuditSocialConnection: vi.fn(),
}));

vi.mock("@olympusoss/sdk", () => ({
	listSettings: mockListSettings,
	getSetting: mockGetSetting,
	setSetting: mockSetSetting,
	deleteSetting: mockDeleteSetting,
}));

vi.mock("@/lib/social-connections/reload-client", () => ({
	triggerReload: mockTriggerReload,
}));

vi.mock("@/lib/social-connections/audit", () => ({
	auditSocialConnection: mockAuditSocialConnection,
}));

import { GET as PublicGET } from "../../public/route";
// Import routes after mocks are set up
import { GET, POST } from "../route";

function buildAdminRequest(method: string, body?: unknown): Request {
	const req = new Request("http://localhost:3001/api/connections/social", {
		method,
		headers: {
			"Content-Type": "application/json",
			"x-user-id": "test-admin-id",
			"x-user-email": "admin@test.com",
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	return req;
}

describe("GET /api/connections/social", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockListSettings.mockResolvedValue([]);
		mockGetSetting.mockResolvedValue(null);
	});

	it("returns empty connections when nothing configured", async () => {
		const req = buildAdminRequest("GET");
		const res = await GET(req);
		const json = await res.json();

		expect(res.status).toBe(200);
		expect(json.connections).toEqual([]);
	});

	it("masks client_secret in response (F14 / V3)", async () => {
		mockListSettings.mockResolvedValue([
			{ key: "social.google.client_id", value: "123.apps.googleusercontent.com", encrypted: false, category: "social", updated_at: new Date() },
			{ key: "social.google.enabled", value: "true", encrypted: false, category: "social", updated_at: new Date() },
			{ key: "social.google.scopes", value: "openid,email,profile", encrypted: false, category: "social", updated_at: new Date() },
			{ key: "social.google.display_name", value: "Google", encrypted: false, category: "social", updated_at: new Date() },
			// Note: client_secret is encrypted in DB, listSettings returns raw value
			{ key: "social.google.client_secret", value: "encrypted:abc123", encrypted: true, category: "social", updated_at: new Date() },
		]);

		const req = buildAdminRequest("GET");
		const res = await GET(req);
		const json = await res.json();

		expect(res.status).toBe(200);
		expect(json.connections).toHaveLength(1);
		expect(json.connections[0].client_secret).toBe(MASKED_SECRET);
		// Confirm no plaintext or ciphertext leaks
		expect(JSON.stringify(json)).not.toContain("encrypted:abc123");
	});
});

describe("POST /api/connections/social", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetSetting.mockResolvedValue(null); // Not yet configured = create
		mockSetSetting.mockResolvedValue(undefined);
		// Mirror actual reload-client: skip reload when secret changed, reload otherwise
		mockTriggerReload.mockImplementation(async (secretChanged: boolean) => ({ status: secretChanged ? "skipped" : "reloaded" }));
		mockAuditSocialConnection.mockImplementation(() => {});
	});

	it("rejects unknown provider (E5)", async () => {
		const req = buildAdminRequest("POST", {
			provider: "invalidprovider",
			client_id: "123",
			client_secret: "secret",
			enabled: true,
		});

		const res = await POST(req);
		expect(res.status).toBe(400);
		const json = await res.json();
		expect(json.error).toMatch(/unknown provider/);
	});

	it("rejects empty client_id (F11)", async () => {
		const req = buildAdminRequest("POST", {
			provider: "google",
			client_id: "",
			client_secret: "secret",
			enabled: true,
		});

		const res = await POST(req);
		expect(res.status).toBe(400);
		const json = await res.json();
		expect(json.error).toMatch(/client_id/);
	});

	it("rejects empty client_secret on create (F12)", async () => {
		const req = buildAdminRequest("POST", {
			provider: "google",
			client_id: "123.apps.googleusercontent.com",
			client_secret: "",
			enabled: true,
		});

		const res = await POST(req);
		expect(res.status).toBe(400);
		const json = await res.json();
		expect(json.error).toMatch(/client_secret/);
	});

	it("calls setSetting with encrypted=true for client_secret (F13)", async () => {
		const req = buildAdminRequest("POST", {
			provider: "google",
			client_id: "123.apps.googleusercontent.com",
			client_secret: "GOCSPX-verysecret",
			enabled: true,
		});

		const res = await POST(req);
		expect(res.status).toBe(200);

		// Verify encrypted=true was used for the secret
		const secretCall = mockSetSetting.mock.calls.find(
			([key, , opts]: [string, string, { encrypted?: boolean }]) => key === "social.google.client_secret" && opts?.encrypted === true,
		);
		expect(secretCall).toBeDefined();
	});

	it("returns secretChanged=true and reloadStatus='skipped' when secret provided (F16)", async () => {
		const req = buildAdminRequest("POST", {
			provider: "google",
			client_id: "123.apps.googleusercontent.com",
			client_secret: "new-secret-value",
			enabled: true,
		});

		const res = await POST(req);
		const json = await res.json();

		expect(res.status).toBe(200);
		expect(json.secretChanged).toBe(true);
		expect(json.reloadStatus).toBe("skipped"); // Exact string match (QA F16)
		// triggerReload should be called with secretChanged=true, which returns "skipped"
		expect(mockTriggerReload).toHaveBeenCalledWith(true);
	});

	it("calls sidecar reload when no secret change", async () => {
		// Simulate existing connection (update, not create)
		mockGetSetting.mockResolvedValue("123.apps.googleusercontent.com");
		mockTriggerReload.mockResolvedValue({ status: "reloaded" });

		const req = buildAdminRequest("POST", {
			provider: "google",
			client_id: "123.apps.googleusercontent.com",
			client_secret: "", // blank = no change on edit
			enabled: false,
		});

		const res = await POST(req);
		const json = await res.json();

		expect(res.status).toBe(200);
		expect(json.secretChanged).toBe(false);
		expect(json.reloadStatus).toBe("reloaded");
		expect(mockTriggerReload).toHaveBeenCalledWith(false);
	});

	it("rejects invalid scope values (E8)", async () => {
		const req = buildAdminRequest("POST", {
			provider: "google",
			client_id: "123.apps.googleusercontent.com",
			client_secret: "secret",
			scopes: ["openid", "admin"], // "admin" is not in the allowlist
			enabled: true,
		});

		const res = await POST(req);
		expect(res.status).toBe(400);
		const json = await res.json();
		expect(json.error).toMatch(/invalid scope/);
	});
});

describe("GET /api/connections/public", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockListSettings.mockResolvedValue([]);
	});

	it("returns empty array when no providers configured (F27)", async () => {
		const req = new Request("http://localhost:3001/api/connections/public");
		const res = await PublicGET(req);
		const json = await res.json();

		expect(res.status).toBe(200);
		expect(Array.isArray(json)).toBe(true);
		expect(json).toHaveLength(0);
	});

	it("returns only enabled providers (F25)", async () => {
		mockListSettings.mockResolvedValue([
			{ key: "social.google.client_id", value: "123.apps.googleusercontent.com", encrypted: false, category: "social", updated_at: new Date() },
			{ key: "social.google.enabled", value: "true", encrypted: false, category: "social", updated_at: new Date() },
			{ key: "social.google.display_name", value: "Google", encrypted: false, category: "social", updated_at: new Date() },
		]);

		const req = new Request("http://localhost:3001/api/connections/public");
		const res = await PublicGET(req);
		const json = await res.json();

		expect(res.status).toBe(200);
		expect(json).toHaveLength(1);
		expect(json[0].provider).toBe("google");
		expect(json[0].display_name).toBe("Google");
		expect(json[0].enabled).toBe(true);
		// V9: no credentials in public response (F26)
		expect("client_id" in json[0]).toBe(false);
		expect("client_secret" in json[0]).toBe(false);
		expect("scopes" in json[0]).toBe(false);
	});

	it("returns empty array when provider is disabled (F28 / E13 / V9)", async () => {
		// V9: configured-but-disabled must return same response as not-configured
		mockListSettings.mockResolvedValue([
			{ key: "social.google.client_id", value: "123.apps.googleusercontent.com", encrypted: false, category: "social", updated_at: new Date() },
			{ key: "social.google.enabled", value: "false", encrypted: false, category: "social", updated_at: new Date() },
			{ key: "social.google.display_name", value: "Google", encrypted: false, category: "social", updated_at: new Date() },
		]);

		const req = new Request("http://localhost:3001/api/connections/public");
		const res = await PublicGET(req);
		const json = await res.json();

		expect(res.status).toBe(200);
		// Identical response to unconfigured (F27) — provider absent from array
		expect(json).toHaveLength(0);
	});
});
