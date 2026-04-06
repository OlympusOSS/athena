# M2M OAuth2 Client Management

> Feature in development — engineering plan approved (2026-04-02), implementation pending.

## Overview

Athena provides an admin interface for registering machine-to-machine (M2M) OAuth2 clients. M2M clients use the OAuth2 `client_credentials` grant (RFC 6749 §4.4) to authenticate as themselves — without a user — and receive a JWT access token for calling protected APIs.

This is the standard pattern for AI agents, automation scripts, provisioning services, SIEM integrations, and any non-interactive service that calls Olympus APIs.

## How It Works

### OAuth2 client_credentials Grant

The `client_credentials` grant is fully native to Ory Hydra. No custom token logic is required. An M2M client authenticates with its `client_id` and `client_secret` and receives a short-lived JWT access token.

```
AI Agent / Service
  → POST /oauth2/token
    grant_type=client_credentials
    &client_id=<id>
    &client_secret=<secret>
    &scope=<requested scopes>

  ← 200 { access_token, token_type: "bearer", expires_in, scope }

  → GET /api/resource
    Authorization: Bearer <access_token>
```

Token endpoint (CIAM):
- Dev: `http://localhost:3102/oauth2/token`
- Prod: `$CIAM_HYDRA_PUBLIC_URL/oauth2/token`

Resource servers validate JWT tokens against the CIAM Hydra JWKS endpoint:
- Dev: `http://localhost:3102/.well-known/jwks.json`
- Prod: `$CIAM_HYDRA_PUBLIC_URL/.well-known/jwks.json`

### Client Registration

When Athena creates an M2M client, it calls the Hydra admin API (`POST /admin/clients`) via the Athena proxy. Hydra generates the `client_id` and `client_secret`. The secret is returned once and displayed in a blocking modal in the Athena UI. It is never stored in Athena, the SDK, or any database.

### Permitted Scopes

M2M clients may only be granted the following 7 scopes. These are the only values available in the Athena scope multi-select. No arbitrary scope input is permitted.

The scope list is enforced server-side as a hardcoded constant in Athena (`M2M_PERMITTED_SCOPES` in `src/lib/m2m-scopes.ts`). It is not database-backed and cannot be modified by admin UI changes.

| Scope | Risk | Description |
|-------|------|-------------|
| `identities:read` | Low | Read identity records (profile, metadata, credentials list) — NOT credential secrets |
| `identities:write` | Medium | Create and update identity records (excluding credential management) |
| `sessions:read` | Low | Read active session data for identities |
| `sessions:invalidate` | High | Force logout a specific session or all sessions for an identity |
| `settings:read` | Low | Read platform configuration settings (non-secret values only) |
| `audit:read` | Low | Read the audit log — for compliance integrations and SIEM pipelines |
| `webhooks:write` | Medium | Register and manage webhook endpoints — for event-driven agent integrations |

**Excluded from V1** (not available in the scope multi-select):
- `settings:write` — allows reconfiguring the platform; excluded as too destructive for automated agents
- `identities:delete` — irreversible; must remain a human action
- `openid`, `profile`, `email`, and other OIDC user-facing scopes — not appropriate for M2M clients; `client_credentials` provides no user context

The server-side validation in `POST /api/clients/m2m` rejects any scope not in `M2M_PERMITTED_SCOPES` with a `422` before forwarding to Hydra. The UI multi-select is a convenience layer; the server-side constant is the security boundary.

## API / Technical Details

### Admin API Endpoints

