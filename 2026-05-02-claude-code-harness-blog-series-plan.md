# Blog Series Plan: "Harness cho Claude Code"

**Ngày tạo:** 2026-05-02  
**Nguồn tham khảo:** `Harness_Claude_Code_Guide.pdf`  
**Pillar:** `ai`  
**Target reader:** Developer backend/fullstack đang hoặc muốn dùng Claude Code nghiêm túc  
**Tổng số bài:** 16  
**Lịch đăng đề xuất:** 1–2 bài/tuần, theo đúng thứ tự học trong PDF (Tuần 1–5+)

---

## Mục tiêu series

Giúp reader hiểu và xây dựng được "harness" — bộ khung bao quanh Claude Code để biến
nó từ AI assistant thuần túy thành development partner có ngữ cảnh, có kỷ luật, và có
khả năng tự kiểm chứng.

Ba câu hỏi cốt lõi xuyên suốt series:
- Claude cần biết gì để làm tốt task này? → **Context Engineering**
- Claude nên suy nghĩ và phản hồi thế nào? → **Prompt Engineering**
- Làm sao để Claude làm việc an toàn và lặp lại được? → **Harness Engineering**

---

## Nhóm 0 — Khai mạc

### Bài 0: Harness là gì và tại sao copy template không đủ
**Slug:** `harness-cho-claude-code-la-gi`  
**Nội dung:**
- Harness = scaffolding bao quanh Claude Code (không phải viết code thông thường)
- 3 trụ cột: Context / Prompt / Harness Engineering
- 4 lớp kiến trúc: Foundation → Tooling → Workflow → Verification
- 6 sai lầm phổ biến khi setup (thiếu "why", top-down quá sớm, checklist dàn trải...)
- Câu hỏi đúng: "Làm sao để Claude làm việc hiệu quả và đáng tin cậy trên dự án của tôi?"
- 3 vấn đề thực tế harness giải quyết

---

## Nhóm 1 — Nền tảng LLM (Tầng 0 + 1) — Tuần 1

### Bài 1: LLM fundamentals mà developer cần hiểu trước khi dùng AI
**Slug:** `llm-fundamentals-cho-developer`  
**Nội dung:**
- Token / Tokenization — đơn vị Claude xử lý
- Context window — bộ nhớ ngắn hạn 200k tokens
- Attention & "Lost in the middle" — tại sao vị trí instruction quan trọng
- Hallucination, Grounding, RAG cơ bản
- Agent loop & ReAct pattern — core của Claude Code
- Determinism in LLMs — tại sao test harness phải tolerant

### Bài 2: CLAUDE.md — File quan trọng nhất trong codebase của bạn
**Slug:** `claude-md-file-quan-trong-nhat`  
**Nội dung:**
- CLAUDE.md là gì: file context tự động load mỗi session
- Project memory vs User memory (`~/.claude/CLAUDE.md`) vs Enterprise
- Memory hierarchy: Project > User > Enterprise (thứ tự override)
- Dynamic memory loading với `@import`
- Context priming — câu mở đầu định hình mindset Claude
- Coding standards, ADR, runbooks, domain glossary trong CLAUDE.md
- Những sai lầm thường gặp khi viết CLAUDE.md

### Bài 3: Context Engineering — Cung cấp đúng thông tin, đúng lúc
**Slug:** `context-engineering-dung-thong-tin-dung-luc`  
**Nội dung:**
- Just-in-time context loading vs nhồi sẵn tất cả
- Context compaction / summarization — `/compact` command
- Context poisoning & context rot
- RAG cơ bản: Retrieval-Augmented Generation
- Semantic search vs Lexical search (ripgrep)
- Chunking strategies, Reranking
- Needle in haystack — test giới hạn context

---

## Nhóm 2 — Tooling Layer (Tầng 2) — Tuần 2

### Bài 4: MCP (Model Context Protocol) — Mở rộng sức mạnh Claude
**Slug:** `mcp-model-context-protocol-mo-rong-suc-manh-claude`  
**Nội dung:**
- MCP là gì: giao thức chuẩn AI ↔ tool do Anthropic định nghĩa
- MCP server / client / transport (stdio, SSE, HTTP)
- `.mcp.json` — cấu hình cho project, commit vào git
- MCP tools vs MCP resources vs MCP prompts
- MCP sampling, MCP roots (security)
- OAuth flow trong MCP
- Các server phổ biến: github-mcp, postgres-mcp, filesystem...
- Khi nào nên tự viết MCP server

