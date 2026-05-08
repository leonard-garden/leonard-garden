---
title: "Determinism trong LLMs"
description: "Determinism trong LLM là tính chất một model luôn trả về cùng kết quả cho cùng một input. LLM không deterministic theo mặc định do cơ chế sampling ngẫu nhiên và sự không nhất quán của floating-point trên các phần cứng khác nhau. Ngay cả khi đặt temperature=0, kết quả vẫn có thể thay đổi nhỏ giữa các lần gọi."
locale: "vi"
translationKey: "determinism"
publishedAt: 2026-05-08
pillar: "ai"
type: "article"
draft: false
---

## TL;DR

**Determinism** trong LLM là tính chất một model luôn trả về cùng kết quả cho cùng một input. LLM không deterministic theo mặc định do cơ chế sampling ngẫu nhiên và sự không nhất quán của floating-point trên các phần cứng khác nhau. Ngay cả khi đặt `temperature=0`, kết quả vẫn có thể thay đổi nhỏ giữa các lần gọi.

---

## Part 1: Vấn đề nó giải quyết

Một team QA đang viết test suite cho feature summarization. Họ hard-code expected output vào test: `assert response == "Bài viết nói về AI và tương lai."`. Test pass hôm nay. Sáng hôm sau, cùng code, cùng prompt — test fail vì model trả về "Nội dung bài viết thảo luận về AI và tác động của nó." Không có code nào thay đổi. Team mất 3 tiếng debug trước khi nhận ra: LLM không deterministic.

Vấn đề: developer quen với deterministic systems (database query, REST API, pure function) mặc định assume LLM cũng như vậy. Khi assumption đó sai, cả testing strategy lẫn production monitoring đều hỏng.

---

## Part 2: Định nghĩa chính xác

**Determinism** là tính chất của một hệ thống luôn trả về cùng output cho cùng input, không phụ thuộc vào thời điểm hay môi trường chạy. LLM là *stochastic* (xác suất) theo thiết kế — ở mỗi bước generation, model không chọn token có xác suất cao nhất mà sample từ phân phối xác suất.

Phân biệt với các khái niệm dễ nhầm:

| Loại | Ý nghĩa | Ví dụ |
|------|---------|-------|
| Deterministic | Cùng input → cùng output, luôn luôn | `sorted([3,1,2])` → `[1,2,3]` |
| Stochastic | Cùng input → output ngẫu nhiên mỗi lần | LLM với temperature>0 |
| Pseudo-deterministic | Reproducible với cùng random seed | LLM với seed cố định (same hardware) |

LLM ≠ database. Đừng test LLM output bằng exact-match assertion.

---

## Part 3: Cơ chế hoạt động

### Tại sao LLM stochastic?

Ở mỗi bước generation, model tính probability distribution trên toàn bộ vocabulary:

```
Input: "The sky is"
Logits: [blue=0.45, dark=0.20, clear=0.18, red=0.10, ...]

Temperature=0 (greedy):   chọn "blue" (argmax) — mostly deterministic
Temperature=1.0 (sample): sample từ distribution — stochastic
Temperature=2.0 (hot):    flatten distribution → more random
```

**Greedy decoding** (temperature=0): luôn chọn token có logit cao nhất.
**Sampling** (temperature>0): sample ngẫu nhiên theo phân phối — output thay đổi mỗi lần.

### Các nguồn non-determinism

```
1. Temperature > 0
   └─ Sampling ngẫu nhiên → output thay đổi mỗi lần

2. Floating-point operations
   ├─ GPU A: 0.4500001 × 0.3 = 0.13500003
   ├─ GPU B: 0.4500001 × 0.3 = 0.13500004
   └─ Khác 1 bit → argmax có thể chọn token khác!

3. Parallel computation
   └─ a + b + c ≠ c + b + a ở bit cuối với float → thứ tự
      tính toán song song ảnh hưởng kết quả

4. Batching
   └─ Xử lý prompt đơn vs trong batch → floating-point
      accumulation khác → output khác dù temperature=0
```

### Tham số ảnh hưởng đến randomness

| Parameter | Effect | Range |
|-----------|--------|-------|
| `temperature` | Scale logits trước softmax | 0 (greedy) → ∞ (uniform) |
| `top_p` | Nucleus sampling — sample từ top tokens tích lũy p% | (0, 1] |
| `top_k` | Chỉ sample từ k tokens xác suất cao nhất | ≥1 |
| `seed` | Pseudo-random seed (OpenAI hỗ trợ, Claude không) | integer |

---

## Part 4: Ví dụ cụ thể

### Ví dụ 1: Temperature ảnh hưởng thế nào

