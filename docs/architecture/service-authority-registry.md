# Service Authority Registry

**文档版本**: v1.0
**创建日期**: 2026-06-07
**状态**: 实施中
**维护者**: Orion Architecture Team

---

## 概述

本文档定义每个 Orion 微服务的**权威实现**（Authoritative Implementation）。当存在双版本实现时，权威版本是唯一接受修改的版本，非权威版本将被冻结或废弃。

**判定规则**:
1. Go 行数 > Node.js 行数 × 1.5 → Go 权威
2. Go 与 Node.js 行数差距 < 50% → Go 统一（Go 为新开发方向）
3. Node.js 行数 > Go 行数 × 3 → Go 需补充后切换
4. API Gateway 路由指向 → 影响前端调用目标

---

## 权威实现总表

### Wave 1: Go 已为权威（11 服务）

| 服务 | Go 目录 | 端口 | Go 行数 | Node.js 行数 | 权威 | 状态 |
|------|---------|------|---------|-------------|------|------|
| CMDB | orion-cmdb-svc-go | 3030 | 1772 | 974 | **Go** | 构建通过 |
| Runner | orion-runner-svc-go | 3028 | 2171 | 766 | **Go** | 构建通过 |
| Visor | orion-visor-svc-go | 3034 | 2067 | 974 | **Go** | 构建通过 |
| Inception | orion-inception-svc-go | 3031 | 1211 | 799 | **Go** | 构建通过 |
| Config-Mgmt | orion-config-mgmt-svc-go | 3029 | 2551 | 1376 | **Go** | 构建通过 |
| Skill | orion-skill-svc-go | 3023 | 2577 | 1366 | **Go** | 构建通过 |
| Digital-Twin | orion-digital-twin-svc-go | 3008 | 2261 | 1149 | **Go** | 构建通过 |
| Canary | orion-canary-svc-go | 8086 | 2396 | N/A | **Go** | 构建通过 |
| Compliance | orion-compliance-svc-go | 8087 | 375 | N/A | **Go** | 新建 |
| Report-Designer | orion-report-designer-svc-go | 8088 | 350 | N/A | **Go** | 新建 |

### Wave 2: Go 需补充后切换（18 服务）

| 服务 | Go 目录 | 端口 | Go 行数 | Node.js 行数 | 权威 | 状态 |
|------|---------|------|---------|-------------|------|------|
| Pipeline | orion-pipeline-svc-go | 3002 | 3478 | 26197 | Node.js → Go | 构建通过，需补充 |
| Ticket | orion-ticket-svc-go | 3004 | 7321 | 13816 | Node.js → Go | 构建通过 |
| Deploy | orion-deploy-svc-go | 3003 | 1197 | 6732 | Node.js → Go | 构建通过 |
| Code | orion-code-svc-go | 3010 | 1873 | 13379 | Node.js → Go | 构建通过，需补充 |
| Finops | orion-finops-svc-go | 3009 | 2500 | 8383 | Node.js → Go | 构建通过，需补充 |
| Chatops | orion-chatops-svc-go | 3027 | 2853 | 9185 | Node.js → Go | 构建通过，需补充 |
| Security | orion-security-svc-go | 3013 | 1276 | 7759 | Node.js → Go | 构建通过，需补充 |
| Approval | orion-approval-svc-go | 3018 | 1411 | 2890 | Node.js → Go | 构建通过 |
| Artifact | orion-artifact-svc-go | 3014 | 1184 | 3580 | Node.js → Go | 构建通过，需补充 |
| Audit | orion-audit-svc-go | 3026 | - | - | Go | 构建通过 |
| Notify | orion-notify-svc-go | 3019 | 1182 | 1701 | Node.js → Go | 构建通过 |
| Workflow | orion-workflow-svc-go | - | - | - | Go | 构建通过 |
| Build | orion-build-svc-go | - | - | - | Go | 构建通过 |
| Plugin | orion-plugin-svc-go | 3011 | 950 | 4446 | Node.js → Go | 构建通过，需补充 |
| Event-Bus | orion-event-bus-svc-go | - | - | - | Go | 构建通过 |
| Secret | orion-secret-svc-go | - | - | - | Go | 构建通过 |
| SelfHealing | orion-selfhealing-svc-go | 3024 | 1108 | 2313 | Node.js → Go | 构建通过，需补充 |
| LLM | orion-llm-svc-go | - | 1223 | 0 | **Go** | 构建通过 |

