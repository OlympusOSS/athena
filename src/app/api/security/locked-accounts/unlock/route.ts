import { unlockAccount } from "@olympusoss/sdk";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/security/locked-accounts/unlock
 *
 * Manually unlocks an account. The identifier is read from the request body
 * as `{ "identifier": "user@example.com" }`. Auth is enforced by middleware —
 * the x-user-id header carries the admin's Kratos identity UUID and is used
 * as adminIdentityId for audit attribution.
 *
 * Returns 404 when no active lockout is found for the identifier.
 * Returns 500 on DB error (unlockAccount throws).
 */
export async function POST(request: NextRequest) {
	const adminIdentityId = request.headers.get("x-user-id");

	if (!adminIdentityId) {
		// athena#60: standardized error shape
		return NextResponse.json(
			{
				error: "not_authenticated",
				message: "Authentication required.",
				hint: "Authenticate via /api/auth/login",
			},
			{ status: 401 },
		);
	}

	const body = await request.json().catch(() => null);
	const identifier: string | undefined = body?.identifier;

	if (!identifier || typeof identifier !== "string") {
		return NextResponse.json({ error: "Missing or invalid identifier" }, { status: 400 });
	}

	try {
		const unlocked = await unlockAccount(identifier, adminIdentityId);

		if (!unlocked) {
			return NextResponse.json({ error: "No active lockout found" }, { status: 404 });
		}

		return NextResponse.json({ success: true, identifier });
	} catch (error) {
		console.error(`[api/security/locked-accounts] Failed to unlock account "${identifier}":`, error);
		return NextResponse.json({ error: "Failed to unlock account" }, { status: 500 });
	}
}
