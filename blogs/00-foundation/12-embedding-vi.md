# Embedding: Cách LLM hiểu nghĩa của ngôn ngữ

## TL;DR

**Embedding** là quá trình chuyển đổi văn bản thành vector số học dày đặc (dense vector) sao cho các đoạn văn có nghĩa tương tự nhau sẽ có vector gần nhau trong không gian nhiều chiều. Đây là nền tảng kỹ thuật của RAG, semantic search, và clustering — bất kỳ tác vụ nào cần "so sánh ý nghĩa" thay vì so sánh từ ngữ. Nếu bạn đang build ứng dụng AI xử lý ngôn ngữ tự nhiên, khả năng cao bạn sẽ cần embedding.

---

## Phần 1: Vấn đề nó giải quyết

Trước khi có embedding, cách phổ biến nhất để so sánh văn bản là so sánh từng từ (keyword matching). Nếu bạn tìm "cách nấu phở", hệ thống sẽ không trả về bài viết có tiêu đề "hướng dẫn làm món bún bò Huế" — dù hai món có quy trình nấu gần giống nhau.

Vấn đề: keyword matching không hiểu ngữ nghĩa. "Con chó" và "cún" là cùng một ý nghĩa nhưng hoàn toàn khác từ vựng. "Bank" trong tiếng Anh có thể là ngân hàng hoặc bờ sông.

Một startup fintech năm 2022 build chatbot hỗ trợ khách hàng. Khách hỏi "tôi muốn tất toán tài khoản" — chatbot không tìm được FAQ nào vì FAQ ghi "đóng tài khoản", không phải "tất toán". Kết quả: escalate lên agent con người toàn bộ.

Embedding giải quyết chính xác vấn đề này: chuyển nghĩa thành số, rồi so sánh số.

---

## Phần 2: Định nghĩa chính xác

**Embedding** là hàm chuyển đổi (encoding function) ánh xạ một đoạn văn bản thành một vector có kích thước cố định trong không gian nhiều chiều.

```
"con chó"  →  [0.23, -0.45, 0.12, ..., 0.67]   # 768 chiều
"cún cưng" →  [0.21, -0.42, 0.14, ..., 0.65]   # vector gần giống
"ô tô"     →  [-0.31, 0.67, -0.23, ..., 0.12]  # vector xa
```

Phân biệt với:

| Khái niệm | Đặc điểm | Dùng khi nào |
|---|---|---|
| One-hot encoding | Sparse, không có ngữ nghĩa | Cũ, gần không dùng nữa |
| Bag of words | Sparse, mất thứ tự từ | Text classification đơn giản |
| **Embedding** | Dense, có ngữ nghĩa, tính toán nhanh | RAG, semantic search, similarity |

Thuộc tính quan trọng nhất của embedding: **cosine similarity**. Hai vector có góc nhỏ → nội dung gần nghĩa. Hai vector có góc lớn → nội dung khác nghĩa.

---

## Phần 3: Cách hoạt động

Embedding model được train để học mối quan hệ ngữ nghĩa từ hàng tỷ câu văn bản:

```
Input: "con mèo ngồi trên thảm"
         │
         ▼
Tokenization: ["con", "mèo", "ngồi", "trên", "thảm"]
         │
         ▼
Embedding model (transformer encoder)
xử lý toàn bộ câu, chú ý đến context của từng từ
         │
         ▼
Pooling: tổng hợp tất cả token thành 1 vector duy nhất
         │
         ▼
Output: [0.12, -0.34, 0.67, ..., 0.45]  # 768 / 1024 / 3072 chiều
```

Khi tính độ tương đồng giữa 2 vector:

```
cosine_similarity(a, b) = (a · b) / (|a| × |b|)

Kết quả từ -1 đến 1:
  1.0  → giống hệt nhau
  0.8+ → rất gần nghĩa
  0.5  → liên quan nhưng khác
  0.0  → không liên quan
 -1.0  → nghĩa ngược lại
```

---

## Phần 4: Ví dụ cụ thể

