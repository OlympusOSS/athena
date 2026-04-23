import { defineConfig, devices } from "@playwright/test";

// Use 127.0.0.1 (not `localhost`) so IPv6-preferring runners resolve to our
// IPv4-only standalone server. Overridable via BASE_URL for local dev.
// Must match NEXT_PUBLIC_APP_URL port in the CI env block so callback-route
// self-redirects resolve to the same host Playwright is polling.
const baseURL = process.env.BASE_URL || "http://127.0.0.1:4001";

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? "github" : "list",
	use: {
		baseURL,
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: process.env.CI
		? {
				// next.config.ts uses `output: "standalone"`, so `next start` no-ops.
				// CI runs `bun run build` as a prior step — start the standalone
				// server directly. Poll /api/health (200) not / (redirects).
				command:
					"cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/ && PORT=4001 HOSTNAME=0.0.0.0 node .next/standalone/server.js",
				url: `${baseURL}/api/health`,
				reuseExistingServer: false,
				timeout: 60_000,
				stdout: "pipe",
				stderr: "pipe",
			}
		: undefined,
});
