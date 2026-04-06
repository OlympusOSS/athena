/**
 * POST /api/clients/m2m/:id/rotate-secret — Rotate the client secret for an M2M client
 *
 * Auth: enforced by middleware.ts (ADMIN_PREFIXES includes "/api/clients").
 * x-user-id and x-user-email headers are injected by middleware for admin routes.
 *
 * SECURITY:
 *   - The new client_secret is generated server-side using crypto.randomBytes(32).toString("hex")
 *   - The rotation uses setOAuth2Client (PUT) — the only correct mechanism in @ory/hydra-client
 *     (no rotateOAuth2ClientSecret method or /lifesign endpoint exists in this version)
 *   - The old secret is immediately invalidated — token requests using it return 401
 *   - The new secret is returned ONCE in the response body; it is NEVER logged or persisted
 *
 * OQ-3 verified (2026-04-05): Hydra PUT /admin/clients/:id echoes the plaintext client_secret
 * in the 200 response body. The rotation route returns response.data.client_secret (the Hydra
 * echo) rather than the locally-generated value, in case Hydra re-encodes the secret.
 *
 * Rotation mechanism verified against @ory/hydra-client api.d.ts — DA PROCEED (athena#50, 2026-04-02).
 */

import { type NextRequest, NextResponse } from "next/server";
import { rotateOAuth2ClientSecret } from "@/services/hydra";

export const dynamic = "force-dynamic";

/**
 * Emit a structured audit event to stdout.
 * SECURITY: client_secret MUST NOT appear in any audit event field.
 * The type:"audit" discriminator enables log pipeline filtering:
 * Loki LogQL: {app="athena"} | json | type="audit"
 */
function emitAuditEvent(event: { event: string; client_id: string; admin_id: string; admin_email: string; timestamp: string }): void {
	process.stdout.write(
		`${JSON.stringify({
			type: "audit",
			...event,
		})}\n`,
	);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
	const { id: clientId } = await params;
	const adminId = request.headers.get("x-user-id") ?? "unknown";
	const adminEmail = request.headers.get("x-user-email") ?? "unknown";

	if (!clientId) {
		return NextResponse.json({ error: "missing_required_field", field: "id", message: "Client ID is required." }, { status: 400 });
	}

	let rotated: { client_id: string; client_secret: string };
	try {
		rotated = await rotateOAuth2ClientSecret(clientId);
	} catch (error) {
		// C2 (log sanitization): only log the error message, never any response body
		// or any field that could contain client_secret
		console.error("[api/clients/m2m] rotate-secret failed:", error instanceof Error ? error.message : "Unknown error");
		return NextResponse.json(
			{
				error: "upstream_unavailable",
				message: "The OAuth2 server is temporarily unavailable.",
				suggestion: "Retry in a few seconds. If the problem persists, check the platform health at /health.",
			},
			{ status: 502 },
		);
	}

	// SR-4 / athena#76: Emit audit event for secret rotation.
	// SECURITY: client_secret is NEVER included in audit events.
	emitAuditEvent({
		event: "m2m_client.secret_rotated",
		client_id: clientId,
		admin_id: adminId,
		admin_email: adminEmail,
		timestamp: new Date().toISOString(),
	});

	// Return the new secret (one-time disclosure — same pattern as creation).
	// The caller must present this to the admin and warn that it will not be shown again.
	return NextResponse.json({
		client_id: rotated.client_id,
		client_secret: rotated.client_secret,
	});
}