### Ví dụ 1: Tính semantic similarity với sentence-transformers

```python
from sentence_transformers import SentenceTransformer
import numpy as np

# Model nhỏ, chạy local, không cần API key
model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")

sentences = [
    "tôi muốn tất toán tài khoản",   # câu hỏi của khách hàng
    "đóng tài khoản ngân hàng",       # FAQ 1
    "hủy thẻ tín dụng",               # FAQ 2
    "nạp tiền vào tài khoản",         # FAQ 3 (không liên quan)
]

embeddings = model.encode(sentences)

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

query_emb = embeddings[0]
for i, faq in enumerate(sentences[1:], 1):
    score = cosine_similarity(query_emb, embeddings[i])
    print(f"Score {score:.3f}: {faq}")

# Output:
# Score 0.847: đóng tài khoản ngân hàng    ← tìm đúng dù khác từ
# Score 0.612: hủy thẻ tín dụng
# Score 0.231: nạp tiền vào tài khoản
```

### Ví dụ 2: Semantic search đơn giản cho chatbot FAQ

```python
from sentence_transformers import SentenceTransformer
import numpy as np

model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")

# Knowledge base của chatbot
faqs = [
    {"id": 1, "question": "đóng tài khoản ngân hàng", "answer": "Bạn có thể đóng tài khoản tại quầy giao dịch hoặc qua app..."},
    {"id": 2, "question": "quên mật khẩu đăng nhập", "answer": "Chọn 'Quên mật khẩu' và nhập số điện thoại đăng ký..."},
    {"id": 3, "question": "phí chuyển tiền quốc tế", "answer": "Phí chuyển khoản quốc tế là 0.1% tối thiểu 50,000đ..."},
    {"id": 4, "question": "mở thẻ tín dụng mới", "answer": "Để mở thẻ tín dụng, chuẩn bị CMND/CCCD và sao kê lương..."},
]

# Index: tính embedding cho tất cả FAQ 1 lần
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
    return None  # không tìm được FAQ phù hợp

# Test
result = find_best_faq("tôi muốn tất toán tài khoản")
if result:
    print(f"Match (score={result['score']:.3f}): {result['faq']['answer']}")
# → Match (score=0.847): Bạn có thể đóng tài khoản tại quầy giao dịch...
```

---

## Phần 5: Khi nào cần lo ngại nhất

**Scenario 1: Build RAG system**
RAG hoạt động bằng cách embed user query, tìm document gần nhất trong vector database, rồi inject document đó vào context. Chất lượng embedding quyết định chất lượng retrieval — một embedding model kém sẽ retrieve sai document, khiến LLM trả lời sai dù bản thân LLM tốt.

**Scenario 2: Semantic search cho internal tools**
Tìm kiếm trong Confluence, Notion, Slack — người dùng search bằng ngôn ngữ tự nhiên, không phải keyword chính xác. Keyword search thất bại ở đây; embedding-based search mới trả về kết quả có nghĩa.

**Scenario 3: Phát hiện nội dung trùng lặp hoặc tương tự**
Moderation, deduplication, clustering support tickets — tất cả đều cần so sánh ngữ nghĩa giữa nhiều text. Embedding + cosine similarity cho phép bạn nhóm các câu hỏi có nghĩa giống nhau dù dùng từ khác nhau.

---

## Phần 6: Khi nào KHÔNG cần lo quá mức

**Anti-pattern 1: Dùng embedding cho exact match**
Tìm kiếm số đơn hàng, mã SKU, email — những thứ cần exact match tuyệt đối. Embedding có thể trả về "ORD-12345" khi bạn search "ORD-12346" vì chúng có vector gần nhau. Với exact match, dùng index truyền thống (B-tree, inverted index).

**Anti-pattern 2: Embed từng token thay vì cả câu**
Embedding model được thiết kế để encode *câu* hoặc *đoạn văn*, không phải từng từ đơn lẻ. Embed "bank" một mình sẽ mất context — "bank" trong câu "the river bank" khác hoàn toàn "bank" trong "go to the bank". Luôn embed đơn vị ngữ nghĩa đầy đủ.

