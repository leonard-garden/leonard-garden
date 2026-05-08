---
title: "Vector Database"
description: "A vector database is a storage system optimized for storing and searching embedding vectors — arrays of floating-point numbers that represent the semantic meaning of data. Instead of exact keyword matching, it finds the most semantically similar vectors in high-dimensional space. It is the core component of every modern RAG system and semantic search application."
locale: "en"
translationKey: "vector-database"
publishedAt: 2026-05-08
pillar: "ai"
type: "article"
draft: false
---

## TL;DR

A **vector database** is a storage system optimized for storing and searching embedding vectors — arrays of floating-point numbers that represent the semantic meaning of data. Instead of exact keyword matching, it finds the most semantically similar vectors in high-dimensional space. It is the core component of every modern RAG system and semantic search application.

---

## Part 1: The problem it solves

In 2022, a team built a customer support chatbot for an insurance company. They had 50,000 policy documents as plain text. When a user asked "am I covered for a motorcycle accident?", a `LIKE '%accident%'` query returned irrelevant results. They added manual synonyms and ended up maintaining a list of 2,000 synonym pairs. Any change in how users phrased their questions caused misses.

The core problem: full-text search matches characters, not meaning. "Motorcycle accident compensation" and "xe máy bị tai nạn có được tiền không" (Vietnamese for the same thing) share zero characters but identical meaning.

---

## Part 2: Precise definition

A **vector database** is a storage system designed to index and query *embedding vectors* — high-dimensional float arrays (typically 384–3072 dimensions) representing the semantic content of text, images, or audio. The primary query is not `WHERE field = value` but "find the K vectors closest to this query vector."

Distinguishing from easily-confused concepts:

| | Relational DB | Full-text search | Vector database |
|---|---|---|---|
| Examples | PostgreSQL, MySQL | Elasticsearch, Typesense | Qdrant, Pinecone, Weaviate |
| Searches by | Exact value | Keywords (BM25) | Semantic similarity |
| Query form | `WHERE id = 5` | `MATCH 'accident'` | "find 5 nearest vectors" |
| Best for | Structured data | Keyword search | Semantic search, RAG |

Also distinct from **vector extensions**: `pgvector` for PostgreSQL stores vectors and supports similarity search, but lacks optimized ANN indexing — fine for <500k vectors, slower at scale.

---

## Part 3: How it works

### Step 1: Encode data into vectors

```
Text → Embedding model → [0.23, -0.41, 0.89, ..., 0.12]  # 1536 dimensions
```

Each dimension encodes a semantic feature (not directly interpretable). Two texts with similar meaning produce vectors that sit close together in this space.

### Step 2: Index using an ANN algorithm

Brute-force comparing 10 million vectors per query is impractical. Vector databases use *Approximate Nearest Neighbor (ANN)* algorithms. The most common is **HNSW** (Hierarchical Navigable Small World):

```
Layer 2:  A ─────────────── E          ← few nodes, long-range connections
Layer 1:  A ──── B ──── D ── E         ← medium density
Layer 0:  A─b─B─c─C─d─D─e─E─f─F      ← all nodes, short-range connections

Query Q → enter at Layer 2 → navigate down → find nearest at Layer 0
```

HNSW achieves O(log n) search time. Trade-off: results are approximate, not guaranteed exact.

### Step 3: Similarity search

At query time, the vector database:
1. Embeds the query into a vector
2. Uses the HNSW index to find K nearest neighbors
3. Computes similarity scores
4. Returns K results with scores

### Similarity metrics

| Metric | Use when | Range |
|--------|----------|-------|
| Cosine similarity | Text embeddings (direction matters, not magnitude) | [-1, 1] |
| Euclidean (L2) | Image embeddings, spatial data | [0, ∞) |
| Dot product | Pre-normalized vectors, need speed | [-∞, ∞) |

---

## Part 4: Concrete examples

### Example 1: Basic semantic search with Qdrant

