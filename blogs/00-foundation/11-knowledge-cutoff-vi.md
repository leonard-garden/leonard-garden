# Knowledge Cutoff: Giới hạn thời gian của LLM và cách làm việc với nó

## TL;DR

**Knowledge cutoff** là ngày mà training data của một LLM kết thúc — model không có kiến thức về bất kỳ sự kiện nào xảy ra sau ngày đó. Đây không phải bug, mà là đặc tính tất yếu của cách LLM được train. Biết cách xử lý knowledge cutoff là điều kiện bắt buộc để tránh những lỗi sai nhục nhã trong production.

---

## Phần 1: Vấn đề nó giải quyết

Năm 2024, một developer hỏi Claude: "Version mới nhất của Next.js là gì và tôi có nên nâng cấp không?" Claude tự tin trả lời rằng Next.js 14 là phiên bản mới nhất với những cải tiến nổi bật. Thực ra, Next.js 15 đã ra mắt vài tháng trước đó với những thay đổi breaking.

Developer tin vào câu trả lời, viết migration guide, và deploy lên production. Khách hàng bắt đầu báo lỗi vì config của Next.js 15 khác hoàn toàn.

Không phải Claude "nói dối" hay hallucinate. Claude thực sự không biết Next.js 15 tồn tại — nó nằm ngoài thời điểm training kết thúc.

---

## Phần 2: Định nghĩa chính xác

**Knowledge cutoff** (còn gọi là training cutoff) là ngày cuối cùng mà dữ liệu training của LLM được thu thập. Sau ngày đó, model không có thông tin về bất kỳ sự kiện, thư viện, API, hay tin tức nào.

Phân biệt với hallucination:

| Vấn đề | Nguyên nhân | Ví dụ |
|---|---|---|
| Knowledge cutoff | Không có data sau ngày X | Không biết React 19 ra mắt |
| Hallucination | Tạo ra thông tin sai từ data đã có | Bịa đặt tên function không tồn tại trong React 18 |

Knowledge cutoff là giới hạn về **thời gian**. Hallucination là lỗi về **độ chính xác**. Cả hai đều nguy hiểm nhưng cần cách xử lý khác nhau.

Claude Sonnet 4.6 có knowledge cutoff vào tháng 8 năm 2025. Nghĩa là model không có thông tin về bất kỳ sự kiện nào sau mốc đó.

---

## Phần 3: Cách hoạt động

LLM được train theo quy trình sau:

```
Thu thập data từ internet     →   Data được filter & clean
(đến ngày cutoff)                       │
                                         ▼
                               Train model trên toàn bộ data
                                         │
                                         ▼
                               Model được "đóng băng" tại thời điểm đó
                                         │
                                         ▼
                               Deploy, serve user requests
                               (có thể nhiều tháng / năm sau ngày cutoff)
```

Vấn đề thực tế: gap giữa cutoff và ngày bạn dùng model thường là **6-18 tháng**. Claude được train đến tháng 8/2025 nhưng bạn có thể đang dùng nó vào tháng 5/2026 — khoảng cách 9 tháng. Trong 9 tháng đó:

- Frameworks ra phiên bản mới
- APIs thay đổi
- Thư viện bị deprecated
- Sự kiện thế giới xảy ra

Model không biết gì về những thứ này.

---

## Phần 4: Ví dụ cụ thể

### Ví dụ 1: Inject current date để model biết mình đang ở đâu trong thời gian

Vấn đề phổ biến nhất: model trả lời như thể "bây giờ" là ngày cutoff. Fix đơn giản nhất là cho model biết ngày thực tế:

