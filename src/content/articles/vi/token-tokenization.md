---
title: "Token & Tokenization — Đơn vị cơ bản LLM nhìn thấy"
description: "Token là đơn vị nhỏ nhất mà LLM xử lý — không phải ký tự, không phải từ. Tokenization là quá trình chuyển text thành chuỗi token trước khi đưa vào model. Hiểu token giúp bạn debug lỗi context limit, tối ưu chi phí API, và giải thích tại sao model \"đọc\" tiếng Anh rẻ hơn tiếng Việt."
locale: "vi"
translationKey: "token-tokenization"
publishedAt: 2026-05-02
pillar: "ai"
type: "article"
draft: false
---

## TL;DR

Token là đơn vị nhỏ nhất mà LLM xử lý — không phải ký tự, không phải từ. Tokenization là quá trình chuyển text thành chuỗi token trước khi đưa vào model. Hiểu token giúp bạn debug lỗi context limit, tối ưu chi phí API, và giải thích tại sao model "đọc" tiếng Anh rẻ hơn tiếng Việt.

---

## 1. Vấn đề nó giải quyết

Một developer dùng GPT-3 để phân tích hồ sơ tiếng Nhật. Model trả về kết quả sai liên tục. Debug mãi mới ra: model không "đọc" tiếng Nhật theo ký tự mà theo chunk — và chunk đó không khớp với boundary ngữ nghĩa của tiếng Nhật.

Bài toán gốc rễ: neural network cần đơn vị xử lý có ngữ nghĩa, nhưng ký tự thì quá nhỏ (26 chữ cái không đủ thông tin), còn từ thì quá nhiều (tiếng Anh có hơn 170,000 từ trong từ điển — vocabulary không thể manage được). Tokenization giải quyết bài toán này bằng cách tìm đơn vị ở giữa: sub-word units cân bằng giữa kích thước vocabulary và khả năng biểu diễn ngữ nghĩa.

---

## 2. Định nghĩa chính xác

**Token** là đơn vị văn bản mà LLM xử lý. Một token có thể là:
- Một từ hoàn chỉnh: `"hello"` → 1 token
- Một phần từ: `"unbelievable"` → `"un"` + `"believ"` + `"able"` → 3 tokens
- Một ký tự đặc biệt hoặc dấu câu: `"!"` → 1 token
- Whitespace kèm từ: `" hello"` (có dấu cách đầu) → 1 token khác với `"hello"`

**Tokenization** là quá trình chuyển đổi chuỗi text thành chuỗi token ID (số nguyên) để đưa vào model.

Phân biệt với các khái niệm dễ nhầm:
- Token ≠ Word: "ChatGPT" là 1 từ nhưng có thể là 2+ tokens
- Token ≠ Character: 1 token thường = 3–4 ký tự (với tiếng Anh)
- Token ≠ Syllable: boundary token do thuật toán học từ corpus, không theo ngữ âm học

*BPE* (Byte Pair Encoding) là thuật toán tokenization phổ biến nhất. Tên "Byte Pair" đến từ cách gốc nó merge các cặp byte xuất hiện nhiều nhất — giờ áp dụng cho character pairs.

---

## 3. Cơ chế hoạt động

BPE chạy theo 2 giai đoạn:

**Training (offline — xây vocabulary):**
```
1. Bắt đầu với vocabulary = tập ký tự đơn lẻ
2. Đếm tần suất mọi cặp token liền kề trong corpus
3. Merge cặp có tần suất cao nhất thành 1 token mới
4. Lặp lại cho đến khi đạt vocabulary size target (vd: 50,000 tokens)
```

**Inference (online — encode text mới):**
```
Input text → split thành ký tự → áp dụng merge rules theo thứ tự đã học → chuỗi token IDs
```

Ví dụ flow encode từ `"lower"`:
```
"lower"
→ [l, o, w, e, r]        # bắt đầu từ ký tự đơn
→ [lo, w, e, r]          # merge "l"+"o" vì cặp này phổ biến
→ [low, e, r]            # merge "lo"+"w"
→ [lower]                # merge "low"+"er" vì "-er" suffix rất phổ biến
→ [1234]                 # token ID trong vocabulary
```

Với tiếng Việt, vì xuất hiện ít hơn trong training corpus, nhiều từ bị split nhỏ hơn:
```
"tokenization" → ~4 tokens (tiếng Anh, từ kỹ thuật phổ biến)
"mã hóa token" → 7+ tokens (tiếng Việt, ít phổ biến hơn trong corpus)
```

---

## 4. Ví dụ cụ thể

**Ví dụ 1: Đếm tokens với tiktoken**

