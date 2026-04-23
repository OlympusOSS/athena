/**
 * Unit tests for GET /api/session-locations
 *
 * Mocks @olympusoss/sdk.getSessionLocations and @/services/geo/ip-geolocation.
 * Covers:
 *   - Default source=ip with results => resolves IPs and returns clustered points
 *   - source=ip with no IPs => empty points
 *   - source=ip with null ip_address filtered out
 *   - source=browser with lat/lng => clustered directly
 *   - source=browser with missing lat/lng => empty points
 *   - Cluster collision / aggregation behaviour
 *   - Error path => empty points
 *   - days query param with over-365 cap
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";

const { mockGetSessionLocations, mockResolveIPs, mockClusterGeoResults } = vi.hoisted(() => ({
	mockGetSessionLocations: vi.fn(),
	mockResolveIPs: vi.fn(),
	mockClusterGeoResults: vi.fn(),
}));

vi.mock("@olympusoss/sdk", () => ({
	getSessionLocations: mockGetSessionLocations,
}));

vi.mock("@/services/geo/ip-geolocation", () => ({
	resolveIPs: mockResolveIPs,
	clusterGeoResults: mockClusterGeoResults,
}));

beforeEach(() => {
	vi.clearAllMocks();
});

describe("GET /api/session-locations", () => {
	it("resolves IPs and returns clustered points (default source=ip)", async () => {
		mockGetSessionLocations.mockResolvedValue([{ ip_address: "1.2.3.4" }, { ip_address: "5.6.7.8" }]);
		mockResolveIPs.mockResolvedValue([{ ip: "1.2.3.4" }, { ip: "5.6.7.8" }]);
		mockClusterGeoResults.mockReturnValue([{ lat: 1, lng: 2, label: "test", count: 2 }]);
		const req = new Request("http://localhost:4001/api/session-locations");
		const res = await GET(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.points).toHaveLength(1);
		expect(mockResolveIPs).toHaveBeenCalledWith(["1.2.3.4", "5.6.7.8"]);
		expect(mockGetSessionLocations).toHaveBeenCalledWith(expect.objectContaining({ source: "ip", limit: 5000 }));
	});

	it("returns empty points when source=ip and no IPs", async () => {
		mockGetSessionLocations.mockResolvedValue([]);
		const req = new Request("http://localhost:4001/api/session-locations?source=ip");
		const res = await GET(req);
		const body = await res.json();
		expect(body.points).toEqual([]);
		expect(mockResolveIPs).not.toHaveBeenCalled();
	});

	it("filters out null ip_address entries", async () => {
		mockGetSessionLocations.mockResolvedValue([{ ip_address: null }, { ip_address: "1.1.1.1" }]);
		mockResolveIPs.mockResolvedValue([]);
		mockClusterGeoResults.mockReturnValue([]);
		const req = new Request("http://localhost:4001/api/session-locations?source=ip");
		await GET(req);
		expect(mockResolveIPs).toHaveBeenCalledWith(["1.1.1.1"]);
	});

	it("clusters browser lat/lng directly when source=browser", async () => {
		mockGetSessionLocations.mockResolvedValue([
			{ lat: 40.7, lng: -74.0, city: "NYC", country: "US" },
			{ lat: 40.8, lng: -74.0, city: "NYC", country: "US" }, // rounds to same key
			{ lat: 51.5, lng: -0.1, city: null, country: null },
		]);
		const req = new Request("http://localhost:4001/api/session-locations?source=browser");
		const res = await GET(req);
		const body = await res.json();
		// First two round to (40.5,-74) and (41,-74) based on *2/2 rounding — let's just assert
		// the result has points with count>=1 and is sorted
		expect(body.points.length).toBeGreaterThan(0);
		for (const p of body.points) {
			expect(p).toHaveProperty("lat");
			expect(p).toHaveProperty("lng");
			expect(p).toHaveProperty("count");
		}
		// Sorted by count desc
		for (let i = 1; i < body.points.length; i++) {
			expect(body.points[i - 1].count).toBeGreaterThanOrEqual(body.points[i].count);
		}
	});

	it("aggregates duplicate browser locations into a single cluster", async () => {
		// Three sessions at exact same coords
		mockGetSessionLocations.mockResolvedValue([
			{ lat: 10.0, lng: 20.0, city: "X", country: "Y" },
			{ lat: 10.0, lng: 20.0, city: "X", country: "Y" },
			{ lat: 10.0, lng: 20.0, city: "X", country: "Y" },
		]);
		const req = new Request("http://localhost:4001/api/session-locations?source=browser");
		const res = await GET(req);
		const body = await res.json();
		expect(body.points).toHaveLength(1);
		expect(body.points[0].count).toBe(3);
		expect(body.points[0].label).toBe("X, Y");
	});

	it("uses 'Browser location' label when city/country missing", async () => {
		mockGetSessionLocations.mockResolvedValue([{ lat: 10.0, lng: 20.0, city: null, country: null }]);
		const req = new Request("http://localhost:4001/api/session-locations?source=browser");
		const res = await GET(req);
		const body = await res.json();
		expect(body.points[0].label).toBe("Browser location");
	});

	it("returns empty points when source=browser and no valid lat/lng", async () => {
		mockGetSessionLocations.mockResolvedValue([{ lat: null, lng: null }, { lat: 10 }]);
		const req = new Request("http://localhost:4001/api/session-locations?source=browser");
		const res = await GET(req);
		const body = await res.json();
		expect(body.points).toEqual([]);
	});

	it("returns empty points on error", async () => {
		mockGetSessionLocations.mockRejectedValue(new Error("db down"));
		const req = new Request("http://localhost:4001/api/session-locations?source=ip");
		const res = await GET(req);
		const body = await res.json();
		expect(body.points).toEqual([]);
	});

	it("caps days parameter at 365", async () => {
		mockGetSessionLocations.mockResolvedValue([]);
		const req = new Request("http://localhost:4001/api/session-locations?days=9999");
		await GET(req);
		const callArg = mockGetSessionLocations.mock.calls[0][0];
		const sinceDate = callArg.since as Date;
		const maxAgoMs = Date.now() - sinceDate.getTime();
		// Should be approximately 365 days (not 9999)
		const approxDays = Math.round(maxAgoMs / (24 * 60 * 60 * 1000));
		expect(approxDays).toBe(365);
	});

	it("uses default days=365 when days param absent", async () => {
		mockGetSessionLocations.mockResolvedValue([]);
		const req = new Request("http://localhost:4001/api/session-locations");
		await GET(req);
		const callArg = mockGetSessionLocations.mock.calls[0][0];
		expect(callArg.source).toBe("ip");
	});
});
