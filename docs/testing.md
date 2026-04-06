# Athena — Testing Guide

## Overview

Athena uses Vitest as its test runner for all unit and API route tests. This document explains how to run tests, where test files live, naming conventions, and how the CI gate works. Read this before adding new tests to ensure consistency.

---

## Test Runner

| Tool | Role |
|------|------|
| **Vitest** | Unit tests, API route tests, store tests — primary test runner |
| **Playwright** | Reserved for future end-to-end browser flow tests — separate CI step |

Do not use Jest, Bun test, or Playwright for unit/API tests. Vitest is the single test runner for all non-E2E tests in this repo.

---

## Running Tests

```bash
# Run all tests once (CI mode)
bun run test

# Run in watch mode (local development)
bun run test:watch

# Run with coverage report
bun run test:coverage

# Run a specific file
bun run test src/lib/__tests__/session.test.ts

# Run tests matching a pattern
bun run test --reporter=verbose
```

All tests run through the `test` script in `package.json`. Never invoke `vitest` directly in CI — always use `bun run test`.

---

## File Conventions

| Convention | Rule |
|-----------|------|
| Location | Co-located with source in `__tests__/` subdirectories |
| Naming | `*.test.ts` suffix (not `.spec.ts`) |
| Entry point | `bun run test` runs all `*.test.ts` files |

Examples:
- `src/lib/__tests__/session.test.ts` — session signing and verification
- `src/lib/__tests__/breach-check.test.ts` — breach check utility
- `src/app/api/auth/__tests__/callback.test.ts` — OAuth2 callback route
- `src/app/api/settings/__tests__/auth-enforcement.test.ts` — settings API auth
- `src/stores/dashboardLayout.test.ts` — dashboard layout store

---

## Coverage Areas

| Area | Status | File |
|------|--------|------|
| OAuth2 auth flow (callback, state validation, PKCE) | Done | `src/app/api/auth/__tests__/callback.test.ts` |
| Settings API CRUD + auth enforcement | Done | `src/app/api/settings/__tests__/` |
| Session signing / verification | Done | `src/lib/__tests__/session.test.ts` |
| Dashboard layout store | Done | `src/stores/dashboardLayout.test.ts` |
| Middleware error shape (401/403) | Done | `src/middleware.test.ts` |
| Cookie options helper | Done | `src/lib/__tests__/cookie-options.test.ts` |
| Identity management routes | Future | — |
| MFA settings routes | Future | Follows platform#13 |

---

## Required Test Cases by Area

### OAuth2 Callback (`src/app/api/auth/__tests__/callback.test.ts`)

Happy path and all rejection scenarios must be covered:

| Case | Expected |
|------|----------|
| Valid code + state + PKCE → session created | 200, `Set-Cookie: athena-session` present with `Secure` in production |
| State mismatch (CSRF attempt) | Redirect to `/api/auth/login`, no session set |
| Missing state parameter | Redirect to `/api/auth/login`, no session set |
| PKCE code_verifier mismatch | Redirect to `/api/auth/login`, no session set |
| `NODE_ENV=production` → `Set-Cookie` includes `Secure` attribute | Verified |
| `NODE_ENV=development` → `Set-Cookie` does NOT include `Secure` | Verified |

### Settings API Auth Enforcement (`src/app/api/settings/__tests__/auth-enforcement.test.ts`)

| Case | Expected |
|------|----------|
| `GET /api/settings` with no session | `401 { "error": "not_authenticated" }` |
| `GET /api/settings` with viewer session (non-admin) | `403 { "error": "forbidden" }` |
| `POST /api/settings` with no session | `401 { "error": "not_authenticated" }` |
| `DELETE /api/settings/:key` with no session | `401 { "error": "not_authenticated" }` |

### Dashboard Layout Store (`src/stores/dashboardLayout.test.ts`)

All 6 PO-defined test cases must pass:

| Test | Description |
|------|-------------|
| `initialize()` loads from API | Given `GET /api/dashboard/layout` returns a known layout, store state matches |
| `initialize()` is idempotent | Second call when already initialized makes no additional API call |
| Reconciliation adds missing widgets | Widgets in the default set missing from the stored layout are added with default positions |
| Reconciliation preserves existing positions | Custom widget positions are not overwritten by default positions |
| Empty layout guard | `saveLayout()` skips the API write when the resolved layout is empty |
| `saveLayout()` writes to API | POST/PUT to `/api/dashboard/layout` is made with the correct payload |

Tests mock the `GET /api/dashboard/layout` and `POST /api/dashboard/layout` fetch calls. No real network calls in unit tests.

---

## CI Gate