```python
import anthropic
from datetime import date

client = anthropic.Anthropic()

def ask_with_date_context(question: str) -> str:
    today = date.today().strftime("%Y-%m-%d")
    
    system_prompt = f"""Hôm nay là {today}.
Knowledge cutoff của bạn là tháng 8/2025.
Nếu câu hỏi liên quan đến thông tin sau tháng 8/2025, hãy nói rõ rằng bạn không có thông tin đó
và gợi ý user tìm kiếm nguồn cập nhật."""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=500,
        system=system_prompt,
        messages=[{"role": "user", "content": question}]
    )
    return response.content[0].text

# Ví dụ: hỏi về thông tin có thể đã thay đổi
print(ask_with_date_context("Next.js version mới nhất là gì?"))
# → "Theo kiến thức của tôi đến tháng 8/2025, Next.js 15 là phiên bản mới nhất.
#    Tuy nhiên, đã 9 tháng kể từ đó — hãy kiểm tra nextjs.org để xác nhận."
```

### Ví dụ 2: Dùng web search tool để lấy thông tin real-time

Khi bạn cần thông tin cập nhật, đừng dựa vào model — cung cấp công cụ để model tự tìm kiếm:

```python
import anthropic

client = anthropic.Anthropic()

# Tool định nghĩa web search
tools = [
    {
        "name": "web_search",
        "description": "Tìm kiếm thông tin real-time từ internet. Dùng khi cần thông tin có thể đã thay đổi sau tháng 8/2025.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query"
                }
            },
            "required": ["query"]
        }
    }
]

def search_web(query: str) -> str:
    # Trong thực tế: gọi Google Search API, Brave Search, v.v.
    # Đây là mock để minh họa flow
    return f"[Kết quả search cho '{query}': Next.js 15.3.1 released 2025-11-20...]"

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1000,
    tools=tools,
    messages=[{
        "role": "user",
        "content": "Version mới nhất của Next.js là gì? Tôi cần thông tin chính xác nhất."
    }]
)

# Xử lý tool call nếu model quyết định search
if response.stop_reason == "tool_use":
    for block in response.content:
        if block.type == "tool_use" and block.name == "web_search":
            search_result = search_web(block.input["query"])
            print(f"Model đã tìm kiếm: {block.input['query']}")
            print(f"Kết quả: {search_result}")
```

---

## Phần 5: Khi nào cần lo ngại nhất

**Scenario 1: Hỏi về phiên bản thư viện hoặc API**
Đây là rủi ro cao nhất. Framework, SDK, dependency thay đổi nhanh. Một model train đến tháng 8/2025 không biết breaking changes nào xảy ra sau đó. Luôn verify bằng official docs, không chỉ tin câu trả lời của model.

**Scenario 2: Hỏi về sự kiện thế giới, giá cả, thống kê**
"Giá Bitcoin hiện tại", "CEO của công ty X là ai", "Dân số Việt Nam năm nay" — tất cả đều có thể sai nếu thay đổi sau cutoff. Với loại câu hỏi này, dùng web search thay vì hỏi model trực tiếp.

**Scenario 3: Build chatbot trả lời về sản phẩm/dịch vụ của bạn**
Nếu sản phẩm của bạn đã update sau cutoff, model không biết thay đổi đó. Giải pháp: inject product docs vào context qua RAG thay vì dựa vào model memory.

---

## Phần 6: Khi nào KHÔNG cần lo quá mức

**Anti-pattern 1: Coi knowledge cutoff nghĩa là model "kém"**
Với kiến thức nền tảng — nguyên lý lập trình, thuật toán, toán học, lịch sử — cutoff gần như không ảnh hưởng. "Giải thích BFS" hay "viết quicksort" không có expiry date. Lo ngại cutoff với những loại câu hỏi này là không cần thiết.

**Anti-pattern 2: Inject cả bộ docs vào context để "cập nhật" model**
Nhét 500 trang docs vào system prompt để bù đắp knowledge cutoff không hiệu quả và tốn kém. Dùng RAG — chỉ retrieve đúng phần relevant khi cần. Xem bài Grounding và RAG basics.

