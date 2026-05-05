# In-context Learning — Học từ ví dụ trong prompt, không cần training

## TL;DR

**In-context learning** là khả năng LLM thực hiện tác vụ mới chỉ từ ví dụ bạn đưa vào prompt — không cần fine-tune hay cập nhật weights. Bạn cung cấp 2–5 cặp input→output, model nhận ra pattern và áp dụng cho input mới. Đây là nền tảng của few-shot prompting và là lý do prompt engineering có thể thay thế training trong nhiều tình huống.

---

## 1. Vấn đề nó giải quyết

Năm 2022, một developer cần model phân loại email khiếu nại theo 4 loại: billing, technical, refund, other. Dataset nội bộ chỉ có 80 samples — không đủ để fine-tune. Thuê người label thêm thì tốn 2 tuần.

Giải pháp: đưa 4 ví dụ vào prompt, một ví dụ cho mỗi loại. Model trả về accuracy 87% — đủ dùng cho MVP. Không cần training, không cần pipeline, không cần chờ đợi.

Trước khi ICL được hiểu rõ, mỗi tác vụ mới đều đòi hỏi: thu thập data, label, fine-tune, deploy. ICL phá vỡ cycle đó — đặc biệt với tác vụ có pattern rõ ràng.

---

## 2. Định nghĩa chính xác

**In-context learning (ICL)** là cơ chế LLM điều chỉnh output dựa trên các ví dụ được cung cấp trực tiếp trong context, mà không thay đổi parameters của model.

Phân biệt với các khái niệm dễ nhầm:

| Khái niệm | Cập nhật weights? | Cần data labeled? | Thời gian setup |
|-----------|-------------------|-------------------|-----------------|
| ICL (few-shot) | ❌ | Chỉ 2–10 ví dụ | Vài phút |
| Fine-tuning | ✅ | Hàng trăm–nghìn | Vài giờ–ngày |
| RAG | ❌ | Không cần label | Setup retrieval |
| Zero-shot | ❌ | Không cần | Không cần |

Ba dạng ICL theo số lượng ví dụ:
- **Zero-shot**: chỉ có instruction, không có ví dụ
- **One-shot**: 1 ví dụ
- **Few-shot**: 2–10 ví dụ (phổ biến nhất, hiệu quả nhất)

---

## 3. Cơ chế hoạt động

ICL không phải model "học" theo nghĩa truyền thống. Không có gradient, không có weight update. Cơ chế thực sự là attention:

```
Cấu trúc prompt:
┌─────────────────────────────────────┐
│ [Instruction] (tuỳ chọn)            │
│                                     │
│ Input:  <ví dụ 1 input>             │
│ Output: <ví dụ 1 output>            │
│                                     │
│ Input:  <ví dụ 2 input>             │
│ Output: <ví dụ 2 output>            │
│                                     │
│ Input:  <query thực sự>             │
│ Output: ← model điền vào đây        │
└─────────────────────────────────────┘
```

Trong forward pass, attention mechanism của transformer "nhìn" toàn bộ context. Khi xử lý token đầu tiên của Output cuối, nó attend đến tất cả các cặp input→output trước đó và infer pattern.

Bước xử lý của model:
1. Encode toàn bộ prompt thành token sequence
2. Transformer layers tính attention giữa query position và các example positions
3. Tại vị trí Output cuối, model infer được: "input dạng X → output dạng Y"
4. Generate output theo pattern đó

Quan trọng: model không "nhớ" các ví dụ này sau khi conversation kết thúc. Mỗi request là stateless.

---

## 4. Ví dụ cụ thể

### Ví dụ 1: Phân loại sentiment

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

