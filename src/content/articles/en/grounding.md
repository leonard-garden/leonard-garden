---
title: "Grounding: Forcing LLMs to Answer Based on Real Data"
description: "Grounding is the technique of forcing an LLM to base its answers on real documents rather than just its training data. RAG (Retrieval-Augmented Generation) is the most common approach: find relevant passages, inject them into context, and instruct the model to answer only from those. Done right, grounding eliminates factual hallucination and lets models work with up-to-date information."
locale: "en"
translationKey: "grounding"
publishedAt: 2026-05-05
pillar: "ai"
type: "article"
draft: false
---

## TL;DR

**Grounding** is the technique of forcing an LLM to base its answers on real documents rather than just its training data. RAG (Retrieval-Augmented Generation) is the most common approach: find relevant passages, inject them into context, and instruct the model to answer only from those. Done right, grounding eliminates factual hallucination and lets models work with up-to-date information.

---

## Part 1: The Problem It Solves

Minh is a backend dev at a fintech company. His manager asks him to build a chatbot answering questions about internal policies — documents updated every week. Minh fine-tunes GPT-4 on the initial document set. A month later, the chatbot still answers based on outdated policies. Customers receive wrong advice; the company loses credibility.

The problem isn't the model. LLMs don't self-update after training. The knowledge cutoff freezes everything at a point in time. For data that changes continuously, fine-tuning is the wrong solution from the start.

---

## Part 2: Precise Definition

**Grounding** is the process of providing an LLM with a specific set of source documents (*ground truth*) and requiring it to base its responses only on those documents. The model is not allowed to introduce information outside the provided sources.

Common points of confusion:

- **Fine-tuning**: bakes knowledge into model weights — fixed, can't update realtime, suited for style/behavior not facts
- **Hallucination** (covered earlier): when a model fabricates information — grounding is the technique that prevents this
- **Prompt engineering**: writing better instructions — grounding provides *real context*, not just guidance

RAG (Retrieval-Augmented Generation) is the most common implementation of grounding.

---

## Part 3: How It Works

The RAG pipeline has 5 steps:

```
User query
    │
    ▼
[Retriever] ──→ Vector DB / Search index
    │              (documents embedded beforehand)
    ▼
Top-K most relevant chunks
    │
    ▼
[Augment] ──→ System prompt + chunks + original query
    │
    ▼
[LLM] ──→ Answer grounded in retrieved chunks
    │
    ▼
[Citations] ──→ Model cites specific source passages
```

Step by step:

1. **Index**: Documents split into chunks, embedded into vectors, stored in a vector DB
2. **Retrieve**: Your query is embedded; top-K chunks with highest cosine similarity are fetched
3. **Augment**: Chunks are injected into the prompt with "answer only from this document" instruction
4. **Generate**: LLM produces an answer using only information from the chunks
5. **Cite**: Model references the exact passages it relied on

---

## Part 4: Concrete Examples

### Example 1: Basic grounding with XML tags (no vector DB needed)

```python
from anthropic import Anthropic

client = Anthropic()

document = """
[Leave Policy 2025]
- Full-time employees: 12 days/year
- Probationary employees: not applicable
- Maximum carryover: 5 days to the following year
"""

response = client.messages.create(
    model="claude-opus-4-5",
    max_tokens=1024,
    system=f"""You are an HR assistant. Answer only based on the document below:

<document>
{document}
</document>

If the question is not addressed in the document, state clearly: "This information is not in the policy."
""",
    messages=[{
        "role": "user",
        "content": "I'm on a 3-month probation. Am I entitled to leave days?"
    }]
)

print(response.content[0].text)
# Output: According to the 2025 Leave Policy, probationary employees are not
# entitled to leave days. This is stated explicitly: "Probationary employees:
# not applicable."
```

### Example 2: Anthropic's Citations API

Anthropic supports native citations via document blocks — the model automatically pinpoints the exact passage it relied on:

```python
from anthropic import Anthropic

client = Anthropic()

response = client.messages.create(
    model="claude-opus-4-5",
    max_tokens=1024,
    messages=[{
        "role": "user",
        "content": [
            {
                "type": "document",
                "source": {
                    "type": "text",
                    "media_type": "text/plain",
                    "data": "Refund policy: Customers may request a refund within 30 days of purchase. Electronic products are not eligible for refund after activation."
                },
                "title": "Refund Policy Q1 2025",
                "citations": {"enabled": True}  # enable citations
            },
            {
                "type": "text",
                "text": "I bought a laptop 45 days ago. Can I get a refund?"
            }
        ]
    }]
)

print(response.content[0].text)
# Model cites the exact passage from the document rather than paraphrasing freely
```

---

## Part 5: When to Use

**Scenario 1: Frequently changing documents**
Company policies, product prices, regulations updated weekly. Fine-tuning is too slow and expensive. RAG lets you update the vector DB without touching the model.

**Scenario 2: Audit trails and source citations required**
Medical, legal, financial applications — where answers must come with a verifiable source. The Citations API lets the model point to the exact passage it relied on, satisfying compliance requirements.

**Scenario 3: Domain knowledge not in training data**
Internal documents, company codebases, newly published research papers. The model has never seen this data — grounding is the only way to make it usable.

---

## Part 6: When NOT to Use

**Anti-pattern 1: Grounding general knowledge questions**
Asking "What is Python?" or "What's 2 + 2?" — the model already knows. Injecting unrelated documents wastes tokens and can introduce noise. Only ground when the information is *not* in training data or when source verification is required.

