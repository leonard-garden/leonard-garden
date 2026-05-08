---
title: "CLAUDE.md: Cách ra lệnh cho Claude Code mà không cần nhắc đi nhắc lại"
description: "CLAUDE.md là file markdown mà Claude Code tự động đọc mỗi khi bạn mở một project, dùng để định nghĩa ngữ cảnh, quy tắc, và lệnh cụ thể cho project đó. Thay vì giải thích lại kiến trúc hay convention mỗi phiên làm việc, bạn viết một lần trong CLAUDE.md và Claude Code nhớ xuyên suốt. File này được commit vào repo, tức là toàn team dùng chung cùng một bộ hướng dẫn."
locale: "vi"
translationKey: "claude-md"
publishedAt: 2026-05-08
pillar: "ai"
type: "article"
draft: false
---

## TL;DR

**CLAUDE.md** là file markdown mà Claude Code tự động đọc mỗi khi bạn mở một project, dùng để định nghĩa ngữ cảnh, quy tắc, và lệnh cụ thể cho project đó. Thay vì giải thích lại kiến trúc hay convention mỗi phiên làm việc, bạn viết một lần trong CLAUDE.md và Claude Code nhớ xuyên suốt. File này được commit vào repo, tức là toàn team dùng chung cùng một bộ hướng dẫn.

---

## Phần 1: Vấn đề nó giải quyết

Một kỹ sư dùng Claude Code để refactor một module trong dự án dùng Drizzle ORM và Better Auth. Mỗi phiên làm việc mới, anh ta phải giải thích lại: "Dùng Drizzle, không phải Prisma. Schema ở `src/db/schema.ts`. Auth config ở `src/lib/auth.ts`. Đừng tự tạo migration thủ công, chạy `npm run db:push`."

Sau ba tuần, anh ta có một đoạn prompt boilerplate dài 200 chữ phải paste mỗi lần mở terminal.

Đây không phải vấn đề của Claude — đây là vấn đề thiếu persistence của ngữ cảnh giữa các session. CLAUDE.md giải quyết đúng cái này: bạn viết một lần, Claude Code đọc tự động mỗi khi vào project.

---

## Phần 2: Định nghĩa chính xác

**CLAUDE.md** là file markdown đặc biệt mà Claude Code tìm và đọc tự động khi bắt đầu một session trong thư mục dự án. Nội dung file được đưa vào context của Claude trước bất kỳ tin nhắn nào của bạn.

Phân biệt với các khái niệm liên quan:

| Khái niệm | Vai trò | Ai viết |
|---|---|---|
| CLAUDE.md (project) | Hướng dẫn cho một repo cụ thể | Developer/team |
| CLAUDE.md (global `~/.claude/`) | Hướng dẫn áp dụng cho mọi project | Cá nhân |
| System prompt (API) | Định nghĩa vai trò của LLM | Developer dùng API |
| `.cursorrules` (Cursor) | Tương đương trong Cursor IDE | Developer |

CLAUDE.md khác system prompt API: nó được version-controlled, chia sẻ qua git, và đọc tự động — không cần code để inject.

---

## Phần 3: Cơ chế hoạt động

Khi bạn chạy `claude` trong một thư mục:

```
1. Claude Code tìm CLAUDE.md theo thứ tự ưu tiên:
   a. ~/.claude/CLAUDE.md          (global — luôn đọc trước)
   b. <project-root>/CLAUDE.md     (project — override hoặc bổ sung)
   c. <subdirectory>/CLAUDE.md     (nếu bạn đang làm việc trong subdir)

2. Nội dung tất cả các file tìm được được ghép lại

3. Kết quả được đưa vào đầu context window của session

4. Claude Code xử lý tin nhắn của bạn với ngữ cảnh đó đã sẵn có
```

Ngoài ra, CLAUDE.md hỗ trợ cú pháp `@path/to/file.md` để import nội dung từ file khác — hữu ích khi bạn muốn tách phần architecture documentation ra file riêng mà không bloat CLAUDE.md.

