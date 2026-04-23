/**
 * Vitest global setup — runs in the parent process BEFORE any worker boots.
 *
 * 11 test files under athena use the `originalEnv = { ...process.env }`
 * pattern and restore via `process.env = { ...originalEnv }` in beforeEach.
 * That captures env at test-file module-load time, which happens BEFORE
 * vitest.config.ts `test.env` has been propagated to the worker (coverage
 * mode disables isolation and batches). Result: captured `originalEnv`
 * lacks SESSION_SIGNING_KEY / ENCRYPTION_KEY / NEXT_PUBLIC_APP_URL and the
 * restore in beforeEach silently WIPES them every test.
 *
 * globalSetup runs in the parent process before workers spawn, so these
 * env values propagate to every worker's process.env at boot — which means
 * every test file's module-load `originalEnv` capture contains the values
 * the tests need.
 */
export default function setup() {
	process.env.ENCRYPTION_KEY = "test-encryption-key-for-vitest-32ch";
	process.env.SESSION_SIGNING_KEY = "y0vXvDE6hGnlA4J/iLlTwyMXHgDrMp4tD3ON+3lf3ws=";
	process.env.NEXT_PUBLIC_APP_URL = "http://localhost:4001";
}
