# Plan 11 — AI 模块拆分

> **状态**: 已合并到 [plan-42-ai-module-split/](../plan-42-ai-module-split/)
>
> 本方案的设计内容已由 plan-42 覆盖。

## 本地代码扫描结果

- **本地模块**: `internal/ai/` — 30 子目录, 159 Go 文件, 20% 测试覆盖
- **缺口**: 5 组命名冲突 (agents vs aiagent, aicost vs cost 等)
- **合并方向**: plan-42-ai-module-split/README.md 包含完整的 6 子模块拆分设计

## 详细设计

参见 [plan-42-ai-module-split/README.md](../plan-42-ai-module-split/README.md) (152 行)
