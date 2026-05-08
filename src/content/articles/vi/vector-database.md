---
title: "Vector Database"
description: "Vector database là cơ sở dữ liệu được tối ưu để lưu trữ và tìm kiếm các embedding vectors — mảng số thực đại diện cho ngữ nghĩa của dữ liệu. Thay vì tìm kiếm theo từ khóa chính xác, nó tìm các vectors gần nhất về mặt ngữ nghĩa trong không gian nhiều chiều. Đây là thành phần cốt lõi trong mọi hệ thống RAG và semantic search hiện đại."
locale: "vi"
translationKey: "vector-database"
publishedAt: 2026-05-08
pillar: "ai"
type: "article"
draft: false
---

## TL;DR

**Vector database** là cơ sở dữ liệu được tối ưu để lưu trữ và tìm kiếm các embedding vectors — mảng số thực đại diện cho ngữ nghĩa của dữ liệu. Thay vì tìm kiếm theo từ khóa chính xác, nó tìm các vectors gần nhất về mặt ngữ nghĩa trong không gian nhiều chiều. Đây là thành phần cốt lõi trong mọi hệ thống RAG và semantic search hiện đại.

---

## Part 1: Vấn đề nó giải quyết

Năm 2022, một team xây dựng chatbot hỗ trợ khách hàng cho công ty bảo hiểm. Họ có 50,000 tài liệu chính sách dưới dạng text. Khi người dùng hỏi "tôi có được bồi thường tai nạn xe máy không?", câu query `LIKE '%tai nạn%'` trong PostgreSQL trả về nhiều kết quả không liên quan. Khi thêm synonyms thủ công, họ phải maintain danh sách 2,000 từ đồng nghĩa. Chỉ cần user hỏi theo cách khác — "motorcycle accident compensation" — là miss hoàn toàn.

Vấn đề cốt lõi: full-text search tìm theo ký tự, không phải theo nghĩa. "Motorcycle accident compensation" và "xe máy bị tai nạn có được tiền không" giống nhau về nghĩa nhưng không có một từ nào trùng nhau về ký tự.

---

## Part 2: Định nghĩa chính xác

**Vector database** là hệ thống lưu trữ thiết kế để index và query *embedding vectors* — mảng số thực nhiều chiều (thường 384-3072 chiều) đại diện cho ngữ nghĩa của text, ảnh, hay âm thanh. Query chính không phải `WHERE field = value` mà là "tìm K vectors gần nhất với vector này".

Phân biệt với các khái niệm dễ nhầm:

| | Relational DB | Full-text search | Vector database |
|---|---|---|---|
| Ví dụ | PostgreSQL, MySQL | Elasticsearch, Typesense | Qdrant, Pinecone, Weaviate |
| Tìm theo | Giá trị chính xác | Từ khóa (BM25) | Độ tương đồng ngữ nghĩa |
| Query | `WHERE id = 5` | `MATCH 'accident'` | "tìm 5 vectors gần nhất" |
| Dùng khi | Structured data | Keyword search | Semantic search, RAG |

Cần phân biệt thêm với **vector extension**: `pgvector` cho PostgreSQL cũng lưu được vector và hỗ trợ similarity search, nhưng không có ANN indexing tối ưu như vector database chuyên dụng — ổn cho <500k vectors, chậm hơn ở quy mô lớn hơn.

---

## Part 3: Cơ chế hoạt động

### Bước 1: Encode data thành vectors

```
Text → Embedding model → [0.23, -0.41, 0.89, ..., 0.12]  # 1536 chiều
```

Mỗi chiều của vector đại diện cho một đặc trưng ngữ nghĩa (không diễn giải trực tiếp được). Hai texts có nghĩa gần nhau → vectors nằm gần nhau trong không gian đó.

### Bước 2: Index bằng thuật toán ANN

Không thể brute-force so sánh 10 triệu vectors mỗi lần query. Vector database dùng *Approximate Nearest Neighbor (ANN)* — thuật toán phổ biến nhất là **HNSW** (Hierarchical Navigable Small World):

```
Layer 2:  A ─────────────── E          ← ít nodes, kết nối xa
Layer 1:  A ──── B ──── D ── E         ← trung bình
Layer 0:  A─b─B─c─C─d─D─e─E─f─F      ← tất cả nodes, kết nối gần

Query Q → vào từ Layer 2 → navigate xuống → tìm nearest ở Layer 0
```

HNSW đạt O(log n) search time. Trade-off: approximate, không guaranteed 100% exact.

### Bước 3: Similarity search

Khi query, vector database:
1. Embed query thành vector
2. Dùng HNSW index tìm K nearest neighbors
3. Tính similarity score
4. Trả về K kết quả kèm score

### Similarity metrics

| Metric | Dùng khi | Range |
|--------|----------|-------|
| Cosine similarity | Text embeddings (quan tâm hướng, không quan tâm magnitude) | [-1, 1] |
| Euclidean (L2) | Image embeddings, spatial data | [0, ∞) |
| Dot product | Vectors đã normalize, cần tốc độ | [-∞, ∞) |

