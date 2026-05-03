---
name: blog-writer
description: Viết bài blog học sâu về 1 keyword Claude Code/LLM engineering theo template 10 phần. Dùng khi user gõ /blog hoặc yêu cầu viết tài liệu học có cấu trúc, không phải bài viết generic.
---

# Skill: Blog Writer

## Khi nào skill này active
- User gõ `/blog [keyword]`
- User yêu cầu rõ ràng "viết blog học sâu về X"

## KHÔNG dùng skill này khi
- User chỉ hỏi giải thích nhanh (trả lời inline)
- User muốn bài viết casual, không cần cấu trúc

## Workflow bắt buộc

### Bước 1: Load context
Đọc các file sau trong skill folder:
- `TEMPLATE.md` — cấu trúc 10 phần
- `STYLE_GUIDE.md` — quy tắc tone, format
- `CHECKLIST.md` — self-check trước xuất

### Bước 2: Research keyword (nếu cần)
- Concept LLM cơ bản: dùng knowledge có sẵn
- Claude Code-specific (MCP, hooks, skills...): web search docs.anthropic.com để verify
- Số liệu cụ thể (giá, version, limits): BẮT BUỘC verify

### Bước 3: Viết bài theo TEMPLATE
- Tuân thủ ĐÚNG cấu trúc 10 phần
- Tuân thủ STYLE_GUIDE
- Mỗi ví dụ phải có code/config thật, runnable

### Bước 4: Self-check theo CHECKLIST
- Đi qua từng mục checklist
- Nếu fail bất kỳ mục nào → revise, không xuất

### Bước 5: Output
- Save vào path do command chỉ định
- Update progress.md
- Báo user

## Quy tắc CỨNG (không bao giờ vi phạm)

1. **KHÔNG bịa**. Số liệu chưa chắc → search hoặc nói "không chắc"
2. **KHÔNG fluff**. Mỗi câu phải có thông tin
3. **KHÔNG skip "Khi nào KHÔNG dùng"** — đây là phần test mastery
4. **KHÔNG skip "Gotchas"** — đây là giá trị thực tế của bài
5. **KHÔNG đặt đáp án self-test ở giữa bài** — phải ở CUỐI cùng
6. **KHÔNG vượt 1800 từ**
7. **KHÔNG dùng câu sáo rỗng** liệt kê trong STYLE_GUIDE

## Khi gặp keyword không rõ
HỎI user thay vì đoán:
- "Keyword này chưa có trong lộ trình. Bạn muốn thêm vào category nào?"
- "Tôi không tìm thấy info đáng tin về X. Bạn có nguồn không?"