### Wave 3: 需新建或大幅补充（5 服务）

| 服务 | Go 目录 | 端口 | 状态 | 说明 |
|------|---------|------|------|------|
| AI | orion-ai-svc-go | 3012 | **需新建** | Node.js 19599 行，Go 无实现 |
| Graph | orion-graph-svc-go | 3021 | 需补充 | Go 294 行，Node.js 739 行 |
| PandaWiki | orion-pandawiki-svc-go | 3020 | 需补充 | Go 297 行，Node.js 845 行 |
| Intelligence | orion-intelligence-svc-go | 3006 | 需补充 | Go 298 行，Node.js 845 行 |
| Tool | orion-tool-svc-go | 3036 | **已完成** | 新建，构建通过 |

### 仅 Node.js（3 服务）

| 服务 | 目录 | 端口 | 说明 |
|------|------|------|------|
| Auth | orion-auth-svc | - | 认证服务，需新建 Go 版本 |
| Tenant | orion-tenant-svc | - | 租户管理，需新建 Go 版本 |
| User | orion-user-svc | - | 用户管理，需新建 Go 版本 |

### 仅 Go（15 服务，无双版本）

| 服务 | Go 目录 | 端口 | 构建状态 |
|------|---------|------|---------|
| Approval | orion-approval-svc-go | 3018 | 通过 |
| Artifact | orion-artifact-svc-go | 3014 | 通过 |
| Audit | orion-audit-svc-go | 3026 | 通过 |
| Build | orion-build-svc-go | - | 通过 |
| Canary | orion-canary-svc-go | 8086 | 通过 |
| Capacity | orion-capacity-svc-go | - | 通过 |
| Community | orion-community-svc-go | 3033 | 通过 |
| Compliance | orion-compliance-svc-go | 8087 | 通过 |
| Cron | orion-cron-svc-go | - | 通过 |
| DR | orion-dr-svc-go | 3016 | 通过 |
| Efficiency | orion-efficiency-svc-go | 3015 | 通过 |
| Event-Bus | orion-event-bus-svc-go | - | 通过 |
| Feature-Flag | orion-feature-flag-svc-go | - | 通过 |
| Federation | orion-federation-svc-go | 3017 | 通过 |
| Governance | orion-governance-svc-go | 3022 | 通过 |
| Incident | orion-incident-svc-go | 8085 | 通过 |
| Knowledge | orion-knowledge-svc-go | 8089 | 通过 |
| Inspection | orion-inspection-svc-go | - | 通过 |
| Middleware-Ops | orion-middleware-ops-svc-go | - | 通过 |
| Monitor | orion-monitor-svc-go | 3005 | 通过 |
| Notification | orion-notification-svc-go | - | 通过 |
| Pipeline-Template | orion-pipeline-template-svc-go | - | 通过 |
| Report-Designer | orion-report-designer-svc-go | 8088 | 通过 |
| Risk | orion-risk-svc-go | 3025 | 通过 |
| Scheduler | orion-scheduler-svc-go | - | 通过 |
| Secret | orion-secret-svc-go | - | 通过 |
| Skill-Config | orion-skill-config-svc-go | - | 通过 |
| Tool | orion-tool-svc-go | 3036 | 通过 |
| Visor | orion-visor-svc-go | 3034 | 通过 |
| Workflow | orion-workflow-svc-go | - | 通过 |

---

## API Gateway 路由映射