All tests run on every push to `main` and on every pull request. The CI workflow step is `bun run test`. A 100% pass rate is required — no known-failing tests are merged.

The test step is defined in `.github/workflows/ci.yml`. Do not exclude test files from CI.

---

## Adding New Tests

1. Create a `__tests__/` directory alongside the source file you are testing (if one does not exist)
2. Name the file `<subject>.test.ts`
3. Use Vitest imports: `import { describe, it, expect, vi } from "vitest"`
4. Mock network calls using Vitest's `vi.mock` or `vi.spyOn(global, "fetch")`
5. Never make real network calls to Kratos, Hydra, or HIBP in unit tests
6. Run `bun run test` locally before opening a PR

For store tests specifically, mock both the GET (initialize) and POST/PUT (save) endpoints. Verify that the API call is made with the correct payload by capturing the mock's call arguments.

---

## Mocking Patterns

### Mocking fetch for API route tests

```typescript
import { vi } from "vitest"

vi.spyOn(global, "fetch").mockResolvedValueOnce(
  new Response(JSON.stringify({ identities: [] }), { status: 200 })
)
```

### Mocking environment for cookie tests

Use `vi.stubEnv` for `NODE_ENV` mocking — it is safe, scoped per test, and does not leak across tests in the same run:

```typescript
import { vi, beforeEach, afterEach } from "vitest"

beforeEach(() => { vi.stubEnv("NODE_ENV", "production") })
afterEach(() => { vi.unstubAllEnvs() })
```

Do NOT use direct assignment (`process.env.NODE_ENV = "production"`) without a paired restore. Direct assignment without `afterEach` cleanup leaks the env value to subsequent tests in the same run and can produce false positives.

When asserting the `Secure` attribute, assert its presence or absence exactly — do not use `toBeTruthy()` on the `Set-Cookie` header string:

```typescript
// Assert Secure is present in production
expect(setCookieHeader).toContain("Secure")

// Assert Secure is absent in development
expect(setCookieHeader).not.toContain("Secure")
```

When asserting cookie deletion behavior, use `maxAge === 0` (strict equality), not `maxAge >= 0`. This prevents a future "minimum maxAge" guard from silently breaking cookie deletion while the test continues to pass.

---

## Cookie Audit — CI Gate

A CI step named `Cookie audit — no unguarded athena-session writes` runs `bun run audit:cookies` on every push and pull request. This step fails if any `cookies.set("athena-session", ...)` call with an inline options object exists outside `src/lib/cookie-options.ts`.

**If you add a new route that writes the `athena-session` cookie:**

1. Import from `src/lib/cookie-options.ts` — use `buildSessionCookieOptions(maxAge)` for set and `buildSessionClearOptions()` for delete
2. Do not pass an inline options object to `cookies.set` — the audit script will fail the build
3. Assert `Secure` in production mode in the route's test (see [Mocking environment for cookie tests](#mocking-environment-for-cookie-tests))
4. Run `bun run audit:cookies` locally before opening a PR

**Known limitation**: The audit grep pattern (`cookies\.set.*athena-session.*{`) targets single-line inline option objects. A multiline `cookies.set` call formatted across multiple lines will not be caught by the pattern. If you write a multiline call, CI will not catch it — follow the import rule regardless.

---

## Security Test Requirements

OAuth2 callback tests must include negative state validation cases — not just the happy path. This is a requirement from the Security Expert review (athena#35):

- Missing state param → redirect with error
- Replayed/tampered state → redirect with error
- Missing PKCE verifier → redirect with error
- PKCE code_verifier mismatch → redirect with error

Settings API tests must assert 401 is returned for unauthenticated requests. Asserting only 200 success paths is insufficient.

---

## Related Issues

- [athena#35](https://github.com/OlympusOSS/athena/issues/35) — Test coverage epic (auth flow + settings API)
- [athena#39](https://github.com/OlympusOSS/athena/issues/39) — OAuth2 auth flow tests (Done)
- [athena#40](https://github.com/OlympusOSS/athena/issues/40) — Settings API tests (Done)
- [athena#42](https://github.com/OlympusOSS/athena/issues/42) — Dashboard layout store tests (Done)
- [athena#57](https://github.com/OlympusOSS/athena/issues/57) — Session cookie `Secure` flag fix; `buildSessionCookieOptions` helper
- [athena#66](https://github.com/OlympusOSS/athena/issues/66) — Cookie audit CI step; `vi.stubEnv` NODE_ENV mocking requirement

---

*Last updated: 2026-04-06 (Technical Writer — athena#57 vi.stubEnv pattern, athena#66 cookie audit CI gate)*
