/**
 * Unit tests for GET /api/health
 *
 * Strategy: Direct handler invocation. No external dependencies.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "../route";

const originalEnv = { ...process.env };

beforeEach(() => {
	process.env = { ...originalEnv };
});

afterEach(() => {
	process.env = { ...originalEnv };
});

describe("GET /api/health", () => {
	it("returns status ok and version from APP_VERSION env", () => {
		process.env.APP_VERSION = "1.2.3";
		const res = GET();
		expect(res.status).toBe(200);
		// NextResponse.json returns a Response we can read via json()
		return res.json().then((body) => {
			expect(body.status).toBe("ok");
			expect(body.version).toBe("1.2.3");
		});
	});

	it("defaults version to 'unknown' when APP_VERSION is unset", () => {
		delete process.env.APP_VERSION;
		const res = GET();
		expect(res.status).toBe(200);
		return res.json().then((body) => {
			expect(body.status).toBe("ok");
			expect(body.version).toBe("unknown");
		});
	});
});
