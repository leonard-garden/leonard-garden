# ReAct Pattern — Vòng lặp suy luận và hành động của AI Agent

## TL;DR

**ReAct** (Reasoning + Acting) là pattern cho phép LLM xen kẽ suy luận và hành động trong một vòng lặp liên tục. Thay vì chỉ trả lời một lần, model quan sát → suy nghĩ → hành động cho đến khi hoàn thành nhiệm vụ. Claude Code và hầu hết AI agent hiện đại đều hoạt động dựa trên pattern này.

---

## Part 1: Vấn đề nó giải quyết

Trước khi ReAct xuất hiện, LLM chỉ có thể trả lời một lần dựa trên thông tin trong prompt. Bạn hỏi "File nào đang gây lỗi?" — model đoán mò vì nó không thể tự đọc file system.

Hãy tưởng tượng bạn cần Claude debug một production bug. Model đưa ra câu trả lời, nhưng không thể chạy lệnh để xác minh. Mọi "hành động" đều qua bạn: copy lệnh → chạy → paste kết quả → hỏi tiếp. Workflow này chậm và error-prone.

ReAct giải quyết bằng cách cho model tự thực hiện hành động, đọc kết quả thực tế, rồi điều chỉnh suy luận — không cần bạn làm trung gian sau mỗi bước.

---

## Part 2: Định nghĩa chính xác

**ReAct** là framework tích hợp hai khả năng: *Reasoning* (suy luận, viết ra chain of thought) và *Acting* (gọi tool, thực hiện action) trong cùng một inference loop. Paper gốc "ReAct: Synergizing Reasoning and Acting in Language Models" (Yao et al., 2022) cho thấy kết hợp này vượt trội so với dùng riêng lẻ từng khả năng.

Phân biệt với các khái niệm dễ nhầm:

| Approach | Suy luận | Hành động | Tự điều chỉnh |
|---|---|---|---|
| Chain of Thought | ✅ | ❌ | ❌ |
| Tool use đơn lẻ | ❌ | ✅ | ❌ |
| **ReAct** | ✅ | ✅ | ✅ |

ReAct không phải tên riêng của Claude Code. Đây là pattern tổng quát mà nhiều hệ thống triển khai theo cách khác nhau.

---

## Part 3: Cách hoạt động

ReAct chạy theo vòng lặp: **Observe → Think → Act → lặp lại**.

```
┌─────────────────────────────────────┐
│  Nhiệm vụ ban đầu (từ user)         │
└────────────────┬────────────────────┘
                 ▼
          ┌─────────────┐
          │   OBSERVE   │  ← Nhận thông tin (prompt, kết quả tool)
          └──────┬──────┘
                 ▼
          ┌─────────────┐
          │    THINK    │  ← "Tôi biết gì? Cần làm gì tiếp theo?"
          └──────┬──────┘
                 ▼
          ┌─────────────┐
          │     ACT     │  ← Gọi tool HOẶC trả lời cuối cùng
          └──────┬──────┘
                 │
     ┌───────────┴───────────┐
     ▼                       ▼
[Tool result]         [Final answer]
(quay lại OBSERVE)    (kết thúc loop)
```

Mỗi bước THINK, model viết explicit reasoning — không phải ẩn bên trong, mà là text thực sự trong response. Mỗi bước ACT, model chọn tool và truyền tham số. Tool trả về kết quả, model đọc (OBSERVE) và THINK lại.

Vòng lặp dừng khi:
1. Model quyết định đủ thông tin để trả lời cuối.
2. Đạt giới hạn số bước được định sẵn (safety stop).
3. Tool trả về lỗi không phục hồi được.

---

## Part 4: Ví dụ cụ thể

### Ví dụ 1: ReAct loop với Anthropic SDK

```python
import anthropic

client = anthropic.Anthropic()

tools = [
    {
        "name": "read_file",
        "description": "Đọc nội dung một file",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"}
            },
            "required": ["path"]
        }
    }
]

def run_tool(name, inputs):
    if name == "read_file":
        try:
            with open(inputs["path"]) as f:
                return f.read()[:2000]  # giới hạn output
        except FileNotFoundError:
            return f"Error: File not found: {inputs['path']}"

messages = [{"role": "user", "content": "Đọc requirements.txt và liệt kê các package"}]

# ReAct loop — tối đa 10 iterations
for i in range(10):
    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1024,
        tools=tools,
        messages=messages
    )

    if response.stop_reason == "end_turn":
        # [THINK + FINAL ANSWER]
        print(response.content[0].text)
        break

    # [ACT] Model muốn gọi tool
    tool_use = next(b for b in response.content if b.type == "tool_use")
    print(f"[ACT] {tool_use.name}({tool_use.input})")

    # [OBSERVE] Chạy tool thực sự
    result = run_tool(tool_use.name, tool_use.input)
    print(f"[OBSERVE] {result[:80]}...")

    # Cập nhật messages để loop tiếp
    messages.append({"role": "assistant", "content": response.content})
    messages.append({
        "role": "user",
        "content": [{"type": "tool_result", "tool_use_id": tool_use.id, "content": result}]
    })
```