All endpoints require an authenticated admin session. Unauthenticated requests return `401`. Non-admin (viewer) sessions return `403`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/clients/m2m` | List all M2M clients |
| `POST` | `/api/clients/m2m` | Create a new M2M client (secret returned once) |
| `POST` | `/api/clients/m2m/:id/rotate-secret` | Rotate client secret (new secret returned once) |
| `DELETE` | `/api/clients/m2m/:id` | Delete client; revokes the Hydra client |

All four routes are protected by the `ADMIN_PREFIXES` middleware in `src/middleware.ts` — the `/api/clients` prefix is in the admin prefix list.

### Request and Response Shapes

#### GET /api/clients/m2m

Response `200`:

```json
{
  "clients": [
    {
      "client_id": "abc123",
      "client_name": "Inventory Sync Agent",
      "scope": "identities:read sessions:read",
      "token_lifetime": 300,
      "created_at": "2026-04-01T12:00:00Z",
      "metadata": { "client_type": "m2m" }
    }
  ],
  "total": 1
}
```

`client_secret` is never returned in list or detail responses — Hydra does not expose it after creation.

The list is filtered to clients with `metadata.client_type === "m2m"`. Clients created via direct Hydra API calls without this metadata tag are not visible in the M2M list.

#### POST /api/clients/m2m

Request body:

```json
{
  "client_name": "Inventory Sync Agent",
  "scope": "identities:read sessions:read",
  "token_lifetime": 300
}
```

Server-side validation (applied before Hydra is called):
- `client_name`: required, non-empty string
- `scope`: every space-separated value must be in `M2M_PERMITTED_SCOPES` — any unknown scope returns `422`
- `token_lifetime`: integer, 1–3600 inclusive — values outside this range return `422`

Response `201` (client_secret appears once only):

```json
{
  "client_id": "abc123",
  "client_secret": "s3cr3t-value",
  "client_name": "Inventory Sync Agent",
  "scope": "identities:read sessions:read",
  "created_at": "2026-04-01T12:00:00Z"
}
```

#### POST /api/clients/m2m/:id/rotate-secret

Request body: empty `{}`

Response `200`:

```json
{
  "client_id": "abc123",
  "client_secret": "new-s3cr3t-value"
}
```

The new secret is generated server-side using `crypto.randomBytes(32).toString("hex")` (a 64-character hex string). Athena then calls `setOAuth2Client` (PUT) on the Hydra admin API with the full client record and the new secret. Hydra returns the new plaintext secret in the PUT response — this is the only occurrence of the plaintext outside the browser.

#### DELETE /api/clients/m2m/:id

Response `204`: no body.

The Hydra OAuth2 client is deleted. Subsequent token requests with this `client_id` return `401` from Hydra. Existing tokens remain valid until their `exp` claim (up to 3600 seconds).

#### Error Response Shapes

All `4xx` and `5xx` responses from `/api/clients/m2m/*` return a JSON body. An empty error response is not acceptable.

| Scenario | Status | Response Body |
|----------|--------|---------------|
| Unknown scope | `422` | `{"error": "invalid_scope", "message": "Scope 'settings:write' is not permitted for M2M clients.", "permitted_scopes": ["identities:read", "identities:write", "sessions:read", "sessions:invalidate", "settings:read", "audit:read", "webhooks:write"], "suggestion": "Select only scopes from the permitted_scopes list."}` |
| token_lifetime out of range | `422` | `{"error": "invalid_parameter", "field": "token_lifetime", "message": "token_lifetime must be between 1 and 3600 seconds. Received: 86400.", "suggestion": "For AI agent tokens, 300 seconds is recommended."}` |
| Missing client_name | `400` | `{"error": "missing_required_field", "field": "client_name", "message": "client_name is required.", "suggestion": "Provide a descriptive name for this M2M client, e.g., 'Provisioning Agent'."}` |
| Hydra unavailable | `502` | `{"error": "upstream_unavailable", "message": "The OAuth2 server is temporarily unavailable.", "suggestion": "Retry in a few seconds. If the problem persists, check the platform health at /health."}` |
| Unauthenticated | `401` | Standard Athena error shape |
| Non-admin session | `403` | Standard Athena error shape |

### Hydra Client Payload

When Athena calls `POST /admin/clients` on the CIAM Hydra admin API:

```json
{
  "client_name": "<admin-provided name>",
  "grant_types": ["client_credentials"],
  "response_types": [],
  "token_endpoint_auth_method": "client_secret_basic",
  "scope": "<space-separated list of admin-selected scopes>",
  "metadata": {
    "client_type": "m2m",
    "created_by": "<x-user-email from middleware header>"
  }
}
```

### Token Lifetime

- Default: 300 seconds (5 minutes) — recommended for AI agent tokens
- Maximum enforced at the Athena API layer: 3600 seconds (1 hour)
- Minimum: 1 second
- Configurable per client at creation time only — token lifetime cannot be changed after creation (V1 limitation)
- The `client_credentials` grant does NOT issue refresh tokens — agents must re-authenticate when the access token expires

Athena rejects token lifetime values outside the 1–3600 range with `422` before forwarding to Hydra. Do not rely on Hydra to enforce the maximum.

**TTL guidance by integration type:**

| Use Case | Recommended TTL | Rationale |
|----------|----------------|-----------|
| AI agents with tight loops (LLM pipelines, automation workflows) | 300s (5 min) | Short TTL limits blast radius of a leaked token; agent re-authenticates frequently with minimal overhead |
| Batch jobs and ETL pipelines | 1800–3600s | Avoids mid-job re-authentication; batch runs are typically bounded, so a longer TTL is acceptable |
| SIEM integrations / long-running daemons | 3600s (1 hour) | Steady-state services benefit from reduced re-auth frequency; rotate the secret regularly instead of shortening the TTL |
| CI/CD pipeline steps | 300s | Short-lived; token should expire before the build artifact is archived |

The security tradeoff is straightforward: a longer TTL means a leaked token (via a logging mistake, memory dump, or network capture) has a longer window of validity. A shorter TTL limits that window but requires the agent to re-authenticate more often. For most integrations that are not high-frequency event loops, 3600s is operationally convenient and acceptable — pair it with log sanitization and secrets management (not hardcoded credentials) rather than relying on TTL as the primary control.

### Secret Rotation (Zero-Downtime)

Rotating the client secret does NOT invalidate already-issued JWT access tokens. Hydra JWTs are validated by JWKS signature, not by the current client secret. The client secret is only used for token endpoint authentication.

After rotation:
- Old secret: rejected at the token endpoint (cannot request new tokens)
- Existing JWT access tokens: remain valid until their TTL expires (up to 3600 seconds)
- New secret: immediately valid for requesting new tokens

Rotation mechanism: Athena generates a new 64-character hex secret using `crypto.randomBytes(32).toString("hex")`, then calls `setOAuth2Client` (PUT) on the Hydra admin API with the full client record and the new secret. The previous secret is immediately invalidated.

### Secret Reveal Modal Behavior (SR-3)

The one-time secret modal enforces a blocking confirmation before dismissal. This applies to both creation and rotation flows.

- Pressing Escape, clicking outside the modal, or clicking any close button triggers a blocking interstitial: "Have you saved the client secret? This secret cannot be recovered after you close this window." with "Go back" and "Close and lose the secret" buttons
- The "Done" button is disabled until the admin checks "I have saved the client secret in a secure location"
- A toast warning is not used — the blocking confirmation is the only dismissal path

This behavior is implemented in the `SecretRevealModal` Canvas `Dialog` component with `onOpenChange` returning false for external close attempts.

**This is intentional security design, not a UX limitation.** Auth0 and Okta allow viewing or re-downloading client secrets from the management console. Olympus deliberately does not — the secret is generated by Hydra and never written to any Athena database, SDK settings table, or log. There is no mechanism that could surface it again even if an attacker compromised the Athena admin database. The blocking dismiss (no X button, checkbox-gated Done) is the UI expression of this zero-persistence guarantee: it forces the admin to acknowledge they have saved the secret before they can close the window. If operators treat this as friction, explain the tradeoff: Olympus's credential hygiene is the reason no Athena database breach can expose M2M client secrets.

### Audit Logging

The following events are emitted as structured JSON to `process.stdout` with a fixed `type: "audit"` field for log pipeline discrimination. The log aggregator must be configured to filter on this field (Loki LogQL: `{app="athena"} | json | type="audit"`).

Audit log format for client creation:

```json
{
  "type": "audit",
  "event": "m2m_client.created",
  "actor": "admin@example.com",
  "client_id": "abc123",
  "client_name": "Data Ingestion Agent",
  "scope": "identities:read sessions:read",
  "timestamp": "2026-04-02T12:00:00.000Z"
}
```

Audit log format for secret rotation:

```json
{
  "type": "audit",
  "event": "m2m_client.secret_rotated",
  "actor": "admin@example.com",
  "client_id": "abc123",
  "timestamp": "2026-04-02T12:00:00.000Z"
}
```

Audit log format for client deletion:

```json
{
  "type": "audit",
  "event": "m2m_client.deleted",
  "actor": "admin@example.com",
  "client_id": "abc123",
  "timestamp": "2026-04-02T12:00:00.000Z"
}
```

`client_secret` is never present in any audit log entry. The `actor` field is populated from the `x-user-email` header set by the admin session middleware. These entries satisfy SOC2 CC6.2 (access provisioning audit trail).

## Examples

### Requesting an access token (TypeScript)

```typescript
const tokenResponse = await fetch("http://localhost:3102/oauth2/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.OLYMPUS_CLIENT_ID!,
    client_secret: process.env.OLYMPUS_CLIENT_SECRET!,
    scope: "identities:read",
  }),
});

const { access_token, expires_in } = await tokenResponse.json();
```

### Requesting an access token (Python)

```python
import os
import requests

response = requests.post(
    os.environ["OLYMPUS_TOKEN_URL"],
    data={
        "grant_type": "client_credentials",
        "client_id": os.environ["OLYMPUS_CLIENT_ID"],
        "client_secret": os.environ["OLYMPUS_CLIENT_SECRET"],
        "scope": "identities:read",
    },
)
token = response.json()["access_token"]
```

### Calling a protected API

```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
  https://api.example.com/api/resource
```

### Handling token expiry (re-authentication)

The `client_credentials` grant does not issue refresh tokens. Agents must re-authenticate before the access token expires.

```typescript
let accessToken: string | null = null;
let tokenExpiresAt = 0;

async function getToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiresAt - 30_000) {
    return accessToken;
  }
  const res = await fetch(process.env.OLYMPUS_TOKEN_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.OLYMPUS_CLIENT_ID!,
      client_secret: process.env.OLYMPUS_CLIENT_SECRET!,
      scope: "identities:read",
    }),
  });
  const { access_token, expires_in } = await res.json();
  accessToken = access_token;
  tokenExpiresAt = Date.now() + expires_in * 1000;
  return accessToken!;
}
```

Request a new token 30 seconds before expiry to avoid in-flight failures at the TTL boundary.

## Edge Cases

### Secret modal dismissed without copying

The client secret is shown once and then discarded from server memory. If an admin dismisses the modal without copying the secret, the only recovery path is secret rotation. The blocking confirmation dialog on the `SecretRevealModal` requires an explicit acknowledgment before the modal can close. See "Secret Reveal Modal Behavior" above for the exact dismiss flow.

### Token expired mid-task

If an agent's token expires during a long-running operation, the protected API returns `401 Unauthorized`. The agent must re-authenticate and retry. Design agents to check token expiry before each API call or implement retry-with-refresh logic.

For batch jobs that run longer than 3600 seconds, configure a longer TTL at client creation time (up to the 3600-second maximum) and implement re-authentication in the agent.

### Scope changes on existing client

V1 does not support modifying scopes on an existing M2M client. To change scopes: delete the client and create a new one. The new `client_id` and `client_secret` must be distributed to the agent. This is a V2 improvement.

### Client with sessions:invalidate scope

`sessions:invalidate` is marked High risk. An agent with this scope can force-logout any user. Grant it only to explicitly trusted security automation. The granted scope appears in audit log entries at creation time.

**V1 note**: The scope multi-select in V1 allows selecting `sessions:invalidate` without an additional confirmation step. athena#86 tracks adding a confirmation checkbox specifically for this scope ("I understand this agent can force-logout any user") before the create form can be submitted — this will be added before production availability. Until athena#86 ships, enforce the "High risk" designation through your internal change control process when provisioning M2M clients for security automation.

### Client deletion and existing tokens

Deleting an M2M client immediately prevents new token requests — subsequent `POST /oauth2/token` calls with the deleted `client_id` return `401` from Hydra. However, tokens already issued before deletion remain valid until their `exp` claim (up to 3600 seconds). For immediate token invalidation, delete the client and wait for the TTL to expire, or design resource servers to check a revocation list (V2).

### JWKS endpoint unreachable

If the CIAM Hydra JWKS endpoint is unreachable, resource servers cannot validate JWT tokens and all agent API calls fail. Configure JWKS response caching in your resource server (recommended TTL: 15 minutes) to tolerate brief Hydra restarts.

### Hydra unavailable during create or rotate

If Hydra returns a `5xx` during creation, Athena returns `502` to the client. No partial state is created. The client was not registered in Hydra; no audit entry is emitted.

If Hydra fails on the PUT step during a rotation (after GET succeeded), the rotation fails cleanly — the old secret is not invalidated. The admin must retry.

### Concurrent rotation

The rotation flow uses GET-then-PUT (last-write-wins). If two admins rotate the same client simultaneously, the second PUT overwrites the first. The second admin's secret modal shows the correct new secret; the first admin's secret is invalidated without warning. M2M client administration is a low-frequency operation in practice; optimistic concurrency (ETag) is a V2 concern.

## Audit Log Pipeline Contract

M2M client lifecycle events are emitted as structured JSON to `process.stdout`. The log pipeline must be configured to route these entries to the audit store, separate from operational logs.

### Discriminator Field

Every audit log entry carries `"type": "audit"`. Log aggregators must split on this field:

- Lines with `"type": "audit"` are shipped to the audit store (SOC2 CC6.2 evidence)
- All other lines are treated as operational logs

### Log Aggregator Configuration

Example Loki LogQL filter for the audit stream:

```
{app="athena"} | json | type="audit"
```

Example Vector sink configuration (YAML):

```yaml
transforms:
  athena_audit:
    type: filter
    inputs: [athena_stdout]
    condition: '.type == "audit"'
```

Any log aggregator (Loki, Vector, Fluentd, etc.) must implement this split before this feature is used in a production environment subject to SOC2 CC6.2 audit requirements.

### What Is and Is Not Logged

Audit entries include: `type`, `event`, `actor`, `client_id`, `scope` (creation only), `timestamp`.

`client_secret` is **never** present in any audit log entry. The log sanitization in the route handlers strips `client_secret` from all log calls. This is confirmed by the acceptance criterion: create an M2M client via Athena and search all log outputs for the returned secret value — no match must be found.

## Component State — `mutation.reset()` on Modal Close

The `SecretRevealModal` calls `mutation.reset()` when the modal closes. This is a security requirement, not a cleanup convenience:

- `mutation.reset()` clears the TanStack Query mutation state, which includes the `client_secret` value returned from the POST or rotate-secret API response
- Without this call, `client_secret` persists in the component's mutation state until the component unmounts or the user navigates away
- A `client_secret` persisting in React component state after the modal closes can be accessed via React DevTools, memory inspection, or a component re-render that re-surfaces the value

**This call must be present in the `SecretRevealModal` close handler and must not be removed as a "cleanup optimization."** It is a security boundary.

## Security Considerations

### Client secret is a high-value credential

The client secret grants the ability to issue access tokens with the client's full scope list. Treat it with the same care as a database password:
- Never commit the secret to source control
- Store it in an environment variable or a secrets manager (AWS Secrets Manager, HashiCorp Vault, Doppler, etc.)
- Rotate regularly — use the Athena "Rotate Secret" function, which is zero-downtime
- For a compromised secret: rotate immediately to stop new token issuance

### Log sanitization

The `POST /api/clients/m2m` and `POST /api/clients/m2m/:id/rotate-secret` responses contain the plaintext client secret. Every logging layer must exclude this value:
- **Athena route handlers**: catch blocks log only `{ client_name, scope }` or `{ client_id }` — never the response body containing `client_secret`
- **`process.stdout.write` for audit events**: only `type`, `event`, `actor`, `client_id`, `timestamp` fields — never `client_secret`
- **Next.js middleware logs**: no response body logging for any route under `/api/clients/m2m/*`
- **Error tracking (Sentry, etc.)**: add `client_secret` to the field scrub list for routes under `/api/clients/m2m/*`

### Scope least privilege

Grant only the scopes the agent actually needs. A compromised secret with overly broad scopes gives an attacker a larger blast radius. The scope multi-select in Athena shows risk indicators (Low / Medium / High) to guide scope selection.

### JWT token revocation limitation (V1)

Issued JWTs survive secret rotation until their TTL expires (up to 3600 seconds). There is no per-client JWT revocation in V1. For immediate containment of a leaked token: delete and recreate the client, then distribute the new credentials to the agent. This V1 limitation must be disclosed in any SOC2 audit evidence for this feature.

### Server-side scope enforcement

The server-side scope allowlist (`M2M_PERMITTED_SCOPES` in `src/lib/m2m-scopes.ts`) is the only security boundary. The UI multi-select is a UX convenience layer. A direct API call with a forbidden scope in the request body will be rejected with `422` before Hydra is called. This is the defense-in-depth layer below the UI.

### V1 scope limitations

- M2M clients with `client_credentials` tokens cannot access user-owned resources. The token contains no user context. Agent-on-behalf-of-user (RFC 8693 token exchange) is explicitly deferred to V2.
- There are no refresh tokens. Agents must implement re-authentication.
- Token lifetime is capped at 3600 seconds. For very long-running tasks, implement periodic re-authentication.
- Scopes cannot be modified on an existing client. Delete and recreate to change scopes.

## V1 Limitations (V2 Backlog)

| Limitation | V2 Path |
|-----------|---------|
| No scope modification on existing clients | Hydra partial update evaluation |
| No per-client JWT revocation | Per-client revocation list |
| No "Last rotated" timestamp | SDK rotation log table |
| No agent-on-behalf-of-user | RFC 8693 token exchange service |
| No refresh tokens | Not applicable — RFC 6749 §4.4 spec |
| Concurrent rotation (last-write-wins) | ETag / optimistic concurrency |
| Audit log in stdout only | SDK `audit_log` table migration |
