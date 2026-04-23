import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";

// Deterministic env for every test. Coverage runs all test files in one
// process (disabling isolation) so env mutations in one file (e.g., a test
// that deletes SESSION_SIGNING_KEY to verify the missing-key branch) leak
// into downstream files and poison crypto round-trips. beforeEach resets
// the critical env vars before every test, so test-local mutations can't
// outlive their own afterEach.
const BASE_ENV = {
	ENCRYPTION_KEY: "test-encryption-key-for-vitest-32ch",
	SESSION_SIGNING_KEY: "y0vXvDE6hGnlA4J/iLlTwyMXHgDrMp4tD3ON+3lf3ws=",
	NEXT_PUBLIC_APP_URL: "http://localhost:4001",
} as const;

// Set once synchronously so module-load-time captures see correct values.
for (const [k, v] of Object.entries(BASE_ENV)) process.env[k] = v;

// Reset before every test so in-test mutations don't leak cross-file.
beforeEach(() => {
	for (const [k, v] of Object.entries(BASE_ENV)) process.env[k] = v;
});
