/**
 * Unit + integration tests for POST /api/settings/batch
 *
 * Covers QA FAIL-3 requirements:
 *   - Valid batch request succeeds
 *   - Batch with >20 entries returns 400
 *   - Unauthenticated request returns 401 (via middleware — tested via auth-enforcement.test.ts pattern)
 *   - Invalid entry shape returns 400
 *
 * Auth enforcement (401) is tested through the middleware directly using the
 * existing auth-enforcement.test.ts pattern. The route handler itself never
 * sees unauthenticated requests in production because the middleware blocks them.
 * To exercise that path here we import the middleware and simulate a missing cookie.
 *
 * Strategy: mock @olympusoss/sdk to avoid DB calls.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../batch/route";

// Mock the SDK — use vi.hoisted() so variables are available in the hoisted vi.mock factory
const { mockBatchSetSettings } = vi.hoisted(() => ({
	mockBatchSetSettings: vi.fn(),
}));

vi.mock("@olympusoss/sdk", () => ({
	batchSetSettings: mockBatchSetSettings,
}));

function buildBatchRequest(body: unknown): Request {
	return new Request("http://localhost:4001/api/settings/batch", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

function makeEntries(count: number) {
	return Array.from({ length: count }, (_, i) => ({
		key: `setting.key_${i}`,
		value: `value_${i}`,
		encrypted: false,
		category: "general",
	}));
}

beforeEach(() => {
	vi.clearAllMocks();
});

// ── Valid batch requests ──────────────────────────────────────────────────────

describe("POST /api/settings/batch — valid requests", () => {
	it("succeeds with a single valid entry", async () => {
		mockBatchSetSettings.mockResolvedValue(undefined);
		const req = buildBatchRequest([{ key: "mfa.require_mfa", value: "true", encrypted: false, category: "mfa" }]);
		const res = await POST(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);
		expect(body.count).toBe(1);
		expect(mockBatchSetSettings).toHaveBeenCalledTimes(1);
		expect(mockBatchSetSettings).toHaveBeenCalledWith(
			[{ key: "mfa.require_mfa", value: "true", encrypted: false, category: "mfa" }],
			expect.any(String),
		);
	});

	it("succeeds with multiple valid entries (typical MFA policy batch)", async () => {
		mockBatchSetSettings.mockResolvedValue(undefined);
		const entries = [
			{ key: "mfa.require_mfa", value: "true", encrypted: false, category: "mfa" },
			{ key: "mfa.allow_self_enroll", value: "false", encrypted: false, category: "mfa" },
			{ key: "mfa.methods", value: "totp,webauthn", encrypted: false, category: "mfa" },
			{ key: "mfa.grace_period_days", value: "7", encrypted: false, category: "mfa" },
		];
		const req = buildBatchRequest(entries);
		const res = await POST(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);
		expect(body.count).toBe(4);
	});

	it("empty array returns success with count 0 (short-circuits before SDK call)", async () => {
		const req = buildBatchRequest([]);
		const res = await POST(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);
		expect(body.count).toBe(0);
		expect(mockBatchSetSettings).not.toHaveBeenCalled();
	});

	it("succeeds with exactly 20 entries (boundary — max allowed)", async () => {
		mockBatchSetSettings.mockResolvedValue(undefined);
		const req = buildBatchRequest(makeEntries(20));
		const res = await POST(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.count).toBe(20);
	});

	it("defaults category to 'general' when omitted from an entry", async () => {
		mockBatchSetSettings.mockResolvedValue(undefined);
		const req = buildBatchRequest([{ key: "foo.bar", value: "baz" }]);
		const res = await POST(req);
		expect(res.status).toBe(200);
		expect(mockBatchSetSettings).toHaveBeenCalledWith(
			[expect.objectContaining({ key: "foo.bar", value: "baz", encrypted: false, category: "general" })],
			expect.any(String),
		);
	});

	it("coerces non-string values to strings", async () => {
		mockBatchSetSettings.mockResolvedValue(undefined);
		const req = buildBatchRequest([{ key: "foo.num", value: 42 }]);
		const res = await POST(req);
		expect(res.status).toBe(200);
		expect(mockBatchSetSettings).toHaveBeenCalledWith([expect.objectContaining({ key: "foo.num", value: "42" })], expect.any(String));
	});
});

// ── Batch size limit ──────────────────────────────────────────────────────────

describe("POST /api/settings/batch — size limit", () => {
	it("returns 400 when batch has 21 entries (exceeds max of 20)", async () => {
		const req = buildBatchRequest(makeEntries(21));
		const res = await POST(req);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("20");
		expect(mockBatchSetSettings).not.toHaveBeenCalled();
	});

	it("returns 400 when batch has 100 entries", async () => {
		const req = buildBatchRequest(makeEntries(100));
		const res = await POST(req);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("20");
	});
});

// ── Invalid entry shapes ──────────────────────────────────────────────────────

describe("POST /api/settings/batch — invalid entry shapes", () => {
	it("returns 400 when body is not an array (plain object)", async () => {
		const req = buildBatchRequest({ key: "foo", value: "bar" });
		const res = await POST(req);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("array");
	});

	it("returns 400 when body is not an array (string)", async () => {
		const req = buildBatchRequest("not-an-array");
		const res = await POST(req);
		expect(res.status).toBe(400);
	});

	it("returns 400 when an entry is missing key", async () => {
		const req = buildBatchRequest([{ value: "test" }]);
		const res = await POST(req);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("key");
	});

	it("returns 400 when key is a number (not a string)", async () => {
		const req = buildBatchRequest([{ key: 123, value: "test" }]);
		const res = await POST(req);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("key");
	});

	it("returns 400 when entry value is missing (undefined/absent)", async () => {
		const req = buildBatchRequest([{ key: "foo.bar" }]);
		const res = await POST(req);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("value");
	});

	it("returns 400 when entry value is null", async () => {
		const req = buildBatchRequest([{ key: "foo.bar", value: null }]);
		const res = await POST(req);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("value");
	});

	it("returns 400 when an entry object is null", async () => {
		const req = buildBatchRequest([null]);
		const res = await POST(req);
		expect(res.status).toBe(400);
	});

	it("returns 400 when encrypted entry has empty string value", async () => {
		const req = buildBatchRequest([{ key: "secret.key", value: "", encrypted: true }]);
		const res = await POST(req);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("non-empty");
	});

	it("returns 400 on first invalid entry — reports its index", async () => {
		const req = buildBatchRequest([
			{ key: "good.key", value: "good" },
			{ key: 99, value: "bad-key-type" },
		]);
		const res = await POST(req);
		expect(res.status).toBe(400);
		const body = await res.json();
		// Should report which index failed
		expect(body.error).toContain("1");
	});
});

// ── Auth enforcement (middleware layer) ──────────────────────────────────────

describe("POST /api/settings/batch — auth enforcement via middleware", () => {
	/**
	 * The route handler itself does not perform auth — that is handled by middleware.
	 * Middleware tests in auth-enforcement.test.ts cover the 401/403 cases for
	 * all /api/settings/* routes including /batch. This test verifies that the
	 * middleware correctly intercepts the /api/settings/batch path.
	 */
	it("middleware blocks /api/settings/batch without a session (401)", async () => {
		// Import middleware dynamically to avoid module-level side effects
		const { middleware } = await import("@/middleware");

		const url = new URL("http://localhost:4001/api/settings/batch");
		const req = {
			nextUrl: url,
			url: url.toString(),
			method: "POST",
			headers: new Headers(),
			cookies: {
				get: (_name: string) => undefined,
			},
			arrayBuffer: async () => new ArrayBuffer(0),
		} as unknown as import("next/server").NextRequest;

		const res = await middleware(req);
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.error).toBe("Not authenticated");
	});
});

// ── Error paths ───────────────────────────────────────────────────────────────

describe("POST /api/settings/batch — error paths", () => {
	it("returns 500 when SDK batchSetSettings throws", async () => {
		mockBatchSetSettings.mockRejectedValue(new Error("DB connection refused"));
		const req = buildBatchRequest([{ key: "foo.bar", value: "baz" }]);
		const res = await POST(req);
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.error).toContain("Failed");
	});

	it("returns 500 on malformed JSON body (request.json() throws)", async () => {
		const req = new Request("http://localhost:4001/api/settings/batch", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "not-json{{{",
		});
		const res = await POST(req);
		expect(res.status).toBe(500);
	});
});