**Anti-pattern 3: Dùng embedding model cho ngôn ngữ nó không được train**
Nhiều embedding model chỉ tốt với tiếng Anh. Dùng chúng với tiếng Việt sẽ cho kết quả kém. Kiểm tra xem model có hỗ trợ multilingual không trước khi dùng cho text tiếng Việt.

---

## Phần 7: Gotchas & Pitfalls

**Gotcha 1: Embedding dimensions khác nhau giữa các model**
`text-embedding-3-small` của OpenAI cho vector 1536 chiều. `paraphrase-multilingual-MiniLM` cho 384 chiều. Bạn không thể trộn vector từ hai model khác nhau — chúng sống trong không gian toán học khác nhau hoàn toàn. Khi đổi embedding model, bạn phải re-embed toàn bộ data.

**Gotcha 2: Embedding model không phải LLM**
Nhiều developer nhầm lẫn embedding model và LLM. Claude không thể tạo ra embedding trực tiếp — Claude là generative model, không phải encoder. Embedding cần một model riêng (Voyage AI, OpenAI embeddings, sentence-transformers). Đây là hai công việc khác nhau đòi hỏi hai model khác nhau.

**Gotcha 3: Chunking strategy ảnh hưởng lớn đến chất lượng**
Nếu document dài 10 trang, bạn không thể embed cả 10 trang thành 1 vector — quá nhiều thông tin sẽ bị mất. Phải chunk (chia nhỏ) trước khi embed. Kích thước chunk và cách overlap giữa các chunk ảnh hưởng trực tiếp đến retrieval quality trong RAG.

**Gotcha 4: Cosine similarity không phải silver bullet**
Hai câu có thể có cosine similarity cao nhưng nghĩa ngược nhau: "tôi thích ăn" và "tôi không thích ăn" — chúng dùng cùng từ vựng nên vector gần nhau. Embedding không handle negation tốt. Với use case nhạy cảm về logic, cần post-processing bổ sung.

---

## Phần 8: Kết nối với các keyword khác

→ **Token / Tokenization** *(đã học)*: trước khi embed, văn bản phải được tokenize. Embedding model học cách map từ token sequence sang vector.

→ **In-context Learning** *(đã học)*: embedding là cách tìm *những examples nào* phù hợp nhất để đưa vào context. Few-shot examples trong RAG thường được chọn bằng embedding similarity với user query.

→ **Grounding / RAG** *(đã học)*: RAG là ứng dụng quan trọng nhất của embedding trong production. Embedding là bước retrieval — tìm đúng document trước khi LLM tổng hợp câu trả lời.

→ **Hallucination & Grounding** *(đã học)*: embedding-based retrieval là cách giảm hallucination — thay vì để LLM "nhớ" thông tin từ training, bạn cung cấp thông tin cụ thể qua RAG dùng embedding.

→ **Knowledge Cutoff** *(đã học)*: embedding + vector database là giải pháp chính để bù đắp knowledge cutoff — index thông tin mới nhất vào vector DB, retrieve khi cần, inject vào context.

---

## Phần 9: Tự kiểm tra

**Q1**: Giải thích tại sao "con chó" và "cún" có embedding gần nhau, trong khi "con chó" và "ô tô" thì không. Cơ chế nào trong quá trình training tạo ra tính chất này?

**Q2**: Bạn đang build hệ thống tìm kiếm cho knowledge base nội bộ có 50,000 tài liệu. Mô tả end-to-end pipeline từ lúc có raw documents đến lúc user nhận được kết quả search.

**Q3**: Khi nào bạn KHÔNG nên dùng embedding-based search? Mô tả ít nhất 2 trường hợp mà full-text search hoặc exact match tốt hơn.

**Q4**: Giải thích tại sao bạn không thể trộn vector từ hai embedding model khác nhau. Điều này ảnh hưởng như thế nào đến chiến lược chọn model cho production system?

**Q5**: Chunking strategy ảnh hưởng đến RAG như thế nào? Nếu chunk quá nhỏ, điều gì xảy ra? Nếu chunk quá lớn?

