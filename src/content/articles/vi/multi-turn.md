---
title: "Multi-turn vs Single-turn — Hội thoại có trí nhớ và không có trí nhớ"
description: "Single-turn là mỗi request độc lập — model không nhớ gì từ lần trước. Multi-turn là chuỗi hội thoại liên tiếp — model thấy toàn bộ lịch sử và dùng nó để trả lời. Hiểu rõ hai mode này quyết định bạn thiết kế API call, tính chi phí, và quản lý context window như thế nào."
locale: "vi"
translationKey: "multi-turn"
publishedAt: 2026-05-07
pillar: "ai"
type: "article"
draft: false
---

## TL;DR

**Single-turn** là mỗi request độc lập — model không nhớ gì từ lần trước. **Multi-turn** là chuỗi hội thoại liên tiếp — model thấy toàn bộ lịch sử và dùng nó để trả lời. Hiểu rõ hai mode này quyết định bạn thiết kế API call, tính chi phí, và quản lý context window như thế nào.

---

## Part 1: Vấn đề nó giải quyết

Năm 2023, một developer xây dựng chatbot hỗ trợ khách hàng. Anh ta gọi API như sau:

```python
response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    messages=[{"role": "user", "content": "Tên tôi là Minh"}]
)

# Sau đó...
response2 = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    messages=[{"role": "user", "content": "Bạn có nhớ tên tôi không?"}]
)
```

Kết quả: model trả lời "Tôi không biết tên bạn." Khách hàng tức giận. Code không có lỗi — nhưng developer không hiểu rằng mỗi API call là độc lập hoàn toàn. Model không có bộ nhớ tự động.

Multi-turn giải quyết điều này bằng cách gửi kèm toàn bộ lịch sử hội thoại trong mỗi request.

---

## Part 2: Định nghĩa chính xác

**Single-turn**: Một request chứa duy nhất một message từ user (hoặc một system prompt + một user message). Model trả lời xong là kết thúc. Không có ngữ cảnh từ các request trước.

**Multi-turn**: Một request chứa danh sách messages xen kẽ `user` và `assistant`, tái hiện lại toàn bộ lịch sử hội thoại. Model thấy tất cả và dùng context đó để trả lời.

Phân biệt với các khái niệm dễ nhầm:

| Khái niệm | Có lịch sử? | Server lưu state? | Context window tăng? |
|---|---|---|---|
| Single-turn | ❌ | ❌ | Không |
| **Multi-turn** | ✅ | ❌ | ✅ mỗi turn |
| Stateful API | ✅ | ✅ | Tuỳ impl |

Claude API (và hầu hết LLM API) là *stateless*. Server không lưu gì. Multi-turn hoạt động vì *client* gửi lại toàn bộ lịch sử mỗi lần.

---

## Part 3: Cách hoạt động

### Single-turn

```
Client → [system, user_msg] → API → Response → (kết thúc)
```

### Multi-turn

```
Turn 1: Client → [system, user1]                               → API → assistant1
Turn 2: Client → [system, user1, assistant1, user2]            → API → assistant2
Turn 3: Client → [system, user1, assistant1, user2, assistant2, user3] → API → assistant3
```

Mỗi turn, client append thêm cặp (user, assistant) vào danh sách rồi gửi lại toàn bộ. Token count tăng tuyến tính với số lượng turn.

Cách implement với Claude API:

```python
conversation_history = []

def chat(user_message):
    conversation_history.append({
        "role": "user",
        "content": user_message
    })

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=conversation_history
    )

    assistant_message = response.content[0].text
    conversation_history.append({
        "role": "assistant",
        "content": assistant_message
    })

    return assistant_message
```

---

## Part 4: Ví dụ cụ thể

### Ví dụ 1: Single-turn — classification pipeline

Bạn cần phân loại 10,000 customer reviews. Mỗi review độc lập, không cần ngữ cảnh từ review trước.

```python
def classify_review(review_text):
    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=10,
        messages=[{
            "role": "user",
            "content": f"Classify as POSITIVE/NEGATIVE/NEUTRAL: {review_text}"
        }]
    )
    return response.content[0].text.strip()
```

