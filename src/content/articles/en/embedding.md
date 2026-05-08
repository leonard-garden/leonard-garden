---
title: "Embedding: How LLMs Understand the Meaning of Language"
description: "Embedding is the process of converting text into dense numerical vectors so that passages with similar meaning end up close together in a high-dimensional space. It is the technical foundation of RAG, semantic search, and clustering. If you are building an AI application that processes natural language, you will almost certainly need embeddings."
locale: "en"
translationKey: "embedding"
publishedAt: 2026-05-08
pillar: "ai"
type: "article"
draft: false
---

## TL;DR

**Embedding** is the process of converting text into dense numerical vectors so that passages with similar meaning end up close together in a high-dimensional space. It is the technical foundation of RAG, semantic search, and clustering — any task that requires comparing *meaning* rather than matching words. If you are building an AI application that processes natural language, you will almost certainly need embeddings.

---

## Part 1: The problem it solves

Before embeddings, the dominant approach for comparing text was keyword matching. If you searched for "how to make pho," the system wouldn't return an article titled "guide to cooking bún bò Huế" — even though the two dishes share a nearly identical cooking process.

The problem: keyword matching doesn't understand semantics. "Dog" and "pup" mean the same thing but share no characters. "Bank" can mean a financial institution or the edge of a river.

A fintech startup in 2022 built a customer support chatbot. A customer asked "I want to close out my account." The chatbot found no matching FAQ because the FAQ said "close account," not "close out." Result: the entire interaction was escalated to a human agent.

Embedding solves exactly this: convert meaning into numbers, then compare numbers.

---

## Part 2: Precise definition

**Embedding** is an encoding function that maps a text passage to a fixed-size vector in a high-dimensional space.

```
"dog"      →  [0.23, -0.45, 0.12, ..., 0.67]   # 768 dimensions
"pup"      →  [0.21, -0.42, 0.14, ..., 0.65]   # vector close by
"car"      →  [-0.31, 0.67, -0.23, ..., 0.12]  # vector far away
```

Distinguished from related representations:

| Representation | Characteristics | When used |
|---|---|---|
| One-hot encoding | Sparse, no semantic meaning | Legacy, rarely used today |
| Bag of words | Sparse, loses word order | Simple text classification |
| **Embedding** | Dense, semantic, fast computation | RAG, semantic search, similarity |

The most important property of embeddings: **cosine similarity**. Two vectors with a small angle → semantically close content. Two vectors with a large angle → semantically different content.

---

## Part 3: How it works

An embedding model is trained to learn semantic relationships from billions of text passages:

```
Input: "the cat sat on the mat"
         │
         ▼
Tokenization: ["the", "cat", "sat", "on", "the", "mat"]
         │
         ▼
Embedding model (transformer encoder)
processes the full sentence, attending to each token's context
         │
         ▼
Pooling: aggregates all tokens into a single vector
         │
         ▼
Output: [0.12, -0.34, 0.67, ..., 0.45]  # 768 / 1024 / 3072 dimensions
```

When computing similarity between two vectors:

```
cosine_similarity(a, b) = (a · b) / (|a| × |b|)

Result ranges from -1 to 1:
  1.0  → identical meaning
  0.8+ → very similar
  0.5  → related but distinct
  0.0  → unrelated
 -1.0  → opposite meaning
```

---

## Part 4: Concrete examples

### Example 1: Computing semantic similarity with sentence-transformers

```python
from sentence_transformers import SentenceTransformer
import numpy as np

# Small model, runs locally, no API key required
model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")

sentences = [
    "I want to close out my account",   # customer query
    "close a bank account",              # FAQ 1
    "cancel a credit card",              # FAQ 2
    "deposit money into an account",     # FAQ 3 (unrelated)
]

embeddings = model.encode(sentences)

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

query_emb = embeddings[0]
for i, faq in enumerate(sentences[1:], 1):
    score = cosine_similarity(query_emb, embeddings[i])
    print(f"Score {score:.3f}: {faq}")

# Output:
# Score 0.847: close a bank account      ← correct match, different words
# Score 0.612: cancel a credit card
# Score 0.231: deposit money into an account
```

### Example 2: Simple semantic search for a chatbot FAQ

