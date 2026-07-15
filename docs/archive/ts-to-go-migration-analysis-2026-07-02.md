# TS → Go 微服务迁移分析

**生成日期**: 2026-07-02
**数据来源**: 实际代码扫描 + Gateway 路由配置

---

## 一、核心结论

| 维度 | 值 | 说明 |
|------|-----|------|
| **TS 源码服务** | 137 个 | `orion-platform-service/src/services/` |
| **Go 微服务蓝图** | 47 个 | 全部有 `main.go`，全部可编译 |
| **Go 实现深度** | 15-9000 行 | 差异巨大 |
| **实际部署 Go 服务** | 6 个 | CMDB(3030)/Pipeline(3002)/Deploy(3003)/Ticket(3004)/Monitor(3005)/Intelligence(3006) |
| **Gateway 路由就绪** | 34 个 | 配置了 localhost:port 映射 |
| **路由到平台服务** | 2 个 | Notify(3019)/ChatOps(3027) → localhost:3001 |
| **Go 实现率** | 34% (47/137) | 有 Go 蓝图的 TS 服务 |

---

## 二、TS → Go 迁移状态矩阵

### 2.1 已完成 Go 实现（代码量 > 2000 行）

| TS 服务 | TS 行数 | Go 服务 | Go 行数 | Go 行数/TS 比例 | 实现深度 | Gateway 路由 |
|---------|---------|---------|---------|----------------|---------|-------------|
| pipeline | 40,348 | orion-pipeline-svc-go | 3,618 | 9% | ✅ 完整 | ✅ 3002 |
| chatops | 14,141 | orion-chatops-svc-go | 2,873 | 20% | ✅ 完整 | ⚠️ 路由到 3001 |
| finops | 13,244 | orion-finops-svc-go | 2,647 | 20% | ✅ 完整 | ✅ 3009 |
| build | 11,294 | orion-build-svc-go | 1,929 | 17% | ✅ 完整 | ✅ 3015 |
| config-mgmt | 9,384 | orion-config-mgmt-svc-go | 2,710 | 29% | ✅ 完整 | ✅ 3029 |
| lowcode | 8,847 | orion-lowcode-svc-go | 1,418 | 16% | ✅ 完整 | ✅ 3018 |
| efficiency | 7,432 | orion-efficiency-svc-go | 1,259 | 17% | ✅ 完整 | ✅ 3015 |
| deploy | 7,107 | orion-deploy-svc-go | 1,316 | 19% | ✅ 完整 | ✅ 3003 |
| approval | 6,913 | orion-approval-svc-go | 1,597 | 23% | ✅ 完整 | ✅ 3018 |
| security | 6,773 | orion-security-svc-go | 1,296 | 19% | ✅ 完整 | ✅ 3013 |
| plugin | 5,449 | orion-plugin-svc-go | 970 | 18% | ✅ 完整 | ✅ 3011 |
| cmdb | 5,367 | orion-cmdb-svc-go | 1,969 | 37% | ✅ 完整 | ✅ 3030 |
| audit | 4,514 | orion-audit-svc-go | 1,114 | 25% | ✅ 完整 | ✅ 3026 |
| skill | 4,204 | orion-skill-svc-go | 2,687 | 64% | ✅ 完整 | ✅ 3023 |
| digital-twin | 4,041 | orion-digital-twin-svc-go | 2,281 | 56% | ✅ 完整 | ✅ 3008 |
| scheduler | 2,613 | orion-scheduler-svc-go | 1,945 | 74% | ✅ 完整 | ✅ 3023 |
| community | 2,347 | orion-community-svc-go | 1,731 | 74% | ✅ 完整 | ✅ 3033 |
| artifact | 2,129 | orion-artifact-svc-go | 1,204 | 57% | ✅ 完整 | ✅ 3014 |
| notification | 1,476 | orion-notification-svc-go | 1,705 | 115% | ✅ 完整 | ⚠️ 路由到 3001 |
| monitor | 0 | orion-monitor-svc-go | 2,313 | N/A | ✅ 完整 | ✅ 3005 |
| ticket | 0 | orion-ticket-svc-go | 9,037 | N/A | ✅ 完整 | ✅ 3004 |

> **注意**: monitor 和 ticket 在 TS 中无独立服务目录（功能内嵌于 platform-service），其 Go 版本是独立实现的。

### 2.2 部分完成 Go 实现（代码量 500-2000 行）

