---
description: Publish a blog post from blogs/ to src/content/articles/ for display on the website
argument-hint: [keyword-slug]
---

# /blog-publish Command

User wants to publish keyword: **$ARGUMENTS**

## Workflow

1. **Find source files** in `blogs/`:
   - Find files matching `*-<slug>-vi.md` and `*-<slug>-en.md`
   - If not found: report error, remind user to run `/blog <slug>` first

2. **Determine number and category** from filename (e.g. `01`, `12`, `25`)

3. **Read both files** VI and EN

4. **Create VI file** at `src/content/articles/vi/<slug>.md`:
   - Add Astro frontmatter at the top:
   ```yaml
   ---
   title: "<H1 of the VI post>"
   description: "<3-sentence TL;DR of the post>"
   locale: "vi"
   translationKey: "<slug>"
   publishedAt: <today's date YYYY-MM-DD>
   pillar: "ai"
   type: "article"
   draft: false
   ---
   ```
   - Append full VI post content (drop the H1 line since title is in frontmatter)

5. **Create EN file** at `src/content/articles/en/<slug>.md`:
   - Add Astro frontmatter at the top:
   ```yaml
   ---
   title: "<H1 of the EN post>"
   description: "<TL;DR of the EN post — 3 sentences>"
   locale: "en"
   translationKey: "<slug>"
   publishedAt: <today's date YYYY-MM-DD>
   pillar: "ai"
   type: "article"
   draft: false
   ---
   ```
   - Append full EN post content (drop the H1 line)

6. **Output to user**:
   - Paths to the 2 created files
   - Reminder: "Run `npm run dev` to preview on the website"
   - Reminder: "Check that hreflang and pillar links are correct"

## Rules

- `translationKey` for VI and EN MUST BE THE SAME (use `<slug>`)
- `pillar: "ai"` for all Claude Code / LLM engineering content
- If the target file already exists: ask user for confirmation before overwriting
- DO NOT modify post content, only add frontmatter and remove the opening H1
