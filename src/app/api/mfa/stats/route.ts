import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/mfa/stats
 * Returns MFA enrollment statistics.
 *
 * Protected by middleware — requires admin role (ADMIN_PREFIXES includes /api/mfa).
 *
 * Stats are derived from Kratos identity data. Until a dedicated SDK method is
 * available to query MFA enrollment state, this route returns a structured stub
 * that is safe to consume by the analytics dashboard.
 *
 * Response shape:
 *   { enrolled: number, total: number, rate: number }
 *
 *   enrolled  — users who have at least one active MFA factor
 *   total     — total identity count
 *   rate      — enrolled / total (0–1), or 0 when total === 0
 */
export async function GET() {
	try {
		// Stub: SDK-level MFA enrollment query is not yet available.
		// The shape and field names are stable — callers may depend on them.
		const stats = {
			enrolled: 0,
			total: 0,
			rate: 0,
		};

		return NextResponse.json(stats);
	} catch (error) {
		console.error("Failed to fetch MFA stats:", error);
		return NextResponse.json({ error: "Failed to fetch MFA stats" }, { status: 500 });
	}
}
