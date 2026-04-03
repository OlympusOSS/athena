# Settings API

## Overview

The Athena settings API provides CIAM administrators with a persistent key-value configuration store backed by the `@olympusoss/sdk`. Settings support optional encryption for sensitive values and are read by Hera and other services at runtime. Changes take effect within the SDK cache TTL (default 60 seconds) with no service restart.

## How It Works

Settings are stored in the `ciam_settings` table of the `olympus` PostgreSQL database. Athena proxies CRUD operations through the SDK and exposes them via a REST API. Each setting has a key, value, optional encryption flag, and optional category.

### Single-Key Fetch

`GET /api/settings/:key` calls `getSetting(key)` directly in the SDK — one SQL query, one row. It does NOT call `listSettings()` and filter client-side.

The response includes the `encrypted` boolean field so consumers can determine whether the stored value is ciphertext or plaintext.

### Listing Settings

`GET /api/settings` returns all settings with encrypted values masked (the ciphertext is returned, not the plaintext, and `encrypted: true` is set). Athena does not decrypt values on listing.

### Creating and Updating Settings

`POST /api/settings` creates or updates a setting. If `encrypted: true`, the value is encrypted with AES-256-GCM before storage. The encryption key is provided to the container via the `ENCRYPTION_KEY` environment variable.

## API / Technical Details

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/settings` | Admin session | List all settings (encrypted values masked) |
| `GET` | `/api/settings/:key` | Admin session | Get a single setting by key |
| `GET` | `/api/settings/:key?decrypt=true` | Admin session | Get a single setting with encrypted value decrypted |
| `POST` | `/api/settings` | Admin session | Create or update a setting |
| `DELETE` | `/api/settings/:key` | Admin session | Delete a setting |

All endpoints require an authenticated admin session. Unauthenticated requests return `401 Unauthorized`.

### GET /api/settings/:key

Returns the full setting object.

```bash
curl -H "Cookie: ory_session=..." \
  https://admin.example.com/api/settings/captcha.enabled
```

```json
{
  "key": "captcha.enabled",
  "value": "true",
  "encrypted": false,
  "category": "captcha",
  "updated_at": "2026-04-01T12:00:00.000Z"
}
```

Returns `404` if the key does not exist.

### GET /api/settings/:key?decrypt=true

Returns the decrypted value for an encrypted setting. The `value` field contains the plaintext.

```bash
curl -H "Cookie: ory_session=..." \
  "https://admin.example.com/api/settings/smtp.password?decrypt=true"
```

```json
{
  "key": "smtp.password",
  "value": "my-plaintext-password",
  "encrypted": true,
  "category": "email",
  "updated_at": "2026-04-01T12:00:00.000Z"
}
```

### POST /api/settings

```bash
curl -X POST \
  -H "Cookie: ory_session=..." \
  -H "Content-Type: application/json" \
  -d '{"key": "captcha.enabled", "value": "true", "category": "captcha"}' \
  https://admin.example.com/api/settings
```

```bash
# Encrypted value
curl -X POST \
  -H "Cookie: ory_session=..." \
  -H "Content-Type: application/json" \
  -d '{"key": "smtp.password", "value": "secret", "encrypted": true, "category": "email"}' \
  https://admin.example.com/api/settings
```

Request body fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Setting key (dot-notation recommended) |
| `value` | string | Yes | Setting value |
| `encrypted` | boolean | No | If true, value is encrypted before storage (default: false) |
| `category` | string | No | Grouping label for display (e.g., "captcha", "email") |

### DELETE /api/settings/:key

```bash
curl -X DELETE \
  -H "Cookie: ory_session=..." \
  https://admin.example.com/api/settings/captcha.enabled
```

Returns `204 No Content` on success. Returns `404` if the key does not exist.

### Setting Object Shape

```typescript
interface Setting {
  key: string
  value: string        // ciphertext if encrypted === true and ?decrypt not requested
  encrypted: boolean   // whether the value is stored encrypted
  category: string | null
  updated_at: Date
}
```

## Examples

### Vault fallback pattern in consuming services

Services that read settings from Athena's SDK layer use the vault fallback pattern. The SDK value takes priority; the environment variable serves as a default for zero-downtime migration:

```typescript
import { getSettingOrDefault } from "@olympusoss/sdk";

const captchaEnabled = await getSettingOrDefault(
  "captcha.enabled",
  process.env.CAPTCHA_ENABLED || "false"
);
```

### Reading settings in Hera

Hera reads settings directly via the SDK (same database, different table name):

```typescript
// hera/src/lib/config.ts
const geoEnabled = await getSettingOrDefault("geo.enabled", "false");
const captchaEnabled = await getSettingOrDefault("captcha.enabled", "false");
```

## Edge Cases

### Key not found

`GET /api/settings/:key` returns `404 Not Found`. Consumers should handle this explicitly rather than assuming a default.

### Encrypted values on list

`GET /api/settings` returns encrypted values as ciphertext with `encrypted: true`. The plaintext is never returned on listing — use `GET /api/settings/:key?decrypt=true` to read the decrypted value.

### Cache staleness

Setting changes take effect within the SDK cache TTL (default 60 seconds). Services that have cached a setting value will see the updated value within 60 seconds of the change. This is expected behavior — Athena does not push change notifications to consuming services.

### Category filter

`GET /api/settings?category=captcha` filters by category on the client side. The underlying query still reads all settings. For large settings tables, category filtering is a display concern, not an efficiency mechanism.

## Security Considerations

- All endpoints require an authenticated admin session. The Athena middleware gate validates the session before any route handler runs.
- Encrypted values are stored as AES-256-GCM ciphertext. The `ENCRYPTION_KEY` environment variable must be set correctly on the Athena container — if it changes, existing encrypted values cannot be decrypted.
- The `encrypted` boolean field on the response allows API consumers to correctly identify whether a returned value is ciphertext or plaintext. Do not interpret a value as plaintext when `encrypted: true` without calling the decrypt path.
- Do not log the response from `GET /api/settings/:key?decrypt=true`. Decrypted values are sensitive.
- The settings table contains operational secrets (OAuth2 client IDs, CAPTCHA keys, SMTP credentials). Restrict admin session access accordingly.
