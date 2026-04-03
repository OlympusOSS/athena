# Locked Accounts Admin View

## Overview

The locked accounts feature gives CIAM admins visibility into all active brute-force lockouts and the ability to manually unlock individual accounts. It is backed by the `@olympusoss/sdk` brute-force module, which records lockouts in the `ciam_lockouts` table of the `olympus` PostgreSQL database.

Both API routes are admin-only and are enforced by the `verifySession` + `isAdmin` middleware guard.

---

## How It Works

1. The SDK records a lockout in `ciam_lockouts` when an identifier exceeds the configured failed-attempt threshold (`security.brute_force.max_attempts`, default 5) within the sliding time window (`security.brute_force.window_seconds`, default 600s).
2. `GET /api/security/locked-accounts` calls `listLockedAccounts()` from the SDK, which queries `WHERE locked_until > NOW() AND unlocked_at IS NULL`. The route applies a hard cap of 500 rows and sets `truncated: true` in the response when the full result set exceeds that cap.
3. The Athena Security page renders the accounts in a table. When `truncated === true`, a warning banner is displayed above the table.
4. When an admin clicks Unlock, the page calls `POST /api/security/locked-accounts/unlock` with `{ "identifier": "..." }` in the request body. The route calls `unlockAccount(identifier, adminIdentityId)` from the SDK, which sets `unlocked_at` on the lockout row and writes an entry to `ciam_security_audit_log`. TanStack Query invalidates the list query on success, removing the row from the UI without a manual refresh.

```
Admin clicks Unlock
       |
POST /api/security/locked-accounts/unlock  { "identifier": "user@example.com" }
       |
verifySession + isAdmin middleware
       |
unlockAccount(identifier, adminIdentityId)   ← SDK
       |
SET unlocked_at = NOW() in ciam_lockouts
appendAuditLog({ action: "account_unlocked", ... })   ← internal to SDK
       |
200 { "success": true, "identifier": "user@example.com" }
       |
TanStack Query invalidates ["security", "locked-accounts"] → list re-fetches
```

---

## API

### GET /api/security/locked-accounts

Returns all active lockouts (not yet expired, not yet manually unlocked), capped at 500 rows.

**Auth**: Admin session required. Returns 401/403 if the session is absent or the role is not `admin`.

**Response**

```json
{
  "data": [
    {
      "identifier": "user@example.com",
      "identity_id": "3e4a1b2c-0000-0000-0000-000000000001",
      "locked_at": "2026-03-31T10:15:00.000Z",
      "locked_until": "2026-03-31T10:30:00.000Z",
      "lock_reason": "brute_force",
      "trigger_ip": "203.0.113.42",
      "auto_threshold_at": 5
    }
  ],
  "total": 12,
  "truncated": false
}
```

| Field | Type | Description |
|-------|------|-------------|
| `identifier` | `string` | The email or username that was locked |
| `identity_id` | `string \| null` | Kratos identity UUID; `null` if Kratos was unavailable when the lockout was created |
| `locked_at` | `string` (ISO 8601) | When the lockout was created |
| `locked_until` | `string` (ISO 8601) | When the lockout expires automatically |
| `lock_reason` | `string \| null` | Always `"brute_force"` for SDK-generated lockouts |
| `trigger_ip` | `string \| null` | IP address from the `X-Real-IP` header at the time of the 5th failed attempt; `null` if no IP was recorded |
| `auto_threshold_at` | `number \| null` | The attempt count that triggered the lockout |
| `total` | `number` | Total active lockouts before the cap is applied |
| `truncated` | `boolean` | `true` when `total > 500`; the UI renders a warning banner in this state |

**cURL example**

```bash
curl -s \
  -H "Cookie: athena-session=<session-cookie>" \
  https://admin.example.com/api/security/locked-accounts
```

**Error responses**

| Status | Body | Condition |
|--------|------|-----------|
| 401 | — | No valid session cookie |
| 403 | — | Valid session but role is not `admin` |
| 500 | `{ "error": "Failed to fetch locked accounts" }` | SDK threw on DB error; no stack trace is included |

