---
description: Viết bài blog học sâu cho 1 keyword theo template 10 phần
argument-hint: [keyword-slug]
---

# /blog Command

User muốn viết blog cho keyword: **$ARGUMENTS**

## Bước cần làm

1. **Load skill blog-writer**: Đọc `.claude/skills/blog-writer/SKILL.md` và follow toàn bộ instruction trong đó.

2. **Validate keyword**: Check `progress.md` xem keyword có trong lộ trình không. Nếu không có, hỏi user xác nhận trước khi viết.

3. **Determine output path**:
   - Foundation (1-10): `blogs/00-foundation/`
   - Core (11-20): `blogs/01-claude-code-core/`
   - Workflow (21-30): `blogs/02-workflow-quality/`

4. **Viết bản VI** theo TEMPLATE.md, STYLE_GUIDE.md. Self-check theo CHECKLIST.md TRƯỚC khi save.

5. **Save bản VI**: `<folder>/<num>-<slug>-vi.md`

6. **Viết bản EN**: dịch toàn bộ nội dung sang tiếng Anh, giữ đúng cấu trúc 10 phần, giữ technical terms tiếng Anh. Tone: direct, same style. Self-check theo CHECKLIST.md.

7. **Save bản EN**: `<folder>/<num>-<slug>-en.md`

8. **Update `progress.md`**: đánh dấu cột "Written" thành ✅ cho keyword này.

9. **Output cho user**:
   - Đường dẫn 2 files đã tạo (VI + EN)
   - Số từ mỗi bài
   - Nhắc: "Dùng `/blog-publish <slug>` khi muốn đưa lên website"
   - Nhắc: "Đọc theo checklist active learning, làm self-test KHÔNG nhìn bài, làm bài tập 24h"
