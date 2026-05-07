# Self-consistency: Bỏ phiếu đa số để tăng độ chính xác

## TL;DR

**Self-consistency** là kỹ thuật prompting chạy cùng một câu hỏi nhiều lần, thu thập nhiều chuỗi lập luận khác nhau, rồi chọn câu trả lời xuất hiện nhiều nhất. Kỹ thuật này xây trên Chain of Thought và đặc biệt hiệu quả với bài toán toán học, logic, và suy luận nhiều bước. Thay vì tin vào một câu trả lời duy nhất, bạn để model "tự bỏ phiếu" để chọn kết quả tin cậy nhất.

---

## Phần 1: Vấn đề nó giải quyết

Năm 2022, một kỹ sư tại Google đang dùng GPT-3 để giải các bài toán GSM8K — bài toán toán học tiểu học. Dù đã dùng Chain of Thought prompting, model vẫn sai khoảng 40% số bài. Điều khó chịu là: hỏi lại cùng câu hỏi đó, đôi khi model lại trả lời đúng.

Câu hỏi đặt ra: nếu model có thể tự tạo ra câu trả lời đúng, tại sao không tổng hợp nhiều lần thử để chọn câu trả lời tốt nhất?

Vấn đề gốc rễ là *greedy decoding*: model chỉ infer một lần và không có cơ chế tự kiểm tra. Một lỗi nhỏ ở bước đầu kéo cả chuỗi lập luận đi sai hướng.

---

## Phần 2: Định nghĩa chính xác

**Self-consistency** là phương pháp lấy mẫu N chuỗi lập luận (*reasoning paths*) độc lập từ cùng một câu hỏi, rồi chọn câu trả lời xuất hiện nhiều nhất bằng *majority voting*.

Phân biệt với các kỹ thuật liên quan:

| Kỹ thuật | Số lần infer | Cách chọn kết quả |
|---|---|---|
| CoT đơn lẻ | 1 | Lấy output đầu tiên |
| Self-consistency | N (thường 10-40) | Majority vote |
| Best-of-N | N | Dùng verifier/reranker chọn |

Kỹ thuật này không thay đổi model hay cần fine-tuning — chỉ thay đổi cách sampling.

---

## Phần 3: Cách hoạt động

Quy trình gồm 4 bước:

```
Câu hỏi (Q)
    │
    ▼
┌─────────────────────────────────────────┐
│  Sample N reasoning paths               │
│  (temperature > 0, ví dụ: 0.7)         │
│                                         │
│  Path 1: "A → B → C → Đáp án: 42"     │
│  Path 2: "A → D → E → Đáp án: 42"     │
│  Path 3: "A → F → G → Đáp án: 37"     │
│  Path 4: "A → B → H → Đáp án: 42"     │
│  Path 5: "A → I → J → Đáp án: 37"     │
└─────────────────────────────────────────┘
    │
    ▼
Majority Vote: 42 (xuất hiện 3/5 lần)
    │
    ▼
Kết quả cuối: 42
```

**Bước 1**: Viết CoT prompt với vài ví dụ few-shot (hoặc zero-shot CoT).

**Bước 2**: Sample N lần với temperature 0.5–0.8 để tạo sự đa dạng giữa các paths.

**Bước 3**: Trích xuất câu trả lời cuối từ mỗi reasoning path.

**Bước 4**: Majority vote — câu trả lời xuất hiện nhiều nhất là kết quả.

Paper gốc của Wang et al. (2022) dùng N=40 và đạt cải thiện 17.9% accuracy trên GSM8K so với CoT đơn lẻ.

---

## Phần 4: Ví dụ cụ thể

### Ví dụ 1: Bài toán toán học

```python
import anthropic
from collections import Counter

client = anthropic.Anthropic()

def self_consistency(question: str, n_samples: int = 7) -> str:
    prompt = f"""Giải từng bước rõ ràng, rồi viết đáp án cuối dạng "Đáp án: <số>".

Hỏi: {question}"""

    answers = []
    for _ in range(n_samples):
        response = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=300,
            temperature=0.7,  # > 0 để tạo đa dạng giữa các paths
            messages=[{"role": "user", "content": prompt}]
        )
        text = response.content[0].text
        # Trích xuất đáp án từ dòng chứa "Đáp án:"
        for line in text.split("\n"):
            if "Đáp án:" in line:
                answers.append(line.split("Đáp án:")[-1].strip())
                break

    if not answers:
        return "Không trích xuất được đáp án"

    winner, count = Counter(answers).most_common(1)[0]
    print(f"Phân bố: {dict(Counter(answers))}")
    print(f"Confidence: {count}/{len(answers)}")
    return winner

result = self_consistency(
    "Lan có 15 quyển sách. Lan tặng 1/3 cho bạn, rồi mua thêm 4 quyển. Lan còn bao nhiêu quyển?"
)
print(f"Đáp án: {result}")
# Phân bố: {'14': 5, '19': 1, '14 quyển': 1}
# Confidence: 5/7
# Đáp án: 14
```

