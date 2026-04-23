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
		globalSetup: "./tests/global-setup.ts",
		// Isolate each test file in its own worker. Several tests mutate
		// process.env (SESSION_SIGNING_KEY, ENCRYPTION_KEY) — without isolation,
		// a failing test's env mutations leak into downstream test files and
		// break session-crypto round-trips. v8 coverage works with isolation.
		isolate: true,
		pool: "forks",
		poolOptions: {
			forks: { singleFork: false },
		},
		include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts", "tests/**/*.test.tsx", "test/**/*.test.ts", "test/**/*.test.tsx"],
		// Exclude Playwright e2e tests
		exclude: ["tests/**/*.spec.ts", "tests/**/*.spec.tsx", "tests/e2e/**", "node_modules/**"],
		// Env vars live exclusively in tests/global-setup.ts + tests/setup.ts +
		// CI workflow env: — avoids test.env applying mid-run and racing with
		// test-level process.env mutations. Keep values in sync across those three.
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
				// Phase 4: TanStack Query-backed hooks — thin API wrappers that construct
				// QueryClient requests. Testing each would require mocking the full http
				// stack and duplicate the API route tests we already have. E2E covers.
				"src/features/**/hooks/use*.ts",
				"src/app/(app)/settings/hooks/use*.ts",
				"src/hooks/useSocialConnections.ts",
				// Phase 4: Zustand store with side-effect init — covered via Providers
				// integration and SettingsInitializer test; the initialize() body fetches
				// from /api/settings and populates the store, requiring the full HTTP
				// layer to be testable without duplication.
				"src/features/settings/store.ts",
				"src/features/auth/hooks/useAuth.ts",
				// Phase 4: Feature utils that contain API-wrapper helpers used by hooks —
				// their call sites are covered via E2E. Pure utilities are kept in scope.
				"src/features/analytics/utils.ts",
				"src/features/auth/utils.ts",
				"src/features/identities/utils.ts",
				"src/features/oauth2-auth/utils.ts",
				"src/features/oauth2-clients/utils.ts",
				"src/features/oauth2-tokens/utils.ts",
				"src/features/schemas/utils.ts",
				"src/features/sessions/utils.ts",
				// Phase 4: Kratos/Hydra service clients and endpoint wrappers — Axios-based
				// HTTP adapters that are fully exercised by the API route tests in app/api/
				// (which call through these). Direct unit testing duplicates that surface.
				"src/services/kratos/**",
				"src/services/hydra/**",
				"src/services/geo/**",
			],
			thresholds: {
				// Strict 100/100/100/90 across every glob and globally.
				// Dead code was removed and unreachable branches are pragma'd with
				// /* c8 ignore */ comments that explain the unreachability.
				"src/lib/**": { lines: 100, statements: 100, functions: 100, branches: 90 },
				"src/hooks/**": { lines: 100, statements: 100, functions: 100, branches: 90 },
				"src/utils/**": { lines: 100, statements: 100, functions: 100, branches: 90 },
				"src/app/api/**": { lines: 100, statements: 100, functions: 100, branches: 90 },
				"src/components/**": { lines: 100, statements: 100, functions: 100, branches: 90 },
				"src/features/**/components/**": { lines: 100, statements: 100, functions: 100, branches: 90 },
				"src/app/(app)/**/components/**": { lines: 100, statements: 100, functions: 100, branches: 90 },
				"src/providers/**": { lines: 100, statements: 100, functions: 100, branches: 90 },
				// Global fallback at the target.
				lines: 100,
				statements: 100,
				functions: 100,
				branches: 90,
			},
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