**Anti-pattern 3: Hỏi model "kiến thức của bạn có cập nhật không?"**
Model không thể tự biết thông tin của nó có outdated hay không — nó không có điểm tham chiếu nào để so sánh. Thay vào đó, bạn phải biết cutoff date và tự đánh giá liệu topic đó có thay đổi nhanh không.

---

## Phần 7: Gotchas & Pitfalls

**Gotcha 1: Model nói sai về chính cutoff của nó**
Model thường không biết chính xác cutoff date của mình. Nếu hỏi "training cutoff của bạn là khi nào?", câu trả lời có thể xấp xỉ nhưng không chính xác. Tra cứu tài liệu chính thức của nhà cung cấp model thay vì hỏi model.

**Gotcha 2: Gap giữa cutoff và release date lớn hơn bạn nghĩ**
Một LLM thường mất 3-6 tháng từ lúc training xong đến lúc release. Rồi thêm nhiều tháng/năm trong giai đoạn bạn dùng. Thực tế: data của model có thể cũ hơn bạn tưởng tới 1-2 năm.

**Gotcha 3: Model tự tin ngay cả khi thông tin đã outdated**
LLM không có cơ chế tự phát hiện "thông tin này có thể đã thay đổi". Nó sẽ trả lời với tone tự tin như nhau dù thông tin đúng hay sai do cutoff. Đây là lý do tại sao bạn phải inject ngày hiện tại và dặn model cảnh báo khi topic dễ thay đổi.

**Gotcha 4: "Cutoff" không phải một ngày cứng**
Data không được thu thập đều đặn đến ngày cutoff rồi dừng hẳn. Thực tế phức tạp hơn: sự kiện gần ngày cutoff thường có ít data hơn (vì internet chưa kịp viết về nó), nên model hiểu kém hơn về giai đoạn cuối trong training period.

---

## Phần 8: Kết nối với các keyword khác

→ **Hallucination & Grounding** *(đã học)*: knowledge cutoff và hallucination đều tạo ra output sai, nhưng từ nguyên nhân khác nhau. Grounding là giải pháp cho cả hai — cung cấp external truth thay vì dựa vào model memory.

→ **Grounding / RAG** *(đã học)*: RAG là giải pháp chính để bù đắp knowledge cutoff. Thay vì train lại model, bạn retrieve thông tin mới nhất vào context lúc inference.

→ **Tool Use / Function Calling** *(đã học)*: web search tool là cách khác để vượt qua cutoff — cho model tự tìm thông tin real-time thay vì đoán từ training data.

→ **Context Window** *(đã học)*: khi inject current date hoặc recent docs để bù cutoff, bạn đang dùng context window. Quản lý tốt context window quyết định bạn inject được bao nhiêu thông tin mới.

→ **In-context Learning** *(đã học)*: một cách nhanh để "cập nhật" model là cho nó học từ examples trong context. Provide 2-3 ví dụ về API mới trong prompt — model sẽ follow pattern đó mà không cần training lại.

---

## Phần 9: Tự kiểm tra

**Q1**: Định nghĩa knowledge cutoff bằng ngôn ngữ của bạn và giải thích tại sao nó là đặc tính tất yếu của LLM, không phải lỗi kỹ thuật.

**Q2**: Bạn đang build một customer support chatbot cho sản phẩm SaaS. Sản phẩm có release cycle 2 tuần/lần. Làm thế nào bạn xử lý vấn đề knowledge cutoff cho chatbot này?

**Q3**: Khi nào knowledge cutoff KHÔNG phải vấn đề đáng lo? Liệt kê ít nhất 3 loại câu hỏi mà cutoff gần như không ảnh hưởng đến độ chính xác của câu trả lời.

**Q4**: So sánh hai chiến lược xử lý cutoff: (A) inject current date + cảnh báo model, (B) dùng web search tool. Trong scenario nào thì A tốt hơn, trong scenario nào thì B tốt hơn?

