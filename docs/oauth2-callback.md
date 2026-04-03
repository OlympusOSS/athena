# OAuth2 Callback Flow

## Overview

Athena authenticates admin users via IAM Hydra's OAuth2 authorization code flow with PKCE S256. The callback route (`/api/auth/callback`) exchanges the authorization code for tokens, retrieves verified identity claims from Hydra's `/oauth2/userinfo` endpoint, resolves the user's role from Kratos, and sets the `athena-session` cookie. ID tokens are never decoded for claim retrieval.

This document covers the full callback flow, PKCE requirements, userinfo integration, session creation, and error handling.

---

## How It Works

### Full Flow

```
1. Browser → GET /api/auth/login
   └─ Athena generates PKCE code_verifier (32 random bytes, base64url)
   └─ Derives code_challenge = base64url(SHA-256(code_verifier))
   └─ Stores code_verifier in httpOnly pkce_verifier cookie (5-min TTL)
   └─ Stores state in httpOnly oauth_state cookie
   └─ Redirects browser to Hydra authorization URL:
      GET {IAM_HYDRA_PUBLIC_URL}/oauth2/auth
        ?response_type=code
        &client_id={CLIENT_ID}
        &redirect_uri={CALLBACK_URL}
        &scope=openid+profile+email
        &code_challenge={CODE_CHALLENGE}
        &code_challenge_method=S256
        &state={STATE}

2. Browser → Hera IAM login page
   └─ User authenticates (email/password, MFA if configured)
   └─ Hydra redirects to Hera consent page
   └─ Hera accepts consent
   └─ Hydra redirects browser to /api/auth/callback?code=...&state=...

3. Browser → GET /api/auth/callback?code={AUTH_CODE}&state={STATE}
   │
   ├─ [Guard 1] state === oauth_state cookie? No → redirect to /api/auth/login
   ├─ [Guard 2] pkce_verifier cookie present? No → redirect to /api/auth/login
   │
   ├─ POST {IAM_HYDRA_PUBLIC_URL}/oauth2/token
   │    body: grant_type=authorization_code
   │          &code={AUTH_CODE}
   │          &redirect_uri={CALLBACK_URL}
   │          &client_id={CLIENT_ID}
   │          &code_verifier={CODE_VERIFIER}
   │    → { access_token, id_token, refresh_token, expires_in }
   │
   ├─ Token exchange non-2xx? → redirect to /api/auth/login
   │
   ├─ GET {IAM_HYDRA_PUBLIC_URL}/oauth2/userinfo
   │    Authorization: Bearer {ACCESS_TOKEN}
   │    → { sub, email, ... }   ← Hydra-verified claims
   │
   ├─ Userinfo non-2xx? → redirect to /api/auth/login (no fallback decode)
   │
   ├─ GET {IAM_KRATOS_ADMIN_URL}/admin/identities/{SUB}
   │    → { metadata_admin: { role: "admin" | "viewer" }, ... }
   │
   ├─ Kratos 404? → session created with role: "viewer" (identity not found)
   │
   └─ Set athena-session cookie (HMAC-signed session payload)
      Clear oauth_state and pkce_verifier cookies
      Redirect to /dashboard
```

### Why `/oauth2/userinfo` Instead of ID Token Decoding

The previous implementation base64-decoded the `id_token` payload without verifying the JWT signature. This allowed an attacker who could supply a crafted `id_token` to impersonate any admin identity. The fix delegates claim retrieval entirely to Hydra:

- Hydra validates the `access_token` server-side before returning claims
- No JWT cryptography occurs in Athena
- Key rotation is transparent (Hydra handles JWKS key management)
- The `alg: none` JWT bypass attack is entirely eliminated

