# Blueprint TS→Go 迁移追踪

> 启动日期: 2026-07-24 | 分支: main | 版本: v2.0 (校准后)
> **说明**: 所有 TS 文件数为源文件数（不含 `dist/` 编译产物）

## 总体进度

| Wave | 任务 | 状态 | 完成时间 |
|------|------|------|---------|
| Wave 1 | 5 个 TS 归档 (Agent-4) | ✅ 已完成 | 2026-07-24 |
| Wave 1 | Pipeline 差距分析 (Agent-1) | ✅ 已完成 | 2026-07-24 |
| Wave 1 | 4 个新 Go 服务脚手架 (Agent-6) | ✅ 已完成 | 2026-07-24 |

## Wave 1 成果

### ✅ Agent-4: 5 个 TS 服务归档（Go 已完整覆盖）

| 归档 TS 服务 | Go 替代服务 | TS 源文件 | Go 文件 | 覆盖域 |
|-------------|-----------|----------|--------|--------|
| orion-notify-svc | orion-notification-svc-go | 21 | 108 | 8 子域, 功能完整 |
| orion-ticket-svc | orion-ticket-svc-go | 35 | 98 | 8 子域, 功能完整 |
| orion-finops-svc | orion-finops-svc-go | 25 | 71 | 8 子域, 功能完整 |
| orion-governance-svc | orion-governance-svc-go | 17 | 68 | 9 子域, 功能完整 |
| orion-config-mgmt-svc | orion-config-mgmt-svc-go | 9 | 67 | 8 子域, 功能完整 |

### ✅ Agent-1: Pipeline 差距分析（校准后）

- 差距分析文档: `blueprints/MIGRATION/pipeline-gap-analysis.md`
- **校准后**: Pipeline TS 源文件 117（非 351，原统计含 dist/）
- 30 个 TS 功能域待迁移到 Go
- 分 3 个 Phase，预计 6 天

### ✅ Agent-6: 4 个新 Go 服务脚手架

| 新 Go 服务 | TS 源 | Go 文件数 | 子域数 | Repository 实现 |
|-----------|-------|----------|--------|----------------|
| orion-chatops-svc-go | 81 TS | 8 | 5 | 🟡 stub（待 Wave 2 补全） |
| orion-code-svc-go | 52 TS | 10 | 3 | 🟡 stub（待 Wave 2 补全） |
| orion-audit-svc-go | 15 TS | 8 | 3 | 🟡 stub（待 Wave 2 补全） |
| orion-agent-svc-go | 33 TS | 12 | 6 | 🟡 stub（待 Wave 2 补全） |

## 待启动

### 🟡 Wave 2 — 双实现补全 + 新建 Go 服务

