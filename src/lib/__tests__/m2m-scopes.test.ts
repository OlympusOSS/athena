/**
 * Unit tests for lib/m2m-scopes.ts.
 *
 * This is a constants file — tests assert the canonical allowlist shape.
 * Changes to this file are security-relevant (SR-ATHENA-1).
 */

import { describe, expect, it } from "vitest";
import { M2M_HIGH_RISK_SCOPES, M2M_PERMITTED_SCOPES, M2M_SCOPE_DESCRIPTIONS } from "../m2m-scopes";

describe("M2M_PERMITTED_SCOPES allowlist", () => {
	it("contains the expected V1 scopes", () => {
		const expected = ["identities:read", "identities:write", "sessions:read", "sessions:invalidate", "settings:read", "audit:read", "webhooks:write"];
		expect([...M2M_PERMITTED_SCOPES]).toEqual(expected);
	});

	it("does NOT include dangerous scopes", () => {
		const forbidden = ["settings:write", "identities:delete", "openid", "profile", "email"];
		for (const scope of forbidden) {
			expect(M2M_PERMITTED_SCOPES as readonly string[]).not.toContain(scope);
		}
	});
});

describe("M2M_HIGH_RISK_SCOPES", () => {
	it("contains sessions:invalidate", () => {
		expect(M2M_HIGH_RISK_SCOPES.has("sessions:invalidate")).toBe(true);
	});

	it("does NOT mark low-risk read scopes as high-risk", () => {
		expect(M2M_HIGH_RISK_SCOPES.has("identities:read" as never)).toBe(false);
		expect(M2M_HIGH_RISK_SCOPES.has("audit:read" as never)).toBe(false);
	});
});

describe("M2M_SCOPE_DESCRIPTIONS", () => {
	it("provides a description for every permitted scope", () => {
		for (const scope of M2M_PERMITTED_SCOPES) {
			expect(M2M_SCOPE_DESCRIPTIONS[scope]).toBeDefined();
			expect(M2M_SCOPE_DESCRIPTIONS[scope].length).toBeGreaterThan(0);
		}
	});

	it("sessions:invalidate description flags it as high risk", () => {
		expect(M2M_SCOPE_DESCRIPTIONS["sessions:invalidate"]).toContain("High risk");
	});
});
