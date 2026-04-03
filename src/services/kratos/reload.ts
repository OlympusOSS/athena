import axios from "axios";

/**
 * reloadKratosConfig — canonical helper for triggering a Kratos configuration reload
 * via the SIGHUP sidecar service.
 *
 * SECURITY: This is the ONLY permitted mechanism for triggering a Kratos reload from
 * Athena. Inlining an Axios call to the sidecar endpoint in a route handler is a
 * PR rejection criterion.
 *
 * This constraint is documented here as the enforcement point for:
 *   - athena#89 (DA hard gate for athena#49 social connections)
 *   - athena#49 implementation plan (mandatory reuse requirement)
 *
 * HEADER REDACTION (athena#89 Security Condition 1–5):
 * The outgoing request carries `X-Reload-Api-Key` (CIAM_RELOAD_API_KEY). This header
 * value must NEVER appear in logs. This function uses [REDACTED] as the platform-standard
 * mask token (SR-ATHENA-3) in all error log output — both the AxiosError path and the
 * generic error path.
 *
 * LOG REDACTION STANDARD:
 * `[REDACTED]` is the Athena platform-standard mask token for sensitive values in logs.
 * Use this token — not `***`, `<redacted>`, or empty string — for any log redaction
 * in this codebase. Deviations are a PR rejection criterion.
 * Tracked as: SR-ATHENA-3 (athena#89 Security Review)
 *
 * FUTURE AXIOS INTERCEPTORS:
 * If a global Axios interceptor is ever added to Athena (e.g. for distributed tracing),
 * it MUST explicitly exclude `X-Reload-Api-Key` from any header logging. The absence of
 * that exclusion is a security defect. This constraint survives any refactor of this file.
 *
 * DEBUG=axios* PROHIBITION:
 * `DEBUG=axios*` must NEVER be set in production environments. When set, Axios logs all
 * outgoing request headers — including `X-Reload-Api-Key` — to stdout. This is
 * documented in the deployment runbook. Setting `DEBUG=axios*` in production is a
 * security violation.
 *
 * @throws {ConfigurationError} if CIAM_RELOAD_SIDECAR_URL is not set
 * @throws {Error} re-thrown from Axios on request failure (after safe logging)
 */
export async function reloadKratosConfig(): Promise<void> {
	// Validate required environment configuration at call time.
	// An undefined URL produces a confusing Axios error that could obscure the real problem.
	// Fail fast with a clear configuration error instead.
	// (DA Condition 4 / Security Condition 3 from athena#89)
	const sidecarUrl = process.env.CIAM_RELOAD_SIDECAR_URL;
	if (!sidecarUrl || sidecarUrl.trim() === "") {
		throw new ConfigurationError(
			"CIAM_RELOAD_SIDECAR_URL is not set. Cannot trigger Kratos config reload. " +
				"Ensure this environment variable is configured for the CIAM Athena service.",
		);
	}

	const reloadUrl = `${sidecarUrl}/internal/kratos/reload`;

	try {
		await axios.post(
			reloadUrl,
			null, // no request body
			{
				headers: {
					// X-Reload-Api-Key carries CIAM_RELOAD_API_KEY — a service-to-service secret.
					// This header value must NEVER be logged. See error handler below.
					"X-Reload-Api-Key": process.env.CIAM_RELOAD_API_KEY,
				},
				// Treat all 2xx responses as success. The sidecar returns 200 on successful reload.
				validateStatus: (status) => status >= 200 && status < 300,
			},
		);
		// Success path: no header logging. Only log the fact of success if needed by the caller.
	} catch (error) {
		if (axios.isAxiosError(error)) {
			// SECURITY: Construct a safe log object that explicitly replaces X-Reload-Api-Key
			// with [REDACTED]. This applies at ALL log levels — not just production.
			// error.config.headers contains the outgoing request headers including the API key.
			const safeConfig = {
				method: error.config?.method,
				url: error.config?.url,
				status: error.response?.status,
				headers: {
					...error.config?.headers,
					// Replace the API key value with the platform-standard redaction token.
					// [REDACTED] is confirmed as the Athena standard mask token (SR-ATHENA-3).
					"X-Reload-Api-Key": "[REDACTED]",
				},
			};
			console.error("[reload] Kratos config reload failed", safeConfig);
		} else {
			// Non-AxiosError path: a future Axios interceptor could wrap an AxiosError into a
			// generic Error, causing the AxiosError branch above to be skipped. To prevent
			// accidental exposure of error properties that might contain request config headers,
			// log ONLY the message — not the raw error object.
			// (DA Condition 2 / Security Condition 1 from athena#89)
			const message = error instanceof Error ? error.message : String(error);
			console.error("[reload] Kratos config reload failed", { message });
		}

		// Re-throw so the calling route handler can decide the failure behavior:
		// hard failure (500) or soft failure (warn the admin but save the config change).
		// This helper does not swallow errors.
		throw error;
	}
}

/**
 * ConfigurationError — thrown when a required environment variable is missing.
 * Distinguishable from Axios / network errors so callers can handle it separately.
 */
export class ConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ConfigurationError";
	}
}