| # | 服务 | TS 源文件 | Go 文件 | 差距 | 状态 | 优先级 |
|---|------|----------|---------|------|------|--------|
| 1 | orion-pipeline-svc | 117 | 115 (ci-cd) | 30 域缺失 | 🔴 未开始 | P0 |
| 2 | orion-monitor-svc | 39 | 20 | 19 域缺失 | 🔴 未开始 | P0 |
| 3 | orion-ai-svc | 76 | 56 | 20 域缺失 | 🔴 未开始 | P1 |
| 4 | orion-security-svc | 43 | 62 | 功能对等 | 🟡 待归档 | P1 |
| 5 | orion-chatops-svc-go | 81 | 8 | 新建 stub→完整 | 🟡 待补全 | P1 |
| 6 | orion-code-svc-go | 52 | 10 | 新建 stub→完整 | 🟡 待补全 | P1 |
| 7 | orion-audit-svc-go | 15 | 8 | 新建 stub→完整 | 🟡 待补全 | P1 |
| 8 | orion-agent-svc-go | 33 | 12 | 新建 stub→完整 | 🟡 待补全 | P1 |
| 9 | orion-community-svc | 17 | 10 | 2 路由 vs 14 路由 | 🔴 未开始 | P2 |
| 10 | orion-visor-svc | 11 | 10 | 3 路由 vs 13 路由 | 🔴 未开始 | P2 |
| 11 | orion-pandawiki-svc | 10 | 10 | 0 路由 vs 待确认 | 🔴 未开始 | P2 |
| 12 | orion-risk-svc | 10 | 0 | 新建 Go | 🔴 未开始 | P2 |
| 13 | orion-deploy-svc | 27 | 0 | 新建 Go | 🔴 未开始 | P2 |
| 14 | orion-plugin-svc | 27 | 0 | 新建 Go | 🔴 未开始 | P2 |
| 15 | orion-dr-svc | 24 | 0 | 新建 Go | 🔴 未开始 | P2 |
| 16 | orion-artifact-svc | 24 | 0 | 新建 Go | 🔴 未开始 | P2 |
| 17 | orion-digital-twin-svc | 8 | 0 | 新建 Go | 🔴 未开始 | P2 |
| 18 | orion-federation-svc | 22 | 0 | 新建 Go | 🔴 未开始 | P2 |
| 19 | orion-efficiency-svc | 22 | 0 | 新建 Go | 🔴 未开始 | P2 |
| 20 | orion-approval-svc | 20 | 0 | 新建 Go | 🔴 未开始 | P2 |
| 21 | orion-dba-svc | 11 | 0 | 新建 Go | 🔴 未开始 | P2 |
| 22 | orion-knowledge-svc | 15 | 0 | 新建 Go | 🔴 未开始 | P2 |

### 🔴 Wave 3 — 小服务

| # | 服务 | TS 源文件 | 状态 |
|---|------|----------|------|
| 1 | orion-skill-svc | 11 | 🔴 未开始 |
| 2 | orion-graph-svc | 10 | 🔴 未开始 |
| 3 | orion-inception-svc | 9 | 🔴 未开始 |
| 4 | orion-runner-svc | 9 | 🔴 未开始 |
| 5 | orion-cmdb-svc | 8 | 🔴 未开始 |
| 6 | orion-selfhealing-svc | 7 | 🔴 未开始 |
| 7 | orion-platform-core | 23 | 🔴 未开始 |

### ⚪ 跳过

| 服务 | 类型 | 说明 |
|------|------|------|
| orion-db | 基础设施 | SQL schema + Docker Compose，非微服务 |
| orion-llm-svc | Python | AI 推理，保留 |
| orion-llm-trace-svc-py | Python | LLM 追踪，保留 |
| orion-knowledge-svc-py | Python | 知识库 Python 版，保留 |
| orion-security-svc-rust | Rust | 安全，保留 |

## 状态说明

```
🟢 已完成 (TS 已归档，Go 功能完整覆盖)
🟡 进行中 (Go 脚手架已创建，需补全实现)
🔴 未开始 (待启动)
⚪ 跳过 (基础设施或独立技术栈)
```

## 依赖关系

```
Wave 1 (已完成)
├── Agent-4: 5 个 TS 归档 → 无依赖
├── Agent-1: Pipeline 差距分析 → 无依赖
└── Agent-6: 4 个 Go 脚手架 → 无依赖

Wave 2 (待启动)
├── Agent-2: Monitor TS→Go → 依赖 Agent-1 的 pipeline 模式
├── Agent-3: AI TS→Go → 依赖 Agent-1 的 pipeline 模式
├── Agent-1 续: Pipeline Phase 1 → 依赖差距分析完成
├── Agent-7: 12 个纯 TS 新建 Go → 依赖 Agent-6 的脚手架模板
└── Agent-8: 4 个新建 Go 补全实现 → 依赖脚手架完成

Wave 3 (待启动)
├── Agent-1 续: Pipeline Phase 2+3
├── Agent-9: 7 个小服务
└── 全量 TS 归档
```
