---
description: Write a deep-learning blog post for a keyword using the 10-part template
argument-hint: [keyword-slug]
---

# /blog Command

User wants to write a blog post for keyword: **$ARGUMENTS**

## Steps

0. **Git flow setup**:
   - Checkout develop and pull latest: `git checkout develop && git pull origin develop`
   - Create new branch: `git checkout -b feat/blog-<slug>`
   - Example: `feat/blog-attention-lost-in-middle`

1. **Load skill blog-writer**: Read `.claude/skills/blog-writer/SKILL.md` and follow all instructions there.

2. **Validate keyword**: Check `progress.md` to see if the keyword is in the roadmap. If not, ask user for confirmation before writing.

3. **Determine output path**:
   - Foundation (1-10): `blogs/00-foundation/`
   - Core (11-20): `blogs/01-claude-code-core/`
   - Workflow (21-30): `blogs/02-workflow-quality/`

4. **Write VI version** following TEMPLATE.md and STYLE_GUIDE.md. Self-check against CHECKLIST.md BEFORE saving.

5. **Save VI version**: `<folder>/<num>-<slug>-vi.md`

6. **Write EN version**: translate all content to English, keep the exact 10-part structure, keep technical terms in English. Tone: direct, same style. Self-check against CHECKLIST.md.

7. **Save EN version**: `<folder>/<num>-<slug>-en.md`

8. **Update `progress.md`**: mark "Written" column as ✅ for this keyword.

9. **Publish blog**: Run `/blog-publish <slug>` to create content files in `src/content/articles/`.

10. **Commit, push and create PR**:
    - Stage all files related to the blog post
    - Commit: `feat: add <keyword> blog post (VI + EN)`
    - Push branch: `git push origin feat/blog-<slug>`
    - Create PR into `develop` with title: `feat: blog - <keyword>`
    - PR body: summary of content, VI/EN word counts, keyword connections

11. **Output to user**:
    - Paths to 2 blog files (VI + EN)
    - Paths to 2 published content files
    - Word count per post
    - Link to the PR just created
    - Reminder: "Read with active learning checklist, do self-test WITHOUT looking at the post, complete the exercise within 24h"