```markdown
# CLAUDE.md

@docs/architecture.md
@docs/api-conventions.md

## Commands
npm run dev   # Start dev server
npm run build # Production build
```

---

## Phần 4: Ví dụ cụ thể

### Ví dụ 1: CLAUDE.md tối giản cho dự án Next.js

```markdown
# CLAUDE.md

## Commands
npm run dev       # localhost:3000
npm run build     # production build, check for type errors
npm run db:push   # sync schema → database (no migration files)

## Stack
- Next.js 14 App Router
- Drizzle ORM (NOT Prisma)
- Better Auth
- Database schema: src/db/schema.ts
- Auth config: src/lib/auth.ts

## Conventions
- Server components by default; add "use client" only when needed
- Never hardcode secrets; use environment variables from .env.local
- API routes go in src/app/api/[route]/route.ts
```

Với file này, bạn không cần nhắc "dùng Drizzle không phải Prisma" nữa — Claude Code đã biết.

### Ví dụ 2: CLAUDE.md dùng @import cho dự án lớn

```markdown
# CLAUDE.md — Project Acme

## Quick Commands
npm run dev
npm run test
npm run lint

## Architecture
@docs/ARCHITECTURE.md

## API Design Guidelines
@docs/api-conventions.md

## Security Rules
Never log request bodies containing passwords or tokens.
Always validate user input using the Zod schemas in src/schemas/.
```

Khi Claude Code đọc file này, nó tự động pull nội dung của `ARCHITECTURE.md` và `api-conventions.md` vào context — không cần bạn paste thủ công.

---

## Phần 5: Khi nào nên dùng

**Scenario 1: Dự án có convention không phổ biến**
Bạn dùng Bun thay Node, Drizzle thay Prisma, hoặc Better Auth thay NextAuth. Mỗi công cụ này có cú pháp và pattern khác nhau. CLAUDE.md cho Claude Code biết tool nào đang được dùng để tránh gợi ý sai.

**Scenario 2: Monorepo hoặc dự án nhiều module**
Mỗi subdirectory có thể có CLAUDE.md riêng. Package `apps/web/` có thể có quy tắc khác `packages/shared/`. Claude Code sẽ đọc đúng CLAUDE.md tương ứng với thư mục đang làm việc.

**Scenario 3: Onboarding developer mới vào team**
Thay vì document architecture trong Notion rồi phải nhớ chia sẻ, bạn đưa thông tin quan trọng vào CLAUDE.md. Developer mới clone repo, chạy `claude`, và Claude Code đã biết context của dự án — có thể hỏi các câu hỏi có ngữ cảnh ngay lập tức.

---

## Phần 6: Khi nào KHÔNG nên dùng

**Anti-pattern 1: Dùng CLAUDE.md để document toàn bộ codebase**
CLAUDE.md đi vào context window của mọi session. Nếu bạn nhồi 5000 chữ vào đó, bạn tốn token mỗi tin nhắn và có thể đẩy thông tin quan trọng ra ngoài "vùng chú ý hiệu quả" của model (xem: Attention — Lost in the Middle). Thay vào đó: dùng `@import` để lazy-load các file chi tiết chỉ khi cần.

**Anti-pattern 2: Lưu secrets hoặc credentials trong CLAUDE.md**
CLAUDE.md được commit vào git và chia sẻ với toàn team. Không bao giờ để API key, password, hay bất kỳ thông tin nhạy cảm nào trong file này. Dùng `.env` và đưa vào `.gitignore`.

**Anti-pattern 3: Viết hướng dẫn mâu thuẫn nhau**
Nếu global `~/.claude/CLAUDE.md` và project CLAUDE.md có quy tắc xung đột (ví dụ: global nói "dùng tabs", project nói "dùng spaces"), Claude Code sẽ thấy cả hai và có thể không nhất quán. Hãy giữ global CLAUDE.md cho preferences cá nhân (model, tone) và project CLAUDE.md cho conventions cụ thể của project đó.

