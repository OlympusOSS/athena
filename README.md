# Athena — Admin Panel

A modern administration interface for [Ory Kratos](https://www.ory.sh/kratos/) identity management and [Ory Hydra](https://www.ory.sh/hydra/) OAuth2 server. Part of the [OlympusOSS Identity Platform](https://github.com/bnannier/OlympusOSS).

Built with Next.js 15, TypeScript, and custom UI components.

## Overview

Athena is deployed as two separate instances within the OlympusOSS platform:

- **CIAM Athena** (port 3003) — Manages customer identities, connected to CIAM Kratos and CIAM Hydra
- **IAM Athena** (port 4003) — Manages employee identities, connected to IAM Kratos

Both instances run the same codebase. The target Kratos and Hydra services are configured via environment variables.

## Features

### Kratos Identity Management

- **Dashboard** — Analytics with user growth, active sessions, verification rates, and system health metrics
- **Identities** — Create, view, edit, and delete identities with schema-based forms and metadata management
- **Sessions** — Monitor, extend, and revoke sessions with advanced search and filtering
- **Messages** — Track email/SMS courier messages with delivery status and error monitoring
- **Schemas** — View and inspect identity schemas with JSON visualization

### Hydra OAuth2 Management

- **OAuth2 Clients** — Full CRUD operations for OAuth2 clients with configuration management
- **OAuth2 Tokens** — Monitor and revoke access/refresh tokens with client-based filtering

### User Interface

- Modern custom UI with light/dark theme support
- Real-time endpoint configuration for Kratos and Hydra
- Advanced search and pagination across all data tables
- Responsive design with interactive charts and data visualization

## Screenshots

| Dashboard                            | Identities                           | Sessions                         | Messages                         |
| ------------------------------------ | ------------------------------------ | -------------------------------- | -------------------------------- |
| ![Dashboard](assets/dashboard-1.jpg) | ![Identities](assets/identities.jpg) | ![Sessions](assets/sessions.jpg) | ![Messages](assets/messages.jpg) |

| Identity Details                 | Session Details                | Schemas                        | Settings                         |
| -------------------------------- | ------------------------------ | ------------------------------ | -------------------------------- |
| ![Identity](assets/identity.jpg) | ![Session](assets/session.jpg) | ![Schemas](assets/schemas.jpg) | ![Settings](assets/settings.jpg) |

## Technology Stack

- **Framework**: Next.js 15 with App Router
- **Runtime**: [Bun](https://bun.sh/)
- **UI**: Custom components with MUI v7, MUI X Charts/DataGrid
- **Forms**: React JSON Schema Form (RJSF)
- **State**: Zustand + TanStack Query
- **Language**: TypeScript
- **Styling**: Custom theme system, Tailwind CSS, Emotion
- **APIs**: Ory Kratos Client, Ory Hydra Client

## Configuration

All service URLs are configurable via environment variables. This is how the same codebase serves both CIAM and IAM domains.

### Environment Variables

| Variable            | Description                  | CIAM Athena Default        | IAM Athena Default         |
| ------------------- | ---------------------------- | -------------------------- | -------------------------- |
| `KRATOS_PUBLIC_URL` | Kratos public API            | `http://ciam-kratos:5000`  | `http://iam-kratos:7000`   |
| `KRATOS_ADMIN_URL`  | Kratos admin API             | `http://ciam-kratos:5001`  | `http://iam-kratos:7001`   |
| `KRATOS_API_KEY`    | Kratos API key (if required) | —                          | —                          |
| `HYDRA_PUBLIC_URL`  | Hydra public API             | `http://ciam-hydra:5002`   | —                          |
| `HYDRA_ADMIN_URL`   | Hydra admin API              | `http://ciam-hydra:5003`   | —                          |
| `HYDRA_API_KEY`     | Hydra API key (if required)  | —                          | —                          |
| `HYDRA_ENABLED`     | Enable Hydra integration     | `true`                     | `false`                    |
| `IS_ORY_NETWORK`    | Ory Network mode             | —                          | —                          |

When running outside Docker (local development), the fallback defaults are:

| Variable            | Fallback Default             |
| ------------------- | ---------------------------- |
| `KRATOS_PUBLIC_URL` | `http://localhost:3100`      |
| `KRATOS_ADMIN_URL`  | `http://localhost:3101`      |
| `HYDRA_PUBLIC_URL`  | `http://localhost:3102`      |
| `HYDRA_ADMIN_URL`   | `http://localhost:3103`      |

Endpoints and API keys can also be configured at runtime via the Settings page in the UI.

## Development

### With Docker Compose (recommended)

Athena is part of the full OlympusOSS dev environment. From the `dev/` directory:

```bash
docker compose up -d
```

This starts both CIAM Athena (port 3003) and IAM Athena (port 4003) with hot reload via volume mounts.

### Standalone

```bash
bun install
bun run dev
```

Access at [http://localhost:3000](http://localhost:3000). Configure Kratos/Hydra URLs via environment variables or the Settings page.

### Commands

```bash
bun run dev          # Start development server
bun run build        # Build for production
bun run start        # Start production server
bun run lint         # Run Biome linter
bun run lint:fix     # Auto-fix lint issues
```

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
│   ├── (app)/           # Protected routes (dashboard, identities, sessions, etc.)
│   ├── (auth)/          # Authentication pages
│   └── api/             # API routes (config, encryption)
├── components/          # Shared UI components
├── features/            # Feature modules (analytics, auth, identities, sessions, oauth2)
├── services/            # API clients (Kratos, Hydra)
│   ├── kratos/          # Kratos API client, config, and endpoint wrappers
│   └── hydra/           # Hydra API client, config, and endpoint wrappers
├── hooks/               # Custom React hooks
├── providers/           # React context providers
├── proxy.ts             # Middleware proxy for API routing
└── theme/               # Theme configuration
```

## Port Allocation (OlympusOSS)

| Port | Service | Domain | Description |
|------|---------|--------|-------------|
| 3003 | CIAM Athena | Customer | Admin panel for customer identity management |
| 4003 | IAM Athena | Employee | Admin panel for employee identity management |
| 3100 | CIAM Kratos (public) | Customer | Customer identity API |
| 3101 | CIAM Kratos (admin) | Customer | Customer identity admin API |
| 3102 | CIAM Hydra (public) | Customer | Customer OAuth2/OIDC endpoints |
| 3103 | CIAM Hydra (admin) | Customer | Customer OAuth2 admin API |
| 4100 | IAM Kratos (public) | Employee | Employee identity API |
| 4101 | IAM Kratos (admin) | Employee | Employee identity admin API |
| 4102 | IAM Hydra (public) | Employee | Internal OAuth2/OIDC endpoints |
| 4103 | IAM Hydra (admin) | Employee | Internal OAuth2 admin API |

## License

MIT License — see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Originally forked from [dhia-gharsallaoui/kratos-admin-ui](https://github.com/dhia-gharsallaoui/kratos-admin-ui)
- [Ory Kratos](https://www.ory.sh/kratos/) — Identity management
- [Ory Hydra](https://www.ory.sh/hydra/) — OAuth2/OIDC server
- Built with [Next.js](https://nextjs.org/), [Material-UI](https://mui.com/), and [TanStack Query](https://tanstack.com/query)
