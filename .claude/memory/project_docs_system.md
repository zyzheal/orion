---
name: 设计文档体系
description: 170+ 设计文档组织方式、INDEX.md 索引、文档目录结构
type: project
---

# 设计文档体系

## 文档索引

- **INDEX.md** — 主文档索引 (44 模块, 251 特性)
- **Orion-完整设计方案.md** — 完整设计方案主文档
- **API-QUICK-REFERENCE.md** — API 端点快速参考
- **CHANGELOG.md** — 变更日志
- **docs/** — 按领域组织的设计文档
  - `docs/architecture/` — 架构设计 (40 文件)
  - `docs/adr/` — 架构决策记录 (13 文件)
  - `docs/review/full-review-2026-04-23.md` — 最新全系统审查

## 进度日志

- **claude-progress.txt** — Claude 工作进度日志 (1900+ 行)

## 其他重要文件

- **feature_list.json** — 特性列表
- **requirements/** — 需求文档
- **scripts/** — 脚本
- **templates/** — 模板
- **reports/** — 报告

**How to apply:** 查阅架构或需求时先看 INDEX.md，再看 docs/architecture/ 和 docs/adr/。新增设计文档按领域放入 docs/ 子目录。
