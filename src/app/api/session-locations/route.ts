import { getSessionLocations } from "@olympusoss/sdk";
import { NextResponse } from "next/server";
import { clusterGeoResults, resolveIPs } from "@/services/geo/ip-geolocation";

/**
 * GET /api/session-locations — Read session location data for the heat map.
 *
 * Query params:
 * - source: "ip" | "browser" (default: "ip")
 * - days: number of days to look back (default: 365)
 */
export async function GET(request: Request) {
	try {
		const url = new URL(request.url);
		const source = (url.searchParams.get("source") || "ip") as "ip" | "browser";
		const days = Math.min(Number.parseInt(url.searchParams.get("days") || "365", 10), 365);
		const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

		const locations = await getSessionLocations({ source, since, limit: 5000 });

		if (source === "ip") {
			// Resolve stored IP addresses to geo coordinates
			const ips = locations.map((loc) => loc.ip_address).filter((ip): ip is string => ip != null);

			if (ips.length === 0) {
				return NextResponse.json({ points: [] });
			}

			const geoResults = await resolveIPs(ips);
			const points = clusterGeoResults(geoResults);
			return NextResponse.json({ points });
		}

		// Browser source: cluster the lat/lng coordinates directly
		const validLocations = locations.filter((loc) => loc.lat != null && loc.lng != null);

		if (validLocations.length === 0) {
			return NextResponse.json({ points: [] });
		}

		// Cluster browser geo points using same rounding strategy as clusterGeoResults
		const clusters = new Map<string, { lat: number; lng: number; label: string; count: number }>();
		for (const loc of validLocations) {
			const roundedLat = Math.round(loc.lat! * 2) / 2;
			const roundedLng = Math.round(loc.lng! * 2) / 2;
			const key = `${roundedLat},${roundedLng}`;

			const existing = clusters.get(key);
			if (existing) {
				existing.count++;
			} else {
				clusters.set(key, {
					lat: roundedLat,
					lng: roundedLng,
					label: loc.city && loc.country ? `${loc.city}, ${loc.country}` : "Browser location",
					count: 1,
				});
			}
		}

		const points = [...clusters.values()].sort((a, b) => b.count - a.count);
		return NextResponse.json({ points });
	} catch (err) {
		console.error("[api/session-locations] Failed:", err);
		return NextResponse.json({ points: [] });
	}
}
