# Context Window: Giới Hạn Bộ Nhớ Làm Việc của LLM

## TL;DR
Context window là tổng số token mà model xử lý trong một lần — input cộng output cộng lại. Claude hiện hỗ trợ 200K token. Khi context đầy, thông tin cũ sẽ mất — đây là ràng buộc vật lý, không phải bug.

---

## Phần 1: Vấn đề nó giải quyết

Năm 2020, GPT-3 ra đời với context window 2,048 token — tương đương khoảng 1,500 từ tiếng Anh. Một developer muốn nhờ AI review function dài 200 dòng: được. Nhưng cần review cả file 500 dòng? Model bị cắt ngay giữa chừng, và phần code phía sau không tồn tại với nó.

Kết quả: review thiếu. Bug ở cuối file không được phát hiện. Developer phải tự chia file thành từng đoạn, paste từng phần, rồi tự tổng hợp lại kết quả.

Pain này nghiêm trọng vì code thực tế không sống trong 1,500 từ. Một feature nhỏ thường span qua 3-4 files, mỗi file vài trăm dòng. AI "mù" với phần nằm ngoài context của nó.

Context window lớn hơn giải quyết điều này: model xử lý được toàn bộ file, toàn bộ conversation history, và tool results — trong một lần duy nhất.

---

## Phần 2: Định nghĩa chính xác

**Context window** (còn gọi là *context length*) là tổng số token tối đa mà một model có thể nhận và xử lý trong một inference call. Con số này bao gồm cả input lẫn output.

Dễ nhầm với **memory**. Memory trong LLM là khái niệm rộng hơn, bao gồm vector stores, databases, external storage. Context window chỉ là "bộ nhớ làm việc" tức thời — những gì model thấy ngay lúc đó.

Cũng dễ nhầm với **max output tokens**. Context window = input + output. Max output tokens chỉ giới hạn phần model sinh ra. Claude claude-sonnet-4-6 có context window 200K token. Nếu input của bạn chiếm 180K token, phần output chỉ còn 20K token để dùng.

---

## Phần 3: Cơ chế hoạt động

Mỗi inference call, toàn bộ context được đưa vào model theo thứ tự tuyến tính:

```
[System Prompt] → [Message 1] → [Tool Result 1] → [Message 2] → ... → [Current Input]
```

Model dùng transformer attention để "nhìn" tất cả token này cùng lúc. Không có sequential reading — attention mechanism cho phép token ở cuối attend đến token ở đầu.

Trong một Claude Code session, context tích lũy như sau:

```
┌─────────────────────────────────────────┐
│ System prompt (CLAUDE.md, rules...)     │ ~5K–20K tokens
│ Tool definitions (all built-in tools)  │ ~10K–30K tokens
│ Conversation history                   │ tăng dần theo session
│ Tool results (Read files, Bash output) │ mỗi call thêm vài K
│ Current response đang sinh             │
└─────────────────────────────────────────┘
             Total phải ≤ 200K
```

Khi tổng vượt giới hạn, Claude Code tự động trigger **context compaction** — tóm tắt lịch sử cũ và giữ lại thông tin quan trọng. Nhưng tóm tắt không bao giờ bằng bản gốc.

---

## Phần 4: Ví dụ cụ thể

**Ví dụ 1: Xem token usage với verbose mode**

```bash
claude --verbose "Review file src/auth.ts"
```

Trong output, bạn sẽ thấy token statistics — số input tokens, output tokens, và cache hits. Đây là cách đơn giản nhất để biết session đang dùng bao nhiêu context.

**Ví dụ 2: Context bị "lấp đầy" trong session thực tế**

Bạn đang debug một tính năng phức tạp. Trong session, Claude đã đọc 20 files, mỗi file khoảng 500 dòng:

```
20 files × 500 dòng × ~12 token/dòng = ~120K tokens (file content)
Conversation messages:             ~15K tokens
System prompt + tool defs:         ~20K tokens
─────────────────────────────────────────────
Total đã dùng:                     ~155K / 200K
```

Còn ~45K token. Nếu tiếp tục đọc thêm 4-5 file lớn nữa, context compaction sẽ kick in. Claude sẽ "quên" những gì đã làm ở đầu session.

---

