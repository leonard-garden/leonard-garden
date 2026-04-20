---
name: opensource-codebase-map-reference
description: Reference checklists and heuristics for opensource-codebase-map. Read when you need stack-specific anchors, deeper tracing tactics, or quality gates for the analysis output.
---

# Open-source Codebase Map — Reference

Use this file when you need deeper, stack-specific anchors or when your analysis feels uncertain.

## Quality gates (before you “declare understanding”)

- **Entrypoints are real**: you can point to the file(s) that start execution and show the next hop.
- **Feature list is user-facing**: features are phrased as capabilities, not folder names.
- **Flows are end-to-end**: each flow includes trigger → orchestration → side effects → output, with file paths + symbols.
- **Trade-offs are evidenced**: each “brittle spot” cites code or tests that demonstrate it.
- **Unknowns are explicit**: you listed open questions + next reads.

## Stack checklists

### TypeScript / JavaScript (Node, monorepo)

Read:
- `package.json` (root) + workspace config (`workspaces`, `pnpm-workspace.yaml`, `turbo.json`, `nx.json`)
- `tsconfig.json` (root + package overrides)
- build tooling: `vite.config.*`, `next.config.*`, `astro.config.*`, `webpack.*`
- runtime entrypoints: `src/index.*`, `server.*`, `app.*`, `pages/`, `app/`
- scripts that reveal flows: `scripts/*`, `bin/*`, `cli/*`

Flow anchors:
- route registries (Express/Fastify/Nest/Next/Astro endpoints)
- middleware chains (auth, validation, logging)
- service layer calls (often named `*Service`, `usecase`, `controller`)
- data layer (`prisma`, `drizzle`, `typeorm`, raw SQL, `db.ts`)

Tests/usage evidence:
- `*.spec.*`, `__tests__/`, `test/`, `e2e/`, `playwright/`
- examples: `examples/`, `demo/`, `fixtures/`

### Go (service / CLI)

Read:
- `go.mod`, `cmd/*/main.go`, `internal/`, `pkg/`
- HTTP router registration (`http.Handle`, chi, gin, echo)
- config loading (env, flags, viper)
- concurrency hotspots (`go` routines, channels, worker pools)

Flow anchors:
- handlers → services → repositories
- context propagation (`context.Context`) and cancellation
- error wrapping (`fmt.Errorf("%w")`) patterns

Evidence:
- integration tests (`*_test.go`), golden files, `testdata/`

### Rust (CLI / service / lib)

Read:
- `Cargo.toml` (workspace members, features), `src/main.rs`, `src/lib.rs`
- modules: `mod.rs` or `mod` declarations
- CLI: clap/structopt command trees
- async runtime: tokio setup, spawn points, cancellation

Flow anchors:
- error types (`thiserror`, `anyhow`)
- trait boundaries (ports/adapters)
- feature flags in `Cargo.toml` that change behavior

Evidence:
- `tests/`, doc tests, `examples/`

### Python (package / service)

Read:
- `pyproject.toml` / `setup.cfg`, package layout (`src/` vs flat)
- entrypoints: `__main__.py`, console scripts, app factory patterns
- framework anchors: Django settings/urls, FastAPI routers, Flask blueprints

Flow anchors:
- dependency injection (FastAPI deps), middleware, request lifecycle
- data layer (SQLAlchemy, Django ORM, raw SQL)

Evidence:
- `tests/`, `conftest.py`, fixtures, type hints/mypy config

## Architecture heuristics (to avoid hand-wavy maps)

- **Ports & adapters**: look for interfaces/traits/protocols that decouple domain from IO.
- **Boundary files**: “router/controller” files define the feature surface; “service/usecase” files define orchestration.
- **Config as a map**: env vars + config schemas often reveal the hidden subsystems.
- **Tests as specs**: when docs are missing, tests are the most reliable story of intended behavior.

## Flow tracing tactics

- Start from a trigger (route/command/event) and write a numbered chain immediately.
- Each hop must be justified by a call/import/registration you saw.
- Capture side effects explicitly:
  - DB writes/reads
  - network calls
  - file system
  - queue publish/consume
- Include failure modes:
  - validation errors
  - retries/backoff
  - idempotency / deduplication (if present)

