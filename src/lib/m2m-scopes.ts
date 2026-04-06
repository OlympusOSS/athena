/**
 * M2M_PERMITTED_SCOPES — canonical server-side allowlist for OAuth2 M2M client scopes.
 *
 * SECURITY (SR-ATHENA-1 from athena#74 Security Review):
 * This constant is the single source of truth. Both the POST /api/clients/m2m route
 * handler (server-side validation) and the UI multi-select (UX control) derive from
 * this value. Any modification requires a security-review PR with explicit sign-off
 * from the Security Expert AND Product Owner before merge.
 *
 * Explicitly excluded (must never appear on M2M clients):
 *   - settings:write  (admin-level config mutation)
 *   - identities:delete  (destructive identity operation)
 *   - openid, profile, email, address, phone  (OIDC user-facing scopes)
 *
 * V1 definition confirmed by PO on 2026-04-01 (platform#16) and re-confirmed 2026-04-03 (athena#74).
 *
 * // SYNC: must match hera/src/lib/m2m-scopes.ts
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
 * High-risk scopes that require an explicit warning badge in the UI.
 * The sessions:invalidate scope can force-logout all users — it carries
 * a "High risk" badge in the scope multi-select (DA condition from athena#50 thread).
 */
export const M2M_HIGH_RISK_SCOPES: ReadonlySet<M2MPermittedScope> = new Set(["sessions:invalidate"]);

/**
 * Human-readable descriptions for each permitted scope.
 * Displayed below the scope name in the multi-select (DX requirement athena#85).
 */
export const M2M_SCOPE_DESCRIPTIONS: Record<M2MPermittedScope, string> = {
	"identities:read": "Read identity records and profile data",
	"identities:write": "Create and update identity records",
	"sessions:read": "Read active session data",
	"sessions:invalidate": "Force-invalidate any user session (High risk — grants global logout capability)",
	"settings:read": "Read platform configuration settings",
	"audit:read": "Read audit log entries",
	"webhooks:write": "Create and update webhook configurations",
};
