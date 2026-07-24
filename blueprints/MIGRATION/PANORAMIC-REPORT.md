# TS→Go 迁移全景统计报告

> 生成日期: 2026-07-24 | 基准目录: `/Users/heal/orion-design/blueprints/`
> **用途**: 完整清点所有 TS 源服务与 Go 目标服务，发现 TRACKER 遗漏项，给出并行开发分组

---

## 1. TS 源服务完整清单

扫描 `blueprints/orion-*-svc` 共 **36 个目录**。

| # | TS 服务 | TS 源文件数 | 实际语言 | 主要业务域 | 说明 |
|---|---------|-----------|---------|-----------|------|
| 1 | orion-pipeline-svc | **117** | TS | Pipeline 编排、Stage/Task 执行、SSE 日志、触发器 | 最大 TS 服务 |
| 2 | orion-ai-svc | **76** | TS | RAG 检索、Agent 执行、模型管理、成本追踪、对话 | 第二大 TS |
| 3 | orion-chatops-svc | **81** | TS | 聊天机器人、命令执行、上下文管理 | 第三大 TS |
| 4 | orion-code-svc | **52** | TS | 代码仓库管理、构建配置、Webhook | |
| 5 | orion-security-svc | **43** | TS | 安全扫描、合规检查、风险评估 | 已归档，Go 62 文件覆盖 |
| 6 | orion-monitor-svc | **39** | TS | 告警规则、监控指标、事件、通知、仪表盘 | 已补全，Go 49 文件 |
| 7 | orion-agent-svc | **33** | TS | AI Agent 编排、沙箱、任务管理 | |
| 8 | orion-ticket-svc | **35** | TS | 工单流转、审批、SLA、关联管理 | 已归档，Go 98 文件覆盖 |
| 9 | orion-deploy-svc | **26** | TS | 部署策略、发布、回滚、蓝绿部署 | |
| 10 | orion-ai-svc | **76** | TS | — | (合并同上) |
| 11 | orion-dr-svc | **24** | TS | 灾备、容灾演练、RTO/RPO | |
| 12 | orion-notify-svc | **21** | TS | 多渠道通知、模板、订阅 | 已归档，Go 108 文件覆盖 |
| 13 | orion-federation-svc | **22** | TS | 多集群联邦、跨集群编排 | |
| 14 | orion-efficiency-svc | **22** | TS | 研发效能度量、团队指标 | |
| 15 | orion-approval-svc | **20** | TS | 审批流、审批人、审批模板 | |
| 16 | orion-finops-svc | **25** | TS | 成本分析、资源计费、预算告警 | 已归档，Go 71 文件覆盖 |
| 17 | orion-artifact-svc | **24** | TS | 制品管理、版本溯源、制品仓库 | |
| 18 | orion-community-svc | **17** | TS | 社区、共享组件、跨租户协作 | |
| 19 | orion-governance-svc | **17** | TS | 治理规则、合规策略、审计跟踪 | 已归档，Go 68 文件覆盖 |
| 20 | orion-knowledge-svc | **15** | TS | 知识库管理、文档、标签 | |
| 21 | orion-audit-svc | **15** | TS | 审计日志、操作追踪 | |
| 22 | orion-visor-svc | **11** | TS | 运维可视化、拓扑图、资源视图 | |
| 23 | orion-platform-core | **23** | TS | 核心平台服务（单独目录） | Wave 3 |
| 24 | orion-dba-svc | **11** | TS | 数据库管理、连接池、SQL 审计 | |
| 25 | orion-skill-svc | **11** | TS | 技能管理、插件元数据 | |
| 26 | orion-pandawiki-svc | **10** | TS | Wiki 文档、页面管理 | |
| 27 | orion-graph-svc | **10** | TS | 知识图谱、节点关系 | |
| 28 | orion-risk-svc | **10** | TS | 风险识别、评级、处置 | |
| 29 | orion-inception-svc | **9** | TS | 项目初始化、模板、脚手架 | |
| 30 | orion-runner-svc | **9** | TS | 任务执行器、Agent 运行时 | |
| 31 | orion-cmdb-svc | **8** | TS | CMDB 配置管理、资产模型 | |
| 32 | orion-selfhealing-svc | **7** | TS | 自愈策略、规则引擎 | |
| 33 | orion-digital-twin-svc | **8** | TS | 数字孪生、虚实映射 | |
| 34 | orion-config-mgmt-svc | **9** | TS | 配置管理、版本、环境 | 已归档，Go 67 文件覆盖 |
| — | orion-auth-svc | **0** | **Go (31)** | SSO、JWT、LDAP、OIDC、WeChat | 命名混淆，实为 Go 服务 |
| — | orion-user-svc | **0** | **Go (9)** | 用户管理、RBAC、角色 | 命名混淆，实为 Go 服务 |
| — | orion-llm-svc | **0** | **Python (15)** | LLM 追踪、推理 | 保留，不迁移 |
| — | orion-platform-core | **23** | TS | — | (见 #23) |

**小结**: 33 个 TS 服务共 **~770 个源文件**，其中 5 个已归档（300 TS → Go 已完成），剩余 ~28 个待迁移。

---

## 2. Go 目标服务完整清单

扫描 `blueprints/orion-*-svc-go` 共 **35 个目录**，加上 3 个特殊命名的 Go 服务。

### 2.1 完成度评级标准

| 等级 | 标识 | 定义 |
|------|------|------|
| 🟢 完整 | Complete | 有 main.go + handlers + services + 业务逻辑，功能对等或超越 TS |
| 🟡 部分 | Partial | 有 main.go + handlers，但 repo 为 stub（返回空/占位） |
| ⚪ 空壳 | Shell | 仅有 config.go + response_writer.go，无 main.go，无 handler |

### 2.2 Go 服务清单（按完成度排序）

| # | Go 服务 | Go 文件数 | main.go | migrations | 完成度 | 有 TS 对应 | 业务域数 |
|---|---------|----------|---------|-----------|--------|-----------|---------|
| 1 | orion-notification-svc-go | 108 | ✅ | ✅ | 🟢 完整 | orion-notify-svc (21 TS) | 8 |
| 2 | orion-ci-cd-svc-go | 122 | ✅ | ✅ | 🟢 完整 | orion-pipeline-svc (117 TS) | 20+ |
| 3 | orion-ticket-svc-go | 98 | ✅ | ✅ | 🟢 完整 | orion-ticket-svc (35 TS) | 8 |
| 4 | orion-workflow-svc-go | 102 | ✅ | ✅ | 🟢 完整 | **无 TS** (Go-only) | — |
| 5 | orion-infra-ops-svc-go | 97 | ✅ | ✅ | 🟢 完整 | **无 TS** (Go-only) | — |
| 6 | orion-ai-svc-go | 95 | ✅ | ✅ | 🟢 完整 | orion-ai-svc (76 TS) | 14 |
| 7 | orion-event-bus-svc-go | 46 | ✅ | ✅ | 🟢 完整 | **无 TS** (Go-only) | — |
| 8 | orion-identity-svc-go | 72 | ✅ | ✅ | 🟢 完整 | **无 TS** (Go-only) | — |
| 9 | orion-finops-svc-go | 71 | ✅ | ✅ | 🟢 完整 | orion-finops-svc (25 TS) | 8 |
| 10 | orion-governance-svc-go | 68 | ✅ | ✅ | 🟢 完整 | orion-governance-svc (17 TS) | 9 |
| 11 | orion-config-mgmt-svc-go | 67 | ✅ | ✅ | 🟢 完整 | orion-config-mgmt-svc (9 TS) | 8 |
| 12 | orion-security-svc-go | 62 | ✅ | ✅ | 🟢 完整 | orion-security-svc (43 TS) | — |
| 13 | orion-monitor-svc-go | 49 | ✅ | ✅ | 🟢 完整 | orion-monitor-svc (39 TS) | 9 |
| 14 | orion-auth-svc (特殊命名) | 31 | ✅ | ✅ | 🟢 完整 | **无 TS** (Go-only) | SSO/JWT/LDAP/OIDC |
| 15 | orion-cmdb-service (特殊命名) | 29 | ✅ | ✅ | 🟢 完整 | orion-cmdb-svc (8 TS) | — |
| 16 | orion-api-gateway-go | 10 | ✅ | ✅ | 🟢 完整 | **无 TS** (Go-only) | API 网关 |
| 17 | orion-agent-svc-go | 12 | ✅ | ✅ | 🟡 部分 | orion-agent-svc (33 TS) | 6 |
| 18 | orion-community-svc-go | 11 | ✅ | ✅ | 🟡 部分 | orion-community-svc (17 TS) | — |
| 19 | orion-visor-svc-go | 11 | ✅ | ✅ | 🟡 部分 | orion-visor-svc (11 TS) | — |
| 20 | orion-pandawiki-svc-go | 11 | ✅ | ✅ | 🟡 部分 | orion-pandawiki-svc (10 TS) | — |
| 21 | orion-lowcode-svc-go | 11 | ✅ | ✅ | 🟡 部分 | **无 TS** (Go-only) | — |
| 22 | orion-inspection-svc-go | 10 | ✅ | ✅ | 🟡 部分 | **无 TS** (Go-only) | — |
| 23 | orion-tool-svc-go | 9 | ✅ | ✅ | 🟡 部分 | **无 TS** (Go-only) | — |
| 24 | orion-skill-config-svc-go | 11 | ✅ | ✅ | 🟡 部分 | **无 TS** (Go-only) | — |
| 25 | orion-code-svc-go | 10 | ✅ | ✅ | 🟡 部分 | orion-code-svc (52 TS) | 3 |
| 26 | orion-audit-svc-go | 8 | ✅ | ✅ | 🟡 部分 | orion-audit-svc (15 TS) | 3 |
| 27 | orion-chatops-svc-go | 8 | ✅ | ✅ | 🟡 部分 | orion-chatops-svc (81 TS) | 5 |
| 28 | orion-alert-breaker-svc-go | 7 | ✅ | ✅ | 🟡 部分 | **无 TS** (Go-only) | — |
| 29 | orion-user-svc (特殊命名) | 9 | ✅ | ✅ | 🟡 部分 | **无 TS** (Go-only) | 用户/RBAC |
| 30 | orion-approval-svc-go | 2 | ❌ | ✅ | ⚪ 空壳 | orion-approval-svc (20 TS) | — |
| 31 | orion-artifact-svc-go | 2 | ❌ | ✅ | ⚪ 空壳 | orion-artifact-svc (24 TS) | — |
| 32 | orion-dba-svc-go | 2 | ❌ | ✅ | ⚪ 空壳 | orion-dba-svc (11 TS) | — |
| 33 | orion-deploy-svc-go | 2 | ❌ | ✅ | ⚪ 空壳 | orion-deploy-svc (26 TS) | — |
| 34 | orion-digital-twin-svc-go | 2 | ❌ | ✅ | ⚪ 空壳 | orion-digital-twin-svc (8 TS) | — |
| 35 | orion-dr-svc-go | 2 | ❌ | ✅ | ⚪ 空壳 | orion-dr-svc (24 TS) | — |
| 36 | orion-efficiency-svc-go | 2 | ❌ | ✅ | ⚪ 空壳 | orion-efficiency-svc (22 TS) | — |
| 37 | orion-federation-svc-go | 2 | ❌ | ✅ | ⚪ 空壳 | orion-federation-svc (22 TS) | — |
| 38 | orion-knowledge-svc-go | 2 | ❌ | ✅ | ⚪ 空壳 | orion-knowledge-svc (15 TS) | — |
| 39 | orion-plugin-svc-go | 2 | ❌ | ✅ | ⚪ 空壳 | orion-plugin-svc (27 TS) | — |
| 40 | orion-risk-svc-go | 2 | ❌ | ✅ | ⚪ 空壳 | orion-risk-svc (10 TS) | — |

**Go 服务汇总**: 35 个 `-svc-go` + 3 个特殊命名 = **38 个 Go 服务**，总计 **~1,034 个 Go 文件**。

---

## 3. TS → Go 交叉映射

### 3.1 映射关系总表

| TS 源 | TS 文件 | Go 目标 | Go 文件 | Go/TS 比率 | 状态 | 说明 |
|-------|--------|---------|--------|-----------|------|------|
| orion-pipeline-svc | 117 | orion-ci-cd-svc-go | 122 | **1.04×** | 🟢 已覆盖 | 命名不同：pipeline → ci-cd |
| orion-ai-svc | 76 | orion-ai-svc-go | 95 | **1.25×** | 🟢 已覆盖 | |
| orion-chatops-svc | 81 | orion-chatops-svc-go | 8 | **0.10×** | 🟡 stub→完整 | 差距最大，81→8 |
| orion-code-svc | 52 | orion-code-svc-go | 10 | **0.19×** | 🟡 stub→完整 | |
| orion-security-svc | 43 | orion-security-svc-go | 62 | **1.44×** | 🟢 已归档 | |
| orion-monitor-svc | 39 | orion-monitor-svc-go | 49 | **1.26×** | 🟢 已补全 | |
| orion-agent-svc | 33 | orion-agent-svc-go | 12 | **0.36×** | 🟡 stub→完整 | |
| orion-ticket-svc | 35 | orion-ticket-svc-go | 98 | **2.80×** | 🟢 已归档 | Go 更丰富 |
| orion-deploy-svc | 26 | orion-deploy-svc-go | 2 | **0.08×** | ⚪ 空壳 | |
| orion-dr-svc | 24 | orion-dr-svc-go | 2 | **0.08×** | ⚪ 空壳 | |
| orion-notify-svc | 21 | orion-notification-svc-go | 108 | **5.14×** | 🟢 已归档 | Go 大幅超越 |
| orion-federation-svc | 22 | orion-federation-svc-go | 2 | **0.09×** | ⚪ 空壳 | |
| orion-efficiency-svc | 22 | orion-efficiency-svc-go | 2 | **0.09×** | ⚪ 空壳 | |
| orion-approval-svc | 20 | orion-approval-svc-go | 2 | **0.10×** | ⚪ 空壳 | |
| orion-finops-svc | 25 | orion-finops-svc-go | 71 | **2.84×** | 🟢 已归档 | |
| orion-artifact-svc | 24 | orion-artifact-svc-go | 2 | **0.08×** | ⚪ 空壳 | |
| orion-digital-twin-svc | 8 | orion-digital-twin-svc-go | 2 | **0.25×** | ⚪ 空壳 | |
| orion-community-svc | 17 | orion-community-svc-go | 11 | **0.65×** | 🟡 部分 | |
| orion-governance-svc | 17 | orion-governance-svc-go | 68 | **4.00×** | 🟢 已归档 | |
| orion-knowledge-svc | 15 | orion-knowledge-svc-go | 2 | **0.13×** | ⚪ 空壳 | |
| orion-audit-svc | 15 | orion-audit-svc-go | 8 | **0.53×** | 🟡 stub→完整 | |
| orion-visor-svc | 11 | orion-visor-svc-go | 11 | **1.00×** | 🟡 部分 | 等量 |
| orion-platform-core | 23 | — | — | — | 🔴 待新建 | |
| orion-dba-svc | 11 | orion-dba-svc-go | 2 | **0.18×** | ⚪ 空壳 | |
| orion-skill-svc | 11 | orion-skill-config-svc-go | 11 | **1.00×** | 🟡 部分 | 注意命名: skill→skill-config |
| orion-pandawiki-svc | 10 | orion-pandawiki-svc-go | 11 | **1.10×** | 🟡 部分 | |
| orion-graph-svc | 10 | — | — | — | 🔴 待新建 | |
| orion-risk-svc | 10 | orion-risk-svc-go | 2 | **0.20×** | ⚪ 空壳 | |
| orion-inception-svc | 9 | — | — | — | 🔴 待新建 | |
| orion-runner-svc | 9 | — | — | — | 🔴 待新建 | |
| orion-cmdb-svc | 8 | orion-cmdb-service | 29 | **3.63×** | 🟢 已覆盖 | 特殊命名 |
| orion-selfhealing-svc | 7 | orion-selfhealing-svc-go | — | — | 🔴 待新建 | |

### 3.2 无 TS 对应（纯 Go 原生）

| Go 服务 | Go 文件 | 说明 |
|---------|--------|------|
| orion-ci-cd-svc-go | 122 | 替代 pipeline-svc，命名不同 |
| orion-notification-svc-go | 108 | 替代 notify-svc，命名不同 |
| orion-workflow-svc-go | 102 | 纯 Go 原生，无 TS 对应 |
| orion-infra-ops-svc-go | 97 | 纯 Go 原生 |
| orion-identity-svc-go | 72 | 纯 Go 原生 |
| orion-event-bus-svc-go | 46 | 纯 Go 原生 |
| orion-auth-svc | 31 | 命名混淆（-svc 后缀），实为 Go |
| orion-lowcode-svc-go | 11 | 纯 Go 原生 |
| orion-alert-breaker-svc-go | 7 | 纯 Go 原生 |
| orion-skill-config-svc-go | 11 | 纯 Go 原生 |
| orion-tool-svc-go | 9 | 纯 Go 原生 |
| orion-inspection-svc-go | 10 | 纯 Go 原生 |
| orion-user-svc | 9 | 命名混淆，实为 Go |
| orion-api-gateway-go | 10 | 纯 Go 原生 |

---

## 4. TRACKER 遗漏的服务

TRACKER.md 覆盖了 **~32 个服务**（含 Wave 1-3），以下 **13 个服务完全不在 TRACKER 中**：

### 4.1 命名混淆服务（TRACKER 按 `-svc` 归类为 TS，实为 Go）

| 服务 | 实际语言 | 文件数 | 完成度 | 影响 |
|------|---------|--------|--------|------|
| orion-auth-svc | Go | 31 | 🟢 完整 | TRACKER 误列为 "0 TS 跳过" |
| orion-user-svc | Go | 9 | 🟡 部分 | TRACKER 误列为 "0 TS 跳过" |

### 4.2 纯 Go 原生服务（从未列入 TRACKER）

| 服务 | Go 文件数 | 完成度 | 说明 |
|------|----------|--------|------|
| orion-workflow-svc-go | **102** | 🟢 完整 | 最大遗漏，业务量巨大 |
| orion-infra-ops-svc-go | **97** | 🟢 完整 | 第二遗漏 |
| orion-identity-svc-go | **72** | 🟢 完整 | 身份认证核心 |
| orion-event-bus-svc-go | **46** | 🟢 完整 | 事件总线基础设施 |
| orion-cmdb-service | **29** | 🟢 完整 | 特殊命名，CMDB 已部署 |
| orion-api-gateway-go | **10** | 🟢 完整 | 网关 |
| orion-lowcode-svc-go | **11** | 🟡 部分 | |
| orion-alert-breaker-svc-go | **7** | 🟡 部分 | |
| orion-skill-config-svc-go | **11** | 🟡 部分 | |
| orion-tool-svc-go | **9** | 🟡 部分 | |
| orion-inspection-svc-go | **10** | 🟡 部分 | |

### 4.3 遗漏影响分析

| 指标 | 值 | 说明 |
|------|-----|------|
| 遗漏 Go 文件总数 | **~424** | 占总 Go 文件的 **~41%** |
| 遗漏服务数 | **13 个** | 占总 Go 服务数的 **~34%** |
| 其中已完成(🟢) | **6 个** | workflow/infra-ops/identity/event-bus/cmdb/gateway |
| 其中待补全(🟡) | **5 个** | lowcode/alert-breaker/skill-config/tool/inspection |
| 最大遗漏 | orion-workflow-svc-go (102 Go) | 比 TRACKER 最大项 pipeline (117 TS) 还大 |

**结论**: TRACKER.md 严重低估了 Go 侧的工作量，遗漏了 41% 的 Go 文件（主要是纯 Go 原生服务）。

---

## 5. 剩余工作统计

### 5.1 按完成度分类

| 完成度 | 服务数 | 待办工作 |
|--------|--------|---------|
| 🟢 完整（Go ≥ TS 功能） | 15 | 仅需归档 TS，无代码工作 |
| 🟡 部分（有 stub/main） | 13 | 需补全 repository + handler 实现 |
| ⚪ 空壳（仅 config） | 11 | 需从零构建业务逻辑 |
| 🔴 待新建（无 Go） | 7 | 需新建 Go 服务 |

### 5.2 待新建 Go 服务（7 个）

| TS 源 | TS 文件 | 新建 Go | 优先级 |
|-------|--------|---------|--------|
| orion-skill-svc | 11 | orion-skill-svc-go | P3 |
| orion-graph-svc | 10 | orion-graph-svc-go | P3 |
| orion-inception-svc | 9 | orion-inception-svc-go | P3 |
| orion-runner-svc | 9 | orion-runner-svc-go | P3 |
| orion-cmdb-svc | 8 | orion-cmdb-svc-go | 已有 orion-cmdb-service (29 Go) |
| orion-selfhealing-svc | 7 | orion-selfhealing-svc-go | P3 |
| orion-platform-core | 23 | orion-platform-core-go | P2 |

注：orion-cmdb-svc 已有 orion-cmdb-service (29 Go, 完整)，无需新建。

---

## 6. 可并行开发分组

### 6.1 依赖关系分析

```
基础设施层 (无依赖)
├── orion-event-bus-svc-go 🟢 — 事件总线，其他服务依赖
├── orion-notification-svc-go 🟢 — 通知通道
└── orion-identity-svc-go 🟢 — 身份认证

业务独立服务 (低耦合，互不依赖)
├── orion-deploy-svc-go ⚪ — 部署 (依赖 CI/CD)
├── orion-dr-svc-go ⚪ — 灾备 (独立)
├── orion-federation-svc-go ⚪ — 联邦 (独立)
├── orion-approval-svc-go ⚪ — 审批 (独立)
├── orion-efficiency-svc-go ⚪ — 效能 (独立)
├── orion-risk-svc-go ⚪ — 风险 (独立)
├── orion-digital-twin-svc-go ⚪ — 数字孪生 (独立)
├── orion-knowledge-svc-go ⚪ — 知识库 (独立)
├── orion-plugin-svc-go ⚪ — 插件 (独立)
├── orion-artifact-svc-go ⚪ — 制品 (依赖 CI/CD)
└── orion-dba-svc-go ⚪ — 数据库 (独立)

中等规模 (有 stub，需补全)
├── orion-chatops-svc-go 🟡 — 81 TS→8 Go (最大差距)
├── orion-code-svc-go 🟡 — 52 TS→10 Go
├── orion-agent-svc-go 🟡 — 33 TS→12 Go
└── orion-audit-svc-go 🟡 — 15 TS→8 Go

小型补全
├── orion-community-svc-go 🟡 — 17→11
├── orion-visor-svc-go 🟡 — 11→11
├── orion-pandawiki-svc-go 🟡 — 10→11
└── orion-notify-svc (已归档，无工作)

纯 Go 待补全
├── orion-lowcode-svc-go 🟡 — 纯 Go
├── orion-alert-breaker-svc-go 🟡 — 纯 Go
├── orion-skill-config-svc-go 🟡 — 纯 Go
├── orion-tool-svc-go 🟡 — 纯 Go
└── orion-inspection-svc-go 🟡 — 纯 Go
```

### 6.2 并行开发批次建议

#### Batch 1: 空壳服务填充（无依赖，可立即并行）

**目标**: 11 个空壳服务从 2 文件填充到完整业务逻辑。每个服务独立，可分配给不同 Agent。

| # | 服务 | TS 参考 | 预估工作量 | 并行分配 |
|---|------|--------|-----------|---------|
| 1 | orion-deploy-svc-go | 26 TS | 2 天 | Agent-A |
| 2 | orion-dr-svc-go | 24 TS | 1.5 天 | Agent-A |
| 3 | orion-federation-svc-go | 22 TS | 1.5 天 | Agent-B |
| 4 | orion-approval-svc-go | 20 TS | 1.5 天 | Agent-B |
| 5 | orion-efficiency-svc-go | 22 TS | 1.5 天 | Agent-C |
| 6 | orion-risk-svc-go | 10 TS | 1 天 | Agent-C |
| 7 | orion-digital-twin-svc-go | 8 TS | 1 天 | Agent-C |
| 8 | orion-knowledge-svc-go | 15 TS | 1.5 天 | Agent-D |
| 9 | orion-plugin-svc-go | 27 TS | 2 天 | Agent-D |
| 10 | orion-artifact-svc-go | 24 TS | 1.5 天 | Agent-D |
| 11 | orion-dba-svc-go | 11 TS | 1 天 | Agent-D |

**Batch 1 预估**: 11 个服务，约 **3 天**（4-5 Agent 并行）

#### Batch 2: Stub→完整 + 纯 Go 补全

**目标**: 13 个已有 stub 的服务补全到完整业务逻辑。依赖 Batch 1 完成共享基础设施模式。

| # | 服务 | TS 参考 | Go 当前 | 差距 | 预估 |
|---|------|--------|--------|------|------|
| 1 | orion-chatops-svc-go | 81 TS | 8 Go | 最大 | 3 天 |
| 2 | orion-code-svc-go | 52 TS | 10 Go | 大 | 2 天 |
| 3 | orion-agent-svc-go | 33 TS | 12 Go | 中 | 1.5 天 |
| 4 | orion-audit-svc-go | 15 TS | 8 Go | 小 | 1 天 |
| 5 | orion-community-svc-go | 17 TS | 11 Go | 小 | 1 天 |
| 6 | orion-visor-svc-go | 11 TS | 11 Go | 极小 | 0.5 天 |
| 7 | orion-pandawiki-svc-go | 10 TS | 11 Go | 极小 | 0.5 天 |
| 8 | orion-lowcode-svc-go | — | 11 Go | 纯 Go | 1 天 |
| 9 | orion-alert-breaker-svc-go | — | 7 Go | 纯 Go | 0.5 天 |
| 10 | orion-skill-config-svc-go | — | 11 Go | 纯 Go | 1 天 |
| 11 | orion-tool-svc-go | — | 9 Go | 纯 Go | 0.5 天 |
| 12 | orion-inspection-svc-go | — | 10 Go | 纯 Go | 1 天 |
| 13 | orion-user-svc | — | 9 Go | 命名混淆 | 0.5 天 |

**Batch 2 预估**: 13 个服务，约 **3 天**（4-5 Agent 并行）

#### Batch 3: 新建 Go 服务 + 收尾

**目标**: 7 个无 Go 对应的新建服务，以及所有 TS 归档。

| # | TS 源 | TS 文件 | 新建 Go | 预估 |
|---|-------|--------|---------|------|
| 1 | orion-platform-core | 23 TS | orion-platform-core-go | 2 天 |
| 2 | orion-skill-svc | 11 TS | orion-skill-svc-go | 1 天 |
| 3 | orion-graph-svc | 10 TS | orion-graph-svc-go | 1 天 |
| 4 | orion-inception-svc | 9 TS | orion-inception-svc-go | 1 天 |
| 5 | orion-runner-svc | 9 TS | orion-runner-svc-go | 1 天 |
| 6 | orion-selfhealing-svc | 7 TS | orion-selfhealing-svc-go | 1 天 |
| 7 | 全量 TS 归档 | — | 标记 ARCHIVED | 1 天 |

**Batch 3 预估**: 7 个服务，约 **2 天**（4 Agent 并行）

### 6.3 总体时间线

| 批次 | 服务数 | 预估时间 | 并行 Agent | 关键依赖 |
|------|--------|---------|-----------|---------|
| Batch 1 | 11 个空壳填充 | 3 天 | 4-5 | 无（立即启动） |
| Batch 2 | 13 个 stub→完整 | 3 天 | 4-5 | 无（可与 Batch 1 部分重叠） |
| Batch 3 | 7 个新建 + 归档 | 2 天 | 4 | Batch 1/2 完成 |
| **合计** | **31 个服务** | **~5-6 天** | 4-5 Agent | — |

### 6.4 并行策略建议

1. **Batch 1 & Batch 2 可部分重叠**: Batch 1 的空壳服务（如 deploy/dr/federation）与 Batch 2 的 stub 服务（如 lowcode/tool/inspection）无共享依赖，可同时进行。
2. **最大并行度**: 5 Agent 同时工作，每人每天完成 1 个中型服务或 2 个小型服务。
3. **Pipeline 单独处理**: orion-pipeline-svc (117 TS → ci-cd 122 Go) 差距分析已完成，需单独分配 1 个 Agent 持续 4-5 天。
4. **先做"大差距"**: chatops (81→8) 和 code (52→10) 差距最大，应优先分配。

---

## 附录: 数据汇总

| 维度 | 数值 |
|------|------|
| TS 服务目录 | 36 个（33 个有源文件，3 个零/混淆） |
| TS 源文件总数 | ~770 个 |
| Go 服务目录 | 38 个（35 个 -svc-go + 3 个特殊） |
| Go 源文件总数 | ~1,034 个 |
| 🟢 完整 Go 服务 | 15 个（~770 Go 文件） |
| 🟡 部分 Go 服务 | 13 个（~101 Go 文件） |
| ⚪ 空壳 Go 服务 | 11 个（22 Go 文件） |
| 🔴 待新建 Go | 6 个（无 Go 文件） |
| TRACKER 遗漏服务 | 13 个（~424 Go 文件，41%） |
| 纯 Go 原生（无 TS） | 14 个（~433 Go 文件） |
| 预估剩余工作量 | ~5-6 天（4-5 Agent 并行） |
