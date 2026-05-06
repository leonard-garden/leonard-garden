---
title: "Grounding: Buộc LLM Trả Lời Dựa Trên Dữ Liệu Thật"
description: "Grounding là kỹ thuật buộc LLM dựa vào tài liệu thật khi sinh câu trả lời, thay vì chỉ dựa vào dữ liệu huấn luyện. RAG (Retrieval-Augmented Generation) là cách phổ biến nhất: tìm đoạn văn liên quan, đưa vào context, yêu cầu model chỉ trả lời dựa trên đó. Khi làm đúng, grounding loại bỏ hallucination về dữ kiện và cho phép model làm việc với thông tin mới nhất."
locale: "vi"
translationKey: "grounding"
publishedAt: 2026-05-05
pillar: "ai"
type: "article"
draft: false
---

## TL;DR

**Grounding** là kỹ thuật buộc LLM dựa vào tài liệu thật khi sinh câu trả lời, thay vì chỉ dựa vào dữ liệu huấn luyện. RAG (Retrieval-Augmented Generation) là cách phổ biến nhất: tìm đoạn văn liên quan, đưa vào context, yêu cầu model chỉ trả lời dựa trên đó. Khi làm đúng, grounding loại bỏ hallucination về dữ kiện và cho phép model làm việc với thông tin mới nhất.

---

## Phần 1: Vấn đề nó giải quyết

Minh là dev backend tại một công ty fintech. Sếp yêu cầu xây chatbot trả lời câu hỏi về chính sách nội bộ — tài liệu được cập nhật mỗi tuần. Minh fine-tune GPT-4 với bộ tài liệu ban đầu. Một tháng sau, chatbot vẫn trả lời theo chính sách lỗi thời. Khách hàng bị tư vấn sai, công ty mất uy tín.

Vấn đề không phải ở model. LLM không tự cập nhật sau khi training xong. Knowledge cutoff đóng băng kiến thức tại một thời điểm. Với dữ liệu thay đổi liên tục, fine-tuning là giải pháp sai từ gốc.

---

## Phần 2: Định nghĩa chính xác

**Grounding** là quá trình cung cấp cho LLM một tập tài liệu nguồn (*ground truth*) cụ thể và yêu cầu model chỉ được dựa vào đó để sinh câu trả lời. Model không được phép tự sáng tác thêm thông tin ngoài tài liệu đó.

Phân biệt với các khái niệm dễ nhầm:

- **Fine-tuning**: nhúng kiến thức vào weights của model — cố định, không cập nhật realtime, phù hợp cho style/behavior chứ không phải facts
- **Hallucination** (đã học): khi model bịa thông tin — grounding là kỹ thuật ngăn chặn điều này xảy ra
- **Prompt engineering**: viết prompt tốt hơn — grounding cung cấp *context thật*, không chỉ là hướng dẫn

RAG (Retrieval-Augmented Generation) là implementation phổ biến nhất của grounding.

---

## Phần 3: Cơ chế hoạt động

RAG pipeline cơ bản gồm 5 bước:

```
User query
    │
    ▼
[Retriever] ──→ Vector DB / Search index
    │              (documents đã được embed từ trước)
    ▼
Top-K chunks liên quan nhất
    │
    ▼
[Augment] ──→ System prompt + chunks + query gốc
    │
    ▼
[LLM] ──→ Câu trả lời chỉ dựa trên chunks
    │
    ▼
[Citations] ──→ Model trích dẫn nguồn cụ thể
```

Chi tiết từng bước:

1. **Index**: Tài liệu chia thành chunks, embed thành vector, lưu vào vector DB
2. **Retrieve**: Query của bạn được embed, tìm top-K chunks có cosine similarity cao nhất
3. **Augment**: Chunks được chèn vào prompt kèm instruction "chỉ trả lời dựa trên tài liệu này"
4. **Generate**: LLM sinh câu trả lời, chỉ được dùng thông tin từ chunks
5. **Cite**: Model trích dẫn đúng đoạn văn nó đang dựa vào

---

## Phần 4: Ví dụ cụ thể

### Ví dụ 1: Grounding cơ bản với XML tags (không cần vector DB)

```python
from anthropic import Anthropic

client = Anthropic()

document = """
[Chính sách nghỉ phép 2025]
- Nhân viên chính thức: 12 ngày/năm
- Nhân viên thử việc: không áp dụng
- Nghỉ phép tích lũy tối đa: 5 ngày sang năm sau
"""

response = client.messages.create(
    model="claude-opus-4-5",
    max_tokens=1024,
    system=f"""Bạn là trợ lý HR. Chỉ trả lời dựa trên tài liệu sau:

<document>
{document}
</document>

Nếu câu hỏi không có trong tài liệu, nói rõ: "Thông tin này không có trong chính sách."
""",
    messages=[{
        "role": "user",
        "content": "Tôi đang thử việc 3 tháng. Tôi có được nghỉ phép không?"
    }]
)

print(response.content[0].text)
# Output: Theo chính sách nghỉ phép 2025, nhân viên thử việc không được áp dụng
# chế độ nghỉ phép. Thông tin này được ghi rõ: "Nhân viên thử việc: không áp dụng."
```

