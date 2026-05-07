# Chain of Thought: Dạy LLM Suy Luận Từng Bước

## TL;DR

**Chain of Thought (CoT)** là kỹ thuật prompt yêu cầu LLM trình bày từng bước suy luận trước khi đưa ra câu trả lời cuối. Thay vì hỏi thẳng đáp án, bạn yêu cầu model "suy nghĩ thành lời" — điều này giúp model tự phát hiện và sửa lỗi logic trong quá trình reasoning. Kết quả: accuracy tăng rõ rệt trên các bài toán phức tạp như toán học, lập luận đa bước, và phân tích nhân quả.

---

## Phần 1: Vấn đề nó giải quyết

Tháng 3/2022, một kỹ sư đang test GPT-3 với bài toán cộng trừ đơn giản:

> "Một cửa hàng có 5 táo. Họ mua thêm 12 táo và bán 8 táo. Còn bao nhiêu táo?"

GPT-3 trả lời đúng. Nhưng khi bài toán phức tạp hơn một chút — thêm vài bước trung gian — model bắt đầu sai. Không phải vì không biết toán, mà vì nó nhảy thẳng đến câu trả lời mà không có "scratch paper" để tính.

Vấn đề cốt lõi: LLM xử lý token theo chuỗi tuyến tính và không có working memory riêng. Khi câu hỏi đòi hỏi nhiều bước suy luận phụ thuộc nhau, model thường rút gọn, bỏ qua bước giữa, và sinh ra câu trả lời sai.

---

## Phần 2: Định nghĩa chính xác

**Chain of Thought** là phương pháp prompting yêu cầu LLM sinh ra một chuỗi các bước lập luận trung gian (*intermediate reasoning steps*) trước khi đưa ra câu trả lời cuối.

Kỹ thuật này được Wei et al. giới thiệu trong paper "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models" (NeurIPS 2022). Ý tưởng cốt lõi: thay vì dùng context window chỉ để chứa câu hỏi và đáp án, bạn dùng nó để chứa quá trình suy nghĩ.

**Phân biệt với các khái niệm dễ nhầm:**
- *Few-shot prompting*: cung cấp ví dụ input→output. CoT là few-shot prompting **có bước trung gian**.
- *Zero-shot CoT*: không cần ví dụ, chỉ thêm câu "Let's think step by step" — đây là variant đơn giản nhất của CoT.
- *Scratchpad*: khái niệm tương đương từ phía model. CoT là kỹ thuật từ phía prompt.

---

## Phần 3: Cách hoạt động

CoT hoạt động vì một lý do kỹ thuật cụ thể: **mỗi token được sinh ra trở thành một phần của context** cho các token tiếp theo. Khi model viết ra bước 1, bước 2 được điều kiện hóa trên bước 1. Quá trình suy luận trở thành một chuỗi phụ thuộc, thay vì nhảy cóc.

```
Không có CoT:
[Câu hỏi] ──────────────────────────→ [Đáp án]
                                            ↑
                                   (1 bước, dễ sai)

Có CoT:
[Câu hỏi] → [Bước 1] → [Bước 2] → [Bước 3] → [Đáp án]
                ↑            ↑           ↑
       mỗi bước tích lũy context từ bước trước
```

**Hai dạng chính:**

1. **Few-shot CoT**: Cung cấp 2-3 ví dụ có reasoning steps, model học pattern và áp dụng.
2. **Zero-shot CoT**: Không có ví dụ, chỉ thêm trigger phrase vào cuối câu hỏi.

Trigger phrases phổ biến:
- "Let's think step by step."
- "Think carefully before answering."
- "Work through this systematically."

---

## Phần 4: Ví dụ cụ thể

### Ví dụ 1: Zero-shot CoT — toán học đơn giản

**Không có CoT:**
```python
import anthropic

client = anthropic.Anthropic()

# Hỏi thẳng đáp án
response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=50,
    messages=[{
        "role": "user",
        "content": "Một xe đi 60km/h trong 2.5 giờ, rồi 80km/h trong 1.5 giờ. Tổng quãng đường?"
    }]
)
print(response.content[0].text)
# Output: "270km" — đúng nhưng không kiểm chứng được
```

**Có Zero-shot CoT:**
```python
# Thêm trigger phrase để buộc model suy luận từng bước
response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=300,
    messages=[{
        "role": "user",
        "content": (
            "Một xe đi 60km/h trong 2.5 giờ, rồi 80km/h trong 1.5 giờ. "
            "Tổng quãng đường?\n\nLet's think step by step."
        )
    }]
)
# Output:
# Bước 1: Quãng đường đoạn 1 = 60 × 2.5 = 150km
# Bước 2: Quãng đường đoạn 2 = 80 × 1.5 = 120km
# Bước 3: Tổng = 150 + 120 = 270km
```

### Ví dụ 2: Few-shot CoT — phân loại sentiment có logic

