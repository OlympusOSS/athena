/**
 * Unit tests for hooks/usePagination.
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePagination } from "../usePagination";

describe("usePagination", () => {
	const data = Array.from({ length: 25 }, (_, i) => ({ id: i }));

	it("initial state: page 0, paginatedData slice of size pageSize", () => {
		const { result } = renderHook(() => usePagination(data, 10));
		expect(result.current.currentPage).toBe(0);
		expect(result.current.pageSize).toBe(10);
		expect(result.current.totalPages).toBe(3);
		expect(result.current.paginatedData).toHaveLength(10);
		expect(result.current.paginatedData[0].id).toBe(0);
	});

	it("uses default pageSize 10 when not provided", () => {
		const { result } = renderHook(() => usePagination(data));
		expect(result.current.pageSize).toBe(10);
	});

	it("setPage clamps to valid range", () => {
		const { result } = renderHook(() => usePagination(data, 10));
		act(() => result.current.setPage(-5));
		expect(result.current.currentPage).toBe(0);
		act(() => result.current.setPage(99));
		expect(result.current.currentPage).toBe(2); // totalPages - 1
	});

	it("setPage navigates to given page", () => {
		const { result } = renderHook(() => usePagination(data, 10));
		act(() => result.current.setPage(1));
		expect(result.current.currentPage).toBe(1);
		expect(result.current.paginatedData[0].id).toBe(10);
	});

	it("setPageSize resets currentPage to 0", () => {
		const { result } = renderHook(() => usePagination(data, 10));
		act(() => result.current.setPage(2));
		expect(result.current.currentPage).toBe(2);
		act(() => result.current.setPageSize(5));
		expect(result.current.pageSize).toBe(5);
		expect(result.current.currentPage).toBe(0);
		expect(result.current.totalPages).toBe(5);
	});

	it("nextPage advances currentPage", () => {
		const { result } = renderHook(() => usePagination(data, 10));
		act(() => result.current.nextPage());
		expect(result.current.currentPage).toBe(1);
	});

	it("prevPage decrements currentPage", () => {
		const { result } = renderHook(() => usePagination(data, 10));
		act(() => result.current.setPage(2));
		act(() => result.current.prevPage());
		expect(result.current.currentPage).toBe(1);
	});

	it("prevPage clamps at 0", () => {
		const { result } = renderHook(() => usePagination(data, 10));
		act(() => result.current.prevPage());
		expect(result.current.currentPage).toBe(0);
	});

	it("goToFirstPage and goToLastPage navigate correctly", () => {
		const { result } = renderHook(() => usePagination(data, 10));
		act(() => result.current.goToLastPage());
		expect(result.current.currentPage).toBe(2);
		act(() => result.current.goToFirstPage());
		expect(result.current.currentPage).toBe(0);
	});

	it("handles empty data array", () => {
		const { result } = renderHook(() => usePagination([], 10));
		expect(result.current.totalPages).toBe(0);
		expect(result.current.paginatedData).toEqual([]);
	});
});
