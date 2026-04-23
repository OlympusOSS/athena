/**
 * Unit tests for GET /api/security/locked-accounts
 *
 * Mocks @olympusoss/sdk.listLockedAccounts. Covers:
 *   - Normal case: all accounts returned
 *   - Truncation at HARD_CAP (500)
 *   - SDK throws => 500 error
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";

const { mockListLockedAccounts } = vi.hoisted(() => ({
	mockListLockedAccounts: vi.fn(),
}));

vi.mock("@olympusoss/sdk", () => ({
	listLockedAccounts: mockListLockedAccounts,
}));

beforeEach(() => {
	vi.clearAllMocks();
});

describe("GET /api/security/locked-accounts", () => {
	it("returns all locked accounts when under HARD_CAP", async () => {
		const accounts = [
			{ id: 1, identifier: "a@example.com" },
			{ id: 2, identifier: "b@example.com" },
		];
		mockListLockedAccounts.mockResolvedValue(accounts);
		const res = await GET(new Request("http://localhost:4001/api/security/locked-accounts"));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data).toEqual(accounts);
		expect(body.total).toBe(2);
		expect(body.truncated).toBe(false);
	});

	it("truncates result to HARD_CAP and flags truncated=true when over", async () => {
		const many = Array.from({ length: 600 }, (_, i) => ({ id: i, identifier: `u${i}@example.com` }));
		mockListLockedAccounts.mockResolvedValue(many);
		const res = await GET(new Request("http://localhost:4001/api/security/locked-accounts"));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data).toHaveLength(500);
		expect(body.total).toBe(500);
		expect(body.truncated).toBe(true);
	});

	it("returns 500 when listLockedAccounts throws", async () => {
		mockListLockedAccounts.mockRejectedValue(new Error("DB offline"));
		const res = await GET(new Request("http://localhost:4001/api/security/locked-accounts"));
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.error).toBe("Failed to list locked accounts");
	});
});
