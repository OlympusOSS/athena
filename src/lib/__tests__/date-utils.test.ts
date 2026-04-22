/**
 * Unit tests for lib/date-utils.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatDate, formatDateOnly, formatRelativeTime, formatTimeOnly } from "../date-utils";

describe("formatDate", () => {
	it("returns empty string for null", () => {
		expect(formatDate(null)).toBe("");
	});

	it("returns empty string for undefined", () => {
		expect(formatDate(undefined)).toBe("");
	});

	it("returns empty string for invalid date string", () => {
		expect(formatDate("not-a-date")).toBe("");
	});

	it("returns empty string for invalid Date object", () => {
		expect(formatDate(new Date("not-a-date"))).toBe("");
	});

	it("formats a valid ISO date string", () => {
		const result = formatDate("2025-01-15T12:30:45Z");
		expect(result.length).toBeGreaterThan(0);
	});

	it("formats a valid Date object", () => {
		const result = formatDate(new Date("2025-01-15T12:30:45Z"));
		expect(result.length).toBeGreaterThan(0);
	});

	it("honors custom options (merged with defaults)", () => {
		// formatDate merges defaultOptions with the caller's options.
		// Passing { year: "numeric" } does NOT strip the time fields.
		const result = formatDate("2025-06-15T12:00:00Z", { year: "numeric" });
		expect(result).toContain("2025");
	});
});

describe("formatDateOnly", () => {
	it("returns empty string for null", () => {
		expect(formatDateOnly(null)).toBe("");
	});

	it("formats date without time", () => {
		const result = formatDateOnly("2025-06-15T12:00:00Z");
		expect(result.length).toBeGreaterThan(0);
	});
});

describe("formatTimeOnly", () => {
	it("returns empty string for undefined", () => {
		expect(formatTimeOnly(undefined)).toBe("");
	});

	it("formats time", () => {
		const result = formatTimeOnly("2025-06-15T12:30:45Z");
		expect(result.length).toBeGreaterThan(0);
	});
});

describe("formatRelativeTime", () => {
	const now = new Date("2025-06-15T12:00:00Z").getTime();

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(now);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns empty string for null", () => {
		expect(formatRelativeTime(null)).toBe("");
	});

	it("returns empty string for undefined", () => {
		expect(formatRelativeTime(undefined)).toBe("");
	});

	it("returns empty string for invalid date", () => {
		expect(formatRelativeTime("not-a-date")).toBe("");
	});

	it("returns 'Just now' for diff < 1 minute", () => {
		const recent = new Date(now - 30 * 1000).toISOString();
		expect(formatRelativeTime(recent)).toBe("Just now");
	});

	it("returns minutes ago (singular)", () => {
		const date = new Date(now - 60 * 1000).toISOString();
		expect(formatRelativeTime(date)).toBe("1 minute ago");
	});

	it("returns minutes ago (plural)", () => {
		const date = new Date(now - 5 * 60 * 1000).toISOString();
		expect(formatRelativeTime(date)).toBe("5 minutes ago");
	});

	it("returns hours ago (singular)", () => {
		const date = new Date(now - 60 * 60 * 1000).toISOString();
		expect(formatRelativeTime(date)).toBe("1 hour ago");
	});

	it("returns hours ago (plural)", () => {
		const date = new Date(now - 3 * 60 * 60 * 1000).toISOString();
		expect(formatRelativeTime(date)).toBe("3 hours ago");
	});

	it("returns days ago (singular)", () => {
		const date = new Date(now - 24 * 60 * 60 * 1000).toISOString();
		expect(formatRelativeTime(date)).toBe("1 day ago");
	});

	it("returns days ago (plural)", () => {
		const date = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString();
		expect(formatRelativeTime(date)).toBe("5 days ago");
	});

	it("falls back to formatDate for > 30 days old", () => {
		const date = new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString();
		const result = formatRelativeTime(date);
		// Should not contain "ago"
		expect(result).not.toMatch(/ago/);
		// Should be non-empty (a formatted date)
		expect(result.length).toBeGreaterThan(0);
	});

	it("accepts a Date object directly", () => {
		const date = new Date(now - 2 * 60 * 1000);
		expect(formatRelativeTime(date)).toBe("2 minutes ago");
	});
});
