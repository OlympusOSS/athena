/**
 * Unit tests for lib/social-connections/audit.ts (auditSocialConnection).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditSocialConnection } from "../social-connections/audit";

describe("auditSocialConnection", () => {
	let logSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("emits a structured JSON entry to console.log", () => {
		auditSocialConnection("social_connection.created", "google", "admin-id-1", "admin@example.com", ["client_id", "scopes"]);
		expect(logSpy).toHaveBeenCalledOnce();
		const payload = JSON.parse(logSpy.mock.calls[0][0] as string);
		expect(payload.audit).toBe(true);
		expect(payload.action).toBe("social_connection.created");
		expect(payload.provider).toBe("google");
		expect(payload.admin_id).toBe("admin-id-1");
		expect(payload.admin_email).toBe("admin@example.com");
		expect(payload.changed_fields).toEqual(["client_id", "scopes"]);
		expect(typeof payload.timestamp).toBe("string");
		// Timestamp must be a parseable ISO date
		expect(Number.isNaN(Date.parse(payload.timestamp))).toBe(false);
	});

	it("accepts each audit action variant", () => {
		const actions = [
			"social_connection.created",
			"social_connection.updated",
			"social_connection.enabled",
			"social_connection.disabled",
			"social_connection.deleted",
		] as const;
		for (const action of actions) {
			auditSocialConnection(action, "google", "id", "email@example.com", []);
		}
		expect(logSpy).toHaveBeenCalledTimes(actions.length);
	});

	it("handles empty changed_fields", () => {
		auditSocialConnection("social_connection.enabled", "google", "id", "e@e.com", []);
		const payload = JSON.parse(logSpy.mock.calls[0][0] as string);
		expect(payload.changed_fields).toEqual([]);
	});
});
