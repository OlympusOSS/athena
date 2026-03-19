/**
 * IP Geolocation service — resolves IP addresses to lat/lng + city/country.
 *
 * Uses ip-api.com batch endpoint (free tier: 45 req/min, 100 IPs/batch).
 * Results are cached in-memory for the session lifetime.
 */

export interface GeoResult {
	ip: string;
	lat: number;
	lng: number;
	city: string;
	country: string;
	countryCode: string;
	/** "city, CC" display label */
	label: string;
}

const BATCH_URL = "http://ip-api.com/batch?fields=query,lat,lon,city,country,countryCode,status";
const MAX_BATCH = 100;

/** In-memory cache: IP → GeoResult */
const cache = new Map<string, GeoResult | null>();

/**
 * Resolve an array of IP addresses to geographic coordinates.
 * Returns only successfully resolved results (skips private/localhost IPs).
 * In local dev where all IPs are private, falls back to the machine's public IP.
 */
export async function resolveIPs(ips: string[]): Promise<GeoResult[]> {
	// Deduplicate and filter out already-cached + obviously local IPs
	const unique = [...new Set(ips)].filter((ip) => {
		if (cache.has(ip)) return false;
		if (isLocalIP(ip)) {
			cache.set(ip, null);
			return false;
		}
		return true;
	});

	// If every IP was local (dev environment), resolve the machine's public IP
	// so the heat map has something to display
	if (unique.length === 0 && ips.length > 0 && !cache.has("__public_ip__")) {
		const publicIP = await fetchPublicIP();
		if (publicIP) {
			unique.push(publicIP);
		} else {
			cache.set("__public_ip__", null); // mark as attempted so we don't retry
		}
	}

	// Batch resolve uncached IPs
	for (let i = 0; i < unique.length; i += MAX_BATCH) {
		const batch = unique.slice(i, i + MAX_BATCH);
		try {
			const res = await fetch(BATCH_URL, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(batch),
			});
			if (!res.ok) throw new Error(`ip-api returned ${res.status}`);
			const results: Array<{
				query: string;
				status: string;
				lat?: number;
				lon?: number;
				city?: string;
				country?: string;
				countryCode?: string;
			}> = await res.json();

			for (const r of results) {
				if (r.status === "success" && r.lat != null && r.lon != null) {
					const geo: GeoResult = {
						ip: r.query,
						lat: r.lat,
						lng: r.lon,
						city: r.city || "Unknown",
						country: r.country || "Unknown",
						countryCode: r.countryCode || "",
						label: r.city && r.countryCode ? `${r.city}, ${r.countryCode}` : r.country || "Unknown",
					};
					cache.set(r.query, geo);
					// If this was the public IP fallback, store it for local IP mapping
					if (!cache.has("__public_ip__") || cache.get("__public_ip__") === null) {
						cache.set("__public_ip__", geo);
					}
				} else {
					cache.set(r.query, null);
				}
			}
		} catch (err) {
			// Mark the whole batch as unresolvable so we don't retry
			for (const ip of batch) {
				if (!cache.has(ip)) cache.set(ip, null);
			}
			console.warn("[geo] IP batch resolution failed:", err);
		}
	}

	// Return all resolved results for the requested IPs.
	// For local IPs that had no direct result, fall back to the public IP result.
	const publicResult = cache.get("__public_ip__");
	const results: GeoResult[] = [];
	for (const ip of ips) {
		const r = cache.get(ip);
		if (r) {
			results.push(r);
		} else if (isLocalIP(ip) && publicResult) {
			results.push({ ...publicResult, ip });
		}
	}
	return results;
}

/**
 * Aggregate GeoResults into location clusters for the heat map.
 * Groups by city (rounded lat/lng for nearby locations).
 */
export function clusterGeoResults(results: GeoResult[]): Array<{ lat: number; lng: number; label: string; count: number }> {
	// Group by rounded lat/lng (0.5 degree ≈ ~50km — enough to cluster a city)
	const clusters = new Map<string, { lat: number; lng: number; label: string; count: number }>();

	for (const r of results) {
		const roundedLat = Math.round(r.lat * 2) / 2;
		const roundedLng = Math.round(r.lng * 2) / 2;
		const key = `${roundedLat},${roundedLng}`;

		const existing = clusters.get(key);
		if (existing) {
			existing.count++;
		} else {
			clusters.set(key, {
				lat: roundedLat,
				lng: roundedLng,
				label: r.label,
				count: 1,
			});
		}
	}

	return [...clusters.values()].sort((a, b) => b.count - a.count);
}

/** Fetch the machine's public IP via a lightweight API */
async function fetchPublicIP(): Promise<string | null> {
	try {
		const res = await fetch("https://api.ipify.org?format=json");
		if (!res.ok) return null;
		const data: { ip: string } = await res.json();
		return data.ip || null;
	} catch {
		return null;
	}
}

/** Check if an IP is local / private / loopback */
function isLocalIP(ip: string): boolean {
	return (
		ip === "127.0.0.1" ||
		ip === "::1" ||
		ip === "0.0.0.0" ||
		ip.startsWith("10.") ||
		ip.startsWith("172.16.") ||
		ip.startsWith("172.17.") ||
		ip.startsWith("172.18.") ||
		ip.startsWith("172.19.") ||
		ip.startsWith("172.2") ||
		ip.startsWith("172.3") ||
		ip.startsWith("192.168.") ||
		ip.startsWith("fc") ||
		ip.startsWith("fd") ||
		ip.startsWith("fe80:")
	);
}
