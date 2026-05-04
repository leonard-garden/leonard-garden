---
description: Viết bài blog học sâu cho 1 keyword theo template 10 phần
argument-hint: [keyword-slug]
---

# /blog Command

User muốn viết blog cho keyword: **$ARGUMENTS**

## Bước cần làm

0. **Git flow setup**:
   - Checkout về `develop` và pull latest: `git checkout develop && git pull origin develop`
   - Tạo nhánh mới: `git checkout -b feat/blog-<slug>`
   - Ví dụ: `feat/blog-attention-lost-in-middle`

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

9. **Publish blog**: Chạy `/blog-publish <slug>` để tạo file content trong `src/content/articles/`.

10. **Commit, push và tạo PR**:
    - Stage tất cả files liên quan đến bài blog
    - Commit: `feat: add <keyword> blog post (VI + EN)`
    - Push nhánh: `git push origin feat/blog-<slug>`
    - Tạo PR vào `develop` với title: `feat: blog - <keyword>`
    - PR body: tóm tắt nội dung bài, số từ VI/EN, keyword connections

11. **Output cho user**:
    - Đường dẫn 2 files blog (VI + EN)
    - Đường dẫn 2 files content đã publish
    - Số từ mỗi bài
    - Link PR vừa tạo
    - Nhắc: "Đọc theo checklist active learning, làm self-test KHÔNG nhìn bài, làm bài tập 24h"
