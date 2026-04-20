---
type: 'article'
title: 'Career-Ops: mô hình agentic, vai trò AI và kiến trúc hệ thống'
description: 'Mổ xẻ pipeline tìm việc dùng AI CLI: agent đọc modes, luồng đánh giá offer, phân tách dữ liệu system/user và các lớp script — dựa trên tài liệu mở của Career-Ops.'
locale: 'vi'
translationKey: 'career-ops-agentic-architecture'
publishedAt: '2026-04-19'
pillar: 'ai'
tags: ['agentic', 'architecture', 'career-ops', 'claude-code']
readingTimeMinutes: 14
---

Bài viết này tóm tắt **cách Career-Ops thiết kế một hệ “agentic”** quanh AI coding CLI (ví dụ Claude Code): agent đọc hướng dẫn trong repo, chạy theo **modes**, xuất **báo cáo có cấu trúc**, **PDF**, và cập nhật **tracker** — với người dùng giữ quyền quyết định cuối. Nội dung dựa trên tài liệu kiến trúc công khai của dự án; đây không phải lời khuyên tuyển dụng hay pháp lý.

**Tham chiếu mã nguồn mở:** [Career-Ops trên GitHub](https://github.com/santifer/career-ops).

## Agentic ở đây là gì (và không phải gì)

Trong Career-Ops, **agentic** không có nghĩa “tự động nộp hồ sơ thay bạn”. Nghĩa gần đúng hơn là:

- Có một **tác nhân** (CLI AI) đọc **cùng bộ file hướng dẫn** mà maintainer và người dùng cấu hình (`CLAUDE.md`, `modes/*.md`).
- Agent có thể gọi **công cụ** (trình duyệt, tìm kiếm, script Node) để **trích JD**, **đánh giá fit**, **sinh PDF**, **ghi dòng tracker** — nhưng **human-in-the-loop**: người xem kết quả và quyết định hành động.
- Thiết kế nhấn mạnh **lọc và ưu tiên** (ví dụ khuyến nghị không apply khi điểm/độ phù hợp thấp), tránh “spray-and-pray”.

Điểm mấu chốt: **hành vi của hệ** được mã hóa thành **chế độ (modes)** và **pipeline script**, không chỉ một prompt một lần.

## Vai trò của AI: suy luận có cấu trúc, không phải khớp từ khóa đơn thuần

README và spec evaluation mô tả AI **so khớp CV với JD bằng lập luận** (yêu cầu, bằng chứng trong CV, khoảng trống, cách giảm thiểu rủi ro) — khác với lọc ATS kiểu đếm keyword. Thực tế triển khai gói trong các **khối đánh giá** (ví dụ các block A–G trong mode đánh giá offer), cộng **điểm có trọng số** trên nhiều chiều và **nhận diện archetype** (kiểu vai) để chọn cách “bán” hồ sơ phù hợp.

Nói cách khác: AI ở đây là **lớp phân tích + kế hoạch cá nhân hoá** trên dữ liệu bạn cung cấp (`cv.md`, profile, proof points), không phải một thanh đếm từ khóa độc lập.

## Kiến trúc tổng quan

Tài liệu kiến trúc mô tả bốn nhóm luồng chính hội tụ về **output pipeline**, rồi ghi vào **tracker canonical**:

```text
        Claude Code Agent (đọc CLAUDE.md + modes/*.md)
                    │
     ┌──────────────┼──────────────┐
     │              │              │
  Đánh giá      Portal        Batch
  1 offer       scan          song song
     │              │              │
     └──────────────┼──────────────┘
                    ▼
     Report (.md) + PDF + dòng TSV → merge → data/applications.md
```

- **Đơn lẻ:** paste URL hoặc JD → trích nội dung → classify → các block đánh giá → điểm → file report → PDF → thêm tracker.
- **Scan:** đọc cấu hình portal (`portals.yml`), tìm URL mới, đưa vào inbox pipeline.
- **Batch:** nhiều worker CLI song song (`claude -p`), mỗi worker một prompt đóng gói, có state/resume.

Phần **dashboard TUI** (Go) là lớp xem/filter trên cùng dữ liệu tracker, không thay thế logic đánh giá.

## Luồng một offer (góc hệ thống)

Theo `docs/ARCHITECTURE.md`, luồng điển hình gồm: **input** (URL/JD) → **extract** (Playwright/Web) → **classify archetype** → **evaluate** theo các block (tóm tắt vai, khớp CV, chiến lược level, comp, kế hoạch chỉnh CV, interview prep, v.v.) → **chấm điểm** → **report** trong `reports/` → **PDF** qua HTML template + engine render → **ghi TSV** vào thư mục batch để **merge** vào tracker.

Như vậy “AI” nằm ở bước **evaluate** và các bước ngôn ngữ tự nhiên; **tính nhất quán file** và **tên file** do convention + script đảm bảo.

## Data contract: System layer vs User layer

Một quyết định kiến trúc quan trọng là **tách file hệ thống** (có thể cập nhật từ upstream, thay thế an toàn) khỏi **file dữ liệu cá nhân** (không được auto-sửa/xóa khi update).

- **User layer:** `cv.md`, `config/profile.yml`, `modes/_profile.md`, `data/applications.md`, `data/pipeline.md`, `reports/`, v.v. — workspace “của bạn”.
- **System layer:** `modes/_shared.md`, các mode cụ thể, script `*.mjs`, `templates/`, `CLAUDE.md`, v.v.

Quy tắc: update tooling **không** được đụng vào user layer. Điều này cho phép **kéo code mới** mà không làm mất tracker hay CV.

## Batch và song song

Batch runner nhận input dạng bảng (id, url, …), khởi chạy **N worker** headless, mỗi worker chạy prompt tự chứa ngữ cảnh; output vẫn đi vào **merge-tracker** và **verify**. Phần này là **scale** của cùng một “bộ não” đánh giá, có **state machine** (pending/processing/done) để resume — hữu ích khi bạn có nhiều URL cần xử lý trong một phiên.

## Ranh giới đạo đức và vận hành

Tài liệu dự án nhấn mạnh: **không tự động submit đơn**, tránh spam ứng viên/recruiter, và phần tối ưu CV/PDF cần **bám sự thật** (rephrase có chứng cứ, không bịa metric). Đó là **policy** gắn với thiết kế agentic: automation mạnh ở **phân tích và chuẩn bị**, yếu ở **hành động bên ngoài repo**.

## Kết luận

Career-Ops là case study hay cho **ứng dụng agentic trên repo có cấu trúc**: instructions dài hạn trong `modes`, orchestration bằng script, dữ liệu tách lớp để update an toàn, và AI đóng vai trò **lớp suy luận + cá nhân hoá** thay vì chỉ lọc keyword. Nếu bạn đang thiết kế plugin/workflow tương tự, ba câu hỏi đáng mang về là: **agent đọc gì làm nguồn sự thật**, **output cố định ở định dạng nào**, và **ranh giới nào không được vượt khi tự động hoá**.