## Phần 5: Khi nào cần quan tâm đến context window

**Tình huống 1: Review module lớn hoặc nhiều files liên quan**
Khi cần analyze một tính năng spanning 10+ files, phải tính trước budget. Mỗi file đọc vào là token. Nếu không selective, context đầy trước khi hoàn thành task.

**Tình huống 2: Session debug kéo dài**
Sau vài giờ debug với nhiều tool calls, context đã tích lũy lớn. Nếu Claude bắt đầu hỏi lại điều đã thảo luận, đây là dấu hiệu context compaction đã xảy ra. Lúc này nên `/clear` và start fresh với context đã được distill.

**Tình huống 3: Xử lý document hoặc log file lớn**
Cần summarize file 500 trang hoặc process log 100K dòng? Phải chia nhỏ thay vì dump toàn bộ vào một lần. Ước lượng: 1 trang text ≈ 500–700 token, 1 dòng code ≈ 10–15 token.

---

## Phần 6: Khi nào KHÔNG dùng "nhét hết vào context"

**Anti-pattern 1: Dump toàn bộ codebase vào context**
Logic: "Model có 200K, project tôi 80K token, vừa đủ." Sai. Chưa tính system prompt (~15K), tool definitions (~20K), conversation (~10K), và responses (~5K+). Thực tế chỉ còn 150K cho code — và đó là trước khi bắt đầu làm bất cứ điều gì.

Thay vào đó: đọc selective — chỉ đọc files thực sự liên quan đến task hiện tại.

**Anti-pattern 2: Để context tự đầy rồi mặc compaction xử lý**
Context compaction mất thông tin. Nếu Claude "quên" một quyết định thiết kế quan trọng từ đầu session, bug có thể tái xuất mà không rõ lý do.

Thay vào đó: start fresh session khi bắt đầu task mới, không kéo session cũ sang task khác.

**Anti-pattern 3: Dùng context như backup memory không có cấu trúc**
Nhét mọi thứ vào context với hy vọng model tự tìm thông tin cần thiết. Context lớn không đồng nghĩa model xử lý tốt hơn — "lost in the middle" phenomenon khiến thông tin ở giữa context dài bị xử lý kém hơn.

---

## Phần 7: Gotchas & Pitfalls

**Gotcha 1: Overhead lớn hơn bạn nghĩ**
Trong Claude Code, tool definitions cho tất cả built-in tools có thể chiếm 10–30K token trước khi bạn gõ một chữ. CLAUDE.md dài + rules files cũng ăn vào đây. Bật verbose mode để thấy con số thực.

**Gotcha 2: "Lost in the middle"**
Khi context dài, attention có xu hướng mạnh hơn ở đầu và cuối, yếu hơn ở giữa. Thông tin quan trọng nằm ở token 50K–150K dễ bị model "bỏ qua" hơn so với đầu hoặc cuối context. Đặt instruction quan trọng ở gần cuối, không chôn ở giữa.

**Gotcha 3: Compaction không có warning rõ ràng**
Claude Code compaction tự động khi gần đầy context. Bạn thường không biết cho đến khi thấy model hỏi lại điều đã thảo luận, hoặc đọc lại file đã đọc trước đó. Không có pop-up hay thông báo rõ ràng.

**Gotcha 4: Cost tỷ lệ với context size**
Mỗi API call tính phí dựa trên số token input + output. Session dài = context dài = mỗi call sau đắt hơn. Với prompt caching, system prompt có thể được cache giảm cost, nhưng conversation history vẫn tính đủ giá.

**Gotcha 5: Output bị giới hạn bởi remaining context**
Nếu input của bạn chiếm 170K/200K context, output bị giới hạn còn 30K token. Với task cần generate code dài, phải tính input + output cùng lúc, không chỉ tính input.

---

## Phần 8: Kết nối với keyword khác

→ **Token / Tokenization** (đã học): Context window đo bằng token, không phải chữ. 200K token ≈ 150K từ tiếng Anh, ít hơn với code vì nhiều symbol và whitespace.

