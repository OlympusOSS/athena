/**
 * Social Connection Input Validation (athena#49)
 *
 * All server-side validation for social connection API endpoints.
 * Applied by POST, PATCH, and DELETE route handlers.
 *
 * Security: Implements V2 mitigation from the Security Review — provider slug
 * allowlist, field length limits, and scope allowlist prevent injection and
 * malformed Kratos config fragments.
 */

// V1 scope: Google only. Extend this array for V2 providers.
export const ALLOWED_PROVIDERS = ["google"] as const;
export type SocialProvider = (typeof ALLOWED_PROVIDERS)[number];

// Scope allowlist per provider. Only these values are accepted in the `scopes`
// field. Prevents scope injection into the Kratos OIDC fragment.
const ALLOWED_SCOPES_BY_PROVIDER: Record<SocialProvider, string[]> = {
	google: ["openid", "email", "profile"],
};

// Default scopes per provider — pre-populated in the UI form.
export const DEFAULT_SCOPES_BY_PROVIDER: Record<SocialProvider, string[]> = {
	google: ["openid", "email", "profile"],
};

// Display names for use in API responses and UI.
export const DISPLAY_NAME_BY_PROVIDER: Record<SocialProvider, string> = {
	google: "Google",
};

// Provider order for display in the UI.
export const PROVIDER_ORDER: SocialProvider[] = ["google"];

export interface ValidationResult {
	valid: boolean;
	error?: string;
}

/**
 * Validates a provider slug against the allowlist.
 * Used in both path params (PATCH/DELETE) and body params (POST).
 */
export function validateProvider(slug: unknown): ValidationResult {
	if (typeof slug !== "string" || slug.trim() === "") {
		return { valid: false, error: "provider is required" };
	}
	if (!(ALLOWED_PROVIDERS as readonly string[]).includes(slug)) {
		return { valid: false, error: `unknown provider: ${slug}. Allowed: ${ALLOWED_PROVIDERS.join(", ")}` };
	}
	return { valid: true };
}

/**
 * Validates a client_id value.
 * Constraints: non-empty, max 512 chars, alphanumeric + dots + hyphens + at-signs + underscores.
 */
export function validateClientId(value: unknown): ValidationResult {
	if (typeof value !== "string" || value.trim() === "") {
		return { valid: false, error: "client_id is required" };
	}
	if (value.length > 512) {
		return { valid: false, error: "client_id must not exceed 512 characters" };
	}
	// Allow alphanumeric, dots, hyphens, underscores, at-signs (covers Google's format)
	if (!/^[\w.\-@]+$/.test(value)) {
		return { valid: false, error: "client_id contains invalid characters" };
	}
	return { valid: true };
}

/**
 * Validates a client_secret value.
 * Constraints: non-empty, max 4096 chars.
 * The value is checked to be a non-empty string — no character restriction since
 * OAuth2 secrets can use any printable character.
 */
export function validateClientSecret(value: unknown): ValidationResult {
	if (typeof value !== "string" || value.trim() === "") {
		return { valid: false, error: "client_secret is required" };
	}
	if (value.length > 4096) {
		return { valid: false, error: "client_secret must not exceed 4096 characters" };
	}
	return { valid: true };
}

/**
 * Validates the scopes array against the provider's allowlist.
 */
export function validateScopes(value: unknown, provider: SocialProvider): ValidationResult {
	if (!Array.isArray(value) || value.length === 0) {
		return { valid: false, error: "scopes must be a non-empty array" };
	}

	const allowedScopes = ALLOWED_SCOPES_BY_PROVIDER[provider];
	const invalidScopes = value.filter((s) => typeof s !== "string" || !allowedScopes.includes(s));
	if (invalidScopes.length > 0) {
		return {
			valid: false,
			error: `invalid scope(s): ${invalidScopes.join(", ")}. Allowed for ${provider}: ${allowedScopes.join(", ")}`,
		};
	}
	return { valid: true };
}

/**
 * Validates the enabled field is a boolean.
 */
export function validateEnabled(value: unknown): ValidationResult {
	if (typeof value !== "boolean") {
		return { valid: false, error: "enabled must be a boolean" };
	}
	return { valid: true };
}
