---
description: Publish bài blog từ blogs/ lên src/content/articles/ để hiển thị trên website
argument-hint: [keyword-slug]
---

# /blog-publish Command

User muốn publish keyword: **$ARGUMENTS**

## Workflow

1. **Tìm file nguồn** trong `blogs/`:
   - Tìm file match `*-<slug>-vi.md` và `*-<slug>-en.md`
   - Nếu không tìm thấy: báo lỗi, nhắc user chạy `/blog <slug>` trước

2. **Xác định số thứ tự và category** từ tên file (vd: `01`, `12`, `25`)

3. **Đọc cả 2 file** VI và EN

4. **Tạo file VI** tại `src/content/articles/vi/<slug>.md`:
   - Thêm frontmatter Astro vào đầu:
   ```yaml
   ---
   title: "<H1 của bài VI>"
   description: "<3 câu TL;DR của bài>"
   locale: "vi"
   translationKey: "<slug>"
   publishedAt: <ngày hôm nay YYYY-MM-DD>
   pillar: "ai"
   type: "article"
   draft: false
   ---
   ```
   - Append toàn bộ nội dung bài VI (bỏ dòng H1 vì đã có title trong frontmatter)

5. **Tạo file EN** tại `src/content/articles/en/<slug>.md`:
   - Thêm frontmatter Astro vào đầu:
   ```yaml
   ---
   title: "<H1 của bài EN>"
   description: "<TL;DR của bài EN — 3 sentences>"
   locale: "en"
   translationKey: "<slug>"
   publishedAt: <ngày hôm nay YYYY-MM-DD>
   pillar: "ai"
   type: "article"
   draft: false
   ---
   ```
   - Append toàn bộ nội dung bài EN (bỏ dòng H1)

6. **Output cho user**:
   - Đường dẫn 2 files đã tạo
   - Nhắc: "Chạy `npm run dev` để preview trên website"
   - Nhắc: "Kiểm tra hreflang và pillar link đúng chưa"

## Quy tắc

- `translationKey` của VI và EN phải GIỐNG NHAU (dùng `<slug>`)
- `pillar: "ai"` cho tất cả Claude Code / LLM engineering content
- Nếu file đích đã tồn tại: hỏi user xác nhận trước khi overwrite
- KHÔNG thay đổi nội dung bài, chỉ thêm frontmatter và bỏ H1 đầu bài