**Anti-pattern 2: Blindly trusting the retriever**
If the retriever fails to fetch the right chunks, the model has nothing to work with and may fall back to hallucination — but will still answer confidently. This failure is harder to detect than regular hallucination because you assumed grounding was active. Log top-K chunks and verify manually during development.

**Anti-pattern 3: Using grounding instead of fine-tuning for behavior**
Grounding works for facts, not for style. If you want the model to always respond concisely, use a formal tone, or understand domain-specific jargon — that's the job of fine-tuning or system prompts, not RAG.

---

## Part 7: Gotchas & Pitfalls

**Gotcha 1: Chunk size directly impacts retrieval quality**
Chunks under 100 tokens lose context; the model doesn't have enough to understand the passage. Chunks over 1000 tokens produce vectors that are too generic; retrieval quality drops. In practice, 256–512 tokens with 20% overlap works well as a starting point — but you must experiment for your specific domain.

**Gotcha 2: "Lost in the middle" in retrieved context**
When multiple chunks are injected into the prompt, the model pays less attention to content in the middle (as covered in the Context Window post). If the key information sits in chunk 3 of 5, the model may overlook it. Fix: rerank chunks, place the most relevant one at the beginning or end of the context.

**Gotcha 3: Embedding mismatch between query and document**
The query "iPhone price" and the document "Apple iPhone 15 Pro: $999" may have low cosine similarity because they use different words. HyDE (Hypothetical Document Embeddings) solves this: ask the model to write a hypothetical answer, then use that answer as the search query instead of the original question.

**Gotcha 4: Citations don't guarantee correct interpretation**
The model may cite the right source but misinterpret the content. Citations reduce hallucination about *where information comes from*, not errors in *understanding it*. For high-stakes applications, add a validation layer in production.

---

## Part 8: Connections to Other Keywords

→ **Hallucination & Grounding** (covered): Hallucination is the problem; grounding is the specific technique that prevents the model from fabricating facts by providing real sources

→ **Context Window** (covered): Retrieved chunks consume context space — there's a direct trade-off between the number of chunks and conversation history length

→ **In-context Learning** (covered): Grounding is a specialized form of in-context learning — injecting information into context, but focused on real documents rather than illustrative examples

→ **RAG basics** (coming up): Grounding is the concept; RAG is the implementation — the next post goes deep into the full pipeline with vector DBs and embedding models

→ **Prompt Injection** (coming up): Documents used for grounding can contain malicious instructions — grounding introduces a new attack surface that needs to be handled

---

## Part 9: Self-Test (5 Open Questions)

**Q1**: Explain grounding in your own words — specifically how does it change the way an LLM generates an answer compared to no grounding?

**Q2**: Your manager asks you to build a chatbot covering 500 internal documents, updated daily. How would you design the grounding pipeline?

**Q3**: When should you NOT use RAG grounding? Give 2 specific examples.

**Q4**: Compare grounding with fine-tuning — what different problems do they solve? When should you use each?

**Q5**: If the retriever always returns the correct chunks but the model still occasionally hallucinates, where might the problem be?

---

## Part 10: 24h Exercise

**Task**: Build a simple RAG chatbot for your own documents

Create a chatbot that answers questions based on a set of documents you choose (company policy, project README, or any text you have). No vector DB required — use simple string matching or TF-IDF as the retriever to focus on understanding grounding, not infrastructure.

**Acceptance criteria**:
1. The chatbot answers at least 5 questions correctly based on the documents
2. When asked about information not in the documents, it clearly states "not found in documents"
3. Each answer includes the source file or section name
4. Test with at least 2 "trap" questions — questions the model would likely hallucinate on without grounding

**Estimated time**: 45–60 minutes

**Hint**: Start with `<document>` XML tags in the system prompt — no vector DB needed to understand how grounding works. Add vector search after you've seen the mechanism in action.

---

## Self-Test Answers (read after answering on your own)

**Q1**: Without grounding: the model draws from training weights — potentially wrong, outdated, or non-existent. With grounding: the model reads specific documents in context and synthesizes answers from those. If the information isn't in the documents, the model must say so rather than fabricate.

**Q2**: (1) Chunk documents into 256–512 token pieces with 20% overlap; (2) embed with an embedding model, store in a vector DB (Pinecone/Chroma/Weaviate); (3) re-index new or updated documents daily; (4) on each query: embed the query → retrieve top-5 chunks → inject into prompt with grounding instruction → attach citations for audit.

**Q3**: (1) General knowledge questions the model already knows — adding RAG doesn't improve accuracy and wastes tokens. (2) Creative tasks where factual accuracy isn't the goal — brainstorming, fiction writing, where "matching the document" isn't the objective.

**Q4**: Fine-tuning bakes knowledge into weights — suited for style, tone, and task adaptation; not suited for facts that need to stay current. Grounding puts knowledge into context — suited for fresh, verifiable knowledge at runtime. Use fine-tuning to change how the model "speaks"; use grounding to change what it "knows" at inference time.

**Q5**: The problem could be: (1) chunks too large — the model doesn't attend closely enough to specific details; (2) "lost in the middle" — key information sits in the middle of the context; (3) the model misinterprets the document despite citing the right source; (4) the grounding instruction isn't strong enough — the prompt needs to more explicitly say "answer only from the document, add nothing external."
