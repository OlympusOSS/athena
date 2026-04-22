/**
 * Unit tests for hooks/useToggle.
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useToggle } from "../useToggle";

describe("useToggle", () => {
	it("defaults initial value to false", () => {
		const { result } = renderHook(() => useToggle());
		expect(result.current.value).toBe(false);
	});

	it("accepts initial true value", () => {
		const { result } = renderHook(() => useToggle(true));
		expect(result.current.value).toBe(true);
	});

	it("toggle flips the value", () => {
		const { result } = renderHook(() => useToggle(false));
		act(() => result.current.toggle());
		expect(result.current.value).toBe(true);
		act(() => result.current.toggle());
		expect(result.current.value).toBe(false);
	});

	it("setTrue sets value to true", () => {
		const { result } = renderHook(() => useToggle(false));
		act(() => result.current.setTrue());
		expect(result.current.value).toBe(true);
	});

	it("setFalse sets value to false", () => {
		const { result } = renderHook(() => useToggle(true));
		act(() => result.current.setFalse());
		expect(result.current.value).toBe(false);
	});

	it("setValue(true) sets value to true", () => {
		const { result } = renderHook(() => useToggle(false));
		act(() => result.current.setValue(true));
		expect(result.current.value).toBe(true);
	});

	it("setValue(false) sets value to false", () => {
		const { result } = renderHook(() => useToggle(true));
		act(() => result.current.setValue(false));
		expect(result.current.value).toBe(false);
	});
});
