import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Node environment — these are API/unit tests, not browser tests
		environment: "node",
		// Exclude Playwright e2e tests
		exclude: ["tests/**/*.spec.ts", "tests/**/*.spec.tsx", "node_modules/**"],
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
			include: ["src/**/*.ts", "src/**/*.tsx"],
			exclude: ["src/**/*.d.ts", "src/**/*.test.ts", "src/**/*.test.tsx", "src/**/index.ts", "src/styles/**"],
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
