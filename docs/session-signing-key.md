# SESSION_SIGNING_KEY Configuration

## Overview

Athena uses two separate cryptographic keys for two separate purposes:

| Key | Env var | Purpose |
|-----|---------|---------|
| `ENCRYPTION_KEY` | `ENCRYPTION_KEY` | AES-256-GCM encryption of SDK settings values |
| Session signing key | `SESSION_SIGNING_KEY` | HMAC-SHA256 signing of `athena-session` cookies |

These keys must be independent. Rotating `ENCRYPTION_KEY` (for settings security) must not invalidate active admin sessions. Rotating `SESSION_SIGNING_KEY` (to expire all sessions) must not affect settings decryption. Setting both to the same value defeats this independence.

This separation was introduced in athena#99 (coordinated with sdk#5). Prior to this change, Athena derived session signing key material from `ENCRYPTION_KEY` via SHA-256 — coupling two distinct cryptographic operations to a single key.

**Coordinated deployment**: athena#99 and sdk#5 must be deployed in the same release. sdk#5 moves AES encryption exclusively to `ENCRYPTION_KEY`. If deployed in isolation, key usage becomes inconsistent between the two packages.

---

## How It Works

### Session signing

`src/lib/session.ts` signs and verifies the `athena-session` cookie using HMAC-SHA256. The key material is read from `SESSION_SIGNING_KEY` and decoded from base64 before being imported as a `CryptoKey` via the Web Crypto API (`crypto.subtle`).

The SHA-256 pre-hashing step that existed in the original `getHmacKey()` implementation has been removed. The raw base64-decoded bytes are used directly as HMAC key material. 32 bytes of cryptographically random data (the required key length for this implementation) satisfies HMAC-SHA256's 256-bit security requirement without additional derivation.

```
SESSION_SIGNING_KEY (base64) → base64 decode → 32 bytes → CryptoKey (HMAC-SHA256)
                                                                       │
                                              HMAC-SHA256(key, session payload) → MAC
```

### Startup validation

At startup, `src/lib/startup-validation.ts` reads both `SESSION_SIGNING_KEY` and `ENCRYPTION_KEY`:

1. If `SESSION_SIGNING_KEY` is absent, Athena fails to start with:
   ```
   [FATAL] SESSION_SIGNING_KEY environment variable is not set. Athena cannot start.
   Fix: export SESSION_SIGNING_KEY=$(openssl rand -base64 32)
   Docs: athena/docs/session-signing-key.md
   ```
   There is no fallback to `ENCRYPTION_KEY`. The absence is a hard startup failure.

2. If `SESSION_SIGNING_KEY` and `ENCRYPTION_KEY` are set to the **same value**, Athena logs a WARNING via `authLogger` at startup:
   ```
   WARN: SESSION_SIGNING_KEY and ENCRYPTION_KEY are identical. These keys serve different purposes and should be distinct. Rotating one will affect the other.
   ```
   The warning is not a startup failure — the application starts. But the warning is logged at every boot until the keys are differentiated.

The warning is emitted via `authLogger` (not `console.warn`) to ensure it is captured by the log aggregation pipeline.

---

## Configuration

### Generating a key

```bash
openssl rand -base64 32
```

Run this command once to generate `SESSION_SIGNING_KEY` and again to generate `ENCRYPTION_KEY`. Never derive one from the other. Never reuse a key from another service.

### Production

Add `SESSION_SIGNING_KEY` to GitHub Secrets and inject it via `deploy.yml`:

| Secret | Where set | Container env var |
|--------|-----------|-------------------|
| `SESSION_SIGNING_KEY` | GitHub Secrets | Both ciam-athena and iam-athena |
| `ENCRYPTION_KEY` | GitHub Secrets | Both ciam-athena and iam-athena |

Both containers (CIAM Athena at port 3001 and IAM Athena at port 4001) require their own `SESSION_SIGNING_KEY`. Use distinct keys for each domain — a compromised or rotated CIAM key must not affect IAM sessions, and vice versa. Generate each key independently:

```bash
# CIAM Athena
openssl rand -base64 32  # → CIAM_SESSION_SIGNING_KEY GitHub Secret

# IAM Athena
openssl rand -base64 32  # → IAM_SESSION_SIGNING_KEY GitHub Secret
```

### Development

`SESSION_SIGNING_KEY` is **not** provided as a default in `compose.dev.yml`. The startup validation is the developer experience: if you start Athena without `SESSION_SIGNING_KEY` set, you see:

```
[FATAL] SESSION_SIGNING_KEY environment variable is not set. Athena cannot start.
Fix: export SESSION_SIGNING_KEY=$(openssl rand -base64 32)
Docs: athena/docs/session-signing-key.md
```

To run Athena locally, add `SESSION_SIGNING_KEY` to your local `.env` or export it before running:

```bash
export SESSION_SIGNING_KEY=$(openssl rand -base64 32)
# Also set ENCRYPTION_KEY if not already set
export ENCRYPTION_KEY=$(openssl rand -base64 32)
```

Do not set both to the same value in development — this masks the startup warning and produces an unrepresentative dev environment.

---

## Examples

### Verify key separation in a running container

