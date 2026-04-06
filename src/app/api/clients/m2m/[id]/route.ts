/**
 * DELETE /api/clients/m2m/:id — Delete an M2M OAuth2 client
 *
 * Auth: enforced by middleware.ts (ADMIN_PREFIXES includes "/api/clients").
 * x-user-id and x-user-email headers are injected by middleware for admin routes.
 *
 * Security: Deleting the client immediately deregisters it from Hydra.
 * Subsequent POST /oauth2/token requests using the deleted client_id return 401.
 *
 * NOTE: Existing access tokens issued to the deleted client remain valid until
 * their natural TTL expiry — Hydra does not revoke in-flight tokens on client
 * deletion. This is the documented Hydra behavior (tested in T-7: F10/token-survival).
 */

import { type NextRequest, NextResponse } from "next/server";
import { deleteOAuth2Client } from "@/services/hydra";

export const dynamic = "force-dynamic";

/**
 * Emit a structured audit event to stdout.
 * SECURITY: client_secret MUST NOT appear in any audit event field.
 */
function emitAuditEvent(event: { event: string; client_id: string; admin_id: string; admin_email: string; timestamp: string }): void {
	process.stdout.write(
		`${JSON.stringify({
			type: "audit",
			...event,
		})}\n`,
	);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
	const { id: clientId } = await params;
	const adminId = request.headers.get("x-user-id") ?? "unknown";
	const adminEmail = request.headers.get("x-user-email") ?? "unknown";

	if (!clientId) {
		return NextResponse.json({ error: "missing_required_field", field: "id", message: "Client ID is required." }, { status: 400 });
	}

	try {
		await deleteOAuth2Client(clientId);
	} catch (error) {
		// C2: never log details that could contain sensitive data
		console.error("[api/clients/m2m] DELETE failed:", error instanceof Error ? error.message : "Unknown error");
		return NextResponse.json(
			{
				error: "upstream_unavailable",
				message: "The OAuth2 server is temporarily unavailable.",
				suggestion: "Retry in a few seconds. If the problem persists, check the platform health at /health.",
			},
			{ status: 502 },
		);
	}

	// SR-4 / athena#76: Emit audit event for client deletion.
	emitAuditEvent({
		event: "m2m_client.deleted",
		client_id: clientId,
		admin_id: adminId,
		admin_email: adminEmail,
		timestamp: new Date().toISOString(),
	});

	return new NextResponse(null, { status: 204 });
}
