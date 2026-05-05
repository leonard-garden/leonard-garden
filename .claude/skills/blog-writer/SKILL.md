---
name: blog-writer
description: Write a deep-learning blog post for a Claude Code/LLM engineering keyword using a 10-part template. Use when the user types /blog or requests structured learning documentation, not generic articles.
---

# Skill: Blog Writer

## When this skill is active
- User types `/blog [keyword]`
- User explicitly requests "write a deep-learning blog post about X"

## Do NOT use this skill when
- User just wants a quick explanation (reply inline)
- User wants a casual write-up without structure

## Required workflow

### Step 1: Load context
Read the following files in the skill folder:
- `TEMPLATE.md` — 10-part structure
- `STYLE_GUIDE.md` — tone and format rules
- `CHECKLIST.md` — self-check before output

### Step 2: Research keyword (if needed)
- Basic LLM concepts: use existing knowledge
- Claude Code-specific (MCP, hooks, skills...): web search docs.anthropic.com to verify
- Specific numbers (pricing, versions, limits): MUST verify

### Step 3: Write post following TEMPLATE
- Follow the EXACT 10-part structure
- Follow STYLE_GUIDE
- Every example must have real, runnable code/config

### Step 4: Self-check against CHECKLIST
- Go through every checklist item
- If any item fails → revise, do not output

### Step 5: Output
- Save to the path specified by the command
- Update progress.md
- Report to user

## HARD rules (never violate)

1. **DO NOT fabricate**. Unsure about a number → search or say "not certain"
2. **DO NOT add fluff**. Every sentence must carry information
3. **DO NOT skip "When NOT to use"** — this tests mastery
4. **DO NOT skip "Gotchas"** — this is the real-world value of the post
5. **DO NOT place self-test answers in the middle** — they must go at THE VERY END
6. **DO NOT exceed 1800 words**
7. **DO NOT use clichéd phrases** listed in STYLE_GUIDE

## When the keyword is unclear
ASK the user instead of guessing:
- "This keyword isn't in the roadmap. Which category should it go in?"
- "I can't find reliable info about X. Do you have a source?"