```python
import tiktoken

# cl100k_base là encoding của GPT-4 — dùng để minh họa concept
# Claude dùng tokenizer riêng, nhưng behavior tương tự
enc = tiktoken.get_encoding("cl100k_base")

texts = [
    "Hello, world!",
    "Xin chào thế giới!",
    "1234567890",
    "unbelievable",
]

for text in texts:
    tokens = enc.encode(text)
    print(f"{repr(text):30} → {len(tokens):2} tokens")
```

Output (minh họa — IDs thực tế phụ thuộc version):
```
'Hello, world!'                →  4 tokens
'Xin chào thế giới!'          →  9 tokens   # ~2x so với bản dịch tiếng Anh
'1234567890'                   →  5 tokens   # số dài bị split
'unbelievable'                 →  4 tokens   # sub-word pieces
```

**Ví dụ 2: Whitespace ảnh hưởng đến token boundary**

```python
import tiktoken

enc = tiktoken.get_encoding("cl100k_base")

# Dấu cách đầu tạo token khác nhau
print(enc.encode("hello"))   # vd: [15339]
print(enc.encode(" hello"))  # vd: [24748]  ← token ID khác!
print(enc.encode("Hello"))   # vd: [9906]   ← capitalization cũng tạo token khác!
```

Đây là lý do model đôi khi inconsistent với casing và punctuation — chúng là các token khác nhau trong vocabulary.

---

## 5. Khi nào cần hiểu tokenization

**Tình huống 1: Debug lỗi "context too long"**

Bạn paste một file 500 dòng vào Claude và gặp lỗi context limit. Nếu biết tokenization, bạn ước tính được: 500 dòng code ≈ 5,000–8,000 tokens — gần limit của một số config. Thay vì thử lại ngẫu nhiên, bạn quyết định split file hoặc chuyển sang model có context lớn hơn.

**Tình huống 2: Tối ưu chi phí API**

Claude API tính phí theo token. Nếu system prompt dùng nhiều số định dạng phức tạp như `1,234,567.89`, mỗi số có thể tốn 4–6 tokens. Viết lại thành `1234567.89` tiết kiệm token mà không mất thông tin.

**Tình huống 3: Giải thích output inconsistency**

Tại sao model hay viết sai chính tả các từ hiếm gặp? Từ hiếm bị split thành nhiều tokens, model phải reconstruct từ từ các mảnh nhỏ — training signal yếu hơn nhiều so với từ phổ biến được biểu diễn bằng 1 token nguyên vẹn.

---

## 6. Khi nào KHÔNG nên "nghĩ theo token"

**Anti-pattern 1: Đếm token thủ công khi viết prompt**

Viết prompt và liên tục lo "câu này mấy token, có vừa không" là premature optimization. Viết tự nhiên trước, đo bằng tool sau nếu thực sự cần tối ưu.

**Anti-pattern 2: Assume tiếng Anh luôn rẻ hơn**

Code (nhiều ký tự đặc biệt), số lớn, và từ kỹ thuật dài vẫn tốn nhiều token dù là tiếng Anh. Đo thực tế thay vì giả định mọi text tiếng Anh đều là 1 token/word.

**Anti-pattern 3: Viết prompt cộc lốc để "tiết kiệm token"**

Prompt mơ hồ 100 tokens + 3 lần retry tốn nhiều hơn prompt rõ ràng 200 tokens trả lời đúng ngay. Context đầy đủ là đầu tư, không phải lãng phí.

---

## 7. Gotchas & Pitfalls

**Gotcha 1: Số và date format tokenize khác bạn nghĩ**

`"2024"` có thể là 1 token. `"2,024"` là 2–3 tokens. `"2024-01-01"` lại khác nữa. Format của numbers và dates ảnh hưởng token count — và đôi khi ảnh hưởng cách model reasoning về chúng.

**Gotcha 2: Vocabulary khác nhau giữa các model**

Claude, GPT-4, và Llama dùng tokenizer khác nhau. Token count tính với tiktoken không áp dụng chính xác cho Claude. Để đo chính xác cho Claude, dùng Anthropic API endpoint `count_tokens` hoặc ước tính với hệ số điều chỉnh.

**Gotcha 3: Emoji và Unicode tốn tokens nhiều hơn trông thấy**

Emoji như 🚀 chiếm 2–3 tokens vì là multi-byte UTF-8. System prompt production chứa nhiều emoji là lãng phí token thực sự.

**Gotcha 4: Token boundary có thể ảnh hưởng code generation**

Ký tự đặc biệt trong code như `__init__` đôi khi bị split thành `__` + `init` + `__`. Model phải reconstruct lại — không phổ biến nhưng xảy ra, đặc biệt với syntax lạ.

**Gotcha 5: "1 token ≈ 4 chars" là rule of thumb, không phải law**

Đúng cho English prose. Code thường 3–4 chars/token. Tiếng Việt/Trung/Nhật thường 1–2 chars/token vì mỗi syllable thành 1 token riêng. Tính nhẩm sẽ sai nếu không biết điều này.

---