### Ví dụ 2: Claude Code debug một failing test

Khi bạn gõ "fix the failing test", Claude Code thực hiện ReAct:

```
[THINK]   Cần xem test nào đang fail trước
[ACT]     bash("npm test 2>&1")
[OBSERVE] "Error in auth.test.ts:42 — Cannot read property 'token' of undefined"

[THINK]   Lỗi ở dòng 42, cần đọc file để hiểu context
[ACT]     read("src/auth.test.ts")
[OBSERVE] [nội dung file — mock chưa được setup đúng]

[THINK]   Mock thiếu 'token' field, sửa mock object
[ACT]     edit("src/auth.test.ts", old="mockUser = {}", new="mockUser = {token: 'test'}")
[OBSERVE] "File saved"

[THINK]   Chạy lại test để xác nhận fix
[ACT]     bash("npm test 2>&1")
[OBSERVE] "All tests passed (12/12)"

[FINAL]   "Fixed: mock object trong auth.test.ts thiếu trường token..."
```

Đây là ReAct trong thực tế — không có bước nào model "đoán". Mọi kết luận đều dựa trên observation thực tế.

---

## Part 5: Khi nào nên dùng

**Scenario 1: Nhiệm vụ cần thông tin ngoài prompt**  
Khi câu trả lời phụ thuộc vào dữ liệu mà bạn không thể biết trước để đưa vào prompt — file system, database real-time, API bên ngoài. ReAct cho phép model tự thu thập thông tin khi cần.

**Scenario 2: Pipeline nhiều bước có dependencies**  
Khi bước sau phụ thuộc kết quả thực tế từ bước trước. Ví dụ: đọc log → xác định root cause → sửa code → chạy test → xác nhận. Không thể plan toàn bộ từ đầu vì không biết log chứa gì.

**Scenario 3: Cần model tự verify kết quả**  
Khi bạn muốn model tự kiểm tra đầu ra của mình thay vì chỉ đoán. Model sửa xong → chạy test → đọc kết quả → điều chỉnh nếu cần. Không cần bạn verify từng bước.

---

## Part 6: Khi nào KHÔNG nên dùng

**Anti-pattern 1: Câu hỏi không cần tool**  
"Python list comprehension là gì?" không cần ReAct. Mỗi loop iteration tốn token và thêm latency. Dùng direct completion — trả lời ngay trong một lần, nhanh hơn và rẻ hơn.

**Anti-pattern 2: Tool không ổn định**  
Nếu tool thường xuyên timeout hoặc trả về inconsistent data, ReAct loop sẽ bị lạc hướng — model điều chỉnh reasoning dựa trên kết quả sai. Ổn định tool trước, đưa vào agent loop sau.

**Anti-pattern 3: Latency là hard constraint**  
Mỗi loop iteration là một API round-trip. Ba iterations có thể mất 5-10 giây. Với autocomplete hay real-time chat, điều này không chấp nhận được. ReAct phù hợp cho background task, không phải interactive flow yêu cầu <200ms.

---

## Part 7: Bẫy và pitfall

**Bẫy 1: Vòng lặp vô tận**  
Không có `max_iterations` → model loop mãi nếu không đạt được mục tiêu. Token cạn, chi phí tăng. Luôn set hard limit (thường 10-20 steps), và log khi bị dừng cưỡng bức để debug.

**Bẫy 2: Tool output quá dài bị truncate ngầm**  
File 10,000 dòng → context window bị nhồi → phần cuối bị cắt. Model đọc nửa đầu và đưa ra kết luận sai về nội dung toàn bộ. Hãy tự truncate ở tool layer và thêm `"... (truncated, X lines total)"` để model biết có phần chưa đọc.

**Bẫy 3: Reasoning bị anchored vào giả thuyết sai đầu**  
Bước THINK đầu đưa ra giả thuyết sai → các bước sau tìm cách xác nhận giả thuyết đó thay vì phủ nhận. Thêm instruction: *"Nếu observation mâu thuẫn với giả thuyết trước, xem xét lại từ đầu thay vì tìm cách giải thích."*

**Bẫy 4: Destructive action không có safeguard**  
Model có thể quyết định `delete_file("src/main.py")` nếu reasoning dẫn đến đó. Với mọi action có side effect không reversible, thêm confirmation step hoặc dry-run mode trước khi execute thật.

---

## Part 8: Kết nối với các keyword khác