---

## Part 4: Ví dụ cụ thể

### Ví dụ 1: Semantic search đơn giản với Qdrant

```python
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
import openai

client = QdrantClient(":memory:")  # in-memory cho demo

# Tạo collection
client.create_collection(
    collection_name="docs",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
)

def embed(text: str) -> list[float]:
    resp = openai.embeddings.create(model="text-embedding-3-small", input=text)
    return resp.data[0].embedding

# Index 3 documents
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

# Query bằng tiếng Anh, tìm được doc tiếng Việt
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

### Ví dụ 2: Metadata filtering kết hợp vector search

```python
# Kết hợp semantic search + structured filter
results = client.search(
    collection_name="docs",
    query_vector=embed("tai nạn xe"),
    query_filter={
        "must": [{"key": "category", "match": {"value": "vehicle"}}]
    },
    limit=5,
)
```

Filtering giới hạn search space trước khi so sánh vector — giảm noise, tăng precision, và nhanh hơn khi dataset lớn.

---

## Part 5: Khi nào nên dùng

### Scenario 1: RAG cho LLM

Khi cần cung cấp context từ knowledge base lớn (>1,000 documents) cho LLM. Vector search tìm đúng đoạn text liên quan trong milliseconds, thay vì nhét toàn bộ vào context window — giải quyết giới hạn 200k token của Claude.

### Scenario 2: Semantic search trong sản phẩm

Khi người dùng cần tìm theo nghĩa, không phải từ khóa. E-commerce tìm "áo mặc đi biển" → trả về swimwear dù không có từ đó trong query. Jobs platform match CV với job description dù dùng từ khác nhau.

### Scenario 3: Duplicate detection và clustering

Khi cần phát hiện nội dung trùng lặp trong dataset lớn. Tìm tất cả embeddings có cosine similarity > 0.95 — nhanh hơn text comparison nhiều bậc khi có ANN index và dataset hàng triệu bản ghi.

---

## Part 6: Khi nào KHÔNG nên dùng

### Anti-pattern 1: Dùng vector DB cho structured queries

Nếu bạn cần `WHERE price < 100 AND category = 'shoes'`, đây là structured query. Vector DB là overkill và chậm hơn PostgreSQL index thông thường. Thay vào đó: dùng relational DB, hoặc chỉ thêm vector search khi bài toán có semantic component thực sự.

### Anti-pattern 2: Dùng vector search khi user cần exact match

Người dùng tìm "Nghị định 71/2022/NĐ-CP" hay mã sản phẩm "SKU-ABC-123" — đây là exact match, semantic search sẽ kém hơn BM25 rõ ràng. Dùng PostgreSQL `tsvector` hoặc Elasticsearch. Hybrid search (BM25 + vector) là giải pháp đúng khi cần cả hai.

### Anti-pattern 3: Tự implement ANN từ đầu

NumPy brute-force ổn cho 10,000 vectors. Cho 1 triệu+ vectors, brute-force sẽ timeout ở production. Đừng tự viết HNSW — dùng Qdrant, pgvector, hoặc FAISS. Đây là wheel đã được optimize kỹ.

---

## Part 7: Gotchas & Pitfalls

### Gotcha 1: Embedding model mismatch

Index với `text-embedding-ada-002` (1536 dims) rồi query với `text-embedding-3-small` (cũng 1536 dims) → kết quả vô nghĩa. Hai model dùng không gian vector khác nhau dù cùng số chiều. Dấu hiệu: search score luôn quanh 0.4-0.6 bất kể query. Sửa: dùng cùng một model cho cả indexing và querying, không bao giờ trộn lẫn.

### Gotcha 2: HNSW parameters ảnh hưởng recall/speed

`ef_construction` thấp → index nhanh hơn nhưng recall giảm. `m` (connections per node) thấp → ít RAM nhưng accuracy giảm. Default của Qdrant/Weaviate ổn cho prototype. Production cần benchmark trên data thực của bạn — không có one-size-fits-all.

### Gotcha 3: ANN không trả về exact nearest neighbors

HNSW trả về *approximate* results. Với default settings, recall thường ~0.95-0.99, nghĩa là 1-5% kết quả đúng có thể bị miss. Nếu bài toán yêu cầu 100% recall (medical, legal compliance), phải dùng exact search (brute-force) và chấp nhận trade-off về tốc độ.

### Gotcha 4: Chunking strategy ảnh hưởng chất lượng search

Chunk quá nhỏ (50 tokens) → thiếu context, embedding kém chất lượng. Chunk quá lớn (2000 tokens) → vector đại diện cho nhiều chủ đề, precision giảm. Rule of thumb thực tế: 256-512 tokens với overlap ~50 tokens. Phải thử nghiệm với data thực, không có con số tuyệt đối.

---

## Part 8: Kết nối với các keyword khác

→ **Embedding** (đã học, #12): Vector DB lưu output của embedding model. Không có embedding, không có vector search — hai khái niệm cần nhau hoàn toàn.

→ **Grounding / Citations** (đã học, #08): Vector search là cơ chế grounding phổ biến nhất — tìm sources liên quan trước khi LLM generate answer.

→ **Hallucination & Grounding** (đã học, #06): RAG + vector DB là kỹ thuật chính để giảm hallucination bằng cách cung cấp factual context từ knowledge base tin cậy.

→ **Context window** (đã học, #02): Vector search giải quyết giới hạn context window — thay vì nhét toàn bộ knowledge base vào context, chỉ retrieve top-K đoạn liên quan nhất.

→ **RAG basics** (sắp học, #23): Vector DB là storage layer của RAG pipeline. Flow: embed query → vector search → retrieve chunks → LLM generation.

---

## Part 9: Self-test

**Q1**: Giải thích vector database là gì mà không dùng từ "vector" hay "embedding". Tại sao nó khác với database truyền thống về cách tìm kiếm?

**Q2**: Bạn đang xây dựng feature "tìm bài viết tương tự" cho blog platform. Mô tả cụ thể bạn sẽ index gì, query gì, dùng metric nào, và tại sao chọn metric đó.

**Q3**: Khi nào bạn sẽ chọn Elasticsearch thay vì vector database, và khi nào sẽ dùng hybrid (cả hai)? Cho ví dụ cụ thể cho từng trường hợp.

**Q4**: So sánh cách vector database và full-text search giải quyết bài toán tìm kiếm tài liệu — trade-off của mỗi cách là gì về precision, recall, latency, và chi phí?

**Q5**: Embedding model bạn đang dùng bị deprecated. Để migrate sang model mới, bạn cần làm gì? Điều gì xảy ra nếu bỏ qua bước re-index?

---

## Part 10: Exercise (24h challenge)

**Task**: Xây dựng semantic search cho 20+ câu hỏi FAQ tự tạo bằng Qdrant in-memory và sentence-transformers (không cần API key).

**Acceptance criteria**:
1. Index được ≥20 FAQ documents vào Qdrant collection thành công
2. Query bằng paraphrase (không dùng từ nào trùng với FAQ gốc) vẫn tìm được đúng kết quả
3. Top-1 result có cosine similarity score ≥ 0.70
4. Thêm metadata filtering theo category và verify nó lọc đúng
5. Code chạy end-to-end không error, có in ra score của từng kết quả

**Estimated time**: 45-60 phút

**Hint**: Cài `pip install qdrant-client sentence-transformers`. Dùng model `all-MiniLM-L6-v2` — output 384 dims, không cần GPU, chạy local hoàn toàn.

---

## Self-test Answers (đọc sau khi tự trả lời)

**Q1**: Vector database là hệ thống lưu trữ tối ưu để tìm kiếm theo *sự tương đồng về nghĩa*. Database truyền thống tìm bản ghi khớp chính xác với điều kiện (`WHERE id = 5`, `WHERE name = 'John'`). Vector database tìm các bản ghi "gần giống nhất" với query theo một khái niệm toán học về khoảng cách, kể cả khi không có từ nào trùng nhau.

**Q2**: Index toàn bộ nội dung bài viết (hoặc chunked nếu dài >512 tokens) sau khi embed bằng model như `text-embedding-3-small`. Khi người dùng đang đọc bài X, embed nội dung bài X làm query vector, tìm K bài có similarity cao nhất. Dùng cosine similarity vì quan tâm đến hướng ngữ nghĩa (hai bài cùng chủ đề), không quan tâm đến độ dài của bài.

**Q3**: Chọn Elasticsearch khi: user tìm exact terms (mã sản phẩm, tên riêng, số điện thoại), cần fuzzy matching hoặc autocomplete, hoặc dataset không có ngữ nghĩa phức tạp. Dùng hybrid khi: e-commerce search (user gõ "áo polo đỏ size L" — vừa có structured filters vừa cần semantic cho mô tả sản phẩm), hoặc bất kỳ bài toán search nào cần cả precision của keyword lẫn recall của semantic.

**Q4**: Full-text search: nhanh setup, deterministic, hoạt động tốt với exact terms và typo tolerance — nhưng miss khi user dùng từ đồng nghĩa hoặc ngôn ngữ khác. Latency thấp, không cần model inference. Vector DB: cross-lingual, hiểu paraphrase, bắt được semantic similarity — nhưng cần embedding step (latency cao hơn, tốn tiền API), kết quả approximate, setup phức tạp hơn.

**Q5**: (1) Re-embed toàn bộ documents với model mới. (2) Tạo lại collection với số chiều đúng của model mới. (3) Index toàn bộ vectors mới. (4) Update code để dùng model mới cho cả indexing và querying. Nếu bỏ qua re-index và chỉ đổi model ở query side: search scores sẽ vô nghĩa vì index dùng không gian vector cũ, query dùng không gian mới — hai thứ này không tương thích dù có cùng số chiều.