### Bài 5: Slash Commands — Biến prompt phức tạp thành 1 dòng lệnh
**Slug:** `slash-commands-bien-prompt-thanh-lenh`  
**Nội dung:**
- Slash commands là gì: shortcut cho prompt phức tạp
- File `.md` trong `.claude/commands/`
- Arguments: `$1`, `$ARGUMENTS` trong template
- Bash execution với `!command` trước khi gửi
- File reference với `@file.md`
- Project commands (`.claude/`) vs Personal commands (`~/.claude/`)
- Ví dụ thực tế: `/review`, `/deploy`, `/test`

### Bài 6: Permission & Security — Cho Claude vừa đủ quyền
**Slug:** `permission-security-cho-claude-vua-du-quyen`  
**Nội dung:**
- Permission system: kiểm soát tool nào được dùng
- `settings.json` — allowlist / denylist
- Tool permission rules (vd: `Bash(git:*)`)
- Auto-approve mode vs Dangerous mode
- Sandboxing, Devcontainer, Read-only filesystem
- Network policies — giới hạn domain
- Least privilege principle trong thực tế

---

## Nhóm 3 — Workflow Layer (Tầng 3) — Tuần 3

### Bài 7: Subagents — Tách chuyên môn, tăng chất lượng output
**Slug:** `subagents-tach-chuyen-mon-tang-chat-luong`  
**Nội dung:**
- Subagent là gì: agent con với context riêng, tách concern
- Agent definition file: `.claude/agents/*.md`
- Frontmatter: `description`, `tools` restriction
- Agent invocation: tự động khi match description
- Agent context isolation — subagent không thấy context cha
- Parallel agents — nhiều agent chạy đồng thời
- Orchestrator-worker pattern
- Specialist agents: code-reviewer, test-writer, debugger

### Bài 8: Hooks — Guardrail tuyệt đối cho Claude
**Slug:** `hooks-guardrail-cho-claude`  
**Nội dung:**
- Hook là gì: script chạy tự động khi event xảy ra
- Các loại hook: PreToolUse, PostToolUse, Stop, SessionStart, UserPromptSubmit
- Hook matchers — filter event theo tool name
- Hook input JSON qua stdin
- Hook exit codes: 0 = ok, 2 = block, khác = error
- Hook output → đẩy vào context Claude
- Deterministic enforcement: tại sao không nên chỉ tin LLM
- Use cases: auto-lint, format, log, block nguy hiểm

### Bài 9: Workflow Patterns — Làm việc với AI cho ra kết quả nhất quán
**Slug:** `workflow-patterns-lam-viec-voi-ai`  
**Nội dung:**
- Explore-Plan-Code-Commit — 4 bước chuẩn của Anthropic
- Plan mode: chỉ plan, không execute
- Test-Driven Development với AI (Red-Green-Refactor)
- Spec-Driven Development — viết spec chi tiết trước
- Two-pass approach: pass 1 draft, pass 2 refine
- Worktree-based parallel work — chạy nhiều Claude song song
- Branch-per-task

---

## Nhóm 4 — Verification Layer (Tầng 4) — Tuần 4

### Bài 10: Evals — Cách đo chất lượng AI agent (không phải unit test)
**Slug:** `evals-do-chat-luong-ai-agent`  
**Nội dung:**
- Eval khác unit test thế nào
- Eval dataset: input + expected output
- Golden dataset — reference chuẩn
- LLM-as-judge — dùng LLM đánh giá LLM
- Rubric-based evaluation — chấm theo tiêu chí định lượng
- Trajectory evaluation — đánh giá đường đi của agent
- Regression evals trong CI — đảm bảo prompt mới không tệ hơn
- A/B testing prompts

### Bài 11: Tích hợp Claude Code vào CI/CD pipeline
**Slug:** `tich-hop-claude-code-vao-ci-cd`  
**Nội dung:**
- Headless mode (`-p`) — non-interactive cho CI
- GitHub Actions với Claude
- PR review automation — Claude comment PR
- Auto-fix workflows — Claude tự fix lỗi CI
- Pre-commit hooks (Husky, pre-commit framework)
- Conventional commits + Semantic release
- Structured logging, Tracing, Token usage tracking

