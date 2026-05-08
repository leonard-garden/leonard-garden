---
title: "Determinism in LLMs"
description: "Determinism in an LLM means the model always returns the same result for the same input. LLMs are not deterministic by default due to random sampling and floating-point inconsistencies across different hardware. Even with temperature=0, outputs can still vary slightly between calls."
locale: "en"
translationKey: "determinism"
publishedAt: 2026-05-08
pillar: "ai"
type: "article"
draft: false
---

## TL;DR

**Determinism** in an LLM means the model always returns the same result for the same input. LLMs are not deterministic by default due to random sampling and floating-point inconsistencies across different hardware. Even with `temperature=0`, outputs can still vary slightly between calls.

---

## Part 1: The problem it solves

A QA team was writing a test suite for a summarization feature. They hard-coded the expected output: `assert response == "The article is about AI and the future."`. The test passed today. The next morning, same code, same prompt — the test failed because the model returned "The article discusses AI and its broader implications." Nothing in the codebase had changed. The team spent 3 hours debugging before realizing: LLMs are not deterministic.

The problem: developers accustomed to deterministic systems (database queries, REST APIs, pure functions) assume LLMs behave the same way. When that assumption is wrong, both the testing strategy and production monitoring break down.

---

## Part 2: Precise definition

**Determinism** is the property of a system that always produces the same output for the same input, regardless of when or where it runs. LLMs are *stochastic* by design — at each generation step, the model does not pick the highest-probability token but instead *samples* from a probability distribution.

Distinguishing from easily-confused concepts:

| Type | Meaning | Example |
|------|---------|---------|
| Deterministic | Same input → same output, always | `sorted([3,1,2])` → `[1,2,3]` |
| Stochastic | Same input → random output each time | LLM with temperature > 0 |
| Pseudo-deterministic | Reproducible with a fixed random seed | LLM with seed set (same hardware) |

LLMs are not databases. Never test LLM output with exact-match assertions.

---

## Part 3: How it works

### Why are LLMs stochastic?

At each generation step, the model computes a probability distribution over the entire vocabulary:

```
Input: "The sky is"
Logits: [blue=0.45, dark=0.20, clear=0.18, red=0.10, ...]

Temperature=0 (greedy):   picks "blue" (argmax) — mostly deterministic
Temperature=1.0 (sample): samples from distribution — stochastic
Temperature=2.0 (hot):    flattens distribution → more random
```

**Greedy decoding** (temperature=0): always picks the token with the highest logit.
**Sampling** (temperature>0): randomly samples according to the distribution — output varies every run.

### Sources of non-determinism

```
1. Temperature > 0
   └─ Random sampling → output changes every call

2. Floating-point operations
   ├─ GPU A: 0.4500001 × 0.3 = 0.13500003
   ├─ GPU B: 0.4500001 × 0.3 = 0.13500004
   └─ 1-bit difference → argmax may select a different token!

3. Parallel computation
   └─ a + b + c ≠ c + b + a at the last bit with floats →
      parallel accumulation order affects the result

4. Batching
   └─ Processing a prompt alone vs. in a batch → different
      float accumulation → different output even at temperature=0
```

### Parameters that affect randomness

| Parameter | Effect | Range |
|-----------|--------|-------|
| `temperature` | Scales logits before softmax | 0 (greedy) → ∞ (uniform) |
| `top_p` | Nucleus sampling — sample only from tokens summing to p% | (0, 1] |
| `top_k` | Sample only from the top k highest-probability tokens | ≥1 |
| `seed` | Pseudo-random seed (OpenAI supports it; Claude does not) | integer |

---

## Part 4: Concrete examples

### Example 1: How temperature affects output

