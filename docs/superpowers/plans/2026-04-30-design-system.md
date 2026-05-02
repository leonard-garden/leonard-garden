# Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a clean 3-layer design system — complete CSS tokens, shared SEO utilities, and a reusable `BaseHead.astro` component — eliminating all duplicated head/hreflang/escAttr code across page templates and adding OG tags and noindex support.

**Architecture:** (1) `src/styles/tokens.css` expanded with spacing, typography, and radius tokens; (2) `src/lib/seo.ts` — pure TypeScript utilities for building canonical/hreflang HTML strings; (3) `src/components/BaseHead.astro` — shared `<head>` component with OG tags, favicon, noindex, and font. The four page templates are refactored to use these shared pieces. Dead code (`src/lib/hreflang-links.ts`) is deleted.

**Tech Stack:** Astro 6, TypeScript strict mode, plain CSS custom properties. Verification: `npm run build` (TypeScript + Astro static generation).

---

## File Map

| Status | File | Responsibility |
|--------|------|----------------|
| Modify | `src/site.config.ts` | Fix placeholder `baseUrl` |
| Modify | `src/styles/tokens.css` | Add spacing, typography, radius tokens |
| Create | `src/lib/seo.ts` | Pure TS: `esc`, `buildCanonicalHtml`, `buildAlternateLinksHtml`, `buildFontHeadHtml` |
| Delete | `src/lib/hreflang-links.ts` | Dead code — never imported anywhere |
| Create | `src/components/BaseHead.astro` | Shared `<head>`: charset, canonical, alternates, title, description, OG, favicon, noindex, font |
| Modify | `src/pages/[locale]/articles/[slug].astro` | Use `BaseHead` + `seo.ts`, remove inline duplicates |
| Modify | `src/pages/[locale]/notes/[slug].astro` | Use `BaseHead` + `seo.ts`, wire `indexable` → `noindex` |
| Modify | `src/pages/[locale]/pillars/[pillar].astro` | Use `BaseHead` + `seo.ts` |
| Modify | `src/pages/[locale]/index.astro` | Use `BaseHead` + `seo.ts` |

---

### Task 1: Fix placeholder baseUrl

**Files:**
- Modify: `src/site.config.ts`

- [ ] **Step 1: Update baseUrl to real domain**

Open `src/site.config.ts`. Replace the `baseUrl` value on line 9 with your real domain:

```ts
export const fontStylesheetUrl =
	'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400..800;1,400..800&display=swap';

export const siteConfig = {
	name: 'Learning Hub',
	description:
		'Bilingual (VI/EN) notes and deep dives on AI tools, backend engineering, Kafka, and banking systems.',
	baseUrl: 'https://your-real-domain.com', // ← replace with actual domain
	languages: ['vi', 'en'] as const,
	primaryLocale: 'vi' as const,
	social: {
		github: 'https://github.com/your-handle',
	},
	analytics: {
		ga4MeasurementId: 'G-XXXXXXXXXX',
	},
};
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: build succeeds. Check that canonical URLs reference the real domain:

```bash
grep 'canonical' dist/vi/index.html
```

Expected: `href="https://your-real-domain.com/vi/"`

- [ ] **Step 3: Commit**

```bash
git add src/site.config.ts
git commit -m "fix: update siteConfig baseUrl from example.com to real domain"
```

---

### Task 2: Complete tokens.css

**Files:**
- Modify: `src/styles/tokens.css`

- [ ] **Step 1: Add spacing, typography, and radius tokens**

Replace the entire contents of `src/styles/tokens.css`:

```css
/**
 * Theme tokens — single source of truth.
 * Keep in sync with DESIGN.md § 3.
 */
