---
name: opensource-codebase-map
description: >-
  Reverse-engineer an open-source codebase into an architecture map, feature inventory, and 1–3 traced end-to-end flows, then extract reusable lessons and trade-offs. Use when the user asks to read an OSS repo, understand architecture, map features, trace a specific flow, prepare to fork/contribute, or asks "how does this project work?".
---

# Open-source Codebase Map

Build a reliable mental model of an OSS repo: what it does, how it is structured, how key flows work, and what lessons to reuse.

## Quick start

Follow the phases below, then write up the results using the output template.

## Guardrails

- Prefer evidence over inference. When you claim a flow or boundary, cite the exact file paths + symbols you saw.
- Start top-down (entrypoints → modules → flows). Avoid getting stuck in utilities early.
- Keep scope bounded: map the repo and a few representative flows; do not refactor or “fix” the project unless asked.
- If a claim is uncertain, label it explicitly as a hypothesis and list what to read next to confirm.

## Inputs to request (only if missing)

- Repo location: URL or local path, plus branch/tag/commit if reproducibility matters.
- Focus: backend / frontend / CLI / worker / library API / data pipeline.
- Depth: skim (fast) / standard / deep.
- Flows of interest: e.g. “auth login”, “create order”, “build pipeline”, “CLI command X”.

## Workflow

### Phase 0 — Orient (5–10 minutes)

Read and extract:
- README + docs index (what it is, how to run, core concepts)
- build + deps: `package.json` / `go.mod` / `Cargo.toml` / `pyproject.toml` / `pom.xml`
- deployment/runtime hints: Docker, Procfile, helm, `compose.yml`
- CI pipelines: `.github/workflows/*` or equivalent

Deliverable:
- 5-bullet “What this repo is” summary (purpose, users, runtime model, primary entrypoint types, persistence/external deps).

### Phase 1 — Shape the system (module map)

Build a module inventory from the folder structure and dependency hints:
- apps vs packages/libs
- domain vs infra vs UI boundaries (if present)
- dependency direction (who depends on whom)

Deliverable:
- A table of modules/packages with: role, key folders, key public entrypoints, major dependencies.

### Phase 2 — Find entrypoints (where execution starts)

Identify the real starting points:
- server: `main`, `index`, `server`, `app`, framework bootstrap
- CLI: command registry, subcommands, argument parsing, main command handler
- workers/cron: queue consumers, scheduled jobs
- library API: exported surface area and usage examples

Deliverable:
- An “Entrypoints” list: each entrypoint → what it starts → next hop file/symbol.

### Phase 3 — Feature inventory (user-facing, not folder-based)

Extract features as capabilities:
- Group by domain/bounded context when possible (e.g. Billing, Auth, Content, Search)
- Map each feature to the code surface (routes/commands/components/services)

Deliverable:
- Feature list with: description, primary code touchpoints, config/env dependencies, persistence touchpoints (DB tables/collections/files) if applicable.

### Phase 4 — Trace 1–3 representative flows (end-to-end)

For each chosen flow, trace:
- Trigger → input validation/parsing → orchestration → domain logic → persistence/external calls → output/rendering
- Key error paths and retries
- AuthZ/authN points (if relevant)

Deliverable:
- A numbered flow diagram (text) with file paths + function/class names per step.

### Phase 5 — Patterns, trade-offs, and lessons

Extract the reusable insights:
- Architecture pattern: modular monolith / microservices / plugin system / hexagonal-ish / layered MVC / event-driven
- Cross-cutting concerns: logging, errors, config, DI, caching, migrations, testing strategy
- Where the design is elegant vs where it is brittle (with evidence)

Deliverable:
- Lessons with “When to copy” + “When to avoid” and concrete examples from the repo.

## Search strategy (use in this order)

1. Look for canonical docs + entrypoints first (README, `main`, `app`, route registries, CLI registries).
2. Use exact search for stable anchors: exported symbols, route strings, command names, event names.
3. Use semantic search when you know “what” but not “how it’s named” (e.g. “where do we validate tokens?”).
4. Read the smallest file slices needed to confirm each hop; expand only when necessary.

## Output template (use this structure)

```markdown
## Executive summary
- **What it is**:
- **Primary runtime model**: (server/CLI/worker/library)
- **Key technologies**:
- **Persistence/external deps**:
- **Where to start reading**: (top 3 entrypoints)

## Architecture map
### Modules/packages
| Module | Role | Key paths | Entrypoints / public API | Notes |
|---|---|---|---|---|

### Dependency direction
- A → B (why)

## Feature inventory
| Feature | What it does | Touchpoints (routes/commands/components) | Data/external deps | Notes |
|---|---|---|---|---|

## Traced flows
### Flow: <name>
1. <step> — `<file>` :: `<symbol>`
2. ...

**Key error paths**
- ...

## Patterns & trade-offs
- **Strong choices**:
- **Risky/brittle spots**:

## Lessons you can reuse
- **Lesson**: ...
  - **Copy when**: ...
  - **Avoid when**: ...
  - **Evidence**: `<file>` :: `<symbol>`

## Open questions / next reads
- ...
```

## How to adapt to repo types

- Monorepo: treat “apps” as entrypoints and “packages” as dependency units; map boundaries before tracing flows.
- Framework-heavy web app: routes are your feature index; start from route registration and middleware.
- Library: exported API + examples/tests define features; flows are “call graph” not HTTP.
- Data pipeline: flows are “ingest → transform → store → serve”; entrypoints often live in schedulers/workers.

## Additional resources

- Stack-specific checklists and deeper heuristics: [reference.md](reference.md)
- Sample reports (copy/paste and adapt): [examples.md](examples.md)

