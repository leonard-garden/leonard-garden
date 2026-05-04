---
title: "Attention & Lost in the Middle — Tại sao LLM \"quên\" giữa chừng"
description: "Attention là cơ chế giúp LLM quyết định phần nào trong context cần chú ý khi sinh ra mỗi token. Nhưng với context dài, model có xu hướng nhớ thông tin ở đầu và cuối tốt hơn — thông tin ở giữa bị \"chìm\". Biết điều này giúp bạn sắp xếp prompt và RAG pipeline hiệu quả hơn."
locale: "vi"
translationKey: "attention-lost-in-middle"
publishedAt: 2026-05-04
pillar: "ai"
type: "article"
draft: false
---

## TL;DR

Attention là cơ chế giúp LLM quyết định phần nào trong context cần chú ý khi sinh ra mỗi token. Nhưng với context dài, model có xu hướng nhớ thông tin ở đầu và cuối tốt hơn — thông tin ở giữa bị "chìm". Biết điều này giúp bạn sắp xếp prompt và RAG pipeline hiệu quả hơn.

---

## 1. Vấn đề nó giải quyết

Một team xây chatbot hỗ trợ kỹ thuật dùng RAG. Họ retrieve 10 đoạn tài liệu liên quan và đưa cả 10 vào context. Model trả lời đúng 70% câu hỏi khi thông tin nằm ở đoạn đầu hoặc cuối — nhưng chỉ đúng 40% khi thông tin nằm ở đoạn thứ 5–6.

Bài toán gốc: neural network cần cơ chế "chú ý" đúng phần của input thay vì xử lý toàn bộ đều nhau. Attention giải quyết điều đó — nhưng không hoàn hảo. Và "không hoàn hảo theo kiểu gì" lại quan trọng hơn cả.

---

## 2. Định nghĩa chính xác

**Attention** là cơ chế trong Transformer cho phép mỗi token khi được sinh ra có thể "nhìn lại" và đánh giá mức độ liên quan của mọi token khác trong context. Đây là lý do LLM hiểu được cấu trúc dài và tham chiếu chéo giữa các phần.

**Lost in the Middle** là hiện tượng được ghi nhận trong paper *"Lost in the Middle: How Language Models Use Long Contexts"* (Liu et al., 2023): khi thông tin liên quan nằm ở giữa context dài, model sử dụng thông tin đó kém hiệu quả hơn so với khi nằm ở đầu hoặc cuối.

Phân biệt với các khái niệm dễ nhầm:
- Attention ≠ Memory: Attention xử lý trong context hiện tại, không phải bộ nhớ dài hạn
- Lost in the Middle ≠ Hallucination: Model không bịa — nó bỏ sót thông tin ở giữa rồi trả lời thiếu
- Attention score ≠ Importance: Token có attention score cao không nhất thiết là token quan trọng nhất về mặt semantic

---

## 3. Cơ chế hoạt động

Mỗi token trong context có 3 vector:

```
Query (Q): "Tôi đang tìm thông tin gì?"
Key   (K): "Tôi có thể cung cấp loại thông tin gì?"
Value (V): "Đây là nội dung thực của tôi"

Attention score của token A với token B = softmax(Q_A · K_B / √d)
Output của token A = tổng có trọng số của tất cả V_i theo scores
```

Mỗi token tổng hợp thông tin từ toàn bộ context, nhưng ưu tiên token có score cao.

Tại sao Lost in the Middle xảy ra — 3 nguyên nhân được đề xuất (chưa có consensus hoàn toàn):

```
Primacy bias:    token đầu có ít competition hơn trong training data
Recency bias:    token cuối gần với output → ít "information decay" hơn
Giữa context:    signal yếu từ cả hai phía → attention phân tán hơn

Minh họa performance theo vị trí (Liu et al., 2023):

  Đầu  ████████████████  ~85%
  Cuối ████████████░░░░  ~75%
  Giữa ████████░░░░░░░░  ~55%

  (tỷ lệ thực tế phụ thuộc task và model)
```

---

## 4. Ví dụ cụ thể

**Ví dụ 1: Multi-document QA — ảnh hưởng trực tiếp của thứ tự**

