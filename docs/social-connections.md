# Social Connections Admin Panel

## Overview

The Social Connections page in Athena CIAM lets administrators configure OAuth2/OIDC social login providers. In V1, Google is the only active provider. Changes to non-secret config (enable/disable, scopes, display name) take effect immediately via the SIGHUP sidecar — no Kratos restart is needed. Changes to the client secret always require a Kratos container restart.

---

## How It Works

Config is stored in the SDK `ciam_settings` table. When an admin saves a non-secret change, Athena calls the SIGHUP sidecar (`POST /internal/kratos/reload`). The sidecar generates a Kratos OIDC config fragment, writes it to a shared named volume, and sends `kill -HUP 1` to the Kratos container via PID namespace sharing — Kratos hot-reloads without a restart and without dropping active sessions.

Client secret changes follow a different path: Athena stores the encrypted secret in the SDK but does not call the sidecar. The admin is instructed to restart `ciam-kratos` with the updated `GOOGLE_CLIENT_SECRET` env var.

See `docs/project-knowledge/social-login.md` for the full architecture, SIGHUP signal sequence, and Google setup guide.

---

## API / Technical Details

### `GET /api/connections/public` (unauthenticated — Hera integration)

- **Authentication**: None. Registered outside `ADMIN_PREFIXES`.
- **Purpose**: Returns the list of enabled provider IDs for Hera to render social login buttons.

**Response (HTTP 200)**:
```json
{ "providers": ["google"] }
```

**Empty response (no providers configured or all disabled)**:
```json
{ "providers": [] }
```

