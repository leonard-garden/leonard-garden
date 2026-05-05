# Hallucination & Grounding

## TL;DR

**Hallucination** là hiện tượng LLM sinh ra thông tin trông có vẻ đúng nhưng thực ra sai hoặc không tồn tại. **Grounding** là kỹ thuật buộc model phải trả lời dựa trên nguồn dữ liệu cụ thể thay vì dựa vào "trí nhớ" của nó. Hiểu rõ hai khái niệm này giúp bạn biết khi nào nên tin LLM và khi nào phải kiểm tra lại.

---

## Phần 1: Vấn đề nó giải quyết

Năm 2023, một luật sư tên Steven Schwartz ở New York nộp hồ sơ tòa án có trích dẫn 6 án lệ không tồn tại — tất cả do ChatGPT "sáng tác". Ông hỏi AI, AI trả lời tự tin, ông tin và dùng thẳng. Kết quả: bị tòa phạt và mất uy tín nghề nghiệp.

Đây không phải lỗi của người dùng đơn thuần. LLM được huấn luyện để tạo ra văn bản *có vẻ đúng* — không phải văn bản *thực sự đúng*. Khi không có đủ dữ liệu trong context, model sẽ "điền vào chỗ trống" bằng những gì xác suất cao nhất, không phải bằng sự thật.

---

## Phần 2: Định nghĩa chính xác

**Hallucination** là khi LLM sinh ra nội dung không có cơ sở trong training data hoặc context đầu vào — thông tin sai, tên người không tồn tại, URL giả, code không chạy được.

Phân biệt với hai khái niệm hay nhầm lẫn:
- *Hallucination* ≠ **lỗi logic**: model suy luận sai từ dữ liệu đúng
- *Hallucination* ≠ **không chắc chắn**: model nói "tôi không biết" vẫn là câu trả lời trung thực

**Grounding** là kỹ thuật cung cấp nguồn dữ liệu cụ thể (documents, database, API response) và yêu cầu model trả lời *chỉ dựa trên nguồn đó*. Grounded response có thể được kiểm chứng và truy xuất nguồn gốc.

---

## Phần 3: Cơ chế hoạt động

**Tại sao LLM hallucinate?**

LLM là mô hình ngôn ngữ xác suất: nó dự đoán token tiếp theo dựa trên xác suất, không tra cứu database sự thật.

```
Input:  "CEO của OpenAI là"
         ↓
LLM tính xác suất cho mỗi token tiếp theo:
  "Sam"   → 0.72
  "Elon"  → 0.11
  "không" → 0.08
  ...
         ↓
Output: "Sam Altman"  ← token xác suất cao nhất
```

Nếu training data có thông tin outdated hoặc sai, token xác suất cao nhất cũng có thể là sai.

**Grounding hoạt động như thế nào?**

```
Không grounding:
  User: "Lãi suất tiết kiệm hiện tại là bao nhiêu?"
  LLM:  "Khoảng 5-6%/năm"  ← dựa trên training data cũ

Có grounding:
  System: [Document: Thông báo ngân hàng 05/05/2026: lãi suất 3.2%/năm]
  User:   "Lãi suất tiết kiệm hiện tại là bao nhiêu?"
  LLM:    "Theo thông báo ngân hàng ngày 05/05/2026, lãi suất là 3.2%/năm"
```

Flow của grounding:

```
Query → Retrieval (tìm docs liên quan)
      → Augmentation (thêm vào context)
      → Generation (model trả lời dựa trên docs)
```

Đây chính là kiến trúc **RAG** (Retrieval-Augmented Generation).

---

## Phần 4: Ví dụ cụ thể

**Ví dụ 1: Hallucination kiểu classic — tham số không tồn tại**

```python
# Prompt: "Dùng pandas để đọc Excel có password protection"
# LLM trả lời:
import pandas as pd
pd.read_excel("file.xlsx", password="secret123")  # ❌ tham số này không tồn tại

# Thực tế đúng:
import openpyxl
wb = openpyxl.load_workbook("file.xlsx", password="secret123")  # ✅
```

LLM "biết" pandas và "biết" password protection là feature của Excel, nên nó kết hợp chúng lại — nhưng kết hợp đó không tồn tại trong API thực tế.