# Output của model: positive
```

Ba ví dụ đủ để model hiểu format và task.

### Ví dụ 2: Trích xuất dữ liệu từ hóa đơn

```python
prompt = """
Trích xuất thông tin từ hóa đơn ra JSON.

Hóa đơn: "Ngày 15/3/2024. Mua 2 cái bàn giá 1.500.000đ/cái. Tổng: 3.000.000đ"
JSON: {"date": "2024-03-15", "items": [{"name": "bàn", "qty": 2, "unit_price": 1500000}], "total": 3000000}

Hóa đơn: "Ngày 2/4/2024. Mua 5 ghế văn phòng @ 800.000đ. Tổng 4.000.000đ"
JSON: {"date": "2024-04-02", "items": [{"name": "ghế văn phòng", "qty": 5, "unit_price": 800000}], "total": 4000000}

Hóa đơn: "Ngày 10/5/2024. Mua 1 laptop 25.000.000đ và 2 chuột 300.000đ/cái. Tổng 25.600.000đ"
JSON:"""

# Output: {"date": "2024-05-10", "items": [{"name": "laptop", "qty": 1, "unit_price": 25000000}, {"name": "chuột", "qty": 2, "unit_price": 300000}], "total": 25600000}
```

Model học schema từ 2 ví dụ và xử lý đúng trường hợp phức tạp hơn (2 items).

---

## 5. Khi nên dùng

**Scenario 1: Tác vụ mới, ít data**
Bạn cần classify ticket support theo taxonomy riêng của công ty. Không có training data. Đưa 3–5 ví dụ vào prompt, chạy được ngay.

**Scenario 2: Prototype nhanh**
Bạn muốn test xem một tác vụ NLP có khả thi không trước khi đầu tư vào fine-tuning. ICL cho kết quả trong vài phút — đủ để validate approach.

**Scenario 3: Output format nhất quán**
Bạn cần model trả về theo format cụ thể (JSON schema, markdown template). Hai ví dụ về format mong muốn hiệu quả hơn mô tả bằng text.

---

## 6. Khi không nên dùng

**Anti-pattern 1: Tác vụ đòi hỏi factual knowledge**
Bạn muốn model biết quy trình nội bộ của công ty. Đưa 10 ví dụ không giúp ích — model cần knowledge, không phải pattern. Dùng RAG hoặc fine-tuning thay thế.

**Anti-pattern 2: Scale lớn với context window đắt tiền**
Mỗi request mang theo 10 ví dụ (1.500 tokens). Với 100.000 requests/ngày, bạn trả tiền cho 150M tokens ví dụ mỗi ngày. Fine-tuning hoặc prompt caching giải quyết tốt hơn.

**Anti-pattern 3: Reasoning nhiều bước**
ICL thuần túy kém hiệu quả với bài toán logic phức tạp. Few-shot + Chain of Thought — thêm reasoning steps vào ví dụ — sẽ hiệu quả hơn nhiều.

---

## 7. Gotchas & Pitfalls

**Gotcha 1: Thứ tự ví dụ ảnh hưởng output**
Ví dụ đặt cuối cùng (gần query nhất) có ảnh hưởng lớn hơn ví dụ đặt đầu tiên. Nếu model bị bias về một class, thử xáo trộn thứ tự.

Cách phát hiện: chạy cùng query với các thứ tự ví dụ khác nhau. Nếu output thay đổi, bạn đang bị recency bias.

**Gotcha 2: Model học format, không phải label semantics**
Nghiên cứu của Min et al. (2022) cho thấy: flip label ngẫu nhiên trong ví dụ (gán "positive" cho review tiêu cực) hầu như không giảm performance. Model học từ format và distribution của input, không phải từ mapping label → meaning.

Implication thực tế: ví dụ sai label đôi khi không phá hỏng output — nhưng cũng có nghĩa model không thực sự "hiểu" label theo nghĩa sâu.

**Gotcha 3: Chất lượng ví dụ quan trọng hơn số lượng**
3 ví dụ đa dạng tốt hơn 10 ví dụ na ná nhau. Nếu tất cả ví dụ đều là edge case, model sẽ coi edge case là normal case.

**Gotcha 4: ICL không persist**
Mỗi API call là stateless. Nếu muốn model "nhớ" cách làm tác vụ qua nhiều conversation, bạn phải luôn đưa ví dụ vào prompt — hoặc dùng fine-tuning.

---

## 8. Kết nối với các keyword khác

→ **Context window** (đã học): ICL bị giới hạn bởi context window. Thêm nhiều ví dụ = tốn nhiều tokens hơn. Đây là trade-off cốt lõi.

→ **System vs User prompt** (đã học): Ví dụ ICL thường nằm trong system prompt (nếu stable) hoặc user prompt (nếu dynamic). Vị trí ảnh hưởng đến prompt caching.

→ **Chain of Thought** (sắp học): Few-shot CoT kết hợp ICL với reasoning steps trong mỗi ví dụ, giúp model giải quyết tác vụ phức tạp hơn.

→ **Hallucination & Grounding** (sắp học): ICL dạy format và pattern — không grounding model vào facts. Đừng nhầm ICL với cách giảm hallucination.

→ **Fine-tuning** (ngoài scope blog này): ICL là alternative khi data ít. Khi ICL đạt trần performance, fine-tuning là bước tiếp theo.

---

## 9. Tự kiểm tra (5 câu hỏi mở)

**Q1**: Giải thích in-context learning theo cách của bạn — không dùng từ "few-shot" hay "prompt". Cơ chế nào làm nó hoạt động?

**Q2**: Bạn cần model phân loại PR description thành 4 loại: feature, bugfix, refactor, docs. Bạn sẽ thiết kế prompt ICL như thế nào? Bao nhiêu ví dụ, chọn ví dụ nào?

**Q3**: Hai trường hợp nào ICL sẽ thất bại, dù bạn đưa vào 10 ví dụ hoàn hảo?

**Q4**: So sánh ICL với fine-tuning: khi nào fine-tuning là lựa chọn duy nhất hợp lý, dù ICL có vẻ tiện hơn?

**Q5**: Nếu token pricing giảm 10x trong 2 năm tới, điều đó thay đổi quyết định ICL vs fine-tuning như thế nào?

---

## 10. Bài tập 24h

**Task**: Xây dựng classifier phân loại GitHub issue thành 3 loại: bug, feature request, question.

**Bước thực hiện**:
1. Lấy 10 GitHub issues thực từ một repo bạn quen (vscode, react, hoặc repo của bạn)
2. Viết prompt ICL với 3 ví dụ, một ví dụ cho mỗi loại
3. Chạy 7 issues còn lại qua prompt
4. So sánh kết quả với label bạn tự đánh

**Acceptance criteria**:
- [ ] Prompt có đúng 3 ví dụ, mỗi loại 1 ví dụ
- [ ] Accuracy ≥ 70% trên 7 issues test
- [ ] Thử đổi thứ tự ví dụ — ghi lại output có thay đổi không
- [ ] Thử thêm 3 ví dụ nữa (6 tổng) — accuracy có tăng không?
- [ ] Viết 2 câu: ICL phù hợp / không phù hợp với use case của bạn hiện tại

**Thời gian ước tính**: 45–60 phút

---

## Self-test Answers (đọc sau khi tự trả lời)

**Q1**: ICL hoạt động vì transformer's attention mechanism đọc toàn bộ context. Khi xử lý vị trí output cuối, model attend đến tất cả cặp input→output trước đó và infer pattern. Không có weight update — chỉ là forward pass với context dài hơn.

**Q2**: 4 ví dụ (1 cho mỗi loại), chọn ví dụ "archetypal" — ví dụ rõ ràng nhất của mỗi loại, không phải edge case. Sắp xếp theo thứ tự round-robin để tránh recency bias về một loại cụ thể.

**Q3**: (1) Tác vụ đòi hỏi factual knowledge không có trong training data của model — ví dụ quy trình nội bộ. (2) Tác vụ cần multi-step reasoning mà ví dụ thuần túy không demonstrate được quá trình suy luận.

**Q4**: Fine-tuning là lựa chọn duy nhất hợp lý khi: (1) cần consistent behavior ở scale lớn với cost constraint, (2) cần model học style/terminology riêng đòi hỏi hàng nghìn ví dụ vượt quá context window.

**Q5**: Token rẻ hơn 10x → ICL competitive hơn với fine-tuning ở nhiều use case vì cost disadvantage (trả tiền ví dụ mỗi request) giảm đi. Fine-tuning vẫn win ở latency (shorter prompt) và consistency.
