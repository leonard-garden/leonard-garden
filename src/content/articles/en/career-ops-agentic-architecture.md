---
type: 'article'
title: 'Career-Ops: agentic design, AI role, and system architecture'
description: 'How an AI coding CLI job-search pipeline works: agents reading modes, evaluation flow, system vs user data layers, and scripts — based on open Career-Ops docs.'
locale: 'en'
translationKey: 'career-ops-agentic-architecture'
publishedAt: '2026-04-19'
pillar: 'ai'
tags: ['agentic', 'architecture', 'career-ops', 'claude-code']
readingTimeMinutes: 14
---

This article summarizes how **Career-Ops structures an “agentic” system** around an AI coding CLI (e.g. Claude Code): the agent reads in-repo instructions (**modes**), runs tools, produces **structured reports**, **PDFs**, and **tracker rows** — while you keep final say. It is based on public architecture docs; it is **not** hiring or legal advice.

**Open-source reference:** [Career-Ops on GitHub](https://github.com/santifer/career-ops).

## What “agentic” means here (and what it does not)

In Career-Ops, **agentic** does **not** mean “submit applications for you”. It roughly means:

- A **CLI agent** reads the **same instruction files** maintainers and users ship (`CLAUDE.md`, `modes/*.md`).
- The agent can call **tools** (browser, search, Node scripts) to **extract JDs**, **score fit**, **render PDFs**, **append tracker lines** — under **human-in-the-loop**: you review and decide.
- The design stresses **filtering and prioritization** (e.g. discouraging applications when fit/score is low), not spray-and-pray volume.

The point: **behavior is encoded** as **modes** and **scripted pipelines**, not a one-off prompt.

## AI’s role: structured reasoning, not raw keyword matching

Public docs describe matching your CV to a JD through **reasoning** (requirements, evidence, gaps, mitigations) rather than naive keyword counting. The implementation wraps that in **evaluation blocks** (e.g. A–G), **weighted dimensions**, and **archetype** selection so framing stays consistent.

In other words, the model acts as an **analysis + personalization layer** on top of inputs you provide (`cv.md`, profile, proof points), not a standalone ATS keyword scorer.

## High-level architecture

Architecture docs sketch four macro flows converging on an **output pipeline**, then a **canonical tracker**:

```text
        Claude Code Agent (reads CLAUDE.md + modes/*.md)
                    │
     ┌──────────────┼──────────────┐
     │              │              │
  Single eval    Portal         Batch
                 scan          parallel
     │              │              │
     └──────────────┼──────────────┘
                    ▼
     Report (.md) + PDF + TSV rows → merge → data/applications.md
```

- **Single offer:** paste URL/JD → extract → classify → evaluation blocks → score → report → PDF → tracker additions.
- **Scan:** read `portals.yml`, discover URLs, feed the pipeline inbox.
- **Batch:** parallel `claude -p` workers with self-contained prompts and resume state.

The **Go TUI dashboard** visualizes the same tracker data; it does not replace evaluation logic.

## Single-offer flow (systems view)

`docs/ARCHITECTURE.md` outlines: **input** → **extract** (Playwright/web) → **archetype** → **evaluate** (role summary, CV match, level strategy, comp, personalization plan, interview prep, etc.) → **score** → **report** under `reports/` → **PDF** via HTML template + renderer → **TSV** for **merge** into the tracker.

AI sits in **evaluation** and natural-language steps; **filenames**, **merge rules**, and **integrity checks** are enforced by conventions and scripts.

## Data contract: system vs user layer

A core design choice splits **system files** (safe to replace from upstream) from **personal data** (must never be touched by automated updates).

- **User layer:** `cv.md`, `config/profile.yml`, `modes/_profile.md`, `data/applications.md`, `data/pipeline.md`, `reports/`, etc.
- **System layer:** `modes/_shared.md`, mode specs, `*.mjs`, `templates/`, `CLAUDE.md`, etc.

Rule: upgrade tooling **must not** mutate the user layer. That lets you **pull upstream** without losing your tracker or CV.

## Batch and parallelism

The batch runner feeds a tabular input, spawns **N headless CLI workers**, each with a bundled prompt; outputs still go through **merge-tracker** and **verify**. This scales the same evaluation “brain” with a **resumable state machine** — useful when many URLs land in one session.

## Ethics and operations

Project docs stress: **no auto-submit**, avoid spamming candidates and recruiters, and PDF/CV optimization must stay **truthful** (rephrase with evidence; do not invent metrics). That is **policy** aligned with agentic design: automate **analysis and prep**, not **external actions**.

## Takeaways

Career-Ops is a useful **agentic-on-a-repo** case study: long-lived instructions in `modes`, orchestration via scripts, a strict **data contract** for safe updates, and AI as a **reasoning + personalization** layer rather than a keyword filter. If you are building similar plugins, three questions worth stealing are: **what files are ground truth for the agent**, **what fixed output shapes does the pipeline require**, and **what boundaries must automation never cross**.
