# Orion 微服务目录说明

> **创建日期**: 2026-07-01
> **用途**: 解释 `orion-*-svc*` 目录的命名约定、权威实现与蓝图区分

---

## 命名约定

| 目录模式 | 语言 | 含义 | 示例 |
|---------|------|------|------|
| `orion-<domain>-service` | Python | **权威生产实现** | `orion-ai-service` |
| `orion-<domain>-svc` | TypeScript | TS 微服务蓝图 | `orion-chatops-svc` |
| `orion-<domain>-svc-go` | Go | Go 微服务蓝图 | `orion-chatops-svc-go` |
| `orion-<domain>-svc-py` | Python | Python 微服务蓝图 | `orion-knowledge-svc-py` |
| `orion-<domain>-svc-rust` | Rust | Rust 微服务蓝图 | `orion-security-svc-rust` |
| `orion-<domain>-svc-go` (已有生产) | Go | **生产 Go 服务** | `orion-cmdb-service` |

> **注意**: `orion-cmdb-service` 是唯一已部署的 Go 微服务，其目录名使用 `-service` 而非 `-svc-go`。

---

## 目录总览（87 个）

### TS 微服务（37 个）

| 目录 | 状态 | 说明 |
|------|------|------|
| `orion-agent-svc` | 蓝图 | Agent 服务 |
| `orion-ai-agents-svc` | 蓝图 | AI Agent 专项（Python） |
| `orion-ai-svc` | 蓝图 | AI 核心（TS 版） |
| `orion-approval-svc` | 蓝图 | 审批服务 |
| `orion-artifact-svc` | 蓝图 | 制品服务 |
| `orion-audit-svc` | 蓝图 | 审计服务 |
| `orion-auth-svc` | 蓝图 | 认证服务 |
| `orion-chatops-svc` | 蓝图 | ChatOps 服务 |
| `orion-code-svc` | 蓝图 | 代码服务 |
| `orion-community-svc` | 蓝图 | 社区服务 |
| `orion-config-mgmt-svc` | 蓝图 | 配置管理 |
| `orion-deploy-svc` | 蓝图 | 部署服务 |
| `orion-digital-twin-svc` | 蓝图 | 数字孪生 |
| `orion-dr-svc` | 蓝图 | 容灾服务 |
| `orion-efficiency-svc` | 蓝图 | 效能分析 |
| `orion-federation-svc` | 蓝图 | 联邦/多租户 |
| `orion-finops-svc` | 蓝图 | FinOps 成本 |
| `orion-governance-svc` | 蓝图 | 治理服务 |
| `orion-graph-svc` | 蓝图 | 图谱服务 |
| `orion-inception-svc` | 蓝图 | Inception |
| `orion-intelligence-svc` | 蓝图 | 智能服务 |
| `orion-knowledge-svc` | 蓝图 | 知识管理 |
| `orion-llm-svc` | 蓝图 | LLM 服务 |
| `orion-monitor-svc` | 蓝图 | 监控服务 |
| `orion-notify-svc` | 蓝图 | 通知服务 |
| `orion-pandawiki-svc` | 蓝图 | PandaWiki |
| `orion-pipeline-svc` | 蓝图 | Pipeline |
| `orion-plugin-svc` | 蓝图 | 插件系统 |
| `orion-risk-svc` | 蓝图 | 风险管理 |
| `orion-runner-svc` | 蓝图 | Runner 服务 |
| `orion-security-svc` | 蓝图 | 安全服务 |
| `orion-selfhealing-svc` | 蓝图 | 自愈服务 |
| `orion-skill-svc` | 蓝图 | Skill 管理 |
| `orion-tenant-svc` | 蓝图 | 租户服务 |
| `orion-ticket-svc` | 蓝图 | 工单服务 |
| `orion-user-svc` | 蓝图 | 用户服务 |
| `orion-visualization-svc` | 蓝图 | 可视化服务 |

### Go 微服务（47 个）