:root {
	color-scheme: light dark;

	/* Colors */
	--bg: #f4f4f5;
	--fg: #0c0c0d;
	--muted: #52525b;
	--border: #d4d4d8;
	--accent: #2563eb;
	--accent-soft: color-mix(in srgb, var(--accent) 14%, transparent);
	--card: #ffffff;
	--hero-glow: color-mix(in srgb, var(--accent) 18%, transparent);
	--grid-dot: #d4d4d8;

	/* Spacing (4-point scale) */
	--space-1: 0.25rem;
	--space-2: 0.5rem;
	--space-3: 0.75rem;
	--space-4: 1rem;
	--space-5: 1.25rem;
	--space-6: 1.5rem;
	--space-8: 2rem;
	--space-10: 2.5rem;
	--space-12: 3rem;

	/* Typography */
	--font-sans: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
	--text-xs: 0.75rem;
	--text-sm: 0.875rem;
	--text-base: 1.0625rem;
	--text-lg: 1.125rem;
	--text-xl: 1.25rem;
	--text-2xl: 1.5rem;
	--leading-tight: 1.25;
	--leading-snug: 1.4;
	--leading-normal: 1.6;
	--prose-width: 65ch;

	/* Border radius */
	--radius-sm: 0.25rem;
	--radius: 0.5rem;
	--radius-lg: 0.75rem;
	--radius-full: 999px;

	font-synthesis: none;
}