```python
few_shot_prompt = """Phân tích sentiment của review sau. Suy luận từng bước.

Ví dụ 1:
Review: "Sản phẩm đến nhanh nhưng bị vỡ, dịch vụ hỗ trợ từ chối đổi trả."
Suy luận: Giao hàng nhanh → điểm cộng nhỏ. Sản phẩm vỡ → điểm trừ lớn. Từ chối đổi trả → điểm trừ nghiêm trọng.
Kết quả: NEGATIVE

Ví dụ 2:
Review: "Giá cao nhưng chất lượng tương xứng, đúng mô tả."
Suy luận: Giá cao → kỳ vọng cao. Chất lượng tương xứng → kỳ vọng được đáp ứng. Đúng mô tả → đáng tin cậy.
Kết quả: POSITIVE

Bây giờ phân tích:
Review: "Mua lần 2 rồi, lần này thấy chất lượng giảm so với trước, nhưng vẫn ổn."
"""
# CoT giúp model phát hiện: "giảm so với trước" = kỳ vọng không được duy trì → MIXED
```

---

## Phần 5: Khi nào dùng

**Tình huống 1: Bài toán toán học hoặc logic đa bước.**
Khi câu trả lời đúng phụ thuộc vào chuỗi tính toán có thứ tự, CoT giúp model không bỏ qua bước trung gian — mỗi bước là anchor cho bước tiếp theo.

**Tình huống 2: Phân tích nhân quả hoặc lập luận pháp lý.**
Khi bạn cần model lý giải *tại sao* nó đưa ra kết luận, không chỉ *kết quả gì*. Đặc biệt quan trọng khi kết quả cần được kiểm tra lại bởi con người.

**Tình huống 3: Debugging prompt phức tạp.**
Khi model cho kết quả sai và bạn không hiểu tại sao, thêm CoT để xem model "nghĩ" gì ở mỗi bước — từ đó tìm được điểm mà reasoning đi sai hướng.

---

## Phần 6: Khi nào KHÔNG dùng

**Anti-pattern 1: Câu hỏi đơn giản, câu trả lời trực tiếp.**
Hỏi "Thủ đô của Pháp là gì?" mà thêm CoT chỉ khiến model sinh token thừa và tăng latency. Dùng khi: câu hỏi đòi hỏi ít nhất 2 bước suy luận phụ thuộc nhau.

**Anti-pattern 2: Latency-sensitive production systems.**
CoT sinh thêm 50-200 tokens cho reasoning steps. Với API calls tính phí theo token và hệ thống real-time, đây là chi phí không nhỏ. Thay thế: dùng CoT ở offline batch processing, hoặc cache kết quả CoT cho các câu hỏi lặp lại.

**Anti-pattern 3: Kỳ vọng CoT sửa được mọi loại lỗi.**
CoT cải thiện *reasoning errors*, không phải *knowledge errors*. Nếu model không biết một sự kiện, CoT không giúp được — nó chỉ tạo ra "confident wrong reasoning". Thay thế: kết hợp với Grounding (RAG) khi thiếu knowledge.

---

## Phần 7: Gotchas & Pitfalls

**Gotcha 1: "Confident wrong reasoning"**
Model có thể tạo ra một chuỗi suy luận trông hợp lý nhưng sai từ bước đầu. Nguy hiểm vì người đọc tin vào logic được trình bày. Phát hiện: so sánh kết quả CoT với kết quả từ một reasoning path khác. Sửa: dùng **Self-consistency** — sample nhiều lần với temperature > 0 và lấy đa số.

**Gotcha 2: Reasoning steps không phải là "suy nghĩ thật"**
Token trong CoT là output, không phải internal computation. Model không thực sự "tính toán" ở đó — nó đang *sinh ngôn ngữ mô tả* quá trình tính toán. Hai thứ này khác nhau. Đừng tin tuyệt đối vào CoT như mathematical proof.

**Gotcha 3: Few-shot examples làm bias kết quả**
Nếu ví dụ few-shot CoT của bạn toàn là POSITIVE sentiment, model sẽ lean về POSITIVE. Format của examples ảnh hưởng đến reasoning pattern. Sửa: diversify examples, kiểm tra với adversarial cases trước khi deploy.

**Gotcha 4: Trigger phrase hiệu quả khác nhau theo model**
"Let's think step by step" hiệu quả với nhiều model, nhưng không phải tất cả. Claude thường respond tốt hơn với "Think carefully and systematically." Kiểm tra: benchmark trên dataset mẫu của bạn trước khi chọn trigger cố định.

---

## Phần 8: Kết nối với các keyword khác

→ **In-context Learning** (đã học): CoT là một dạng in-context learning. Bạn dạy model pattern "reason step by step" ngay trong prompt, không cần fine-tune.

→ **Temperature & Sampling** (đã học): Self-consistency CoT yêu cầu sample nhiều reasoning paths — temperature > 0 mới tạo ra diversity cần thiết cho việc vote đa số.

