---
title: "Reflection / Self-critique: LLM tự phê bình để cải thiện output"
description: "Reflection là kỹ thuật prompting yêu cầu model tự đánh giá output của chính nó theo tiêu chí cụ thể, rồi viết lại dựa trên phê bình đó. Thay vì chấp nhận câu trả lời đầu tiên, bạn thêm một bước critique để model chuyển từ vai author sang reviewer. Kỹ thuật này đặc biệt hiệu quả với code generation, writing, và các task có tiêu chí chất lượng rõ ràng."
locale: "vi"
translationKey: "reflection-self-critique"
publishedAt: 2026-05-07
pillar: "ai"
type: "article"
draft: false
---

## TL;DR

**Reflection** là kỹ thuật prompting yêu cầu model tự đánh giá output của chính nó theo tiêu chí cụ thể, rồi viết lại dựa trên phê bình đó. Thay vì chấp nhận câu trả lời đầu tiên, bạn thêm một bước "critique" để model chuyển từ vai author sang reviewer. Kỹ thuật này đặc biệt hiệu quả với code generation, writing, và các task có tiêu chí chất lượng rõ ràng.

---

## Phần 1: Vấn đề nó giải quyết

Một kỹ sư dùng LLM để generate code Python đọc file CSV. Model trả về code chạy được — nhưng không handle file không tồn tại, không xử lý cột thiếu, không có type hints. Kỹ sư phải đọc từng dòng, tìm ra lỗi, prompt lại: "Thêm error handling." Model sửa. Rồi lại phát hiện thêm vấn đề khác.

Câu hỏi: tại sao model không tự phát hiện lỗi ngay từ đầu?

Model tạo output theo một chiều duy nhất — không có bước "nhìn lại" có cấu trúc. Khi bạn thêm bước critique, model chuyển từ vai "author" sang "reviewer". Reviewer thường phát hiện được những gì author bỏ sót.

---

## Phần 2: Định nghĩa chính xác

**Reflection** là quy trình: (1) model tạo output ban đầu, (2) model phê bình output đó dựa trên tiêu chí cụ thể, (3) model viết lại dựa trên phê bình.

Phân biệt với các kỹ thuật liên quan:

| Kỹ thuật | Cơ chế cải thiện | Số lần infer |
|---|---|---|
| Self-consistency | Majority vote, N paths song song | N |
| Reflection | Critique → revise tuần tự | 2+ |
| Chain of Thought | Lập luận từng bước, 1 pass | 1 |

Kỹ thuật này xuất hiện trong "Self-Refine" (Madaan et al., 2023) và "Reflexion" (Shinn et al., 2023). Constitutional AI của Anthropic cũng dùng critique/revision loop.

Phân biệt thêm: *self-critique* (cùng model tự phê bình) vs *cross-critique* (model A phê bình output model B).

---

## Phần 3: Cách hoạt động

```
Prompt ban đầu
    │
    ▼
┌──────────────────┐
│  Generate (G)    │  ← tạo output v1
└──────────────────┘
    │
    ▼
┌──────────────────┐
│  Critique (C)    │  ← phê bình theo tiêu chí cụ thể
│  "v1 thiếu X,    │
│   chưa handle Y" │
└──────────────────┘
    │
    ▼
┌──────────────────┐
│  Refine (R)      │  ← viết lại dựa trên critique
│  Output v2       │
└──────────────────┘
    │
    ▼
Đủ chất lượng? ──Không──→ Lặp lại C→R (tối đa 2-3 vòng)
    │
   Có
    ▼
Output cuối
```

**Bước 1 — Generate**: Prompt bình thường, lấy output v1.

**Bước 2 — Critique**: Prompt riêng: "Review output theo các tiêu chí [A, B, C]. Chỉ ra điểm yếu cụ thể. Nếu đạt, viết PASS."

**Bước 3 — Refine**: "Dựa trên critique sau, viết lại để khắc phục các vấn đề đã chỉ ra."

Lặp tối đa 2-3 vòng. Sau 3 vòng, diminishing returns rõ rệt.

---

## Phần 4: Ví dụ cụ thể

### Ví dụ 1: Code generation với self-critique

```python
import anthropic

client = anthropic.Anthropic()

def generate_with_reflection(task: str, criteria: list[str], max_rounds: int = 2) -> str:
    # Bước 1: Generate
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        messages=[{"role": "user", "content": task}]
    )
    output = response.content[0].text

    for round_num in range(max_rounds):
        criteria_str = "\n".join(f"- {c}" for c in criteria)

        # Bước 2: Critique
        critique = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=400,
            messages=[
                {"role": "user", "content": task},
                {"role": "assistant", "content": output},
                {"role": "user", "content": f"Tìm lỗi trong output trên theo tiêu chí:\n{criteria_str}\n\nNếu không có lỗi, viết PASS."}
            ]
        ).content[0].text

        if "PASS" in critique:
            break

        # Bước 3: Refine
        output = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            messages=[
                {"role": "user", "content": task},
                {"role": "assistant", "content": output},
                {"role": "user", "content": f"Critique:\n{critique}\n\nViết lại để khắc phục các vấn đề trên."}
            ]
        ).content[0].text
        print(f"Round {round_num + 1}: refined")

    return output

result = generate_with_reflection(
    task="Viết hàm Python đọc file CSV và tính tổng cột 'price'.",
    criteria=[
        "Xử lý file không tồn tại",
        "Xử lý cột 'price' không tồn tại",
        "Xử lý giá trị non-numeric",
        "Có type hints và docstring"
    ]
)
print(result)
```

