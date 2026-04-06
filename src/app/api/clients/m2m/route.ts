/**
 * GET  /api/clients/m2m  — List all M2M OAuth2 clients
 * POST /api/clients/m2m  — Create a new M2M OAuth2 client
 *
 * Auth: enforced by middleware.ts (ADMIN_PREFIXES includes "/api/clients").
 * x-user-id and x-user-email headers are injected by middleware for admin routes.
 *
 * Security conditions addressed (athena#50 Security Review):
 *   SC1: Scope allowlist — all requested scopes are validated against M2M_PERMITTED_SCOPES
 *        before the Hydra call is made; invalid scopes return 422 without calling Hydra
 *   SC2: client_secret is NEVER logged — only returned in the 201 response body once
 *   SC4: Audit events emitted via process.stdout.write with type:"audit" discriminator
 *   SC5: Auth enforced by middleware (admin session + admin role)
 *   SC6: client_secret absent from error logs and catch blocks
 *
 * OQ-3 verified (2026-04-05): Hydra POST /admin/clients echoes plaintext client_secret
 * in the 201 response body. This is the one-time disclosure — Athena passes it through
 * to the browser and immediately discards it. It is NOT written to any log, store, or cache.
 */

import { type NextRequest, NextResponse } from "next/server";
import { createM2MClientSchema, validateM2MScopes } from "@/features/oauth2-clients/constants";
import { M2M_PERMITTED_SCOPES } from "@/lib/m2m-scopes";
import { createOAuth2Client, getAllOAuth2Clients } from "@/services/hydra";

export const dynamic = "force-dynamic";

/**
 * Emit a structured audit event to stdout.
 *
 * SECURITY: client_secret MUST NOT appear in any audit event field — ever.
 * client_id is a system identifier and is safe to log.
 *
 * The type:"audit" discriminator enables log pipeline filtering:
 * Loki LogQL: {app="athena"} | json | type="audit"
 * See platform#27 for the log aggregator configuration task.
 */
function emitAuditEvent(event: {
	event: string;
	client_id: string;
	client_name?: string;
	scope?: string;
	admin_id: string;
	admin_email: string;
	timestamp: string;
}): void {
	process.stdout.write(
		`${JSON.stringify({
			type: "audit",
			...event,
		})}\n`,
	);
}

