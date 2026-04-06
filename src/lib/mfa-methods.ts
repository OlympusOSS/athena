/**
 * MFA methods parsing utilities.
 *
 * SR-MFA-1-SEC-1: Named helper for parsing `mfa.methods` setting values.
 * Isolated from the route handler so it is unit-testable without importing
 * Next.js route infrastructure.
 */

/**
 * Parse a comma-separated MFA methods string into an array of non-empty method tokens.
 *
 * Parsing rule: split on comma → trim each token → filter zero-length tokens after trim.
 * The following inputs all produce [] (no methods): null, '', ' ', ',', ',,' , ' , '.
 */
export function parseMfaMethods(value: string | null | undefined): string[] {
	if (!value) return [];
	return value
		.split(",")
		.map((token) => token.trim())
		.filter((token) => token.length > 0);
}
