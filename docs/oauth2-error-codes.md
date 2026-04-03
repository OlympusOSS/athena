# OAuth2 Callback Error Code Reference

## Overview

When an OAuth2 callback fails, Athena redirects to the Hera login page with a structured `?error=<code>` query parameter. These codes identify the exact step that failed so developers can diagnose and fix integration problems without reading server logs. Seven canonical codes cover all classified failure modes.

These codes are developer-facing diagnostic strings. They are not OAuth2 protocol error codes (do not confuse with `access_denied`, `invalid_grant`, etc.) and are not intended as end-user-facing messages.

---

## How It Works

Every failure in the Athena callback route (`/api/auth/callback`) follows this path:

1. The specific failure mode is identified and matched to a canonical error code
2. The error is logged server-side: `{ error_code, step, timestamp }` — no PII, no token values, no query strings
3. Athena sends a `302 Found` redirect to `{HERA_BASE_URL}/login?error=<code>`
4. Hera reads `searchParams.error`, validates it against the allowlist, and renders a dismissible notice: `Auth error: <code>`

Failures that do not match any canonical code redirect to `{HERA_BASE_URL}/login` with no `?error` parameter. The failure is still logged server-side.

The `?error` parameter remains in the URL after the Hera notice is dismissed (V1 behavior — `history.replaceState()` cleanup is deferred to V2). This is safe: the codes contain no credential data.

---

## Canonical Error Codes

| Code | Trigger Condition | Step in Flow |
|------|------------------|--------------|
| `pkce_missing` | The `pkce_verifier` cookie is absent when the callback is reached | Pre-token-exchange guard |
| `pkce_mismatch` | The `pkce_verifier` cookie is present but does not match the code challenge | Pre-token-exchange guard |
| `state_mismatch` | The `state` query parameter does not match the stored `oauth_state` cookie | CSRF guard |
| `userinfo_unauthorized` | The Hydra `/oauth2/userinfo` endpoint returns `401` | Post-token-exchange |
| `userinfo_unavailable` | The Hydra `/oauth2/userinfo` endpoint returns `5xx` or is unreachable | Post-token-exchange |
| `identity_not_found` | The Kratos identity lookup returns `404` for the `sub` from userinfo | Post-userinfo |
| `flow_expired` | Kratos returns `410 Gone` — the OAuth2 flow TTL has elapsed | Pre-token-exchange |

### Code Details

#### `pkce_missing`

The `pkce_verifier` cookie is set at login initiation and read at the callback. If it is absent, PKCE verification cannot proceed.

Common causes:
- The login flow took longer than the 5-minute cookie TTL
- A second browser tab initiated a new login flow, overwriting the cookie
- Cookies are disabled or blocked in the browser

Remediation: instruct the user to restart the login flow and complete it without opening additional tabs.

#### `pkce_mismatch`

The `pkce_verifier` cookie is present but the derived `code_challenge` does not match what was sent in the authorization request. This indicates the verifier has been tampered with or was generated incorrectly.

Common causes (for integrators building OAuth2 clients):
- The `code_verifier` used in the token exchange does not match the `code_challenge` sent to the authorization endpoint
- The `code_challenge_method` is not `S256` (the only supported method)
- A custom proxy or middleware modified the cookie between login initiation and callback

#### `state_mismatch`

The `state` parameter returned by Hydra in the callback URL does not match the value stored in the `oauth_state` cookie.

This is a CSRF detection signal. It fires when:
- The state cookie expired before the callback arrived
- The request is a CSRF attempt (state was fabricated or not sent)
- A proxy stripped or modified the `state` parameter

#### `userinfo_unauthorized`

Hydra's `/oauth2/userinfo` endpoint rejected the access token with a `401`. The token was not accepted as a valid bearer credential.

Common causes:
- The `access_token` from the token exchange was not accepted by Hydra (audience mismatch, token expired, or the token was for a different Hydra instance)
- The Athena OAuth2 client configuration has `subject_type: pairwise` instead of `public` — userinfo may return correctly but the Kratos lookup will fail separately

#### `userinfo_unavailable`

Hydra's `/oauth2/userinfo` endpoint returned a `5xx` response or was unreachable. This is a service degradation signal, not an authentication failure.