### Ví dụ 2: Phân loại sentiment với confidence score

```python
def classify_with_consistency(review: str, n_samples: int = 7) -> dict:
    prompt = f"""Phân tích review sau và lập luận từng bước, sau đó kết luận bằng đúng một trong: POSITIVE / NEGATIVE / NEUTRAL.

Review: "{review}"

Kết luận: <POSITIVE/NEGATIVE/NEUTRAL>"""

    labels = []
    for _ in range(n_samples):
        response = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=200,
            temperature=0.6,
            messages=[{"role": "user", "content": prompt}]
        )
        text = response.content[0].text
        for label in ["POSITIVE", "NEGATIVE", "NEUTRAL"]:
            if f"Kết luận: {label}" in text:
                labels.append(label)
                break

    counter = Counter(labels)
    winner, count = counter.most_common(1)[0]
    return {
        "label": winner,
        "confidence": round(count / len(labels), 2),
        "distribution": dict(counter)
    }

result = classify_with_consistency("Sản phẩm tốt nhưng giao hàng chậm hơn dự kiến.")
print(result)
# {'label': 'NEUTRAL', 'confidence': 0.71, 'distribution': {'NEUTRAL': 5, 'POSITIVE': 2}}
```

---

## Phần 5: Khi nào nên dùng

**Scenario 1: Bài toán có đáp án rõ ràng (toán, logic, phân loại)**
Self-consistency hiệu quả nhất khi đáp án có thể so sánh và đếm được. Majority vote có nghĩa với "14" hay "NEGATIVE", không có nghĩa với "hãy viết một đoạn thơ".

**Scenario 2: Quyết định quan trọng, chi phí sai cao**
Khi một câu trả lời sai gây hậu quả nghiêm trọng — phân loại fraud, triage y tế, đánh giá rủi ro — self-consistency thêm lớp robustness. Nếu 8/10 paths đồng ý, bạn có thêm bằng chứng để tin vào kết quả.

**Scenario 3: Debug behavior của model**
Khi model ra kết quả kỳ lạ, chạy self-consistency để xem majority paths đi hướng nào. Nếu 9/10 paths nhất quán nhưng 1 path là outlier — vấn đề là prompt edge case, không phải model không biết.

---

## Phần 6: Khi nào KHÔNG nên dùng

**Anti-pattern 1: Câu hỏi sáng tạo, không có đáp án duy nhất đúng**
Majority vote vô nghĩa với "Viết tagline cho sản phẩm mới". Mỗi path sẽ ra kết quả khác nhau, không path nào "đúng hơn" path nào. Self-consistency sẽ chọn tagline "an toàn nhất", không phải sáng tạo nhất. Dùng single-pass với temperature phù hợp, rồi để con người chọn.

**Anti-pattern 2: Latency là ưu tiên**
N=10 nghĩa là 10x cost và 10x latency nếu chạy tuần tự. Với ứng dụng cần phản hồi dưới 1 giây, self-consistency không khả thi. Thay thế: dùng Claude với extended thinking, hoặc verify bằng một call riêng sau khi đã có kết quả ban đầu.

**Anti-pattern 3: Câu hỏi factual đơn giản**
"Thủ đô của Việt Nam là gì?" không cần 10 lần sample. Self-consistency chỉ có giá trị khi câu hỏi đủ phức tạp để model có thể sai bằng nhiều cách khác nhau.

---

## Phần 7: Gotchas & Pitfalls

**Gotcha 1: Temperature quá thấp → tất cả paths giống nhau**
Dùng temperature = 0 hoặc < 0.3, các paths sẽ gần như giống hệt nhau — không có diversity thật sự. Majority vote lúc này chỉ là một lần infer giả vờ thành nhiều lần. Cách kiểm tra: in ra tất cả N responses và đọc thử. Fix: tăng temperature lên 0.5–0.8.

**Gotcha 2: Parse error làm skew kết quả**
Nếu model đôi khi viết "Đáp án: 14 quyển" và đôi khi "14" — code trích xuất của bạn có thể bỏ sót paths. 3 paths bị drop do parse error sẽ làm confidence score sai lệch. Fix: dùng regex linh hoạt hơn, hoặc thêm instruction format cụ thể trong prompt.

**Gotcha 3: N quá nhỏ → kết quả không ổn định**
Với N=3, một path sai chiếm 33%. Với N=10, một path sai chỉ chiếm 10%. Paper gốc khuyến nghị N≥10 cho reasoning tasks phức tạp. Với bài toán đơn giản hơn, N=5 thường đủ.

**Gotcha 4: Majority vote không đảm bảo correctness**
Nếu câu hỏi vượt quá khả năng của model, majority có thể vote cho đáp án sai. Self-consistency cải thiện robustness, không đảm bảo accuracy. Khi confidence thấp (ví dụ: 3/10 vs 4/10 vs 3/10), đây là tín hiệu cần thêm context hoặc escalate.

---

## Phần 8: Kết nối với các keyword khác

→ **Chain of Thought** *(đã học)*: self-consistency là extension trực tiếp của CoT. Không có CoT prompt, không có reasoning paths đa dạng để aggregate.

