# Athena

Admin panel for [Ory Kratos](https://www.ory.sh/kratos/) identity management and [Ory Hydra](https://www.ory.sh/hydra/) OAuth2 server.

Built with Next.js, TypeScript, and the [Canvas](https://github.com/OlympusOSS/canvas) design system.

---

## Screenshots

| Dashboard | Identities |
|-----------|------------|
| ![Dashboard](assets/dashboard.png) | ![Identities](assets/identities.png) |

| Identity Details | Sessions |
|-----------------|----------|
| ![Identity](assets/identity.png) | ![Sessions](assets/sessions.png) |

| OAuth2 Clients | Schemas |
|---------------|---------|
| ![Clients](assets/clients.png) | ![Schemas](assets/schemas.png) |

| Messages | Settings |
|----------|----------|
| ![Messages](assets/messages.png) | ![Settings](assets/settings.png) |

---

## Features

### Kratos Identity Management

- **Dashboard** — User growth, active sessions, verification rates, schema distribution, and service health
- **Identities** — Create, view, edit, and delete identities with schema-driven forms. Search, bulk operations, account recovery
- **Sessions** — Monitor active sessions, revoke individually or in bulk
- **Messages** — Track courier messages (email/SMS) with delivery status
- **Schemas** — View and inspect identity schemas with JSON visualization

### Hydra OAuth2 Management

- **OAuth2 Clients** — Full CRUD for OAuth2/OIDC clients — grant types, scopes, redirect URIs, token lifetimes
- **OAuth2 Tokens** — View and revoke access/refresh tokens

### Security

- **Locked Accounts** — View all active brute-force lockouts with identifier, source IP, lock reason, failed attempt count, and expiry. Manually unlock individual accounts with a single click. Unlock actions are audit-logged with the admin's Kratos identity UUID. The list is capped at 500 rows; a warning banner is shown when the cap is reached. See [docs/locked-accounts.md](docs/locked-accounts.md).

### General

- Light and dark theme
- Runtime endpoint configuration (connect to any Kratos/Hydra instance)
- Compatible with [Ory Network](https://www.ory.sh/network/) (managed) and self-hosted Ory

---

## Authentication

Athena authenticates admin users via OAuth2 authorization code flow with PKCE S256 against IAM Hydra. All API routes are protected by Next.js edge middleware (`src/middleware.ts`).

### Auth Model

- **Login**: `GET /api/auth/login` — redirects to IAM Hydra → Hera login page → callback sets `athena-session` cookie
- **Session**: HMAC-SHA256-signed cookie; verified on every API request by the edge middleware
- **Roles**: `admin` (full access) and `viewer` (read-only); resolved from Kratos identity metadata at login
- **Public routes**: `/api/health` and `/api/auth/**` require no session
- **Proxy routes**: `/api/kratos-admin/**`, `/api/hydra-admin/**`, `/api/iam-kratos-admin/**` bypass Athena session auth; Ory enforces API key auth on the upstream side

### OAuth2 Callback Flow

```
login initiation → PKCE code_challenge generated → Hydra authorization URL
     ↓
Hera IAM login + consent
     ↓
/api/auth/callback (state check, PKCE verifier check)
     ↓
POST /oauth2/token (code + code_verifier; no client_secret)
     ↓
GET /oauth2/userinfo (Bearer access_token → verified sub, email)
     ↓
GET /admin/identities/{sub} (Kratos admin → role)
     ↓
athena-session cookie set → redirect to /dashboard
```

The `id_token` returned by Hydra is retained in the session for logout hint purposes only. **It is never decoded for claim retrieval** — all identity claims come exclusively from the `/oauth2/userinfo` response. See [docs/oauth2-callback.md](docs/oauth2-callback.md) for full details.

See [docs/api-authentication.md](docs/api-authentication.md) for the complete route auth table and error reference.

---

## Prerequisites

- An [Ory Kratos](https://www.ory.sh/kratos/) instance (required)
- An [Ory Hydra](https://www.ory.sh/hydra/) instance (required for authentication; also enables OAuth2 client and token management)

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `KRATOS_PUBLIC_URL` | Kratos public API | `http://localhost:3100` |
| `KRATOS_ADMIN_URL` | Kratos admin API | `http://localhost:3101` |
| `KRATOS_API_KEY` | Kratos API key (if required) | — |
| `HYDRA_PUBLIC_URL` | Hydra public API | `http://localhost:3102` |
| `HYDRA_ADMIN_URL` | Hydra admin API | `http://localhost:3103` |
| `HYDRA_API_KEY` | Hydra API key (if required) | — |
| `HYDRA_ENABLED` | Enable Hydra integration | `true` |
| `IS_ORY_NETWORK` | Ory Network mode (disables health checks) | `false` |
| `BASE_PATH` | Base path prefix | — |
| `ENCRYPTION_KEY` | AES-256-GCM key for settings encryption and session HMAC | — (required) |
| `SETTINGS_TABLE` | SDK settings table name (`ciam_settings` or `iam_settings`) | — |
| `DATABASE_URL` | Connection string to the `olympus` PostgreSQL database | — |

Endpoints and API keys can also be configured at runtime via the **Settings** page.

---

## Getting Started

Athena is part of the [OlympusOSS Identity Platform](https://github.com/OlympusOSS/platform). All repos must be cloned as siblings under a shared workspace:

```
Olympus/
├── platform/    # Infrastructure & Podman Compose — start here
├── athena/      # Admin dashboard (this repo)
├── hera/        # Auth & consent UI
├── site/        # Brochure site & OAuth2 playground
├── canvas/      # Design system
└── octl/        # Deployment CLI
```

### Start the development environment

```bash
octl dev
```

The CLI installs Podman (if needed), starts all containers, and seeds test data. Once complete, open:

- **IAM Athena** — [http://localhost:4001](http://localhost:4001) (employee admin)
- **CIAM Athena** — [http://localhost:3001](http://localhost:3001) (customer admin)

Athena is volume-mounted into Podman for **live reload** — edit files locally and changes reflect immediately.

### Standalone (without platform)

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). Requires Kratos (and optionally Hydra) running separately.

### Commands

```bash
bun run dev          # Start development server
bun run build        # Build for production
bun run start        # Start production server
bun run lint         # Run Biome linter
bun run lint:fix     # Auto-fix lint issues
```

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16, React 19 |
| Language | TypeScript |
| Runtime | [Bun](https://bun.sh/) |
| Design System | [@olympusoss/canvas](https://github.com/OlympusOSS/canvas) |
| Styling | Tailwind CSS |
| Charts | Nivo |
| State | Zustand |
| Data Fetching | TanStack Query |
| Forms | React JSON Schema Form (RJSF), React Hook Form |
| API Clients | @ory/kratos-client, @ory/hydra-client |
| Icons | Lucide React |
| Linting | Biome |

---

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (app)/              # Protected routes
│   │   ├── dashboard/      # Analytics dashboard
│   │   ├── identities/     # Identity list, create, detail
│   │   ├── sessions/       # Session management
│   │   ├── messages/       # Courier message tracking
│   │   ├── schemas/        # Identity schema viewer
│   │   ├── clients/        # OAuth2 client CRUD
│   │   ├── tokens/         # OAuth2 token management
│   │   ├── settings/       # Endpoint configuration
│   │   ├── security/       # Locked accounts admin view (admin-only)
│   │   └── profile/        # User profile
│   ├── (auth)/             # Login page
│   └── api/                # API routes (auth, config, health)
├── components/             # Shared layout and form components
├── features/               # Feature modules
│   ├── analytics/          # Dashboard data hooks
│   ├── auth/               # Authentication store and guards
│   ├── identities/         # Identity hooks, table, forms, dialogs
│   ├── sessions/           # Session hooks and components
│   ├── messages/           # Message hooks and components
│   ├── schemas/            # Schema hooks and viewer
│   ├── oauth2-clients/     # OAuth2 client hooks and form
│   ├── oauth2-tokens/      # Token hooks
│   ├── security/           # Locked accounts view, unlock mutation, types
│   └── settings/           # Settings store
├── services/               # API service layer
│   ├── kratos/             # Kratos API client and endpoints
│   └── hydra/              # Hydra API client and endpoints
├── hooks/                  # Shared hooks (pagination, search, debounce, formatters)
├── lib/                    # Utilities (HTTP client, crypto, date helpers)
└── providers/              # React context (Query, Theme, Auth)
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/api-authentication.md](docs/api-authentication.md) | Middleware auth enforcement, session cookie, route auth table, error reference, proxy trust model |
| [docs/oauth2-callback.md](docs/oauth2-callback.md) | OAuth2 callback flow, PKCE requirements, userinfo endpoint, session creation, edge cases |
| [docs/locked-accounts.md](docs/locked-accounts.md) | Locked accounts admin view — API endpoints, unlock flow, truncation cap, SDK dependency, security considerations |

---

## License

MIT