```python
from sentence_transformers import SentenceTransformer
import numpy as np

model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")

# Chatbot knowledge base
faqs = [
    {"id": 1, "question": "close a bank account", "answer": "You can close your account at a branch or via the app..."},
    {"id": 2, "question": "forgot login password", "answer": "Select 'Forgot password' and enter your registered phone number..."},
    {"id": 3, "question": "international wire transfer fee", "answer": "International transfer fee is 0.1%, minimum $5..."},
    {"id": 4, "question": "apply for a new credit card", "answer": "To apply for a credit card, prepare your ID and recent pay stubs..."},
]

# Index: compute embeddings for all FAQs once
faq_questions = [f["question"] for f in faqs]
faq_embeddings = model.encode(faq_questions)

def find_best_faq(user_query: str, threshold: float = 0.6) -> dict | None:
    query_emb = model.encode([user_query])[0]

    scores = [
        np.dot(query_emb, faq_emb) / (np.linalg.norm(query_emb) * np.linalg.norm(faq_emb))
        for faq_emb in faq_embeddings
    ]

    best_idx = int(np.argmax(scores))
    best_score = scores[best_idx]

    if best_score >= threshold:
        return {"faq": faqs[best_idx], "score": best_score}
    return None  # no matching FAQ found

# Test
result = find_best_faq("I want to close out my account")
if result:
    print(f"Match (score={result['score']:.3f}): {result['faq']['answer']}")
# → Match (score=0.847): You can close your account at a branch or via the app...
```

---

## Part 5: When to be most concerned

**Scenario 1: Building a RAG system**
RAG works by embedding the user query, finding the nearest documents in a vector database, and injecting them into context. The quality of your embedding model determines the quality of retrieval — a poor embedding model will retrieve the wrong documents, causing the LLM to answer incorrectly even if the LLM itself is excellent.

**Scenario 2: Semantic search for internal tools**
Searching Confluence, Notion, or Slack — users search in natural language, not exact keywords. Keyword search fails here; embedding-based search returns results that actually make sense.

**Scenario 3: Detecting duplicate or similar content**
Moderation, deduplication, clustering support tickets — all require comparing semantics across many texts. Embedding + cosine similarity lets you group questions with the same meaning even when they use different words.

---

## Part 6: When NOT to use embeddings

**Anti-pattern 1: Using embeddings for exact match**
Searching for order numbers, SKU codes, or email addresses requires absolute exact matching. Embeddings might return "ORD-12345" when you search "ORD-12346" because the vectors are close. For exact match, use traditional indexes (B-tree, inverted index).

**Anti-pattern 2: Embedding individual tokens instead of full sentences**
Embedding models are designed to encode *sentences* or *passages*, not isolated words. Embedding "bank" alone loses context — "bank" in "the river bank" is completely different from "bank" in "go to the bank." Always embed complete semantic units.

**Anti-pattern 3: Using an English-only model for multilingual content**
Many embedding models only perform well on English. Using them on other languages produces poor results. Check whether a model supports multilingual text before using it on non-English content.

---

## Part 7: Gotchas & Pitfalls

**Gotcha 1: Embedding dimensions differ between models**
OpenAI's `text-embedding-3-small` produces 1536-dimensional vectors. `paraphrase-multilingual-MiniLM` produces 384 dimensions. You cannot mix vectors from two different models — they live in completely different mathematical spaces. When you switch embedding models, you must re-embed all your data.

**Gotcha 2: Embedding models are not LLMs**
Many developers confuse embedding models with LLMs. Claude cannot produce embeddings directly — Claude is a generative model, not an encoder. Embeddings require a separate model (Voyage AI, OpenAI embeddings, sentence-transformers). These are two different jobs requiring two different models.

**Gotcha 3: Chunking strategy has a large impact on quality**
If a document is 10 pages long, you cannot embed all 10 pages as a single vector — too much information is lost. You must chunk (split) the document before embedding. Chunk size and overlap between chunks directly affect retrieval quality in RAG.

**Gotcha 4: Cosine similarity is not a silver bullet**
Two sentences can have high cosine similarity but opposite meanings: "I love eating" and "I don't love eating" — they share the same vocabulary so their vectors are close. Embeddings handle negation poorly. For use cases where logical correctness matters, additional post-processing is needed.

---

## Part 8: Connections to other keywords

→ **Token / Tokenization** *(already covered)*: text must be tokenized before it can be embedded. The embedding model learns to map from token sequences to vectors.

