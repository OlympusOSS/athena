import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		// jsdom environment — supports both React component/hook tests and Node-style tests.
		// The existing lib/__tests__ suite is compatible with jsdom.
		environment: "jsdom",
		globals: true,
		setupFiles: ["./tests/setup.ts"],
		include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts", "tests/**/*.test.tsx", "test/**/*.test.ts", "test/**/*.test.tsx"],
		// Exclude Playwright e2e tests
		exclude: ["tests/**/*.spec.ts", "tests/**/*.spec.tsx", "tests/e2e/**", "node_modules/**"],
		// Make keys available in tests.
		// SESSION_SIGNING_KEY must be a valid base64-encoded 32-byte key (athena#99).
		// ENCRYPTION_KEY is kept for SDK settings tests — it is intentionally different
		// from SESSION_SIGNING_KEY to exercise key separation.
		env: {
			ENCRYPTION_KEY: "test-encryption-key-for-vitest-32ch",
			SESSION_SIGNING_KEY: "y0vXvDE6hGnlA4J/iLlTwyMXHgDrMp4tD3ON+3lf3ws=",
			NEXT_PUBLIC_APP_URL: "http://localhost:4001",
		},
		coverage: {
			provider: "v8",
			reporter: ["text", "html", "json-summary"],
			// Full src/ in scope; Next.js RSC shells, edge runtime, and non-code excluded.
			include: ["src/**/*.{ts,tsx}"],
			exclude: [
				"src/lib/__tests__/**",
				"src/**/__tests__/**",
				"src/**/*.test.{ts,tsx}",
				"src/**/*.d.ts",
				"src/**/constants.ts",
				"src/**/types.ts",
				"src/**/*.config.ts",
				"src/**/index.ts",
				"src/styles/**",
				// Next.js route shells and edge-runtime files — covered via E2E / integration.
				"src/app/**/page.tsx",
				"src/app/**/layout.tsx",
				"src/app/**/loading.tsx",
				"src/app/**/not-found.tsx",
				"src/app/**/error.tsx",
				"src/middleware.ts",
				"src/instrumentation.ts",
			],
			thresholds: {
				// Phase 1+2 — lock lib/hooks/utils at 100/100/100/90. Per-glob thresholds apply
				// to files under the glob; the file-level fallback below applies to everything else.
				"src/lib/**": { lines: 100, statements: 100, functions: 100, branches: 90 },
				"src/hooks/**": { lines: 100, statements: 100, functions: 100, branches: 90 },
				"src/utils/**": { lines: 100, statements: 100, functions: 100, branches: 90 },
				// Plan: raise to 100/100/100/90 in Phase 6. Current value is a ratchet floor
				// for the remainder of src/ (app/features/providers/services/components).
				lines: 10,
				statements: 10,
				functions: 10,
				branches: 10,
			},
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