---

### POST /api/security/locked-accounts/unlock

Manually unlocks a single account by identifier. The identifier is passed in the JSON request body, not in the URL path, to prevent it from appearing in access logs and browser history.

**Auth**: Admin session required.

**Request body**

```json
{ "identifier": "user@example.com" }
```

The `identifier` value is normalized to lowercase by the SDK before the SQL lookup. Pass the value as received from the locked accounts list.

**Response**

```json
{ "success": true, "identifier": "user@example.com" }
```

**cURL example**

```bash
curl -s -X POST \
  -H "Cookie: athena-session=<session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{ "identifier": "user@example.com" }' \
  https://admin.example.com/api/security/locked-accounts/unlock
```

**Error responses**

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "Missing or invalid identifier" }` | Body is absent, not valid JSON, or `identifier` is missing or not a string |
| 401 | — | No valid session cookie |
| 403 | — | Valid session but role is not `admin` |
| 404 | `{ "error": "No active lockout found" }` | The identifier has no active (unexpired, not yet unlocked) lockout row |
| 500 | `{ "error": "Failed to unlock account" }` | SDK threw on DB error; no stack trace is included |

---

## SDK Dependency

Both routes depend on `@olympusoss/sdk` (`listLockedAccounts` and `unlockAccount`). The SDK must be published to GitHub Packages via `octl bump` before these routes are functional. The required SDK version adds `trigger_ip: string | null` to the `LockedAccount` interface, the lockout INSERT, and the SELECT in `listLockedAccounts`. Deploying Athena with an older SDK version will cause a TypeScript type mismatch and the Source IP column will not render.

### SDK functions used

| Function | Called by | Throws on DB error |
|----------|-----------|--------------------|
| `listLockedAccounts()` | `GET /api/security/locked-accounts` | Yes — route returns 500 |
| `unlockAccount(identifier, adminIdentityId)` | `POST /api/security/locked-accounts/unlock` | Yes — route returns 500 |

`unlockAccount` calls `appendAuditLog` internally as fire-and-forget. The Athena route does not call `appendAuditLog` directly.

### adminIdentityId sourcing

The `adminIdentityId` argument to `unlockAccount` must be the Kratos identity UUID of the authenticated admin. The middleware injects this as the `x-user-id` header (`session.user.kratosIdentityId`). This value is written to `unlocked_by_admin_id` in `ciam_lockouts` and to `admin_identity_id` in `ciam_security_audit_log`. Passing any other value produces an unauditable unlock event.

---

## UI

The locked accounts view lives at `/security` in the Athena CIAM admin panel (port 3001). It is accessible only to users with the `admin` role — the Security nav item in the sidebar is not rendered for `viewer` role sessions.

**Table columns**: Identifier, Reason, Source IP, Failed Attempts, Locked At, Expires, Actions

The Expires cell renders both the absolute `locked_until` timestamp and the time remaining (e.g., "in 12 minutes"). The Refresh button re-fetches the list on demand without waiting for the 30-second TanStack Query stale window.

**Truncation banner**: When the API returns `truncated: true`, a warning banner is displayed above the table:

> Showing 500 of [total] locked accounts. Some accounts may not be displayed.

This state occurs during high-volume bot attacks when active lockouts exceed 500. Bulk-unlock workflows at this scale require direct SDK or database access.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| No active lockouts | The table renders an empty state message. The API returns `{ "data": [], "total": 0, "truncated": false }`. |
| `identity_id` is `null` | Accounts locked while Kratos was temporarily unavailable have `identity_id: null`. They appear in the list and unlock normally via `identifier`. No special handling required. |
| Unlock called for an already-unlocked or expired account | `unlockAccount` returns `false`. Route returns 404 `{ "error": "No active lockout found" }`. |
| Two admins unlock the same account concurrently | The second call returns 404. `unlockAccount` uses an atomic SQL UPDATE; only one call sets `unlocked_at`. The audit log contains one entry for the successful unlock. |
| `trigger_ip` is `null` | The Source IP column renders `"—"`. This occurs when `recordFailedAttempt` was called with no IP argument (e.g., the reverse proxy was not configured to set `X-Real-IP`). |
| Identifier case variants (e.g., `User@Example.com` vs. `user@example.com`) | The SDK normalizes to lowercase before SQL. Both variants resolve to the same lockout row. |
| More than 500 active lockouts | The GET route returns the first 500 rows and sets `truncated: true`. The warning banner is displayed in the UI. Rows beyond 500 are not accessible via this endpoint. |
| Database unavailable during GET | Route returns 500 `{ "error": "Failed to fetch locked accounts" }`. No stack trace is included in the response. |
| Database unavailable during POST unlock | Route returns 500 `{ "error": "Failed to unlock account" }`. The lockout row is unchanged. |

---

## Security Considerations

- **Identifier not in URL path**: The `POST /unlock` endpoint accepts the identifier in the JSON request body. This prevents it from being written to application access logs (Caddy, nginx), browser history, or reverse proxy logs. Do not change this design to a path parameter.
- **Admin-only enforcement**: Both routes are covered by the `ADMIN_PREFIXES` middleware guard. The `verifySession` + `isAdmin` check runs before any handler logic. Do not duplicate this check in the route handler itself.
- **`adminIdentityId` must be a real Kratos UUID**: The middleware sets `x-user-id` from the verified session. Do not substitute a display name, email, or internal row ID. The audit log uses this value as the sole attribution for the unlock action.
- **No stack traces in 500 responses**: Route handlers catch SDK errors and return a generic message. Never pass `err.message` or `err.stack` directly to `Response.json` in a 500 path.
- **`trigger_ip` is for audit, not rate limiting**: The IP recorded in `trigger_ip` reflects the source IP at the time of lockout. It does not drive any rate-limiting logic. Per-IP rate limiting is handled separately by the Caddy layer (platform#22).
- **Audit log is append-only**: `appendAuditLog` writes to `ciam_security_audit_log`. There is no delete or update path for audit entries. Admin unlocks are permanently recorded with the admin's Kratos UUID, the target identifier, and the previous `locked_until` value.
- **CSRF**: The unlock endpoint requires `Content-Type: application/json` and reads from `request.json()`. Cross-origin form submissions cannot set this content type, providing implicit CSRF protection consistent with the rest of the Athena API surface. See [docs/api-authentication.md](api-authentication.md) for the full CSRF model.

---

## Configuration

Lockout thresholds are stored in `ciam_settings` (category: `security`) and are read by the SDK at runtime with a 60-second cache TTL. Update them via the Athena Settings UI or directly via the settings API:

```bash
POST /api/settings
{ "key": "security.brute_force.max_attempts", "value": "5", "category": "security" }
{ "key": "security.brute_force.window_seconds", "value": "600", "category": "security" }
{ "key": "security.brute_force.lockout_duration_seconds", "value": "900", "category": "security" }
```

| Setting key | Default | Description |
|-------------|---------|-------------|
| `security.brute_force.max_attempts` | `5` | Failed attempts within the window before lockout |
| `security.brute_force.window_seconds` | `600` | Sliding window length in seconds |
| `security.brute_force.lockout_duration_seconds` | `900` | Lockout duration in seconds (minimum 60, enforced by SDK) |

Changes take effect within 60 seconds. No restart required.

---

## References

- SDK integration guide: `docs/project-knowledge/brute-force-integration.md`
- Architecture brief: `docs/state/architecture-brief-brute-force-protection.md`
- QA plan: `docs/state/qa-plan-brute-force-protection.md`
- DX plan: `docs/state/dx-plan-athena47-locked-accounts.md`
- GitHub issues: [athena#47](https://github.com/OlympusOSS/athena/issues/47), [platform#11](https://github.com/OlympusOSS/platform/issues/11), [hera#26](https://github.com/OlympusOSS/hera/issues/26)
