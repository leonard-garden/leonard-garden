# Content Architecture (Learning Hub)

This repository will power a bilingual (VI/EN) learning-focused website that is still organized like a real product: discoverable, SEO-friendly, and easy to maintain over time.

## Core Goal

- Write to learn (capture notes fast, iterate in public).
- Publish to share (clean information architecture, strong internal linking, and good technical SEO).
- Support multiple domains (AI tools, backend engineering, Kafka, banking/fintech, etc.) without becoming chaotic.

## Information Architecture (IA)

### Primary organization: Domain pillars

The site is organized primarily by **domain pillar pages** (SEO-friendly hubs), with individual posts linking back to their pillar.

Example pillars:

- AI
- Backend
- Kafka
- Banking

Each pillar page:

- Explains the scope and learning goals for the pillar
- Links to the best / canonical content within the pillar
- Acts as the top-level internal linking target for the cluster

### Language structure (bilingual)

- Maintain a clear VI/EN structure (e.g., `/vi/...` and `/en/...` or equivalent).
- Use `hreflang` between VI/EN versions of the same content.

## Content Types (recommended)

### Articles (canonical, deep, SEO-first)

**Articles** are the “finished” or “canonical” pieces that should represent your best thinking and be the primary SEO drivers.

Use Articles for:

- Architecture deep dives / teardowns (systems, repos, products)
- High-level design (HLD) + key subsystems + trade-offs
- End-to-end guides / playbooks
- Case studies and postmortems (learning artifacts with narrative)

Why Articles:

- They require narrative structure and careful linking, so they become durable references.
- They work well as “pillar” anchors and as link targets from smaller pages.

#### Example classification: “career-ops architecture”

A “career-ops” study that includes:

- High-level design & overall architecture
- Key components/modules
- How agentic systems share context
- How data is enriched / transformed
- Trade-offs and evolution

…should be an **Article** (an architecture teardown / deep dive).

### Notes / Working Notes (learning-first, fast capture)

**Notes** are lightweight learning captures created while reading, experimenting, or exploring a codebase. Notes can be public, but do not need to be “perfect”.

Use Notes for:

- Reading logs (what you found, what surprised you)
- Scratch diagrams and evolving hypotheses
- Extracted snippets, commands, links, questions
- “To explore next” lists

Recommended default template:

- Context (what are we trying to understand?)
- Key points (bullets)
- Commands / code snippets (only what matters)
- Pitfalls / edge cases (if known)
- References (links)
- Next steps

### Knowledge Base (KB) pages (optional, atomic concepts)

If you repeatedly encounter the same concept across many Articles, extract it into an **atomic KB page**.

KB pages are best for:

- Reusable concepts (e.g., “Agent context sharing patterns”, “Data enrichment pipelines”)
- Definitions + examples + pitfalls in one place

KB pages should always:

- Link back to the most relevant domain pillar
- Link to one or more Articles that use the concept

## Linking rules (how content connects)

- Every Article should link back to its domain pillar(s).
- Articles should link out to:
  - Notes that contain supporting exploration (optional)
  - KB pages for atomic concepts (optional)
- Notes and KB pages should link back to:
  - The relevant domain pillar
  - The canonical Article (if one exists)

## Indexing guidance (to avoid “SEO noise”)

- Articles: **index**
- Notes:
  - **index** only when they meet a quality threshold (summary + actionable info + references)
  - otherwise consider **noindex** while still being accessible
- KB pages: **index** (when they’re stable and genuinely reusable)

## Operating model (how content evolves)

- Start with Notes while learning.
- Promote the best Notes into an Article once the topic “crystallizes”.
- Extract repeating concepts into KB pages over time.