**The `id_token` is retained in the session for downstream use (logout hint, future OIDC SLO) but is never decoded for claim retrieval.** Any code that reads `session.idToken` and decodes it reintroduces the original vulnerability. See the PROHIBITION comment at line 67 of `callback/route.ts` and [athena#52](https://github.com/OlympusOSS/athena/issues/52).

---

## PKCE Requirements

PKCE S256 is mandatory for the Athena OAuth2 client. The Hydra client registration uses `token_endpoint_auth_method: none`, which enforces PKCE on every authorization code exchange.

### Parameters

| Parameter | Location | Description |
|-----------|----------|-------------|
| `code_challenge` | Authorization URL query string | `base64url(SHA-256(code_verifier))` |
| `code_challenge_method` | Authorization URL query string | Always `S256` |
| `code_verifier` | Token exchange POST body | 32 random bytes, base64url-encoded |
| `pkce_verifier` cookie | Set at login initiation, read at callback | Stores `code_verifier` for the duration of the flow |

### Generating PKCE Parameters (TypeScript)

```typescript
import { randomBytes, createHash } from "crypto";

// Generate verifier
const codeVerifier = randomBytes(32)
  .toString("base64url");

// Derive challenge
const codeChallenge = createHash("sha256")
  .update(codeVerifier)
  .digest("base64url");
```

### PKCE Cookie

The `pkce_verifier` cookie stores the `code_verifier` between the login initiation and the callback:

```
Set-Cookie: pkce_verifier=<code_verifier>; HttpOnly; SameSite=Lax; Max-Age=300; Path=/
```

If the `pkce_verifier` cookie is absent when the callback is reached (e.g., cookie expired after 5 minutes, or a second browser tab overwrote it), the callback redirects to `/api/auth/login` without making any Hydra calls.

---

## OAuth2 Client Configuration

The Athena client is registered in IAM Hydra as a **public client**:

| Field | Value | Reason |
|-------|-------|--------|
| `token_endpoint_auth_method` | `none` | Public client — no client secret; enforces PKCE |
| `subject_type` | `public` | Returns raw Kratos identity UUID as `sub`; pairwise would return a non-matching HMAC |
| `grant_types` | `["authorization_code"]` | Only auth code flow is used |
| `response_types` | `["code"]` | Code only; no implicit |
| `scope` | `openid profile email` | Minimum required for userinfo claims |

**`subject_type: public` is required.** With `subject_type: pairwise` (Hydra's default), the `/oauth2/userinfo` response returns a deterministic HMAC-derived subject identifier instead of the Kratos identity UUID. The Kratos admin lookup at `/admin/identities/{sub}` will 404 on every login. Both seed scripts (`platform/dev/iam-seed-dev.sh` and `platform/prod/seed-prod.sh`) explicitly set `subject_type: public` for the Athena clients.

**No `client_secret`**. The token exchange POST body contains only `client_id`, `code_verifier`, `code`, `grant_type`, and `redirect_uri`. No `Authorization: Basic` header is sent.

---

## Session Structure

After a successful callback, the `athena-session` cookie contains an HMAC-signed JSON payload:

```typescript
interface SessionData {
  kratosIdentityId: string;  // Kratos identity UUID (from /oauth2/userinfo sub)
  email: string;             // From /oauth2/userinfo
  role: "admin" | "viewer";  // From Kratos identity metadata_admin.role
  idToken: string;           // Retained for logout hint / OIDC SLO only
                             // NEVER decode this for claim retrieval — see athena#52
}
```

The `role` field is resolved at login time from Kratos identity metadata. Changes to a user's role in Kratos take effect on their next login.

---

## Error Handling

All errors during the callback flow redirect to the Hera login page. Classified failures append a structured `?error=<code>` query parameter to the redirect URL. No partial session is created.

| Failure Point | Error Code | Redirect Target |
|---------------|-----------|-----------------|
| State mismatch (CSRF attempt) | `state_mismatch` | `{HERA_BASE_URL}/login?error=state_mismatch` |
| `pkce_verifier` cookie missing | `pkce_missing` | `{HERA_BASE_URL}/login?error=pkce_missing` |
| `pkce_verifier` present but invalid | `pkce_mismatch` | `{HERA_BASE_URL}/login?error=pkce_mismatch` |
| Token exchange non-2xx (unclassified) | none | `{HERA_BASE_URL}/login` |
| `/oauth2/userinfo` 401 | `userinfo_unauthorized` | `{HERA_BASE_URL}/login?error=userinfo_unauthorized` |
| `/oauth2/userinfo` 5xx | `userinfo_unavailable` | `{HERA_BASE_URL}/login?error=userinfo_unavailable` |
| Kratos identity 404 | `identity_not_found` | `{HERA_BASE_URL}/login?error=identity_not_found` |
| Kratos flow 410 (expired) | `flow_expired` | `{HERA_BASE_URL}/login?error=flow_expired` |

The `HERA_BASE_URL` environment variable must be set in the Athena container. See [oauth2-error-codes.md](./oauth2-error-codes.md) for configuration details.

Hera reads the `?error` query parameter, validates it against the canonical allowlist, and renders a dismissible notice (`Auth error: <code>`). Unrecognized values are silently ignored.

All failures are logged server-side before the redirect. Logs contain only `{ error_code, step, timestamp }` — no PII, no token values, no query strings. See [oauth2-error-codes.md](./oauth2-error-codes.md) for the full error code reference, plain-English descriptions, and developer remediation steps.

---

## Examples

### Manual PKCE Flow (Testing)

To test the flow manually without a browser:

```bash
# Step 1: Generate PKCE parameters
CODE_VERIFIER=$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')
CODE_CHALLENGE=$(echo -n "$CODE_VERIFIER" | openssl dgst -sha256 -binary | openssl base64 | tr '+/' '-_' | tr -d '=')
STATE=$(openssl rand -hex 16)

# Step 2: Construct authorization URL
echo "Visit:"
echo "http://localhost:4102/oauth2/auth?response_type=code&client_id=athena-iam-client&redirect_uri=http://localhost:4001/api/auth/callback&scope=openid+profile+email&code_challenge=${CODE_CHALLENGE}&code_challenge_method=S256&state=${STATE}"

# Step 3: After redirect, extract AUTH_CODE from callback URL
# Step 4: Exchange code for tokens
curl -s -X POST http://localhost:4102/oauth2/token \
  -d "grant_type=authorization_code" \
  -d "code=${AUTH_CODE}" \
  -d "redirect_uri=http://localhost:4001/api/auth/callback" \
  -d "client_id=athena-iam-client" \
  -d "code_verifier=${CODE_VERIFIER}" | jq .

# Step 5: Get verified claims from userinfo
curl -s http://localhost:4102/oauth2/userinfo \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" | jq .
```

### Verify Client Registration

After re-seeding, confirm the Athena client is registered correctly:

```bash
# IAM domain (port 4103 is Hydra Admin)
curl -s http://localhost:4103/admin/clients/athena-iam-client | jq '{subject_type, token_endpoint_auth_method}'
# Expected: { "subject_type": "public", "token_endpoint_auth_method": "none" }

# CIAM domain
curl -s http://localhost:3103/admin/clients/athena-ciam-client | jq '{subject_type, token_endpoint_auth_method}'
```

### Verify Session After Login

Decode the `athena-session` cookie to confirm `kratosIdentityId` is a valid UUID (not a pairwise HMAC):

```bash
# Extract the payload portion (base64url between first and last dot)
echo "<athena-session-value>" | cut -d'.' -f1 | base64 -d | jq .
# Valid: { "kratosIdentityId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", "role": "admin", ... }
# Invalid (pairwise): { "kratosIdentityId": "<64-char hex string>", ... }
```

---

## Edge Cases

### Two Tabs Initiating Login Simultaneously

Each login initiation writes a new `pkce_verifier` cookie (last write wins). If two tabs start login simultaneously, one callback will receive a stale verifier and redirect to login. The other will complete normally. This is a safe failure — PKCE failure redirects to login without leaking any state.

### Authorization Code Replay

Hydra invalidates authorization codes after single use. A second token exchange attempt with the same code returns `400 invalid_grant`. Athena redirects to login.

### `access_token` Missing from Token Response

If `access_token` is absent from the token exchange response, the Bearer token for `/oauth2/userinfo` will be `undefined`. Hydra returns `401`. Athena redirects to login.

### Empty `sub` from Userinfo

If Hydra returns a userinfo response with an empty or absent `sub`, Athena creates a session with an empty `kratosIdentityId`. The Kratos lookup returns 404 and the role defaults to `viewer`. The user is redirected to `/dashboard` with a degraded session. A follow-on issue will redirect to login instead of creating a degraded session.

### Dev Environment: Re-seeding Required

If a running dev stack was seeded before the `subject_type: public` fix was applied, the existing Hydra client registrations are still `pairwise`. A fresh seed is required:

```bash
cd platform/dev
podman compose down -v
podman compose up -d
# Then run the seed script: ./iam-seed-dev.sh
```

---

## Security Considerations

- **Never decode `id_token` for claims**. The `id_token` is stored in the session for logout hint and OIDC SLO purposes only. Any `atob`, `Buffer.from(..., 'base64')`, or `jwt-decode` call in `callback/route.ts` reintroduces the OWASP A07 vulnerability fixed in [athena#52](https://github.com/OlympusOSS/athena/issues/52).
- **No fallback on userinfo failure**. If `/oauth2/userinfo` returns non-2xx, the callback redirects to login. There is no fallback path that reads the `id_token`. Do not add one.
- **State parameter validation**. The `state` cookie is checked before any Hydra call. Removing this check opens a CSRF attack vector.
- **PKCE is mandatory**. The Hydra client uses `token_endpoint_auth_method: none`, which requires PKCE on every token exchange. A token exchange without `code_verifier` returns `400 invalid_grant` from Hydra.
- **`alg: none` bypass eliminated**. Because Athena no longer decodes the `id_token` for any claims, JWT algorithm confusion attacks (including `alg: none`) have no attack surface in the callback route.
- **Session HMAC**. The `athena-session` cookie is HMAC-SHA256-signed. Any modification invalidates the signature. Roles cannot be escalated by modifying the cookie.
- **`subject_type: public` privacy note**. The Athena OAuth2 client uses `subject_type: public`, meaning the same Kratos UUID is returned as `sub` regardless of which client requested the claims. This is intentional for an admin-only internal tool. Third-party OAuth2 clients should use `subject_type: pairwise` (the Hydra default) to prevent user correlation across services.
- **OWASP categories addressed**: A07:2021 Identification and Authentication Failures (unverified token claims), A02:2021 Cryptographic Failures (base64 decode without signature verification).

---

## Related Issues

- [athena#52](https://github.com/OlympusOSS/athena/issues/52) — Security fix: ID token decoded without JWKS signature verification
- [athena#62](https://github.com/OlympusOSS/athena/issues/62) — surface callback errors as structured query parameters (shipped)
- [hera#40](https://github.com/OlympusOSS/hera/issues/40) — Hera login page error notice rendering
- [athena#63](https://github.com/OlympusOSS/athena/issues/63) — DX story: write PKCE and public client OAuth2 integration guide
