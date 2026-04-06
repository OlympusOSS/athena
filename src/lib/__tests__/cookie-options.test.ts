/**
 * Unit tests for src/lib/cookie-options.ts
 *
 * Covers:
 *   - buildSessionCookieOptions: correct attributes for each NODE_ENV value
 *   - buildSessionCookieOptions: maxAge cap at 28800 (8 hours)
 *   - buildSessionCookieOptions: maxAge=0 passthrough (cookie deletion)
 *   - buildSessionClearOptions: convenience wrapper for deletion
 *   - SameSite is "strict" (not "lax")
 *   - httpOnly is always true
 */

import { afterEach, describe, expect, it } from "vitest";
import { buildSessionClearOptions, buildSessionCookieOptions } from "@/lib/cookie-options";

const originalEnv = { ...process.env };

afterEach(() => {
	process.env = { ...originalEnv };
});

describe("buildSessionCookieOptions — httpOnly", () => {
	it("is always true regardless of NODE_ENV", () => {
		process.env.NODE_ENV = "production";
		expect(buildSessionCookieOptions(3600).httpOnly).toBe(true);

		process.env.NODE_ENV = "development";
		expect(buildSessionCookieOptions(3600).httpOnly).toBe(true);
	});
});

describe("buildSessionCookieOptions — sameSite", () => {
	it("is always strict", () => {
		process.env.NODE_ENV = "production";
		expect(buildSessionCookieOptions(3600).sameSite).toBe("strict");

		process.env.NODE_ENV = "development";
		expect(buildSessionCookieOptions(3600).sameSite).toBe("strict");
	});
});

describe("buildSessionCookieOptions — path", () => {
	it("is always /", () => {
		expect(buildSessionCookieOptions(3600).path).toBe("/");
	});
});

describe("buildSessionCookieOptions — secure flag", () => {
	it("is true when NODE_ENV=production", () => {
		process.env.NODE_ENV = "production";
		expect(buildSessionCookieOptions(3600).secure).toBe(true);
	});

	it("is false when NODE_ENV=development", () => {
		process.env.NODE_ENV = "development";
		expect(buildSessionCookieOptions(3600).secure).toBe(false);
	});

	it("is false when NODE_ENV=test (CI environment)", () => {
		process.env.NODE_ENV = "test";
		expect(buildSessionCookieOptions(3600).secure).toBe(false);
	});

	it("is false when NODE_ENV is undefined", () => {
		delete process.env.NODE_ENV;
		expect(buildSessionCookieOptions(3600).secure).toBe(false);
	});
});

describe("buildSessionCookieOptions — maxAge cap at 28800s (8 hours)", () => {
	it("passes through values under the cap unchanged", () => {
		expect(buildSessionCookieOptions(3600).maxAge).toBe(3600);
		expect(buildSessionCookieOptions(28800).maxAge).toBe(28800);
	});

	it("caps values above 28800 to 28800", () => {
		expect(buildSessionCookieOptions(86400).maxAge).toBe(28800); // 1 day → 8 hours
		expect(buildSessionCookieOptions(604800).maxAge).toBe(28800); // 7 days → 8 hours
	});

	it("passes through maxAge=0 unchanged (cookie deletion)", () => {
		expect(buildSessionCookieOptions(0).maxAge).toBe(0);
	});
});

describe("buildSessionClearOptions — deletion convenience wrapper", () => {
	it("returns maxAge=0", () => {
		expect(buildSessionClearOptions().maxAge).toBe(0);
	});

	it("returns all security attributes matching the standard options", () => {
		const clearOpts = buildSessionClearOptions();
		expect(clearOpts.httpOnly).toBe(true);
		expect(clearOpts.path).toBe("/");
		expect(clearOpts.sameSite).toBe("strict");
	});

	it("returns secure=true in production (attributes must match set operation for browser deletion)", () => {
		process.env.NODE_ENV = "production";
		expect(buildSessionClearOptions().secure).toBe(true);
	});

	it("returns secure=false outside production", () => {
		process.env.NODE_ENV = "development";
		expect(buildSessionClearOptions().secure).toBe(false);
	});
});
