import { z } from "zod";

/**
 * M2M_PERMITTED_SCOPES — the definitive server-side allowlist for OAuth2 M2M client scopes.
 *
 * SECURITY: This constant is a security boundary, not an implementation detail.
 * It is consumed by two places:
 *   1. The POST /api/clients/m2m route handler (server-side validation — the actual guard)
 *   2. The M2M client multi-select UI component (UX control — NOT a security control)
 *
 * Any modification to this list REQUIRES:
 *   - The `security-review` label on the PR
 *   - Explicit sign-off from the Security Expert AND Product Owner before merge
 *   - A PO decision documented in the relevant issue
 *
 * This requirement is tracked as SR-ATHENA-1 from the athena#74 Security Review.
 * See: https://github.com/OlympusOSS/athena/issues/74
 *
 * DO NOT add scopes unilaterally. Scope additions silently escalate privilege for
 * ALL future M2M clients registered through Athena.
 *
 * Explicitly excluded (must never appear on M2M clients):
 *   - settings:write  (admin-level config mutation)
 *   - identities:delete  (destructive identity operation)
 *   - openid, profile, email, address, phone  (OIDC user-facing scopes)
 *
 * V1 definition confirmed by PO on 2026-04-01 (platform#16) and re-confirmed 2026-04-03 (athena#74).
 */
export const M2M_PERMITTED_SCOPES = [
	"identities:read",
	"identities:write",
	"sessions:read",
	"sessions:invalidate",
	"settings:read",
	"audit:read",
	"webhooks:write",
] as const;

export type M2MPermittedScope = (typeof M2M_PERMITTED_SCOPES)[number];

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
	grant_types: z.array(z.string()).optional(),
	response_types: z.array(z.string()).optional(),
	redirect_uris: z.array(z.string().url()).optional(),
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
export function validateM2MScopes(scopeString: string):
	| { valid: true; scopes: string[] }
	| { valid: false; error: string; message: string } {
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
	const hasInvalidScope = requestedScopes.some(
		(s) => !M2M_PERMITTED_SCOPES.includes(s as M2MPermittedScope),
	);

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
