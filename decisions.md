# Decisions

This file records key product/content/tech decisions for the **Learning Hub** website.

## 2026-04-18 — Build order + platform choice

### Decision

- **Execution approach**: **Parallel-light** — build a minimal MVP skeleton while also defining a minimal editorial system (tone + templates + workflow).
- **Platform**: **Astro + Markdown/MDX** for an SEO-first landing + blog/knowledge hub.
- **Analytics**: **GA4 + Google Search Console (GSC)**.
- **Bilingual**: maintain **VI/EN** structure with proper `hreflang`.
- **Writing agent**: **defer until** templates exist and there are **2+ human-written reference posts** to learn tone + structure.

### Rationale

- Parallel-light reduces risk of “building a site with no writing system” and also avoids “planning forever without publishing”.
- Astro provides strong performance and SEO defaults with lower complexity than a full app framework at the 0→1 stage.
- GA4 + GSC are sufficient to track both content performance and organic search growth.
- A writing agent will be more accurate after the editorial templates and a few real examples exist.

### Implications

- Start with a small set of pages (home/landing, domain pillars, article, note) and publish early.
- Promote high-quality Notes into Articles over time (see `content-architecture.md`).

