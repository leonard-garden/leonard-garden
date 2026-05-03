# Blog Writing System cho Học Sâu Claude Code

Hệ thống cá nhân để học sâu Claude Code và LLM engineering qua viết blog có cấu trúc.

## Cách dùng

### Viết bài mới
```
/blog [keyword-slug]
```
Ví dụ: `/blog token-tokenization`

### Review bài đã viết
```
/blog-review blogs/00-foundation/01-token-tokenization.md
```

### Xem progress
```
/blog-list
```

## Cấu trúc

- `CLAUDE.md` — Project context, quy tắc cứng
- `.claude/commands/` — Slash commands
- `.claude/skills/blog-writer/` — Logic viết blog
- `blogs/` — Output bài viết (3 categories)
- `notes/` — Note tự viết của bạn (sau khi đọc blog)
- `exercises/` — Bài tập 24h sau mỗi blog
- `progress.md` — Tracking 30 keywords

## Quy trình học mỗi keyword

1. `/blog [keyword]` → Claude viết bài
2. Đọc chủ động: KHÔNG nhìn đáp án self-test
3. Tự trả lời 5 câu hỏi self-test trong note riêng
4. So sánh với đáp án ở cuối bài
5. Làm bài tập 24h trong `exercises/[keyword]/`
6. Update `progress.md`
7. Sau D+7 và D+30: review lại, không nhìn bài

## Quy tắc vàng

- **1 keyword/ngày**, không hơn
- **Bỏ ngày nào không có thời gian áp dụng** thay vì viết thêm bài
- **Tự diễn đạt lại** bằng lời mình trong notes/
- **Cấm copy-paste** content blog vào notes