---

## Phần 7: Gotchas và bẫy thường gặp

**Bẫy 1: File quá dài làm giảm chất lượng attention**
Nội dung CLAUDE.md nằm ở đầu context. Nếu file quá dài (>500 dòng), phần cuối có thể bị model "coi nhẹ hơn" do cơ chế attention. Cách phát hiện: thêm một rule quan trọng ở cuối file rồi kiểm tra Claude Code có tuân theo không. Cách fix: dùng `@import` để phân tách nội dung, chỉ để những gì quan trọng nhất trong phần đầu CLAUDE.md.

**Bẫy 2: CLAUDE.md không được đọc vì sai vị trí**
Claude Code tìm CLAUDE.md ở thư mục root của project (nơi chứa `.git`). Nếu bạn đặt file ở `src/CLAUDE.md` mà không chạy claude từ `src/`, file sẽ không được đọc. Cách fix: luôn đặt file ở project root hoặc dùng subdirectory CLAUDE.md kết hợp với việc chạy claude từ đúng thư mục.

**Bẫy 3: Quên update CLAUDE.md khi thay đổi stack**
Bạn chuyển từ Prisma sang Drizzle nhưng quên cập nhật CLAUDE.md. Claude Code vẫn gợi ý Prisma patterns. Cách phát hiện: làm code review và nhận ra Claude Code recommend sai tool. Cách fix: coi CLAUDE.md như một file cần update trong mỗi PR thay đổi stack/convention.

**Bẫy 4: Dùng CLAUDE.md thay vì giải thích trực tiếp trong chat**
CLAUDE.md phù hợp cho thông tin ổn định và áp dụng lâu dài. Nếu bạn đang debug một vấn đề tạm thời, giải thích trong chat thay vì thêm vào CLAUDE.md — nếu không file sẽ tích lũy thông tin cũ không còn relevant.

---

## Phần 8: Kết nối với các keyword khác

→ **Context Window** (đã học): CLAUDE.md được inject vào đầu context window mỗi session. File càng dài, càng chiếm nhiều token của context.

→ **System Prompt vs User Prompt** (đã học): CLAUDE.md đóng vai trò tương tự system prompt — nó định hình hành vi của model trước khi user message đến. Khác ở chỗ: không cần code để inject, tự động từ file.

→ **Agent Loop** (đã học): Khi Claude Code chạy trong agentic mode (tự động thực hiện nhiều bước), CLAUDE.md cung cấp các constraints để agent không làm những việc nguy hiểm (ví dụ: "đừng chạy migration production trực tiếp").

→ **In-context Learning** (đã học): Bạn có thể đưa examples và patterns vào CLAUDE.md để guide cách Claude Code viết code theo style của project — đây là in-context learning ở dạng persistent.

→ **Hooks** (sắp học): Claude Code hỗ trợ hooks — các lệnh tự động chạy sau mỗi tool call. Hooks được cấu hình trong settings, nhưng thường được document trong CLAUDE.md để team biết behavior đó tồn tại.

---

## Phần 9: Tự kiểm tra

**Q1**: Giải thích CLAUDE.md bằng lời của bạn. File này được đọc khi nào, bởi ai, và tại sao nó khác với việc paste ngữ cảnh vào chat?

**Q2**: Bạn đang bắt đầu một dự án SaaS dùng Supabase, tRPC, và Zod validation. Viết ra 5 thứ bạn sẽ đưa vào CLAUDE.md và giải thích tại sao mỗi thứ xứng đáng có mặt trong đó.

**Q3**: Đồng nghiệp bạn đề xuất viết toàn bộ ERD database (200 bảng) vào CLAUDE.md để Claude Code hiểu schema. Bạn sẽ phản đối như thế nào và đề xuất giải pháp thay thế gì?