```python
import anthropic

client = anthropic.Anthropic()
prompt = "Viết một từ duy nhất mô tả bầu trời ban ngày."

# Chạy 3 lần với temperature=0
for i in range(3):
    msg = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=10,
        temperature=0,
        messages=[{"role": "user", "content": prompt}],
    )
    print(f"t=0, run {i+1}: {msg.content[0].text.strip()}")
# t=0, run 1: Xanh
# t=0, run 2: Xanh
# t=0, run 3: Xanh  ← rất nhất quán

# Chạy 3 lần với temperature=1.0
for i in range(3):
    msg = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=10,
        temperature=1.0,
        messages=[{"role": "user", "content": prompt}],
    )
    print(f"t=1, run {i+1}: {msg.content[0].text.strip()}")
# t=1, run 1: Xanh
# t=1, run 2: Bầu
# t=1, run 3: Trong trẻo  ← thay đổi mỗi lần
```

### Ví dụ 2: Test LLM output đúng cách

```python
import re

def test_summarization(document: str):
    response = call_llm(document)

    # ❌ Sai: exact match — test này sẽ flaky
    # assert response == "Bài viết nói về AI."

    # ✅ Đúng: test structural properties
    assert 20 < len(response) < 300, f"Độ dài bất thường: {len(response)}"
    assert re.search(r"AI|trí tuệ nhân tạo", response, re.IGNORECASE), \
        "Summary không đề cập đến chủ đề chính"

    # ✅ Tốt hơn: dùng LLM-as-judge
    verdict = judge_llm(
        f"Does this summary capture the main topic accurately? "
        f"Answer YES or NO only.\n\nSummary: {response}"
    )
    assert verdict.strip().upper() == "YES"
```

---

## Part 5: Khi nào nên dùng temperature thấp

### Scenario 1: Structured output extraction

Khi cần extract JSON, code, hay data có format cụ thể. `temperature=0` giảm risk model tự thêm field hay format sai, giúp parsing downstream ổn định hơn. Một response malformed JSON là đủ để crash pipeline.

### Scenario 2: Factual Q&A với knowledge base đã biết

Khi câu hỏi có một đáp án đúng duy nhất ("API endpoint này nhận parameter nào?", "Năm nào công ty thành lập?"). Temperature thấp giúp model bám vào fact thay vì "sáng tạo" thêm chi tiết không có trong context.

### Scenario 3: CI/CD testing và automated evals

Khi chạy eval để detect regression. `temperature=0` giảm variance do sampling — noise trong kết quả phản ánh thực sự sự thay đổi của model/prompt, không phải randomness từ sampling.

---

## Part 6: Khi nào KHÔNG dùng temperature thấp

### Anti-pattern 1: Creative tasks với temperature=0

Viết quảng cáo, brainstorm ý tưởng, generate story variations — đây là usecase cần diversity. `temperature=0` cho output repetitive và "safe". Kết quả giống nhau mỗi lần là bug, không phải feature, khi user muốn variety. Dùng `temperature=0.7-1.0`.

### Anti-pattern 2: Hard-code expected output vào test

Đặt `temperature=0` rồi viết `assert response == "expected string"` là sai. Floating-point và batching vẫn gây non-determinism. Thay vào đó: test structural properties (độ dài, key terms, format) hoặc dùng LLM-as-judge.

### Anti-pattern 3: Dùng `seed` parameter như silver bullet

OpenAI's `seed` giúp reproducibility nhưng chỉ trong cùng model version — document rõ là "best-effort". Sau model update, `seed` không đảm bảo cùng output. Đừng build critical logic dựa vào determinism tuyệt đối từ `seed`.

---

## Part 7: Gotchas & Pitfalls

### Gotcha 1: temperature=0 không đảm bảo bit-for-bit identical

Floating-point operations trên GPU không associative. Khi provider update infrastructure, thứ tự tính toán thay đổi → output khác nhau dù `temperature=0`. Dấu hiệu: kết quả mostly giống nhưng có ~1-5% variation không giải thích được. Sửa: không bao giờ dùng exact-match assertion cho LLM output.

### Gotcha 2: Model alias silently updates

`claude-haiku-4-5` hôm nay và sau update vẫn cùng tên API nhưng output có thể khác. Anthropic thường cung cấp version pin (`claude-haiku-4-5-20251001`) nếu cần stability tuyệt đối trong production. Pinning tránh silent behavior change.

### Gotcha 3: Prompt nhỏ thay đổi → output thay đổi nhiều

Thêm dấu chấm, đổi thứ tự ví dụ, hay thay đổi whitespace trong prompt đều ảnh hưởng output. LLM cực kỳ sensitive với prompt wording. Không có cách nào tránh điều này ngoài testing với nhiều prompt variations.

### Gotcha 4: Non-determinism trong eval tạo false regression signals

Nếu eval không account for variance, một score drop từ 87% → 84% có thể chỉ là sampling noise, không phải regression thật. Chạy eval nhiều lần rồi lấy trung bình, hoặc dùng statistical significance test trước khi kết luận có regression.

---

