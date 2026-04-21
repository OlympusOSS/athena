/**
 * Next.js instrumentation hook — runs once at app startup.
 *
 * Used for eager validation of required environment variables so the app
 * fails fast with an actionable error message instead of silently serving
 * requests that will later fail at runtime.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
	// Only run validation on the Node.js server runtime, not on the Edge runtime.
	// The Edge runtime uses a subset of Node.js APIs and does not need startup
	// validation — the middleware will fail with a clear error if keys are missing.
	if (process.env.NEXT_RUNTIME === "nodejs") {
		const { validateSessionSigningKey } = await import("./lib/startup-validation");
		validateSessionSigningKey();

		const { validateOnStartup } = await import("@olympusoss/sdk");
		validateOnStartup();
	}
}