---

## Nhóm 5 — Nâng cao (Tầng 5) — Tuần 5+

### Bài 12: Agent Design Patterns — Khi nào dùng pattern nào
**Slug:** `agent-design-patterns`  
**Nội dung:**
- Single agent vs Multi-agent system
- Orchestrator-worker pattern
- Hierarchical agents
- Critic-Actor pattern: 1 làm, 1 phê bình
- Swarm pattern: agent peer-to-peer
- Router pattern: agent điều hướng task
- Plan-and-Execute
- Autonomous loop
- Human-in-the-loop — khi nào cần người duyệt

### Bài 13: Tối ưu chi phí Claude — Token economics thực chiến
**Slug:** `toi-uu-chi-phi-claude-token-economics`  
**Nội dung:**
- Input vs Output token cost (output đắt hơn)
- Prompt caching pricing — cache phần đầu prompt (Anthropic feature)
- Model selection: Haiku vs Sonnet vs Opus — trade-off chất lượng/giá
- Context window optimization — giảm token thừa
- Batch processing — gộp nhiều request
- Streaming — nhận response từng phần
- Extended thinking — khi nào bật, khi nào tắt

### Bài 14: Keywords ít ai nhắc nhưng sẽ cứu bạn
**Slug:** `keywords-it-ai-nhat-nhung-quan-trong`  
**Nội dung:**
- Sycophancy — Claude xu nịnh user và cách phòng tránh
- Indirect prompt injection — injection qua file/web Claude đọc
- Context handoff — chuyển context giữa agents
- Anchoring bias — câu đầu ảnh hưởng cả output
- Capability elicitation — khơi gợi năng lực ẩn của model
- Scaffolding vs Harness — hai khái niệm hay nhầm
- Memory systems: episodic / semantic / procedural
- Debate pattern — 2 agent tranh luận để ra quyết định tốt hơn

---

## Bài tổng kết

### Bài 15: Lộ trình 3 cấp độ — Từ Walking Skeleton đến Mature Harness
**Slug:** `lo-trinh-3-cap-do-harness`  
**Nội dung:**
- Walking skeleton: chỉ CLAUDE.md + permissions cơ bản
- Working harness: thêm 3–5 slash commands + 1–2 hooks
- Mature harness: subagents, MCP servers, skills, evals
- Nguyên tắc quyết định 4 câu hỏi (YAGNI cho harness)
- Từ "build" sang "evolve" — harness được phát hiện qua sử dụng
- Checklist onboard người mới / Claude mới trong 1 ngày

---

## Lịch xuất bản đề xuất

| Tuần | Bài | Ghi chú |
|------|-----|---------|
| 1 | Bài 0, 1 | Khai mạc + nền tảng LLM |
| 2 | Bài 2, 3 | CLAUDE.md + Context Engineering |
| 3 | Bài 4, 5 | MCP + Slash Commands |
| 4 | Bài 6, 7 | Security + Subagents |
| 5 | Bài 8, 9 | Hooks + Workflow Patterns |
| 6 | Bài 10, 11 | Evals + CI/CD |
| 7 | Bài 12, 13 | Agent Patterns + Cost |
| 8 | Bài 14, 15 | Hidden keywords + Tổng kết |

---

## Trạng thái

| Bài | Trạng thái |
|-----|-----------|
| Bài 0 | `[ ] chưa viết` |
| Bài 1 | `[ ] chưa viết` |
| Bài 2 | `[ ] chưa viết` |
| Bài 3 | `[ ] chưa viết` |
| Bài 4 | `[ ] chưa viết` |
| Bài 5 | `[ ] chưa viết` |
| Bài 6 | `[ ] chưa viết` |
| Bài 7 | `[ ] chưa viết` |
| Bài 8 | `[ ] chưa viết` |
| Bài 9 | `[ ] chưa viết` |
| Bài 10 | `[ ] chưa viết` |
| Bài 11 | `[ ] chưa viết` |
| Bài 12 | `[ ] chưa viết` |
| Bài 13 | `[ ] chưa viết` |
| Bài 14 | `[ ] chưa viết` |
| Bài 15 | `[ ] chưa viết` |