```python
# Câu trả lời nằm trong doc3 — đừng để ở giữa
docs = [doc1, doc2, doc3_with_answer, doc4, doc5]

# Cách sắp xếp kém: thông tin quan trọng ở giữa
prompt_bad = f"{doc1}\n{doc2}\n{doc3_with_answer}\n{doc4}\n{doc5}\n\nCâu hỏi: ..."

# Cách sắp xếp tốt hơn: thông tin quan trọng lên đầu
prompt_better = f"{doc3_with_answer}\n{doc1}\n{doc2}\n{doc4}\n{doc5}\n\nCâu hỏi: ..."
```

Trong thực nghiệm, di chuyển context liên quan nhất lên đầu cải thiện accuracy đáng kể với long-context tasks.

**Ví dụ 2: RAG pipeline — sắp xếp chunks theo relevance score**

```python
def build_rag_prompt(question: str, retrieved_chunks: list) -> str:
    # Chunk relevance cao nhất → đầu tiên
    # Chunk trung bình → giữa
    # Chunk relevance cao thứ hai → cuối (trước câu hỏi)
    sorted_by_score = sorted(retrieved_chunks, key=lambda c: c.score, reverse=True)

    if len(sorted_by_score) <= 2:
        ordered = sorted_by_score
    else:
        top = sorted_by_score[0]
        second_best = sorted_by_score[1]
        middle = sorted_by_score[2:]
        ordered = [top] + middle + [second_best]

    docs_text = "\n\n---\n\n".join(c.text for c in ordered)

    return f"""Tài liệu tham khảo:

{docs_text}

Câu hỏi: {question}"""
```

---

## 5. Khi nào cần chú ý

**Tình huống 1: RAG với nhiều documents**

Retrieve 5+ chunks và đưa vào context — thứ tự sắp xếp quan trọng. Chunk relevance cao nhất nên ở đầu hoặc cuối, không để lọt vào giữa.

**Tình huống 2: System prompt dài với nhiều instruction**

System prompt 2000+ tokens có nhiều constraints và format rules — đặt constraint quan trọng nhất ở đầu và cuối system prompt. Instruction phụ ở giữa.

**Tình huống 3: Paste nhiều file code vào context**

Khi debug với nhiều file, file chứa bug hoặc file liên quan nhất nên ở đầu prompt — không để chìm giữa đống file ít liên quan.

---

## 6. Khi nào KHÔNG cần lo

**Anti-pattern 1: Tối ưu vị trí khi context ngắn**

Với context dưới 4,000 tokens, Lost in the Middle ít ảnh hưởng. Cố sắp xếp lại khi prompt 200 tokens là premature optimization.

**Anti-pattern 2: Shuffle documents và hy vọng model "đọc hết"**

Không có trick nào compensate hoàn toàn cho Lost in the Middle. Nếu thông tin quan trọng buộc phải ở giữa, giải pháp tốt hơn là chunking lại hoặc giảm số documents.

**Anti-pattern 3: Nhét nhiều tài liệu để model "tự chọn"**

"Ném 10 docs vào để model tự quyết định cái nào liên quan" kém hơn retrieve đúng 2–3 docs relevant nhất. Precision của retrieval quan trọng hơn số lượng.

---

## 7. Gotchas & Pitfalls

**Gotcha 1: Behavior khác nhau theo model version**

Claude 3.5 Sonnet được Anthropic cải thiện mid-context recall so với các phiên bản trước. Đừng assume kết quả test trên model cũ áp dụng cho model mới — verify lại khi upgrade.

**Gotcha 2: "Needle in a haystack" test không phản ánh real usage**

Benchmark kinh điển nhét 1 câu quan trọng vào giữa text ngẫu nhiên để test recall. Real-world multi-document retrieval phức tạp hơn nhiều — đừng dùng benchmark này để kết luận về production performance.

**Gotcha 3: Lost in the Middle tệ hơn với factual extraction**

Model bỏ sót đặc biệt khi cần extract fact chính xác (tên, số, ngày) từ giữa context. Với summarization hay reasoning, degradation ít hơn vì model có thể partial credit từ nhiều vị trí.

**Gotcha 4: Visualize attention weights không reliable để debug**

Attention scores không map 1-1 với "model đang chú ý vào đâu". Multi-head attention và layer stacking làm phức tạp thêm. Đừng dùng attention visualization để debug individual predictions.

---

## 8. Kết nối với keyword khác

→ **Context window** (đã học): Context window là giới hạn tổng số tokens có thể xử lý. Lost in the Middle là giới hạn *chất lượng* bên trong window đó — hai constraints khác nhau, cùng quan trọng.

→ **Token & Tokenization** (đã học): Attention score tính ở token level. Vị trí của token trong context xác định primacy/recency bias.

