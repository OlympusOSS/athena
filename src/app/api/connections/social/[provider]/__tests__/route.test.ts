/**
 * Unit tests for PATCH/DELETE /api/connections/social/[provider]
 *
 * Mocks @olympusoss/sdk + @/lib/social-connections.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildRequest } from "@/app/api/__tests__/helpers";
import { DELETE, PATCH } from "../route";

const { mockGetSetting, mockSetSetting, mockDeleteSetting } = vi.hoisted(() => ({
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

beforeEach(() => {
	vi.clearAllMocks();
	mockTriggerReload.mockResolvedValue({ status: "reloaded" });
});

const asContext = (provider: string) => ({ params: Promise.resolve({ provider }) });

describe("PATCH /api/connections/social/[provider]", () => {
	it("returns 400 for unknown provider slug", async () => {
		const req = buildRequest("PATCH", "http://localhost:4001/api/connections/social/bogus", {
			body: { enabled: true },
		});
		const res = await PATCH(req, asContext("bogus"));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toMatch(/unknown provider/);
	});

	it("returns 400 when body is invalid JSON", async () => {
		const req = new Request("http://localhost:4001/api/connections/social/google", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: "not-json",
		});
		const res = await PATCH(req, asContext("google"));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Invalid JSON body");
	});

	it("returns 400 when body is not an object", async () => {
		// JSON.stringify("string") -> '"string"' which parses back to a string primitive.
		// buildRequest would skip quoting because the body is already a string, so pass
		// a properly quoted JSON string here.
		const req = new Request("http://localhost:4001/api/connections/social/google", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: '"just-a-string"',
		});
		const res = await PATCH(req, asContext("google"));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Request body must be an object");
	});

	it("returns 400 when body is null", async () => {
		const req = new Request("http://localhost:4001/api/connections/social/google", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: "null",
		});
		const res = await PATCH(req, asContext("google"));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Request body must be an object");
	});

	it("returns 400 when enabled is not boolean", async () => {
		const req = buildRequest("PATCH", "http://localhost:4001/api/connections/social/google", {
			body: { enabled: "true" },
		});
		const res = await PATCH(req, asContext("google"));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toMatch(/enabled must be a boolean/);
	});

	it("returns 404 when provider not configured", async () => {
		mockGetSetting.mockResolvedValue(null);
		const req = buildRequest("PATCH", "http://localhost:4001/api/connections/social/google", {
			body: { enabled: true },
		});
		const res = await PATCH(req, asContext("google"));
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error).toBe("Provider not found: google");
	});

	it("toggles enabled=true and emits audit with 'enabled' action", async () => {
		mockGetSetting.mockResolvedValue("123.apps.googleusercontent.com");
		mockSetSetting.mockResolvedValue(undefined);
		const req = buildRequest("PATCH", "http://localhost:4001/api/connections/social/google", {
			body: { enabled: true },
			headers: { "x-user-id": "admin-1", "x-user-email": "admin@test.com" },
		});
		const res = await PATCH(req, asContext("google"));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);
		expect(body.provider).toBe("google");
		expect(body.enabled).toBe(true);
		expect(body.reloadStatus).toBe("reloaded");
		expect(mockSetSetting).toHaveBeenCalledWith("social.google.enabled", "true", { category: "social" });
		expect(mockAuditSocialConnection).toHaveBeenCalledWith("social_connection.enabled", "google", "admin-1", "admin@test.com", ["enabled"]);
		expect(mockTriggerReload).toHaveBeenCalledWith(false);
	});

	it("toggles enabled=false and emits audit with 'disabled' action", async () => {
		mockGetSetting.mockResolvedValue("client-id");
		const req = buildRequest("PATCH", "http://localhost:4001/api/connections/social/google", {
			body: { enabled: false },
		});
		const res = await PATCH(req, asContext("google"));
		expect(res.status).toBe(200);
		expect(mockAuditSocialConnection).toHaveBeenCalledWith("social_connection.disabled", "google", "unknown", "unknown", ["enabled"]);
	});

	it("returns 500 when setSetting throws", async () => {
		mockGetSetting.mockResolvedValue("client-id");
		mockSetSetting.mockRejectedValue(new Error("db down"));
		const req = buildRequest("PATCH", "http://localhost:4001/api/connections/social/google", {
			body: { enabled: true },
		});
		const res = await PATCH(req, asContext("google"));
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.error).toBe("Failed to update social connection");
	});

	it("returns 500 when error is a non-Error thrown value", async () => {
		mockGetSetting.mockResolvedValue("client-id");
		mockSetSetting.mockRejectedValue("string error");
		const req = buildRequest("PATCH", "http://localhost:4001/api/connections/social/google", {
			body: { enabled: true },
		});
		const res = await PATCH(req, asContext("google"));
		expect(res.status).toBe(500);
	});
});

describe("DELETE /api/connections/social/[provider]", () => {
	it("returns 400 for unknown provider slug", async () => {
		const req = buildRequest("DELETE", "http://localhost:4001/api/connections/social/bogus");
		const res = await DELETE(req, asContext("bogus"));
		expect(res.status).toBe(400);
	});

	it("returns 404 when provider not configured", async () => {
		mockGetSetting.mockResolvedValue(null);
		const req = buildRequest("DELETE", "http://localhost:4001/api/connections/social/google");
		const res = await DELETE(req, asContext("google"));
		expect(res.status).toBe(404);
	});

	it("deletes all keys and returns success", async () => {
		// First call: existingClientId. Second: connections_order.
		mockGetSetting.mockResolvedValueOnce("client-id").mockResolvedValueOnce(JSON.stringify(["google", "github"]));
		mockDeleteSetting.mockResolvedValue(undefined);
		mockSetSetting.mockResolvedValue(undefined);

		const req = buildRequest("DELETE", "http://localhost:4001/api/connections/social/google", {
			headers: { "x-user-id": "admin-1", "x-user-email": "admin@test.com" },
		});
		const res = await DELETE(req, asContext("google"));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);
		expect(body.provider).toBe("google");
		expect(body.reloadStatus).toBe("reloaded");

		// Deletion of all 6 keys
		expect(mockDeleteSetting).toHaveBeenCalledTimes(6);
		// connections_order updated with 'google' removed
		expect(mockSetSetting).toHaveBeenCalledWith("social.connections_order", JSON.stringify(["github"]), { category: "social" });
		expect(mockAuditSocialConnection).toHaveBeenCalledWith("social_connection.deleted", "google", "admin-1", "admin@test.com", ["all keys removed"]);
	});

	it("swallows deleteSetting errors silently (keys may not exist)", async () => {
		mockGetSetting.mockResolvedValueOnce("client-id").mockResolvedValueOnce(null);
		mockDeleteSetting.mockRejectedValue(new Error("not found"));
		const req = buildRequest("DELETE", "http://localhost:4001/api/connections/social/google");
		const res = await DELETE(req, asContext("google"));
		// Should not fail overall
		expect(res.status).toBe(200);
	});

	it("ignores malformed connections_order JSON gracefully", async () => {
		mockGetSetting.mockResolvedValueOnce("client-id").mockResolvedValueOnce("not-json");
		mockDeleteSetting.mockResolvedValue(undefined);
		const req = buildRequest("DELETE", "http://localhost:4001/api/connections/social/google");
		const res = await DELETE(req, asContext("google"));
		expect(res.status).toBe(200);
	});

	it("skips connections_order update when orderSetting is null", async () => {
		mockGetSetting.mockResolvedValueOnce("client-id").mockResolvedValueOnce(null);
		mockDeleteSetting.mockResolvedValue(undefined);
		const req = buildRequest("DELETE", "http://localhost:4001/api/connections/social/google");
		const res = await DELETE(req, asContext("google"));
		expect(res.status).toBe(200);
		// setSetting should not be called because orderSetting was null
		expect(mockSetSetting).not.toHaveBeenCalled();
	});

	it("returns 500 when triggerReload throws", async () => {
		mockGetSetting.mockResolvedValueOnce("client-id").mockResolvedValueOnce(null);
		mockDeleteSetting.mockResolvedValue(undefined);
		mockTriggerReload.mockRejectedValue(new Error("sidecar offline"));
		const req = buildRequest("DELETE", "http://localhost:4001/api/connections/social/google");
		const res = await DELETE(req, asContext("google"));
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.error).toBe("Failed to delete social connection");
	});

	it("returns 500 when error is non-Error", async () => {
		mockGetSetting.mockResolvedValueOnce("client-id").mockResolvedValueOnce(null);
		mockDeleteSetting.mockResolvedValue(undefined);
		mockTriggerReload.mockRejectedValue("string");
		const req = buildRequest("DELETE", "http://localhost:4001/api/connections/social/google");
		const res = await DELETE(req, asContext("google"));
		expect(res.status).toBe(500);
	});
});
