# CSP Configuration

## Overview

Athena applies a nonce-based Content-Security-Policy (CSP) via Next.js edge middleware. The CSP
is generated per request by `buildCsp()` in `src/lib/csp.ts`. In production, `unsafe-eval` is
absent from `script-src`. In development (`NODE_ENV=development`), `unsafe-eval` is added to
allow Next.js Hot Module Replacement (HMR). A CI gate on the compiled edge bundle artifact
enforces that `unsafe-eval` never appears in the production CSP.

This behavior was implemented in athena#108. Prior to that fix, `buildCsp()` was embedded in
`src/middleware.ts` and applied a single CSP for both environments, which caused a CSP
`EvalError` in the browser that prevented React from hydrating in development.

---

## How It Works

### CSP Module: `src/lib/csp.ts`

The `buildCsp` function is the single source of truth for Athena's CSP. It accepts a nonce
string and the current `NODE_ENV`, and returns the full CSP header value:

```typescript
// src/lib/csp.ts
export function buildCsp(nonce: string, env?: string): string {
  const isDev = (env ?? process.env.NODE_ENV) === 'development';
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  return directives.join('; ');
}
```

`buildCsp` lives in `src/lib/csp.ts`, not in `src/middleware.ts`, so it can be imported and
tested independently. The `env` parameter accepts an explicit value for test isolation; in
production the function reads `process.env.NODE_ENV` directly.

### Middleware: `src/middleware.ts`

The middleware generates a fresh cryptographic nonce on every request and calls `buildCsp` to
produce the CSP header:

```typescript
// src/middleware.ts
import { buildCsp } from '@/lib/csp';

const nonceBytes = new Uint8Array(16);
crypto.getRandomValues(nonceBytes);
const nonce = btoa(String.fromCharCode(...nonceBytes));

const csp = buildCsp(nonce);
response.headers.set('Content-Security-Policy', csp);
request.headers.set('x-nonce', nonce);
```

### Nonce Propagation

The nonce is forwarded from the middleware to the layout via the `x-nonce` request header:

```typescript
// layout.tsx
import { headers } from 'next/headers';

const nonce = (await headers()).get('x-nonce') ?? '';
// Apply to all <Script> components and inline <script> blocks
return <Script src="/bundle.js" nonce={nonce} />;
```

Any new `<Script>` component or inline `<script>` block added to Athena must receive the nonce
attribute. Scripts without a nonce are blocked by the CSP.

### Production vs. Development CSP

| Directive | Production | Development |
|-----------|-----------|-------------|
| `default-src` | `'self'` | `'self'` |
| `script-src` | `'self' 'nonce-{NONCE}'` | `'self' 'nonce-{NONCE}' 'unsafe-eval'` |
| `style-src` | `'self' 'unsafe-inline'` | `'self' 'unsafe-inline'` |
| `connect-src` | `'self'` | `'self'` |
| `img-src` | `'self' data:` | `'self' data:` |
| `font-src` | `'self'` | `'self'` |
| `object-src` | `'none'` | `'none'` |
| `base-uri` | `'self'` | `'self'` |
| `form-action` | `'self'` | `'self'` |
| `frame-ancestors` | `'none'` | `'none'` |

`'unsafe-eval'` in development allows Next.js to use `eval()` for HMR (React Refresh). In
production, Next.js does not use `eval()`, so `'unsafe-eval'` is not required and must not appear.

### Known Residual Risk: `style-src 'unsafe-inline'`

`style-src 'unsafe-inline'` permits inline `<style>` blocks and `style=` attributes. This is a
CSS injection vector: CSS injection can be used for UI redressing (styled overlays that mimic
the admin UI) in a CIAM context.

The risk is lower than script injection because CSS injection cannot exfiltrate data via network
requests directly. Removing `unsafe-inline` from `style-src` requires that no Athena or Canvas
components rely on inline styles. This is tracked as a follow-on security hardening task.

---

## CI Gate

A CI step runs on every push and pull request to verify that `unsafe-eval` is absent from the
compiled production edge bundle:

```yaml
# .github/workflows/ci.yml
- name: CSP production gate — no unsafe-eval in prod edge bundle
  run: |
    bun run build
    if grep -q "unsafe-eval" .next/server/edge-chunks/*.js 2>/dev/null || \
       grep -q "unsafe-eval" .next/server/middleware.js 2>/dev/null; then
      echo "ERROR: 'unsafe-eval' found in production edge bundle — production CSP gate failed"
      exit 1
    fi
    echo "CSP gate passed: 'unsafe-eval' not found in production edge bundle"
```

The grep target is the compiled edge bundle artifact (`.next/server/`), not the source file.
Grepping the source file is insufficient — `buildCsp` conditionally includes `unsafe-eval` and
a source-file grep cannot evaluate the runtime condition. Grepping the build output captures
what the production middleware will actually emit.

If this CI step is ever modified, preserve the `.next/server/` grep target. Reverting to a
source-file grep silently removes enforcement without any indication that the gate is no longer
valid.

---

## Making a CSP Change

Follow this procedure for any change to Athena's CSP:

