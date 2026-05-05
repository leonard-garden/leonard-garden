---
title: "Tool use / Function calling — LLM học cách gọi công cụ bên ngoài"
description: "Tool use là cơ chế cho phép LLM yêu cầu hệ thống bên ngoài thực thi một hành động cụ thể — như gọi API, truy vấn database, hay đọc file. LLM không tự thực thi; nó chỉ trả về JSON mô tả tool nào cần gọi và với tham số gì. Ứng dụng host nhận JSON đó, thực thi tool, rồi trả kết quả lại để LLM tổng hợp câu trả lời."
locale: "vi"
translationKey: "tool-use"
publishedAt: 2026-05-05
pillar: "ai"
type: "article"
draft: false
---

## TL;DR

**Tool use** (hay *function calling*) là cơ chế cho phép LLM yêu cầu hệ thống bên ngoài thực thi một hành động cụ thể — như gọi API, truy vấn database, hay đọc file. LLM không tự thực thi; nó chỉ trả về JSON mô tả tool nào cần gọi và với tham số gì. Ứng dụng host nhận JSON đó, thực thi tool, rồi trả kết quả lại để LLM tổng hợp câu trả lời.

---

## 1. Vấn đề nó giải quyết

Nam xây chatbot hỗ trợ khách hàng cho công ty logistics. Khách hỏi: "Đơn hàng #12345 của tôi đang ở đâu?"

LLM biết cách viết câu trả lời lịch sự. Nhưng nó không biết trạng thái đơn hàng — dữ liệu đó nằm trong database nội bộ, không có trong training data. Không có tool use, chatbot chỉ có thể nói: *"Xin lỗi, tôi không có thông tin về đơn hàng của bạn."*

Đây là giới hạn cốt lõi của LLM: giỏi suy luận trên text, nhưng bị cô lập hoàn toàn khỏi thế giới thực. Tool use phá vỡ giới hạn đó. LLM có thể nói "Tôi cần gọi `get_order_status(order_id=12345)`" — và ứng dụng sẽ lo phần còn lại.

---

## 2. Định nghĩa chính xác

**Tool use** (tên trong Anthropic API) hay **function calling** (tên trong OpenAI API) là cơ chế mà LLM trả về một *structured request* — thay vì text thuần — để yêu cầu thực thi một hàm cụ thể.

LLM **không** thực thi hàm đó. Nó chỉ output: "Tôi muốn gọi hàm X với tham số Y." Ứng dụng host quyết định có thực thi không, và trả kết quả lại.

Phân biệt với các khái niệm gần:

