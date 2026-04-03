# Athena API Authentication

## Overview

Every Athena API route is protected by Next.js edge middleware (`src/middleware.ts`). The middleware verifies an HMAC-signed session cookie on each request before it reaches any route handler. Routes without a valid session receive a `401`. Routes with a valid session but insufficient role receive a `403`. Only `/api/health` and `/api/auth/**` are public.

This document covers how to obtain a session, which routes require which roles, and what error responses to expect.

> **Audience**: Internal developers integrating with or debugging the Athena admin API.

---

## How Authentication Works

Athena uses a single authentication mechanism: the `athena-session` cookie, set after a successful OAuth2 login via the Olympus IAM OAuth2 server.

```
Request arrives at Athena
        │
        ▼
middleware.ts (Next.js edge middleware)
        │
        ├─ isPublicRoute()? ──Yes──→ Pass through (no auth required)
        │   /api/health
        │   /api/auth/**
        │   /api/connections/social  (read-only, fetched by Hera)
        │
        ├─ isProxyRoute()? ──Yes──→ Pass through (Olympus identity APIs enforce their own auth)
        │   /api/kratos/**
        │   /api/kratos-admin/**
        │   /api/iam-kratos/**
        │   /api/iam-kratos-admin/**
        │   /api/hydra/**
        │   /api/hydra-admin/**
        │
        ▼
verifySession(cookie) ──Fail──→ 401 { "error": "not_authenticated", "message": "...", "suggestion": "..." }
        │
        ▼
isAdminRoute()? ──Yes──→ role === "admin"? ──No──→ 403 { "error": "forbidden", "message": "...", "suggestion": "..." }
        │
        ▼
Route handler runs
```

The session cookie is an HMAC-SHA256-signed JSON payload. Any tampered or missing cookie fails `verifySession()` and returns `401` before the route handler runs.

---

## Obtaining a Session