---

## Phần 10: Bài tập (24h challenge)

**Bài tập**: Xây dựng một semantic FAQ bot đơn giản cho một domain bạn chọn.

**Yêu cầu**:
- Viết ít nhất 10 FAQ entries (câu hỏi + câu trả lời)
- Index tất cả câu hỏi bằng embedding
- Implement hàm `find_answer(user_query)` trả về câu trả lời phù hợp nhất hoặc "Tôi không tìm được câu trả lời phù hợp" nếu score < threshold
- Test với ít nhất 5 câu hỏi dùng từ ngữ khác với FAQ gốc

**Acceptance criteria**:
- [ ] Ít nhất 10 FAQ entries được embed và index
- [ ] Hàm tìm kiếm trả về đúng câu trả lời cho 4/5 test queries
- [ ] Có threshold để từ chối câu hỏi không liên quan (score < 0.5)
- [ ] Code in ra similarity score cùng với câu trả lời để dễ debug
- [ ] Có ít nhất 2 test case dùng từ đồng nghĩa với FAQ (kiểm tra semantic understanding)

**Thời gian ước tính**: 45 phút

**Gợi ý**: Dùng `sentence-transformers` với model `paraphrase-multilingual-MiniLM-L12-v2` — model nhỏ, chạy local, hỗ trợ tiếng Việt tốt, không cần API key. Install: `pip install sentence-transformers`.

---

## Self-test Answers (đọc sau khi đã tự trả lời)

**Q1**: Embedding model được train trên hàng tỷ câu văn bản với objective "các từ/câu xuất hiện trong cùng context sẽ có vector gần nhau". "Con chó" và "cún" thường xuất hiện trong cùng bối cảnh (bài viết về thú cưng, câu chuyện về động vật). "Con chó" và "ô tô" hầu như không có context chung. Sau training, khoảng cách vector phản ánh khoảng cách ngữ nghĩa này.

**Q2**: Pipeline: (1) Load raw documents → (2) Chunk thành đoạn ~256-512 token có overlap → (3) Embed từng chunk bằng embedding model → (4) Lưu vector + metadata vào vector DB (Pinecone, Chroma, Qdrant) → (5) Khi user search: embed query → (6) Vector DB tìm top-k chunks gần nhất → (7) Inject chunks vào LLM context → (8) LLM tổng hợp câu trả lời từ chunks đó.

**Q3**: Không nên dùng embedding khi: (1) Exact match là yêu cầu tuyệt đối — tìm mã đơn hàng, số điện thoại, email address — sai 1 ký tự là sai hoàn toàn. (2) Filter theo metadata cứng — "tất cả đơn hàng ngày 2024-01-01" — đây là range query, không phải similarity query. (3) Full-text search với relevance ranking tốt — BM25 thường outperform embedding cho keyword-heavy queries ngắn như tên sản phẩm cụ thể.

**Q4**: Mỗi embedding model tạo ra vector trong không gian toán học riêng của nó — các chiều có ý nghĩa khác nhau. Vector (0.23, -0.45) từ model A mang thông tin hoàn toàn khác vector (0.23, -0.45) từ model B. Cosine similarity giữa chúng là vô nghĩa. Implication: khi chọn embedding model cho production, coi đây là quyết định dài hạn. Đổi model nghĩa là re-index toàn bộ dữ liệu — với 50M documents có thể tốn hàng giờ và tiền API không nhỏ.

**Q5**: Chunk quá nhỏ (< 100 token): mỗi chunk thiếu context, embedding không hiểu đủ nghĩa, retrieval trả về đoạn văn tối nghĩa. Chunk quá lớn (> 1000 token): một chunk chứa quá nhiều chủ đề, embedding bị "diluted" — vector đại diện cho 5 chủ đề cùng lúc, không đại diện tốt cho bất kỳ chủ đề nào. Sweet spot thường 256-512 token với 20-50 token overlap giữa các chunk để không mất ngữ cảnh tại ranh giới.