| 前端路径前缀 | Gateway 端口 | 服务 | Go 端口 | 权威实现 |
|-------------|-------------|------|---------|---------|
| /api/v1/pipelines | 3002 | pipeline-svc | 3002 | Go (补充中) |
| /api/v1/deployments | 3003 | deploy-svc | 3003 | Go (补充中) |
| /api/v1/tickets | 3004 | ticket-svc | 3004 | Go (补充中) |
| /api/v1/monitoring | 3005 | monitor-svc | 3005 | Go |
| /api/v1/intelligence | 3006 | intelligence-svc | 3006 | Go (补充中) |
| /api/v1/agents | 3007 | agent-svc | 3007 | Node.js |
| /api/v1/digital-twin | 3008 | digital-twin-svc | 3008 | **Go** |
| /api/v1/finops | 3009 | finops-svc | 3009 | Go (补充中) |
| /api/v1/code | 3010 | code-svc | 3010 | Go (补充中) |
| /api/v1/plugins | 3011 | plugin-svc | 3011 | Go (补充中) |
| /api/v1/ai | 3012 | ai-svc | 3012 | 需新建 Go |
| /api/v1/security | 3013 | security-svc | 3013 | Go (补充中) |
| /api/v1/artifacts | 3014 | artifact-svc | 3014 | Go (补充中) |
| /api/v1/efficiency | 3015 | efficiency-svc | 3015 | Go (补充中) |
| /api/v1/dr | 3016 | dr-svc | 3016 | Go |
| /api/v1/federation | 3017 | federation-svc | 3017 | Go |
| /api/v1/approvals | 3018 | approval-svc | 3018 | Go (补充中) |
| /api/v1/notifications | 3019 | notify-svc | 3019 | Go |
| /api/v1/knowledge | 3020 | pandawiki-svc | 3020 | Go (补充中) |
| /api/v1/graph | 3021 | graph-svc | 3021 | Go (补充中) |
| /api/v1/governance | 3022 | governance-svc | 3022 | Go |
| /api/v1/skills | 3023 | skill-svc | 3023 | **Go** |
| /api/v1/selfhealing | 3024 | selfhealing-svc | 3024 | Go (补充中) |
| /api/v1/risk | 3025 | risk-svc | 3025 | Go |
| /api/v1/audit | 3026 | audit-svc | 3026 | Go |
| /api/v1/chatops | 3027 | chatops-svc | 3027 | Go (补充中) |
| /api/v1/runner | 3028 | runner-svc | 3028 | **Go** |
| /api/v1/config-mgmt | 3029 | config-mgmt-svc | 3029 | **Go** |
| /api/v1/cmdb | 3030 | cmdb-svc | 3030 | **Go** |
| /api/v1/inception | 3031 | inception-svc | 3031 | **Go** |
| /api/v1/dba | 3032 | dba-svc | 3032 | Node.js |
| /api/v1/community | 3033 | community-svc | 3033 | Go |
| /api/v1/visor | 3034 | visor-svc | 3034 | **Go** |
| /api/v1/tools | 3036 | tool-svc | 3036 | **Go** |
| /api/v1/canary | 8086 | canary-svc | 8086 | **Go** |
| /api/v1/canary-analysis | 8086 | canary-svc | 8086 | **Go** |
| /api/v1/compliance | 8087 | compliance-svc | 8087 | **Go** |
| /api/v1/compliance-reports | 8087 | compliance-svc | 8087 | **Go** |
| /api/v1/reports | 8088 | report-designer-svc | 8088 | **Go** |
| /api/v1/report-definitions | 8088 | report-designer-svc | 8088 | **Go** |

---

## 切换规则

### 从 Node.js 切换到 Go 的条件

1. Go 服务构建通过 (`go build ./...` 无错误)
2. Go 服务包含对应 Node.js 服务的所有 API 端点
3. Go 服务通过基本功能测试
4. API Gateway 路由更新指向 Go 端口

### 切换步骤

1. 补充 Go 服务缺失功能
2. 运行 `go build ./...` 和 `go vet ./...`
3. 更新 `service-authority-registry.md` 状态为 "Go 权威"
4. 更新 API Gateway 路由配置
5. 冻结 Node.js 服务目录（添加 DEPRECATED.md）

---

## 构建状态汇总

| 状态 | 数量 | 服务 |
|------|------|------|
| 构建通过 | 47 | 全部 Go 服务 (`go build ./...` 无错误) |
| 需新建 | 1 | ai-svc-go (Node.js 19599 行，需从零开始) |
| 需大幅补充 | 4 | graph, pandawiki, intelligence, (ai) — Go 行数 < 300 |