- **RAG**: inject context vào prompt *trước* khi LLM xử lý — thụ động. Tool use là LLM *chủ động yêu cầu* thêm thông tin khi cần.
- **Agent loop** (keyword #05): tool use là *một bước* trong agent loop. Loop = nhiều vòng [LLM → tool → kết quả → LLM].
- **Grounding**: tool use là *một cơ chế* để ground LLM vào dữ liệu thật, không phải khái niệm ngang hàng.

---

## 3. Cơ chế hoạt động

Quy trình 4 bước:

```
[1] Developer định nghĩa tool schema (JSON Schema)
         ↓
[2] LLM nhận prompt + danh sách tools → quyết định có cần tool không
         ↓
[3] Nếu cần → LLM trả về tool_use block (tên tool + tham số)
         ↓
[4] Host thực thi tool → trả kết quả → LLM tổng hợp câu trả lời
```

Dưới hood, danh sách tools được nhúng vào context như một phần của system prompt. LLM học cách nhận dạng khi nào cần tool và output JSON đúng format.

Với Anthropic API, khi LLM cần tool, response có `stop_reason: "tool_use"` — báo hiệu LLM đang chờ kết quả, chưa hoàn thành. Bạn phải tiếp tục conversation bằng cách gửi tool result.

```
User:       "Nhiệt độ Hà Nội hôm nay?"
Assistant:  [tool_use] get_weather(city="Hanoi", unit="celsius")
Tool:       {"temperature": 32, "condition": "sunny"}
Assistant:  "Hà Nội hôm nay 32°C, trời nắng."
```

---

## 4. Ví dụ cụ thể

### Ví dụ 1: Define tool và gọi API

```python
import anthropic

client = anthropic.Anthropic()

tools = [
    {
        "name": "get_weather",
        "description": "Lấy thời tiết hiện tại của một thành phố",
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "Tên thành phố"},
                "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]}
            },
            "required": ["city"]
        }
    }
]

response = client.messages.create(
    model="claude-opus-4-7",
    max_tokens=1024,
    tools=tools,
    messages=[{"role": "user", "content": "Thời tiết Hà Nội hôm nay?"}]
)

# Kiểm tra LLM có gọi tool không
if response.stop_reason == "tool_use":
    tool_block = next(b for b in response.content if b.type == "tool_use")
    print(f"Tool: {tool_block.name}")
    print(f"Params: {tool_block.input}")
    # Tool: get_weather
    # Params: {'city': 'Hà Nội', 'unit': 'celsius'}
```

### Ví dụ 2: Vòng lặp đầy đủ — gửi kết quả tool trở lại

```python
import json

def execute_tool(name: str, params: dict) -> str:
    if name == "get_weather":
        return json.dumps({"temperature": 32, "condition": "sunny"})
    return json.dumps({"error": "unknown tool"})

response = client.messages.create(
    model="claude-opus-4-7",
    max_tokens=1024,
    tools=tools,
    messages=[{"role": "user", "content": "Thời tiết Hà Nội?"}]
)

tool_block = next(b for b in response.content if b.type == "tool_use")
result = execute_tool(tool_block.name, tool_block.input)

final = client.messages.create(
    model="claude-opus-4-7",
    max_tokens=1024,
    tools=tools,
    messages=[
        {"role": "user", "content": "Thời tiết Hà Nội?"},
        {"role": "assistant", "content": response.content},
        {"role": "user", "content": [
            {
                "type": "tool_result",
                "tool_use_id": tool_block.id,
                "content": result
            }
        ]}
    ]
)
print(final.content[0].text)
# "Hà Nội hôm nay 32°C, trời nắng."
```

---

## 5. Khi nào nên dùng

**Scenario 1: LLM cần dữ liệu real-time**
Giá cổ phiếu, thời tiết, tỷ giá, trạng thái đơn hàng — bất cứ thứ gì thay đổi sau training cutoff. Tool use là cách duy nhất để LLM truy cập dữ liệu này.

**Scenario 2: LLM cần thực hiện hành động có side effect**
Tạo calendar event, gửi email, cập nhật database. LLM không nên trực tiếp truy cập hệ thống; tool use tạo lớp kiểm soát rõ ràng giữa LLM và hành động thực.

**Scenario 3: Cần structured output đáng tin cậy**
Khi trích xuất dữ liệu có schema cố định (parse địa chỉ, phân loại ticket), tool use enforce JSON schema chặt hơn "hãy trả JSON trong markdown code block".

---

## 6. Khi nào KHÔNG nên dùng

**Anti-pattern 1: Tool cho tác vụ thuần text**
Bạn define `format_date(date: str)` chỉ để đổi "2024-01-15" thành "15/01/2024". LLM có thể làm điều này trong text thuần. Tool use thêm một round-trip không cần thiết, tăng latency và token cost. → Dùng tool khi cần truy cập external resource hoặc thực thi side effect thật.

**Anti-pattern 2: Quá nhiều tools cùng lúc**
Đưa 50 tools vào một request khiến LLM khó chọn đúng tool, tăng token consumption, và giảm accuracy. Giới hạn 10–15 tools là hợp lý. → Nếu cần nhiều hơn, dùng tool router để chọn subset phù hợp theo context.

**Anti-pattern 3: Tool thay thế conversation**
Tool `clarify_question(question: str)` để LLM hỏi lại user — không cần thiết. LLM hỏi trực tiếp trong text response là đủ.

---

## 7. Gotchas & Pitfalls

**Gotcha 1: Quên kiểm tra `stop_reason`**
Nếu code chỉ lấy `response.content[0].text` mà không kiểm tra `stop_reason == "tool_use"`, bạn nhận `AttributeError` vì content block là `tool_use` type, không có `.text`. Luôn check `stop_reason` trước khi đọc text.

**Gotcha 2: LLM hallucinate tool parameters**
LLM đôi khi truyền tham số sai format hoặc sai kiểu dữ liệu — ví dụ `"limit": "10"` (string) thay vì `"limit": 10` (int). Luôn validate input trước khi gọi tool thật, đặc biệt với side-effect tools.

**Gotcha 3: `tool_use_id` không khớp**
Anthropic API yêu cầu `tool_result` phải có `tool_use_id` khớp chính xác với ID trong tool call block. Nếu sai hoặc thiếu, API trả lỗi. Luôn copy `tool_block.id` vào tool result, không hardcode.

**Gotcha 4: Tool description quyết định khi nào LLM dùng**
LLM chọn tool dựa hoàn toàn vào description. Description mơ hồ → LLM gọi sai lúc hoặc bỏ qua khi cần. Viết rõ use case và giới hạn.

**Gotcha 5: Parallel tool calls**
Claude có thể gọi nhiều tools *đồng thời* trong một response. Code phải handle danh sách, không chỉ một call. Dùng `[b for b in response.content if b.type == "tool_use"]` thay vì `next(...)`.

---

## 8. Kết nối với các keyword khác

→ **Agent loop** (#05, sắp tới): tool use là bước cốt lõi trong agent loop. Loop = vòng lặp [LLM → tool use → kết quả → LLM] cho đến khi hoàn thành.

→ **Grounding / RAG** (#08, đã học): tool use là cơ chế grounding chủ động. Thay vì inject context tĩnh như RAG, tool use cho LLM *tự hỏi* dữ liệu cần thiết đúng lúc.

→ **Context window** (#02, đã học): mỗi tool call + result tiêu tốn tokens. Với nhiều vòng tool use, context window fill nhanh hơn dự kiến — cần theo dõi usage.

→ **MCP protocol** (#14, sắp tới): MCP chuẩn hóa cách expose tools cho LLMs. Tool use là nguyên lý; MCP là implementation standard.

→ **Prompt injection** (#10, sắp tới): tool results là điểm tấn công phổ biến — nội dung từ tool có thể chứa instructions override LLM behavior.

---

## 9. Tự kiểm tra

1. Giải thích tool use bằng lời của bạn — không nhìn bài. LLM thực sự làm gì khi "gọi tool"? Ai thực thi code?

2. Bạn đang xây chatbot tra cứu giá sản phẩm từ database nội bộ. Mô tả schema cho tool `search_products` mà bạn sẽ define — tên fields, types, required/optional.

3. Khi nào bạn sẽ *không* dùng tool use, dù tác vụ liên quan đến dữ liệu bên ngoài?

4. So sánh tool use với RAG: khi nào dùng cái nào? Hai cơ chế có thể kết hợp không?

5. Nếu tool của bạn fetch nội dung từ URL do user cung cấp, rủi ro bảo mật nào có thể xảy ra? Bạn xử lý thế nào?

---

## 10. Bài tập 24h

**Xây một mini tool-use pipeline hoàn chỉnh.**

1. Define ít nhất 2 tools với schema rõ ràng (ví dụ: `get_stock_price` + `calculate_percentage_change`)
2. Implement vòng lặp xử lý tool calls — không hardcode cho 1 tool
3. Handle trường hợp LLM không gọi tool (trả lời thẳng)
4. Handle parallel tool calls (LLM gọi 2 tools cùng lúc)
5. Test với 3 câu hỏi: 1 cần 1 tool, 1 cần 2 tools, 1 không cần tool

**Acceptance criteria:**
- [ ] Chạy được với cả 3 test case, không crash
- [ ] `tool_use_id` copy đúng từ tool call vào tool result
- [ ] Parallel calls không bị bỏ sót
- [ ] Ít nhất 1 tool dùng mock external data

Thời gian: 45–60 phút. *Hint*: Mở rộng từ Ví dụ 2 ở Part 4.

---

## Self-test Answers (đọc sau khi tự trả lời)

**Q1**: LLM không thực thi tool. Nó output JSON block `{type: "tool_use", name: "...", input: {...}}`. Ứng dụng host thực thi hàm thật rồi gửi kết quả lại trong message tiếp theo.

**Q2**: Fields cần có: `query` (string, required) — từ khóa tìm; `category` (string, optional) — lọc theo danh mục; `limit` (integer, optional, default 10). Description phải nói rõ "dùng khi user hỏi về giá, tồn kho, thông tin sản phẩm cụ thể".

**Q3**: Không dùng khi: dữ liệu đã có trong context (inject nhanh hơn), tác vụ thuần text (format/translate), hoặc latency của round-trip không chấp nhận được.

**Q4**: RAG inject context *trước* khi LLM xử lý — phù hợp với knowledge base tĩnh, semantic search. Tool use LLM *chủ động hỏi* — phù hợp với real-time data, side effects. Kết hợp được: tool `search_kb` fetch documents → result làm grounding context.

**Q5**: Prompt injection. Trang web do user cung cấp có thể chứa "Ignore previous instructions..." — tool result inject thẳng vào context LLM. Xử lý: whitelist domain, sanitize content, hoặc giới hạn length của tool result.