→ **RAG** (sẽ học): RAG inject retrieved documents vào context — thiết kế tốt phải account for Lost in the Middle khi sắp xếp chunks.

→ **Prompt caching** (sẽ học): Cache prefix yêu cầu static content (system instructions) ở đầu — align tự nhiên với best practice "quan trọng lên đầu".

→ **Hallucination** (sẽ học): Lost in the Middle gây một dạng pseudo-hallucination — model không bịa nhưng bỏ sót context giữa, rồi fill khoảng trống bằng prior knowledge.

---

## 9. Self-test

Trả lời **không nhìn bài**, viết ra trước khi xem đáp án:

**Q1:** Giải thích Attention cho người không biết kỹ thuật. Tại sao LLM cần cơ chế này thay vì đọc input từ trái sang phải như người đọc bình thường?

**Q2:** Bạn có prompt gồm: system instructions (500 tokens) + 8 retrieved documents (mỗi cái ~300 tokens) + user question (50 tokens). Document liên quan nhất là document số 4. Bạn sẽ sắp xếp lại như thế nào?

**Q3:** Khi nào thì Lost in the Middle không phải vấn đề đáng lo, và tại sao?

**Q4:** Phân biệt Lost in the Middle với Hallucination. Chúng khác nhau như thế nào? Có thể xảy ra cùng lúc không?

**Q5:** Nếu model thế hệ tiếp theo loại bỏ được primacy/recency bias hoàn toàn, điều đó thay đổi gì trong cách thiết kế RAG system?

---

## 10. Bài tập 24h

**Task:** Kiểm tra Lost in the Middle trên một use case thực tế của bạn.

**Mô tả:** Lấy một task bạn thường dùng LLM với multiple sources — Q&A từ tài liệu, code review nhiều file, summarize nhiều bài viết — và test xem vị trí thông tin ảnh hưởng output như thế nào.

**Steps:**
1. Chọn 1 task có từ 3 documents/files trở lên
2. Chạy với thứ tự gốc — ghi lại output
3. Di chuyển thông tin quan trọng nhất lên đầu — chạy lại
4. Di chuyển thông tin đó xuống cuối — chạy lại
5. So sánh 3 outputs về quality, accuracy, completeness

**Acceptance criteria:**
- [ ] Có 3 outputs từ 3 cách sắp xếp khác nhau
- [ ] Đánh giá được output nào tốt hơn và giải thích cụ thể tại sao
- [ ] Ghi lại 1 insight về cách bạn sẽ thay đổi prompt workflow sau bài tập này
- [ ] Nếu không thấy khác biệt — giải thích tại sao (context quá ngắn? task không position-sensitive?)

**Estimated time:** 30–45 phút

---

## Đáp án Self-test (đọc sau khi tự trả lời)

**Q1:** Khi gặp đại từ "nó" ở giữa đoạn văn, người đọc biết "nó" chỉ cái gì nhờ đọc ngữ cảnh cả trước lẫn sau. LLM cần làm điều tương tự: hiểu tham chiếu, cấu trúc logic, và mối quan hệ giữa các phần không theo thứ tự tuyến tính. Sequential reading từ trái sang phải không đủ cho bài toán này.

**Q2:** Đặt document số 4 ngay sau system instructions (vị trí đầu trong document block). Nếu có document liên quan thứ hai, đặt nó ở cuối ngay trước câu hỏi. 6 documents còn lại ở giữa. System instructions vẫn ở đầu tiên — chúng là anchor context cho toàn conversation.

**Q3:** Context ngắn (dưới 4,000 tokens) — effect nhỏ. Task là summarization hoặc reasoning — degradation ít hơn so với factual extraction. Chỉ có 1–2 documents — không có "giữa" để mất.

**Q4:** Lost in the Middle: model đọc đúng context nhưng bỏ qua thông tin ở giữa → trả lời thiếu hoặc sai vì thiếu data. Hallucination: model tạo ra thông tin không có trong context hay training data. Hai hiện tượng có thể xảy ra cùng: model bỏ sót fact ở giữa context, rồi bịa ra fact khác để fill khoảng trống.

**Q5:** Thứ tự sắp xếp documents ít critical hơn — không cần "best doc first" strategy. Nhưng vẫn cần relevance-based retrieval để giảm noise và giữ context ngắn. Phần thay đổi là ordering logic trong RAG; phần giữ nguyên là retrieval precision.
