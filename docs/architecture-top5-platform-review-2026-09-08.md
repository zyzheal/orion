# Orion 平台 TOP5 平台级架构深度评审 (2026-09-08)

> ⚠️ **最终核实（2026-09-08 Phase 300 差距扩展审计）**：本评审声称的"5 项新增任务（T-AUDIT/T-QUOTA/T-CONFIG-LEVEL/T-POSTMORTEM/T-SPI）"**已全部实现**，实测行数与能力深度差异巨大：
> - T-AUDIT：声称 2829 行 vs 实际 **1595 行 (-43%)**；SOC2 已有，ISO27001 endpoint 缺失
> - T-QUOTA：声称 1287 行 vs 实际 **823 行 (-36%)**；**P0 BUG：`wiretenantquota` 未被 wiring.go 调用 → tqH 永远 nil → API 不可达**
> - T-CONFIG-LEVEL：声称 408K vs 实际 **1431 行**；**能力缺失：只有 TenantID，无 Level 字段（无法支持 platform→tenant→user 三层）**
> - T-SPI：实际 1827 行；**能力缺失：只有 Category 分类，无内置扩展点枚举**
> - T-POSTMORTEM：声称 155 行 + 91 测试 + 6 路由 vs 实际 154 行 + 91 测试 + 6 路由 ✅ **完全匹配**
>
> **修正结论**：TOP5 视角暴露的差距**不是"+24d 新增任务"，而是"6d 差距扩展"**。详细数据、修复方案、教训总结见 `docs/flagship-review-v3.6-delta-2026-09-08.md`。
>
> **教训**：TOP5 视角评审连续 3 次误判，根因是**先看目标架构、再对照代码**，而不是**先 `find` 全库核实、再评估差距**。

> **定位**：本文档是 5 大平台（NeatLogic/ServiceNow/Datadog/GitLab/AWS）视角对 Orion 各域能力的**详细分析**。
> **配套文档**：升级后的 80 项任务清单见 `docs/missing-feature-design-2026-08-25.md` 的 G.0 章节（2026-09-08 升级标注，含 5 项新增任务 T-AUDIT/T-QUOTA/T-CONFIG-LEVEL/T-POSTMORTEM/T-SPI）。
> **关系**：本文档是平台视角分析，G.0 章节是任务清单升级标注，两者配合使用。

## 0. 现状基线

| 维度 | 数值 |
|------|------|
| Go 后端模块 | **310 个**（`internal/`） |
| 前端页面 | **217 个**（`pages/`） |
| 前端 API 客户端 | **180 个**（`api/*.ts`） |
| Service 文件 | **710 个** |
| Handler 文件 | **498 个** |
| Repository 文件 | **603 个** |
| Handler 测试 | **629 个** |
| 空壳目录（<1KB） | **1440 个**（≈ 4.6%） |

**结论**：广度已覆盖，但深度参差不齐——平均每模块 2.3 service 文件，部分模块是"宽而浅"的薄包装。

---

## 1. NeatLogic 视角：扩展点开放度

**NeatLogic 主张**：企业级平台必须开放 **29 个扩展点**，让集成方在不动平台代码的前提下扩展能力。

### 1.1 已覆盖（8/29）

| 扩展点类别 | 代码位置 |
|-----------|---------|
| 自定义任务 | `PluginManagement/PluginList.tsx` |
| Skill 市场 | `ai/skill/`（2636 行） |
| Webhook | `notification/` + eventbus |
| 低代码生成 | `lowcode/handler/handler.go` |
| AI Agent 编排 | `ai/orchestration`（2256 行） |
| 审批工作流 | `dba/service/service.go` |
| 配置中心 | `config/`（408K） |
| 集成 API | 239 API 客户端 |

### 1.2 关键缺口（21/29）

| 缺口 | 优先级 | 对应 G.0 新任务 |
|------|--------|----------------|
| 租户级配置覆盖 | P0 | T-CONFIG-LEVEL |
| 权限规则 DSL | P0 | — |
| 报表模板 SPI | P1 | T-SPI |
| 数据源适配器 SPI | P1 | T-SPI |
| 告警路由规则 SPI | P1 | T-SPI |
| 变更单字段扩展 | P1 | T-SPI |
| 审批流自定义 | P1 | T-SPI |
| 表单字段校验器 SPI | P2 | T-SPI |
| 审计事件订阅 | P2 | T-AUDIT |
| 通知模板渲染 SPI | P2 | T-SPI |

