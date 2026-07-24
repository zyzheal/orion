# Agent 迁移任务执行入口

> 启动前必读 | 版本: v2.0 | 2026-07-24

## 1. 读取顺序

```
① blueprints/MIGRATION/TRACKER.md          ← 当前任务 + 进度（5 秒）
② reports/orion-architecture-reference-2026-07-22.md §11-12  ← 模板 + 步骤（10 秒）
③ reports/orion-problem-analysis-2026-07-22.md §6  ← 背景 + 验收（5 秒）
```

## 2. 你的任务

在 `TRACKER.md` 中找到你的 `AGENT_ID` 所在的任务卡，格式如下：

```
AGENT_ID:      Agent-{N}
TASK:          {任务描述}
TYPE:          [archive | new | supplement]
TS_SOURCE:     {TS 源路径}
GO_TARGET:     {Go 目标路径}
DAYS:          {预计天数}
DEPENDS_ON:    {依赖 Agent}
STATUS:        🔴 未开始 / 🟡 进行中 / 🟢 已完成
```

## 3. 执行步骤

```
Step 1: 读 TS 源 → 提取路由清单
Step 2: 创建 Go 4 层架构
Step 3: 实现 models → repository → service → handler
Step 4: go build 验证
Step 5: 更新 TRACKER.md
```

## 4. 完成标记

完成任务后，将 TRACKER.md 中对应服务的状态从 `🔴 未开始` 改为 `🟢 已完成`，并更新完成时间。

## 5. 参考模板

```
模板位置: reports/orion-architecture-reference-2026-07-22.md §11.3
验证清单: reports/orion-architecture-reference-2026-07-22.md §12.3
NeatLogic 参考: reports/neatlogic-benchmark-analysis-2026-07-22.md §13.1
```
