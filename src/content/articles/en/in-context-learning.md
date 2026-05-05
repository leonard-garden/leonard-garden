---
title: "In-context Learning — Teach by Example, No Training Required"
description: "In-context learning is the ability of an LLM to perform new tasks by reading examples in the prompt — no fine-tuning, no weight updates. You provide 2–5 input→output pairs, the model detects the pattern, and applies it to a new input. This is the foundation of few-shot prompting and why prompt engineering can replace training in many situations."
locale: "en"
translationKey: "in-context-learning"
publishedAt: 2026-05-05
pillar: "ai"
type: "article"
draft: false
---

## TL;DR

**In-context learning** is the ability of an LLM to perform new tasks by reading examples in the prompt — no fine-tuning, no weight updates. You provide 2–5 input→output pairs, the model detects the pattern, and applies it to a new input. This is the foundation of few-shot prompting and why prompt engineering can replace training in many situations.

---

## 1. The problem it solves

In 2022, a developer needed to classify support emails into 4 categories: billing, technical, refund, other. The internal dataset had only 80 samples — not enough to fine-tune. Hiring annotators would take two weeks.

The fix: put 4 examples in the prompt, one per category. Accuracy hit 87% — enough for an MVP. No training pipeline, no waiting.

Before ICL was well understood, every new task demanded: collect data, label it, fine-tune, deploy. ICL breaks that cycle — especially for tasks with clear input→output patterns.

---

## 2. Precise definition

**In-context learning (ICL)** is the mechanism by which an LLM adjusts its output based on examples provided directly in the context, without changing the model's parameters.

Comparison with similar concepts:

| Approach | Updates weights? | Labeled data needed? | Setup time |
|----------|------------------|----------------------|------------|
| ICL (few-shot) | ❌ | 2–10 examples | Minutes |
| Fine-tuning | ✅ | Hundreds–thousands | Hours–days |
| RAG | ❌ | No labeling | Retrieval setup |
| Zero-shot | ❌ | None | None |

Three variants by example count:
- **Zero-shot**: instruction only, no examples
- **One-shot**: 1 example
- **Few-shot**: 2–10 examples (most common, most effective)

---

## 3. How it works

ICL is not "learning" in the traditional sense. No gradients, no weight updates. The actual mechanism is attention:

```
Prompt structure:
┌─────────────────────────────────────┐
│ [Instruction] (optional)            │
│                                     │
│ Input:  <example_1_input>           │
│ Output: <example_1_output>          │
│                                     │
│ Input:  <example_2_input>           │
│ Output: <example_2_output>          │
│                                     │
│ Input:  <query_input>               │
│ Output: ← model fills this          │
└─────────────────────────────────────┘
```

During the forward pass, the transformer's attention mechanism reads the full context. When processing the first token of the final Output, it attends to all previous input→output pairs and infers the pattern.

Step by step:
1. The full prompt is encoded as a token sequence
2. Transformer layers compute attention between the query position and example positions
3. At the final Output position, the model has inferred: "input of type X → output of type Y"
4. Output is generated following that pattern

One key point: the model does not remember examples after the conversation ends. Each request is stateless.

---

## 4. Concrete examples

### Example 1: Sentiment classification

```python
prompt = """
Classify the sentiment of the following reviews.

Review: "The food was amazing, will come back!"
Sentiment: positive

Review: "Waited 45 minutes, cold food."
Sentiment: negative

Review: "Standard service, nothing special."
Sentiment: neutral

Review: "Best coffee in town, highly recommend!"
Sentiment:"""

# Model output: positive
```

Three examples are enough for the model to understand the format and task.

### Example 2: Structured data extraction

```python
prompt = """
Extract invoice information into JSON.

Invoice: "March 15, 2024. 2 desks at $150/each. Total: $300"
JSON: {"date": "2024-03-15", "items": [{"name": "desk", "qty": 2, "unit_price": 150}], "total": 300}

Invoice: "April 2, 2024. 5 office chairs @ $80. Total $400"
JSON: {"date": "2024-04-02", "items": [{"name": "office chair", "qty": 5, "unit_price": 80}], "total": 400}

Invoice: "May 10, 2024. 1 laptop $2500 and 2 mice at $30 each. Total $2560"
JSON:"""

# Model output: {"date": "2024-05-10", "items": [{"name": "laptop", "qty": 1, "unit_price": 2500}, {"name": "mouse", "qty": 2, "unit_price": 30}], "total": 2560}
```

The model learns the schema from 2 examples and handles the more complex case (2 items) correctly.

---

## 5. When to use

**Scenario 1: New task, scarce data**
You need to classify support tickets by your company's internal taxonomy. No training data exists. Put 3–5 examples in the prompt and you're running immediately.

**Scenario 2: Fast prototyping**
You want to test whether an NLP task is viable before investing in fine-tuning. ICL gives you results in minutes — enough to validate the approach.

