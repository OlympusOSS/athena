// Next.js instrumentation hook — runs once at server startup before requests.
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
	// Only run server-side (not in edge runtime or during build).
	// NEXT_RUNTIME is 'nodejs' only when running as a Node.js server — not during
	// `next build` (where ENCRYPTION_KEY is absent by design) and not in Edge runtime
	// (which does not have process.exit).
	if (process.env.NEXT_RUNTIME === "nodejs") {
		// Dynamic import prevents the SDK from loading at build time.
		// Build-time imports of the SDK could fail when ENCRYPTION_KEY is absent.
		const { validateOnStartup } = await import("@olympusoss/sdk");
		try {
			validateOnStartup();
		} catch (err) {
			console.error(err instanceof Error ? err.message : String(err));
			process.exit(1);
		}
	}
}
