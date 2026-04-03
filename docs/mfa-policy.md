# MFA Policy Configuration

## Overview

The MFA Policy settings panel in Athena gives CIAM administrators control over multi-factor authentication requirements for their tenant. Administrators can toggle MFA between optional and required, enable or disable individual MFA methods, and configure a grace period that gives users time to enroll before enforcement begins.

> **V1 enforcement limitation**: MFA enforcement in V1 applies to browser-based logins through Hera only. Applications that authenticate directly against Kratos (API clients, mobile SDKs, machine-to-machine flows) are not subject to this policy. See [Security Considerations](#security-considerations) for details.

---

## How It Works

MFA policy is stored in the `ciam_settings` table via the SDK. Hera reads these settings at login time and enforces enrollment redirects when required. Kratos enforces AAL2 (second factor required if enrolled) natively — Athena and Hera handle the policy layer on top.

### Policy Change Flow

1. Administrator saves settings in the Athena MFA Policy panel
2. Athena writes all setting keys atomically via `POST /api/settings/batch` (single Postgres transaction — all keys commit or none do)
3. SDK cache is invalidated; policy is live within the SDK TTL (default 60 seconds)
4. Policy takes effect on the **next login** — existing active sessions are not invalidated

### User Login with MFA Required

When `mfa.required` is `true` and a user logs in:

1. User completes password step (AAL1 session)
2. Hera middleware reads `mfa.required` from SDK (cached, up to 60 seconds stale)
3. If required and the user has no MFA method enrolled:
   - **Within grace period**: user is allowed to proceed; a dismissible banner prompts enrollment
   - **After grace period expires**: user is hard-redirected to `/settings/security/mfa?reason=required` and cannot proceed until enrollment is complete
4. If required and the user has enrolled: Kratos handles the AAL2 challenge normally

### Grace Period Semantics (Case B)

The grace period is measured from the moment `mfa.required` first transitions from `false` to `true`, stored as `mfa.policy_enabled_at`. All users — including those who registered before the policy was enabled — get the full grace window from the policy activation timestamp.

Grace period expiry computation (used in Hera middleware):

```typescript
const gracePeriodMs = gracePeriodDays * 86400000;
const policyEnabledAt = new Date(mfa_policy_enabled_at).getTime();
const isWithinGrace = Date.now() < policyEnabledAt + gracePeriodMs;
```

All timestamps are compared in UTC. `mfa.policy_enabled_at` is stored as an ISO 8601 UTC string.

**`mfa.policy_enabled_at` is write-once.** Athena sets this timestamp when `mfa.required` transitions `false → true` and `mfa.policy_enabled_at` is currently null in the database. If `mfa.required` is already `true` and the admin saves again, the timestamp is not overwritten. This invariant is enforced server-side: the batch handler reads the current DB value before constructing the write batch and only appends `mfa.policy_enabled_at` on the first `false → true` transition.

---

## API / Technical Details

### SDK Setting Keys

All MFA policy settings are stored in `ciam_settings` with category `mfa` via the SDK `batchSetSettings()` function.

| Key | Type | Default | Written By | Read By |
|-----|------|---------|------------|---------|
| `mfa.required` | boolean | `false` | Athena | Hera middleware |
| `mfa.methods.totp` | boolean | `true` | Athena | Hera, Kratos config |
| `mfa.methods.webauthn` | boolean | `false` | Athena | Hera (reserved) |
| `mfa.grace_period_days` | integer | `0` | Athena | Hera middleware |
| `mfa.policy_enabled_at` | ISO timestamp | `null` | Athena (automatic) | Hera middleware |

`mfa.policy_enabled_at` is set automatically by Athena when `mfa.required` first transitions `false → true`. It is not rendered in the admin UI and cannot be set manually via the panel. It must never be overwritten after it is initially set — doing so resets the grace period for all existing users.

### Batch Settings Endpoint

```
POST /api/settings/batch
```

Writes multiple settings atomically. All keys commit or none do (Postgres transaction). This endpoint is used for all MFA policy saves.

**Auth**: Admin session required. Returns `403` if the session lacks admin role.

**Request body**:

```json
{
  "settings": [
    { "key": "mfa.required", "value": "true", "category": "mfa" },
    { "key": "mfa.methods.totp", "value": "true", "category": "mfa" },
    { "key": "mfa.methods.webauthn", "value": "false", "category": "mfa" },
    { "key": "mfa.grace_period_days", "value": "7", "category": "mfa" }
  ]
}
```

**Response (success)**:

```json
{ "ok": true }
```

**Response (failure — any key fails, full rollback)**:

```json
{
  "ok": false,
  "error": "settings_batch_failed",
  "message": "All settings changes were rolled back. No partial updates were saved.",
  "rolled_back": true
}
```

**Validation errors**:

| Error Code | Condition | HTTP Status |
|------------|-----------|-------------|
| `mfa_no_methods_enabled` | `mfa.required=true` and all `mfa.methods.*=false` | `400` |
| `invalid_grace_period` | `mfa.grace_period_days` is not an integer in `[0, 365]` | `400` |

The `mfa_no_methods_enabled` check is both client-side (disables the Save button) and server-side (returns `400` before any write is attempted). This prevents a complete platform lockout: if MFA is required but no method is enabled, users have no enrollment path.

### MFA Stats Endpoint

```
GET /api/mfa/stats
```

Returns aggregate MFA enrollment statistics. Requires an authenticated admin session.

**Response**:

```json
{
  "total_identities": 1250,
  "mfa_enrolled": 430,
  "mfa_enrolled_percent": 34.4,
  "by_method": {
    "totp": 420,
    "webauthn": 10,
    "lookup_secret": 430
  },
  "computed_at": "2026-04-01T09:00:00Z"
}
```

Stats are computed by paginating the Kratos admin API (`GET /_admin/identities`) and counting enrolled credentials. Results are cached in-process with a 5-minute TTL. A background `setInterval` refreshes the cache every 4 minutes before the TTL expires.

**Cold start**: On first load after Athena restarts, the stats call triggers inline Kratos pagination. For tenants with many identities this may take several seconds. The endpoint has a 10-second timeout — if pagination does not complete within 10 seconds, the endpoint resolves with a stats-unavailable response. The UI renders a loading spinner during this window (not an error state).

**Stats UI states** (three distinct states):

| State | Trigger | Pre-save guard behavior |
|-------|---------|------------------------|
| Loading | Cold-start pagination in progress | Does NOT trigger the stats-unavailable save guard |
| Available | Cache populated | Shows enrollment counts; enables informed save decisions |
| Unavailable | Endpoint error or timeout | Triggers save confirmation modal if `mfa.required` is being enabled |

### Settings Panel Endpoints

```
# Read current MFA settings on page load
GET /api/settings?category=mfa

# Write MFA settings (batch — use this, not individual POSTs)
POST /api/settings/batch

# Read enrollment stats on page load
GET /api/mfa/stats
```

### SDK Function: `batchSetSettings()`

The Athena batch endpoint requires the `batchSetSettings()` function from `@olympusoss/sdk`:

```typescript
// Atomic multi-key write — all keys commit or none do (Postgres transaction)
await batchSetSettings([
  { key: 'mfa.required', value: 'true', category: 'mfa' },
  { key: 'mfa.methods.totp', value: 'true', category: 'mfa' },
  { key: 'mfa.grace_period_days', value: '7', category: 'mfa' },
]);
// If any write fails → transaction rolls back → no partial state persists
```

If any single write fails (DB error, constraint violation), the transaction is rolled back. The function throws on failure; the Athena handler catches this and returns the `settings_batch_failed` error response.

---

## Examples

### Enabling MFA Required with a 7-day grace period

1. Navigate to Athena → Settings → Security → MFA Policy
2. Toggle "Require MFA for all users" on
3. Set "Grace period" to 7 days
4. Click Save

Athena calls `POST /api/settings/batch` with `mfa.required=true`, `mfa.grace_period_days=7`, and (on the first enable) automatically appends `mfa.policy_enabled_at=<now>` to the batch. Hera enforcement begins on the next login for each user, allowing 7 days for enrollment.

### Reading MFA policy in Hera middleware

```typescript
import { getSettingOrDefault } from "@olympusoss/sdk";

const mfaRequired =
  (await getSettingOrDefault("mfa.required", "false")) === "true";

const gracePeriodDays = parseInt(
  await getSettingOrDefault("mfa.grace_period_days", "0"),
  10
);

const policyEnabledAt = await getSettingOrDefault("mfa.policy_enabled_at", "");

if (mfaRequired && policyEnabledAt) {
  const expiresAt =
    new Date(policyEnabledAt).getTime() + gracePeriodDays * 86400000;
  const isWithinGrace = Date.now() < expiresAt;
  // isWithinGrace === true → show enrollment banner, allow access
  // isWithinGrace === false → hard redirect to enrollment
}
```

### Checking batch endpoint authentication

```bash
# Unauthenticated request must return 401
curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:3001/api/settings/batch \
  -H "Content-Type: application/json" \
  -d '{"settings": [{"key": "mfa.required", "value": "true", "category": "mfa"}]}'
# Expected: 401
```

---

## Edge Cases

### `mfa.policy_enabled_at` is null when `mfa.required` is true

This state occurs if `mfa.required` is seeded directly via the SDK without going through the Athena panel. The Hera enforcement middleware must handle this explicitly. The recommended fallback is to treat the grace period as not yet started (allow access, show enrollment banner) and log a warning to surface the misconfiguration.

### SDK cache staleness (60-second window)

After an admin disables MFA Required, users continue to see the enforcement redirect for up to 60 seconds until the SDK cache expires. This is a V1 limitation — inform operators so they set accurate expectations.

### `grace_period_days` stored as string

The SDK stores all setting values as strings. Parse `mfa.grace_period_days` with `parseInt(..., 10)` and floor the result. Fractional values (e.g., `"7.5"`) are treated as the integer part. If the value fails to parse, fall back to `0`.

### Disabling TOTP does not remove enrolled credentials

If an admin disables `mfa.methods.totp`, users who already have TOTP enrolled are still prompted for TOTP at login. Disabling the method prevents new TOTP enrollments but does not remove existing TOTP credentials from Kratos. To stop challenging enrolled users, their TOTP credentials must be removed via the Kratos admin API.

The Athena UI shows an inline warning before saving when `mfa.methods.totp` is being disabled: "Disabling TOTP does not remove TOTP credentials from users who have already enrolled. Those users will continue to be prompted for TOTP at login until their credentials are removed in Kratos."

### Zero-grace-period confirmation

When `mfa.required` transitions `false → true` with `grace_period_days = 0`, Athena shows a confirmation modal before writing:

- **Stats available path**: "You are enabling MFA enforcement with a 0-day grace period. Users without MFA enrolled will be required to enroll immediately on their next login. [N enrolled / M total] users are currently enrolled."
- **Stats unavailable path**: "We cannot confirm how many users will be affected by this change. MFA grace period is 0 days — unenrolled users will be blocked on their next login. Proceed anyway?"

Both paths require explicit admin confirmation. This modal also fires when stats are unavailable and `mfa.required` is being enabled (regardless of grace period value), since the admin cannot see the enrollment impact.

### Stats cold start on large tenants

For tenants with 10K+ identities, the first stats load after Athena restarts may take up to the 10-second timeout. The UI shows a loading spinner during this time. The save button is available while stats are loading — but if the admin enables `mfa.required` while stats are still loading, the zero-grace confirmation (if applicable) fires with "Stats unavailable" copy.

### Concurrent admin saves

Two concurrent admin saves that both transition `mfa.required` from `false` to `true` may each read `mfa.policy_enabled_at` as null from the DB before either writes. The last transaction to commit wins. The grace period start timestamp is whichever admin's save committed last. This is a V1 known race condition with low likelihood; it does not affect correctness of the grace period formula, only the precision of the start timestamp.

---

## Security Considerations

### V1 browser-only enforcement limitation

MFA enforcement in V1 applies only to browser-based logins through Hera. Clients that authenticate directly against Kratos — API clients, mobile SDKs, server-side integrations, machine-to-machine flows — obtain valid Kratos sessions with no MFA challenge regardless of the `mfa.required` policy setting.

The MFA Policy page displays a persistent informational notice: "MFA enforcement applies to browser-based logins through Olympus. Applications using the Kratos API directly, mobile SDKs, and machine-to-machine flows are not covered by this policy in V1."

This limitation is documented in ADR-002. The correct V2 enforcement layer is the Hydra consent flow — reject token issuance when the session AAL is below AAL2 and `mfa.required` is true. Tracked as SR-MFA-3.

**SOC2 note**: V1 browser-only enforcement means MFA coverage is incomplete for API integrations. Any SOC2 audit documentation must note this limitation explicitly. Do not claim end-to-end MFA enforcement in V1 audit controls.

### Mass lockout prevention

The following guards prevent accidental lockout:

1. **Guard C (Critical)**: Athena blocks any save where `mfa.required=true` and all `mfa.methods.*=false`. The Save button is disabled client-side with an error message; the server returns `400` with `mfa_no_methods_enabled` before writing anything.

2. **Zero-grace confirmation modal (SR-MFA-2)**: When `mfa.required` transitions `false → true` with `grace_period_days=0`, Athena requires explicit admin confirmation (regardless of stats availability). This prevents immediate lockout of all unenrolled users.

3. **Stats-unavailable confirmation**: When stats are loading or unavailable and `mfa.required` is being enabled, Athena shows a confirmation modal warning that the enrollment impact is unknown.

Never set `grace_period_days = 0` without reviewing the unenrolled user count. Users who have not enrolled will be hard-blocked on their next login with no alternative path except admin intervention.

### `mfa.policy_enabled_at` invariant

The batch handler must never overwrite `mfa.policy_enabled_at` if it is already set in the database. The handler reads the current DB value before constructing the batch — it does not use the submitted payload to determine whether to write this key. A unit test enforces this invariant as a CI gate.

### Input validation

`mfa.grace_period_days` is validated server-side: must be a non-negative integer in `[0, 365]`. The Canvas `Input[type=number, min=0]` is not a security control — server-side validation is the gate.

### Audit logging

Every successful `POST /api/settings/batch` emits a structured audit log entry: admin identity ID (from session), UTC timestamp, changed keys, old values (redacted for encrypted fields), and new values. This is required for SOC2 CC6.2 (logical access changes are logged).

### Stats endpoint access

`GET /api/mfa/stats` is an authenticated admin-only route. The Athena middleware gate validates the session and admin role before the handler runs. Unauthenticated requests return `401`. Stats contain only aggregate counts — no individual user identification data is returned.

---

## Related

- [athena#48](https://github.com/OlympusOSS/athena/issues/48) — feature story
- [platform#14](https://github.com/OlympusOSS/platform/issues/14) — MFA policy setting keys and stats endpoint design
- [platform#13](https://github.com/OlympusOSS/platform/issues/13) — TOTP implementation
- `docs/state/ADR-002-mfa-policy-enforcement-layer.md` — V1 browser-only enforcement decision
- `docs/state/architecture-brief-mfa-policy-settings-panel.md` — full architecture brief