```python
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
import openai

client = QdrantClient(":memory:")  # in-memory for demo

# Create collection
client.create_collection(
    collection_name="docs",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
)

def embed(text: str) -> list[float]:
    resp = openai.embeddings.create(model="text-embedding-3-small", input=text)
    return resp.data[0].embedding

# Index 3 documents (Vietnamese)
docs = [
    "Xe máy bị tai nạn được bồi thường tối đa 50 triệu đồng",
    "Bảo hiểm ô tô bao gồm thiệt hại do va chạm và trộm cắp",
    "Quy trình đăng ký bảo hiểm nhân thọ online",
]
points = [
    PointStruct(id=i, vector=embed(doc), payload={"text": doc})
    for i, doc in enumerate(docs)
]
client.upsert(collection_name="docs", points=points)

# Query in English, finds Vietnamese document
results = client.search(
    collection_name="docs",
    query_vector=embed("motorcycle accident compensation"),
    limit=2,
)
for r in results:
    print(f"Score: {r.score:.3f} | {r.payload['text']}")
# Score: 0.847 | Xe máy bị tai nạn được bồi thường tối đa 50 triệu đồng
# Score: 0.612 | Bảo hiểm ô tô bao gồm thiệt hại do va chạm và trộm cắp
```

### Example 2: Metadata filtering combined with vector search

```python
# Combine semantic search + structured filter
results = client.search(
    collection_name="docs",
    query_vector=embed("vehicle accident"),
    query_filter={
        "must": [{"key": "category", "match": {"value": "vehicle"}}]
    },
    limit=5,
)
```

Filtering narrows the search space before vector comparison — reduces noise, improves precision, and is faster on large datasets.

---

## Part 5: When to use

### Scenario 1: RAG for LLMs

When you need to provide context from a large knowledge base (>1,000 documents) to an LLM. Vector search finds the relevant text chunks in milliseconds instead of stuffing everything into the context window — directly solves the 200k token limit of Claude.

### Scenario 2: Semantic search in products

When users need to search by meaning, not keywords. An e-commerce platform matching "clothes for the beach" to swimwear items even when the word "swimwear" never appears in the query. Job platforms matching CVs to job descriptions that use different phrasing.

### Scenario 3: Duplicate detection and clustering

When you need to detect near-duplicate content in large datasets. Finding all embeddings with cosine similarity > 0.95 is orders of magnitude faster than text comparison when backed by an ANN index across millions of records.

---

## Part 6: When NOT to use

### Anti-pattern 1: Using vector DB for structured queries

If you need `WHERE price < 100 AND category = 'shoes'`, that's a structured query. A vector database is overkill and will be slower than a standard PostgreSQL index. Use a relational database, or add vector search only when the problem genuinely has a semantic component.

### Anti-pattern 2: Using vector search when users need exact matches

A user searching for "Decree 71/2022/ND-CP" or product code "SKU-ABC-123" needs exact matching — semantic search will underperform BM25 here. Use PostgreSQL `tsvector` or Elasticsearch. Hybrid search (BM25 + vector) is the right answer when you need both.

### Anti-pattern 3: Self-implementing ANN from scratch

NumPy brute-force is fine for 10,000 vectors. For 1M+ vectors in production, it will timeout. Don't write your own HNSW — use Qdrant, pgvector, or FAISS. This is a heavily optimized wheel that already exists.

---

## Part 7: Gotchas & Pitfalls

### Gotcha 1: Embedding model mismatch

Indexing with `text-embedding-ada-002` (1536 dims) then querying with `text-embedding-3-small` (also 1536 dims) produces meaningless results. The two models use completely different vector spaces despite sharing the same dimensionality. Symptom: search scores consistently cluster around 0.4–0.6 regardless of the query. Fix: always use the same model for both indexing and querying — never mix models.

### Gotcha 2: HNSW parameters affect recall/speed trade-off

Lower `ef_construction` → faster indexing but worse recall. Lower `m` (connections per node) → less RAM but lower accuracy. Defaults from Qdrant/Weaviate work fine for prototypes. Production requires benchmarking on your actual data — there is no universal optimal setting.

### Gotcha 3: ANN does not return exact nearest neighbors

HNSW returns *approximate* results. With default settings, recall is typically ~0.95–0.99, meaning 1–5% of correct results may be missed. If your use case demands 100% recall (medical, legal compliance), you need exact search (brute-force) and must accept the latency trade-off.

### Gotcha 4: Chunking strategy affects search quality