```python
import anthropic

client = anthropic.Anthropic()
prompt = "Write a single word that describes the daytime sky."

# Run 3 times with temperature=0
for i in range(3):
    msg = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=10,
        temperature=0,
        messages=[{"role": "user", "content": prompt}],
    )
    print(f"t=0, run {i+1}: {msg.content[0].text.strip()}")
# t=0, run 1: Blue
# t=0, run 2: Blue
# t=0, run 3: Blue  ← highly consistent

# Run 3 times with temperature=1.0
for i in range(3):
    msg = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=10,
        temperature=1.0,
        messages=[{"role": "user", "content": prompt}],
    )
    print(f"t=1, run {i+1}: {msg.content[0].text.strip()}")
# t=1, run 1: Blue
# t=1, run 2: Vast
# t=1, run 3: Cerulean  ← varies every run
```

### Example 2: Testing LLM output correctly

```python
import re

def test_summarization(document: str):
    response = call_llm(document)

    # ❌ Wrong: exact match — this test will be flaky
    # assert response == "The article is about AI."

    # ✅ Correct: test structural properties
    assert 20 < len(response) < 300, f"Unusual length: {len(response)}"
    assert re.search(r"AI|artificial intelligence", response, re.IGNORECASE), \
        "Summary does not mention the main topic"

    # ✅ Better: use LLM-as-judge
    verdict = judge_llm(
        f"Does this summary accurately capture the main topic? "
        f"Answer YES or NO only.\n\nSummary: {response}"
    )
    assert verdict.strip().upper() == "YES"
```

---

## Part 5: When to use low temperature

### Scenario 1: Structured output extraction

When extracting JSON, code, or data with a specific format. `temperature=0` reduces the risk of the model inventing extra fields or producing a malformed format, keeping downstream parsing stable. One malformed JSON response is enough to crash a pipeline.

### Scenario 2: Factual Q&A against a known knowledge base

When the question has a single correct answer ("Which parameters does this API endpoint accept?", "What year was the company founded?"). Low temperature keeps the model grounded in the provided facts rather than creatively inventing details not present in the context.

### Scenario 3: CI/CD testing and automated evals

When running evals to detect regressions. `temperature=0` reduces sampling variance — score changes then reflect actual shifts in model or prompt behavior, not sampling noise.

---

## Part 6: When NOT to use low temperature

### Anti-pattern 1: Creative tasks with temperature=0

Writing ad copy, brainstorming ideas, generating story variations — these use cases need diversity. `temperature=0` produces repetitive, "safe" output. Identical results on every run is a bug, not a feature, when users want variety. Use `temperature=0.7–1.0`.

### Anti-pattern 2: Hard-coding expected output in tests

Setting `temperature=0` and then writing `assert response == "expected string"` is wrong. Floating-point operations and batching still introduce non-determinism. Instead: test structural properties (length, key terms, format) or use LLM-as-judge.

### Anti-pattern 3: Treating the `seed` parameter as a silver bullet

OpenAI's `seed` improves reproducibility, but only within the same model version — it is documented as "best-effort." After a model update, `seed` does not guarantee the same output. Do not build critical logic that depends on perfect LLM determinism via `seed`.

---

## Part 7: Gotchas & Pitfalls

### Gotcha 1: temperature=0 does not guarantee bit-for-bit identical output

Floating-point operations on GPUs are not associative. When a provider updates infrastructure, the computation order changes → different output despite `temperature=0`. Symptom: results are mostly the same but with ~1–5% unexplained variation. Fix: never use exact-match assertions for LLM output.

### Gotcha 2: Model aliases silently update

`claude-haiku-4-5` today and after an update share the same API name but may produce different output. Anthropic typically provides pinned version aliases (e.g., `claude-haiku-4-5-20251001`) for production stability. Pinning prevents silent behavior changes.

### Gotcha 3: Small prompt changes cause large output changes

Adding a period, reordering examples, or changing whitespace in the prompt all affect output. LLMs are extremely sensitive to prompt wording. The only mitigation is testing with multiple prompt variations.

### Gotcha 4: Non-determinism in evals creates false regression signals

If your eval does not account for variance, a score drop from 87% to 84% may be sampling noise, not a real regression. Run evals multiple times and average the results, or apply a statistical significance test before concluding there is a regression.

---