1. Edit `src/lib/csp.ts` — do not edit CSP logic in `src/middleware.ts` directly
2. Run the unit tests: `bun run test src/__tests__/csp.test.ts`
3. The tests verify the exact CSP diff: confirm the changed directive produces the expected
   header value for both `development` and `production` environments
4. Verify the CI artifact gate passes locally: `bun run build`, then inspect
   `.next/server/middleware.js` to confirm `unsafe-eval` is not present in the production path
5. Open a pull request — the CI gate runs automatically on push

Optional: use `Content-Security-Policy-Report-Only` in a staging or dev environment as a
pre-flight before enforcing a new directive. Set the report-only header alongside the
enforcing header, observe violations in the browser console or a report endpoint, then remove
the report-only header once violations are resolved.

---

## API / Technical Details

### `buildCsp` export contract

```typescript
// src/lib/csp.ts
export function buildCsp(nonce: string, env?: string): string
```

- `nonce` — base64-encoded 16-byte random value, generated per-request in middleware
- `env` — optional; defaults to `process.env.NODE_ENV` if not provided
- Returns the full CSP header value as a semicolon-delimited string

The `env` parameter exists exclusively for unit test isolation. Production code calls
`buildCsp(nonce)` without the second argument.

### Unit test contract (`src/__tests__/csp.test.ts`)

The unit tests are the specification for the CSP contract:

- `NODE_ENV=production` — `unsafe-eval` must not appear anywhere in the CSP string
- `NODE_ENV=development` — `unsafe-eval` must appear in `script-src` only
- `NODE_ENV=undefined` — treated as non-development; `unsafe-eval` must not appear
- Nonce value must be interpolated correctly in `script-src 'nonce-{value}'`

---

## Examples

### Verifying the production CSP in Chrome DevTools

1. Open Chrome DevTools (F12)
2. Go to the Network tab
3. Navigate to the Athena dashboard (`https://<athena-domain>/dashboard` or `http://localhost:3001/dashboard`)
4. Click the HTML document request
5. Inspect the Response Headers panel — look for `content-security-policy`

Expected `script-src` in production:
```
script-src 'self' 'nonce-<base64-value>'
```

`'unsafe-eval'` must not appear. If it does, the CI artifact gate did not run or the build
was not a clean production build.

### Checking that all script tags have a nonce

In Chrome DevTools Console on any Athena page:

```javascript
document.querySelectorAll('script[nonce]').length
// Should equal document.querySelectorAll('script').length
// Any script without a nonce attribute is blocked by the CSP
```

---

## Edge Cases

### React never hydrates in dev — `EvalError` in console

If the browser console shows:
```
EvalError: Evaluating a string as JavaScript violates the following Content Security Policy directive
```
and the app shows an infinite loading spinner, `unsafe-eval` is absent from the dev CSP.

Verify that `NODE_ENV` is set to `"development"` in the dev container environment. In the dev
compose file, `NODE_ENV=development` must be present in the Athena container environment block.
If it is absent or set to `"production"`, `buildCsp` omits `unsafe-eval` and HMR breaks.

### Adding a new inline `<script>` block

Any inline `<script>` block must carry the nonce from `x-nonce`. Without it, the CSP blocks
execution silently:

```tsx
// layout.tsx — read nonce from headers, pass to inline script
const nonce = (await headers()).get('x-nonce') ?? '';
return (
  <script nonce={nonce} dangerouslySetInnerHTML={{ __html: `window.__CONFIG__ = {}` }} />
);
```

### CI gate fails after a build change

If the CI gate fails after a Next.js upgrade or build configuration change, verify the edge
bundle output path. Next.js may write the edge middleware to a different path across major
versions. Update the grep target path in the CI step to match the actual output location.

---

## Security Considerations

### `unsafe-eval` is development-only and CI-enforced

`unsafe-eval` in `script-src` allows `eval()`, `new Function()`, and similar constructs. These
are XSS vectors in the presence of user-controlled input. The production CSP must never include
`unsafe-eval`. The CI artifact gate exists specifically to prevent accidental inclusion.

Do not add `unsafe-eval` to the production path as a workaround for a missing nonce. If a
script is blocked by the CSP in production, the correct fix is to add the nonce attribute, not
to weaken the CSP.

### `style-src 'unsafe-inline'` — known limitation

The current CSP includes `style-src 'unsafe-inline'`. This is a residual risk — CSS injection
via inline styles is a real attack surface in a CIAM admin UI. Removing `unsafe-inline` from
`style-src` requires confirming that no Canvas components or Athena layouts use inline styles.
This is tracked as a security follow-on item.

### `frame-ancestors 'none'` — admin UI must not be embeddable

`frame-ancestors 'none'` prevents Athena from being embedded in any iframe. This is intentional
security hardening — the admin UI must not be embeddable, as iframe embedding enables
clickjacking attacks against admin operations.

### Compliance

- `script-src 'nonce-{NONCE}'` without `unsafe-inline` addresses OWASP A03:2021 Injection (XSS)
- CI enforcement of the production CSP gate provides an additional defense layer not present in
  most comparable admin panel implementations
- `frame-ancestors 'none'` addresses OWASP A05:2021 Security Misconfiguration (clickjacking)