→ **Temperature & Top-p** *(đã học)*: temperature kiểm soát mức diversity giữa các paths. Đây là tham số quan trọng nhất để self-consistency hoạt động — temperature = 0 phá vỡ toàn bộ kỹ thuật.

→ **Hallucination & Grounding** *(đã học)*: self-consistency giảm hallucination bằng cách lọc các reasoning paths bất thường qua majority vote. Một hallucination xuất hiện ở 1/10 paths sẽ không ảnh hưởng đến kết quả.

→ **In-context Learning** *(đã học)*: chất lượng few-shot examples trong CoT prompt ảnh hưởng trực tiếp đến chất lượng từng reasoning path. Ví dụ tốt hơn → paths tốt hơn → majority vote chính xác hơn.

→ **Prompt Optimization** *(sắp học)*: khi tối ưu prompt, bạn có thể dùng consistency score như một metric — prompt tốt hơn sẽ có consistency cao hơn (nhiều paths đồng ý hơn) trên cùng tập câu hỏi test.

---

## Phần 9: Tự kiểm tra

**Q1**: Giải thích self-consistency bằng lời của bạn mà không dùng thuật ngữ "majority vote" hay "reasoning path".

**Q2**: Bạn đang xây hệ thống phân loại email thành spam/không spam cho doanh nghiệp. Trong trường hợp nào bạn áp dụng self-consistency, và dùng N bằng bao nhiêu?

**Q3**: Sếp yêu cầu dùng self-consistency để generate tagline marketing. Bạn giải thích thế nào để thuyết phục họ đây không phải use case phù hợp?

**Q4**: So sánh self-consistency với Chain of Thought đơn lẻ: khi nào CoT đơn lẻ là đủ, và khi nào cần thêm self-consistency?

**Q5**: Giả sử có kỹ thuật "weighted self-consistency" — thay vì majority vote đơn giản, mỗi path được gán trọng số theo độ dài reasoning. Kỹ thuật này sẽ tốt hơn hay tệ hơn trong trường hợp nào?

---

## Phần 10: Bài tập (24h challenge)

**Bài tập**: Xây bộ giải bài toán toán học lớp 6 dùng self-consistency.

**Yêu cầu**:
- Input: 5 bài toán lớp 6 (tự chọn hoặc lấy từ sách giáo khoa)
- Chạy self-consistency với N=7, temperature=0.7
- In ra: đáp án majority vote, tỉ lệ vote (ví dụ: 5/7), và phân bố tất cả đáp án khác nhau
- So sánh với đáp án đúng

**Acceptance criteria**:
- [ ] Code chạy được với ít nhất 5 bài toán
- [ ] Hiển thị confidence score (tỉ lệ vote) cho mỗi bài
- [ ] Ít nhất 3/5 bài toán có confidence ≥ 5/7
- [ ] Có ít nhất 1 bài toán mà self-consistency đúng nhưng CoT đơn lẻ (1 lần chạy) sai

**Thời gian ước tính**: 45 phút

**Gợi ý**: Dùng Claude Haiku để giảm cost khi test. Với 5 bài × 7 samples = 35 calls, Haiku sẽ rất rẻ.

---

## Self-test Answers (đọc sau khi đã tự trả lời)

**Q1**: Self-consistency chạy cùng một câu hỏi nhiều lần, thu thập nhiều cách giải khác nhau, rồi chọn câu trả lời xuất hiện nhiều nhất. Giống như hỏi 10 người bạn cùng một câu toán, rồi tin vào câu trả lời mà đa số đồng ý.

**Q2**: Phân loại spam có đáp án rõ ràng (spam/không spam) — đây là use case tốt. Dùng N=7–10 cho các email ranh giới (borderline cases), đặc biệt khi chi phí false positive (block email quan trọng) hoặc false negative (spam lọt qua) cao. Với email rõ ràng là spam, N=3 là đủ.

**Q3**: Tagline marketing không có đáp án "đúng" duy nhất — mỗi tagline có thể hay theo cách khác nhau. Majority vote sẽ chọn tagline "an toàn nhất", không phải sáng tạo nhất. Thay vào đó, dùng single-pass với temperature cao để generate nhiều options, rồi để con người chọn.

**Q4**: CoT đơn lẻ đủ khi: câu hỏi đơn giản, latency quan trọng, budget hạn chế, hoặc câu hỏi mở không có đáp án duy nhất. Cần self-consistency khi: câu hỏi phức tạp nhiều bước, chi phí sai cao, cần confidence estimate, hoặc đang debug behavior của model.

**Q5**: Weighted self-consistency theo độ dài reasoning có thể tốt hơn với bài toán phức tạp cần nhiều bước — reasoning dài chứng tỏ model xem xét kỹ hơn. Nhưng sẽ tệ hơn nếu model có xu hướng "overthink" và sinh ra reasoning dài nhưng sai. Không có bằng chứng rõ ràng rằng reasoning dài hơn đồng nghĩa chính xác hơn.