Chunks too small (50 tokens) → insufficient context, poor embedding quality. Chunks too large (2000 tokens) → the vector represents multiple topics, precision drops. Practical rule of thumb: 256–512 tokens with ~50 token overlap. Experiment on your actual data — there is no universally correct number.

---

## Part 8: Connections to other keywords

→ **Embedding** (already covered, #12): Vector DB stores the output of embedding models. Without embeddings, there is no vector search — the two concepts are entirely interdependent.

→ **Grounding / Citations** (already covered, #08): Vector search is the most common grounding mechanism — retrieving relevant sources before LLM generation.

→ **Hallucination & Grounding** (already covered, #06): RAG + vector DB is the primary technique for reducing hallucination by providing factual context from a trusted knowledge base.

→ **Context window** (already covered, #02): Vector search directly addresses context window limits — instead of stuffing an entire knowledge base into context, retrieve only the top-K most relevant chunks.

→ **RAG basics** (coming up, #23): Vector DB is the storage layer of the RAG pipeline. Flow: embed query → vector search → retrieve chunks → LLM generation.

---

## Part 9: Self-test

**Q1**: Explain what a vector database is without using the words "vector" or "embedding." Why does it search differently from a traditional database?

**Q2**: You're building a "similar articles" feature for a blog platform. Describe specifically what you would index, what you'd query, which similarity metric you'd use, and why you chose that metric.

**Q3**: When would you choose Elasticsearch over a vector database, and when would you use both together? Give a concrete example for each case.

**Q4**: Compare how a vector database and full-text search solve the same document retrieval problem. What are the trade-offs of each in terms of precision, recall, latency, and cost?

**Q5**: Your embedding model is being deprecated and you must migrate to a new one. What steps are required? What breaks if you skip re-indexing?

---

## Part 10: Exercise (24h challenge)

**Task**: Build a semantic search system for 20+ self-authored FAQ entries using Qdrant in-memory and sentence-transformers (no API key needed).

**Acceptance criteria**:
1. Successfully index ≥20 FAQ documents into a Qdrant collection
2. Querying with a paraphrase (no words shared with the original FAQ) still returns the correct result
3. Top-1 result has a cosine similarity score ≥ 0.70
4. Add metadata filtering by category and verify it filters correctly
5. Code runs end-to-end without errors, printing the score of each result

**Estimated time**: 45–60 minutes

**Hint**: Install with `pip install qdrant-client sentence-transformers`. Use model `all-MiniLM-L6-v2` — 384-dim output, no GPU required, runs fully local.

---

## Self-test Answers (read after answering on your own)

**Q1**: A vector database is a storage system optimized for finding records by *semantic similarity*. A traditional database finds records that exactly match a condition (`WHERE id = 5`, `WHERE name = 'John'`). A vector database finds records that are "most similar" to the query using a mathematical notion of distance — even when no words overlap.

**Q2**: Index the full content of each article (or chunked if longer than ~512 tokens) after embedding with a model like `text-embedding-3-small`. When a user reads article X, embed that article's content as the query vector and find K articles with the highest similarity. Use cosine similarity because you care about semantic direction (articles on the same topic), not document length.

**Q3**: Use Elasticsearch when: users search for exact terms (product codes, proper names, phone numbers), need fuzzy matching or autocomplete, or the dataset has no complex semantics. Use hybrid when: e-commerce search (users type "red polo shirt size L" — needs both structured filters and semantic matching for product descriptions), or any search where keyword precision and semantic recall both matter.

**Q4**: Full-text search: fast to set up, deterministic, excellent with exact terms and typo tolerance — but misses synonyms, paraphrases, and cross-language queries. Low latency, no model inference needed. Vector DB: handles paraphrases, cross-lingual queries, catches semantic similarity — but requires an embedding step (higher latency, API cost), results are approximate, more complex setup.

**Q5**: (1) Re-embed all documents with the new model. (2) Recreate the collection with the correct dimensionality for the new model. (3) Re-index all new vectors. (4) Update code to use the new model for both indexing and querying. If you skip re-indexing and only change the model on the query side: search scores will be meaningless because the index uses the old vector space while queries use the new one — incompatible despite potentially sharing the same number of dimensions.
