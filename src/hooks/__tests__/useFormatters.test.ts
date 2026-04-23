/**
 * Unit tests for hooks/useFormatters.
 */

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFormatters } from "../useFormatters";

describe("useFormatters", () => {
	it("exposes all expected functions", () => {
		const { result } = renderHook(() => useFormatters("en-US"));
		expect(typeof result.current.formatDate).toBe("function");
		expect(typeof result.current.formatDateTime).toBe("function");
		expect(typeof result.current.formatRelativeTime).toBe("function");
		expect(typeof result.current.formatNumber).toBe("function");
		expect(typeof result.current.formatCurrency).toBe("function");
		expect(typeof result.current.formatPercentage).toBe("function");
		expect(typeof result.current.formatDuration).toBe("function");
		expect(typeof result.current.formatBytes).toBe("function");
	});

	describe("formatDate", () => {
		it("handles invalid date string", () => {
			const { result } = renderHook(() => useFormatters());
			expect(result.current.formatDate("not-a-date")).toBe("Invalid date");
		});

		it("formats an ISO string", () => {
			const { result } = renderHook(() => useFormatters("en-US"));
			expect(result.current.formatDate("2025-06-15T12:00:00Z").length).toBeGreaterThan(0);
		});

		it("accepts a Date object", () => {
			const { result } = renderHook(() => useFormatters());
			expect(result.current.formatDate(new Date()).length).toBeGreaterThan(0);
		});

		it("respects custom options", () => {
			const { result } = renderHook(() => useFormatters("en-US"));
			expect(result.current.formatDate("2025-06-15T00:00:00Z", { year: "numeric" })).toBe("2025");
		});

		it("returns 'Invalid date' when Intl.DateTimeFormat throws (catch branch)", () => {
			const { result } = renderHook(() => useFormatters("en-US"));
			// year: "bogus" is not a valid DateTimeFormatOptions value → Intl throws → catch returns "Invalid date"
			expect(result.current.formatDate(new Date(), { year: "bogus" } as unknown as Intl.DateTimeFormatOptions)).toBe("Invalid date");
		});
	});

	describe("formatDateTime", () => {
		it("formats a valid date", () => {
			const { result } = renderHook(() => useFormatters());
			expect(result.current.formatDateTime("2025-06-15T12:30:00Z").length).toBeGreaterThan(0);
		});

		it("handles invalid date", () => {
			const { result } = renderHook(() => useFormatters());
			expect(result.current.formatDateTime("junk")).toBe("Invalid date");
		});

		it("accepts a Date object", () => {
			const { result } = renderHook(() => useFormatters());
			expect(result.current.formatDateTime(new Date()).length).toBeGreaterThan(0);
		});

		it("returns 'Invalid date' when dateObj.getTime throws (catch branch)", () => {
			const { result } = renderHook(() => useFormatters());
			const badDate = {
				getTime: () => {
					throw new Error("bad getTime");
				},
			} as unknown as Date;
			expect(result.current.formatDateTime(badDate)).toBe("Invalid date");
		});
	});

	describe("formatRelativeTime", () => {
		const fixedNow = new Date("2025-06-15T12:00:00Z").getTime();

		beforeEach(() => {
			vi.useFakeTimers();
			vi.setSystemTime(fixedNow);
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("returns 'Invalid date' for bad input", () => {
			const { result } = renderHook(() => useFormatters());
			expect(result.current.formatRelativeTime("nope")).toBe("Invalid date");
		});

		it("returns 'just now' for diff < 60s", () => {
			const { result } = renderHook(() => useFormatters());
			expect(result.current.formatRelativeTime(new Date(fixedNow - 30 * 1000))).toBe("just now");
		});

		it("returns 'Nm ago' for minutes bucket", () => {
			const { result } = renderHook(() => useFormatters());
			expect(result.current.formatRelativeTime(new Date(fixedNow - 5 * 60 * 1000))).toBe("5m ago");
		});

		it("returns 'Nh ago' for hours bucket", () => {
			const { result } = renderHook(() => useFormatters());
			expect(result.current.formatRelativeTime(new Date(fixedNow - 3 * 60 * 60 * 1000))).toBe("3h ago");
		});

		it("returns 'Nd ago' for days bucket", () => {
			const { result } = renderHook(() => useFormatters());
			expect(result.current.formatRelativeTime(new Date(fixedNow - 2 * 86400 * 1000))).toBe("2d ago");
		});

		it("returns 'Nw ago' for weeks bucket", () => {
			const { result } = renderHook(() => useFormatters());
			expect(result.current.formatRelativeTime(new Date(fixedNow - 2 * 604800 * 1000))).toBe("2w ago");
		});

		it("returns 'Nmo ago' for months bucket", () => {
			const { result } = renderHook(() => useFormatters());
			// 2,592,001 seconds >= 2,592,000 threshold
			expect(result.current.formatRelativeTime(new Date(fixedNow - 3 * 2592000 * 1000))).toBe("3mo ago");
		});

		it("returns 'Ny ago' for years bucket", () => {
			const { result } = renderHook(() => useFormatters());
			expect(result.current.formatRelativeTime(new Date(fixedNow - 2 * 31536000 * 1000))).toBe("2y ago");
		});

		it("returns 'Invalid date' when dateObj.getTime throws (catch branch)", () => {
			const { result } = renderHook(() => useFormatters());
			const badDate = {
				getTime: () => {
					throw new Error("bad getTime");
				},
			} as unknown as Date;
			expect(result.current.formatRelativeTime(badDate)).toBe("Invalid date");
		});
	});

	describe("formatNumber", () => {
		it("formats an integer", () => {
			const { result } = renderHook(() => useFormatters("en-US"));
			expect(result.current.formatNumber(1000).length).toBeGreaterThan(0);
		});

		it("respects custom options (minimumFractionDigits)", () => {
			const { result } = renderHook(() => useFormatters("en-US"));
			expect(result.current.formatNumber(1.5, { minimumFractionDigits: 2 })).toBe("1.50");
		});

		it("falls back to String(num) when options are invalid (catch branch)", () => {
			const { result } = renderHook(() => useFormatters("en-US"));
			// minimumFractionDigits: -5 is out of range → Intl throws → catch returns String(num)
			expect(result.current.formatNumber(42, { minimumFractionDigits: -5 })).toBe("42");
		});
	});

	describe("formatCurrency", () => {
		it("formats USD by default", () => {
			const { result } = renderHook(() => useFormatters("en-US"));
			expect(result.current.formatCurrency(1000)).toMatch(/\$/);
		});

		it("accepts other currency", () => {
			const { result } = renderHook(() => useFormatters("en-US"));
			expect(result.current.formatCurrency(100, "EUR").length).toBeGreaterThan(0);
		});

		it("falls back gracefully for invalid currency code", () => {
			const { result } = renderHook(() => useFormatters("en-US"));
			// Invalid currency throws inside Intl — caught and fallback returned
			expect(result.current.formatCurrency(100, "!!!")).toMatch(/100/);
		});
	});

	describe("formatPercentage", () => {
		it("formats an integer percentage by default", () => {
			const { result } = renderHook(() => useFormatters());
			expect(result.current.formatPercentage(12)).toBe("12%");
		});

		it("respects decimals", () => {
			const { result } = renderHook(() => useFormatters());
			expect(result.current.formatPercentage(12.345, 2)).toBe("12.35%");
		});

		it("falls back to the raw value when toFixed throws (catch branch)", () => {
			const { result } = renderHook(() => useFormatters());
			// decimals must be 0..100 for Number.prototype.toFixed — 200 is out of range → throws → catch
			expect(result.current.formatPercentage(5, 200)).toBe("5%");
		});
	});

	describe("formatDuration", () => {
		it("formats minutes < 60", () => {
			const { result } = renderHook(() => useFormatters());
			expect(result.current.formatDuration(45)).toBe("45m");
		});

		it("formats hours exactly", () => {
			const { result } = renderHook(() => useFormatters());
			expect(result.current.formatDuration(120)).toBe("2h");
		});

		it("formats hours+minutes", () => {
			const { result } = renderHook(() => useFormatters());
			expect(result.current.formatDuration(125)).toBe("2h 5m");
		});
	});

	describe("formatBytes", () => {
		it("returns '0 Bytes' for zero", () => {
			const { result } = renderHook(() => useFormatters());
			expect(result.current.formatBytes(0)).toBe("0 Bytes");
		});

		it("formats KB", () => {
			const { result } = renderHook(() => useFormatters());
			expect(result.current.formatBytes(1536)).toBe("1.5 KB");
		});

		it("formats MB at default decimals", () => {
			const { result } = renderHook(() => useFormatters());
			expect(result.current.formatBytes(1024 * 1024)).toBe("1 MB");
		});

		it("honors decimals param", () => {
			const { result } = renderHook(() => useFormatters());
			expect(result.current.formatBytes(1536, 0)).toBe("2 KB");
		});

		it("decimals < 0 coerced to 0", () => {
			const { result } = renderHook(() => useFormatters());
			expect(result.current.formatBytes(1536, -3)).toBe("2 KB");
		});
	});
});