### Ví dụ 2: Critique email draft

```python
def critique_and_refine_email(draft: str) -> dict:
    critique_prompt = f"""Email draft:
---
{draft}
---
Đánh giá theo 3 tiêu chí:
1. Subject line có rõ mục đích không?
2. Call-to-action có cụ thể không?
3. Tone có phù hợp (professional, không quá formal) không?

Với mỗi tiêu chí: PASS hoặc chỉ ra vấn đề cụ thể."""

    critique = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=300,
        messages=[{"role": "user", "content": critique_prompt}]
    ).content[0].text

    refined = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=500,
        messages=[{"role": "user", "content": f"Email gốc:\n{draft}\n\nCritique:\n{critique}\n\nViết lại email để khắc phục điểm yếu."}]
    ).content[0].text

    return {"critique": critique, "refined": refined}
```

---

## Phần 5: Khi nào nên dùng

**Scenario 1: Code generation với yêu cầu chất lượng cao**
Code cần handle edge cases, có error handling đúng, tuân thủ coding standards. Một lần generate thường bỏ sót. Critique pass với checklist cụ thể (error handling, typing, tests) catch được phần lớn thiếu sót mà không cần kỹ sư đọc từng dòng.

**Scenario 2: Writing với tone và style requirements**
Email chuyên nghiệp, technical documentation, marketing copy — những task có tiêu chí đánh giá rõ ràng nhưng khó embed hết vào một prompt. Reflection tách "generate" và "review" thành hai passes riêng biệt, mỗi pass tập trung vào một vai.

**Scenario 3: Quality gate trong agent loop**
Agent thực hiện một hành động (gọi API, viết file) rồi tự hỏi "output này có đúng với mục tiêu ban đầu không?" trước khi tiếp tục bước sau. Ngăn lỗi lan rộng qua nhiều bước.

---

## Phần 6: Khi nào KHÔNG nên dùng

**Anti-pattern 1: Task không có tiêu chí đánh giá rõ ràng**
Nếu bạn không viết được critique prompt cụ thể, reflection chỉ tạo ra verbose revision mà không cải thiện thực chất. "Hãy làm tốt hơn" không phải critique — đó là wishful thinking. Trước khi dùng reflection, tự hỏi: "Tôi có thể liệt kê 3-5 tiêu chí cụ thể không?" Nếu không, đừng dùng.

**Anti-pattern 2: Latency không chấp nhận được**
Mỗi round reflection thêm 2 API calls (critique + refine). 3 rounds = 7 calls tổng cộng. Với real-time applications, đây là chi phí không khả thi. Thay thế: tối ưu kỹ prompt gốc để generate ra output tốt ngay lần đầu, hoặc pre-generate và cache.

**Anti-pattern 3: Câu hỏi factual ngắn**
"Thủ đô Việt Nam là gì?" — critique không thêm giá trị. Reflection có hiệu quả với output dài, nhiều chiều; không phải với lookup đơn giản có đáp án rõ ràng.

---

## Phần 7: Gotchas & Pitfalls

**Gotcha 1: Model đồng ý với chính mình quá dễ**
Self-critique có bias: model thường PASS output của chính nó trừ khi bạn prompt theo hướng adversarial. "Tìm lỗi trong output sau" hiệu quả hơn "Review output sau". Framing giả định có vấn đề tồn tại sẽ ra critique tốt hơn.

**Gotcha 2: Sycophantic refinement**
Model nhận critique rồi "sửa" bằng cách thêm text mà không thực sự fix vấn đề. Output v2 dài hơn v1 nhưng vấn đề gốc vẫn còn. Fix: sau mỗi refine, chạy thêm một critique pass để verify vấn đề đã thực sự được giải quyết.

**Gotcha 3: Không có exit condition → infinite loop**
Không đặt max_rounds, model critique mãi với task phức tạp không có đáp án hoàn hảo. Đặt tối đa 2-3 rounds và dùng "PASS" signal như ví dụ trên.

**Gotcha 4: Critique quá chung chung làm loãng focus**
"Check for any issues" → model chỉ ra 10 vấn đề nhỏ không quan trọng. "Check: (1) error handling, (2) type hints, (3) docstring" → model focus đúng chỗ. Tiêu chí càng cụ thể, critique càng hữu ích.

---

## Phần 8: Kết nối với các keyword khác