```bash
# Confirm SESSION_SIGNING_KEY is set (without printing the value)
podman exec ciam-athena printenv SESSION_SIGNING_KEY | wc -c
# Expected: > 0 (key is present)

# Confirm the startup WARNING is not in logs (keys are different)
podman logs ciam-athena | grep "SESSION_SIGNING_KEY and ENCRYPTION_KEY are identical"
# Expected: no output
```

### Verify session is signed by SESSION_SIGNING_KEY

After login, the `athena-session` cookie must be verifiable with `SESSION_SIGNING_KEY` and must fail verification if `ENCRYPTION_KEY` is used instead. This is covered by the unit test suite (`src/lib/session.test.ts`, test F1).

---

## Equality Warning: Two Layers

There are two layers of warning when keys are identical:

| Layer | Where | When | What |
|-------|-------|------|------|
| 1 — Startup WARN log | Container stdout/logs | Every Athena startup | `authLogger` WARN message naming both keys |
| 2 — Admin UI health notice | Athena dashboard | Persistent, while keys are equal | When implemented, will display a notice in the Athena admin UI health panel indicating the key equality issue |

Layer 2 (admin UI health notice) is not confirmed in engineering scope for athena#99. If you are implementing or reviewing this ticket: confirm with the engineer whether the admin UI health notice is included before assuming it is implemented. A corresponding QA test case is also required if the UI layer ships. This gap has been flagged on the issue thread.

---

## Key Rotation

### Rotating SESSION_SIGNING_KEY

Rotating `SESSION_SIGNING_KEY` invalidates all active `athena-session` cookies. All admin users are required to log in again. This is acceptable for an admin panel.

**Before rotating**: inform any admin users who may be mid-task. The next request they make after the container restarts returns a session verification failure.

**Rotation steps**:
1. Generate a new `SESSION_SIGNING_KEY`: `openssl rand -base64 32`
2. Update the GitHub Secret
3. Trigger a `deploy.yml` run — the new key takes effect when containers restart

After restart, any request with an old `athena-session` cookie fails HMAC verification. The session cookie is cleared (Max-Age=0) and the user is redirected to `/api/auth/login`. No error loop occurs — the invalid cookie is explicitly cleared before the redirect.

### Rotating ENCRYPTION_KEY independently

After athena#99, rotating `ENCRYPTION_KEY` does not affect `athena-session` cookies. Sessions remain valid. SDK settings encrypted with the old `ENCRYPTION_KEY` must be re-encrypted after rotation — see the SDK documentation for the re-encryption procedure.

---

## Edge Cases

### Existing sessions after initial deployment of athena#99

When athena#99 first deploys, all sessions that were signed using the old HMAC derivation path (based on `ENCRYPTION_KEY`) become invalid. Every admin user must log in again. This is a one-time migration cost.

The key derivation path changed: the original `getHmacKey()` hashed the env var value through SHA-256 before importing it as a CryptoKey. The new implementation uses the raw base64-decoded bytes directly. This means the same `ENCRYPTION_KEY` value produces a different HMAC key under the new code. Sessions from before the deployment cannot be verified with either `SESSION_SIGNING_KEY` or the new `ENCRYPTION_KEY`-derived path — they are invalid and must be re-authenticated.

### SESSION_SIGNING_KEY absent in a running container

If `SESSION_SIGNING_KEY` is removed from a running container (e.g., via a failed deployment), Athena fails to start on next restart. Running containers are not affected until they restart. After restart, the container exits with the startup validation error.

### Edge runtime and middleware

`src/middleware.ts` runs in the Next.js Edge runtime. The key import path from `startup-validation.ts` must be compatible with Edge runtime constraints — `crypto.subtle` is available in Edge; `crypto.createHmac` (Node.js built-in) is not. Confirm any changes to `session.ts` key handling remain Edge-compatible.

---

## Security Considerations

- **Key independence is the goal**: the entire value of this separation is that the two keys can be rotated independently. If they are set to the same value in production, that value is effectively a single shared secret. Treat the startup warning as an error in any production audit.
- **SHA-256 pre-hash step is removed**: the old `getHmacKey()` hashed `ENCRYPTION_KEY` through SHA-256 before use. This step is removed in the new implementation. The raw 32-byte key is used directly. This is intentional and documented in the code. Do not re-add the SHA-256 step.
- **No fallback**: there is no fallback to `ENCRYPTION_KEY` for session signing. Absent `SESSION_SIGNING_KEY` is a hard failure, not a silent degradation. This ensures the key separation is enforced at deploy time, not discovered after a session verification failure in production.
- **Cookie clearing on invalid session**: invalid sessions are cleared with `Max-Age=0` before redirecting to login. An invalid session cookie that is not cleared can cause a redirect loop where the cookie is re-sent on the next request and fails again. The clearing step is applied in all 401 paths that reject an invalid session signature.

---

## Related Issues

- [athena#99](https://github.com/OlympusOSS/athena/issues/99) — This feature
- [sdk#5](https://github.com/OlympusOSS/sdk/issues/5) — SDK encryption key separation (coordinated deployment)
- [athena#57](https://github.com/OlympusOSS/athena/issues/57) — Session cookie security attributes
- [athena#61](https://github.com/OlympusOSS/athena/issues/61) — Athena API authentication overview (see also: [api-authentication.md](api-authentication.md))

---

*Last updated: 2026-04-08 (Technical Writer — athena#99)*
