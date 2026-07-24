# Blueprint TS→Go 迁移追踪

> 启动日期: 2026-07-24 | 分支: main | 版本: v1.0

## 总体进度

| Wave | 任务 | 状态 | 完成时间 |
|------|------|------|---------|
| Wave 1 | 5 个 TS 归档 (Agent-4) | ✅ 已完成 | 2026-07-24 |
| Wave 1 | Pipeline 差距分析 (Agent-1) | ✅ 已完成 | 2026-07-24 |
| Wave 1 | 4 个新 Go 服务脚手架 (Agent-6) | ✅ 已完成 | 2026-07-24 |

## Wave 1 成果

### ✅ Agent-4: 5 个 TS 服务归档

| 归档 TS 服务 | Go 替代服务 | 说明 |
|-------------|-----------|------|
| orion-notify-svc (55 TS) | orion-notification-svc-go (108 Go) | 8 个子域，功能完整 |
| orion-ticket-svc (35 TS) | orion-ticket-svc-go (98 Go) | 8 个子域，功能完整 |
| orion-finops-svc (25 TS) | orion-finops-svc-go (71 Go) | 8 个子域，功能完整 |
| orion-governance-svc (17 TS) | orion-governance-svc-go (68 Go) | 9 个子域，功能完整 |
| orion-config-mgmt-svc (9 TS) | orion-config-mgmt-svc-go (67 Go) | 8 个子域，功能完整 |

### ✅ Agent-1: Pipeline 差距分析完成

- 差距分析文档: `blueprints/MIGRATION/pipeline-gap-analysis.md`
- 30 个 TS 功能域待迁移到 Go
- 分 3 个 Phase，预计 6 天

### ✅ Agent-6: 4 个新 Go 服务脚手架

| 新 Go 服务 | TS 源 | Go 文件数 | 子域数 |
|-----------|-------|----------|--------|
| orion-chatops-svc-go | 81 TS | 7 | 5 (chatops, command-router, event-subscriber, notification-pref, execution) |
| orion-code-svc-go | 52 TS | 5 | 3 (code-repo, build, artifact) |
| orion-audit-svc-go | 45 TS | 4 | 3 (audit, compliance, security-compliance) |
| orion-agent-svc-go | 33 TS | 6 | 6 (agent, agent-profile, agent-run, task, orchestration, sandbox) |

## 待启动

### 🟡 Wave 2 (待启动)

| # | 服务 | TS 文件 | Go 文件 | 优先级 | 预计工作量 |
|---|------|---------|---------|--------|-----------|
| 1 | orion-monitor-svc | 105 | 20 | P0 | 4 天 |
| 2 | orion-ai-svc | 76 | 56 | P1 | 3 天 |
| 3 | orion-security-svc | 43 | 62 | P1 | 2 天 |
| 4 | orion-risk-svc | 28 | 0 | P2 | 1 天 |
| 5 | orion-deploy-svc | 27 | 0 | P2 | 1 天 |
| 6 | orion-plugin-svc | 27 | 0 | P2 | 1 天 |
| 7 | orion-dr-svc | 24 | 0 | P2 | 1 天 |
| 8 | orion-artifact-svc | 24 | 0 | P2 | 1 天 |
| 9 | orion-digital-twin-svc | 24 | 0 | P2 | 1 天 |
| 10 | orion-federation-svc | 22 | 0 | P2 | 1 天 |
| 11 | orion-efficiency-svc | 22 | 0 | P2 | 1 天 |
| 12 | orion-approval-svc | 20 | 0 | P2 | 1 天 |

### 🔴 Wave 3 (小服务)

| # | 服务 | TS 文件 | 预计工作量 |
|---|------|---------|-----------|
| 1 | orion-skill-svc | 11 | 0.5 天 |
| 2 | orion-graph-svc | 10 | 0.5 天 |
| 3 | orion-inception-svc | 9 | 0.5 天 |
| 4 | orion-runner-svc | 9 | 0.5 天 |
| 5 | orion-cmdb-svc | 8 | 0.5 天 |
| 6 | orion-selfhealing-svc | 7 | 0.5 天 |

### ⚪ 跳过 (独立技术栈)

| 服务 | 语言 | 说明 |
|------|------|------|
| orion-llm-svc | Python | AI 推理，保留 |
| orion-llm-trace-svc-py | Python | LLM 追踪，保留 |
| orion-knowledge-svc-py | Python | 知识库，保留 |
| orion-security-svc-rust | Rust | 安全，保留 |
