/**
 * Social Connection Serializers (athena#49)
 *
 * Enforces secret masking at the serialization layer (V3 mitigation).
 * These functions are applied to every outbound API response — callers
 * must NOT attempt to mask fields themselves.
 *
 * Security contract:
 * - `maskSecret()`: replaces client_secret with the masked constant before
 *   any response leaves the API layer.
 * - `toPublicConnection()`: strips ALL credential fields for the public
 *   (unauthenticated) endpoint consumed by Hera.
 *
 * Never return plaintext or ciphertext client_secret in any API response.
 */

export const MASKED_SECRET = "••••••••";

export interface SocialConnectionAdminView {
	provider: string;
	display_name: string;
	enabled: boolean;
	client_id: string;
	client_secret: typeof MASKED_SECRET;
	scopes: string[];
	order: number;
}

export interface SocialConnectionPublicView {
	provider: string;
	display_name: string;
	enabled: boolean;
}

export interface RawSocialConnection {
	provider: string;
	display_name: string;
	enabled: boolean;
	client_id: string;
	client_secret?: string;
	scopes: string[];
	order: number;
}

/**
 * Masks the client_secret field on any social connection object.
 * Applied to all admin-facing GET responses.
 *
 * Security: Strips plaintext/ciphertext entirely — the response always
 * contains the constant masked value. This prevents any code path from
 * accidentally returning a real secret value.
 */
export function maskSecret(connection: RawSocialConnection): SocialConnectionAdminView {
	// Destructure to explicitly drop client_secret from the spread
	const { client_secret: _dropped, ...rest } = connection;
	return {
		...rest,
		client_secret: MASKED_SECRET,
	};
}

/**
 * Returns only the public-safe fields for the unauthenticated Hera endpoint.
 * Omits client_id, client_secret, and scopes entirely.
 *
 * Security: Response normalization per V9 / platform#15 Condition 2 —
 * "not configured" and "configured but disabled" produce identical output
 * (provider absent from the array). Callers filter to enabled=true before
 * calling this function.
 */
export function toPublicConnection(connection: Pick<RawSocialConnection, "provider" | "display_name" | "enabled">): SocialConnectionPublicView {
	return {
		provider: connection.provider,
		display_name: connection.display_name,
		enabled: connection.enabled,
	};
}