## Part 8: Kết nối với các keyword khác

→ **Token / Tokenization** (đã học, #01): Non-determinism xảy ra ở token level — model chọn token tiếp theo từ phân phối xác suất trên toàn bộ vocabulary.

→ **Hallucination & Grounding** (đã học, #06): Temperature cao → model "sáng tạo" hơn → nhiều hallucination hơn. Low temperature giảm hallucination nhưng không loại trừ hoàn toàn.

→ **In-context learning** (đã học, #07): Thêm few-shot examples thay đổi distribution của output — ảnh hưởng đến cả determinism lẫn quality của response.

→ **Eval basics** (sắp học, #25): Determinism ảnh hưởng trực tiếp đến eval design — phải account for variance khi đánh giá model performance, không thể dùng single-run results.

→ **LLM-as-judge** (sắp học, #26): Thay vì exact-match assertion, dùng LLM để evaluate semantic correctness — giải pháp đúng cho testing stochastic systems.

---

## Part 9: Self-test

**Q1**: Giải thích tại sao LLM không deterministic theo mặc định. Nêu ít nhất 2 nguồn non-determinism khác nhau.

**Q2**: Bạn cần viết automated test cho feature "summarize document". Mô tả cụ thể strategy test đúng — những gì nên và không nên assert.

**Q3**: Khi nào bạn muốn output của LLM *không* deterministic? Đưa ra 2 usecase cụ thể và giải thích tại sao diversity là desirable.

**Q4**: So sánh `temperature=0` với `seed` parameter (OpenAI). Cái nào cho reproducibility tốt hơn và trong điều kiện nào? Khi nào cả hai đều không đủ?

**Q5**: LLM output trong production bỗng dưng thay đổi dù không có code change. List ít nhất 3 nguyên nhân có thể và cách kiểm tra từng nguyên nhân.

---

## Part 10: Exercise (24h challenge)

**Task**: Đo variance của LLM output ở các temperature khác nhau, sau đó so sánh 2 testing strategies.

**Acceptance criteria**:
1. Gọi model với cùng prompt 10 lần ở mỗi mức: temperature=0, 0.5, 1.0
2. In ra: tỷ lệ output giống hệt nhau (exact match), độ dài trung bình, và 1 ví dụ output khác biệt nhất
3. Xác nhận bằng số liệu: temperature=0 có ít unique outputs hơn temperature=1.0
4. Viết 2 test functions: `test_exact_match()` và `test_semantic_check()` — chạy 5 lần mỗi cái và ghi lại pass/fail rate
5. Kết luận 2-3 câu: testing strategy nào stable hơn và tại sao

**Estimated time**: 30-45 phút

**Hint**: Dùng `claude-haiku-4-5` với prompt ngắn ("Viết 1 câu mô tả mùa xuân.") để tiết kiệm token. `collections.Counter` giúp đếm unique outputs nhanh.

---

## Self-test Answers (đọc sau khi tự trả lời)

**Q1**: LLM stochastic vì (1) sampling — ở mỗi bước model sample token từ phân phối xác suất thay vì luôn chọn token cao nhất; (2) floating-point không associative trên GPU — thứ tự accumulation trong parallel computation cho bit-level differences ngay cả khi không có sampling; (3) batching — xử lý cùng prompt trong batch vs đơn cho numerical differences nhỏ.

**Q2**: Test đúng: assert structural properties (độ dài hợp lý, key topics được đề cập, format đúng), không dùng exact-match. Tốt nhất: dùng LLM-as-judge để evaluate semantic correctness với câu hỏi Yes/No. Không nên: `assert response == "expected"` hay compare với snapshot cố định.

**Q3**: (1) Brainstorming ý tưởng marketing — user muốn 5 ý tưởng khác nhau, không phải cùng một ý 5 lần; (2) Generate story variations cho A/B test — cần diversity về cách diễn đạt để tìm version nào resonates với user. Trong cả hai case, diversity là value proposition, không phải bug.

**Q4**: `temperature=0` dễ dùng, available ở tất cả APIs, giảm variance đáng kể cho practical purposes. `seed` (OpenAI) cho reproducibility tốt hơn trong short-term nhưng chỉ best-effort và không work cross-model-version. Cả hai đều không đủ khi: model version update, infrastructure change, hoặc cần guarantee 100% identical output — không có cách nào đảm bảo điều đó với LLM.

**Q5**: Nguyên nhân có thể: (1) Model version update — provider update model với cùng alias, kiểm tra bằng cách log model metadata; (2) Prompt thay đổi không nhìn thấy — encoding issues, whitespace, invisible characters, kiểm tra bằng `repr(prompt)`; (3) Infrastructure change của provider — khác GPU batch strategy, khó detect từ ngoài; (4) Context/input thay đổi — document dài hơn, different tokenization; (5) Temperature hay parameter thay đổi — verify config không bị override.
