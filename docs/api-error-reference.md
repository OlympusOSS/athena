# Athena API Error Reference

## Overview

All Athena API errors return a single consistent JSON shape defined by the `AthenaErrorResponse` interface. This applies to all `4xx` and `5xx` responses from the API layer — middleware-enforced auth errors, validation errors, and proxy errors all use the same shape. Error codes are stable; callers should parse the `error` field, not the `message` field, in any programmatic error handling.

---

## Error Shape

```typescript
interface AthenaErrorResponse {
  error: string;    // machine-readable error code
  message: string;  // human-readable description
  hint?: string;    // optional: actionable guidance for the developer
}
```

The `hint` field is optional. It appears on errors where a remediation action is clear and safe to surface. It is absent when no specific action is meaningful — for example, proxy timeout errors (504) do not include a hint.

The `Content-Type` on all error responses is `application/json`. No HTML error pages are returned.

**What never appears in error responses**: PII (email addresses, session tokens, identity IDs), internal service names (Kratos, Hydra, Medusa), internal hostnames, ports, or stack traces.

---

## Error Codes by Status

### 401 — Not Authenticated

Returned when the `athena-session` cookie is absent, expired, or fails HMAC verification.

```json
{
  "error": "not_authenticated",
  "message": "Authentication required.",
  "hint": "Authenticate via /api/auth/login"
}
```

**Causes:**
- Cookie absent — not sent with the request
- Cookie expired — session lifetime has elapsed; re-authenticate
- Cookie tampered — any modification to the cookie payload invalidates the HMAC signature

**Remediation (browser callers):** Navigate to `GET /api/auth/login` to initiate the OAuth2 login flow. The `athena-session` cookie is set on successful callback.

