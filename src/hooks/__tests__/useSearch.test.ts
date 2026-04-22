/**
 * Unit tests for hooks/useSearch.
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSearch } from "../useSearch";

interface Row {
	name: string;
	email: string;
	role?: string | null;
}

describe("useSearch", () => {
	const data: Row[] = [
		{ name: "Alice", email: "alice@example.com", role: "admin" },
		{ name: "Bob", email: "bob@example.com", role: "user" },
		{ name: "Carol", email: "carol@other.com", role: null },
	];

	it("returns all data when searchTerm is empty", () => {
		const { result } = renderHook(() => useSearch(data, ["name"], ""));
		expect(result.current.length).toBe(3);
	});

	it("returns all data when searchTerm is whitespace only", () => {
		const { result } = renderHook(() => useSearch(data, ["name"], "   "));
		expect(result.current.length).toBe(3);
	});

	it("filters by single field (case-insensitive)", () => {
		const { result } = renderHook(() => useSearch(data, ["name"], "ALI"));
		expect(result.current.length).toBe(1);
		expect(result.current[0].name).toBe("Alice");
	});

	it("filters by multiple fields", () => {
		const { result } = renderHook(() => useSearch(data, ["name", "email"], "example"));
		// Alice and Bob both have example.com emails
		expect(result.current.length).toBe(2);
	});

	it("skips null/undefined field values without throwing", () => {
		const { result } = renderHook(() => useSearch(data, ["role"], "admin"));
		expect(result.current.length).toBe(1);
		// Carol has role=null — she should not match
		expect(result.current[0].name).toBe("Alice");
	});

	it("coerces non-string values via String()", () => {
		interface Numbered {
			id: number;
			label: string;
		}
		const rows: Numbered[] = [
			{ id: 100, label: "a" },
			{ id: 200, label: "b" },
		];
		const { result } = renderHook(() => useSearch(rows, ["id"], "100"));
		expect(result.current.length).toBe(1);
	});
});