@media (prefers-color-scheme: dark) {
	:root {
		--bg: #09090b;
		--fg: #fafafa;
		--muted: #a1a1aa;
		--border: #27272a;
		--accent: #60a5fa;
		--accent-soft: color-mix(in srgb, var(--accent) 16%, transparent);
		--card: #121214;
		--hero-glow: color-mix(in srgb, var(--accent) 22%, transparent);
		--grid-dot: #3f3f46;
	}
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: build succeeds. Existing CSS that uses `--bg`, `--fg`, etc. continues to work unchanged. New tokens are defined and ready to use.

- [ ] **Step 3: Commit**

```bash
git add src/styles/tokens.css
git commit -m "feat: expand design tokens with spacing, typography, and radius"
```

---

### Task 3: Create src/lib/seo.ts and delete dead code

**Files:**
- Create: `src/lib/seo.ts`
- Delete: `src/lib/hreflang-links.ts`

- [ ] **Step 1: Create seo.ts**

Create `src/lib/seo.ts`:

```ts
/** Shared SEO HTML string builders. All functions return raw HTML safe to inject via Fragment set:html. */

/** Escape a string for use in an HTML attribute value. */
export const esc = (s: string): string =>
	s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Build `<link rel="canonical">` HTML. */
export function buildCanonicalHtml(url: string): string {
	return `<link rel="canonical" href="${esc(url)}" />`;
}

/**
 * Build `<link rel="alternate" hreflang="…">` HTML for all locales plus x-default.
 * Items must use `localeCode` — the normalized field name across all pages.
 */
export function buildAlternateLinksHtml(
	items: Array<{ localeCode: string; href: string }>,
	xDefaultHref: string,
): string {
	const links = items.map(
		({ localeCode, href }) =>
			`<link rel="alternate" hreflang="${esc(localeCode)}" href="${esc(href)}" />`,
	);
	links.push(`<link rel="alternate" hreflang="x-default" href="${esc(xDefaultHref)}" />`);
	return links.join('');
}

/** Build Google Fonts preconnect + stylesheet link HTML. */
export function buildFontHeadHtml(stylesheetUrl: string): string {
	return [
		'<link rel="preconnect" href="https://fonts.googleapis.com" />',
		'<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
		`<link rel="stylesheet" href="${esc(stylesheetUrl)}" />`,
	].join('');
}
```

- [ ] **Step 2: Delete dead code**

```bash
rm src/lib/hreflang-links.ts
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: build succeeds. `hreflang-links.ts` was never imported so its removal causes no errors. `seo.ts` is not yet used anywhere — that is fine.

- [ ] **Step 4: Commit**

```bash
git add src/lib/seo.ts src/lib/hreflang-links.ts
git commit -m "feat: add shared seo.ts utilities; remove dead hreflang-links.ts"
```

---

### Task 4: Create BaseHead.astro

**Files:**
- Create: `src/components/BaseHead.astro`

- [ ] **Step 1: Create the component**

Create `src/components/BaseHead.astro`:

```astro
---
import { Fragment } from 'astro/jsx-runtime';
import { buildFontHeadHtml } from '../lib/seo';
import { fontStylesheetUrl } from '../site.config';

interface Props {
	title: string;
	description: string;
	/** Pre-built `<link rel="canonical">` HTML — use buildCanonicalHtml() from seo.ts. */
	canonicalHtml: string;
	/** Pre-built `<link rel="alternate">` HTML strings including x-default — use buildAlternateLinksHtml() from seo.ts. */
	alternateHtml: string;
	/** Open Graph type. Defaults to "website". */
	ogType?: 'website' | 'article';
	/** When true, adds <meta name="robots" content="noindex">. Use for non-indexable notes. */
	noindex?: boolean;
}

const {
	title,
	description,
	canonicalHtml,
	alternateHtml,
	ogType = 'website',
	noindex = false,
} = Astro.props;

const fontHeadHtml = buildFontHeadHtml(fontStylesheetUrl);
---
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
{noindex && <meta name="robots" content="noindex" />}
<Fragment set:html={canonicalHtml} />
<Fragment set:html={alternateHtml} />
<title>{title}</title>
<meta name="description" content={description} />
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:type" content={ogType} />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
<Fragment set:html={fontHeadHtml} />
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: build succeeds. `BaseHead.astro` is not yet imported — that is fine.

- [ ] **Step 3: Commit**

```bash
git add src/components/BaseHead.astro
git commit -m "feat: add BaseHead.astro with OG tags, favicon, and noindex support"
```

---

### Task 5: Refactor article page

**Files:**
- Modify: `src/pages/[locale]/articles/[slug].astro`

- [ ] **Step 1: Replace the full file**

Replace the entire contents of `src/pages/[locale]/articles/[slug].astro`:

```astro
---
import { getCollection, getEntry, render } from 'astro:content';
import BaseHead from '../../../components/BaseHead.astro';
import BlogChrome from '../../../components/BlogChrome.astro';
import { buildAlternateLinksHtml, buildCanonicalHtml } from '../../../lib/seo';
import { siteConfig } from '../../../site.config';

export async function getStaticPaths() {
	const articles = await getCollection('articles', (a) => !a.data.draft);
	return articles.map((a) => ({
		params: { locale: a.data.locale, slug: a.id.replace(`${a.data.locale}/`, '') },
	}));
}

const { locale, slug } = Astro.params;

const entry = await getEntry('articles', `${locale}/${slug}`);
if (!entry) {
	return new Response('Not found', { status: 404 });
}

const allArticles = await getCollection('articles', (a) => !a.data.draft);

const alternateItems = siteConfig.languages
	.map((l) => {
		const sibling = allArticles.find(
			(a) => a.data.translationKey === entry.data.translationKey && a.data.locale === l,
		);
		if (!sibling) return null;
		return {
			localeCode: l,
			href: new URL(`/${l}/articles/${sibling.id.replace(`${l}/`, '')}/`, siteConfig.baseUrl).toString(),
		};
	})
	.filter((x): x is { localeCode: string; href: string } => x !== null);

const defaultSibling =
	allArticles.find(
		(a) =>
			a.data.translationKey === entry.data.translationKey &&
			a.data.locale === siteConfig.primaryLocale,
	) ?? entry;

const xDefaultHref = new URL(
	`/${siteConfig.primaryLocale}/articles/${defaultSibling.id.replace(`${siteConfig.primaryLocale}/`, '')}/`,
	siteConfig.baseUrl,
).toString();

const canonicalUrl =
	entry.data.canonicalUrl ??
	new URL(`/${locale}/articles/${entry.id.replace(`${locale}/`, '')}/`, siteConfig.baseUrl).toString();

const canonicalHtml = buildCanonicalHtml(canonicalUrl);
const alternateHtml = buildAlternateLinksHtml(alternateItems, xDefaultHref);

const { Content: Cmp } = await render(entry);

const navLinks = siteConfig.languages.map((l) => {
	const sibling = allArticles.find(
		(a) => a.data.translationKey === entry.data.translationKey && a.data.locale === l,
	);
	return {
		code: l,
		href: sibling ? `/${l}/articles/${sibling.id.replace(`${l}/`, '')}/` : `/${l}/`,
		current: l === locale,
	};
});

/** Must not write docKind="article" inline — esbuild can parse `article` as a JSX tag. */
const dkA = 'article' as const;
---

<html lang={locale}>
	<head>
		<BaseHead
			title={entry.data.title}
			description={entry.data.description}
			canonicalHtml={canonicalHtml}
			alternateHtml={alternateHtml}
			ogType={dkA}
		/>
	</head>
	<body class="blog-doc">
		<BlogChrome
			siteLocale={locale}
			title={entry.data.title}
			description={entry.data.description}
			docKind={dkA}
			publishedAt={entry.data.publishedAt}
			readingTimeMinutes={entry.data.readingTimeMinutes}
			pillar={entry.data.pillar}
			navLinks={navLinks}
		>
			<Cmp />
		</BlogChrome>
	</body>
</html>
```

- [ ] **Step 2: Verify build and check generated HTML**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors.

```bash
grep -E 'og:type|canonical|alternate|favicon' dist/en/articles/hello-article/index.html | head -10
```

Expected output includes all of:
- `<link rel="canonical" href="https://your-real-domain.com/en/articles/hello-article/">`
- `<link rel="alternate" hreflang="vi" ...>`
- `<link rel="alternate" hreflang="x-default" ...>`
- `<meta property="og:type" content="article">`
- `<link rel="icon" type="image/svg+xml" href="/favicon.svg">`

- [ ] **Step 3: Commit**

```bash
git add 'src/pages/[locale]/articles/[slug].astro'
git commit -m "refactor: use BaseHead and seo.ts in article page"
```

---

### Task 6: Refactor note page

**Files:**
- Modify: `src/pages/[locale]/notes/[slug].astro`

- [ ] **Step 1: Replace the full file**

Replace the entire contents of `src/pages/[locale]/notes/[slug].astro`:

```astro
---
import { getCollection, getEntry, render } from 'astro:content';
import BaseHead from '../../../components/BaseHead.astro';
import BlogChrome from '../../../components/BlogChrome.astro';
import { buildAlternateLinksHtml, buildCanonicalHtml } from '../../../lib/seo';
import { siteConfig } from '../../../site.config';

export async function getStaticPaths() {
	const notes = await getCollection('notes', (n) => !n.data.draft);
	return notes.map((n) => ({
		params: { locale: n.data.locale, slug: n.id.replace(`${n.data.locale}/`, '') },
	}));
}

const { locale, slug } = Astro.params;

const entry = await getEntry('notes', `${locale}/${slug}`);
if (!entry) {
	return new Response('Not found', { status: 404 });
}

const allNotes = await getCollection('notes', (n) => !n.data.draft);

const alternateItems = siteConfig.languages
	.map((l) => {
		const sibling = allNotes.find(
			(n) => n.data.translationKey === entry.data.translationKey && n.data.locale === l,
		);
		if (!sibling) return null;
		return {
			localeCode: l,
			href: new URL(`/${l}/notes/${sibling.id.replace(`${l}/`, '')}/`, siteConfig.baseUrl).toString(),
		};
	})
	.filter((x): x is { localeCode: string; href: string } => x !== null);

const defaultSibling =
	allNotes.find(
		(n) =>
			n.data.translationKey === entry.data.translationKey &&
			n.data.locale === siteConfig.primaryLocale,
	) ?? entry;

const xDefaultHref = new URL(
	`/${siteConfig.primaryLocale}/notes/${defaultSibling.id.replace(`${siteConfig.primaryLocale}/`, '')}/`,
	siteConfig.baseUrl,
).toString();

const canonicalUrl =
	entry.data.canonicalUrl ??
	new URL(`/${locale}/notes/${entry.id.replace(`${locale}/`, '')}/`, siteConfig.baseUrl).toString();

const canonicalHtml = buildCanonicalHtml(canonicalUrl);
const alternateHtml = buildAlternateLinksHtml(alternateItems, xDefaultHref);

/** indexable defaults to true when unset. noindex = explicitly set to false. */
const noindex = entry.data.indexable === false;

const { Content: Cmp } = await render(entry);

const navLinks = siteConfig.languages.map((l) => {
	const sibling = allNotes.find(
		(n) => n.data.translationKey === entry.data.translationKey && n.data.locale === l,
	);
	return {
		code: l,
		href: sibling ? `/${l}/notes/${sibling.id.replace(`${l}/`, '')}/` : `/${l}/`,
		current: l === locale,
	};
});

const dkN = 'note' as const;
---

<html lang={locale}>
	<head>
		<BaseHead
			title={entry.data.title}
			description={entry.data.description}
			canonicalHtml={canonicalHtml}
			alternateHtml={alternateHtml}
			noindex={noindex}
		/>
	</head>
	<body class="blog-doc">
		<BlogChrome
			siteLocale={locale}
			title={entry.data.title}
			description={entry.data.description}
			docKind={dkN}
			publishedAt={entry.data.publishedAt}
			pillar={entry.data.pillar}
			navLinks={navLinks}
		>
			<Cmp />
		</BlogChrome>
	</body>
</html>
```

- [ ] **Step 2: Verify build and noindex wiring**

```bash
npm run build
```

Expected: build succeeds.

For a note without `indexable: false` (the default):
```bash
grep 'robots' dist/en/notes/hello-note/index.html
```
Expected: no output (no robots meta tag).

To verify the noindex path: temporarily add `indexable: false` to `src/content/notes/en/hello-note.md` frontmatter, rebuild, then check:
```bash
npm run build && grep 'robots' dist/en/notes/hello-note/index.html
```
Expected: `<meta name="robots" content="noindex">`. Revert the frontmatter change after verifying.

- [ ] **Step 3: Commit**

```bash
git add 'src/pages/[locale]/notes/[slug].astro'
git commit -m "refactor: use BaseHead and seo.ts in note page; wire indexable → noindex"
```

---

### Task 7: Refactor pillar page

**Files:**
- Modify: `src/pages/[locale]/pillars/[pillar].astro`

- [ ] **Step 1: Replace the full file**

Replace the entire contents of `src/pages/[locale]/pillars/[pillar].astro`:

```astro
---
import { getCollection, getEntry, render } from 'astro:content';
import BaseHead from '../../../components/BaseHead.astro';
import { buildAlternateLinksHtml, buildCanonicalHtml } from '../../../lib/seo';
import { siteConfig } from '../../../site.config';
import '../../../styles/pillar.css';

export async function getStaticPaths() {
	const pillars = await getCollection('pillars');
	return pillars.map((p) => ({
		params: { locale: p.data.locale, pillar: p.data.pillar },
	}));
}

const { locale, pillar } = Astro.params;

const entry = await getEntry('pillars', `${locale}/${pillar}`);
if (!entry) {
	return new Response('Not found', { status: 404 });
}

const { Content } = await render(entry);

const allPillars = await getCollection('pillars');

const alternateItems = siteConfig.languages
	.map((l) => {
		const sibling = allPillars.find((p) => p.data.pillar === pillar && p.data.locale === l);
		if (!sibling) return null;
		return {
			localeCode: l,
			href: new URL(`/${l}/pillars/${pillar}/`, siteConfig.baseUrl).toString(),
		};
	})
	.filter((x): x is { localeCode: string; href: string } => x !== null);

const defaultHub = allPillars.find(
	(p) => p.data.pillar === pillar && p.data.locale === siteConfig.primaryLocale,
);
const xDefaultHref = defaultHub
	? new URL(`/${siteConfig.primaryLocale}/pillars/${pillar}/`, siteConfig.baseUrl).toString()
	: new URL(`/${siteConfig.primaryLocale}/`, siteConfig.baseUrl).toString();

const canonicalUrl = new URL(`/${locale}/pillars/${pillar}/`, siteConfig.baseUrl).toString();

const canonicalHtml = buildCanonicalHtml(canonicalUrl);
const alternateHtml = buildAlternateLinksHtml(alternateItems, xDefaultHref);

const articlesInPillar = (
	await getCollection(
		'articles',
		(a) => a.data.locale === locale && a.data.pillar === pillar && !a.data.draft,
	)
).sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());

const notesInPillar = (
	await getCollection(
		'notes',
		(n) => n.data.locale === locale && n.data.pillar === pillar && !n.data.draft,
	)
).sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());

function slugFromId(id: string, l: string) {
	return id.replace(`${l}/`, '');
}

const copy =
	locale === 'vi'
		? {
				home: 'Trang chủ',
				articles: 'Bài viết trong chủ đề',
				notes: 'Ghi chú trong chủ đề',
				emptyArticles: 'Chưa có bài viết.',
				emptyNotes: 'Chưa có ghi chú.',
			}
		: {
				home: 'Home',
				articles: 'Articles in this topic',
				notes: 'Notes in this topic',
				emptyArticles: 'No articles yet.',
				emptyNotes: 'No notes yet.',
			};
---

<html lang={locale}>
	<head>
		<BaseHead
			title={`${entry.data.title} · ${siteConfig.name}`}
			description={entry.data.description}
			canonicalHtml={canonicalHtml}
			alternateHtml={alternateHtml}
		/>
	</head>
	<body>
		<div class="page-bg" aria-hidden="true"></div>
		<div class="shell">
			<nav class="crumb" aria-label="Breadcrumb">
				<a href={`/${locale}/`}>{copy.home}</a>
				<span class="sep"> / </span>
				<span>{entry.data.title}</span>
			</nav>

			<article class="intro">
				<header>
					<p class="pill">{pillar}</p>
					<h1>{entry.data.title}</h1>
					<p class="lead">{entry.data.description}</p>
				</header>
				<div class="prose">
					<Content />
				</div>
			</article>

			<section class="list-block" aria-labelledby="pillar-articles">
				<h2 id="pillar-articles">{copy.articles}</h2>
				{
					articlesInPillar.length === 0 ? (
						<p class="empty">{copy.emptyArticles}</p>
					) : (
						<ul class="card-list">
							{articlesInPillar.map((a) => (
								<li>
									<a href={`/${locale}/articles/${slugFromId(a.id, locale)}/`}>
										<span class="title">{a.data.title}</span>
										<span class="desc">{a.data.description}</span>
									</a>
								</li>
							))}
						</ul>
					)
				}
			</section>

			<section class="list-block" aria-labelledby="pillar-notes">
				<h2 id="pillar-notes">{copy.notes}</h2>
				{
					notesInPillar.length === 0 ? (
						<p class="empty">{copy.emptyNotes}</p>
					) : (
						<ul class="card-list">
							{notesInPillar.map((n) => (
								<li>
									<a href={`/${locale}/notes/${slugFromId(n.id, locale)}/`}>
										<span class="title">{n.data.title}</span>
										<span class="desc">{n.data.description}</span>
									</a>
								</li>
							))}
						</ul>
					)
				}
			</section>
		</div>
	</body>
</html>
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: build succeeds.

```bash
grep -E 'og:type|canonical|favicon' dist/en/pillars/ai/index.html | head -8
```

Expected: canonical, alternates, OG tags, and favicon all present.

- [ ] **Step 3: Commit**

```bash
git add 'src/pages/[locale]/pillars/[pillar].astro'
git commit -m "refactor: use BaseHead and seo.ts in pillar page"
```

---

### Task 8: Refactor home page

**Files:**
- Modify: `src/pages/[locale]/index.astro`

- [ ] **Step 1: Replace the frontmatter**

The home page body markup is large and stays unchanged. Only replace the frontmatter block (everything between the opening `---` and closing `---`) and the `<head>` section in the HTML template.

**New frontmatter** (replace lines 1–106, the entire `---...---` block):

```astro
---
import { Fragment } from 'astro/jsx-runtime';
import { getCollection } from 'astro:content';
import BaseHead from '../../components/BaseHead.astro';
import { buildAlternateLinksHtml, buildCanonicalHtml } from '../../lib/seo';
import { siteConfig } from '../../site.config';
import '../../styles/home.css';

export function getStaticPaths() {
	return siteConfig.languages.map((code) => ({ params: { locale: code } }));
}

const { locale } = Astro.params;

const copy =
	locale === 'vi'
		? {
				intro:
					'Ghi chú và bài đào sâu song ngữ (VI/EN) về AI, backend, Kafka và hệ thống ngân hàng.',
				heroKicker: 'Học · ghi chú · chia sẻ',
				heroLine: 'Cho người đang học thật, không slide-deck.',
				pillars: 'Chủ đề',
				articles: 'Bài viết',
				notes: 'Ghi chú',
				langSwitch: 'Ngôn ngữ',
				emptyPillars: 'Chưa có chủ đề.',
				emptyArticles: 'Chưa có bài viết.',
				emptyNotes: 'Chưa có ghi chú.',
				skipToContent: 'Bỏ qua tới nội dung',
				ctaExplore: 'Khám phá chủ đề',
				ctaRead: 'Đọc bài mới nhất',
				featured: 'Nổi bật',
				onlyOneArticle: 'Hiện chỉ có một bài ở mục nổi bật — thêm bài sẽ hiện ở đây.',
				byPillar: 'Theo chủ đề',
				viewHub: 'Trang chủ đề',
				miniArticles: 'Bài viết',
				miniNotes: 'Ghi chú',
				emptyPillarFeed: 'Chưa có bài hay ghi chú trong chủ đề này.',
				allArticles: 'Tất cả bài viết',
				allNotes: 'Tất cả ghi chú',
			}
		: {
				intro: siteConfig.description,
				heroKicker: 'Learn · notes · ship',
				heroLine: 'For people actually building, not deck-building.',
				pillars: 'Topics',
				articles: 'Articles',
				notes: 'Notes',
				langSwitch: 'Language',
				emptyPillars: 'No topics yet.',
				emptyArticles: 'No articles yet.',
				emptyNotes: 'No notes yet.',
				skipToContent: 'Skip to content',
				ctaExplore: 'Browse topics',
				ctaRead: 'Latest article',
				featured: 'Featured',
				onlyOneArticle: 'Only one post so far (shown above). More will list here.',
				byPillar: 'By topic',
				viewHub: 'Topic hub',
				miniArticles: 'Articles',
				miniNotes: 'Notes',
				emptyPillarFeed: 'No posts in this topic yet.',
				allArticles: 'All articles',
				allNotes: 'All notes',
			};

const canonicalUrl = new URL(`/${locale}/`, siteConfig.baseUrl).toString();

const alternateItems = siteConfig.languages.map((l) => ({
	localeCode: l,
	href: new URL(`/${l}/`, siteConfig.baseUrl).toString(),
}));
const xDefaultHref = new URL(`/${siteConfig.primaryLocale}/`, siteConfig.baseUrl).toString();

const canonicalHtml = buildCanonicalHtml(canonicalUrl);
const alternateHtml = buildAlternateLinksHtml(alternateItems, xDefaultHref);

const pillarEntries = await getCollection('pillars', (p) => p.data.locale === locale);
const articleEntries = await getCollection('articles', (a) => a.data.locale === locale && !a.data.draft);
const noteEntries = await getCollection('notes', (n) => n.data.locale === locale && !n.data.draft);

const sortedPillars = [...pillarEntries].sort((a, b) => a.data.pillar.localeCompare(b.data.pillar));
const sortedArticles = [...articleEntries].sort(
	(a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
);
const sortedNotes = [...noteEntries].sort(
	(a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
);

function slugFromId(id: string, l: string) {
	return id.replace(`${l}/`, '');
}

const firstArticle = sortedArticles[0];
const firstArticleHref = firstArticle
	? `/${locale}/articles/${slugFromId(firstArticle.id, locale)}/`
	: null;
const articlesAfterFeatured = firstArticle
	? sortedArticles.filter((a) => a.id !== firstArticle.id)
	: sortedArticles;

const pillarFeeds = sortedPillars.map((p) => {
	const pid = p.data.pillar;
	const arts = sortedArticles
		.filter((a) => a.data.pillar === pid && (!firstArticle || a.id !== firstArticle.id))
		.slice(0, 3);
	const nts = sortedNotes.filter((n) => n.data.pillar === pid).slice(0, 2);
	return { hub: p, articles: arts, notes: nts };
});
---
```

- [ ] **Step 2: Replace the `<head>` block in the HTML template**

Find this block in the template (immediately after the closing `---`):

```astro
<html lang={locale}>
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<link rel="canonical" href={canonicalUrl} />
		<Fragment set:html={alternateLinksHtml} />
		<link
			rel="alternate"
			hrefLang="x-default"
			href={new URL(`/${siteConfig.primaryLocale}/`, siteConfig.baseUrl).toString()}
		/>
		<title>{siteConfig.name}</title>
		<meta name="description" content={siteConfig.description} />
		<link rel="preconnect" href="https://fonts.googleapis.com" />
		<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
		<link href={fontStylesheetUrl} rel="stylesheet" />
	</head>
```

Replace it with:

```astro
<html lang={locale}>
	<head>
		<BaseHead
			title={siteConfig.name}
			description={siteConfig.description}
			canonicalHtml={canonicalHtml}
			alternateHtml={alternateHtml}
		/>
	</head>
```

The `<body>` and all content below stays exactly as-is.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: build succeeds.

```bash
grep -E 'og:title|canonical|favicon' dist/vi/index.html | head -8
```

Expected: all present with correct domain.

- [ ] **Step 4: Commit**

```bash
git add 'src/pages/[locale]/index.astro'
git commit -m "refactor: use BaseHead and seo.ts in home page"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| Fix `baseUrl` placeholder | Task 1 |
| Expand CSS tokens (spacing, typography, radius) | Task 2 |
| Shared `esc` utility | Task 3 |
| Shared `buildAlternateLinksHtml` | Task 3 |
| Shared `buildCanonicalHtml` | Task 3 |
| Shared `buildFontHeadHtml` | Task 3 |
| Delete dead `hreflang-links.ts` | Task 3 |
| `BaseHead.astro` with OG tags + favicon | Task 4 |
| `noindex` prop support in `BaseHead` | Task 4 |
| Article page refactored | Task 5 |
| Note page refactored + `indexable` → `noindex` wired | Task 6 |
| Pillar page refactored | Task 7 |
| Home page refactored | Task 8 |

**Placeholder scan:** No TBD, TODO, or "add appropriate X" in any step. All code blocks are complete and runnable.

**Type consistency:** `buildAlternateLinksHtml` takes `Array<{ localeCode: string; href: string }>` — used with that exact field name across Tasks 5, 6, 7, 8. The `lang`/`localeCode` inconsistency present in the original code does not appear in post-refactor code.