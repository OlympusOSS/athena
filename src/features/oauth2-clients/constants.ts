import { z } from "zod";

/**
 * Re-export M2M scope constants from the canonical source.
 * The single source of truth is src/lib/m2m-scopes.ts — this file
 * imports and re-exports for backwards compatibility with feature module imports.
 *
 * DO NOT define M2M_PERMITTED_SCOPES here — modify src/lib/m2m-scopes.ts instead.
 */
export { M2M_HIGH_RISK_SCOPES, M2M_PERMITTED_SCOPES, M2M_SCOPE_DESCRIPTIONS, type M2MPermittedScope } from "@/lib/m2m-scopes";

import { M2M_PERMITTED_SCOPES, type M2MPermittedScope } from "@/lib/m2m-scopes";

/**
 * Zod schema for the POST /api/clients/m2m request body.
 *
 * SECURITY (SR-ATHENA-2 from athena#74 Security Review):
 * The scope field MUST be a space-separated string (matching Hydra's OAuth2 format).
 * Array format is explicitly rejected — if a caller sends `scope` as a JSON array,
 * the schema validation will fail with a 400 before the allowlist check runs.
 * This prevents type-coercion attacks and produces deterministic validation errors.
 *
 * Validation ordering (mandatory, non-skippable):
 *   1. Zod schema parse (this schema) — rejects malformed bodies
 *   2. validateM2MScopes() — checks each scope against M2M_PERMITTED_SCOPES
 *   3. createOAuth2Client() — only called if steps 1 and 2 both pass
 *
 * This validation IS part of the athena#50 PR and must not be skipped.
 * See the athena#50 implementation plan for the complete gate confirmation.
 */
export const createM2MClientSchema = z.object({
	client_name: z.string().min(1, "client_name is required"),
	/**
	 * scope: space-separated string of OAuth2 scopes (e.g. "identities:read sessions:read").
	 * Array format is NOT accepted — send a space-separated string.
	 */
	scope: z.string({
		required_error: "scope is required — provide a space-separated string of permitted scopes",
		invalid_type_error: "scope must be a string (space-separated), not an array",
	}),
	/**
	 * token_lifetime: access token TTL in seconds for this M2M client.
	 * Range: 1–3600 (enforced server-side before Hydra call — SR-5 / athena#78).
	 * Default: 3600 (per PO AC3). Recommended for AI agents: 300.
	 * No refresh tokens are issued for client_credentials grants.
	 */
	token_lifetime: z.number().int().min(1).max(3600).optional(),
	audience: z.array(z.string()).optional(),
	owner: z.string().optional(),
	client_uri: z.string().url().optional(),
	policy_uri: z.string().url().optional(),
	tos_uri: z.string().url().optional(),
	logo_uri: z.string().url().optional(),
	contacts: z.array(z.string()).optional(),
});

export type CreateM2MClientBody = z.infer<typeof createM2MClientSchema>;

/**
 * Validates that all requested scopes are in M2M_PERMITTED_SCOPES.
 *
 * SECURITY: This function is a mandatory, non-skippable validation step in the
 * POST /api/clients/m2m route handler. It must run BEFORE createOAuth2Client()
 * is called. It is a pre-condition, not a post-filter.
 *
 * Implementation requirements enforced here (from athena#74 Security Review):
 *   - Empty scope returns an error (AC5: at least one scope required)
 *   - Invalid scopes return an error WITHOUT naming which scopes are invalid
 *     (prevents scope enumeration oracle — DA Challenge 2 / Security Condition 5)
 *   - Scopes are deduplicated before returning (DA Condition 2 / Security Condition 2)
 *   - Hydra is NEVER called if this function returns an error
 *
 * @param scopeString - The raw space-separated scope string from the request body
 * @returns { valid: true, scopes: string[] } on success (deduplicated, insertion-order preserved)
 * @returns { valid: false, error: string, message: string } on failure
 */
export function validateM2MScopes(scopeString: string): { valid: true; scopes: string[] } | { valid: false; error: string; message: string } {
	const requestedScopes = scopeString
		.split(" ")
		.map((s) => s.trim())
		.filter(Boolean);

	// AC5: at least one scope is required
	if (requestedScopes.length === 0) {
		return {
			valid: false,
			error: "invalid_scope",
			message: "At least one scope is required for M2M clients",
		};
	}

	// Check every scope against the allowlist.
	// SECURITY: The error message is deliberately generic — it does NOT enumerate
	// which specific scopes are invalid. Verbose errors create a scope discovery oracle.
	const hasInvalidScope = requestedScopes.some((s) => !M2M_PERMITTED_SCOPES.includes(s as M2MPermittedScope));

	if (hasInvalidScope) {
		return {
			valid: false,
			error: "invalid_scope",
			message: "One or more requested scopes are not permitted for M2M clients",
		};
	}

	// Deduplicate before forwarding to Hydra (DA Condition 2 / Security Condition 2).
	// Hydra's behavior with duplicate scopes in a client registration is
	// implementation-specific — deduplicate here to guarantee clean input.
	const deduplicatedScopes = Array.from(new Set(requestedScopes));

	return {
		valid: true,
		scopes: deduplicatedScopes,
	};
}
