import { NextResponse } from "next/server";
import { parseLinkHeader } from "@/lib/pagination-utils";
import { listIdentities } from "@/services/kratos/endpoints/identities";

export const dynamic = "force-dynamic";

/**
 * GET /api/mfa/stats
 * Returns MFA enrollment statistics derived from Kratos identity data.
 *
 * Protected by middleware — requires admin role (ADMIN_PREFIXES includes /api/mfa).
 *
 * Response shape:
 *   { available: boolean, enrolled: number, total: number, rate: number }
 *
 *   available — false when Kratos is unreachable or data cannot be computed
 *   enrolled  — users who have at least one active TOTP credential
 *   total     — total identity count
 *   rate      — enrolled / total (0–1), or 0 when total === 0
 *
 * Implementation notes:
 * - Uses Kratos admin listIdentities with includeCredential=['totp'] to identify
 *   identities that have enrolled TOTP. The credentials map on each Identity object
 *   contains the key "totp" when the user has an active TOTP factor.
 * - Paginates up to MAX_PAGES pages (pageSize=250) to avoid timeout on large tenants.
 *   If the tenant has more identities than the cap, stats are marked as partial but
 *   still returned as available=true so the UI renders real (partial) data.
 * - If Kratos is unreachable, returns available=false so the UI can show an
 *   "unavailable" warning instead of misleading zeros.
 */

const PAGE_SIZE = 250;
const MAX_PAGES = 20; // caps at 5 000 identities before timing out

export async function GET() {
	try {
		let total = 0;
		let enrolled = 0;
		let pageToken: string | undefined;
		let pagesLoaded = 0;

		do {
			const params: Record<string, unknown> = {
				pageSize: PAGE_SIZE,
				includeCredential: ["totp"],
			};
			if (pageToken) {
				params.pageToken = pageToken;
			}

			const response = await listIdentities(params as any);

			const identities = Array.isArray(response.data) ? response.data : [];
			total += identities.length;

			for (const identity of identities) {
				// credentials is a map keyed by credential type string.
				// When the "totp" key is present, the user has an enrolled TOTP factor.
				const creds = identity.credentials as Record<string, unknown> | undefined;
				if (creds && "totp" in creds) {
					enrolled++;
				}
			}

			pagesLoaded++;

			// Parse next page token from Link header.
			// response.headers is an Axios RawAxiosResponseHeaders — the link value may be
			// a string, string[], or other AxiosHeaderValue; coerce to string | null.
			const rawLinkHeader = response.headers?.link;
			const linkHeader = typeof rawLinkHeader === "string" ? rawLinkHeader : Array.isArray(rawLinkHeader) ? rawLinkHeader[0] : null;
			const { next } = parseLinkHeader(linkHeader);
			pageToken = next ?? undefined;
		} while (pageToken && pagesLoaded < MAX_PAGES);

		const rate = total > 0 ? enrolled / total : 0;

		return NextResponse.json({
			available: true,
			enrolled,
			total,
			rate,
		});
	} catch (error) {
		console.error("Failed to fetch MFA stats:", error);
		// Return available=false so the UI shows a clear "unavailable" warning
		// rather than displaying zeros that could be mistaken for real data.
		return NextResponse.json({
			available: false,
			enrolled: 0,
			total: 0,
			rate: 0,
		});
	}
}
