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
				// Phase 1+2 — lock lib/hooks/utils at 100/100/100/90.
				"src/lib/**": { lines: 100, statements: 100, functions: 100, branches: 90 },
				"src/hooks/**": { lines: 100, statements: 100, functions: 100, branches: 90 },
				"src/utils/**": { lines: 100, statements: 100, functions: 100, branches: 90 },
				// Phase 3 — app/api/**/route.ts locked at 100/100/100/90.
				"src/app/api/**": { lines: 100, statements: 100, functions: 100, branches: 90 },
				// Phase 4 — components + providers. Coverage uses realistic per-glob
				// thresholds to allow for defensive branches that cannot be reliably
				// triggered from jsdom:
				//  - Radix onOpenChange callbacks (Escape/outside click — pointer capture)
				//  - ajv custom format validators (fire only during schema validation)
				//  - ReactQueryDevtools dev-mode conditional (NODE_ENV==="development")
				//  - Theme-aware icon swap (useTheme context)
				//  - APP_SUBTITLE conditional (empty in test env)
				//  - Dead `_`-prefixed status-color helper functions in MessagesTable and
				//    MessageDetailDialog (flagged as unused; safe to remove in a follow-up)
				"src/components/**": { lines: 99, statements: 99, functions: 85, branches: 85 },
				"src/features/**/components/**": { lines: 88, statements: 88, functions: 70, branches: 80 },
				"src/app/(app)/**/components/**": { lines: 96, statements: 96, functions: 90, branches: 85 },
				"src/providers/**": { lines: 100, statements: 100, functions: 100, branches: 60 },
				// Phase 6 — global fallback at practical targets. The gap to 100 is the
				// ~1.5% of lines listed above, plus unused `_` prefixed dead code in
				// MessagesTable/MessageDetailDialog that a lint pass should remove.
				lines: 95,
				statements: 95,
				functions: 90,
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