## Part 8: Connections to other keywords

→ **Token / Tokenization** (already covered, #01): Non-determinism occurs at the token level — the model selects the next token by sampling from a probability distribution over the entire vocabulary.

→ **Hallucination & Grounding** (already covered, #06): Higher temperature → more "creative" generation → more hallucinations. Low temperature reduces hallucination but does not eliminate it entirely.

→ **In-context learning** (already covered, #07): Adding few-shot examples shifts the output distribution — affecting both determinism and response quality.

→ **Eval basics** (coming up, #25): Determinism directly affects eval design — you must account for variance when measuring model performance; single-run results are unreliable.

→ **LLM-as-judge** (coming up, #26): Instead of exact-match assertions, use an LLM to evaluate semantic correctness — the correct testing approach for stochastic systems.

---

## Part 9: Self-test

**Q1**: Explain why LLMs are not deterministic by default. Name at least 2 distinct sources of non-determinism.

**Q2**: You need to write automated tests for a "summarize document" feature. Describe a correct testing strategy — what you should and should not assert.

**Q3**: When do you *want* LLM output to be non-deterministic? Give 2 concrete use cases and explain why diversity is desirable in each.

**Q4**: Compare `temperature=0` with the `seed` parameter (OpenAI). Which provides better reproducibility, and under what conditions? When are both insufficient?

**Q5**: LLM output in production suddenly changes despite no code changes. List at least 3 possible causes and how you would investigate each.

---

## Part 10: Exercise (24h challenge)

**Task**: Measure LLM output variance at different temperature settings, then compare two testing strategies.

**Acceptance criteria**:
1. Call the model with the same prompt 10 times at each level: temperature=0, 0.5, 1.0
2. Print for each level: the percentage of identical outputs (exact match), average length, and one example of the most divergent output
3. Confirm with numbers: temperature=0 produces fewer unique outputs than temperature=1.0
4. Write two test functions: `test_exact_match()` and `test_semantic_check()` — run each 5 times and record the pass/fail rate
5. Write a 2–3 sentence conclusion: which testing strategy is more stable and why

**Estimated time**: 30–45 minutes

**Hint**: Use `claude-haiku-4-5` with a short prompt ("Write one sentence describing spring.") to save tokens. `collections.Counter` makes counting unique outputs fast.

---

## Self-test Answers (read after answering on your own)

**Q1**: LLMs are stochastic because (1) sampling — at each step the model samples from a probability distribution rather than always picking the highest-probability token; (2) floating-point operations are not associative on GPUs — parallel accumulation order causes bit-level differences even without sampling; (3) batching — processing the same prompt alone vs. in a batch produces small numerical differences.

**Q2**: Correct strategy: assert structural properties (reasonable length, key topics mentioned, correct format). Use LLM-as-judge for semantic correctness with a Yes/No question. Do not use: `assert response == "expected"` or compare against a fixed snapshot.

**Q3**: (1) Brainstorming marketing ideas — the user wants 5 distinct ideas, not the same idea 5 times; (2) Generating story variations for A/B testing — diversity in phrasing is needed to find which version resonates with users. In both cases, diversity is the value proposition, not a bug.

**Q4**: `temperature=0` is simpler to use, available on all APIs, and reduces variance substantially for practical purposes. `seed` (OpenAI) gives stronger short-term reproducibility but is "best-effort" and does not hold across model version updates. Both are insufficient when: a model version updates, the provider changes infrastructure, or you need a 100% identical output guarantee — no LLM can reliably provide that.

**Q5**: Possible causes: (1) Model version update — provider updated the model under the same alias; investigate by logging the model version from the API response metadata. (2) Invisible prompt changes — encoding issues, whitespace, or hidden characters; check with `repr(prompt)`. (3) Provider infrastructure change — different GPU batch strategy; hard to detect externally, but identifiable by ruling out the others. (4) Input data change — longer documents, different tokenization; log input lengths. (5) Parameter drift — temperature or other settings accidentally overridden somewhere in the call stack; audit the config.
