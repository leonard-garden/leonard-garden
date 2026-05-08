# CLAUDE.md: How to Brief Claude Code Once and Have It Remember Forever

## TL;DR

**CLAUDE.md** is a markdown file that Claude Code reads automatically every time you open a project, defining the context, rules, and project-specific commands for that session. Instead of re-explaining your architecture or conventions at the start of every session, you write them once in CLAUDE.md and Claude Code carries them throughout. The file is committed to your repo, meaning the entire team shares the same set of instructions.

---

## Part 1: The Problem It Solves

An engineer uses Claude Code to refactor a module in a project using Drizzle ORM and Better Auth. Every new session, he has to explain again: "Use Drizzle, not Prisma. Schema is at `src/db/schema.ts`. Auth config is at `src/lib/auth.ts`. Don't create migrations manually — run `npm run db:push`."

After three weeks, he has a 200-word boilerplate prompt he pastes every time he opens a terminal.

This isn't Claude's fault — it's a context persistence problem between sessions. CLAUDE.md solves exactly this: write once, Claude Code reads automatically on every project entry.

---

## Part 2: Precise Definition

**CLAUDE.md** is a special markdown file that Claude Code finds and reads automatically when starting a session in a project directory. The file's content is injected into Claude's context before any of your messages.

Compared to related concepts:

| Concept | Role | Who writes it |
|---|---|---|
| CLAUDE.md (project) | Instructions for a specific repo | Developer/team |
| CLAUDE.md (global `~/.claude/`) | Instructions for all projects | Individual |
| System prompt (API) | Defines the LLM's role | API developer |
| `.cursorrules` (Cursor) | Equivalent in Cursor IDE | Developer |

CLAUDE.md differs from an API system prompt: it's version-controlled, shared via git, and read automatically — no code needed to inject it.

---

## Part 3: How It Works

When you run `claude` in a directory:

```
1. Claude Code looks for CLAUDE.md in priority order:
   a. ~/.claude/CLAUDE.md          (global — always read first)
   b. <project-root>/CLAUDE.md     (project — overrides or supplements)
   c. <subdirectory>/CLAUDE.md     (if you're working inside a subdir)

2. Content from all found files is merged together

3. The result is injected at the start of the session's context window

4. Claude Code processes your messages with that context already in place
```

CLAUDE.md also supports `@path/to/file.md` syntax to import content from other files — useful when you want to split architecture documentation into separate files without bloating CLAUDE.md itself.

```markdown
# CLAUDE.md

@docs/architecture.md
@docs/api-conventions.md

## Commands
npm run dev   # Start dev server
npm run build # Production build
```

---

## Part 4: Concrete Examples

### Example 1: Minimal CLAUDE.md for a Next.js project

```markdown
# CLAUDE.md

## Commands
npm run dev       # localhost:3000
npm run build     # production build, check for type errors
npm run db:push   # sync schema → database (no migration files)

## Stack
- Next.js 14 App Router
- Drizzle ORM (NOT Prisma)
- Better Auth
- Database schema: src/db/schema.ts
- Auth config: src/lib/auth.ts

## Conventions
- Server components by default; add "use client" only when needed
- Never hardcode secrets; use environment variables from .env.local
- API routes go in src/app/api/[route]/route.ts
```

With this file, you never need to say "use Drizzle not Prisma" again — Claude Code already knows.

### Example 2: CLAUDE.md using @imports for a larger project

```markdown
# CLAUDE.md — Project Acme

## Quick Commands
npm run dev
npm run test
npm run lint

## Architecture
@docs/ARCHITECTURE.md

## API Design Guidelines
@docs/api-conventions.md

## Security Rules
Never log request bodies containing passwords or tokens.
Always validate user input using the Zod schemas in src/schemas/.
```

When Claude Code reads this file, it automatically pulls in the content of `ARCHITECTURE.md` and `api-conventions.md` — no manual pasting required.

---

## Part 5: When to Use (3 Scenarios)

**Scenario 1: Project uses non-mainstream conventions**
You use Bun instead of Node, Drizzle instead of Prisma, or Better Auth instead of NextAuth. Each tool has different syntax and patterns. CLAUDE.md tells Claude Code which tool is in use so it doesn't suggest the wrong one.

**Scenario 2: Monorepo or multi-module project**
Each subdirectory can have its own CLAUDE.md. `apps/web/` might have different rules than `packages/shared/`. Claude Code reads the CLAUDE.md corresponding to the directory you're working in.

**Scenario 3: Onboarding a new team member**
Instead of documenting architecture in Notion and hoping people find it, you put the essential information in CLAUDE.md. A new developer clones the repo, runs `claude`, and Claude Code already knows the project context — they can ask informed questions immediately.

---

## Part 6: When NOT to Use

**Anti-pattern 1: Using CLAUDE.md to document the entire codebase**
CLAUDE.md enters the context window of every session. If you stuff 5000 words in there, you burn tokens on every message and may push important information outside the model's effective attention zone (see: Attention — Lost in the Middle). Instead: use `@import` to lazy-load detailed files only when needed.

**Anti-pattern 2: Storing secrets or credentials in CLAUDE.md**
CLAUDE.md is committed to git and shared with the whole team. Never put API keys, passwords, or any sensitive information in this file. Use `.env` and add it to `.gitignore`.

**Anti-pattern 3: Writing conflicting instructions**
If global `~/.claude/CLAUDE.md` and project CLAUDE.md have conflicting rules (e.g., global says "use tabs", project says "use spaces"), Claude Code sees both and may behave inconsistently. Keep global CLAUDE.md for personal preferences (model, tone) and project CLAUDE.md for project-specific conventions only.

---

## Part 7: Gotchas & Pitfalls