**Scenario 3: Consistent output format**
You need the model to return a specific format (JSON schema, markdown template). Two format examples anchor the model's output more reliably than a text description alone.

---

## 6. When NOT to use

**Anti-pattern 1: Task requires factual knowledge**
You want the model to know your company's internal processes. Ten examples won't help — the model needs knowledge, not pattern recognition. Use RAG or fine-tuning instead.

**Anti-pattern 2: High-volume, expensive context**
Each request carries 10 examples (1,500 tokens). At 100,000 requests/day, you're paying for 150M example tokens daily. Fine-tuning or prompt caching handles this better.

**Anti-pattern 3: Multi-step reasoning tasks**
Plain ICL is weak on complex logic chains. Few-shot + Chain of Thought — adding reasoning steps to each example — is significantly more effective.

---

## 7. Gotchas & Pitfalls

**Gotcha 1: Example order affects output**
Examples placed last (closest to the query) have more influence than earlier ones. If the model is biased toward one class, shuffle the example order and test again.

How to detect: run the same query with different example orderings. If output changes, you have recency bias.

**Gotcha 2: The model learns format, not label semantics**
A well-known study (Min et al., 2022) showed that randomly flipping labels in examples (marking a negative review as "positive") barely degraded performance. The model learns from input distribution and format, not the label→meaning mapping.

Practical implication: wrong labels sometimes don't destroy output — but it also means the model may not deeply "understand" your labels.

**Gotcha 3: Quality beats quantity**
3 diverse examples outperform 10 similar ones. If all examples are edge cases, the model treats edge cases as the norm.

**Gotcha 4: ICL does not persist**
Every API call is stateless. If you want the model to "remember" how to do a task across conversations, you must include examples every time — or use fine-tuning.

---

## 8. Connections to other keywords

→ **Context window** (covered): ICL is bounded by the context window. More examples = more tokens spent. This is the core trade-off.

→ **System vs User prompt** (covered): ICL examples live in the system prompt (if stable) or user prompt (if dynamic). Location affects prompt caching efficiency.

→ **Chain of Thought** (coming up): Few-shot CoT combines ICL with explicit reasoning steps in each example, enabling multi-step problem solving.

→ **Hallucination & Grounding** (coming up): ICL teaches format and pattern — it does not ground the model in facts. Don't confuse ICL with a hallucination reduction strategy.

→ **Fine-tuning** (outside this series): ICL is the alternative to fine-tuning when data is scarce. When ICL hits a performance ceiling, fine-tuning is the next step.

---

## 9. Self-test (5 open questions)

**Q1**: Explain in-context learning in your own words — without using "few-shot" or "prompt". What mechanism makes it work?

**Q2**: You need to classify PR descriptions into one of 4 types: feature, bugfix, refactor, docs. How would you design the ICL prompt? How many examples, and which ones would you pick?

**Q3**: Name two scenarios where ICL will fail even with 10 perfect examples.

**Q4**: Compare ICL with fine-tuning: when is fine-tuning the only reasonable choice, even though ICL seems more convenient?

**Q5**: If token pricing drops 10x over the next two years, how does that shift the ICL vs fine-tuning decision?

---

## 10. Exercise (24h challenge)

**Task**: Build a classifier that labels GitHub issues as one of: bug, feature request, question.

**Steps**:
1. Grab 10 real GitHub issues from a repo you know (e.g., vscode, react, or your own)
2. Write an ICL prompt with 3 examples — one per category
3. Run the remaining 7 issues through the prompt
4. Compare results against your own labels

**Acceptance criteria**:
- [ ] Prompt contains exactly 3 examples, one per category
- [ ] Accuracy ≥ 70% on 7 test issues
- [ ] Shuffle example order and record whether output changes
- [ ] Add 3 more examples (6 total) — does accuracy improve?
- [ ] Write 2 sentences: where ICL fits / doesn't fit your current work

**Time**: 45–60 minutes

---

## Self-test Answers (read after answering on your own)

**Q1**: ICL works because the transformer's attention mechanism reads the full context. When processing the final output position, the model attends to all previous input→output pairs and infers the pattern. No weight update — just a forward pass with a longer context.

**Q2**: 4 examples (one per category), picking "archetypal" ones — the clearest representative of each type, not edge cases. Arrange in round-robin order to avoid recency bias toward any single category.

**Q3**: (1) Tasks requiring factual knowledge not in the model's training data — e.g., internal company procedures. (2) Tasks requiring multi-step reasoning that a simple input→output example cannot demonstrate.

**Q4**: Fine-tuning is the only reasonable choice when: (1) you need consistent behavior at scale with a cost constraint, (2) the model needs to learn a style, voice, or terminology that requires thousands of examples exceeding the context window.

**Q5**: If tokens are 10x cheaper, ICL becomes more competitive since the cost disadvantage (paying for example tokens on every request) shrinks. Fine-tuning still wins on latency (shorter prompts) and consistency.