---

## 2. ServiceNow 视角：ITSM 闭环

**ServiceNow 主张**：ITSM 价值在**闭环**——Incident → Problem → Change → Post-incident Review → Knowledge → Automation。

### 2.1 已实现（4/6）

| 环节 | 代码 | 深度 |
|------|------|------|
| Incident 事件 | `ticketing/Incident.ts` 1752 行 | ✅ |
| Problem 问题 | `ticketing/Problem.ts` 1388 行 | ✅ |
| Change 变更 | `ChangeManagement` 2111 行 | ✅ |
| SLA 管理 | `SLA` 1238 行 | ✅ |
| CMDB 配置 | `CMDB` 1171 行 | ✅ |
| 复盘 Post-mortem | 无 | ❌ |

### 2.2 关键缺口

| 缺口 | 优先级 | 对应 G.0 新任务 |
|------|--------|----------------|
| 复盘闭环 | P0 | T-POSTMORTEM |
| 知识沉淀 | P0 | T-POSTMORTEM |
| OnCall 深度排班 | P1 | T-20（已存在） |
| 问题根因关联 | P1 | — |
| SLA 烧速计算 | P1 | T-19（已存在，前置到 Wave 1） |
| CMDB 配置变更 | P1 | — |

---

## 3. Datadog 视角：可观测性深度

**Datadog 主张**：现代可观测性包括 **RUM + APM 深度 + SLO 烧速 + 关联分析**。

### 3.1 现状

| 维度 | 代码 | 状态 |
|------|------|------|
| Metrics | `monitoring/`（472K） | ✅ |
| Logs | `monitoring/` | ⚠️ 深度未验证 |
| Traces | `observability/` 5 路由 | ⚠️ 浅 |
| RUM 前端监控 | `apm/` 8 路由 | ❌ T-16 |
| SLO 烧速 | `slo service 72 行` | ❌ T-19 |
| 告警关联 | `alert-correlation/` | ✅ |
| 服务健康 | `service-health` 80 路由 | ✅ |

### 3.2 关键缺口

| 缺口 | 优先级 | 对应 G.0 新任务 |
|------|--------|----------------|
| SLO 烧速计算 | P0 | T-19（前置 Wave 1） |
| RUM 真实用户监控 | P1 | T-16（Wave 3） |
| Trace 深度 | P1 | T-15（Wave 2） |
| Log-based Alerting | P1 | — |
| Service Graph | P1 | — |
| 关联分析 | P2 | — |

---

## 4. GitLab 视角：CI/CD 端到端

**GitLab 主张**：CI/CD 价值在**端到端**——需求→代码→构建→测试→部署→监控→发布，每环节可追溯。

### 4.1 现状（6/11）

| 环节 | 代码 | 状态 |
|------|------|------|
| 需求管理 | `pages/RDM/` 355 行前端 | ⚠️ **后端缺失** T-04 |
| 代码管理 | `code-repo` 25 路由 | ⚠️ T-07 |
| 流水线编辑 | PipelineEditor 816 行 | ✅ |
| 流水线执行 | `ci-cd/` 972K | ✅ |
| 测试管理 | test-selector | ✅ |
| 部署 | `deploy-enhanced` | ✅ |
| 金丝雀 | CanaryAnalysis 667 行 | ⚠️ T-17 |
| 回滚 | PipelineRetryRollback 838 行 | ✅ |
| GitOps | 缺 ArgoCD/Flux | ❌ T-18 |
| 发布 | `release/` | ✅ |
| 监控集成 | 三支柱 | ⚠️ 见 §3 |

### 4.2 关键缺口

| 缺口 | 优先级 | 对应 G.0 新任务 |
|------|--------|----------------|
| 需求→代码追溯 | P0 | T-04（Wave 1，本 session 起步） |
| GitOps 闭环 | P0 | T-18（前置 Wave 1） |
| 模板市场 | P1 | — |
| 金丝雀 AI 验证 | P1 | T-17（Wave 2） |
| MR 集成 | P1 | — |
| 端到端可追溯 | P0 | T-04 + T-AUDIT |

