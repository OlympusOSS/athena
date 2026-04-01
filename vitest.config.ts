import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
	test: {
		// Node environment — these are API/unit tests, not browser tests
		environment: "node",
		// Exclude Playwright e2e tests
		exclude: ["tests/**/*.spec.ts", "tests/**/*.spec.tsx", "node_modules/**"],
		// Make ENCRYPTION_KEY available in tests
		env: {
			ENCRYPTION_KEY: "test-encryption-key-for-vitest-32ch",
			NEXT_PUBLIC_APP_URL: "http://localhost:4001",
		},
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts", "src/**/*.tsx"],
			exclude: [
				"src/**/*.d.ts",
				"src/**/*.test.ts",
				"src/**/*.test.tsx",
				"src/**/index.ts",
				"src/styles/**",
			],
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
