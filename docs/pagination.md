# Athena Identities — Server-Side Pagination

## Overview

The Athena identities table uses server-side cursor-based pagination backed by Kratos's native `page_token` / `page_size` API. No client-side identity fetching occurs. Every page of results — including search results — is a single Kratos API call via Athena's `GET /api/identities` route.

> **Audience**: Developers integrating with Athena's identity list API, or contributors working on the identities feature.

---

## How It Works

Kratos returns identities in pages. Each page response includes an opaque cursor token for the next page. Athena forwards pagination parameters to Kratos and returns the cursor to the caller.

```
Client → GET /api/identities?page_size=25
      ← { identities: [...], next_page_token: "<opaque>", has_more: true }

Client → GET /api/identities?page_size=25&page_token=<opaque>
      ← { identities: [...], next_page_token: "<opaque2>", has_more: true }

Client → GET /api/identities?page_size=25&page_token=<opaque2>
      ← { identities: [...], next_page_token: null, has_more: false }
```

Back-navigation: store the sequence of page tokens in the client. To go back one page, use the previous token (or omit `page_token` for page 1).

---

## API Reference

### `GET /api/identities`

Fetches a page of Kratos identities. Requires an admin session.

**Authentication**: Session required — `admin` role. See `athena/docs/api-authentication.md`.

**Query parameters**:

| Parameter | Type | Default | Constraints | Description |
|-----------|------|---------|-------------|-------------|
| `page_size` | integer | `25` | 1–250 | Number of identities per page. Values outside 1–250 return `400`. |
| `page_token` | string | omit | max 2048 chars | Opaque cursor returned by the previous page response. Omit for the first page. |
| `credentials_identifier` | string | omit | max 255 chars | Filter by exact email or username. See [Search](#search) below. |

**Response** (200):

```json
{
  "identities": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "traits": {
        "email": "alice@example.com"
      },
      "state": "active",
      "created_at": "2026-01-15T12:00:00Z",
      "updated_at": "2026-03-01T09:30:00Z"
    }
  ],
  "next_page_token": "<opaque_string_or_null>",
  "has_more": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `identities` | array | Array of Kratos identity objects for this page |
| `next_page_token` | string or null | Cursor for the next page. `null` when `has_more` is false. |
| `has_more` | boolean | `true` if more identities exist beyond this page |

**Error responses**:

| Status | `error` field | When |
|--------|--------------|------|
| `400` | `invalid_page_size` | `page_size` is not an integer, or is outside 1–250 |
| `400` | `invalid_page_token` | `page_token` exceeds 2048 characters |
| `401` | `not_authenticated` | Missing or expired admin session |
| `403` | `forbidden` | Session valid but not admin role |

---

## Examples

### First page

```bash
curl -b "athena-session=<value>" \
  "http://localhost:4001/api/identities?page_size=25"
```

### Next page

```bash
curl -b "athena-session=<value>" \
  "http://localhost:4001/api/identities?page_size=25&page_token=<next_page_token_from_previous_response>"
```

### Search by email (exact match)

```bash
curl -b "athena-session=<value>" \
  "http://localhost:4001/api/identities?credentials_identifier=alice%40example.com"
```

---

## Search

Identity search uses Kratos's `credentials_identifier` filter. This filter performs an **exact match** on the identity's login credentials (email address or username). Partial matches are not supported.

**What works**:
- `alice@example.com` — exact email match
- `alice` — exact username match (only if the identity schema uses usernames)

**What does not work**:
- `alice` — does not match `alice@example.com`
- `example` — does not match any email containing "example"
- Last name search — not supported via `credentials_identifier`

The search input placeholder in the Athena UI reflects this constraint: "Search by email or username (exact match)".

Partial-match search requires a custom query layer not currently implemented. If you need fuzzy search, use the Kratos admin API directly with a custom filter, or wait for a follow-on story.

---

## Back-Navigation

Cursor tokens are opaque strings returned by Kratos. Athena does not decode or reconstruct them. To support back-navigation in the UI:

1. Keep an ordered list of all page tokens seen so far: `[undefined, token1, token2, ...]` (where `undefined` represents page 1)
2. "Next" button: append `next_page_token` to the list and fetch with the new token
3. "Previous" button: pop the last token from the list and fetch with the previous token

Page state is not persisted to the URL or localStorage. Refreshing the page returns to page 1.

---

## Edge Cases

### Empty results

When no identities match the search filter, the response is:

```json
{
  "identities": [],
  "next_page_token": null,
  "has_more": false
}
```

The UI shows "No identities found" rather than a blank table.

### Last page

When `has_more` is `false`, `next_page_token` is `null`. The UI disables the "Next" button.

### Stale or expired cursor token

Kratos cursor tokens may become invalid if Kratos restarts. If a `page_token` is no longer valid, Kratos returns an error and Athena returns a `400`. The UI should gracefully redirect to page 1.

### `page_size` validation

Values outside 1–250 return `400 { "error": "invalid_page_size" }`. The Athena API layer enforces this cap server-side before forwarding to Kratos, independent of any client-side clamping.

---

## Security Considerations

- All requests to `GET /api/identities` require an admin session. Unauthenticated requests receive `401`. Non-admin sessions receive `403`.
- Admin identity searches are logged server-side: `{ adminId, searchFilter, timestamp, action: "identity_search" }`. This satisfies SOC2 CC6.3 (audit of access to personal data).
- Cursor tokens are forwarded from Kratos to the client as opaque strings. Athena does not decode, inspect, or reconstruct them. Treat them as untrusted input on re-submission.
- `credentials_identifier` values are URL-encoded before forwarding to Kratos. Values containing control characters are rejected with `400`.

---

## Related Issues

- [athena#37](https://github.com/OlympusOSS/athena/issues/37) — Server-side pagination implementation

---

*Last updated: 2026-04-01 (Technical Writer — athena#37 server-side pagination)*