### Ví dụ 2: Citations API của Anthropic

Anthropic hỗ trợ citations native qua document blocks — model tự động chỉ ra đúng đoạn văn nó dựa vào:

```python
from anthropic import Anthropic

client = Anthropic()

response = client.messages.create(
    model="claude-opus-4-5",
    max_tokens=1024,
    messages=[{
        "role": "user",
        "content": [
            {
                "type": "document",
                "source": {
                    "type": "text",
                    "media_type": "text/plain",
                    "data": "Chính sách hoàn tiền: Khách hàng được hoàn tiền trong vòng 30 ngày kể từ ngày mua. Sản phẩm điện tử không được hoàn tiền sau khi kích hoạt."
                },
                "title": "Chính sách hoàn tiền Q1 2025",
                "citations": {"enabled": True}  # bật citations
            },
            {
                "type": "text",
                "text": "Tôi mua laptop 45 ngày trước. Có hoàn tiền được không?"
            }
        ]
    }]
)

print(response.content[0].text)
# Model trích dẫn chính xác đoạn văn từ tài liệu thay vì tự diễn giải
```

---

## Phần 5: Khi nào nên dùng

**Tình huống 1: Tài liệu thay đổi thường xuyên**
Chính sách công ty, giá sản phẩm, quy định pháp luật cập nhật mỗi tuần. Fine-tuning quá chậm và tốn kém. RAG cho phép cập nhật vector DB mà không đụng đến model.

**Tình huống 2: Cần audit trail và trích dẫn nguồn**
Ứng dụng y tế, pháp lý, tài chính — nơi câu trả lời phải kèm nguồn gốc cụ thể. Citations API cho phép model chỉ ra đúng đoạn văn nó đang dựa vào, phục vụ compliance.

**Tình huống 3: Domain knowledge không có trong training data**
Tài liệu nội bộ, codebase công ty, research paper mới xuất bản. Model chưa bao giờ thấy dữ liệu này — grounding là cách duy nhất để model dùng được thông tin đó.

---

## Phần 6: Khi nào KHÔNG nên dùng

**Anti-pattern 1: Grounding câu hỏi general knowledge**
Hỏi "Python là gì?" hay "2 + 2 = ?" — model đã biết. Nhồi tài liệu không liên quan tốn token và có thể gây nhiễu. Chỉ grounding khi thông tin cần *không có* trong training data hoặc cần xác minh nguồn.

**Anti-pattern 2: Tin tưởng retriever mù quáng**
Nếu retriever không lấy được đúng chunks, model không có thông tin và có thể fallback về hallucination — nhưng vẫn trả lời tự tin. Lỗi này khó detect hơn hallucination thông thường vì bạn đã nghĩ mình đã grounding. Log top-K chunks và verify thủ công trong quá trình dev.

**Anti-pattern 3: Dùng grounding thay vì fine-tuning cho behavior**
Grounding tốt cho facts, tệ cho style. Nếu bạn muốn model luôn trả lời ngắn gọn, dùng tone nghiêm túc, hoặc hiểu domain-specific jargon — đó là việc của fine-tuning hoặc system prompt, không phải RAG.

---

## Phần 7: Gotchas & Bẫy thực tế

**Bẫy 1: Chunk size ảnh hưởng trực tiếp đến chất lượng**
Chunks < 100 tokens: mất context, model không hiểu đủ. Chunks > 1000 tokens: vector không đủ specific, retrieval kém. Thực tế 256–512 tokens với 20% overlap thường hoạt động tốt nhất — nhưng phải experiment theo domain cụ thể.

**Bẫy 2: "Lost in the middle" trong retrieved context**
Khi đưa nhiều chunks vào prompt, model chú ý kém vào phần giữa (đã học ở bài Context Window). Nếu thông tin quan trọng nằm ở chunk thứ 3 trong 5 chunks, model có thể bỏ qua. Giải pháp: rerank chunks, đặt chunk quan trọng nhất ở đầu hoặc cuối context.

**Bẫy 3: Embedding mismatch giữa query và document**
Query "giá iPhone" và document "Apple iPhone 15 Pro: 999 USD" có thể có cosine similarity thấp vì dùng từ khác nhau. Kỹ thuật HyDE (Hypothetical Document Embeddings) giải quyết điều này: yêu cầu model viết câu trả lời giả, dùng câu đó để search thay vì query gốc.

**Bẫy 4: Citations không đảm bảo diễn giải đúng**
Model có thể cite đúng source nhưng diễn giải sai nội dung. Citations giảm hallucination về *thông tin từ đâu*, không loại bỏ lỗi *hiểu sai*. Cần validation layer ở production cho ứng dụng quan trọng.