Common causes:
- Hydra container is unhealthy or restarting
- Network partition between Athena and Hydra containers

Remediation: check Hydra container health (`podman ps`, container logs). The user can retry the login once Hydra recovers.

#### `identity_not_found`

The `sub` value from `/oauth2/userinfo` was used to look up a Kratos identity via `GET /_admin/identities/{sub}`, which returned `404`.

Common causes:
- The Athena OAuth2 client is registered with `subject_type: pairwise` (the Hydra default). With pairwise, the `sub` is a deterministic HMAC that does not match the Kratos UUID. Both seed scripts explicitly set `subject_type: public` — verify the client registration.
- The identity was deleted from Kratos after the user began the login flow.

```bash
# Verify the Athena IAM client subject_type
curl -s http://localhost:4103/admin/clients/athena-iam-client | jq '.subject_type'
# Must return: "public"
```

#### `flow_expired`

Kratos returned `410 Gone` for the flow ID. The authorization flow was initiated but the user took longer than the Kratos flow TTL (default: 1 hour) to complete it.

This is the most common real-world callback failure for users on slow connections or those who leave the browser tab idle.

Remediation: the user must restart the login flow from the beginning.

---

## API / Technical Details

### Redirect Contract

| Attribute | Value |
|-----------|-------|
| HTTP status | `302 Found` |
| Redirect target | `{HERA_BASE_URL}/login?error=<code>` |
| Additional query parameters | None — no `error_description`, no stack traces, no service names |
| PII in URL | None |

`302` is used (not `301`) so the redirect is never cached by browsers. A cached redirect would send users to a stale error URL on subsequent visits.

### Environment Variable: `HERA_BASE_URL`

`HERA_BASE_URL` must be set in the Athena container environment. The callback route throws a startup error if this variable is absent:

```
HERA_BASE_URL is required but not set. Set this server-side env variable to the base
URL of the Hera login service (e.g., http://localhost:3000 for CIAM dev).
```

This is a server-side runtime variable. Do not use `NEXT_PUBLIC_APP_URL` as a fallback — `NEXT_PUBLIC_*` variables are baked into the client bundle at build time and are not available in server-side route handlers.

| Environment | Athena CIAM | Athena IAM |
|-------------|-------------|------------|
| Dev | `http://localhost:3000` | `http://localhost:4000` |
| Production | `<CIAM Hera domain>` | `<IAM Hera domain>` |

Add to `platform/dev/compose.dev.yml` under each Athena service's `environment` block:

```yaml
# CIAM Athena service
environment:
  - HERA_BASE_URL=http://localhost:3000

# IAM Athena service
environment:
  - HERA_BASE_URL=http://localhost:4000
```

### TypeScript Types

The canonical error codes are defined in Athena as:

```typescript
export const CALLBACK_ERROR_CODES = [
  'pkce_missing',
  'pkce_mismatch',
  'state_mismatch',
  'userinfo_unauthorized',
  'userinfo_unavailable',
  'identity_not_found',
  'flow_expired',
] as const;

export type CallbackErrorCode = typeof CALLBACK_ERROR_CODES[number];
```

Hera inlines this list as a const (no cross-repo import — there is no `@olympusoss/athena-shared` package). If the canonical list changes, both `athena/src/app/api/auth/callback/errors.ts` and the Hera login page allowlist must be updated together.

```typescript
// In Hera: canonical list — must match CALLBACK_ERROR_CODES in Athena's errors.ts
// See: athena/docs/oauth2-error-codes.md
const CALLBACK_ERROR_CODES = [
  'pkce_missing',
  'pkce_mismatch',
  'state_mismatch',
  'userinfo_unauthorized',
  'userinfo_unavailable',
  'identity_not_found',
  'flow_expired',
] as const;
```

### Server-Side Logging

Before every error redirect, Athena logs:

```json
{
  "error_code": "pkce_missing",
  "step": "pkce_verification",
  "timestamp": "2026-04-02T10:00:00.000Z"
}
```

The following fields are explicitly excluded from server-side logs:

