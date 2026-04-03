/**
 * Social Connection Audit Logging (athena#49 / athena#90 — SR-A1)
 *
 * Emits structured audit log entries for all social connection write operations.
 * Required for SOC2 CC6.2: configuration changes to security-relevant settings
 * must be logged with admin identity, timestamp, action, and changed fields.
 *
 * Security rules:
 * - client_secret VALUE is NEVER logged — only that it was changed.
 * - changedFields lists field names only, never values.
 * - adminId and adminEmail are sourced from the middleware-injected x-user-id
 *   and x-user-email headers (not from request body — prevents spoofing).
 */

export type SocialConnectionAuditAction =
	| "social_connection.created"
	| "social_connection.updated"
	| "social_connection.enabled"
	| "social_connection.disabled"
	| "social_connection.deleted";

interface AuditEntry {
	audit: true;
	action: SocialConnectionAuditAction;
	provider: string;
	admin_id: string;
	admin_email: string;
	changed_fields: string[];
	timestamp: string;
}

/**
 * Emits a structured audit log entry for a social connection write operation.
 *
 * @param action - The audit action type
 * @param provider - Provider slug (e.g. "google")
 * @param adminId - Admin's Kratos identity ID (from x-user-id header)
 * @param adminEmail - Admin's email (from x-user-email header)
 * @param changedFields - Array of field names that were modified (never include values)
 */
export function auditSocialConnection(
	action: SocialConnectionAuditAction,
	provider: string,
	adminId: string,
	adminEmail: string,
	changedFields: string[],
): void {
	const entry: AuditEntry = {
		audit: true,
		action,
		provider,
		admin_id: adminId,
		admin_email: adminEmail,
		changed_fields: changedFields,
		timestamp: new Date().toISOString(),
	};

	// Use console.log for structured JSON output. In production, this feeds into
	// the log aggregation pipeline. The `audit: true` field enables log-based
	// filtering for compliance queries.
	console.log(JSON.stringify(entry));
}
