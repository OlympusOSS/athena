/**
 * Startup validation for required environment variables.
 *
 * Called from instrumentation.ts at app boot (Next.js instrumentation hook).
 * Throws a fatal error if SESSION_SIGNING_KEY is missing or empty —
 * the app must not start without it.
 *
 * Emits a WARNING if SESSION_SIGNING_KEY equals ENCRYPTION_KEY, since using
 * the same key for both signing and encryption defeats the purpose of key
 * separation (athena#99).
 */

import { logger } from "./logger";

/**
 * Validate that SESSION_SIGNING_KEY is present and correctly configured.
 *
 * - Missing or empty: throws (fatal — app must not start)
 * - Same value as ENCRYPTION_KEY: logs ERROR (security concern, not fatal)
 *
 * @throws {Error} if SESSION_SIGNING_KEY is not set or is empty
 */
export function validateSessionSigningKey(): void {
	const sessionSigningKey = process.env.SESSION_SIGNING_KEY;

	if (!sessionSigningKey || sessionSigningKey.trim() === "") {
		throw new Error("SESSION_SIGNING_KEY is required. Generate one with: openssl rand -base64 32");
	}

	const encryptionKey = process.env.ENCRYPTION_KEY;

	if (encryptionKey && sessionSigningKey === encryptionKey) {
		logger.error(
			"SESSION_SIGNING_KEY and ENCRYPTION_KEY have the same value. " +
				"This defeats key separation. Generate a unique key with: openssl rand -base64 32",
		);
	}
}
