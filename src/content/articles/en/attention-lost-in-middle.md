---
title: "Attention & Lost in the Middle — Why LLMs \"Forget\" the Middle"
description: "Attention is the mechanism that lets LLMs decide which parts of the context to focus on when generating each token. But with long contexts, models tend to recall information at the beginning and end better — information in the middle gets lost. Knowing this helps you structure prompts and RAG pipelines more effectively."
locale: "en"
translationKey: "attention-lost-in-middle"
publishedAt: 2026-05-04
pillar: "ai"
type: "article"
draft: false
---

## TL;DR

Attention is the mechanism that lets LLMs decide which parts of the context to focus on when generating each token. But with long contexts, models tend to recall information at the beginning and end better — information in the middle gets lost. Knowing this helps you structure prompts and RAG pipelines more effectively.

---

## 1. The Problem It Solves

A team building a technical support chatbot used RAG. They retrieved 10 relevant document chunks and fed all 10 into the context. The model answered correctly 70% of the time when the answer was in the first or last chunk — but only 40% when the answer was in chunk 5–6.

The underlying problem: neural networks need a mechanism to "attend" to the right parts of input rather than processing everything equally. Attention solves this — but imperfectly. And knowing *how* it's imperfect matters more than knowing it's imperfect.

---

## 2. Precise Definitions

**Attention** is the mechanism in Transformers that allows each token being generated to "look back" and evaluate the relevance of every other token in the context. This is why LLMs can understand long-range structure and cross-references between distant parts.

**Lost in the Middle** is a phenomenon documented in the paper *"Lost in the Middle: How Language Models Use Long Contexts"* (Liu et al., 2023): when relevant information is placed in the middle of a long context, models use it less effectively than when it's at the beginning or end.

Key distinctions:
- Attention ≠ Memory: Attention operates on the current context, not long-term storage
- Lost in the Middle ≠ Hallucination: The model doesn't fabricate — it overlooks middle context and answers with incomplete information
- Attention score ≠ Importance: High attention scores don't directly map to semantic importance

---

## 3. How It Works

Every token in the context has three vectors:

```
Query (Q): "What information am I looking for?"
Key   (K): "What kind of information can I provide?"
Value (V): "Here is my actual content"

Attention score of token A toward token B = softmax(Q_A · K_B / √d)
Output of token A = weighted sum of all V_i by attention scores
```

Each token aggregates information from the entire context, but prioritizes tokens with higher scores.

Three proposed reasons for Lost in the Middle (no complete consensus yet):

```
Primacy bias:    early tokens have less competition in training patterns
Recency bias:    late tokens are closer to output → less information decay
Middle context:  weak signal from both sides → more diffuse attention

Approximate performance by position (Liu et al., 2023):

  Start  ████████████████  ~85%
  End    ████████████░░░░  ~75%
  Middle ████████░░░░░░░░  ~55%

  (actual numbers vary by task and model)
```

---

## 4. Concrete Examples

**Example 1: Multi-document QA — position order matters directly**

```python
# Answer lives in doc3 — don't let it end up in the middle
docs = [doc1, doc2, doc3_with_answer, doc4, doc5]

# Bad ordering: key information buried in the middle
prompt_bad = f"{doc1}\n{doc2}\n{doc3_with_answer}\n{doc4}\n{doc5}\n\nQuestion: ..."

# Better ordering: most relevant information first
prompt_better = f"{doc3_with_answer}\n{doc1}\n{doc2}\n{doc4}\n{doc5}\n\nQuestion: ..."
```

In experiments, moving the most relevant context to the beginning significantly improves accuracy on long-context tasks.

**Example 2: RAG pipeline — ordering chunks by relevance score**

```python
def build_rag_prompt(question: str, retrieved_chunks: list) -> str:
    # Highest-relevance chunk → first position
    # Medium-relevance chunks → middle
    # Second-best chunk → last position (just before the question)
    sorted_by_score = sorted(retrieved_chunks, key=lambda c: c.score, reverse=True)

    if len(sorted_by_score) <= 2:
        ordered = sorted_by_score
    else:
        top = sorted_by_score[0]
        second_best = sorted_by_score[1]
        middle = sorted_by_score[2:]
        ordered = [top] + middle + [second_best]

    docs_text = "\n\n---\n\n".join(c.text for c in ordered)

    return f"""Reference documents:

{docs_text}

Question: {question}"""
```

---

## 5. When to Care

**Situation 1: RAG with many documents**

When retrieving 5+ chunks and injecting them into context, ordering matters. The highest-relevance chunk should be first or last — not buried in the middle.

**Situation 2: Long system prompts with multiple instructions**

System prompts over 2,000 tokens with many constraints and format rules — put the most critical constraints at the beginning and end of the system prompt. Secondary instructions go in the middle.

**Situation 3: Pasting multiple code files into context**

When debugging with multiple files, the file containing the bug or the most relevant one should be at the top of the prompt — not buried under less relevant files.

---

## 6. When Not to Worry

**Anti-pattern 1: Optimizing position for short contexts**

