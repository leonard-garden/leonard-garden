---
name: opensource-codebase-map-examples
description: Example outputs for opensource-codebase-map. Read when you want a copy/paste starting point for a repo report or to calibrate detail level.
---

# Open-source Codebase Map — Examples

These are templates you can copy/paste and adapt. Replace placeholders with repo-specific evidence.

## Example A — Web service (routes → services → DB)

```markdown
## Executive summary
- **What it is**: <one sentence>
- **Primary runtime model**: server
- **Key technologies**: <framework>, <db>, <queue>, <cache>
- **Persistence/external deps**: <DB>, <S3>, <Stripe>, <Redis> (as applicable)
- **Where to start reading**:
  1. `<path/to/entrypoint>` :: `<symbol>`
  2. `<path/to/router>` :: `<symbol>`
  3. `<path/to/service>` :: `<symbol>`

## Architecture map
### Modules/packages
| Module | Role | Key paths | Entrypoints / public API | Notes |
|---|---|---|---|---|
| api | HTTP routes + controllers | `src/api/*` | route registry | auth middleware sits here |
| domain | core business logic | `src/domain/*` | usecases | largely IO-free |
| data | persistence layer | `src/data/*` | repositories | owns DB queries |

### Dependency direction
- `api` → `domain` (controllers call usecases)
- `domain` → `data` (via repository interface) OR `api` → `data` (if layered MVC)

## Feature inventory
| Feature | What it does | Touchpoints (routes/commands/components) | Data/external deps | Notes |
|---|---|---|---|---|
| Auth | login/logout/session | `POST /login`, `POST /logout` | users table | JWT vs session cookie |
| Orders | create/list orders | `POST /orders`, `GET /orders` | orders table | idempotency key |

## Traced flows
### Flow: Create order
1. HTTP request hits route — `<routes file>` :: `<route registration>`
2. Auth middleware verifies identity — `<auth middleware>` :: `<symbol>`
3. Controller validates input — `<controller>` :: `<symbol>`
4. Usecase orchestrates domain rules — `<usecase>` :: `<symbol>`
5. Repository writes to DB — `<repo>` :: `<symbol>`
6. Response is serialized — `<serializer>` :: `<symbol>`

**Key error paths**
- Invalid payload → 400 from `<validator>` :: `<symbol>`
- Auth missing/expired → 401 from `<auth middleware>` :: `<symbol>`

## Patterns & trade-offs
- **Strong choices**: <e.g. clear boundary between controllers and usecases>
- **Risky/brittle spots**: <e.g. shared mutable global config, implicit side effects>

## Lessons you can reuse
- **Lesson**: Feature surfaces are indexed by route registry; start there.
  - **Copy when**: you need fast feature inventory
  - **Avoid when**: routes are generated dynamically
  - **Evidence**: `<routes file>` :: `<symbol>`

## Open questions / next reads
- How is background processing handled (queue/cron)? Read `<path>` next.
```

## Example B — CLI tool (command registry → handlers)

```markdown
## Executive summary
- **What it is**: <one sentence>
- **Primary runtime model**: CLI
- **Key technologies**: <arg parser>, <config>, <HTTP client>
- **Where to start reading**:
  1. `<cmd/main>` :: `<main>`
  2. `<cmd/root>` :: `<register commands>`
  3. `<cmd/subcommand>` :: `<run>`

## Architecture map
### Modules/packages
| Module | Role | Key paths | Entrypoints / public API | Notes |
|---|---|---|---|---|
| cmd | CLI commands | `cmd/*` | root command | maps flags/env |
| core | business logic | `internal/core/*` | functions | IO light |
| infra | IO + adapters | `internal/infra/*` | clients | HTTP/FS |

## Feature inventory
| Feature | What it does | Touchpoints | Data/external deps | Notes |
|---|---|---|---|---|
| `sync` | sync remote → local | `mytool sync` | HTTP API | pagination |

## Traced flows
### Flow: `mytool sync`
1. Entry — `<main>` :: `<main>`
2. Command selection — `<root>` :: `<Execute>`
3. Config load — `<config>` :: `<Load>`
4. Handler calls client — `<sync handler>` :: `<Run>`
5. Writes output — `<writer>` :: `<Write>`

## Lessons you can reuse
- **Lesson**: CLI “feature inventory” is the command tree; use it as index.
  - **Copy when**: commands are explicit and registered in one place
  - **Avoid when**: CLI is plugin-based/dynamically loaded
  - **Evidence**: `<root>` :: `<register>`
```

