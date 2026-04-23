/**
 * Unit tests for GET /api/services/versions
 *
 * Covers branches of fetchLatestRelease:
 *   - fetch succeeds with tag_name starting with 'v'
 *   - fetch succeeds with tag_name not starting with 'v' (identity branch)
 *   - fetch succeeds with missing tag_name => latest=null
 *   - fetch returns non-ok => { latest:null, error:"GitHub API returned 404" }
 *   - fetch throws => { latest:null, error: message }
 *   - fetch throws error without message => fallback message
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("GET /api/services/versions", () => {
	it("returns parsed tag names with 'v' prefix stripped", async () => {
		const fetchMock = vi.fn().mockImplementation(async (url: string) => {
			if (url.includes("/athena/")) {
				return { ok: true, json: () => Promise.resolve({ tag_name: "v1.2.3" }) };
			}
			return { ok: true, json: () => Promise.resolve({ tag_name: "v4.5.6" }) };
		});
		vi.stubGlobal("fetch", fetchMock);
		const res = await GET();
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.athena).toEqual({ latest: "1.2.3" });
		expect(body.hera).toEqual({ latest: "4.5.6" });
	});

	it("returns tag_name as-is when it does not start with 'v'", async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ tag_name: "1.0.0" }) });
		vi.stubGlobal("fetch", fetchMock);
		const body = await (await GET()).json();
		expect(body.athena).toEqual({ latest: "1.0.0" });
	});

	it("returns latest=null when tag_name is missing", async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
		vi.stubGlobal("fetch", fetchMock);
		const body = await (await GET()).json();
		expect(body.athena).toEqual({ latest: null });
	});

	it("returns error when GitHub returns non-ok", async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
		vi.stubGlobal("fetch", fetchMock);
		const body = await (await GET()).json();
		expect(body.athena).toEqual({ latest: null, error: "GitHub API returned 404" });
	});

	it("returns error message when fetch throws", async () => {
		const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
		vi.stubGlobal("fetch", fetchMock);
		const body = await (await GET()).json();
		expect(body.athena).toEqual({ latest: null, error: "network down" });
	});

	it("uses fallback message when thrown error has no message", async () => {
		const fetchMock = vi.fn().mockRejectedValue({});
		vi.stubGlobal("fetch", fetchMock);
		const body = await (await GET()).json();
		expect(body.athena).toEqual({ latest: null, error: "Failed to fetch latest release" });
	});
});