**Q4**: So sánh CLAUDE.md với System Prompt trong Anthropic API. Điểm giống và khác nhau là gì? Khi nào bạn dùng cái này thay vì cái kia?

**Q5**: Nếu một dự án có cả `~/.claude/CLAUDE.md` (global) lẫn `./CLAUDE.md` (project), và hai file có quy tắc xung đột nhau, điều gì xảy ra? Làm sao bạn thiết kế để tránh xung đột này?

---

## Phần 10: Bài tập thực hành (24h challenge)

**Task**: Tạo CLAUDE.md cho một project thực của bạn (hoặc một project mẫu Next.js).

**Yêu cầu**:
1. Bắt đầu một project Next.js mới bằng `npx create-next-app@latest`
2. Tạo `CLAUDE.md` ở project root với tối thiểu 4 sections: Commands, Stack, File Locations, Conventions
3. Mở Claude Code, không nói gì, chỉ hỏi: "Dùng ORM gì trong project này?" và kiểm tra Claude Code có trả lời đúng không
4. Thêm một quy tắc sai vào cuối file (ví dụ: "Always use callbacks, never async/await") rồi hỏi Claude Code để kiểm tra nó có "nghe" quy tắc đó không — đây là cách test CLAUDE.md có được đọc đầy đủ không
5. Commit `CLAUDE.md` vào git và verify rằng file không chứa bất kỳ credential nào

**Thời gian ước tính**: 30–45 phút

**Tiêu chí hoàn thành**:
- Claude Code trả lời đúng về stack mà không cần bạn giải thích
- File không vượt quá 100 dòng (focused, không bloat)
- Không có hardcoded secret nào trong file
- File được commit vào git

---

## Đáp án tự kiểm tra (đọc sau khi đã tự trả lời)

**Q1**: CLAUDE.md là file markdown được Claude Code tự động đọc khi bắt đầu session trong một project. Không cần code, không cần paste thủ công — Claude Code tìm file theo thứ tự ưu tiên (global → project → subdir) và inject vào context. Khác với paste vào chat ở chỗ: persistent qua mọi session, version-controlled trong git, chia sẻ được với cả team.

**Q2**: Nên đưa vào: (1) commands hay dùng (`npm run dev`, database sync command), (2) tên ORM/auth library với path file config, (3) convention về file structure (router path, schema location), (4) quy tắc quan trọng về security (không log request body, validate bằng Zod), (5) điều gì NOT to do (không tự tạo migration thủ công, không dùng Prisma).

**Q3**: 200 bảng ERD là quá lớn để inject mỗi session — tốn nhiều token, giảm attention cho phần còn lại của context. Giải pháp thay thế: để CLAUDE.md chỉ reference đường dẫn schema (`Schema: src/db/schema.ts`) và dùng `@import` lazy để Claude Code chỉ đọc file schema khi thực sự cần thiết cho task đang làm.

**Q4**: Giống: cả hai đều định hình behavior của model trước khi user message đến, và ảnh hưởng xuyên suốt conversation. Khác: System Prompt API yêu cầu code để inject và không được version-control tự động; CLAUDE.md là file trên disk, tự động đọc bởi Claude Code CLI, không cần code, và được commit vào git. Dùng System Prompt khi build product/API; dùng CLAUDE.md khi dùng Claude Code CLI để develop.

**Q5**: Claude Code đọc cả hai và ghép lại. Nếu xung đột, kết quả không nhất quán — model thấy hai chỉ dẫn trái ngược và có thể follow cái nào cũng được. Thiết kế để tránh: global CLAUDE.md chỉ chứa preferences cá nhân không liên quan đến project (ví dụ: "respond in Vietnamese", "prefer concise answers"); project CLAUDE.md chứa conventions cụ thể của project. Không để hai cấp cùng nói về cùng một vấn đề.
