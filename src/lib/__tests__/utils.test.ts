/**
 * Unit tests for lib/utils.ts (just re-exports cn from canvas).
 */

import { describe, expect, it } from "vitest";
import { cn } from "../utils";

describe("cn (re-export)", () => {
	it("is a callable function", () => {
		expect(typeof cn).toBe("function");
	});

	it("concatenates class names", () => {
		// The canvas cn combines classnames via clsx + tailwind-merge
		const result = cn("a", "b");
		expect(typeof result).toBe("string");
		expect(result).toContain("a");
		expect(result).toContain("b");
	});

	it("handles falsy values", () => {
		const result = cn("a", false, null, undefined, "b");
		expect(result).toContain("a");
		expect(result).toContain("b");
	});
});