→ **In-context Learning** *(already covered)*: embeddings are how you find *which examples* are most relevant to include in context. Few-shot examples in RAG are typically selected by embedding similarity with the user query.

→ **Grounding / RAG** *(already covered)*: RAG is the most important production use case for embeddings. The embedding step is the retrieval — finding the right documents before the LLM synthesizes an answer.

→ **Hallucination & Grounding** *(already covered)*: embedding-based retrieval reduces hallucination — instead of letting the LLM "recall" information from training, you supply specific information via RAG using embeddings.

→ **Knowledge Cutoff** *(already covered)*: embedding + vector database is the primary solution for compensating for knowledge cutoff — index the latest information into a vector DB, retrieve when needed, inject into context.

---

## Part 9: Self-test

**Q1**: Explain why "dog" and "pup" end up with nearby embeddings while "dog" and "car" do not. What mechanism during training produces this property?

**Q2**: You are building a search system for an internal knowledge base with 50,000 documents. Describe the end-to-end pipeline from raw documents to the user receiving search results.

**Q3**: When should you NOT use embedding-based search? Describe at least 2 cases where full-text search or exact match is better.

**Q4**: Explain why you cannot mix vectors from two different embedding models. How does this affect your strategy for choosing a model for a production system?

**Q5**: How does chunking strategy affect RAG quality? What happens if chunks are too small? Too large?

---

## Part 10: Exercise (24h challenge)

**Task**: Build a simple semantic FAQ bot for a domain of your choice.

**Requirements**:
- Write at least 10 FAQ entries (question + answer)
- Index all questions using embeddings
- Implement a `find_answer(user_query)` function that returns the best-matching answer, or "I couldn't find a relevant answer" if the score is below the threshold
- Test with at least 5 queries that use different wording from the original FAQs

**Acceptance criteria**:
- [ ] At least 10 FAQ entries embedded and indexed
- [ ] Search function returns the correct answer for 4 out of 5 test queries
- [ ] Threshold in place to reject unrelated questions (score < 0.5)
- [ ] Code prints the similarity score alongside the answer for easy debugging
- [ ] At least 2 test cases use synonyms of FAQ wording (to verify semantic understanding)

**Estimated time**: 45 minutes

**Hint**: Use `sentence-transformers` with the `paraphrase-multilingual-MiniLM-L12-v2` model — small, runs locally, good multilingual support, no API key required. Install: `pip install sentence-transformers`.

---

## Self-test Answers (read after answering on your own)

**Q1**: Embedding models are trained on billions of sentences with the objective: "words/sentences appearing in the same context should have nearby vectors." "Dog" and "pup" frequently appear in the same context (pet articles, animal stories). "Dog" and "car" almost never share context. After training, vector distance reflects this semantic distance.

**Q2**: Pipeline: (1) Load raw documents → (2) Chunk into ~256-512 token segments with overlap → (3) Embed each chunk with an embedding model → (4) Store vectors + metadata in a vector DB (Pinecone, Chroma, Qdrant) → (5) When user searches: embed query → (6) Vector DB finds top-k nearest chunks → (7) Inject chunks into LLM context → (8) LLM synthesizes an answer from those chunks.

**Q3**: Don't use embeddings when: (1) Exact match is absolutely required — order numbers, phone numbers, email addresses — one wrong character means a wrong result. (2) Hard metadata filtering is needed — "all orders on 2024-01-01" — this is a range query, not a similarity query. (3) Full-text search with relevance ranking performs better — BM25 often outperforms embeddings for short keyword-heavy queries like specific product names.

**Q4**: Each embedding model creates vectors in its own mathematical space — the dimensions carry different meanings. The vector (0.23, -0.45) from model A carries completely different information than (0.23, -0.45) from model B. Cosine similarity between them is meaningless. Implication: treat your embedding model choice as a long-term commitment. Switching models means re-indexing all your data — with 50M documents that can take hours and significant API costs.

**Q5**: Chunks too small (< 100 tokens): each chunk lacks context, the embedding doesn't capture enough meaning, retrieval returns fragments that are hard to interpret. Chunks too large (> 1000 tokens): one chunk covers too many topics, the embedding is "diluted" — the vector represents 5 topics at once and represents none of them well. The sweet spot is typically 256-512 tokens with 20-50 token overlap between chunks to preserve context at boundaries.
