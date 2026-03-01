import type { Identity } from "@ory/kratos-client";

/**
 * Check whether an identity is a protected demo account.
 * Returns true when the identity has metadata_admin.demo === true.
 */
export function isDemoIdentity(identity: Identity | null | undefined): boolean {
	if (!identity) return false;
	const meta = identity.metadata_admin as Record<string, unknown> | null | undefined;
	return meta?.demo === true;
}