→ **Hallucination & Grounding** (đã học): CoT giảm hallucination do *reasoning errors*, nhưng không giảm hallucination do *knowledge gaps*. Hai nguồn lỗi khác nhau, cần tool khác nhau.

→ **Agent Loop** (đã học): ReAct pattern — agent trong vòng lặp think/act/observe — là Chain of Thought được mở rộng với khả năng gọi tools. CoT là building block của ReAct.

→ **Tree of Thought** (sắp học): Mở rộng CoT từ một chuỗi tuyến tính thành một cây các reasoning paths song song, với backtracking.

---

## Phần 9: Tự kiểm tra (5 câu hỏi mở)

**Q1:** Giải thích Chain of Thought bằng ngôn ngữ của bạn — tại sao việc viết ra các bước trung gian lại cải thiện kết quả của LLM về mặt kỹ thuật?

**Q2:** Bạn đang xây dựng tool phân tích hợp đồng pháp lý và cần model giải thích lý do nó đánh dấu một điều khoản là rủi ro. CoT có phù hợp không? Thiết kế prompt như thế nào?

**Q3:** Một chatbot real-time cần trả lời trong dưới 1 giây. Bạn có dùng CoT trực tiếp không? Nếu không, làm thế nào để vẫn có được độ chính xác cần thiết?

**Q4:** CoT và Grounding giải quyết hai vấn đề khác nhau của LLM. Phân biệt rõ: loại lỗi nào CoT xử lý được, loại nào cần Grounding?

**Q5:** Nếu trong tương lai LLM có "internal scratchpad" thực sự (không phải output tokens), CoT có còn cần thiết không? Điều gì sẽ thay đổi và điều gì sẽ không?

---

## Phần 10: Bài tập 24h

**Task:** Xây dựng một "reasoning quality evaluator" nhỏ.

1. Lấy 10 câu hỏi toán học lớp 5 (tìm trên Google hoặc tự nghĩ).
2. Gửi mỗi câu hỏi hai lần: một lần không CoT, một lần với "Let's think step by step."
3. Ghi lại: accuracy (đúng/sai), số tokens sinh ra, quality (bạn tự đánh giá 1-5 dựa trên reasoning rõ ràng không).
4. Tạo một bảng so sánh kết quả.

**Acceptance criteria:**
- [ ] 10 câu hỏi được test với cả 2 conditions (20 API calls tổng)
- [ ] Bảng so sánh accuracy: CoT vs không CoT
- [ ] Ít nhất 1 ví dụ "confident wrong reasoning" từ CoT được ghi lại
- [ ] Ít nhất 1 ví dụ CoT bị over-verbose (quá nhiều steps không cần thiết)
- [ ] Kết luận viết tay: với loại bài toán này, CoT có đáng dùng không và tại sao?

**Thời gian ước tính:** 45-60 phút

**Hint:** Dùng `max_tokens=50` cho non-CoT call và `max_tokens=500` cho CoT call để tránh truncation.

---

## Self-test Answers (đọc sau khi đã tự trả lời)

**Q1:** LLM sinh token tuyến tính — token trước là context cho token sau. Khi bạn buộc model viết "Bước 1: X, Bước 2: Y", bước 2 được điều kiện hóa trực tiếp trên bước 1 đã xuất hiện trong context. Model không nhảy cóc vì mỗi bước là anchor cho bước tiếp theo. Bạn đang dùng context window như scratch paper.

**Q2:** CoT rất phù hợp ở đây vì: (1) bạn cần interpretability — người dùng phải hiểu *tại sao* điều khoản bị flag, (2) phân tích pháp lý là multi-step reasoning. Prompt mẫu: "Phân tích điều khoản sau. Đầu tiên liệt kê các yếu tố rủi ro tiềm ẩn, sau đó đánh giá mức độ từng yếu tố, cuối cùng kết luận mức rủi ro tổng thể và lý do."

**Q3:** Không dùng CoT trực tiếp trong luồng real-time. Thay thế: (1) pre-compute CoT cho các câu hỏi phổ biến và cache kết quả, (2) dùng CoT trong offline evaluation để tune prompts, sau đó deploy prompt đã optimize, (3) dùng smaller model với fine-tuning trên CoT-generated data.

**Q4:** CoT xử lý *reasoning errors* — model biết đủ facts nhưng suy luận sai do bỏ qua bước trung gian. Grounding xử lý *knowledge errors* — model không có thông tin đúng (hallucinate hoặc outdated). Ví dụ: tính sai 60×2.5 → CoT fix. Nhớ sai ngày ký hiệp định → Grounding fix.

**Q5:** Nếu LLM có internal scratchpad thực sự (như Extended Thinking của Claude), zero-shot CoT sẽ ít cần thiết hơn vì model tự làm điều đó. Tuy nhiên, few-shot CoT vẫn có giá trị để định hình *cách* model cấu trúc reasoning cho domain cụ thể — format và structure của output vẫn cần hướng dẫn qua ví dụ.
