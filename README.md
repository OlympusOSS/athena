# Athena

A modern admin interface for [Ory Kratos](https://www.ory.sh/kratos/) identity management and [Ory Hydra](https://www.ory.sh/hydra/) OAuth2 server. Built with Next.js 16, TypeScript, and custom UI components.

**Security Notice**: This interface uses mock authentication for development purposes and should not be exposed to the public internet. Deploy behind proper authentication and access controls in production environments.

**Development Status**: This project is in active development. Features may change and breaking updates can occur.

## Features

### Kratos Identity Management

- **Dashboard**: Analytics with user growth, active sessions, verification rates, and system health metrics
- **Identities**: Create, view, edit, and delete identities with schema-based forms and metadata management
- **Sessions**: Monitor, extend, and revoke sessions with advanced search and filtering
- **Messages**: Track email/SMS courier messages with delivery status and error monitoring
- **Schemas**: View and inspect identity schemas with JSON visualization

### Hydra OAuth2 Management

- **OAuth2 Clients**: Full CRUD operations for OAuth2 clients with configuration management
- **OAuth2 Tokens**: Monitor and revoke access/refresh tokens with client-based filtering

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

- **Framework**: Next.js 16 with App Router
- **UI**: Custom components with MUI v7, MUI X Charts/DataGrid
- **Forms**: React JSON Schema Form (RJSF)
- **State**: Zustand + TanStack Query
- **Language**: TypeScript
- **Styling**: Custom theme system, Tailwind CSS, Emotion
- **APIs**: Ory Kratos Client, Ory Hydra Client

## Prerequisites

- Node.js 22+
- Ory Kratos instance
- Ory Hydra instance (optional)

## Quick Start

### Local Development

```bash
git clone https://github.com/bnannier/Athena.git
cd Athena
bun install
cp .env.example .env.local
# Edit .env.local with your Kratos and Hydra URLs
bun run dev
```

Access at [http://localhost:3003](http://localhost:3003)

Default credentials:

- Admin: `bobby@nannier.com` / `admin123!`
- Viewer: `marine@nannier.com` / `admin123!`

> To change the admin email/password, edit `dev/iam-seed-dev.sh` (seed script) and `src/features/auth/utils.ts` (demo accounts displayed on login page), then re-run the seed: `docker compose --profile init up athena-seed-dev`

### Docker

```bash
docker build -t athena .

docker run -p 3003:3000 \
  -e KRATOS_PUBLIC_URL=http://localhost:5000 \
  -e KRATOS_ADMIN_URL=http://localhost:5001 \
  -e HYDRA_ADMIN_URL=http://localhost:5003 \
  -e HYDRA_PUBLIC_URL=http://localhost:5002 \
  athena
```

### Docker Compose (Full Dev Environment)

```bash
cd dev
docker compose -f docker-compose.yml -f docker-compose.override.dev.yml up -d --build
docker compose --profile init up athena-seed-dev   # seed admin users, test identities, OAuth2 clients
```

| Service | URL | Credentials |
|---------|-----|-------------|
| Athena UI | [http://localhost:3003](http://localhost:3003) | `bobby@nannier.com` / `admin123!` |
| pgAdmin | [http://localhost:4000](http://localhost:4000) | `admin@athena.dev` / `admin` |
| MailSlurper | [http://localhost:4001](http://localhost:4001) | — |
| Kratos Self-Service UI | [http://localhost:3004](http://localhost:3004) | — |
| Hydra Consent UI | [http://localhost:3002](http://localhost:3002) | — |
| Demo App | [http://localhost:2000](http://localhost:2000) | — |

See [`dev/`](./dev) folder for full details.

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
│   ├── (app)/          # Protected routes (dashboard, identities, sessions, etc.)
│   └── (auth)/         # Authentication pages
├── components/         # Shared UI components
├── features/           # Feature modules (analytics, auth, identities, sessions, oauth2)
├── services/           # API services (Kratos, Hydra)
├── hooks/              # Custom React hooks
├── providers/          # React context providers
└── theme/              # Theme configuration
```

## Configuration

### Environment Variables

| Variable                          | Default                 | Description |
| --------------------------------- | ----------------------- | ----------- |
| `KRATOS_PUBLIC_URL`               | `http://localhost:5000`  | Managed Kratos public API |
| `KRATOS_ADMIN_URL`                | `http://localhost:5001`  | Managed Kratos admin API |
| `KRATOS_API_KEY`                  |                          | API key (required for Ory Network) |
| `HYDRA_PUBLIC_URL`                | `http://localhost:5002`  | Managed Hydra public API |
| `HYDRA_ADMIN_URL`                 | `http://localhost:5003`  | Managed Hydra admin API |
| `HYDRA_API_KEY`                   |                          | API key (required for Ory Network) |
| `IAM_KRATOS_PUBLIC_URL`           | `http://localhost:7000`  | Internal IAM (Kratos) for Athena auth |
| `IAM_KRATOS_ADMIN_URL`            | `http://localhost:7001`  | Internal IAM admin API |
| `IS_ORY_NETWORK`                  |                          | Set to `true` for Ory Network |

API Keys are typically mandatory when accessing an Ory Network project.

`IS_ORY_NETWORK` must be set to `true` when using Athena on Ory Network.

Endpoints and API Keys can also be configured via the settings dialog in the application.

## Development

```bash
bun run dev          # Start development server
bun run build        # Build for production
bun run start        # Start production server
bun run lint         # Run Biome linter
```

## License

Apache License 2.0 - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Ory Kratos](https://www.ory.sh/kratos/) - Identity management system
- [Ory Hydra](https://www.ory.sh/hydra/) - OAuth2 and OpenID Connect server
- [dhia-gharsallaoui/kratos-admin-ui](https://github.com/dhia-gharsallaoui/kratos-admin-ui) - Original project
- Built with [Next.js](https://nextjs.org/), [Material-UI](https://mui.com/), and [TanStack Query](https://tanstack.com/query)