→ **Tool use / Function calling** (đã học): Tool use là cơ chế — cách gọi function. ReAct là chiến lược — cách tổ chức nhiều lần gọi tool trong một pipeline có reasoning.

→ **Chain of Thought** (sẽ học): CoT là phần THINK trong ReAct. CoT thuần chỉ suy luận nội bộ; ReAct cho CoT khả năng kiểm chứng bằng action thực tế.

→ **Hallucination & Grounding** (đã học): ReAct giảm hallucination bằng cách grounding suy luận vào observation thực. Thay vì đoán "file có chứa X", model đọc file và xác nhận.

→ **Subagents** (sẽ học): Mỗi subagent là một ReAct loop riêng. Multi-agent system là nhiều ReAct loop phối hợp — một orchestrator loop điều phối nhiều worker loop.

→ **Prompt injection** (sẽ học): Tool result trong ReAct là attack surface. Nếu tool đọc nội dung từ nguồn bên ngoài có chứa instruction độc hại, model có thể bị manipulate ngay trong loop.

---

## Part 9: Tự kiểm tra

**Q1**: Giải thích ReAct theo cách của bạn — không dùng từ "Reasoning" hay "Acting". Tại sao nó hiệu quả hơn chỉ dùng Chain of Thought hoặc chỉ dùng tool use đơn lẻ?

**Q2**: Bạn build chatbot hỗ trợ khách hàng — cần tra cứu order history trong database. Phần nào của workflow là ReAct? Phần nào không cần ReAct?

**Q3**: Khi nào bạn sẽ KHÔNG dùng ReAct dù task cần tool? Đưa ra một ví dụ cụ thể với lý do kỹ thuật rõ ràng.

**Q4**: So sánh ReAct với In-context Learning (đã học). Cả hai đều dùng context window — nhưng chúng dùng theo cách khác nhau như thế nào?

**Q5**: Nếu một ReAct agent được trao quyền gọi `delete_file`, điều gì có thể xảy ra khi reasoning sai ở bước đầu? Bạn sẽ thiết kế safeguard như thế nào?

---

## Part 10: Bài tập 24h

**Nhiệm vụ**: Viết một ReAct agent không dùng framework — chỉ Anthropic SDK và Python thuần.

Agent phải:
1. Nhận câu hỏi về file system (ví dụ: "Có bao nhiêu file .py trong thư mục hiện tại?")
2. Tự quyết định cần dùng tool gì
3. Gọi tool thực sự (dùng `os` hoặc `subprocess`)
4. Loop cho đến khi trả lời được câu hỏi

**Acceptance criteria**:
- Hard limit: tối đa 10 iterations
- Print rõ từng bước: `[THINK]`, `[ACT: tool_name]`, `[OBSERVE: result]`
- Agent tự dừng khi có câu trả lời — không cần interrupt thủ công
- Xử lý được ít nhất một loại tool error mà không crash toàn bộ loop

**Estimated time**: 45-60 phút  
**Hint**: Bắt đầu với 2 tools: `list_files(path)` và `count_files(extension, path)`.

---

## Self-test Answers (đọc sau khi đã tự trả lời)

**Q1**: ReAct là vòng lặp "lên kế hoạch → kiểm tra thực tế → điều chỉnh". CoT chỉ nghĩ nhưng không kiểm tra — không biết suy luận có đúng không. Tool use đơn lẻ chỉ làm một việc mà không lý giải. ReAct kết hợp cả hai: mỗi action có reasoning đi kèm, mỗi kết quả được tích hợp vào reasoning tiếp theo.

**Q2**: ReAct: query database → phân tích kết quả → quyết định trả lời gì → verify nếu cần. Không cần ReAct: câu hỏi FAQ thuần túy (không cần tool), routing intent (single classifier call).

**Q3**: Không dùng ReAct khi latency là hard constraint. Ví dụ: IDE autocomplete cần response trong <100ms. Với 3 iterations, ReAct có thể mất 3-8 giây — hoàn toàn không chấp nhận được. Dùng direct completion với context đủ thay thế.

**Q4**: In-context learning dùng context window để học pattern từ examples (static, đưa vào từ đầu). ReAct dùng context window để tích lũy observations trong runtime (dynamic, tăng dần theo loop). ICL là input cố định; ReAct là input tự mở rộng.

**Q5**: Với faulty reasoning ở bước đầu (ví dụ: xác định nhầm file cần xóa), agent có thể xóa file quan trọng không phục hồi được. Safeguards: (1) require human confirmation cho mọi destructive action, (2) dry-run mode in ra action sẽ thực hiện và chờ approval, (3) giới hạn scope — chỉ cho phép delete trong một thư mục sandbox cụ thể, (4) log mọi action với rollback plan.
