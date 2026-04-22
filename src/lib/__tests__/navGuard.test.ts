/**
 * Unit tests for lib/navGuard.ts (module-level navigation guard signal).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { navGuard } from "../navGuard";

afterEach(() => {
	navGuard.reset();
});

describe("navGuard", () => {
	it("starts with dirty=false", () => {
		expect(navGuard.isDirty()).toBe(false);
	});

	it("setDirty(true, cb) sets isDirty to true", () => {
		navGuard.setDirty(true, vi.fn());
		expect(navGuard.isDirty()).toBe(true);
	});

	it("setDirty(false, cb) sets isDirty to false and clears callback", () => {
		const cb = vi.fn();
		navGuard.setDirty(true, cb);
		navGuard.setDirty(false, cb);
		expect(navGuard.isDirty()).toBe(false);
		// requestGuard should be a no-op because callback was cleared
		navGuard.requestGuard("/somewhere");
		expect(cb).not.toHaveBeenCalled();
	});

	it("requestGuard invokes registered callback with intended url", () => {
		const cb = vi.fn();
		navGuard.setDirty(true, cb);
		navGuard.requestGuard("/settings");
		expect(cb).toHaveBeenCalledWith("/settings");
	});

	it("requestGuard is a no-op when no callback is registered", () => {
		// No prior setDirty → callback is null by default
		expect(() => navGuard.requestGuard("/x")).not.toThrow();
	});

	it("reset() clears both dirty and callback", () => {
		const cb = vi.fn();
		navGuard.setDirty(true, cb);
		navGuard.reset();
		expect(navGuard.isDirty()).toBe(false);
		navGuard.requestGuard("/y");
		expect(cb).not.toHaveBeenCalled();
	});

	it("setDirty(true, null) sets dirty flag but has no callback", () => {
		navGuard.setDirty(true, null);
		expect(navGuard.isDirty()).toBe(true);
		// No callback — requestGuard is a no-op
		expect(() => navGuard.requestGuard("/z")).not.toThrow();
	});
});