## 8. Kết nối với keyword khác

→ **Context window** (sẽ học): Context window đo bằng tokens, không phải ký tự hay từ. Không hiểu tokenization thì giới hạn context chỉ là con số vô nghĩa.

→ **Prompt caching** (sẽ học): Cache hoạt động ở token level — prefix token sequence phải giống nhau mới được cache. Thiết kế prompt cho caching đòi hỏi nghĩ theo token boundary.

→ **Hallucination & Grounding** (sẽ học): Model hallucinate từ hiếm một phần vì từ đó bị split thành nhiều tokens nhỏ và training signal yếu hơn.

→ **Determinism in LLMs** (sẽ học): Temperature sampling xảy ra ở token level — mỗi bước model chọn 1 token từ probability distribution. Đây là nguồn gốc của non-determinism.

→ **Observability** (sẽ học): Monitoring cost và performance của LLM app cần track input tokens, output tokens, và cached tokens riêng biệt — tất cả đều là tokens.

---

## 9. Self-test

Trả lời các câu sau **không nhìn bài**, viết ra giấy hoặc gõ ra trước khi xem đáp án:

**Q1:** Giải thích tokenization cho người không biết kỹ thuật: tại sao LLM không đọc text theo ký tự, và cũng không đọc theo từ?

**Q2:** Bạn build chatbot hỗ trợ tiếng Việt. Chi phí API cao hơn dự kiến 40%. Tokenization có thể là nguyên nhân không? Giải thích cụ thể.

**Q3:** Khi nào thì không nên cố viết prompt ngắn để "tiết kiệm token"?

**Q4:** Context window 200,000 tokens tương đương khoảng bao nhiêu trang văn bản tiếng Anh? Bao nhiêu trang tiếng Việt? (Ước tính, dùng rule of thumb)

**Q5:** Tại sao token boundary ảnh hưởng đến việc model có thể viết sai chính tả một số từ nhất định?

---

## 10. Bài tập 24h

**Task:** Phân tích token cost thực tế của một đoạn text bạn dùng thường xuyên.

**Mô tả:** Lấy một system prompt hoặc prompt template bạn hay dùng, phân tích token composition của nó để tìm cơ hội tối ưu.

**Steps:**
1. Cài tiktoken: `pip install tiktoken`
2. Encode đoạn text qua `cl100k_base` — in ra từng token và ID
3. Tính tỷ lệ chars/token — so với rule of thumb 4 chars/token
4. Tìm 3 đoạn tốn tokens nhiều nhất
5. Viết lại phiên bản optimized, giảm ≥10% token count mà không mất thông tin quan trọng

**Acceptance criteria:**
- [ ] Script Python chạy được, output danh sách tokens
- [ ] Xác định được 3 đoạn tốn tokens nhiều nhất, giải thích được tại sao (không chỉ nói "có nhiều tokens")
- [ ] Có phiên bản optimized giảm ≥10% token count
- [ ] Ghi lại 1 điều bạn không ngờ tới khi thực hiện

**Estimated time:** 45–60 phút

---

## Đáp án Self-test (đọc sau khi tự trả lời)

**Q1:** Ký tự đơn lẻ quá nhỏ để mang nghĩa — model cần quá nhiều bước để hiểu 1 từ. Từ hoàn chỉnh thì vocabulary quá lớn (hàng trăm nghìn entries), model không học được đủ. Token là trung gian: sub-word units đủ nhỏ để vocabulary manageable (~50k tokens), đủ lớn để mang semantic signal.

**Q2:** Có. Tiếng Việt xuất hiện ít hơn trong training corpus của hầu hết tokenizer, nên nhiều từ bị split thành nhiều tokens nhỏ. Cùng ý nghĩa, tiếng Việt có thể tốn 1.5–2x tokens so với tiếng Anh. Để verify: đo thực tế với `count_tokens` API của Anthropic thay vì ước tính.

**Q3:** Khi viết ngắn làm mất context khiến model trả lời sai → phải retry → tốn nhiều token hơn prompt đầy đủ ban đầu. Một prompt rõ ràng 200 tokens thường rẻ hơn prompt mơ hồ 100 tokens cộng 3 lần retry.

**Q4:** Rule of thumb: 1 trang A4 tiếng Anh (~250–300 words) ≈ 350–400 tokens. 200k tokens ≈ 500–570 trang tiếng Anh. Tiếng Việt tốn tokens hơn → 200k tokens ≈ 300–400 trang tiếng Việt (ước tính, tùy loại nội dung).

**Q5:** Từ phổ biến được biểu diễn bằng 1 token nguyên vẹn — model có strong training signal để reproduce nó. Từ hiếm bị split thành 3–4 tokens, model phải predict từng mảnh tuần tự với ít training examples hơn — như ghép puzzle với ít dữ liệu, dễ mắc lỗi hơn.
