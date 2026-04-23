/**
 * Unit tests for GET /api/services/health
 *
 * Exercises the `checkService` helper via four parallel upstream fetches:
 *   - Athena internal (uses /api/health)
 *   - Hera (uses /health)
 *   - Kratos admin (uses /version)
 *   - Hydra admin (uses /version)
 *
 * Branches covered:
 *   - URL unset => { isHealthy: false, version: null, error: "Not configured" }
 *   - fetch succeeds, service returns version
 *   - fetch succeeds, service returns no version
 *   - fetch throws (network/timeout)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";

const originalEnv = { ...process.env };

beforeEach(() => {
	process.env = { ...originalEnv };
	vi.clearAllMocks();
});

afterEach(() => {
	process.env = { ...originalEnv };
	vi.unstubAllGlobals();
});

describe("GET /api/services/health", () => {
	it("returns 'Not configured' for each service when URL is unset", async () => {
		delete process.env.ATHENA_INTERNAL_URL;
		delete process.env.HERA_INTERNAL_URL;
		delete process.env.KRATOS_ADMIN_URL;
		delete process.env.HYDRA_ADMIN_URL;
		const res = await GET();
		expect(res.status).toBe(200);
		const body = await res.json();
		for (const svc of ["athena", "hera", "kratos", "hydra"] as const) {
			expect(body[svc]).toEqual({ isHealthy: false, version: null, error: "Not configured" });
		}
	});

	it("returns healthy results for all four services when fetch succeeds", async () => {
		process.env.ATHENA_INTERNAL_URL = "http://athena.internal";
		process.env.HERA_INTERNAL_URL = "http://hera.internal";
		process.env.KRATOS_ADMIN_URL = "http://kratos.admin";
		process.env.HYDRA_ADMIN_URL = "http://hydra.admin";

		const fetchMock = vi.fn().mockImplementation(async (url: string) => {
			if (url.includes("athena")) return { json: () => Promise.resolve({ version: "1.0.0" }) };
			if (url.includes("hera")) return { json: () => Promise.resolve({ version: "2.0.0" }) };
			if (url.includes("kratos")) return { json: () => Promise.resolve({ version: "3.0.0" }) };
			return { json: () => Promise.resolve({ version: "4.0.0" }) };
		});
		vi.stubGlobal("fetch", fetchMock);

		const res = await GET();
		const body = await res.json();
		expect(body.athena).toEqual({ isHealthy: true, version: "1.0.0" });
		expect(body.hera).toEqual({ isHealthy: true, version: "2.0.0" });
		expect(body.kratos).toEqual({ isHealthy: true, version: "3.0.0" });
		expect(body.hydra).toEqual({ isHealthy: true, version: "4.0.0" });
	});

	it("returns version=null when response lacks a version field", async () => {
		process.env.ATHENA_INTERNAL_URL = "http://athena.internal";
		delete process.env.HERA_INTERNAL_URL;
		delete process.env.KRATOS_ADMIN_URL;
		delete process.env.HYDRA_ADMIN_URL;
		const fetchMock = vi.fn().mockResolvedValue({ json: () => Promise.resolve({}) });
		vi.stubGlobal("fetch", fetchMock);
		const res = await GET();
		const body = await res.json();
		expect(body.athena).toEqual({ isHealthy: true, version: null });
	});

	it("returns error details when fetch throws", async () => {
		process.env.ATHENA_INTERNAL_URL = "http://athena.internal";
		delete process.env.HERA_INTERNAL_URL;
		delete process.env.KRATOS_ADMIN_URL;
		delete process.env.HYDRA_ADMIN_URL;
		const fetchMock = vi.fn().mockRejectedValue(new Error("timeout"));
		vi.stubGlobal("fetch", fetchMock);
		const res = await GET();
		const body = await res.json();
		expect(body.athena).toEqual({ isHealthy: false, version: null, error: "timeout" });
	});

	it("returns 'Unable to connect' fallback when thrown error has no message", async () => {
		process.env.ATHENA_INTERNAL_URL = "http://athena.internal";
		delete process.env.HERA_INTERNAL_URL;
		delete process.env.KRATOS_ADMIN_URL;
		delete process.env.HYDRA_ADMIN_URL;
		const err: { message?: string } = {};
		const fetchMock = vi.fn().mockRejectedValue(err);
		vi.stubGlobal("fetch", fetchMock);
		const res = await GET();
		const body = await res.json();
		expect(body.athena).toEqual({ isHealthy: false, version: null, error: "Unable to connect" });
	});
});
