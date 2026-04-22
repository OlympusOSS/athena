/**
 * Unit tests for lib/mfa-methods.ts (parseMfaMethods).
 */

import { describe, expect, it } from "vitest";
import { parseMfaMethods } from "../mfa-methods";

describe("parseMfaMethods", () => {
	it("returns [] for null", () => {
		expect(parseMfaMethods(null)).toEqual([]);
	});

	it("returns [] for undefined", () => {
		expect(parseMfaMethods(undefined)).toEqual([]);
	});

	it("returns [] for empty string", () => {
		expect(parseMfaMethods("")).toEqual([]);
	});

	it("returns [] for whitespace-only string", () => {
		expect(parseMfaMethods(" ")).toEqual([]);
	});

	it("returns [] for a single comma", () => {
		expect(parseMfaMethods(",")).toEqual([]);
	});

	it("returns [] for consecutive commas", () => {
		expect(parseMfaMethods(",,")).toEqual([]);
	});

	it("returns [] for only whitespace between commas", () => {
		expect(parseMfaMethods(" , ")).toEqual([]);
	});

	it("parses a single method", () => {
		expect(parseMfaMethods("totp")).toEqual(["totp"]);
	});

	it("parses multiple methods", () => {
		expect(parseMfaMethods("totp,webauthn")).toEqual(["totp", "webauthn"]);
	});

	it("trims whitespace around tokens", () => {
		expect(parseMfaMethods(" totp , webauthn ")).toEqual(["totp", "webauthn"]);
	});

	it("filters empty tokens among valid ones", () => {
		expect(parseMfaMethods("totp,,webauthn,")).toEqual(["totp", "webauthn"]);
	});
});