/**
 * GET /api/clients/m2m
 *
 * Returns all M2M clients — those with metadata.client_type === "m2m".
 * client_secret is NEVER returned in list responses (Hydra does not expose it
 * after initial creation).
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
	try {
		const result = await getAllOAuth2Clients({ pageSize: 250 });
		const allClients = result.clients ?? [];

		// Filter to M2M clients only (metadata.client_type === "m2m")
		const m2mClients = allClients.filter(
			(client) =>
				client.metadata !== null && typeof client.metadata === "object" && (client.metadata as Record<string, unknown>).client_type === "m2m",
		);

		// Strip client_secret from all list responses (belt-and-suspenders —
		// Hydra does not return it after creation, but we enforce this explicitly)
		const safeClients = m2mClients.map(({ client_secret: _dropped, ...rest }) => rest);

		return NextResponse.json({ clients: safeClients });
	} catch (error) {
		// C2: never log error details that could contain client_secret
		console.error("[api/clients/m2m] GET failed:", error instanceof Error ? error.message : "Unknown error");
		return NextResponse.json(
			{
				error: "upstream_unavailable",
				message: "The OAuth2 server is temporarily unavailable.",
				suggestion: "Retry in a few seconds. If the problem persists, check the platform health at /health.",
			},
			{ status: 502 },
		);
	}
}

/**
 * POST /api/clients/m2m
 *
 * Creates a new M2M OAuth2 client in Hydra.
 *
 * Validation ordering (mandatory, non-skippable per athena#74 SR-ATHENA-2):
 *   1. Zod schema parse — rejects malformed bodies
 *   2. validateM2MScopes() — checks each scope against M2M_PERMITTED_SCOPES
 *   3. token_lifetime range check (1–3600s)
 *   4. createOAuth2Client() — only called if steps 1-3 all pass
 *
 * The response includes client_secret (plaintext) exactly once.
 * This is the ONLY time the secret is ever available — the caller must
 * display it immediately and never request it again.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
	const adminId = request.headers.get("x-user-id") ?? "unknown";
	const adminEmail = request.headers.get("x-user-email") ?? "unknown";

	let parsedBody: unknown;
	try {
		parsedBody = await request.json();
	} catch {
		return NextResponse.json(
			{
				error: "missing_required_field",
				message: "Request body must be valid JSON.",
				suggestion: "Ensure Content-Type: application/json and a valid JSON body.",
			},
			{ status: 400 },
		);
	}

	// Step 1: Zod schema validation
	const parseResult = createM2MClientSchema.safeParse(parsedBody);
	if (!parseResult.success) {
		const firstError = parseResult.error.issues[0];
		const field = firstError?.path?.[0]?.toString() ?? "unknown";
		return NextResponse.json(
			{
				error: "missing_required_field",
				field,
				message: firstError?.message ?? "Validation failed",
				suggestion: `Provide a valid value for the '${field}' field.`,
			},
			{ status: 400 },
		);
	}

	const body = parseResult.data;

	// Step 2: Server-side scope allowlist validation (SC1 / SR-ATHENA-1)
	const scopeValidation = validateM2MScopes(body.scope);
	if (!scopeValidation.valid) {
		// SECURITY: error message is deliberately generic to prevent scope enumeration.
		// The permitted_scopes array tells the caller what IS allowed without revealing
		// what specific scope they sent that was rejected.
		return NextResponse.json(
			{
				error: "invalid_scope",
				message: scopeValidation.message,
				permitted_scopes: [...M2M_PERMITTED_SCOPES],
				suggestion: "Select only scopes from the permitted_scopes list.",
			},
			{ status: 422 },
		);
	}

	// Step 3: Token lifetime range check is already enforced by Zod schema (1–3600s).
	// The Zod schema rejects out-of-range values with a 400 in step 1.
	// This block is a belt-and-suspenders check in case the schema changes.
	const tokenLifetime = body.token_lifetime;
	if (tokenLifetime !== undefined && (tokenLifetime < 1 || tokenLifetime > 3600)) {
		return NextResponse.json(
			{
				error: "invalid_parameter",
				field: "token_lifetime",
				message: `token_lifetime must be between 1 and 3600 seconds. Received: ${tokenLifetime}.`,
				suggestion: "For AI agent tokens, 300 seconds is recommended.",
			},
			{ status: 422 },
		);
	}

	// Step 4: Create the OAuth2 client in Hydra
	// Grant type is always client_credentials for M2M clients (AC9)
	// No other grant types are permitted
	const effectiveTokenLifetime = tokenLifetime ?? 3600; // default: 3600s per PO AC3
	const tokenLifespanString = `${effectiveTokenLifetime}s`; // Hydra duration format e.g. "300s"

	let result: Awaited<ReturnType<typeof createOAuth2Client>>;
	try {
		result = await createOAuth2Client({
			client_name: body.client_name,
			grant_types: ["client_credentials"],
			response_types: [],
			scope: scopeValidation.scopes.join(" "),
			token_endpoint_auth_method: "client_secret_basic",
			// Set token lifetime via Hydra's client-credentials-specific lifespan field
			client_credentials_grant_access_token_lifespan: tokenLifespanString,
			audience: body.audience ?? [],
			owner: body.owner,
			client_uri: body.client_uri,
			policy_uri: body.policy_uri,
			tos_uri: body.tos_uri,
			logo_uri: body.logo_uri,
			contacts: body.contacts,
			// M2M metadata tag — used by GET /api/clients/m2m to filter M2M clients
			metadata: {
				client_type: "m2m",
				created_by: adminEmail,
				token_lifetime: effectiveTokenLifetime,
			},
		});
	} catch (error) {
		// C2 (log sanitization): only log the error message, never the request body
		// or any field that could contain client_secret
		console.error("[api/clients/m2m] POST create failed:", error instanceof Error ? error.message : "Unknown error");
		return NextResponse.json(
			{
				error: "upstream_unavailable",
				message: "The OAuth2 server is temporarily unavailable.",
				suggestion: "Retry in a few seconds. If the problem persists, check the platform health at /health.",
			},
			{ status: 502 },
		);
	}

	const created = result.data;

	// SR-4 / athena#76: Emit audit event for client creation.
	// SECURITY: client_secret is NEVER included in audit events.
	emitAuditEvent({
		event: "m2m_client.created",
		client_id: created.client_id ?? "unknown",
		client_name: created.client_name ?? body.client_name,
		scope: scopeValidation.scopes.join(" "),
		admin_id: adminId,
		admin_email: adminEmail,
		timestamp: new Date().toISOString(),
	});

	// Return the full client record including client_secret (one-time disclosure).
	// This is the ONLY time client_secret is available — it must be displayed immediately.
	// The caller must present the secret to the admin and warn that it will not be shown again.
	return NextResponse.json(
		{
			client_id: created.client_id,
			client_secret: created.client_secret,
			client_name: created.client_name,
			scope: created.scope,
			grant_types: created.grant_types,
			created_at: created.created_at,
			metadata: created.metadata,
		},
		{ status: 201 },
	);
}
