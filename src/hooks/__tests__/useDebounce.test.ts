/**
 * Unit tests for hooks/useDebounce.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebounce } from "../useDebounce";

describe("useDebounce", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns initial value immediately", () => {
		const { result } = renderHook(() => useDebounce("hello", 100));
		expect(result.current).toBe("hello");
	});

	it("delays update by the specified delay", () => {
		const { result, rerender } = renderHook(({ value }) => useDebounce(value, 200), { initialProps: { value: "a" } });
		expect(result.current).toBe("a");

		rerender({ value: "b" });
		expect(result.current).toBe("a"); // not yet updated

		act(() => {
			vi.advanceTimersByTime(199);
		});
		expect(result.current).toBe("a");

		act(() => {
			vi.advanceTimersByTime(1);
		});
		expect(result.current).toBe("b");
	});

	it("uses default delay 300 when not provided", () => {
		const { result, rerender } = renderHook(({ value }) => useDebounce(value), { initialProps: { value: 1 } });
		rerender({ value: 2 });
		act(() => {
			vi.advanceTimersByTime(299);
		});
		expect(result.current).toBe(1);
		act(() => {
			vi.advanceTimersByTime(1);
		});
		expect(result.current).toBe(2);
	});

	it("resets the timer when value changes before delay elapses", () => {
		const { result, rerender } = renderHook(({ value }) => useDebounce(value, 100), { initialProps: { value: "x" } });
		rerender({ value: "y" });
		act(() => {
			vi.advanceTimersByTime(50);
		});
		rerender({ value: "z" });
		act(() => {
			vi.advanceTimersByTime(50);
		});
		expect(result.current).toBe("x");
		act(() => {
			vi.advanceTimersByTime(50);
		});
		expect(result.current).toBe("z");
	});
});