- `access_token`
- `code` (authorization code)
- `id_token`
- `email`
- `sub`
- Full URL query string (contains `code` and `state`)
- `request.url`

---

## Examples

### Triggering error codes in dev

```bash
# Trigger state_mismatch: send a callback with a fake state value
curl -v "http://localhost:3001/api/auth/callback?code=test&state=invalid_state"
# → 302 Location: http://localhost:3000/login?error=state_mismatch

# Trigger flow_expired: use an expired Kratos flow ID
# Start a login flow, wait > 1 hour, then complete the callback
# → 302 Location: http://localhost:3000/login?error=flow_expired
```

### Handling error codes in an OAuth2 integration

```typescript
import type { CallbackErrorCode } from '@olympusoss/sdk'; // future SDK export

function handleCallbackError(code: string) {
  switch (code as CallbackErrorCode) {
    case 'pkce_missing':
    case 'pkce_mismatch':
      // PKCE cookie was absent or tampered — restart the auth flow
      window.location.href = '/auth/login';
      break;
    case 'flow_expired':
      // User took too long — restart cleanly with a user-friendly message
      window.location.href = '/auth/login?reason=session_expired';
      break;
    case 'identity_not_found':
      // Sub from userinfo not in Kratos — verify subject_type: public on client
      console.error('Identity not found — check OAuth2 client subject_type');
      break;
    case 'userinfo_unavailable':
      // Transient service degradation — retry is appropriate
      setTimeout(() => window.location.href = '/auth/login', 2000);
      break;
    default:
      // Unrecognized code — ignore silently per Hera allowlist behavior
      break;
  }
}
```

---

## Edge Cases

### Unrecognized `?error` values

If the Hera login page receives a `?error` value not in the allowlist (e.g., from a crafted URL), it is silently ignored. The login page renders normally with no notice. This prevents the error UI from being weaponized as a phishing surface.

### Stale error parameter after bookmark

If a user bookmarks the login URL after a failed login (e.g., `https://example.com/login?error=pkce_missing`) and returns days later, Hera will render the `Auth error: pkce_missing` notice even though there is no active failure. The notice is dismissible. URL cleanup via `history.replaceState()` is deferred to V2.

### Token exchange PKCE mismatch detection

PKCE mismatch at the token exchange stage (T5) maps to `pkce_mismatch` only if the Hydra token endpoint returns a distinguishable error in the response body. If Hydra does not return a machine-readable PKCE error code, the failure is treated as unclassified and redirects to `/login` without a `?error` parameter. The PR for athena#62 documents which behavior was observed in dev.

### Concurrent login tabs

Each login initiation writes a new `pkce_verifier` cookie (last write wins). If two tabs initiate login simultaneously, one callback will receive a stale verifier and redirect with `?error=pkce_missing` or `?error=pkce_mismatch`. The other tab will complete normally.

---

## Security Considerations

### Information disclosure

The 7 error codes identify the step that failed but do not reveal credential values, internal service names, or stack traces. An attacker who can trigger these error codes already knows the flow failed — the codes provide no additional uplift. This is consistent with how Auth0 and Supabase structure their callback errors.

### Phishing via crafted URLs

An attacker can send a victim to `https://example.com/login?error=identity_not_found` to display a fake error notice. Mitigations:

- Hera renders the notice with neutral language: `Auth error: identity_not_found` — not alarming user-facing copy like "Your account was not found"
- Unrecognized `?error` values are silently ignored — only the 7 canonical codes are rendered
- End-user-facing error messages (friendly copy explaining each code) require a separate UX story with its own Security review before they can be added

Do not substitute user-friendly language for the `Auth error: <code>` format without a Security review.

### Log sanitization

All server-side logging follows the sanitization rules in the Security Review for athena#62 (condition 1). The `logCallbackError()` helper explicitly excludes all PII and credential fields — see the TypeScript implementation in `athena/src/app/api/auth/callback/route.ts`.

---

## Related

- [OAuth2 Callback Flow](./oauth2-callback.md) — full callback flow, PKCE requirements, session structure
- [hera#40](https://github.com/OlympusOSS/hera/issues/40) — Hera-side error notice rendering
- [athena#62](https://github.com/OlympusOSS/athena/issues/62) — feature story
