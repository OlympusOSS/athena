/**
 * Unit tests for hooks/useDialog.
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDialog } from "../useDialog";

describe("useDialog", () => {
	it("defaults closed", () => {
		const { result } = renderHook(() => useDialog());
		expect(result.current.isOpen).toBe(false);
	});

	it("accepts initialOpen=true", () => {
		const { result } = renderHook(() => useDialog(true));
		expect(result.current.isOpen).toBe(true);
	});

	it("open() sets isOpen=true", () => {
		const { result } = renderHook(() => useDialog());
		act(() => result.current.open());
		expect(result.current.isOpen).toBe(true);
	});

	it("close() sets isOpen=false", () => {
		const { result } = renderHook(() => useDialog(true));
		act(() => result.current.close());
		expect(result.current.isOpen).toBe(false);
	});

	it("toggle() flips isOpen", () => {
		const { result } = renderHook(() => useDialog());
		act(() => result.current.toggle());
		expect(result.current.isOpen).toBe(true);
		act(() => result.current.toggle());
		expect(result.current.isOpen).toBe(false);
	});
});
