# Design system — Learning Hub

Single source of truth for **visual style**, **readability**, and **SEO-friendly structure**.  
Stack: **Astro** (static), bilingual **VI/EN**. Implement with plain CSS (variables + utility patterns) unless the project adds a CSS framework later.

---

## 1. Brand & tone

- **Positioning**: Personal learning hub — notes and deep dives, not a corporate product site.
- **Voice**: Direct, curious, slightly informal; **no hype** (“revolutionary”, “game-changer”).
- **Visual personality**: **Gen Z–adjacent** — confident, minimal, scannable; **not** cluttered dashboards, not generic “AI startup” gradients and abstract blobs unless they serve content.

---

## 2. Core principles

| Principle | Meaning |
|-----------|---------|
| **Content first** | Typography and spacing carry the page; decoration is optional and rare. |
| **Scannable** | Short blocks, clear headings, lists when they help; avoid walls of text. |
| **One accent** | One primary accent color + neutrals; avoid rainbow UI. |
| **Accessible by default** | Contrast, focus states, semantic HTML — helps SEO and real users. |
| **Dark mode** | Respect `prefers-color-scheme: dark` with the same tokens (inverted neutrals). |

---

## 3. Design tokens (CSS)

Use these names so pages stay consistent. **Current reference values** (adjust in one place when branding evolves):

```css
:root {
  color-scheme: light dark;
  --bg: #fafafa;
  --fg: #1a1a1a;
  --muted: #5c5c5c;
  --border: #e5e5e5;
  --accent: #2563eb; /* primary blue */
  --card: #ffffff;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f0f0f;
    --fg: #f5f5f5;
    --muted: #a3a3a3;
    --border: #2a2a2a;
    --accent: #60a5fa;
    --card: #171717;
  }
}
```

- **Accent usage**: links, focus ring, key CTAs — not large background fills.
- **Muted**: secondary text, metadata, captions.

---

## 4. Typography

- **Font stack**: `ui-sans-serif, system-ui, sans-serif` (no webfont required for MVP; add one later in `DESIGN.md` + `site.config` if needed).
- **Body**: `font-size` minimum **16px** (1rem); prefer **17–18px** on large screens for long reads.
- **Line height**: **1.5–1.65** for body; **1.2–1.3** for large headings.
- **Line length**: max **65–75ch** for article content (`max-width` on prose container).
- **Scale (approximate)**:
  - Page title: `1.5rem–1.75rem`, font-weight **700**
  - Section label (uppercase optional): `0.75rem`, letter-spacing slightly open
  - Body: `1rem`
  - Small/meta: `0.875rem`

---

## 5. Spacing & layout

- **Spacing scale**: `4 / 8 / 12 / 16 / 24 / 32 / 48` px (use consistently).
- **Page shell**: horizontal padding **≥ 1.25rem**; vertical rhythm between sections **2–2.5rem**.
- **Main content width**: **~40–42rem** (`672px`) for reading; full width OK for nav only.

---

## 6. Components (patterns)

- **Cards / lists**: bordered container, `border-radius: 0.5rem`, padding `0.75rem 1rem`; hover = border or accent subtle — no heavy shadows by default.
- **Links**: underline on hover or clear color `--accent`; **visible `:focus-visible`** outline (2px, accent).
- **Buttons** (if added): min height **44px** touch target; same focus treatment.

---

## 7. SEO & HTML (non-negotiable)

- **One `<h1>` per page** (per main document).
- **Heading order**: `h1` → `h2` → `h3` … no skipping levels for styling.
- **Landmarks**: `<main>`, `<nav>` where applicable; one `<header>` if used.
- **Language**: `<html lang="vi">` or `lang="en"` matching route.
- **Meta**: unique `<title>` and `meta name="description"` per page; align with `site.config` / frontmatter.
- **Canonical & hreflang**: follow existing patterns; bilingual alternates for equivalent pages.
- **Images**: meaningful `alt`; decorative `alt=""`.
- **Robots**: respect `noindex` for notes when `indexable: false`.

---

## 8. Astro implementation notes

- In `.astro` **templates**, use **`hrefLang`** (camelCase) on `<link>` when using JSX-style attributes — not `hreflang`, to avoid parser issues.
- Raw HTML strings (e.g. injected alternate links) use **`hreflang`** as in HTML.
- Avoid **nested template literals inside `{expression}`** in markup — compute URLs in frontmatter (`const url = ...`) then pass to template.
- Prefer **semantic tags** over generic `<div>` when it carries meaning (`<article>`, `<section>`, `<time>`).

---

## 9. Anti-patterns (avoid)

- **AI slop UI**: purple gradients on white, random geometric blobs, Inter-only + purple CTA everywhere.
- **Tiny text** (<14px) for main content on mobile.
- **Low contrast** gray-on-gray body text (especially in dark mode).
- **Fake headings**: styled `<p>` or `<div>` that look like titles — hurts SEO and accessibility.
- **Keyword stuffing** in titles or body for SEO.

---

## 10. When you change this file

Update **token values** here first, then sync any duplicated CSS (until a shared global stylesheet exists). Note major changes in `decisions.md` if they affect content or SEO.