**Pitfall 1: File too long reduces attention quality**
CLAUDE.md content sits at the start of the context. If the file is too long (>500 lines), the bottom sections may get "de-prioritized" by the model's attention mechanism. Detection: add an important rule at the very end, then test whether Claude Code actually follows it. Fix: use `@import` to split content; keep only the most critical information in the body of CLAUDE.md itself.

**Pitfall 2: CLAUDE.md not read because of wrong placement**
Claude Code looks for CLAUDE.md at the project root (where `.git` lives). If you place the file at `src/CLAUDE.md` and don't run claude from `src/`, the file won't be read. Fix: always place the file at the project root, or use subdirectory CLAUDE.md files and run claude from the correct directory.

**Pitfall 3: Forgetting to update CLAUDE.md when stack changes**
You migrate from Prisma to Drizzle but forget to update CLAUDE.md. Claude Code keeps suggesting Prisma patterns. Detection: notice during code review that Claude Code recommended the wrong tool. Fix: treat CLAUDE.md like any other file that must be updated in PRs that change the stack or conventions.

**Pitfall 4: Using CLAUDE.md instead of explaining directly in chat**
CLAUDE.md is for stable information that applies long-term. If you're debugging a temporary issue, explain it in chat instead of adding it to CLAUDE.md — otherwise the file accumulates stale, no-longer-relevant information over time.

---

## Part 8: Connections to Other Keywords

→ **Context Window** (covered): CLAUDE.md is injected at the start of every session's context window. The longer the file, the more tokens it consumes from your available context.

→ **System Prompt vs User Prompt** (covered): CLAUDE.md plays the same role as a system prompt — it shapes model behavior before any user message arrives. The difference: no code required to inject it, it's automatic from a file.

→ **Agent Loop** (covered): When Claude Code runs in agentic mode (autonomously executing multiple steps), CLAUDE.md provides constraints that prevent the agent from doing dangerous things (e.g., "never run production migrations directly").

→ **In-context Learning** (covered): You can put examples and patterns into CLAUDE.md to guide how Claude Code writes code according to the project's style — this is in-context learning in persistent form.

→ **Hooks** (coming up): Claude Code supports hooks — commands that run automatically after each tool call. Hooks are configured in settings, but are typically documented in CLAUDE.md so the team knows those behaviors exist.

---

## Part 9: Self-Test (5 Open Questions)

**Q1**: Explain CLAUDE.md in your own words. When is it read, by what, and why is it different from pasting context into chat?

**Q2**: You're starting a SaaS project using Supabase, tRPC, and Zod validation. Write out 5 things you'd put in CLAUDE.md and explain why each one belongs there.

**Q3**: Your colleague proposes writing the full database ERD (200 tables) into CLAUDE.md so Claude Code understands the schema. How would you push back, and what alternative would you suggest?

**Q4**: Compare CLAUDE.md to a System Prompt in the Anthropic API. What are the similarities and differences? When would you use one over the other?

**Q5**: If a project has both `~/.claude/CLAUDE.md` (global) and `./CLAUDE.md` (project), and the two files have conflicting rules, what happens? How would you design both files to prevent conflicts?

---

## Part 10: Exercise (24h Challenge)

**Task**: Create a CLAUDE.md for one of your real projects (or a fresh Next.js sample project).

**Steps**:
1. Start a new Next.js project with `npx create-next-app@latest`
2. Create `CLAUDE.md` at the project root with at least 4 sections: Commands, Stack, File Locations, Conventions
3. Open Claude Code, say nothing, just ask: "What ORM does this project use?" — verify that Claude Code answers correctly
4. Add one intentionally wrong rule at the bottom of the file (e.g., "Always use callbacks, never async/await"), then ask Claude Code about it to test whether the full file is being read
5. Commit `CLAUDE.md` to git and verify the file contains no credentials

**Estimated time**: 30–45 minutes

**Acceptance criteria**:
- Claude Code answers correctly about the stack without you explaining anything
- File stays under 100 lines (focused, not bloated)
- No hardcoded secrets in the file
- File is committed to git

---

## Self-Test Answers (read after answering on your own)

**Q1**: CLAUDE.md is a markdown file that Claude Code reads automatically when starting a session in a project. No code, no manual pasting — Claude Code looks for it in priority order (global → project → subdir) and injects it into the context. Different from pasting into chat because: it's persistent across all sessions, version-controlled in git, and shareable with the whole team.

**Q2**: Should include: (1) commonly used commands (`npm run dev`, database sync command), (2) ORM/auth library names with file paths for their config, (3) file structure conventions (router paths, schema location), (4) important security rules (don't log request bodies, validate with Zod), (5) what NOT to do (don't manually create migrations, don't use Prisma).

**Q3**: A 200-table ERD is far too large to inject every session — it burns tokens and dilutes attention for everything else in the context. Alternative: CLAUDE.md should only reference the schema path (`Schema: src/db/schema.ts`) and use `@import` lazy-loading so Claude Code reads the schema file only when the specific task actually requires it.

**Q4**: Similarities: both shape model behavior before user messages arrive, and both apply throughout the conversation. Differences: the API System Prompt requires code to inject and isn't automatically version-controlled; CLAUDE.md is a file on disk, read automatically by the Claude Code CLI, needs no code, and is committed to git. Use System Prompt when building a product or API; use CLAUDE.md when using the Claude Code CLI to develop.

**Q5**: Claude Code reads both and merges them. If there's a conflict, the result is inconsistent — the model sees two contradictory instructions and may follow either one unpredictably. Design to prevent this: keep global CLAUDE.md for personal preferences unrelated to specific projects (e.g., "respond in Vietnamese", "prefer concise answers"); keep project CLAUDE.md for project-specific conventions. Never let both levels address the same topic.
