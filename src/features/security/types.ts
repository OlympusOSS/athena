/**
 * Mirrors the LockedAccount interface from @olympusoss/sdk.
 * Kept here so UI layers import from the feature module, not the SDK directly.
 */
export interface LockedAccount {
	id: number;
	identifier: string;
	identity_id: string | null;
	locked_at: Date | null;
	locked_until: Date | null;
	lock_reason: string | null;
	auto_threshold_at: number | null;
	trigger_ip: string | null;
}

export interface LockedAccountsResponse {
	data: LockedAccount[];
	total: number;
	truncated?: boolean;
}
