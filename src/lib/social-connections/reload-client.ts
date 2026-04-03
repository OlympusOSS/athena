/**
 * Social Connection Reload Client (athena#49)
 *
 * Wraps the canonical `reloadKratosConfig` helper from athena#89 and maps all
 * sidecar response states to typed `ReloadStatus` values for use in API responses.
 *
 * This is the ONLY call site for triggering a Kratos config reload from social
 * connection routes. Do not call `reloadKratosConfig` directly in route handlers.
 *
 * HEADER REDACTION: Delegated entirely to `reloadKratosConfig` (athena#89). The
 * `X-Reload-Api-Key` header is handled and redacted there — this module does not
 * need to manage it.
 *
 * SECURITY: When a client_secret is changed, callers MUST set secretChanged=true
 * and call `getReloadStatus(true)` instead of calling the sidecar. A new secret
 * requires a Kratos restart — not a SIGHUP reload.
 */

import axios from "axios";
import { ConfigurationError, reloadKratosConfig } from "@/services/kratos";

export type ReloadStatus = "reloaded" | "failed" | "unreachable" | "auth_failed" | "misconfigured" | "skipped";

export interface ReloadResult {
	status: ReloadStatus;
}

/**
 * Triggers a Kratos config reload via the SIGHUP sidecar and maps the result
 * to a typed `ReloadStatus`. Never throws — all error paths produce a typed status.
 *
 * @param secretChanged - If true, skips the reload call entirely and returns "skipped".
 *   Callers must pass true when client_secret was modified — secret rotation requires
 *   a full Kratos restart, not a SIGHUP reload.
 */
export async function triggerReload(secretChanged: boolean): Promise<ReloadResult> {
	// Security: when client_secret was changed, never call the sidecar.
	// The sidecar reads env vars, not SDK settings — a new secret requires a restart.
	if (secretChanged) {
		return { status: "skipped" };
	}

	try {
		await reloadKratosConfig();
		return { status: "reloaded" };
	} catch (error) {
		if (error instanceof ConfigurationError) {
			// CIAM_RELOAD_SIDECAR_URL is not set
			console.warn("[reload-client] Reload URL not configured. Set CIAM_RELOAD_SIDECAR_URL.");
			return { status: "misconfigured" };
		}

		if (axios.isAxiosError(error)) {
			const httpStatus = error.response?.status;

			if (httpStatus === 401) {
				// API key mismatch between Athena and sidecar
				return { status: "auth_failed" };
			}

			if (httpStatus && httpStatus >= 500) {
				// Sidecar returned an error response
				return { status: "failed" };
			}

			// Connection refused, timeout, or other network error
			return { status: "unreachable" };
		}

		// Unexpected error — treat as unreachable to avoid swallowing it silently
		console.error("[reload-client] Unexpected error during reload trigger:", {
			message: error instanceof Error ? error.message : String(error),
		});
		return { status: "unreachable" };
	}
}
