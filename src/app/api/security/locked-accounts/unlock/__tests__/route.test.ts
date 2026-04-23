/**
 * Unit tests for POST /api/security/locked-accounts/unlock
 *
 * Covers:
 *   - 401 when x-user-id header is missing
 *   - 400 when body is invalid JSON
 *   - 400 when identifier is missing
 *   - 400 when identifier is non-string
 *   - 404 when unlockAccount returns false (no active lockout)
 *   - 200 when unlockAccount succeeds
 *   - 500 when unlockAccount throws
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildRequest } from "@/app/api/__tests__/helpers";
import { POST } from "../route";

const { mockUnlockAccount } = vi.hoisted(() => ({
	mockUnlockAccount: vi.fn(),
}));

vi.mock("@olympusoss/sdk", () => ({
	unlockAccount: mockUnlockAccount,
}));

beforeEach(() => {
	vi.clearAllMocks();
});

describe("POST /api/security/locked-accounts/unlock", () => {
	it("returns 401 when x-user-id header is absent", async () => {
		const req = buildRequest("POST", "http://localhost:4001/api/security/locked-accounts/unlock", {
			body: { identifier: "u@example.com" },
		});
		const res = await POST(req);
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.error).toBe("not_authenticated");
		expect(body.hint).toBe("Authenticate via /api/auth/login");
	});

	it("returns 400 when body is invalid JSON", async () => {
		const req = buildRequest("POST", "http://localhost:4001/api/security/locked-accounts/unlock", {
			body: "not-json",
			headers: { "x-user-id": "admin-1" },
		});
		const res = await POST(req);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Missing or invalid identifier");
	});

	it("returns 400 when identifier is missing", async () => {
		const req = buildRequest("POST", "http://localhost:4001/api/security/locked-accounts/unlock", {
			body: {},
			headers: { "x-user-id": "admin-1" },
		});
		const res = await POST(req);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Missing or invalid identifier");
	});

	it("returns 400 when identifier is non-string", async () => {
		const req = buildRequest("POST", "http://localhost:4001/api/security/locked-accounts/unlock", {
			body: { identifier: 123 },
			headers: { "x-user-id": "admin-1" },
		});
		const res = await POST(req);
		expect(res.status).toBe(400);
	});

	it("returns 404 when no active lockout is found", async () => {
		mockUnlockAccount.mockResolvedValue(false);
		const req = buildRequest("POST", "http://localhost:4001/api/security/locked-accounts/unlock", {
			body: { identifier: "u@example.com" },
			headers: { "x-user-id": "admin-1" },
		});
		const res = await POST(req);
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error).toBe("No active lockout found");
	});

	it("returns 200 on successful unlock and calls unlockAccount with admin id", async () => {
		mockUnlockAccount.mockResolvedValue(true);
		const req = buildRequest("POST", "http://localhost:4001/api/security/locked-accounts/unlock", {
			body: { identifier: "u@example.com" },
			headers: { "x-user-id": "admin-42" },
		});
		const res = await POST(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);
		expect(body.identifier).toBe("u@example.com");
		expect(mockUnlockAccount).toHaveBeenCalledWith("u@example.com", "admin-42");
	});

	it("returns 500 when unlockAccount throws", async () => {
		mockUnlockAccount.mockRejectedValue(new Error("db error"));
		const req = buildRequest("POST", "http://localhost:4001/api/security/locked-accounts/unlock", {
			body: { identifier: "u@example.com" },
			headers: { "x-user-id": "admin-1" },
		});
		const res = await POST(req);
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.error).toBe("Failed to unlock account");
	});
});
