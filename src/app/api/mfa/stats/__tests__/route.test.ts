/**
 * Unit tests for GET /api/mfa/stats
 *
 * Mocks @/services/kratos/endpoints/identities.listIdentities to avoid Kratos
 * admin calls. Covers:
 *   - Zero identities
 *   - Identities without TOTP credentials
 *   - Identities with TOTP credentials (enrolled)
 *   - Multi-page pagination (Link header string + array forms)
 *   - Kratos throwing => available=false fallback
 *   - Missing headers => parse returns null next => loop exits
 *   - MAX_PAGES cap
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";

const { mockListIdentities } = vi.hoisted(() => ({
	mockListIdentities: vi.fn(),
}));

vi.mock("@/services/kratos/endpoints/identities", () => ({
	listIdentities: mockListIdentities,
}));

beforeEach(() => {
	vi.clearAllMocks();
});

function identity(hasTotp: boolean) {
	return hasTotp ? { credentials: { totp: { type: "totp" } } } : { credentials: { password: {} } };
}

describe("GET /api/mfa/stats", () => {
	it("returns available=true with zero enrolled when no identities exist", async () => {
		mockListIdentities.mockResolvedValue({ data: [], headers: {} });
		const res = await GET();
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ available: true, enrolled: 0, total: 0, rate: 0 });
	});

	it("counts enrolled identities with TOTP credentials", async () => {
		mockListIdentities.mockResolvedValue({
			data: [identity(true), identity(false), identity(true), identity(false)],
			headers: {},
		});
		const res = await GET();
		const body = await res.json();
		expect(body).toEqual({ available: true, enrolled: 2, total: 4, rate: 0.5 });
	});

	it("paginates using Link header (string form)", async () => {
		mockListIdentities
			.mockResolvedValueOnce({
				data: [identity(true)],
				headers: { link: '</admin/identities?page_token=next-token>; rel="next"' },
			})
			.mockResolvedValueOnce({
				data: [identity(false)],
				headers: {},
			});
		const res = await GET();
		const body = await res.json();
		expect(body.total).toBe(2);
		expect(body.enrolled).toBe(1);
		expect(mockListIdentities).toHaveBeenCalledTimes(2);
	});

	it("paginates using Link header (array form)", async () => {
		mockListIdentities
			.mockResolvedValueOnce({
				data: [identity(true)],
				headers: { link: ['</admin/identities?page_token=next-token>; rel="next"'] },
			})
			.mockResolvedValueOnce({
				data: [identity(true)],
				headers: {},
			});
		const res = await GET();
		const body = await res.json();
		expect(body.total).toBe(2);
		expect(body.enrolled).toBe(2);
	});

	it("treats missing headers as end of pagination", async () => {
		mockListIdentities.mockResolvedValue({ data: [identity(true)], headers: undefined });
		const res = await GET();
		const body = await res.json();
		expect(body.total).toBe(1);
	});

	it("skips credentials check when creds is undefined on identity", async () => {
		mockListIdentities.mockResolvedValue({
			data: [{ credentials: undefined }, { credentials: null }],
			headers: {},
		});
		const res = await GET();
		const body = await res.json();
		expect(body.enrolled).toBe(0);
		expect(body.total).toBe(2);
	});

	it("returns non-array data as zero identities", async () => {
		mockListIdentities.mockResolvedValue({ data: "not-an-array", headers: {} });
		const res = await GET();
		const body = await res.json();
		expect(body.total).toBe(0);
	});

	it("returns available=false when listIdentities throws", async () => {
		mockListIdentities.mockRejectedValue(new Error("kratos unreachable"));
		const res = await GET();
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ available: false, enrolled: 0, total: 0, rate: 0 });
	});

	it("stops pagination at MAX_PAGES cap", async () => {
		// Always return a next-token so loop runs until the cap
		mockListIdentities.mockResolvedValue({
			data: [identity(true)],
			headers: { link: '</admin/identities?page_token=abc>; rel="next"' },
		});
		const res = await GET();
		expect(res.status).toBe(200);
		// MAX_PAGES=20 => should have been called exactly 20 times
		expect(mockListIdentities).toHaveBeenCalledTimes(20);
	});

	it("handles non-string, non-array Link header values", async () => {
		// e.g. a number would be coerced to null
		mockListIdentities.mockResolvedValueOnce({
			data: [identity(false)],
			headers: { link: 42 as unknown as string },
		});
		const res = await GET();
		const body = await res.json();
		expect(body.total).toBe(1);
	});
});