For contexts under 4,000 tokens, Lost in the Middle has minimal impact. Reorganizing a 200-token prompt is premature optimization.

**Anti-pattern 2: Shuffling documents and hoping the model "reads everything"**

No trick fully compensates for Lost in the Middle. If important information must go in the middle, the better solution is rechunking or reducing the number of documents.

**Anti-pattern 3: Dumping many documents and letting the model "decide"**

"Throw 10 docs in and let the model figure out what's relevant" performs worse than retrieving the 2–3 most relevant docs precisely. Retrieval precision matters more than volume.

---

## 7. Gotchas & Pitfalls

**Gotcha 1: Behavior varies by model version**

Claude 3.5 Sonnet includes improvements to mid-context recall compared to earlier versions. Don't assume test results on older models apply to newer ones — re-verify after upgrades.

**Gotcha 2: "Needle in a haystack" tests don't reflect real usage**

The classic benchmark hides one important sentence inside random text and tests retrieval. Real-world multi-document retrieval is far more complex — don't use this benchmark to draw conclusions about production performance.

**Gotcha 3: Lost in the Middle is worse for factual extraction**

The model drops the ball especially when it needs to extract precise facts (names, numbers, dates) from the middle of context. For summarization or reasoning tasks, degradation is milder since the model can draw partial credit from multiple positions.

**Gotcha 4: Visualizing attention weights isn't reliable for debugging**

Attention scores don't map 1-to-1 to "what the model is attending to." Multi-head attention and layer stacking complicate interpretation. Don't use attention visualization to debug individual predictions.

---

## 8. Connections to Other Keywords

→ **Context window** (covered): Context window is the hard limit on total tokens. Lost in the Middle is the quality limit *within* that window — two different constraints, both important.

→ **Token & Tokenization** (covered): Attention scores are computed at the token level. A token's position in context determines how much primacy or recency bias affects it.

→ **RAG** (upcoming): RAG injects retrieved documents into context — good RAG design must account for Lost in the Middle when ordering chunks.

→ **Prompt caching** (upcoming): Cache prefix requires static content (system instructions) at the beginning — naturally aligned with the "important content first" best practice.

→ **Hallucination** (upcoming): Lost in the Middle causes a specific pseudo-hallucination pattern — the model doesn't fabricate but omits middle context, then fills the gap with prior knowledge.

---

## 9. Self-test

Answer **without looking back**, write your answers before checking:

**Q1:** Explain Attention to a non-technical person. Why does an LLM need this mechanism instead of reading input left-to-right like a human reader?

**Q2:** You have a prompt with: system instructions (500 tokens) + 8 retrieved documents (~300 tokens each) + user question (50 tokens). The most relevant document is document #4. How would you reorder them?

**Q3:** When is Lost in the Middle not worth worrying about, and why?

**Q4:** Distinguish Lost in the Middle from Hallucination. How are they different? Can they happen simultaneously?

**Q5:** If the next generation of models eliminated primacy/recency bias entirely, what would change about how you design a RAG system?

---

## 10. 24-Hour Challenge

**Task:** Test Lost in the Middle on a real use case of yours.

**Description:** Take a task you regularly use LLMs for with multiple sources — document Q&A, multi-file code review, summarizing multiple articles — and test how document position affects output.

**Steps:**
1. Pick a task with at least 3 documents or files
2. Run with the original ordering — record the output
3. Move the most important information to the top — run again
4. Move it to the bottom — run again
5. Compare all 3 outputs on quality, accuracy, and completeness

**Acceptance criteria:**
- [ ] 3 outputs from 3 different orderings
- [ ] Can explain concretely which output is better and why
- [ ] Record 1 specific insight about how you'll change your prompt workflow
- [ ] If no difference is observed — explain why (context too short? task not position-sensitive?)

**Estimated time:** 30–45 minutes

---

## Self-test Answers (read after writing your own)

**Q1:** When you encounter the pronoun "it" mid-paragraph, you know what "it" refers to by reading both what came before and after. LLMs need to do the same: understand cross-references, logical structure, and relationships between distant parts — which don't follow linear reading order. Sequential left-to-right reading isn't enough for this.

**Q2:** Place document #4 immediately after the system instructions (first in the document block). If there's a second highly relevant document, place it at the end just before the question. The remaining 6 documents go in the middle. System instructions stay first — they're the anchor context for the entire conversation.

**Q3:** Short contexts (under 4,000 tokens) — the effect is minimal. Summarization or reasoning tasks — less degradation compared to factual extraction. Only 1–2 documents — there is no "middle" to lose.

**Q4:** Lost in the Middle: model reads context correctly but skips information in the middle → answer is incomplete or wrong due to missing data. Hallucination: model generates information not present in the context or training data. They can co-occur: model misses a fact in the middle of context, then fabricates a different fact to fill the gap.

**Q5:** Document ordering becomes less critical — no need for "best doc first" strategy. But relevance-based retrieval still matters to reduce noise and keep context short. The part that changes is the ordering logic in your RAG pipeline; the part that stays the same is retrieval precision.