→ **Context Compaction** (sẽ học — #22): Cơ chế tự động tóm tắt context cũ khi gần đầy. Đây là cách Claude Code "kéo dài" khả năng làm việc past the hard limit — nhưng với trade-off về information fidelity.

→ **Prompt Caching** (sẽ học — #24): Kỹ thuật cache phần đầu context (thường là system prompt) để giảm cost và latency. Liên quan trực tiếp đến cách quản lý context window hiệu quả về mặt chi phí.

→ **RAG Basics** (sẽ học — #23): Thay vì nhét toàn bộ knowledge vào context, RAG retrieve đúng phần cần thiết lúc cần. Đây là giải pháp khi knowledge base lớn hơn context window cho phép.

---

## Phần 9: Self-test

Làm KHÔNG nhìn bài. Viết ra giấy.

1. Giải thích context window bằng một câu cho người không biết về LLM. Không dùng từ "token" hoặc "transformer."

2. Bạn cần viết script Claude Code để analyze toàn bộ project 500 files, mỗi file trung bình 300 dòng. Context window là 200K token. Bạn sẽ tiếp cận bài toán này như thế nào?

3. Tại sao "nhét hết codebase vào context" là anti-pattern ngay cả khi context window đủ lớn về mặt token count?

4. Context window và token (từ bài trước) liên quan như thế nào? Nếu bạn đọc 1 file Python 100 dòng, nó chiếm bao nhiêu phần trăm context window 200K?

5. Nếu context window tăng lên 1 triệu token trong tương lai, "lost in the middle" problem có biến mất không? Tại sao?

---

## Phần 10: Bài tập 24h

**Task**: Audit context usage trong một Claude Code session thực tế.

**Cách làm**:
1. Bật verbose mode khi chạy Claude Code (`claude --verbose`)
2. Mở một task thực tế — review một module hoặc debug một bug
3. Sau mỗi 5 tool calls, ước lượng token đã dùng dựa trên files đọc + messages
4. Khi session kết thúc, phân tích: phần nào chiếm nhiều context nhất?

**Acceptance criteria**:
- [ ] Đã chạy ít nhất 1 session với verbose mode và quan sát token output
- [ ] Có thể ước lượng overhead của system prompt + tool definitions trong session đó
- [ ] Identify được thời điểm trong session context tăng nhanh nhất
- [ ] Có thể ước tính context budget trước khi bắt đầu một task phức tạp
- [ ] Viết xuống 1 rule cá nhân về cách quản lý context (ví dụ: "Không đọc quá X files trong 1 session")

**Estimated time**: 45–60 phút (bao gồm chạy session thực tế)

**Hint**: Rule of thumb — 1 dòng code ≈ 10–15 token, 1 trang text ≈ 500–700 token. Dùng con số này để ước lượng trước khi chạy.

---

## Đáp án Self-test (đọc sau khi tự trả lời)

**Q1**: Context window là giới hạn "bộ nhớ làm việc" của AI — tất cả những gì nó có thể nhớ và xử lý trong một lần trả lời. Giống như RAM: nếu đầy, phải bỏ thứ gì đó đi để tiếp tục.

**Q2**: Không thể đọc 500 files cùng lúc. 500 × 300 × 12 token ≈ 1.8M token — gấp 9 lần context window. Cần chiến lược: dùng grep/find để identify files liên quan đến task cụ thể, chỉ đọc những files đó. Hoặc dùng RAG để retrieve relevant code chunks thay vì đọc toàn bộ.

**Q3**: Vì overhead lớn — system prompt + tool definitions chiếm 30–50K token trước khi bạn đọc 1 dòng code. Cộng thêm "lost in the middle" — model xử lý kém hơn ở phần giữa context dài. Nhét nhiều không đồng nghĩa hiệu quả hơn.

**Q4**: Token là đơn vị đo context window. 100 dòng Python ≈ 1,000–1,500 token ≈ 0.5–0.75% của 200K. Không nhiều, nhưng 100 files như vậy = 50–75% context chỉ cho file content, chưa tính overhead.

**Q5**: Không biến mất. "Lost in the middle" là vấn đề về cách attention mechanism phân bổ trọng số, không chỉ về độ dài. Với 1M token context, vùng giữa sẽ rộng hơn và thông tin ở 300K–700K có thể bị ảnh hưởng tệ hơn. Giải pháp thực sự cần cải tiến kiến trúc attention, không chỉ tăng context size.