**Ví dụ 2: Grounding trong system prompt**

```python
system = """
Bạn là assistant hỗ trợ kỹ thuật.
Chỉ trả lời dựa trên tài liệu sau:
---
[API Reference v2.3]
POST /users
  params: name (string, required), email (string, required)
  returns: {id, name, email, created_at}
---
Nếu câu hỏi nằm ngoài tài liệu, nói: "Tôi không có thông tin về điều này."
"""

# User: "API /users có hỗ trợ trường 'phone' không?"

# Grounded:     "Theo API Reference v2.3, POST /users không có trường 'phone'."
# Không ground: "Có thể thêm trường 'phone' vào body request."  ← hallucination
```

---

## Phần 5: Khi nào nên dùng grounding (3 tình huống)

**Tình huống 1: Thông tin thay đổi theo thời gian**
Giá cả, lãi suất, chính sách, phiên bản phần mềm. Training data luôn outdated — grounding với realtime data là bắt buộc.

**Tình huống 2: Domain-specific facts không có trong training data**
Tài liệu nội bộ công ty, codebase riêng, quy định pháp lý địa phương. Model không thể biết những gì không được training.

**Tình huống 3: Yêu cầu truy xuất nguồn gốc**
Khi output cần có citation để kiểm chứng — báo cáo y tế, tư vấn pháp lý, phân tích tài chính. Grounding cho phép trích dẫn nguồn cụ thể thay vì câu trả lời chung chung.

---

## Phần 6: Khi nào KHÔNG nên dùng grounding

**Anti-pattern 1: Grounding cho creative output**
Viết truyện, brainstorm ý tưởng, tạo nội dung marketing. Grounding quá chặt sẽ hạn chế creativity — model chỉ paraphrase docs thay vì sáng tạo. Thay vào đó: dùng temperature cao hơn, không ràng buộc model vào docs.

**Anti-pattern 2: Grounding với docs chất lượng kém**
"Garbage in, garbage out." Nếu document bạn inject vào context là sai, outdated, hoặc mâu thuẫn nhau — model vẫn sẽ hallucinate, chỉ là hallucinate có nguồn trích dẫn. Kiểm tra chất lượng data source trước khi grounding.

**Anti-pattern 3: Grounding thay thế validation**
Grounding giảm hallucination, không loại bỏ hoàn toàn. Với output quan trọng (y tế, pháp lý, tài chính), vẫn cần human review — grounding chỉ là lớp bảo vệ đầu tiên.

---

## Phần 7: Gotchas & Pitfalls

**Gotcha 1: Tự tin ≠ chính xác**
LLM trả lời với tông tự tin không phải dấu hiệu đúng. Model không có "cảm giác không chắc" — nó chỉ sinh token xác suất cao nhất. Cách phát hiện: yêu cầu model trích dẫn nguồn cụ thể. Cách xử lý: thêm instruction "nếu không chắc, hãy nói rõ."

**Gotcha 2: Hallucination trong code thường tinh vi**
Model hay bịa ra: tên method không tồn tại, tham số không đúng, API của version cũ. Code chạy được 90% không có nghĩa là đúng 100%. Cách phát hiện: chạy test. Cách xử lý: luôn verify docs khi dùng thư viện ít phổ biến.

**Gotcha 3: Long context làm tăng hallucination**
Khi context window gần đầy, model "quên" thông tin ở giữa (lost-in-the-middle problem). Grounding ở đầu hoặc cuối context hiệu quả hơn ở giữa. Cách xử lý: đặt docs quan trọng ở đầu system prompt.

**Gotcha 4: Model "mix" docs với training data**
Dù đã grounding, model vẫn có thể kết hợp thông tin từ docs với training data. Ví dụ: docs nói "version 2.3" nhưng model thêm feature từ "version 3.0" mà nó biết từ training. Cách xử lý: thêm instruction "chỉ dùng thông tin trong docs, không bổ sung từ kiến thức của bạn."

---

## Phần 8: Liên kết với các keyword khác

→ **In-context learning** (đã học): Grounding là dạng in-context learning đặc biệt — cung cấp facts thay vì examples. Cả hai đều thêm thông tin vào context để định hướng model.

