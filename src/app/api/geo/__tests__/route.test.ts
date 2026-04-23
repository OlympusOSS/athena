/**
 * Unit tests for POST /api/geo — Server-side IP geolocation resolver.
 *
 * Mocks @/services/geo/ip-geolocation (resolveIPs, clusterGeoResults) so the
 * route can be exercised without network access.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildRequest } from "@/app/api/__tests__/helpers";
import { POST } from "../route";

const { mockResolveIPs, mockClusterGeoResults } = vi.hoisted(() => ({
	mockResolveIPs: vi.fn(),
	mockClusterGeoResults: vi.fn(),
}));

vi.mock("@/services/geo/ip-geolocation", () => ({
	resolveIPs: mockResolveIPs,
	clusterGeoResults: mockClusterGeoResults,
}));

beforeEach(() => {
	vi.clearAllMocks();
});

describe("POST /api/geo", () => {
	it("returns empty points when ips array is empty", async () => {
		const req = buildRequest("POST", "http://localhost:4001/api/geo", { body: { ips: [] } });
		const res = await POST(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.points).toEqual([]);
		expect(mockResolveIPs).not.toHaveBeenCalled();
	});

	it("returns empty points when ips field is missing", async () => {
		const req = buildRequest("POST", "http://localhost:4001/api/geo", { body: {} });
		const res = await POST(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.points).toEqual([]);
	});

	it("returns empty points when body is null", async () => {
		// body is empty => body?.ips is undefined => Array.isArray false
		const req = new Request("http://localhost:4001/api/geo", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(null),
		});
		const res = await POST(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.points).toEqual([]);
	});

	it("returns empty points when ips is non-array value", async () => {
		const req = buildRequest("POST", "http://localhost:4001/api/geo", { body: { ips: "not-an-array" } });
		const res = await POST(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.points).toEqual([]);
	});

	it("resolves IPs and returns clustered points", async () => {
		mockResolveIPs.mockResolvedValue([{ ip: "1.2.3.4", lat: 40.7, lng: -74, city: "NYC", country: "US" }]);
		mockClusterGeoResults.mockReturnValue([{ lat: 40.7, lng: -74, label: "NYC, US", count: 1 }]);
		const req = buildRequest("POST", "http://localhost:4001/api/geo", { body: { ips: ["1.2.3.4"] } });
		const res = await POST(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.points).toHaveLength(1);
		expect(body.points[0]).toEqual({ lat: 40.7, lng: -74, label: "NYC, US", count: 1 });
		expect(mockResolveIPs).toHaveBeenCalledWith(["1.2.3.4"]);
		expect(mockClusterGeoResults).toHaveBeenCalled();
	});

	it("returns empty points when request.json() throws", async () => {
		const req = new Request("http://localhost:4001/api/geo", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "not-json",
		});
		const res = await POST(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.points).toEqual([]);
	});

	it("returns empty points when resolveIPs throws", async () => {
		mockResolveIPs.mockRejectedValue(new Error("network down"));
		const req = buildRequest("POST", "http://localhost:4001/api/geo", { body: { ips: ["1.2.3.4"] } });
		const res = await POST(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.points).toEqual([]);
	});
});
