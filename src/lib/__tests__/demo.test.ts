/**
 * Unit tests for lib/demo.ts (isDemoIdentity).
 */

import type { Identity } from "@ory/kratos-client";
import { describe, expect, it } from "vitest";
import { isDemoIdentity } from "../demo";

function makeIdentity(metadata_admin: unknown): Identity {
	return {
		id: "test-id",
		schema_id: "default",
		schema_url: "https://kratos/schemas/default",
		state: "active",
		traits: {},
		metadata_admin,
	} as unknown as Identity;
}

describe("isDemoIdentity", () => {
	it("returns false for null", () => {
		expect(isDemoIdentity(null)).toBe(false);
	});

	it("returns false for undefined", () => {
		expect(isDemoIdentity(undefined)).toBe(false);
	});

	it("returns false when metadata_admin is null", () => {
		expect(isDemoIdentity(makeIdentity(null))).toBe(false);
	});

	it("returns false when metadata_admin is undefined", () => {
		expect(isDemoIdentity(makeIdentity(undefined))).toBe(false);
	});

	it("returns false when demo is missing", () => {
		expect(isDemoIdentity(makeIdentity({}))).toBe(false);
	});

	it("returns false when demo is false", () => {
		expect(isDemoIdentity(makeIdentity({ demo: false }))).toBe(false);
	});

	it("returns false when demo is a truthy non-true value (strict equality)", () => {
		expect(isDemoIdentity(makeIdentity({ demo: "true" }))).toBe(false);
		expect(isDemoIdentity(makeIdentity({ demo: 1 }))).toBe(false);
	});

	it("returns true only when demo === true", () => {
		expect(isDemoIdentity(makeIdentity({ demo: true }))).toBe(true);
	});
});
