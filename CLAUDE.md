# Athena

Admin dashboard UI for the Olympus identity platform.

## Versioning

- **Humans**: Use `octl bump` to bump versions across all repos
- **Agents**: Never use `octl`. Engineers bump `package.json` directly as part of their implementation. The Release Manager creates tags. See root `CLAUDE.md` for the full agent versioning protocol.

## Agent System

This repo is part of the [Olympus agent system](../docs/teams/ciam-team.md) — an 18-agent team that operates as a continuous product development loop.

- **Engineer agent**: [`docs/agents/ciam-engineer-athena.md`](../docs/agents/ciam-engineer-athena.md)
- **Cross-functional reviewers**: Architect, Security Expert, QA Engineer, DX Expert, Technical Writer
- **Key docs**: [`../docs/`](../docs/) — philosophy, file structure, team definition, dependency map, system status

### Dependencies

- **Consumes**: `@olympus/canvas` (design system), `@olympusoss/sdk` (settings/encryption), Ory Kratos + Hydra via platform
- **Consumed by**: platform (compose configs mount this repo for dev)

### Before Making Changes

- Check [`../docs/system-status.md`](../docs/system-status.md) for active work
- Check [`../docs/dependency-map.md`](../docs/dependency-map.md) for cross-repo impact
- Changes to this repo may trigger reviews from Security, QA, and DX agents
