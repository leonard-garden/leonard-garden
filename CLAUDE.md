# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (localhost:4321)
npm run build     # Production build → dist/
npm run preview   # Serve dist/ locally
```

No test suite configured. TypeScript checking is done through Astro's build pipeline.

## Architecture

**Astro 6 static site** — bilingual (VI/EN), SEO-first learning hub. No server-side runtime; all pages are statically generated.

### URL structure

```
/[locale]/                         → home (src/pages/[locale]/index.astro)
/[locale]/pillars/[pillar]/        → pillar hub (src/pages/[locale]/pillars/[pillar].astro)
/[locale]/articles/[slug]/         → article page (not yet built)
/[locale]/notes/[slug]/            → note page (not yet built)
```

Locales: `vi` (primary/default) and `en`. Defined in `src/site.config.ts → siteConfig.languages`.

### Content collections (`src/content.config.ts`)

Three Zod-validated collections loaded via Astro's glob loader:

| Collection | Base path | Type field |
|---|---|---|
| `articles` | `src/content/articles/` | `"article"` |
| `notes` | `src/content/notes/` | `"note"` |
| `pillars` | `src/content/pillars/` | — |

All content files must live at `src/content/<collection>/<locale>/<slug>.md`.

Shared frontmatter fields: `title`, `description`, `locale`, `translationKey`, `publishedAt`, `pillar` (enum: `ai | backend | kafka | banking | other`), `draft`.

The `slugFromId` helper used in pages strips the locale prefix from the collection entry ID: `id.replace(\`${locale}/\`, '')`.

### Site config (`src/site.config.ts`)

Central source of truth for `siteConfig` (name, baseUrl, languages, primaryLocale, social, analytics) and `fontStylesheetUrl`. Both are imported directly into `.astro` pages — **not** injected via Astro middleware or layouts.

### Styling

Plain CSS only — no Tailwind or CSS framework. Each page imports its own stylesheet:
- `src/styles/home.css` — home page
- `src/styles/pillar.css` — pillar hub
- `src/styles/blog-document.css` — article/note reading view
- `src/styles/tokens.css` — design tokens (CSS variables)

All color and spacing values come from CSS custom properties defined in `DESIGN.md § 3`. Always use token variables (`--bg`, `--fg`, `--accent`, etc.) — never hardcode colors.

### Bilingual patterns

- `hreflang` alternate links are injected as raw HTML strings via `<Fragment set:html={...} />` because Astro's JSX parser mishandles `hreflang` in expression context. Raw HTML strings use `hreflang`; JSX `<link>` attributes use `hrefLang` (camelCase).
- URL strings for `href`/`hreflang` are computed in the frontmatter script, never with nested template literals inside `{expression}` in markup.
- `siteConfig.primaryLocale` (`"vi"`) is used for `x-default` hreflang targets.

## Key constraints from DESIGN.md

- **One `<h1>` per page**; heading levels must not skip.
- Body font ≥ 16px; prose `max-width` ~65–75ch.
- Dark mode via `prefers-color-scheme: dark` using the same token set (inverted values).
- Semantic HTML: `<main>`, `<nav>`, `<article>`, `<section>` over generic `<div>`.
- No "AI slop" UI: no purple gradients, no random geometric blobs, no heavy shadows.
- `<html lang>` must match the route locale.

## Content workflow

Notes → Articles promotion path (see `content-architecture.md`):
1. Capture fast in Notes (`indexable: false` while rough).
2. Promote to Article once the topic crystallizes.
3. Pillar pages act as SEO hub pages; every article/note links back to its pillar.