---
description: Self-review a written blog post, provide critique and suggestions
argument-hint: [path-to-blog-file]
---

# /blog-review Command

User wants to review post: **$ARGUMENTS**

## Workflow

1. Read the blog file at the path provided by the user
2. Load `.claude/skills/blog-writer/CHECKLIST.md`
3. Check each item in the checklist against the actual post
4. Produce a report in the format:

```
# Review Report: <filename>

## ✅ Passed
- [Checklist items that pass]

## ⚠️ Needs improvement
- [Items with issues] → Specific suggestion

## ❌ Failed
- [Failed items] → Must fix

## Verdict
[PASS | NEEDS_REVISION | FAIL]

## Top 3 priority fixes
1. ...
2. ...
3. ...
```

5. DO NOT auto-fix the file. Let the user decide.