→ **Context window** (đã học): Grounding chiếm context window. Docs càng dài, context window càng cạn nhanh — phải cân bằng giữa độ sâu của grounding và available context.

→ **RAG basics** (sắp học): RAG là kiến trúc implement grounding ở scale lớn — tự động retrieve docs liên quan thay vì inject thủ công vào system prompt.

→ **Prompt injection** (sắp học): Kẻ tấn công có thể inject malicious content vào docs được dùng để grounding. Grounding mở rộng attack surface của hệ thống.

→ **Chain of Thought** (sắp học): CoT giúp model "suy nghĩ" qua nhiều bước, có thể giảm hallucination với reasoning tasks — nhưng không thay thế grounding cho fact-based tasks.

---

## Phần 9: Tự kiểm tra (5 câu hỏi mở)

**Q1**: Định nghĩa lại hallucination bằng lời của bạn — không dùng từ "xác suất" hay "token".

**Q2**: Bạn đang xây chatbot hỗ trợ khách hàng cho một ngân hàng. Loại thông tin nào cần grounding và tại sao?

**Q3**: Khi nào thì grounding là sai lầm? Mô tả một tình huống cụ thể.

**Q4**: So sánh hallucination với lỗi logic trong code — điểm giống và khác nhau là gì?

**Q5**: Nếu LLM được huấn luyện với ngày càng nhiều dữ liệu hơn, hallucination có biến mất không? Tại sao có hoặc tại sao không?

---

## Phần 10: Bài tập (24h challenge)

**Nhiệm vụ**: Tự quan sát và ghi lại một hallucination cụ thể, sau đó fix bằng grounding.

**Các bước**:
1. Chọn một thư viện Python ít phổ biến (ví dụ: `polars`, `dask`, `pyarrow`)
2. Hỏi Claude hoặc ChatGPT: "Viết code để [làm gì đó] với [thư viện đó]"
3. Chạy code, kiểm tra xem có method/param nào không tồn tại không
4. Lấy đoạn code đúng từ official docs, đặt vào system prompt, hỏi lại
5. So sánh hai kết quả

**Acceptance criteria**:
- [ ] Tìm được ít nhất 1 hallucination cụ thể (tên method, tham số, hoặc behavior)
- [ ] Verify bằng cách chạy code hoặc đọc official docs
- [ ] Thấy grounding cải thiện output như thế nào
- [ ] Ghi lại: "Hallucination gì? Grounding với gì? Kết quả thay đổi ra sao?"

**Thời gian ước tính**: 45-60 phút

**Hint**: Thư viện `polars` có API khác `pandas` đáng kể — LLM hay nhầm lẫn giữa hai cái. Đây là chỗ dễ quan sát hallucination nhất.

---

## Đáp án tự kiểm tra (đọc sau khi tự trả lời)

**Q1**: Hallucination là khi LLM tạo ra thông tin nghe có vẻ hợp lý nhưng thực ra không có thật — tên người không tồn tại, sự kiện không xảy ra, code không chạy được. Giống như người ngủ mơ và kể lại giấc mơ như thật.

**Q2**: Cần grounding cho: lãi suất, phí dịch vụ, điều kiện sản phẩm, quy định pháp lý, thông tin tài khoản. Lý do: những thứ này thay đổi thường xuyên và sai một chữ có thể gây thiệt hại tài chính hoặc pháp lý.

**Q3**: Grounding sai khi yêu cầu creative output — viết marketing copy, brainstorm tên sản phẩm, tạo nội dung sáng tạo. Grounding quá chặt khiến model chỉ paraphrase docs thay vì sáng tạo.

**Q4**: Giống nhau: cả hai đều cho output sai. Khác nhau: lỗi logic là model suy luận sai từ premises đúng (truy ra được bằng cách kiểm tra reasoning step-by-step); hallucination là model bịa ra premises sai từ đầu (khó phát hiện hơn vì output trông tự nhiên và tự tin).

**Q5**: Không biến mất hoàn toàn. Dù có nhiều data hơn, LLM vẫn là mô hình xác suất — nó luôn có thể "điền vào chỗ trống" khi gặp câu hỏi nằm ngoài training distribution. Grounding và RAG vẫn cần thiết cho realtime facts và domain-specific knowledge.