Athena uses the OAuth2 Authorization Code + PKCE flow through the Olympus IAM OAuth2 server. There is no API key, bearer token, or server-to-server auth path — only browser-initiated OAuth2 sessions are supported. See [athena#50](https://github.com/OlympusOSS/athena/issues/50) for the planned M2M credential flow for service-to-service use cases.

### Full Login Flow

```
Developer browser
  → GET /api/auth/login
      (Athena generates: state, code_verifier, code_challenge=SHA-256(verifier))
      (Stores state and code_verifier in short-lived HttpOnly cookies)
  → Redirect to Olympus IAM OAuth2 server /oauth2/auth
      ?client_id=...
      &response_type=code
      &scope=openid profile email
      &redirect_uri=http://localhost:4001/api/auth/callback
      &state=<random>
      &code_challenge=<base64url(SHA-256(verifier))>
      &code_challenge_method=S256
  → Olympus IAM login UI (user authenticates)
  → Olympus IAM OAuth2 server redirects back to /api/auth/callback?code=...&state=...
  → Athena validates state, retrieves code_verifier from cookie
  → Athena POSTs to /oauth2/token
      grant_type=authorization_code
      code=<code>
      redirect_uri=...
      client_id=...
      code_verifier=<verifier>          ← no client_secret (public client)
  → Athena fetches verified identity claims from /oauth2/userinfo
  → Athena sets athena-session cookie (HttpOnly, SameSite=Lax, Secure in production)
  → Browser redirects to /dashboard
```

### Step 1: Initiate Login

```bash
GET http://localhost:4001/api/auth/login
```

This redirects to the Olympus IAM OAuth2 authorization endpoint with a PKCE `code_challenge` and `code_challenge_method=S256`. The browser follows the redirect to the Olympus IAM login page.

### Step 2: Complete Authentication

Log in at the Olympus IAM login page. After successful authentication, the OAuth2 server redirects back to Athena's callback route (`/api/auth/callback`).

### Step 3: Session Cookie Set

On callback success, Athena sets the `athena-session` cookie:

| Attribute | Value |
|-----------|-------|
| Name | `athena-session` |
| `HttpOnly` | true |
| `SameSite` | `strict` |
| `Secure` | true (production only; false on localhost to allow HTTP in dev) |
| Lifetime | Matches OAuth2 token `expires_in`, capped at 8 hours (28800 seconds) |

### Step 4: Use the Session

```bash
# Example: list all settings with an admin session
curl -b "athena-session=<cookie-value>" http://localhost:4001/api/settings

# Example: get a single setting
curl -b "athena-session=<cookie-value>" http://localhost:4001/api/settings/captcha.enabled

# Example: write a setting
curl -b "athena-session=<cookie-value>" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"key":"captcha.enabled","value":"true"}' \
  http://localhost:4001/api/settings
```

> **Note**: The session cookie is `HttpOnly`. You cannot read its value from JavaScript — that is intentional. In a browser, the cookie is sent automatically on every same-origin request. For `curl` testing, copy the cookie value from your browser's DevTools (Application > Cookies > `athena-session`).

---

## No Server-to-Server Auth Path

Athena has no server-to-server authentication path. There is no API key, bearer token, or `client_credentials` flow for Athena.

**Why**: Athena is an admin dashboard UI, not an API service. It is not designed to be called by other services. The authentication model — browser-initiated OAuth2 sessions — is intentional.

**If you need service-to-service access**: Use the Olympus IAM OAuth2 server's `client_credentials` flow directly (see [athena#50](https://github.com/OlympusOSS/athena/issues/50) for the planned M2M capability). Do not attempt to build an alternative auth path into Athena.

---

## Route Authentication Requirements

| Route | Method | Auth Required | Role Required |
|-------|--------|--------------|---------------|
| `/api/health` | GET | None (public) | — |
| `/api/auth/**` | ANY | None (public) | — |
| `/api/settings` | GET | Session | admin |
| `/api/settings` | POST | Session | admin |
| `/api/settings/:key` | GET | Session | admin |
| `/api/settings/:key` | DELETE | Session | admin |
| `/api/encrypt` | POST | Session | admin |
| `/api/config` | GET | Session | admin |
| `/api/security/**` | ANY | Session | admin |
| `/api/identities` | GET | Session | admin |
| `/api/connections/social` | GET | None (read-only provider list) | — |
| `/api/dashboard/layout` | GET, PUT | Session | any authenticated |
| `/api/session-locations` | GET | Session | any authenticated |
| `/api/geo` | GET | Session | any authenticated |
| `/api/services/**` | ANY | Session | any authenticated |
| `/api/kratos/**` | ANY | Proxy (Olympus identity APIs enforce auth) | — |
| `/api/kratos-admin/**` | ANY | Proxy (Olympus identity APIs enforce auth) | — |
| `/api/iam-kratos/**` | ANY | Proxy (Olympus identity APIs enforce auth) | — |
| `/api/iam-kratos-admin/**` | ANY | Proxy (Olympus identity APIs enforce auth) | — |
| `/api/hydra/**` | ANY | Proxy (Olympus identity APIs enforce auth) | — |
| `/api/hydra-admin/**` | ANY | Proxy (Olympus identity APIs enforce auth) | — |

**Roles**:
- `admin` — full access to all protected routes
- `viewer` — can access dashboard, session-locations, and geo routes; cannot access settings, encrypt, config, or security routes

Role is determined at login from the identity's `traits.role` field in the Olympus identity store and embedded in the session cookie. It cannot be changed without re-logging in.

---

## Error Responses

All Athena API authentication errors return a consistent JSON shape. This applies to middleware-enforced 401 and 403 responses. Error codes are stable — callers can rely on the `error` field value without parsing the `message` field.

```json
{
  "error": "<machine_code>",
  "message": "<human readable explanation>",
  "suggestion": "<remediation hint>"
}
```

The `Content-Type` header on all auth error responses is `application/json`. No HTML error pages are returned on auth failures.

**What never appears in error responses**: PII (email addresses, session tokens, identity IDs), internal service names (Kratos, Hydra), internal hostnames, ports, or stack traces.

### 401 — Not Authenticated

Returned when the `athena-session` cookie is absent, expired, or fails HMAC verification.

```json
{
  "error": "not_authenticated",
  "message": "No active session. Authentication required.",
  "suggestion": "Log in at /auth/login to obtain an admin session."
}
```

**Error code**: `not_authenticated` — stable, machine-readable, will not change without a versioning event.

**Common causes**:
- Cookie not sent — check that `curl -b` includes the cookie or that the browser has the cookie for the correct domain
- Cookie expired — the session lifetime matches the OAuth2 token `expires_in`; re-authenticate
- Cookie tampered — any modification to the cookie value invalidates the HMAC signature

**Remediation**: Obtain a session via `GET /api/auth/login` and include the resulting `athena-session` cookie on subsequent requests.

### 403 — Forbidden

Returned when the session is valid but the identity's role is not sufficient for the route.

```json
{
  "error": "forbidden",
  "message": "Admin role required to access this resource.",
  "suggestion": "Ensure your account has the admin role assigned. Contact your administrator."
}
```

**Error code**: `forbidden` — stable, machine-readable, will not change without a versioning event.

**Remediation**: Log in with an identity that has the `admin` role assigned in the Olympus identity store. The role is embedded in the session at login time — changing the role in the admin panel requires a new login to take effect.

### Canonical Error Code Reference

| HTTP Status | `error` field | When |
|-------------|--------------|------|
| `401` | `not_authenticated` | No session, expired session, or tampered cookie |
| `403` | `forbidden` | Valid session but insufficient role for this route |

These codes are the stable contract for this API. Parse the `error` field, not the `message` field, in any programmatic error handling.

---

## Cookie Security

The `athena-session` cookie is protected by four security attributes that are non-negotiable:

| Attribute | Value | Why It Matters |
|-----------|-------|----------------|
| `HttpOnly` | true | Prevents JavaScript from reading the cookie. XSS attacks cannot exfiltrate the session. |
| `SameSite=Strict` | strict | Blocks the cookie from being sent on any cross-origin request, including top-level navigations. Stronger CSRF protection than Lax, with no UX impact on an admin-only dashboard. |
| `Secure` | true (production), false (localhost dev) | Cookie is only sent over HTTPS in production. Prevents interception on the wire. The flag is false in local development to allow HTTP on localhost. |
| `MaxAge` | `min(expires_in, 28800)` | Admin sessions are capped at 8 hours regardless of what the OAuth2 server returns in `expires_in`. Prevents multi-day admin sessions. |

Cookie attributes are centralized in `src/lib/cookie-options.ts`. All cookie write and delete operations in the codebase import from this single source of truth — future changes require updating only one file.

Do not disable or weaken these attributes. Do not attempt to read the session cookie from `document.cookie` — `HttpOnly` means it is not accessible from JavaScript, and this is intentional.

> **GDPR note**: The `athena-session` cookie is tied to a specific Olympus identity (`kratosIdentityId`). If a user exercises their right to erasure, their identity record must be deleted from the Olympus identity store — this automatically invalidates all active sessions for that identity.

---

## Proxy Route Trust Model

Routes under `/api/kratos/**`, `/api/kratos-admin/**`, `/api/iam-kratos/**`, `/api/iam-kratos-admin/**`, `/api/hydra/**`, and `/api/hydra-admin/**` are reverse proxies to Olympus identity service APIs. These routes bypass Athena session auth by design.

**How they are secured instead**:
- Athena decrypts the Olympus identity service API key from the settings store and injects it as an `Authorization` header before forwarding the request.
- The Olympus identity service verifies the API key server-side on every proxied request.
- Security relies on network isolation: port 4001 (IAM Athena) must not be publicly reachable. The admin APIs are accessible only within the container network.

**Known gap**: Proxy routes are currently accessible to any authenticated user, not admin-only. The Olympus identity service enforces API key auth upstream. This will be addressed in a follow-on issue.

---

## Edge Cases

### Missing `ENCRYPTION_KEY` Environment Variable

If `ENCRYPTION_KEY` is not set in the container, session HMAC verification throws at startup and returns `500` on every request to protected routes. Verify with `GET /api/health` — if it returns `200`, the environment is configured correctly.

### `/api/healthcheck` vs `/api/health`

Only `/api/health` is the public health endpoint. `/api/healthcheck` is not a recognized public route and returns `401` without a session. Use `/api/health` for ops tooling and liveness probes.

### Header Injection Has No Effect

The middleware reads the user role exclusively from the HMAC-signed session cookie. Sending `x-user-role: admin` or any other role header has no effect. Role cannot be escalated via request headers.

### Path Traversal

Next.js normalizes request paths before matcher evaluation. Path traversal attempts such as `GET /api/../api/settings` resolve to `GET /api/settings` and are subject to normal auth enforcement.

### OAuth2 State Mismatch

If the `oauth_state` cookie is missing or does not match the `state` query parameter on callback, Athena redirects back to `/api/auth/login` without setting a session. This prevents CSRF attacks on the OAuth2 flow. Re-initiate login to generate a fresh state.

---

## Security Considerations

- **Session tampering**: The `athena-session` cookie is HMAC-SHA256-signed with `ENCRYPTION_KEY`. Any modification to the cookie payload invalidates the signature and returns `401`.
- **Cookie security**: In production, the cookie is `HttpOnly` and `Secure`. Do not disable these attributes. See [Cookie Security](#cookie-security) above.
- **No fallback paths**: There is no alternative authentication path (API key, bearer token, basic auth). There is no secret endpoint. If the middleware is bypassed, only `/api/dashboard/layout` has an inline `verifySession()` call as a secondary layer — all other routes would be unprotected.
- **Secret decryption route**: `GET /api/settings/:key?decrypt=true` returns the plaintext value of an AES-256-GCM encrypted secret. This route requires an admin session. See [athena#51](https://github.com/OlympusOSS/athena/issues/51) for the security fix that enforced this.
- **Port exposure**: Port 4001 (IAM Athena) must not be internet-accessible. The proxy routes to Olympus identity service admin APIs are authenticated by API keys, not by Athena session auth. A publicly reachable port 4001 allows any actor with network access to use the admin proxy.
- **PKCE enforcement**: The OAuth2 login flow uses `code_challenge_method=S256`. The plain method is not used. See [athena#52](https://github.com/OlympusOSS/athena/issues/52) for PKCE enforcement details.

---

## Related Issues

- [athena#50](https://github.com/OlympusOSS/athena/issues/50) — Planned M2M credential flow (server-to-server auth)
- [athena#51](https://github.com/OlympusOSS/athena/issues/51) — Security fix: `proxy.ts` → `middleware.ts` (auth enforcement was dead code)
- [athena#52](https://github.com/OlympusOSS/athena/issues/52) — PKCE S256 enforcement and JWKS verification
- [athena#57](https://github.com/OlympusOSS/athena/issues/57) — Security fix: session cookie `Secure` flag, `SameSite=Strict`, and `maxAge` cap
- [athena#60](https://github.com/OlympusOSS/athena/issues/60) — Standardized 401/403 error response shape (`not_authenticated` / `forbidden`)
- [athena#61](https://github.com/OlympusOSS/athena/issues/61) — This document
- [athena#63](https://github.com/OlympusOSS/athena/issues/63) — PKCE + public client OAuth2 integration guide

---

*Last updated: 2026-04-01 (Technical Writer — athena#57 cookie security attributes, athena#60 standardized error shapes)*