Single-turn là đúng ở đây: mỗi call độc lập, rẻ, scale tốt.

### Ví dụ 2: Multi-turn — coding assistant

User hỏi về một đoạn code, rồi follow-up "làm thế nào để test nó?" — câu hỏi thứ hai vô nghĩa nếu không có context từ câu đầu.

```python
history = []

# Turn 1
history.append({"role": "user", "content": "Viết function tính fibonacci bằng Python"})
r1 = client.messages.create(model="claude-sonnet-4-6", max_tokens=500, messages=history)
history.append({"role": "assistant", "content": r1.content[0].text})

# Turn 2 — model biết "nó" là fibonacci function ở trên
history.append({"role": "user", "content": "Làm thế nào để test nó?"})
r2 = client.messages.create(model="claude-sonnet-4-6", max_tokens=500, messages=history)
# Output: test cases cụ thể cho fibonacci, không phải generic testing advice
```

---

## Part 5: Khi nào dùng

**Scenario 1: Batch processing các items độc lập**
Phân loại, tóm tắt, extract thông tin từ documents rời rạc. Không cần context giữa các items → single-turn rẻ hơn và scale tốt hơn.

**Scenario 2: Conversational UX**
Chatbot, coding assistant, customer support — bất kỳ flow nào user follow-up dựa trên câu trả lời trước. Multi-turn là bắt buộc.

**Scenario 3: Iterative refinement**
User yêu cầu viết một bài email, rồi "ngắn hơn một chút", rồi "formal hơn". Mỗi yêu cầu tinh chỉnh cần context của tất cả các bước trước.

---

## Part 6: Khi nào KHÔNG dùng

**Anti-pattern 1: Multi-turn cho tasks độc lập**
Bạn dùng multi-turn để phân loại reviews vì "tiện quản lý code". Kết quả: context từ review #1 ảnh hưởng classification của review #2, kết quả bị nhiễu. Dùng single-turn thay thế.

**Anti-pattern 2: Multi-turn không giới hạn turn count**
Conversation kéo dài 50 turns → context window gần đầy → model trả lời kém chất lượng hoặc trả về error. Implement sliding window (giữ N turns gần nhất) hoặc summarize history định kỳ.

**Anti-pattern 3: Nhầm conversation state với server memory**
Bạn expect rằng sau khi user reconnect, conversation vẫn tiếp tục. Nhưng nếu bạn không persist history vào database, state mất hoàn toàn. Multi-turn state là trách nhiệm của client, không phải API.

---

## Part 7: Gotchas & Pitfalls

**Gotcha 1: Token cost tăng theo số turn**
Turn 1: 100 tokens. Turn 10: có thể 1,000+ tokens chỉ vì history. Với nhiều concurrent users, chi phí tăng mạnh. Detect bằng cách log `response.usage.input_tokens` mỗi turn. Fix: truncate history sau N turns hoặc summarize.

**Gotcha 2: Context drift**
Sau 20+ turns, model có thể mâu thuẫn với thông tin từ đầu conversation. Không phải bug — đây là giới hạn của attention mechanism khi context quá dài. Fix: inject key facts vào system prompt thay vì chỉ để trong conversation history.

**Gotcha 3: Role phải xen kẽ đúng thứ tự**
Claude API yêu cầu messages xen kẽ `user` → `assistant` → `user`. Nếu append sai (hai `user` liên tiếp), API trả về validation error ngay lập tức. Fix: validate role sequence trước khi gửi request.

**Gotcha 4: History không được persist tự động**
Nếu server restart hoặc user reconnect mà không có database, conversation mất hoàn toàn. Multi-turn state phải được persist thủ công vào storage nếu cần durability.

---

## Part 8: Connections

→ **Context window** (đã học): Multi-turn làm context window đầy nhanh. Hiểu giới hạn context window giúp bạn quyết định khi nào cần truncate history.

→ **Token / Tokenization** (đã học): Input tokens trong mỗi multi-turn request bao gồm toàn bộ conversation history, không chỉ tin nhắn mới nhất. Cost tính trên tổng.

