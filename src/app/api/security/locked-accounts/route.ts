import { listLockedAccounts } from "@olympusoss/sdk";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/security/locked-accounts
 *
 * Returns all active lockouts. Auth is enforced by middleware (session +
 * admin role check via ADMIN_PREFIXES — see middleware.ts). The x-user-id
 * header is injected by middleware with the caller's Kratos identity UUID.
 */
const HARD_CAP = 500;

export async function GET(_request: Request) {
	try {
		const accounts = await listLockedAccounts();
		const truncated = accounts.length > HARD_CAP;
		const data = truncated ? accounts.slice(0, HARD_CAP) : accounts;
		return NextResponse.json({ data, total: data.length, truncated });
	} catch (error) {
		console.error("[api/security/locked-accounts] Failed to list locked accounts:", error);
		return NextResponse.json({ error: "Failed to list locked accounts" }, { status: 500 });
	}
}