Response normalization: "not configured" and "configured but disabled" are both represented as `{ "providers": [] }` — these states are indistinguishable from the outside (Security Condition 2, platform#15).

**V2 advisory**: The response returns provider ID strings only. Hera derives display names locally. If a V2 provider requires a non-derivable display name, extend the response shape to `{ "providers": [{ "id": "google", "display_name": "Google" }] }`. Do not modify the V1 shape without coordination.

---

### `GET /api/connections/social` (admin — authenticated)

- **Authentication**: Admin session required. `ADMIN_PREFIXES` middleware applies.
- **Purpose**: Returns full connection config for the admin UI.

**Response (HTTP 200)**:
```json
{
  "connections": [
    {
      "provider": "google",
      "display_name": "Google",
      "client_id": "123456789.apps.googleusercontent.com",
      "client_secret": "••••••••",
      "scopes": "openid,email,profile",
      "enabled": true
    }
  ]
}
```

`client_secret` is always masked. The plaintext value is never returned.

**Error responses**:
- `401` — no admin session (`{ "error": "Unauthorized", "code": 401 }`)
- `403` — authenticated but not admin (`{ "error": "Forbidden", "code": 403 }`)

---

### `POST /api/connections/social` (admin — authenticated)

Create or update a social connection.

**Request body**:
```json
{
  "provider": "google",
  "client_id": "123456789.apps.googleusercontent.com",
  "client_secret": "my-secret",
  "scopes": "openid,email,profile",
  "display_name": "Google",
  "enabled": true
}
```

- `client_secret`: Optional on edit. If blank, the existing encrypted secret is preserved ("no change" semantics). If non-empty, triggers secret rotation path.
- `provider`: Must be in the allowlist (`google` in V1). Unknown providers return 400.

**Response (HTTP 200)**:
```json
{
  "success": true,
  "provider": "google",
  "secretChanged": false,
  "reloadStatus": "reloaded"
}
```

`secretChanged: true` means the client secret was updated — the sidecar was NOT called, and a Kratos restart is required.

**SDK write order**: The T8 route writes SDK keys in this mandatory sequence:
1. `social.<provider>.provider_id`
2. `social.<provider>.enabled`
3. `social.<provider>.client_id`
4. `social.<provider>.display_name`
5. `social.<provider>.client_secret` (encrypted, written last)

If any write in the sequence fails, `clearProviderSettings()` removes all keys written so far and returns HTTP 500 with `{ "error": "partial_save", "message": "Save failed. Partial configuration was automatically cleared. Please retry." }`.

**Error responses**: 400 (validation), 401, 403, 500 (partial_save)

---

### `PATCH /api/connections/social/:provider` (admin — authenticated)

Toggle enabled/disabled. Always triggers a SIGHUP reload.

**Request body**: `{ "enabled": false }`

**Response (HTTP 200)**: `{ "success": true, "provider": "google", "enabled": false, "reloadStatus": "reloaded" }`

---

### `DELETE /api/connections/social/:provider` (admin — authenticated)

Remove a social connection. Deletes all `social.<provider>.*` keys from `ciam_settings` and triggers a SIGHUP reload.

**Response (HTTP 200)**: `{ "success": true, "provider": "google", "reloadStatus": "reloaded" }`

**Error responses**: 400 (unknown provider), 401, 403

---

### `reloadStatus` Reference

All write endpoints (`POST`, `PATCH`, `DELETE`) return a `reloadStatus` field. These are the 6 canonical values:

| Value | Meaning |
|-------|---------|
| `"reloaded"` | Sidecar received the config, sent SIGHUP to Kratos, Kratos hot-reloaded. Change is live. |
| `"failed"` | Sidecar returned HTTP 500. Config persisted in SDK. Manual Kratos restart required. |
| `"unreachable"` | Athena could not connect to sidecar. Config persisted in SDK. Check sidecar status. |
| `"auth_failed"` | Sidecar returned HTTP 401. `CIAM_RELOAD_API_KEY` mismatch. Correct key and restart both containers. |
| `"misconfigured"` | `CIAM_KRATOS_RELOAD_URL` env var unset. No outbound call attempted. Config persisted in SDK. |
| `"skipped"` | `client_secret` was changed — sidecar intentionally not called. The response always includes `secretChanged: true` when this status is returned. This is the client-side mechanism for detecting the secret-changed state and displaying the restart warning. Kratos restart required. |

---

### SDK Key Schema

| Key | Encrypted | Notes |
|-----|-----------|-------|
| `social.<provider>.provider_id` | No | Existence marker — written first; presence signals a complete record |
| `social.<provider>.enabled` | No | Written second |
| `social.<provider>.client_id` | No | Written third |
| `social.<provider>.display_name` | No | Written fourth |
| `social.<provider>.client_secret` | Yes (AES-256-GCM) | Written last |
| `social.connections_order` | No | JSON array — controls button order in V2 |

---

## Examples

### Enabling Google via the Admin Panel

1. Log in to Athena (CIAM, port 3001)
2. Navigate to **Authentication** → **Social Connections**
3. Click **Add Connection**, select **Google**
4. Enter Client ID and Client Secret from Google Cloud Console
5. Confirm Scopes: `openid email profile`
6. Toggle **Enabled** on
7. Click **Save**

Athena applies the change immediately (non-secret path). Verify with:
```bash
curl http://localhost:3001/api/connections/public
# Expected: { "providers": ["google"] }
```

### Toggling a Provider via API

```bash
curl -X PATCH http://localhost:3001/api/connections/social/google \
  -H "Content-Type: application/json" \
  -H "Cookie: <admin-session-cookie>" \
  -d '{"enabled": false}'
# Returns: { "success": true, "provider": "google", "enabled": false, "reloadStatus": "reloaded" }
```

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| POST with blank `client_secret` on edit | Blank = no change. Existing encrypted secret preserved. Non-secret fields updated normally. |
| POST with `client_secret` non-empty | Secret rotation path: stored encrypted, sidecar not called, `secretChanged: true` returned. |
| SDK write fails mid-sequence (partial_save) | `clearProviderSettings()` runs automatically. HTTP 500 returned. Admin must retry — no manual cleanup needed. |
| Unknown provider in POST/PATCH/DELETE | 400 returned immediately. No SDK write attempted. |
| Sidecar down during save | `reloadStatus: "unreachable"`. Config persisted in SDK. Restart sidecar and retrigger a non-secret save. |
| Delete while users are active | Existing Kratos sessions remain valid. Only new login attempts via that provider are blocked. |

---

## Security Considerations

- `client_secret` is stored encrypted (AES-256-GCM via SDK). Never returned in any API response. Displayed as `••••••••` in the admin UI.
- Authentication enforcement is at route registration level (`ADMIN_PREFIXES`), not inside handler logic. The public route (`/api/connections/public`) is registered entirely separately.
- `X-Reload-Api-Key` header used for sidecar authentication must never appear in Athena logs. The header is redacted at the application layer in `src/services/kratos/reload.ts` (implemented in athena#89 — required merge gate before athena#49 ships).
- The sidecar reload endpoint is internal-network only. Caddy blocks all `/internal/*` paths. Port 3110 has no host binding.
- Audit log entries are emitted for all write operations (create, update, enable, disable, delete) — required for SOC2 CC6.2. Audit logging is tracked separately in athena#90.
- All write endpoints (`POST`, `PATCH`, `DELETE`) on `/api/connections/social` require an admin session enforced by middleware.

> **Security:** Do not set `DEBUG=axios*` in production. Axios debug logging emits raw request headers before application-level redaction runs. Setting this variable will expose `X-Reload-Api-Key` in server logs regardless of the redaction logic in `src/services/kratos/reload.ts`.

---

## Related Issues and Documents

| Reference | Description |
|-----------|-------------|
| platform#15 | Epic: Social Login Connections — Google OIDC + SIGHUP sidecar |
| athena#49 | This feature — admin config panel for social connections |
| athena#89 | Prerequisite: Redact `X-Reload-Api-Key` from Athena request logs (must be merged before athena#49 ships) |
| athena#90 | Audit logging for social connection config changes (SOC2 CC6.2) |
| hera#30 | Dynamic social login button rendering — must use `GET /api/connections/public` |
| `docs/project-knowledge/social-login.md` | Full platform-level social login doc (architecture, SIGHUP sidecar, Google setup guide, environment variables) |
| `docs/state/architecture-brief-social-login.md` | Architecture brief with sidecar design and signal delivery sequence |
| `docs/state/ADR-003-social-login-config-reload.md` | Decision record: SIGHUP sidecar (Option A) accepted |