→ **System vs User prompt** (đã học): System prompt xuất hiện một lần nhưng tính vào input tokens của *mỗi* request. System prompt dài chiếm token "cố định" ở mọi turn.

→ **Prompt caching** (sắp học): Multi-turn với conversation history dài là use case chính của prompt caching — cache history cũ để giảm chi phí đáng kể.

→ **Agent loop** (đã học): Agent loop là multi-turn đặc biệt trong đó model tự generate các "turns" (tool results) mà không cần user input sau mỗi bước.

---

## Part 9: Self-test

**Q1**: Giải thích tại sao Claude API là stateless nhưng vẫn hỗ trợ multi-turn conversation. Ai chịu trách nhiệm lưu và gửi lại history?

**Q2**: Bạn đang xây dựng tool tóm tắt emails tự động — 500 emails mỗi ngày, mỗi email xử lý độc lập. Bạn chọn single-turn hay multi-turn? Giải thích lý do và những gì phải lưu ý.

**Q3**: Khi nào dùng multi-turn lại là sai lầm — cho dù UX trông có vẻ "cần conversation"?

**Q4**: So sánh cách multi-turn sử dụng context window với cách agent loop sử dụng context window. Điểm giống và khác nhau?

**Q5**: Nếu Claude API đột nhiên hỗ trợ server-side session memory (server tự lưu history), điều gì thay đổi về mặt kỹ thuật và chi phí? Có trade-off nào không?

---

## Part 10: Exercise (24h challenge)

**Task**: Xây dựng một CLI chatbot với multi-turn support và cost tracking.

**Yêu cầu**:
1. User gõ message, nhận response — loop cho đến khi gõ "quit"
2. Sau mỗi turn, in ra số tokens dùng trong turn này và tổng cộng từ đầu conversation
3. Tự động truncate khi conversation vượt quá 10 turns (giữ 5 turns gần nhất)
4. Persist history vào file JSON — khi restart, hỏi user có muốn load conversation cũ không
5. Khi thoát, in tổng chi phí ước tính (giả sử $3/1M input tokens, $15/1M output tokens)

**Estimated time**: 45-60 phút

**Hint**: `response.usage` trả về `input_tokens` và `output_tokens` cho mỗi request.

---

## Self-test Answers (đọc sau khi tự trả lời)

**Q1**: API stateless vì server không lưu bất kỳ state nào giữa các request. Multi-turn hoạt động vì client gửi lại toàn bộ conversation history (danh sách messages) trong mỗi request. Client — ứng dụng của bạn — chịu trách nhiệm lưu trữ và gửi lại history này.

**Q2**: Single-turn. Mỗi email là task độc lập, không cần context từ email khác. Multi-turn ở đây làm tăng token cost vô ích và có thể gây context contamination (thông tin email này ảnh hưởng phân tích email khác). Cần lưu ý: đảm bảo mỗi API call hoàn toàn độc lập, không share conversation history.

**Q3**: Khi các "turns" trong conversation thực ra là independent tasks đóng gói thành dialog format. Ví dụ: user hỏi 10 câu hỏi factual khác nhau liên tiếp — mỗi câu độc lập, không cần context của câu trước. Dùng multi-turn ở đây tăng cost và có thể gây confusion cho model.

**Q4**: Cả hai đều accumulate context theo thời gian. Điểm giống: mỗi step thêm vào context window, cost tăng theo. Điểm khác: multi-turn thêm human input, agent loop thêm tool results và model reasoning. Agent loop thường dày đặc hơn (tool outputs dài) nên context window đầy nhanh hơn.

**Q5**: Về kỹ thuật: client không cần gửi history → mỗi request nhỏ hơn → latency giảm. Về cost: có thể giảm input tokens nếu server xử lý compression hoặc caching. Trade-off: vendor lock-in, privacy concerns (server lưu conversation), khó debug (không inspect được full context). Nhiều use cases nhạy cảm (healthcare, finance) không muốn server lưu conversation data.