**Remediation (programmatic/curl callers):** The `hint` value `"Authenticate via /api/auth/login"` is accurate for browser-initiated sessions. For server-side or curl callers, this path initiates a browser-based OAuth2 redirect — it does not return a token directly. A valid `athena-session` cookie obtained from a completed OAuth2 flow is required. There is no API key or bearer token alternative. See [No Server-to-Server Auth Path](api-authentication.md#no-server-to-server-auth-path) for details.

> **Note on the 401 hint for programmatic callers:** The hint `"Authenticate via /api/auth/login"` is accurate in a browser context. For server-side or curl integrators this path triggers an OAuth2 redirect, not a direct credential exchange. A future improvement (DX-60-2) will update the hint to make this distinction explicit.

### 403 — Forbidden

Returned when the session is valid but the identity's role is insufficient for the requested route.

```json
{
  "error": "forbidden",
  "message": "Admin access required.",
  "hint": "Contact your administrator to request access."
}
```

**Causes:**
- Authenticated as a `viewer` role but accessing an `admin`-only route (settings, encrypt, config, security)

**Remediation:** Log in with an identity that has the `admin` role assigned in the Olympus identity store. Role is embedded in the session at login time — a role change in the admin panel requires a new login to take effect.

**Note on hint content:** The 403 hint does not name internal role identifiers (`ciam-admin`, `iam-admin`). This is intentional — role names are not surfaced in error responses.

### 400 — Bad Request

Returned when the request is structurally invalid (missing required fields, invalid values).

```json
{
  "error": "bad_request",
  "message": "Missing required field: key."
}
```

The `hint` field is absent on 400 errors. The `message` field describes the specific validation failure.

### 504 — Gateway Timeout

Returned when a proxied request to an upstream Olympus identity service does not respond within the timeout window.

```json
{
  "error": "gateway_timeout",
  "message": "Upstream service did not respond within the timeout window."
}
```

No `hint` is included — proxy timeout errors require investigating the upstream service, not the caller's request. The absence of `hint` is intentional and consistent.

### 502 — Bad Gateway

Returned when the middleware's fetch to an upstream service fails with a network-level error (e.g., `ECONNREFUSED`, DNS failure). This indicates the upstream container is unreachable, not that it timed out.

```json
{
  "error": "bad_gateway",
  "message": "Unable to reach upstream service."
}
```

**Causes:**
- Upstream container (Kratos, Hydra) is stopped or has not yet started
- DNS resolution failure for the upstream hostname within the container network
- TCP connection refused — the upstream port is not listening

**Remediation:** Verify that the target Olympus identity service container is running (`podman compose ps`). Check container logs for crash or startup failure. If running in production, check network isolation and inter-container connectivity. No client-side retry is useful until the upstream service recovers.

### 500 — Proxy Error

Returned when the proxy catch block encounters an error that is neither a `TimeoutError` nor a `TypeError` fetch failure. This is the generic catch path for unexpected proxy errors.

```json
{
  "error": "proxy_error",
  "message": "An unexpected error occurred."
}
```

**Causes:**
- Unexpected exception in the proxy path not covered by the timeout or network-error branches
- Edge Runtime constraint violations (e.g., unsupported Node.js API called within the middleware)

**Remediation:** Check server-side logs — the middleware logs the full error detail (message, name, stack) to `stderr` before returning this response. The response body intentionally omits internal details per Security C3. Do not rely on the `message` field for diagnosis; use server logs.

---

## Canonical Error Code Table

| HTTP Status | `error` field | `hint` present | When |
|-------------|--------------|----------------|------|
| `400` | `bad_request` | No | Missing or invalid request fields |
| `401` | `not_authenticated` | Yes | No session, expired session, or tampered cookie |
| `403` | `forbidden` | Yes | Valid session but insufficient role for the route |
| `500` | `proxy_error` | No | Unexpected error in the proxy catch path |
| `502` | `bad_gateway` | No | Upstream service unreachable (network/DNS/connection refused) |
| `504` | `gateway_timeout` | No | Proxied upstream service timeout |

These codes are the stable contract. Parse `error`, not `message`, in any programmatic error handler.

---

## TypeScript Client Pattern

```typescript
interface AthenaErrorResponse {
  error: string;    // 'not_authenticated' | 'forbidden' | 'bad_request' | 'proxy_error' | 'bad_gateway' | 'gateway_timeout'
  message: string;  // human-readable
  hint?: string;    // optional remediation hint
}

async function callAthenaAPI(path: string): Promise<Response> {
  const res = await fetch(path, { credentials: "include" });
  if (!res.ok) {
    const body: AthenaErrorResponse = await res.json();
    throw new AthenaAPIError(body.error, body.message, body.hint);
  }
  return res;
}
```

The `credentials: "include"` option is required to send the `athena-session` cookie on cross-origin requests. On same-origin requests (standard browser use), the cookie is sent automatically.

**Error type switching:**

```typescript
switch (body.error) {
  case "not_authenticated":
    // Redirect to login
    window.location.href = "/api/auth/login";
    break;
  case "forbidden":
    // Show permission denied UI
    showPermissionDenied(body.hint);
    break;
  case "gateway_timeout":
  case "bad_gateway":
  case "proxy_error":
    // Upstream or proxy error — retry or show upstream error
    showUpstreamError(body.message);
    break;
  default:
    // Unknown error code — log and surface message
    console.error("Athena API error:", body.error, body.message);
}
```

---

## Edge Cases

### `hint` Field Absence vs. Absence of a Field

When `hint` is absent from the response body, do not treat it as an error. The field is intentionally optional. Always type the `hint` field as `string | undefined` or `hint?: string` — never assume it is present.

### Caller Audit Before Upgrading

If you are upgrading from the pre-athena#60 single-field error shape `{ "error": "Not authenticated" }`, verify that your error handling reads `body.error` (not `body.message` or a single-field string). The `error` key is preserved and its value is unchanged (`not_authenticated`, `forbidden`) — the change is additive. `message` and `hint` are new fields.

### `message` Field Stability

The `message` field is human-readable prose intended for display and logs. It may change between releases. Do not parse or match against `message` values in code — use the `error` field.

---

## Security Considerations

- **No internal identifiers in errors:** Role names, service names, hostnames, and identity IDs are never included in error responses. The 403 hint says "contact your administrator" — it does not name the role required.
- **No stack traces:** Stack traces are never returned in error responses. If you see a stack trace in a response body, it is a bug — file an issue.
- **Proxy error opacity:** `bad_gateway` (502) and `proxy_error` (500) return generic messages only. The upstream service name, hostname, port, and full error details are logged server-side only (Security C3). Never attempt to reconstruct upstream error detail from the response body.
- **Stable error codes:** Error codes (`not_authenticated`, `forbidden`, etc.) will not change without a documented versioning event. Callers can rely on them for long-term integration.

---

## Related Docs

- [Athena API Authentication](api-authentication.md) — session lifecycle, login flow, route requirements
- [Athena Proxy Timeout](proxy-timeout.md) — `gateway_timeout` error in detail, upstream service behavior
- [athena#60](https://github.com/OlympusOSS/athena/issues/60) — Issue: Standardize API error response shape (401/403/404/422/500)
- [athena#117](https://github.com/OlympusOSS/athena/pull/117) — PR implementing the standardized error shape

---

*Last updated: 2026-04-08 (Technical Writer — added `bad_gateway` 502 and `proxy_error` 500 error codes from middleware.ts proxy catch paths; athena#60 revision)*