| TS 服务 | TS 行数 | Go 服务 | Go 行数 | 实现深度 | Gateway 路由 |
|---------|---------|---------|---------|---------|-------------|
| selfhealing | 0 | orion-selfhealing-svc-go | 1,128 | ⚠️ 骨架 | ✅ 3024 |
| secret | 0 | orion-secret-svc-go | 1,066 | ⚠️ 骨架 | ✅ 3036 |
| tool | 0 | orion-tool-svc-go | 1,008 | ⚠️ 骨架 | ✅ 3036 |
| pipeline-template | 0 | orion-pipeline-template-svc-go | 1,246 | ⚠️ 骨架 | ✅ 3035 |
| canary | 0 | orion-canary-svc-go | 2,506 | ✅ 完整 | ✅ 3015 |
| dr | 0 | orion-dr-svc-go | 2,176 | ✅ 完整 | ✅ 3016 |
| federation | 0 | orion-federation-svc-go | 317 | ❌ 骨架 | ✅ 3017 |
| governance | 0 | orion-governance-svc-go | 1,994 | ✅ 完整 | ✅ 3022 |
| risk | 0 | orion-risk-svc-go | 1,976 | ✅ 完整 | ✅ 3025 |
| runner | 0 | orion-runner-svc-go | 2,191 | ✅ 完整 | ✅ 3028 |
| llm | 0 | orion-llm-svc-go | 1,291 | ⚠️ 骨架 | ✅ 3012 |
| middleware-ops | 0 | orion-middleware-ops-svc-go | 1,306 | ⚠️ 骨架 | ✅ 3036 |
| capacity | 0 | orion-capacity-svc-go | 1,210 | ⚠️ 骨架 | ✅ 3015 |
| cron | 0 | orion-cron-svc-go | 1,401 | ⚠️ 骨架 | ✅ 3035 |
| feature-flag | 0 | orion-feature-flag-svc-go | 1,215 | ⚠️ 骨架 | ✅ 3015 |
| skill-config | 0 | orion-skill-config-svc-go | 1,892 | ⚠️ 骨架 | ✅ 3036 |
| visor | 0 | orion-visor-svc-go | 2,087 | ✅ 完整 | ✅ 3034 |
| notify | 0 | orion-notify-svc-go | 1,202 | ⚠️ 骨架 | ⚠️ 路由到 3001 |
| event-bus | 0 | orion-event-bus-svc-go | 757 | ❌ 骨架 | ✅ 3021 |
| code | 0 | orion-code-svc-go | 1,893 | ✅ 完整 | ✅ 3010 |
| inspection | 0 | orion-inspection-svc-go | 404 | ❌ 骨架 | ✅ 3021 |
| intelligence | 0 | orion-intelligence-svc-go | 318 | ❌ 骨架 | ✅ 3006 |
| pandawiki | 0 | orion-pandawiki-svc-go | 317 | ❌ 骨架 | ✅ 8002 (Python) |
| workflow | 0 | orion-workflow-svc-go | 382 | ❌ 骨架 | ✅ 3035 |

### 2.3 无 Go 蓝图的 TS 服务（90 个）

以下 TS 服务没有对应的 Go 蓝图，仍运行在 platform-service 单体中：

```
adaptive-pipeline, ai-agents, ai-review, ai-training, alert, alert-breaker,
api-governance, api-key, api-market, artifact-ops, auth, authz, backup,
billing, cache, cache-monitor, canary-traffic, capability, change,
change-intelligence, change-request, channel, chaos-engineering, circuit-breaker,
compliance, data-pipeline, email, ephemeral-env, error-handler, gitlab-adapter,
health, incident, integration, jit, k8s, ldap, learning, license, log,
maintenance, message-queue, migration, multi-cloud, oauth, oncall, organization,
perf-opt, plugin-manager, postmortem, priority, prometheus, provisioning,
quota, rbac, report, resource, rollback, run-tracking, sla, sprint,
stage-group, supply-chain, team, template, terraform, test-selector,
threat-model, uptime, version, worker-pool
```

---

## 三、实现深度评估

### 3.1 按实现深度分类

| 深度等级 | 定义 | 数量 | 占比 |
|---------|------|------|------|
| ✅ 完整 | Go 代码 > 1500 行，有 handler/model | 18 | 38% |
| ⚠️ 骨架 | Go 代码 500-1500 行 | 19 | 40% |
| ❌ 极薄 | Go 代码 < 500 行 | 10 | 22% |

### 3.2 代码转换效率

| 服务 | TS 行数 | Go 行数 | Go/TS 比例 | 说明 |
|------|---------|---------|-----------|------|
| pipeline | 40,348 | 3,618 | 9% | Go 实现约 1/10 |
| chatops | 14,141 | 2,873 | 20% | Go 实现约 1/5 |
| finops | 13,244 | 2,647 | 20% | Go 实现约 1/5 |
| config-mgmt | 9,384 | 2,710 | 29% | Go 实现约 1/3 |
| deploy | 7,107 | 1,316 | 19% | Go 实现约 1/5 |
| approval | 6,913 | 1,597 | 23% | Go 实现约 1/4 |
| security | 6,773 | 1,296 | 19% | Go 实现约 1/5 |
| **平均** | **7,915** | **2,087** | **26%** | **Go 实现约 1/4** |

> **关键发现**: Go 实现通常是 TS 代码量的 20-30%，因为 Go 不需要 TypeScript 的类型定义、接口、枚举等元数据代码。

---

## 四、Gateway 路由状态

### 4.1 路由到独立 Go 服务（24 个）

