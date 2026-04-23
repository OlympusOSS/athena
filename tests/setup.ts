import "@testing-library/jest-dom/vitest";

// Force deterministic env BEFORE any test module imports session.ts or
// startup-validation.ts. `test.env` in vitest.config.ts is applied by vitest
// itself, but when the test file's top-level `const original = process.env.X`
// runs at module-load, CI-provided values can be captured instead of the
// vitest values, breaking afterEach restores and leaking to other test files.
// Setting them here — in a setupFile that runs before user test modules —
// guarantees consistent values across local and CI runs.
process.env.ENCRYPTION_KEY = "test-encryption-key-for-vitest-32ch";
process.env.SESSION_SIGNING_KEY = "y0vXvDE6hGnlA4J/iLlTwyMXHgDrMp4tD3ON+3lf3ws=";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:4001";
