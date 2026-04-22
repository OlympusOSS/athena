/**
 * Unit tests for hooks/useCopyToClipboard.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCopyToClipboard } from "../useCopyToClipboard";

describe("useCopyToClipboard", () => {
	let writeText: ReturnType<typeof vi.fn>;
	let errorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText },
			configurable: true,
			writable: true,
		});
		errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("starts with copiedField=null and isCopied=false", () => {
		const { result } = renderHook(() => useCopyToClipboard());
		expect(result.current.copiedField).toBeNull();
		expect(result.current.isCopied).toBe(false);
	});

	it("copy() calls navigator.clipboard.writeText and updates copiedField", async () => {
		const { result } = renderHook(() => useCopyToClipboard(2000));
		await act(async () => {
			await result.current.copy("hello", "field1");
		});
		expect(writeText).toHaveBeenCalledWith("hello");
		expect(result.current.copiedField).toBe("field1");
		expect(result.current.isCopied).toBe(true);
	});

	it("copy() uses 'default' label when label is omitted", async () => {
		const { result } = renderHook(() => useCopyToClipboard(1000));
		await act(async () => {
			await result.current.copy("x");
		});
		expect(result.current.copiedField).toBe("default");
	});

	it("copy() clears copiedField after timeout (real timers, short delay)", async () => {
		const { result } = renderHook(() => useCopyToClipboard(50));
		await act(async () => {
			await result.current.copy("x");
		});
		expect(result.current.copiedField).toBe("default");
		await waitFor(
			() => {
				expect(result.current.copiedField).toBeNull();
			},
			{ timeout: 1000 },
		);
	});

	it("copy() re-throws when writeText rejects", async () => {
		writeText.mockRejectedValueOnce(new Error("clipboard denied"));
		const { result } = renderHook(() => useCopyToClipboard());
		await expect(
			act(async () => {
				await result.current.copy("x");
			}),
		).rejects.toThrow("clipboard denied");
		expect(errorSpy).toHaveBeenCalled();
	});
});