---

## 5. AWS 视角：基础设施与多租户

**AWS 主张**：企业级平台必须支持**多租户隔离 + 基础设施抽象 + 合规审计**。

### 5.1 现状（3/6）

| 维度 | 代码 | 状态 |
|------|------|------|
| 租户模型 | 所有模块含 `tenant_id` | ✅ |
| 租户隔离 | SQL `WHERE tenant_id=$1` | ✅ |
| 跨租户检查 | DBA ExecuteOrder P0-2 已修 | ✅ |
| 资源配额 | 无 | ❌ |
| 租户级计费 | Finops 有但无租户维度 | ❌ |
| 审计日志 | 各模块分散 | ⚠️ 无统一中心 |
| SSO/SAML | 统一认证 | ✅ |
| ABAC | `security-svc/ABACPolicy` | ⚠️ 深度未验证 |

### 5.2 关键缺口

| 缺口 | 优先级 | 对应 G.0 新任务 |
|------|--------|----------------|
| 统一审计日志 | P0 | T-AUDIT（新增 Wave 1） |
| 租户级配额 | P1 | T-QUOTA（新增 Wave 2） |
| 租户级计费 | P1 | — |
| ABAC 深度 | P1 | — |
| 配置漂移检测 | P1 | — |
| 合规审计 | P1 | — |

---

## TOP5 视角综合对照

| 视角 | 已覆盖 | 关键缺口 | 对应 G.0 新任务 |
|------|-------|---------|---------------|
| NeatLogic 扩展点 | 8/29 | 21 个扩展点缺失 | T-SPI + T-CONFIG-LEVEL |
| ServiceNow ITSM | 4/6 | 复盘/知识沉淀/OnCall 排班 | T-POSTMORTEM + T-20 |
| Datadog 可观测 | 3/6 | SLO 烧速/RUM/Service Graph | T-19 + T-16 |
| GitLab 端到端 | 6/11 | RDM/GitOps/模板市场 | T-04 + T-18 |
| AWS 多租户 | 3/6 | 配额/计费/统一审计 | T-AUDIT + T-QUOTA |

---

## 跨视角 TOP5 共性缺口

1. **统一审计日志中心**（AWS + ServiceNow）—— T-AUDIT（新增 Wave 1）
2. **需求 → 代码追溯链**（GitLab）—— T-04（Wave 1，本 session 起步）
3. **复盘 → 知识沉淀闭环**（ServiceNow）—— T-POSTMORTEM（新增 Wave 2）
4. **租户级配置/配额/计费**（NeatLogic + AWS）—— T-CONFIG-LEVEL + T-QUOTA（新增 Wave 2）
5. **SLO 烧速 + RUM**（Datadog）—— T-19（前置 Wave 1）+ T-16（Wave 3）

---

## 升级后的 Wave 总览

| Wave | 原任务数 | 原人天 | 升级后任务数 | 升级后人天 | 变更 |
|------|---------|--------|-------------|-----------|------|
| Wave 1 | 8 | 11d | 11 | 20d | +T-19/T-18/T-AUDIT |
| Wave 2 | 15 | 36d | 18 | 48d | +T-QUOTA/T-CONFIG-LEVEL/T-POSTMORTEM |
| Wave 3 | 13 | 26d | 14 | 34d | +T-SPI |
| Wave 4 | 11 | 27d | 11 | 27d | 不变 |
| Wave 5 | 16 | 164d | 16 | 164d | 不变 |
| Wave 5b | 7 | 10.5d | 7 | 10.5d | 不变 |
| Wave 5c | 3 | 12d | 3 | 12d | 不变 |
| **合计** | **73** | **286.5d** | **80** | **315.5d** | **+7 项 +29d** |

---

## 数据可信度说明

- **服务文件数**：`find internal/ -name "service*.go"` = 710
- **前端页面数**：`ls pages/` = 217
- **API 客户端数**：`ls api/*.ts` = 180
- **空壳检测**：`find -size -1k` = 1440 子目录
- **Codegraph 索引**：326K 节点（68 天未更新）

**未验证项**（需后续核实）：
- 各模块 service 实现深度（真实业务逻辑 vs thin wrapper）
- 审计日志是否真的分散
- ABAC 后端实现深度
- 金丝雀分析深度
