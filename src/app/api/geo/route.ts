import { NextResponse } from "next/server";
import { clusterGeoResults, resolveIPs } from "@/services/geo/ip-geolocation";

/**
 * POST /api/geo — Server-side IP geolocation resolver.
 *
 * Accepts { ips: string[] }, resolves them via ip-api.com (server-to-server,
 * no CORS / mixed-content issues), and returns clustered geo points.
 */
export async function POST(request: Request) {
	try {
		const body = await request.json();
		const ips: string[] = body?.ips;

		if (!Array.isArray(ips) || ips.length === 0) {
			return NextResponse.json({ points: [] });
		}

		const geoResults = await resolveIPs(ips);
		const points = clusterGeoResults(geoResults);

		return NextResponse.json({ points });
	} catch (err) {
		console.error("[api/geo] Geolocation failed:", err);
		return NextResponse.json({ points: [] });
	}
}