---

## Phần 8: Liên kết với các keyword khác

→ **Hallucination & Grounding** (đã học): Hallucination là vấn đề; grounding là kỹ thuật cụ thể ngăn model bịa thông tin bằng cách cung cấp nguồn thật

→ **Context Window** (đã học): Retrieved chunks chiếm không gian context — trade-off giữa số lượng chunks và độ dài conversation, cần cân nhắc kỹ

→ **In-context Learning** (đã học): Grounding là dạng đặc biệt của in-context learning — đưa thông tin vào context, nhưng tập trung vào tài liệu thật thay vì examples minh họa

→ **RAG basics** (sắp học): Grounding là concept, RAG là implementation — bài tới đi sâu vào pipeline kỹ thuật đầy đủ với vector DB và embedding models

→ **Prompt Injection** (sắp học): Tài liệu được ground có thể chứa malicious instructions — grounding mở ra attack surface mới cần xử lý

---

## Phần 9: Tự kiểm tra (5 câu hỏi mở)

**Q1**: Giải thích grounding bằng lời của bạn — cụ thể nó thay đổi cách LLM sinh câu trả lời như thế nào so với không grounding?

**Q2**: Sếp yêu cầu bạn build chatbot hỗ trợ 500 tài liệu nội bộ, cập nhật mỗi ngày. Bạn sẽ thiết kế pipeline grounding như thế nào?

**Q3**: Khi nào bạn KHÔNG nên dùng RAG grounding? Đưa ra 2 ví dụ cụ thể.

**Q4**: So sánh grounding với fine-tuning: chúng giải quyết vấn đề gì khác nhau? Khi nào nên dùng cái nào?

**Q5**: Nếu retriever luôn trả về đúng chunks nhưng model vẫn đôi khi hallucinate, vấn đề có thể nằm ở đâu?

---

## Phần 10: Bài tập 24h

**Nhiệm vụ**: Xây RAG chatbot đơn giản cho tài liệu của bạn

Tạo chatbot trả lời câu hỏi dựa trên một tập tài liệu bạn chọn (chính sách công ty, README dự án, hoặc bất kỳ văn bản nào bạn có). Không cần vector DB — dùng simple string matching hoặc TF-IDF làm retriever để tập trung vào hiểu grounding.

**Acceptance criteria**:
1. Chatbot trả lời đúng ít nhất 5 câu hỏi dựa trên tài liệu
2. Khi hỏi thông tin không có trong tài liệu, chatbot nói rõ "không tìm thấy trong tài liệu"
3. Mỗi câu trả lời kèm tên file hoặc section nguồn
4. Test với ít nhất 2 câu hỏi "bẫy" — câu model sẽ dễ bịa nếu không grounding

**Thời gian ước tính**: 45–60 phút

**Gợi ý**: Bắt đầu với `<document>` XML tags trong system prompt — không cần vector DB để hiểu cơ chế grounding. Thêm vector search sau khi bạn đã thấy nó hoạt động.

---

## Đáp án tự kiểm tra (đọc sau khi đã tự trả lời)

**Q1**: Không grounding: model lấy thông tin từ training weights (có thể sai, lỗi thời, hoặc không tồn tại). Có grounding: model đọc tài liệu cụ thể trong context và tổng hợp câu trả lời từ đó. Nếu thông tin không có trong tài liệu, model phải nói vậy thay vì tự bịa.

**Q2**: (1) Chunk tài liệu thành 256–512 token pieces với 20% overlap; (2) embed với embedding model, lưu vào vector DB (Pinecone/Chroma/Weaviate); (3) mỗi ngày re-index tài liệu mới/cập nhật; (4) khi có query: embed query → retrieve top-5 chunks → đưa vào prompt với instruction grounding → kèm citations để audit.

**Q3**: (1) Câu hỏi general knowledge model đã biết — thêm RAG không cải thiện và tốn token. (2) Task sáng tạo không yêu cầu độ chính xác về dữ kiện — brainstorming, viết truyện, nơi "đúng tài liệu" không phải mục tiêu.

**Q4**: Fine-tuning nhúng kiến thức vào weights — phù hợp cho style, tone, task adaptation; không phù hợp cho facts cần cập nhật. Grounding đưa kiến thức vào context — phù hợp cho knowledge cần fresh và verifiable. Dùng fine-tuning để thay đổi cách model "nói"; dùng grounding để thay đổi model "biết gì" lúc runtime.

**Q5**: Vấn đề có thể ở: (1) chunks quá lớn — model không chú ý đủ đến chi tiết; (2) "lost in the middle" — thông tin quan trọng nằm giữa context; (3) model diễn giải sai tài liệu dù đúng source; (4) instruction grounding không đủ mạnh — cần prompt rõ hơn "chỉ dựa trên tài liệu, không thêm thông tin bên ngoài".