**Q5**: Tại sao model không thể tự biết thông tin của mình có outdated hay không? Điều này có ý nghĩa gì với cách bạn thiết kế prompts và hệ thống?

---

## Phần 10: Bài tập (24h challenge)

**Bài tập**: Xây dựng một "cutoff-aware assistant" — chatbot tự động nhận diện câu hỏi nào có thể bị ảnh hưởng bởi knowledge cutoff và xử lý chúng phù hợp.

**Yêu cầu**:
- Inject current date vào system prompt
- Phân loại câu hỏi: "time-sensitive" (dễ outdated) vs "timeless" (ít thay đổi)
- Với time-sensitive questions: cảnh báo user và gợi ý nguồn để verify
- Với timeless questions: trả lời bình thường

**Acceptance criteria**:
- [ ] System prompt chứa current date và knowledge cutoff date
- [ ] Chatbot phân loại đúng ít nhất 4/5 câu hỏi test (mix time-sensitive và timeless)
- [ ] Với time-sensitive question: response có cảnh báo rõ ràng về cutoff
- [ ] Với timeless question: không có cảnh báo không cần thiết (tránh false positive)
- [ ] Có ít nhất 5 test cases được document rõ ràng

**Thời gian ước tính**: 45 phút

**Gợi ý**: Tạo một danh sách test questions: "Next.js version mới nhất" (time-sensitive), "BFS là gì" (timeless), "Giá vàng hôm nay" (time-sensitive), "Giải thích Big O notation" (timeless). Chạy qua chatbot và xem nó phân loại đúng không.

---

## Self-test Answers (đọc sau khi đã tự trả lời)

**Q1**: Knowledge cutoff là ngày mà training data của LLM dừng lại — model không có kiến thức về bất kỳ thứ gì xảy ra sau ngày đó. Đây là đặc tính tất yếu vì LLM được train trên static dataset: để đưa model ra production, training phải kết thúc tại một thời điểm cụ thể. Không thể train liên tục trên streaming real-time data (về mặt kỹ thuật có thể nhưng cực kỳ đắt và phức tạp). Model "frozen" tại thời điểm training — đây là trade-off chấp nhận được.

**Q2**: Dùng RAG với product docs. Sau mỗi release, cập nhật docs vào vector database. Khi user hỏi, retrieve relevant sections và inject vào context. Chatbot trả lời dựa trên docs được inject, không phải training memory. Đây là cách đúng vì product docs thay đổi quá nhanh — không thể fine-tune model mỗi 2 tuần.

**Q3**: Ba loại câu hỏi cutoff không ảnh hưởng: (1) Nguyên lý lập trình cơ bản (Big O, thuật toán, design patterns), (2) Toán học và khoa học cơ bản (đạo hàm, vật lý cơ học, hóa học), (3) Lịch sử đã xảy ra trước cutoff (chiến tranh thế giới, sự kiện lịch sử). Tất cả những thứ này có "half-life" dài và không thay đổi sau ngày cutoff.

**Q4**: Inject date + cảnh báo (A) tốt hơn khi: user cần câu trả lời ngay, không có internet, hoặc câu hỏi chỉ cần ước tính gần đúng. Web search tool (B) tốt hơn khi: cần thông tin chính xác real-time (giá cổ phiếu, phiên bản phần mềm), user có thể chờ latency thêm, và accuracy quan trọng hơn speed.

**Q5**: Model không có "bộ nhớ về bộ nhớ của mình" — nó không biết ranh giới của những gì nó biết. Khi bạn hỏi về Next.js 15, model không thể nghĩ "hmm, tôi không chắc tôi có data về điều này" — nó chỉ tổng hợp từ những gì nó đã học, dù outdated. Ý nghĩa thiết kế: bạn phải là người biết cutoff date, phải inject ngày hiện tại, và phải dặn model khi nào cần cảnh báo. Model không thể tự làm điều này.