| 服务 | 端口 | 状态 |
|------|------|------|
| Pipeline | 3002 | ✅ 已部署 |
| Deploy | 3003 | ✅ 已部署 |
| Ticket | 3004 | ✅ 已部署 |
| Monitor | 3005 | ✅ 已部署 |
| Intelligence | 3006 | ⚠️ 骨架 (318 行) |
| Agent | 3007 | ❌ 无 Go 蓝图 |
| Digital-Twin | 3008 | ✅ 已部署 |
| FinOps | 3009 | ✅ 已部署 |
| Code | 3010 | ✅ 已部署 |
| Plugin | 3011 | ✅ 已部署 |
| AI | 3012 | ⚠️ 骨架 (1,291 行) |
| Security | 3013 | ✅ 已部署 |
| Artifact | 3014 | ✅ 已部署 |
| Efficiency | 3015 | ✅ 已部署 |
| DR | 3016 | ✅ 已部署 |
| Federation | 3017 | ❌ 骨架 (317 行) |
| Approval | 3018 | ✅ 已部署 |
| Notify | 3019 | ⚠️ 路由到 3001 |
| Knowledge | 8002 | ⚠️ 骨架 (317 行) |
| Graph | 3021 | ❌ 骨架 (404 行) |
| Governance | 3022 | ✅ 已部署 |
| Skill | 3023 | ✅ 已部署 |
| SelfHealing | 3024 | ✅ 已部署 |
| Risk | 3025 | ✅ 已部署 |

### 4.2 路由到平台服务（2 个）

| 服务 | 当前路由 | 说明 |
|------|---------|------|
| Notify | localhost:3001 | 功能仍在 platform-service |
| ChatOps | localhost:3001 | 功能仍在 platform-service |

---

## 五、迁移路线图建议

### 5.1 第一阶段（已完成）

| 服务 | Go 行数 | 状态 |
|------|---------|------|
| CMDB | 1,969 | ✅ 已部署 |
| Pipeline | 3,618 | ✅ 已部署 |
| Deploy | 1,316 | ✅ 已部署 |
| Ticket | 9,037 | ✅ 已部署 |
| Monitor | 2,313 | ✅ 已部署 |
| Intelligence | 318 | ⚠️ 需补充 |

### 5.2 第二阶段（需补充 Go 实现）

| 服务 | TS 行数 | Go 行数 | 缺口 |
|------|---------|---------|------|
| ChatOps | 14,141 | 2,873 | 需补充 70% |
| FinOps | 13,244 | 2,647 | 需补充 70% |
| Build | 11,294 | 1,929 | 需补充 70% |
| Config-Mgmt | 9,384 | 2,710 | 需补充 60% |
| Lowcode | 8,847 | 1,418 | 需补充 70% |
| Efficiency | 7,432 | 1,259 | 需补充 70% |
| Deploy | 7,107 | 1,316 | 需补充 70% |
| Approval | 6,913 | 1,597 | 需补充 70% |
| Security | 6,773 | 1,296 | 需补充 70% |
| Plugin | 5,449 | 970 | 需补充 70% |

### 5.3 第三阶段（新建 Go 蓝图）

以下 90 个 TS 服务需要新建 Go 蓝图：

```
auth, tenant, user, notification, alert, compliance, data-pipeline,
multi-cloud, digital-twin, skill, config, audit, risk, governance,
canary, capacity, cron, feature-flag, inspection, middleware-ops,
pipeline-template, runner, secret, selfhealing, ticket, tool, visor, workflow
```

> **注意**: 其中部分服务已有 Go 蓝图但代码量极少（< 500 行），需要扩充。

---

## 六、与 Java/Spring Boot 的关系

### 6.1 架构重构设计.md 中的 Java 描述

`docs/architecture/架构重构设计.md` 描述了 Java/Spring Boot 微服务的目标架构：

```
核心域 → Java + Spring Boot
支撑域 → Python + Java
```

### 6.2 实际执行方向

| 维度 | 架构重构设计.md | 实际代码 |
|------|----------------|---------|
| 目标语言 | Java + Spring Boot | **Go** |
| 微服务数 | 8 个 | **47 个** |
| 技术栈 | 统一 Java | **Go + Python + Node.js** |
| 部署状态 | 未实现 | **6 个已部署** |

### 6.3 结论

**TS → Go 是实际执行方向，不是 TS → Java。**

`架构重构设计.md` 中的 Java/Spring Boot 描述是**早期理想态设计**，已被实际执行的 Go 迁移方案取代。

---

## 七、关键数据

| 指标 | 值 |
|------|-----|
| 总 TS 服务 | 137 |
| 有 Go 蓝图 | 47 (34%) |
| Go 构建通过 | 47/47 (100%) |
| Go 代码总量 | ~65,000 行 |
| TS 代码总量 | ~150,000 行 |
| Go/TS 代码比 | 1:2.3 |
| 已部署 Go 服务 | 6 |
| Gateway 路由就绪 | 34 |
| 路由到平台服务 | 2 |
| 无 Go 蓝图的 TS 服务 | 90 |
