/**
 * Unit tests for lib/pagination-utils.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPaginationParams, fetchAllPages, parseLinkHeader, processPaginatedResponse } from "../pagination-utils";

describe("parseLinkHeader", () => {
	it("returns both null for null/undefined/empty", () => {
		expect(parseLinkHeader(null)).toEqual({ next: null, prev: null });
		expect(parseLinkHeader(undefined)).toEqual({ next: null, prev: null });
		expect(parseLinkHeader("")).toEqual({ next: null, prev: null });
	});

	it("parses next token", () => {
		const hdr = '<https://kratos/identities?page_token=abc123&per_page=10>; rel="next"';
		expect(parseLinkHeader(hdr).next).toBe("abc123");
	});

	it("parses prev token", () => {
		const hdr = '<https://kratos/identities?page_token=zzz>; rel="prev"';
		expect(parseLinkHeader(hdr).prev).toBe("zzz");
	});

	it("parses both tokens in one header", () => {
		const hdr = '<?page_token=next1>; rel="next", <?page_token=prev1>; rel="prev"';
		expect(parseLinkHeader(hdr)).toEqual({ next: "next1", prev: "prev1" });
	});

	it("returns null when no rel=next/prev present", () => {
		expect(parseLinkHeader('<https://kratos/identities>; rel="first"')).toEqual({ next: null, prev: null });
	});
});

describe("processPaginatedResponse", () => {
	it("handles plain object headers with data array", () => {
		const result = processPaginatedResponse([{ id: 1 }], { link: '<?page_token=nxt>; rel="next"' });
		expect(result.data).toEqual([{ id: 1 }]);
		expect(result.hasMore).toBe(true);
		expect(result.nextPageToken).toBe("nxt");
	});

	it("handles Headers object", () => {
		const h = new Headers();
		h.set("link", '<?page_token=hdr>; rel="next"');
		const result = processPaginatedResponse([{ id: 2 }], h);
		expect(result.nextPageToken).toBe("hdr");
	});

	it("extracts nested data via dataKey", () => {
		const result = processPaginatedResponse({ items: [1, 2, 3] }, {}, "items");
		expect(result.data).toEqual([1, 2, 3]);
		expect(result.hasMore).toBe(false);
		expect(result.nextPageToken).toBeNull();
	});

	it("returns empty array when data is not array and no dataKey", () => {
		const result = processPaginatedResponse("not-an-array" as unknown, {});
		expect(result.data).toEqual([]);
	});

	it("handles missing headers", () => {
		const result = processPaginatedResponse([1, 2], {});
		expect(result.hasMore).toBe(false);
		expect(result.nextPageToken).toBeNull();
		expect(result.prevPageToken).toBeNull();
	});
});

describe("fetchAllPages", () => {
	let warnSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("fetches a single page when no next token", async () => {
		const fetchPage = vi.fn().mockResolvedValue({ data: [1, 2], headers: {} });
		const result = await fetchAllPages(fetchPage);
		expect(result).toEqual([1, 2]);
		expect(fetchPage).toHaveBeenCalledTimes(1);
	});

	it("fetches multiple pages following next tokens", async () => {
		const fetchPage = vi
			.fn()
			.mockResolvedValueOnce({ data: [1], headers: { link: '<?page_token=p2>; rel="next"' } })
			.mockResolvedValueOnce({ data: [2], headers: { link: '<?page_token=p3>; rel="next"' } })
			.mockResolvedValueOnce({ data: [3], headers: {} });
		const result = await fetchAllPages(fetchPage);
		expect(result).toEqual([1, 2, 3]);
		expect(fetchPage).toHaveBeenCalledTimes(3);
	});

	it("respects maxPages safety limit", async () => {
		// Always returns a next token → would loop forever; guard with maxPages
		const fetchPage = vi.fn().mockResolvedValue({ data: [1], headers: { link: '<?page_token=loop>; rel="next"' } });
		const result = await fetchAllPages(fetchPage, { maxPages: 3 });
		expect(result.length).toBe(3);
		expect(fetchPage).toHaveBeenCalledTimes(3);
		expect(warnSpy).toHaveBeenCalled();
	});

	it("calls onProgress for each page", async () => {
		const fetchPage = vi
			.fn()
			.mockResolvedValueOnce({ data: [1], headers: { link: '<?page_token=p2>; rel="next"' } })
			.mockResolvedValueOnce({ data: [2], headers: {} });
		const onProgress = vi.fn();
		await fetchAllPages(fetchPage, { onProgress });
		expect(onProgress).toHaveBeenCalledTimes(2);
	});

	it("re-throws on error when stopOnError=true (default)", async () => {
		const fetchPage = vi.fn().mockRejectedValue(new Error("boom"));
		await expect(fetchAllPages(fetchPage)).rejects.toThrow("boom");
	});

	it("continues on error when stopOnError=false (breaks but records)", async () => {
		const fetchPage = vi.fn().mockRejectedValue(new Error("boom"));
		const result = await fetchAllPages(fetchPage, { stopOnError: false });
		expect(result).toEqual([]);
		expect(warnSpy).toHaveBeenCalled();
	});

	it("handles non-Error throws (string)", async () => {
		const fetchPage = vi.fn().mockRejectedValue("bare-string-error");
		await expect(fetchAllPages(fetchPage)).rejects.toThrow("bare-string-error");
	});

	it("supports dataKey extraction", async () => {
		const fetchPage = vi.fn().mockResolvedValueOnce({ data: { items: [1, 2] }, headers: {} });
		const result = await fetchAllPages(fetchPage, { dataKey: "items" });
		expect(result).toEqual([1, 2]);
	});
});

describe("createPaginationParams", () => {
	it("returns empty params when nothing given", () => {
		expect(createPaginationParams()).toEqual({});
	});

	it("sets page_size", () => {
		expect(createPaginationParams(undefined, 25)).toEqual({ page_size: "25" });
	});

	it("sets page_token", () => {
		expect(createPaginationParams("tok")).toEqual({ page_token: "tok" });
	});

	it("sets both", () => {
		expect(createPaginationParams("tok", 5)).toEqual({ page_size: "5", page_token: "tok" });
	});

	it("empty string page_token is falsy → not set", () => {
		expect(createPaginationParams("")).toEqual({});
	});
});