| 目录 | 状态 | 说明 |
|------|------|------|
| `orion-approval-svc-go` | 蓝图 | 审批 |
| `orion-artifact-svc-go` | 蓝图 | 制品 |
| `orion-audit-svc-go` | 蓝图 | 审计 |
| `orion-build-svc-go` | 蓝图 | 构建 |
| `orion-canary-svc-go` | 蓝图 | 灰度/金丝雀 |
| `orion-capacity-svc-go` | 蓝图 | 容量管理 |
| `orion-chatops-svc-go` | 蓝图 | ChatOps |
| `orion-cmdb-svc-go` | **生产** | CMDB（已部署） |
| `orion-code-svc-go` | 蓝图 | 代码管理 |
| `orion-community-svc-go` | 蓝图 | 社区 |
| `orion-config-mgmt-svc-go` | 蓝图 | 配置管理 |
| `orion-cron-svc-go` | 蓝图 | 定时任务 |
| `orion-deploy-svc-go` | 蓝图 | 部署 |
| `orion-digital-twin-svc-go` | 蓝图 | 数字孪生 |
| `orion-dr-svc-go` | 蓝图 | 容灾 |
| `orion-efficiency-svc-go` | 蓝图 | 效能分析 |
| `orion-event-bus-svc-go` | 蓝图 | 事件总线 |
| `orion-feature-flag-svc-go` | 蓝图 | 特性开关 |
| `orion-federation-svc-go` | 蓝图 | 联邦 |
| `orion-finops-svc-go` | 蓝图 | FinOps |
| `orion-governance-svc-go` | 蓝图 | 治理 |
| `orion-graph-svc-go` | 蓝图 | 图谱 |
| `orion-inception-svc-go` | 蓝图 | Inception |
| `orion-inspection-svc-go` | 蓝图 | 检查 |
| `orion-intelligence-svc-go` | 蓝图 | 智能 |
| `orion-knowledge-svc-go` | 蓝图 | 知识管理 |
| `orion-knowledge-svc-py` | 蓝图 | 知识管理（Python） |
| `orion-llm-svc-go` | 蓝图 | LLM |
| `orion-llm-trace-svc-py` | 蓝图 | LLM Trace（Python） |
| `orion-lowcode-svc-go` | 蓝图 | 低代码 |
| `orion-middleware-ops-svc-go` | 蓝图 | 中间件运维 |
| `orion-monitor-svc-go` | 蓝图 | 监控 |
| `orion-notification-svc-go` | 蓝图 | 通知 |
| `orion-notify-svc-go` | 蓝图 | 通知（冗余） |
| `orion-pandawiki-svc-go` | 蓝图 | PandaWiki |
| `orion-pipeline-svc-go` | 蓝图 | Pipeline |
| `orion-pipeline-template-svc-go` | 蓝图 | Pipeline 模板 |
| `orion-plugin-svc-go` | 蓝图 | 插件 |
| `orion-risk-svc-go` | 蓝图 | 风险 |
| `orion-runner-svc-go` | 蓝图 | Runner |
| `orion-scheduler-svc-go` | 蓝图 | 调度器 |
| `orion-secret-svc-go` | 蓝图 | 密钥管理 |
| `orion-security-svc-go` | 蓝图 | 安全 |
| `orion-security-svc-rust` | 蓝图 | 安全（Rust） |
| `orion-selfhealing-svc-go` | 蓝图 | 自愈 |
| `orion-skill-config-svc-go` | 蓝图 | Skill 配置 |
| `orion-skill-svc-go` | 蓝图 | Skill |
| `orion-tenant-svc-go` | 蓝图 | 租户 |
| `orion-ticket-svc-go` | 蓝图 | 工单 |
| `orion-tool-svc-go` | 蓝图 | 工具服务 |
| `orion-user-svc-go` | 蓝图 | 用户 |
| `orion-visor-svc-go` | 蓝图 | Visor（Java 已有生产） |

### 特殊情况

| 目录 | 说明 |
|------|------|
| `orion-ai-service` | Python FastAPI 服务，CLAUDE.md 声明的权威 AI 服务 |
| `orion-ai-svc` | TS Fastify 蓝图，与 `orion-ai-service` 是不同实现 |
| `orion-ai-agents-svc` | Python 蓝图，AI Agent 专项服务 |
| `orion-cmdb-service` | Go 生产服务，唯一已部署的 Go 微服务 |
| `orion-dba` | 插件形式（plugin.yaml）的 SQL 审核平台 |
| `orion-dba-svc` | TS 微服务蓝图，Yearning 包装器 |
| `orion-knowledge-svc-py` | Python 蓝图，知识管理 |
| `orion-llm-trace-svc-py` | Python 蓝图，LLM Trace |
| `orion-security-svc-rust` | Rust 蓝图，安全服务 |
| `orion-visualization-svc` | TS 蓝图，Visor 相关可视化 |

---

## 权威实现 vs 蓝图

```
权威实现（当前生产使用）
├── orion-platform-service/       # 主后端单体（TS + Fastify）
├── orion-frontend/                # 前端（React + Vite）
├── orion-api-gateway/             # API 网关（TS + Fastify）
├── orion-ai-service/              # AI 服务（Python + FastAPI）
├── orion-cmdb-service/            # CMDB 服务（Go）
├── orion-visor/                   # 可视化（Java + Spring）
├── orion-knowledge/               # 知识库（PandaWiki fork）
└── orion-dba/                     # DBA 平台（插件形式）

蓝图（未来微服务拆分准备，当前未独立部署）
├── orion-*-svc/       (37 个 TS 微服务)
├── orion-*-svc-go/    (47 个 Go 微服务)
├── orion-*-svc-py/    (2 个 Python 微服务)
└── orion-*-svc-rust/  (1 个 Rust 微服务)
```

---

## 常见混淆点

| 混淆对 | 区别 |
|--------|------|
| `orion-ai-service` vs `orion-ai-svc` | 前者是 Python 权威服务，后者是 TS 蓝图 |
| `orion-dba` vs `orion-dba-svc` | 前者是插件（plugin.yaml），后者是 TS 服务蓝图 |
| `orion-notify-svc` vs `orion-notification-svc-go` | 前者 TS 通知，后者 Go 通知（功能重叠待合并） |
| `orion-knowledge` vs `orion-knowledge-svc` vs `orion-knowledge-svc-go` | 前者 PandaWiki 权威实现，后两者是蓝图 |
| `orion-visor` vs `orion-visualization-svc` | 前者 Java 生产，后者 TS 蓝图 |

---

## 待清理项

| 目录 | 建议 |
|------|------|
| `orion-notify-svc` + `orion-notification-svc-go` | 功能重叠，保留一个 |
| `orion-ai-svc` 与 `orion-ai-service` | 功能重叠，需确认是否合并到单体 |
| `orion-dba-svc` 与 `orion-dba` | 确认哪个是未来方向 |
