---
description: Tự review bài blog đã viết, đưa critique và suggestion
argument-hint: [path-to-blog-file]
---

# /blog-review Command

User muốn review bài: **$ARGUMENTS**

## Workflow

1. Đọc file blog tại path user cung cấp
2. Load `.claude/skills/blog-writer/CHECKLIST.md`
3. Check từng mục trong checklist với bài thực tế
4. Đưa report dạng:

```
# Review Report: <filename>

## ✅ Đạt
- [Mục checklist pass]

## ⚠️ Cần cải thiện
- [Mục có vấn đề] → Suggestion cụ thể

## ❌ Fail
- [Mục fail] → Phải sửa

## Verdict
[PASS | NEEDS_REVISION | FAIL]

## Top 3 priority fixes
1. ...
2. ...
3. ...
```

5. KHÔNG tự động sửa file. Để user quyết định.