→ **Chain of Thought** *(đã học)*: CoT giúp model lập luận tốt hơn trong một pass. Reflection thêm pass "nhìn lại" sau khi đã có output. Kết hợp: dùng CoT trong generate pass, criteria-based critique trong review pass.

→ **Self-consistency** *(đã học)*: self-consistency chọn câu trả lời tốt nhất từ nhiều paths song song. Reflection cải thiện một path duy nhất qua nhiều vòng tuần tự. Hai kỹ thuật bổ sung nhau: dùng self-consistency khi cần confidence, dùng reflection khi cần chất lượng.

→ **Agent Loop** *(đã học)*: reflection là quality check tự nhiên trong agent loop. Agent generate → critique → refine → tiếp tục task. Ngăn lỗi tích lũy qua nhiều bước.

→ **Hallucination & Grounding** *(đã học)*: critique pass có thể fact-check: "Claim nào trong output này cần nguồn? Claim nào có thể sai?" Adversarial critique giảm hallucination hiệu quả.

→ **Prompt Optimization** *(sắp học)*: critique criteria trong reflection chính là bộ tiêu chí để đánh giá prompt tốt. Khi bạn tối ưu prompt, bạn đang "hardcode" tiêu chí critique vào prompt gốc — về bản chất là cùng một việc.

---

## Phần 9: Tự kiểm tra

**Q1**: Giải thích sự khác biệt giữa reflection và đơn giản là prompt lại model với "Hãy cải thiện output này."

**Q2**: Bạn dùng reflection để cải thiện code generation. Sau 3 rounds, output vẫn không pass critique về error handling. Vấn đề có thể nằm ở đâu và bạn sẽ debug như thế nào?

**Q3**: Trong trường hợp nào self-consistency phù hợp hơn reflection, và ngược lại?

**Q4**: Tại sao "Tìm lỗi trong code sau" hiệu quả hơn "Review code sau" khi dùng làm critique prompt?

**Q5**: Nếu bạn dùng model khác cho critique pass thay vì self-critique, khi nào điều này tốt hơn và khi nào không cần thiết?

---

## Phần 10: Bài tập (24h challenge)

**Bài tập**: Xây dựng "writing coach" dùng reflection để cải thiện đoạn văn tiếng Anh.

**Yêu cầu**:
- Input: một đoạn văn tiếng Anh 100-200 từ (tự viết hoặc lấy từ email cũ)
- Critique theo 3 tiêu chí: (1) clarity, (2) conciseness, (3) active voice ratio
- Refine dựa trên critique
- In ra: đoạn gốc, critique, đoạn đã cải thiện, và word count comparison

**Acceptance criteria**:
- [ ] Critique chỉ ra ít nhất 1 vấn đề cụ thể (không phải toàn PASS)
- [ ] Refined version không dài hơn original
- [ ] Refined version dùng active voice nhiều hơn original
- [ ] Code chạy với ít nhất 2 đoạn văn khác nhau

**Thời gian ước tính**: 45 phút

**Gợi ý**: Dùng Claude Haiku cho critique pass (đủ để check 3 tiêu chí đơn giản, rẻ hơn). Dùng Claude Sonnet cho refine pass (cần tạo văn bản chất lượng).

---

## Self-test Answers (đọc sau khi đã tự trả lời)

**Q1**: Prompt đơn giản "hãy cải thiện" không có tiêu chí cụ thể — model tự chọn gì cần sửa, thường là những thứ dễ thay vì quan trọng nhất. Reflection có critique prompt riêng với tiêu chí tường minh, buộc model "đổi vai" từ author sang reviewer trước khi revise. Sự tách biệt vai trò này là điểm cốt lõi.

**Q2**: Vấn đề có thể là: (1) critique prompt không đủ cụ thể về loại error handling nào cần check, (2) model thiếu kiến thức về edge case cụ thể của use case, (3) yêu cầu trong task mâu thuẫn nhau. Debug: in ra critique của từng round để xem model chỉ ra vấn đề gì cụ thể, rồi adjust criteria hoặc thêm ví dụ cụ thể vào prompt.

**Q3**: Self-consistency phù hợp hơn khi: câu hỏi có đáp án rõ ràng, cần confidence estimate, hoặc task có thể song song hóa. Reflection phù hợp hơn khi: output cần cải thiện theo tiêu chí cụ thể, task là writing/code (không phải chọn đáp án đúng), hoặc khi cần reasoning tốt hơn trong output cuối.

**Q4**: "Tìm lỗi" là adversarial framing — model bị đẩy vào vai critic với giả định có lỗi cần tìm. "Review" để lại cửa cho model kết luận "output đã tốt" mà không cần effort. Framing tốt: giả định có vấn đề và yêu cầu tìm, không hỏi liệu có vấn đề không.

**Q5**: Dùng model khác tốt hơn khi: muốn tránh self-serving bias, critique cần domain expertise mà model generate không có (ví dụ: model fine-tuned cho security review), hoặc muốn simulate different perspectives. Không cần thiết khi: task đủ đơn giản để self-critique hoạt động tốt, hoặc budget/latency không cho phép thêm call.
