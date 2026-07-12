# TS→Go 统一技术栈迁移方案（v4 - 代码深度分析修正版）

**日期**: 2026-07-12
**状态**: 已深度评审 + 4 路代码分析修正
**目标**: 将 Orion 平台从 TypeScript 技术栈统一迁移到 Go，消除多语言维护成本

---

## 1. 背景与目标

### 1.1 当前架构状态（代码分析验证版）

| 维度 | v3 声明 | 代码实际 | 差异 |
|------|---------|---------|------|
| TS 平台服务 | ~2,100 路由, 175 路由文件 | ✅ 确认 | — |
| Go 平台服务 | 46 个 internal 模块, ~1,000 路由 | **51 个 internal 模块, ~850 路由** | +5 模块, -150 路由 |
| Go 模块完整率 | 未评估 | **41/51 完整 (80%)**, 4 个缺 handler | — |
| Go→TS 覆盖比 | 未明确 | **~23%**（核心模块 pipeline/workflow/notification/AI 全缺） | — |
| Go 模块间耦合 | 未评估 | **零耦合**（所有模块独立，无跨模块 import） | 优秀 |
| Go DB 模式 | 未明确 | **统一 sqlx + PostgreSQL，无 GORM，无内存存储** | 优秀 |
| Go 迁移文件 | 未明确 | **仅 7 个模块有 migration 文件** | 严重不足 |
| Go 可观测性 | 无 OTel/Prometheus | ✅ 确认无 | — |
| Go Docker/CI | 无 Dockerfile、不在 CI | ✅ 确认 | — |
| Go 蓝图目录 | 31 个，17 个有业务路由 | ✅ 确认 | — |
| API Gateway | 31,741 行, 12 个 routes.ts 内嵌业务逻辑 | **13 个 routes.ts, 8,719 行, 0 SQL 查询** | 重大修正 |
| Gateway 存储 | 声称有 SQL | **12/13 使用 Map() 内存, 仅 tenant 用 Redis** | mock/占位 |
| 部署形态 | 单体: Gateway(3000) → Platform(3001) | ✅ 确认 | — |

### 1.2 核心目标

1. **统一技术栈**: 所有后端服务使用 Go，消除 TS 维护成本
2. **消除代码重复**: 11 个模块同时在 platform-svc-go 和蓝图中存在
3. **Gateway 瘦身**: 13 个 routes.ts 中的 mock/占位业务逻辑替换为 Go 后端
4. **渐进式迁移**: 不中断现有功能，每 Phase 验证通过
5. **数据一致性**: 迁移过程中保证 Schema 兼容、数据无损、幂等性
6. **可观测性**: 迁移后统一日志/指标/追踪体系

### 1.2 核心目标

1. **统一技术栈**: 所有后端服务使用 Go，消除 TS 维护成本
2. **消除代码重复**: 11 个模块同时在 platform-svc-go 和蓝图中存在
3. **Gateway 瘦身**: 12 个 routes.ts 中的业务逻辑移回 Go 后端
4. **渐进式迁移**: 不中断现有功能，每 Phase 验证通过
5. **数据一致性**: 迁移过程中保证 Schema 兼容、数据无损、幂等性
6. **可观测性**: 迁移后统一日志/指标/追踪体系

### 1.3 架构原则（v3 补充）

> 来自 5 位深度评审专家（2026-07-12）

1. **单体优先**: 所有代码先集中到 platform-svc-go，未来按需拆分
2. **蓝图不删除**: 仅清除重复代码，保留 go.mod 作为编译验证单元
3. **Gateway 回归纯代理**: 业务逻辑全部移回后端
4. **每 Phase 构建通过**: `go build ./...` 是硬性门控
5. **DDD 领域建模前置**: 先梳理限界上下文，再迁移代码（v3 新增）
6. **接口解耦**: 模块间通过 interface 引用，依赖注入实例化（v3 新增）
7. **数据面先行**: 任何路由迁移前先完成 Schema 对齐和数据一致性验证（v3 新增）
8. **可观测性配套**: 每个 Phase 迁移的模块必须同步完成日志/指标/追踪集成（v3 新增）

### 1.4 代码深度分析关键发现（v4 新增）

> 基于 Go Platform / Blueprint / Gateway / TS 四路代码分析

| # | 发现 | 影响 |
|---|------|------|
| **CF-01** | Gateway 13 个 routes.ts 使用 **Map() 内存存储**（启动即丢失），仅 tenant 用 Redis | Phase 4 Gateway 迁移风险**从"数据一致性"降为"功能替换"** |
| **CF-02** | Gateway 13 routes.ts **0 个 SQL 查询**（v3 声称有 SQL，错误） | v3 的 Schema 对齐策略对 Gateway 路由不适用 |
| **CF-03** | Go 平台 51 模块中 **41 个完整**（80%），4 个缺 handler（change/skill/sla/visor-exec） | Phase 1 需先补全 4 个 handler 再谈注册 |
| **CF-04** | Go 模块间**零耦合**——无跨模块 import | 依赖治理 DAG（3.2 节）可简化，无需 CI 检测 |
| **CF-05** | Go 统一使用 **sqlx + PostgreSQL**，无 GORM、无内存存储 | 架构一致性极好，迁移目标明确 |
| **CF-06** | Go 仅有 **7/51 模块有 migration 文件** | Phase 0 需补充剩余模块的 DB migration |
| **CF-07** | 蓝图 **backup(8r) 不存在**（v3 Phase 2.7 声称存在） | Phase 2.7 任务描述需修正 |
| **CF-08** | 蓝图 **security(37r) = RBAC/ACL 策略管理**，非通用安全 | Phase 2.12a 描述需精确化 |
| **CF-09** | 蓝图声明路由数比实际多 **15-20%**（config/monitoring/billing 含 placeholder） | Phase 2 预估工作量需下调 |
| **CF-10** | Go 与 TS 命名**完全一致**（digital-twin/digital-twin 等） | v3 的 3.3 通用语言统一大部分不需要 |
| **CF-11** | Gateway auth 中间件完整但**无细粒度权限校验** | Phase 4 迁移需补 RBAC |
| **CF-12** | Gateway proxy 已实现**熔断(5次失败)/重试(3次指数退避)/超时(30s)** | Phase 6 拆分可直接复用 |

---

## 2. 当前状态分析

### 2.1 TS 模块状态分类

```
TS 路由总数:     ~2,100
  ├─ 已在 Go 平台完整实现: 27 个模块 (~850 路由) ← 实际路由数修正
  ├─ 部分在 Go 平台: 19 个模块 (~500 路由)
  ├─ 仅蓝图存在: 41 个子模块 (~500 路由, 实际~400, 15-20% placeholder)
  ├─ 仅 TS 存在: 102 个模块 (~400 路由)
  └─ 在 Gateway routes.ts 中: 13 个模块 (8,719 行, 0 SQL, Map 内存)
```

**代码分析验证**:
- Go 平台实际覆盖 **51 个模块**（非 46 个），其中 **41 个完整**（handler/service/repository/models 全齐）
- **4 个模块缺 handler**：change, skill, sla, visor-exec（service/repository 已有，仅缺 handler.go）
- Go 模块间**零耦合**——无跨模块 import，垂直分层隔离
- Go 覆盖 TS 平台 **~23%** 的路由文件（核心 pipeline/workflow/notification/AI 全缺）
- 蓝图声明路由数比实际多 **15-20%**（config/monitoring/billing/security-compliance 含 placeholder）

### 2.2 代码重复情况（v4 修正——代码分析验证）

**11 个模块同时在 platform 和蓝图中存在**（代码实际验证）:

| 模块 | Go 平台路由 | 蓝图实际 | 处理方式 |
|------|-----------|---------|---------|
| approval | 23 ✅完整 | 空壳(0) | 直接以平台为准 |
| audit | 20 ✅完整 | 空壳(0) | 直接以平台为准 |
| deploy | 14 ✅完整 | 空壳(0) | 从 ci-cd 吸收增强 |
| infrastructure | 19 ✅完整 | 空壳(0) | 注册到 main.go |
| tenant | 28 ✅完整 | 空壳(0) | 直接以平台为准 |
| knowledge | 18 ✅完整 | 空壳(0) | 直接以平台为准 |
| artifact | 19 ✅完整 | 蓝图有 artifact(5r)+code(5r)，**均为标准 CRUD，无增量价值** | 以平台为准 |
| build-env | 22 ✅完整 | 蓝图有 build_env(10r)，**cache_monitor 是蓝图独有功能** | 吸收 cache_monitor |
| cmdb | 23 ✅完整 | 蓝图 cmdb(5r)+4 子模块(20r)，**均为标准 CRUD** | 以平台为准 |
| incident | 20 ✅完整 | 蓝图 44r（change/changerequest/oncall 等） | 蓝图有增量，合并 |
| monitoring | 36 ✅完整 | 蓝图 alert(10r)，**RCA/关联分析/去重/静默/通知模板为蓝图独有** | 吸收高级告警引擎 |

### 2.3 Gateway 业务逻辑情况（v4 重大修正——代码分析验证）

**v3 错误**: 声称 Gateway 12 个 routes.ts 包含"直接 SQL 查询"
**代码实际**: Gateway 13 个 routes.ts **0 个 SQL 查询**，12 个使用 **Map() 内存存储**（启动即丢失），仅 tenant 用 Redis

| 路由文件 | 行数 | 存储方式 | SQL 查询 | 与 Go 平台重叠 |
|-----------|------|---------|---------|--------------|
| auth.routes.ts | 159 | 代理到 3001 | 0 | 否（纯代理） |
| tenant.routes.ts | 630 | **Redis** (KV) | 0 | **是**（Go 已实现 PostgreSQL 版） |
| pipeline-versions | 472 | Map() 内存 | 0 | 否 |
| pipeline-budget | 521 | Map() 内存 | 0 | 否 |
| pipeline-templates | 710 | Map() 内存 | 0 | 否 |
| ai-models | 712 | Map() 内存 | 0 | 否 |
| ai-decisions | 791 | Map() 内存 | 0 | 否 |
| ai-degradation | 637 | Map() 内存 | 0 | 否 |
| chaos | 784 | Map() 内存 | 0 | **是**（Go 已实现 PostgreSQL 版） |
| resilience-score | 688 | Map() 内存 | 0 | 否 |
| digital-twin | 865 | Map() 内存 | 0 | **是**（Go 已实现 PostgreSQL 版） |
| governance | 864 | Map() 内存 | 0 | **是**（Go 已实现 PostgreSQL 版） |
| sbom | 886 | Map() 内存 | 0 | 否 |
| **合计** | **8,719** | — | **0** | **4 个重叠** |

**重大修正**: Gateway 的业务 routes.ts 是 **mock/占位实现**，不是"权威实现"。迁移本质是**将 mock 替换为 Go 后端的真实实现**，而非"数据迁移"。这大幅降低了 Phase 4 的风险。

**Gateway 4 个重叠模块处理**:
- `chaos`: Gateway 版本（Map 内存）→ 被 Go 版本（PostgreSQL）替代
- `digital-twin`: Gateway 版本（Map 内存）→ 被 Go 版本（PostgreSQL）替代
- `governance`: Gateway 版本（Map 内存）→ 被 Go 版本替代
- `tenant`: Gateway 版本（Redis KV）→ Go 版本已支持 PostgreSQL，补充 quota/suspend/activate

---

## 3. 架构设计（v3 新增——DDD+软件架构师评审驱动）

### 3.1 限界上下文划分（Bounded Context）

根据 DDD 架构师评审，将 46 个碎片化模块按领域聚合为 **10 个限界上下文**：

| 上下文 | 包含模块 | 类型 | 优先级 |
|--------|---------|------|--------|
| **CI/CD** | pipeline, runner, deploy, build-env, canary, artifact, code-repo | 核心域 | P0 |
| **ITSM** | incident, change, problem, sla, deploy-enhanced, change-request, self-healing, escalation | 核心域 | P0 |
| **AI/Intelligence** | skill, llm, aiagent, aicost, aigateway, aireview, aisecurity, intelligence, decisions, degradation, mcp | 核心域 | P0 |
| **Ticket** | ticket, ticketing, queue, runbook, ticket-knowledge | 核心域 | P0 |
| **Governance & Compliance** | governance, policy, compliance, risk, security-compliance, abac-policy, api-governance, permission-audit, terminal-audit | 支撑域 | P1 |
| **Observability** | monitoring, alert, tracing, audit, slo | 支撑域 | P1 |
| **Infrastructure** | infrastructure, iac, multi-cloud, dba, digital-twin, chaos, chaos-gateway, digital-twin-simulation, capacity, dr, middleware-ops, backup, oci-registry, serverless | 支撑域 | P1 |
| **FinOps** | finops, efficiency, report-designer, cost-allocation | 支撑域 | P1 |
| **Config & Gateway** | config, gateway-dynamic, plugin, feature-flag, federation | 通用域 | P2 |
| **Platform** | tenant, approval, team, project, sprint, i18n, capability, inception, handler-registry, service-registry, page-registry, internal-library, subapp, workbench, product-line, environment, developer-portal, chatops, cron, notification | 通用域 | P2 |

### 3.2 模块间依赖治理（DAG）

```
pkg/ (共享内核：错误码、日志、数据库、中间件)
  │
  ├── internal/ai/         ← AI 子系统（独立路由注册器+中间件链）
  ├── internal/ci-cd/      ← CI/CD 上下文
  │     ├── pipeline/
  │     ├── runner/
  │     ├── deploy/
  │     ├── build-env/
  │     ├── canary/
  │     └── artifact/
  ├── internal/itsm/       ← ITSM 上下文
  │     ├── incident/
  │     ├── change/
  │     ├── sla/
  │     └── problem/       ← 从蓝图移入
  ├── internal/ticket/     ← Ticket 上下文
  │     ├── ticket/        ← 统一 ticketing→ticket
  │     ├── queue/
  │     └── runbook/
  ├── internal/governance/ ← 治理上下文
  ├── internal/finops/     ← FinOps 上下文（统一 finops-v2→finops）
  ├── internal/infra/      ← 基础设施上下文
  │     ├── infrastructure/
  │     ├── iac/
  │     ├── digital-twin/  ← 沙箱/录制/回放
  │     ├── digital-twin-simulation/ ← 仿真预测（Gateway 迁入）
  │     ├── chaos/         ← 注入/恢复/预发布验证
  │     └── chaos-gateway/ ← 混沌工程管理（Gateway 迁入）
  ├── internal/observability/
  ├── internal/platform/   ← 通用域
  └── internal/config/
```

**依赖规则**（v4 修正——代码分析验证零耦合）:
- **当前 Go 平台实际状态**: 所有模块**零耦合**，无跨模块 import
- 核心域模块可依赖 `pkg/` 和同一上下文内的其他模块
- 不同上下文之间**禁止直接 import**，通过 interface + 事件通信（保持现状）
- **无需 CI 检测**（当前代码已满足，保持即可）

### 3.3 通用语言统一（v3 新增）

| 当前命名 | 问题 | 统一目标 |
|---------|------|---------|
| `finops-v2` / `finops` | 版本号不应进入领域命名 | → `finops` |
| `ticketing` / `ticket` | 同一概念两套命名 | → `ticket`（orion-ticket-svc-go 方向） |
| `digital-twin` / `digital-twins` | 单复数不一致 | → `digital-twin` |
| `ai-security` / `aisecurity` | 两个 AI 安全模块 | → `aisecurity`（AI 推理安全）, `ai-security` 归入 security 基础设施安全 |
| `skill` 三份实现 | platform 空壳 + AI 蓝图完整 + TS 25r | → `internal/skill/`（技能目录）, `internal/ai/skill/`（AI 技能执行） |

---

## 4. 迁移路线图（v3 修正版）

### 4.0 Phase 0: 基础设施先行（v3 新增——软件架构师+DevOps 评审驱动）

**目标**: 在迁移任何业务模块前，建立基础设施层

**任务清单**:

| 任务 | 描述 | 预估 |
|------|------|------|
| 0.0 | 创建 `pkg/` 共享内核：统一错误码、Logger(zap JSON 格式)、数据库连接池、Gin 中间件 | 2d |
| 0.1 | 集成 OpenTelemetry：TracerProvider + Gin 自动追踪 + trace ID 传播 | 1d |
| 0.2 | 注册 Prometheus `/metrics` 端点（gin.WrapH(promhttp.Handler())） | 0.5d |
| 0.3 | 创建多阶段 Dockerfile（scratch/alpine 构建） | 0.5d |
| 0.4 | 实现健康检查（含 DB/Redis/NATS 依赖检查） | 0.5d |
| 0.5 | 将 platform-svc-go 加入 CI 构建矩阵（go-test + docker-build） | 0.5d |
| 0.6 | 补全 4 个缺 handler 模块：change/skill/sla/visor-exec（service/repo 已有，只需写 handler.go） | 2d |
| 0.7 | 补充 DB migration 文件（仅 7/51 模块有，需补充剩余核心模块） | 1d |
| 0.8 | 定义模块间接口契约（interface 目录 + 依赖注入框架） | 1d |
| 0.9 | 定义 CI 依赖检测（禁止跨上下文 import，当前零耦合无需执行） | 0.5d |
| 0.10 | 采集 TS 平台性能基线（P50/P95/P99 延迟、QPS、内存） | 0.5d |
| 0.11 | `go build ./...` 验证 | 0.5d |

**v4 新增**: 0.6（补全 4 个缺 handler 模块）和 0.7（补充 DB migration 文件），基于代码分析发现。

**交付物**: 共享内核就绪、可观测性就绪、CI 就绪、Docker 就绪

### 4.1 Phase 0.5: DDD 领域梳理 + Schema 对齐（v3 新增——DDD+算法评审驱动）

**目标**: 梳理限界上下文、统一通用语言、对齐数据 Schema

**任务清单**:

| 任务 | 描述 | 预估 |
|------|------|------|
| 0.5.1 | 按 10 个限界上下文重组 internal 目录结构 | 1d |
| 0.5.2 | 统一命名：finops-v2→finops, ticketing→ticket | 0.5d |
| 0.5.3 | 厘清 aisecurity/ai-security 边界，合并到 `aisecurity` | 0.5d |
| 0.5.4 | 三方 skill 合并方案：platform skill 空壳 + AI 蓝图 skill 完整实现 | 1d |
| 0.5.5 | Schema 对齐：对 Phase 1 要迁移的模块，逐字段对比 TS DDL vs Go SQL | 2d |
| 0.5.6 | 编写 Schema 一致性测试（TS 写 → Go 读，字段值无损验证） | 1d |
| 0.5.7 | 删除重复蓝图代码（6 个空壳蓝图） | 1d |
| 0.5.8 | `go build ./...` 验证 | 0.5d |

**交付物**: 领域模型统一、Schema 兼容性验证通过

### 4.2 Phase 1: 消除代码重复 + 注册未注册模块

**目标**: 消除 11 个重复模块的代码重复，注册未注册的模块到 main.go

| 任务 | 描述 | 预估 |
|------|------|------|
| 1.1 | 删除 approval 蓝图代码，以平台为准 | 0.5d |
| 1.2 | 删除 audit 蓝图代码，以平台为准 | 0.5d |
| 1.3 | 删除 deploy 蓝图代码，以平台为准 | 0.5d |
| 1.4 | 删除 tenant 蓝图代码，以平台为准 | 0.5d |
| 1.5 | 删除 knowledge 蓝图代码，以平台为准 | 0.5d |
| 1.6 | infrastructure(19r) 注册到 main.go | 0.5d |
| 1.7 | change(18r) 从 incident 蓝图合并到 platform | 1d |
| 1.8 | changerequest(12r) 从 incident 蓝图合并到 platform | 1d |
| 1.9 | selfhealing(5r) 从 incident 蓝图合并到 platform | 0.5d |
| 1.10 | sla(17r) 补全 handler 并注册（service/repo 已有） | 1d |
| 1.11 | visor-exec(21r) 补全 handler 并注册（service/repo 已有） | 1d |
| 1.12 | build-env 从 ci-cd 蓝图吸收增强（cache_monitor 独有功能） | 1d |
| 1.13 | deploy 从 ci-cd 蓝图吸收状态机+OTel+NATS 增强 | 1d |
| 1.14 | 构建验证: `go build ./...` | 0.5d |

### 4.3 Phase 2: 合并蓝图中有完整代码的模块（修正版）

**目标**: 将 17 个蓝图中的有业务路由的子模块合并到 platform

**变更说明**:
- 2.1 cmdb 4 子模块降级：专家评审确认 data-lineage/data-quality/service-catalog/service-topology 为标准 CRUD 模板，无业务逻辑，优先级降低
- 2.13 AI 蓝图合并：**72 路由完整 Go 代码**，原方案完全遗漏
- 2.5 governance 拆分：governance(5r) 和 risk(5r) 降级，蓝图为浅 CRUD+TS 端为 stub
- 2.12 security 扩展：新增 security(37r) 模块
- 2.11 report-designer 优先级提升
- 2.7 infra-ops 扩展：（backup 不存在，代码验证）

**AI 子系统特别说明**（AI 专家评审驱动）:
- AI 模块不与其他业务模块平铺，而是作为独立子系统 `internal/ai/`，拥有自己的路由注册器和中间件链
- Gateway 三个 AI 路由（ai-models, ai-decisions, ai-degradation）直接合入 `internal/ai/`，不创建独立模块
- `aisecurity`（AI 推理安全）与 `ai-security`（AI 基础设施安全）厘清边界

**任务清单**:

| 任务 | 蓝图来源 | 子模块 | 路由 | 专家评审意见 |
|------|---------|--------|------|-------------|
| 2.1 | cmdb | data-lineage, data-quality, service-catalog, service-topology | 20 | **降级**：标准 CRUD 模板，无业务逻辑，可推迟至 Phase 3 |
| 2.2 | incident | oncall, escalation | 6 | 同意 |
| 2.3 | monitoring | 高级告警引擎(alert 增强)：RCA、关联分析、去重、静默、通知模板 | 10 | 同意 |
| 2.4 | notification | notification(16r) | 16 | 同意 |
| 2.5a | governance | compliance(10r), abac-policy(5r), api-governance(5r) | 20 | **拆分**：governance(5r) 和 risk(5r) 降级至 Phase 4 |
| 2.5b | governance | permission-audit(5r), terminal-audit(5r) | 10 | 同意 |
| 2.6 | identity | sso, session, apikey, confirmation | 12 | 同意 |
| 2.7 | infra-ops | capacity(18r), dr(30r), middleware-ops(17r) | 65 | **backup(8r) 不存在**（代码分析验证） |
| 2.8 | event-bus | eventbus, webhook, message-queue | 15 | 同意 |
| 2.9 | ticket | problem, queue, runbook, ticket-knowledge | 20 | 同意 |
| 2.10 | workflow | workflow | 7 | 同意 |
| 2.11 | finops | **report-designer(16r)**, efficiency(5r) | 21 | **优先级提升** |
| 2.12a | security | **security(37r)** — RBAC/ACL 策略管理 + 安全基线 + UEBA（非通用安全） | 37 | **新增** |
| 2.12b | security | secret(8r), vulnerability(4r), ai-security(9r) | 21 | 同意 |
| 2.13 | orion-ai-svc-go | llm(14r), skill(39r), aiagent(4r), aicost(4r), aigateway(4r), aireview(4r), aisecurity(4r), intelligence(3r) | **72** | **AI 子系统独立**：合入 `internal/ai/` |
| 2.14 | 删除对应蓝图重复代码 | — | — | — |

**AI 模块命名空间**:

```
orion-platform-svc-go/internal/ai/
  ├── llm/          ← 蓝图 (14r) + Gateway ai-models 迁入
  ├── skill/        ← 蓝图 (39r) + 与现有 skill models.go 合并
  ├── aiagent/      ← 蓝图 (4r)
  ├── aicost/       ← 蓝图 (4r)
  ├── aigateway/    ← 蓝图 (4r)
  ├── aireview/     ← 蓝图 (4r)
  ├── aisecurity/   ← 蓝图 (4r) + 厘清与 ai-security 边界
  ├── intelligence/ ← 蓝图 (3r) + Gateway ai-decisions 迁入
  └── degradation/  ← Gateway ai-degradation 迁入
```

### 4.4 Phase 3: 迁移高优先级 TS 模块（核心域优先）

**目标**: 先迁移核心域模块（pipeline, runner, skill），再迁移支撑域

**排序变更说明**（软件架构师+DDD 评审驱动）:
- pipeline/runner/canary 从 Phase 2 提前到 Phase 3（核心域）
- 核心域优先迁移，而非路由数多的先迁移

**核心域模块**:

| 模块 | TS 路由 | 蓝图可用 | TS 引擎复杂度 | 理由 |
|------|---------|---------|-------------|------|
| pipeline | 15+ | ci-cd 蓝图 15r（简化版） | **PipelineEngine(405r) + ContainerExecutor(272r) + CheckpointManager(474r) + MultiTargetExecutor(167r) = 1,318r** | 流水线执行引擎，核心域，**最复杂迁移** |
| runner | 35 | ci-cd 蓝图 35r | 蓝图 runner 含执行引擎 | CI runner 调度，核心域 |
| canary | 26 | ci-cd 蓝图 26r | 蓝图 canary 有集成测试 | 灰度发布，核心域 |
| sla | 17 | 无（platform 已有 service/repo 缺 handler） | — | 服务等级协议 |
| visor-exec | 21 | 无（platform 已有 service/repo 缺 handler） | — | 可视化执行 |
| change | 18 | 已在 Phase 1 合并 | — | 变更管理 |
| mlops | 16 | 无蓝图 | — | ML 工作流 |
| deploy-enhanced | 15 | 无蓝图 | TS 有 **DeploySaga(532r) + SagaCoordinator(432r) + IdempotencyChecker(260r) = 1,281r** | 部署增强，需迁移 Saga 编排 |
| lowcode | 15 | 空壳蓝图 | — | 低代码平台 |
| sbom | 15 | 已在 Gateway routes.ts | — | SBOM 管理 |
| api-market | 14 | 无蓝图 | — | API 市场 |

**Pipeline 引擎迁移特别说明**（v4 代码分析驱动）:
- TS pipeline 引擎远比蓝图完整：TS 有 **PipelineEngine**（阶段执行编排）、**ContainerExecutor**（容器执行）、**PipelineCheckpointManager**（断点续传）、**MultiTargetExecutor**（多目标部署）
- 蓝图 pipeline 仅为简化版（15r），**不可作为迁移参考**
- Go 迁移需从零实现上述 4 个核心组件，或使用 TS→Go 翻译策略
- Go 已有 NATS 集成（`pkg/nats/subscriber.go`），可与 TS 的 JetStream 事件消费者对接

**Saga 编排迁移**（v4 代码分析驱动）:
- TS 有完整 Saga 系统（**SagaCoordinator 432r + DeploySaga 532r + IdempotencyChecker 260r**）
- Go 平台尚无 Saga 实现
- deploy-enhanced 迁移时必须同步迁移 Saga 编排

**TS 事件系统**（v4 代码分析驱动）:
- TS 有完整事件系统（19 个文件，含 JetStream 消费者、Pipeline/Config/Deployment/Incident/SelfHealing 事件发布器）
- Go 已有 NATS 连接管理（`pkg/nats/subscriber.go`）
- 迁移策略：复用 Go NATS，移植事件类型和消费者

**幂等性设计**（算法专家评审驱动）:
- pipeline/runner/canary 等有状态模块迁移时，采用**幂等性 Key 机制**
- 请求头 `Idempotency-Key: <uuid>`，后端保证相同 Key 只处理一次
- 执行器迁移在**无运行中流水线**时进行（维护窗口），或采用状态机冻结
- TS 的 `IdempotencyChecker(260r)` 可直接作为 Go 实现的参考

### 4.5 Phase 4: 迁移 Gateway 业务逻辑 + P1 TS 模块

**目标**: 将 12 个 Gateway routes.ts 中的业务逻辑移回 Go 后端

**Gateway 路由迁移目标**（AI 专家修正）:

| 路由 | 迁移目标 | 说明 |
|------|---------|------|
| ai-models | `internal/ai/llm/` | 合入 AI 子系统，不创建独立模块 |
| ai-decisions | `internal/ai/intelligence/` | 合入 AI 子系统 |
| ai-degradation | `internal/ai/degradation/` | 合入 AI 子系统 |
| chaos | `internal/chaos-gateway/` | 新建模块，与 chaos 隔离 |
| digital-twin | `internal/digital-twin-simulation/` | 新建模块，与 digital-twin 隔离 |
| governance | `internal/governance/` | 新建模块 |
| pipeline-versions | `internal/pipeline/` | 合入 CI/CD 上下文 |
| pipeline-budget | `internal/pipeline/` | 合入 CI/CD 上下文 |
| pipeline-templates | `internal/pipeline/` | 合入 CI/CD 上下文 |
| resilience-score | `internal/resilience-score/` | 新建模块 |
| sbom | `internal/sbom/` | 新建模块 |
| tenant | `internal/tenant/` | 补充 quota/suspend/activate 端点 |

**Gateway 路由迁移切换策略**（算法专家评审修正版）：

```
Step 1 - 对齐期: 在 Go 后端实现完整端点，确保功能一致，采集 TS 性能基线
Step 2 - 只读迁移（0 数据风险）:
  - 将 GET 请求切换到 Go 后端
  - 验证 Go 读结果与 TS 本地读结果一致（diff 对比）
  - 持续运行 24h 观察
Step 3 - 写操作观察（影子模式）:
  - 写入继续走 Gateway 本地 SQL
  - 同时转发写请求到 Go 后端（忽略错误）
  - 异步对比 Go 写结果与 TS 写结果
Step 4 - 写操作切换（主备模式）:
  - 写入主路径切换到 Go 后端
  - Gateway 本地 SQL 作为备写入（shadow write）
  - 增加一致性校验定时任务，修复差异
Step 5 - 清理期:
  - 确认 Go 后端稳定运行 7 天后
  - 删除 Gateway 中的业务逻辑代码
```

**切换控制方式**:
- 使用 `ROUTE_<MODULE>_PROXY=true` 环境变量逐模块切换
- 支持热重载：修改环境变量后重启 Gateway 完成切换

**工作时间预估**（v4 修正——pipeline/saga 复杂度）:

| 模块 | 预估 | 备注 |
|------|------|------|
| ai-models/decisions/degradation | 3d | 合入 AI 子系统 |
| governance | 2d | 策略 check 逻辑 |
| pipeline 三路由 | 3d | 合入 CI/CD 上下文（Gateway 层） |
| resilience-score | 1.5d | 含评估算法 |
| sbom | 2d | 含扫描+许可证+证明+导出 |
| chaos | 2d | 新建 chaos-gateway 模块（Map 替换） |
| digital-twin | 2d | 新建 simulation 模块（Map 替换） |
| tenant | 1d | 补充 quota/suspend/activate 端点 |
| **合计** | **~16.5d** | |

**注意**: Phase 4 的 pipeline-versions/budget/templates 为 Gateway Map 数据迁移（低风险），不是 pipeline 引擎迁移。
Pipeline **引擎**迁移（PipelineEngine/ContainerExecutor/CheckpointManager/MultiTargetExecutor）在 **Phase 3** 处理，预估额外 5d。

**P1 模块**（8-14 路由）:
~50 个模块（self-service, inspection, data-pipeline, pipeline-batch, user, test-selector 等）

### 4.6 Phase 5: 剩余 TS 模块 + Gateway 瘦身

**目标**: 迁移 ~70 个 P2 小模块, Gateway 变为纯代理

**P2 模块**（<8 路由）:
~70 个小模块（cache-cleanup, do-not-disturb, pipeline-error-detail 等）

**Gateway 最终状态**:
- 移除 12 个 routes.ts 中的业务逻辑
- 保留：auth + 认证基础设施 + 中间件(7个) + 插件(6个) + 路由发现 + WebSocket + ServiceRegistry
- 总量 ~6,000 行（含测试 ~7,000 行）

### 4.7 Phase 6: 可选微服务拆分

**条件**: 基于实际流量数据（P99 延迟 > 500ms 或 QPS > 1000 触发评估）

**候选拆分**（按优先级）:
- pipeline(3002) — 高并发执行引擎
- ci-cd(3002) — 完整 CI/CD 套件
- ticket(3004) — 最大模块(82 路由)
- skill(3023) — 独立运行时扩展

**拆分流程**:
1. 确认模块通过 interface 解耦（Phase 0 已建立）
2. 提取为独立 Go 包 + main.go
3. 独立 Dockerfile + CI 构建
4. Gateway 新增独立路由配置
5. 灰度切换 7 天，验证无误后下线单体版本

---

## 5. 蓝图目录处理策略

### 5.1 分类处理

| 类别 | 数量 | 处理方式 |
|------|------|---------|
| 空壳蓝图（无业务路由） | 16 个 | 清除重复代码，保留 go.mod |
| 有业务路由的蓝图 | 17 个 | 代码合入 platform，保留 go.mod |
| 已有代码待合并子模块 | 41+ 个 | 移植到 platform/internal/ |

### 5.2 保留的蓝图目录（不删除）

```
orion-*-svc-go 目录 → 保留 go.mod, 清除 handler/service/repository 代码
                  → 在 MICROSERVICES.md 标注"已合入 platform-svc-go"
                  → 作为未来微服务拆分的编译验证单元
```

---

## 6. 验证门控（v3 增强版）

### 6.1 每个 Phase 必须通过

```bash
go build ./...                    # 编译通过
go vet ./...                      # 静态检查
golangci-lint run ./...           # 新增：完整 lint
docker build -t platform-svc-go . # 新增：Docker 构建验证
```

### 6.2 每模块迁移完成必须验证

```bash
go build ./internal/<module>/...  # 模块编译通过

# 1. 端点数量一致性（Gateway 迁移前 vs Go 迁移后）
# 2. 请求响应兼容性（相同请求得到相同响应结构）
# 3. 响应 JSON Schema 对比（TS vs Go，字段名/类型/嵌套结构一致）
# 4. 错误码兼容性（Gateway ErrorFactory vs Go 统一错误码格式）
# 5. 权限检查一致性（Gateway AuthMiddleware vs Go auth.RequirePermission）
# 6. 幂等性验证（Idempotency-Key 重复请求只处理一次）

# 端到端测试
curl http://localhost:3001/api/v1/<module>/healthz
curl http://localhost:3001/metrics  # 指标端点
```

### 6.3 数据一致性验证（v3 新增——算法专家评审驱动）

```bash
# 每个迁移模块的 Schema 一致性测试
# TS 写入一条记录（通过 Gateway 本地 SQL）
# Go 读取该记录（通过 Go repository）
# 比较所有字段值是否一致
go test ./internal/<module>/... -run TestSchemaConsistency

# 双写期一致性校验（定时任务）
# 对比 TS 直写 DB 和 Go 写入 DB 的数据
# 输出差异报告
```

### 6.4 性能验证（v3 新增）

```bash
# 迁移前 TS 基线
curl -w "@curl-format.txt" http://localhost:3001/api/v1/<module>/list

# 迁移后 Go 指标
curl http://localhost:3001/metrics | grep go_http_request_duration

# 阈值：Go 版本 P99 延迟不得超过 TS 版本的 1.2x
```

### 6.5 可观测性验证（v3 新增——DevOps 专家评审驱动）

```bash
# 日志格式一致性
curl http://localhost:3001/api/v1/<module>/healthz
# 检查日志输出: {"level":"info","ts":"...","trace_id":"...","msg":"..."}

# 追踪链路连续性
# 确认 Gateway → Go 的 trace ID 传播一致

# 指标端点
curl http://localhost:3001/metrics | grep <module>
```

### 6.6 全量回归

```bash
go build ./...
go test ./... 2>/dev/null | tail -5

# 测试覆盖率检查（每个模块迁移后覆盖率不低于 60%）
go test ./internal/<module>/... -coverprofile=coverage.out
go tool cover -func=coverage.out | tail -1
```

---

## 7. 风险与缓解（v3 增强版）

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| Gateway 业务逻辑迁移后兼容性问题 | 中 | 高 | 5 步切换（对齐→只读迁移→影子模式→主备模式→清理） |
| chaos/digital-twin 为独立产品体系 | 高 | 高 | 新建 chaos-gateway 和 digital-twin-simulation 模块 |
| 蓝图代码与 platform 代码不一致 | 高 | 中 | 以 platform 代码为准，蓝图代码适配 |
| 依赖缺失（蓝图用到的包 platform 没有） | 中 | 低 | `go mod tidy` 自动处理 |
| 迁移过程中 TS 平台仍在更新 | 高 | 中 | 锁定 TS 平台变更，只修 bug 不新增功能 |
| 蓝图代码质量参差不齐 | 中 | 低 | 每个模块移植时做 code review |
| **数据库 Schema 漂移**（v3 新增） | 中 | 高 | Phase 0.5 的 Schema 对齐 + 一致性测试 |
| **Go 循环依赖阻断编译**（v3 新增） | 中 | 高 | Phase 0 的依赖治理 DAG + CI 禁止跨上下文 import |
| **无 Dockerfile 无法部署**（v3 新增） | 高 | 高 | Phase 0 补充 Dockerfile + CI 构建 |
| **可观测性断裂**（v3 新增） | 高 | 中 | Phase 0 集成 OTel + Prometheus + 统一日志 |
| **AI 与 Python 权威服务冲突**（v3 新增） | 中 | 高 | 明确 Go AI 蓝图与 Python 服务的 API 兼容策略 |
| **回退时数据不一致**（v3 新增） | 中 | 高 | 迁移期间 Go 模块不得修改 schema，确认回退数据同步机制 |

---

## 附录 A: 4 路代码深度分析发现清单

### A.1 Go Platform 分析（`orion-platform-svc-go/internal/`）

| 编号 | 发现 | 对方案影响 |
|------|------|-----------|
| GO-01 | 51 个模块（非 46），41 个完整(80%) | 模块计数修正 |
| GO-02 | 4 个缺 handler: change/skill/sla/visor-exec | Phase 0.6 新增补全任务 |
| GO-03 | 模块间**零耦合**，无跨模块 import | 依赖治理 DAG 可简化 |
| GO-04 | 统一 **sqlx + PostgreSQL**，无 GORM/内存 | 架构一致性极好 |
| GO-05 | 仅 **7/51 模块有 migration 文件** | Phase 0.7 新增 migration 补充 |
| GO-06 | 无 OpenTelemetry/Prometheus/metrics | Phase 0 保持 OTel 集成 |
| GO-07 | Go 覆盖 TS ~23%，核心模块全缺 | 迁移工作量确认 |
| GO-08 | 响应模式统一（response_writer.go） | 迁移时无需对齐 |
| GO-09 | 认证统一（auth.RequirePermission, 4 粒度） | 迁移时无需对齐 |

### A.2 Blueprint 分析（17 个 `orion-*-svc-go/`）

| 编号 | 发现 | 对方案影响 |
|------|------|-----------|
| BP-01 | **backup(8r) 不存在**（infra-ops 13 模块中无 backup 目录） | Phase 2.7 修正 |
| BP-02 | **security(37r) = RBAC/ACL 策略管理**，非通用安全 | Phase 2.12a 描述修正 |
| BP-03 | 声明路由比实际多 15-20%（placeholder 问题） | 工作量下调 |
| BP-04 | **skill(39r)+llm(14r) 完整可用**，有 service+repo+tests | Phase 2.13 执行难度低 |
| BP-05 | ci-cd(142r) 完整但 platform 版更优（SSE 日志流/Saga） | 优先用 platform 版 |
| BP-06 | artifact 蓝图均为标准 CRUD，无增量价值 | 以平台为准 |
| BP-07 | build-env 蓝图的 cache_monitor 为独有功能 | 需吸收 |
| BP-08 | monitoring 蓝图的 RCA/关联分析/去重 为独有功能 | 需吸收 |
| BP-09 | notification(15) 和 ci-cd(13)/workflow(13) 测试最多 | 迁移优先选有测试的模块 |
| BP-10 | build-env(0) 和 identity(0) 无任何测试 | 迁移时需补测试 |

### A.3 Gateway 分析（`orion-api-gateway/src/`）

| 编号 | 发现 | 对方案影响 |
|------|------|-----------|
| GW-01 | **0 个 SQL 查询**（v3 声称有 SQL，重大修正） | Schema 对齐不适用 |
| GW-02 | **12/13 routes.ts 用 Map() 内存**，仅 tenant 用 Redis | 风险从"数据迁移"降为"功能替换" |
| GW-03 | 4 个模块与 Go 重叠: chaos/digital-twin/governance/tenant | 直接替换 |
| GW-04 | auth 中间件完整但**无细粒度权限**（所有用户可访问全部路由） | Phase 4 需补 RBAC |
| GW-05 | proxy 已实现熔断(5次)/重试(3次指数退避)/超时(30s) | Phase 6 直接复用 |
| GW-06 | 路由配置 75 条静态 + 13 本地 + 动态发现 | 灰度路由有基础 |
| GW-07 | 业务路由用 `(request as any).user?.id || 'system'` 降级 | 认证需统一 |

### A.4 TS Platform 分析（`orion-platform-service/src/`）

| 编号 | 发现 | 对方案影响 |
|------|------|-----------|
| TS-01 | 175+ 路由文件，Go 仅覆盖 ~23% | 迁移工作量确认 |
| TS-02 | 核心模块 pipeline/workflow/notification/AI 全缺 | 核心域迁移优先 |
| TS-03 | TS 与 Go 共享同一 PostgreSQL 实例 | Schema 对齐可行 |
| TS-04 | TS 有完善的 SSE 日志流 + Saga 编排 | pipeline 迁移参考 |
| TS-05 | TS 有结构化日志 + tracing + metrics | 可观测性基线 |

---

## 附录 B: 5 专家深度评审发现清单

### A.1 DDD 架构师（评分：C）

| 编号 | 问题 | 严重程度 | 修正 |
|------|------|---------|------|
| DDD-01 | 46 个模块按 TS 路由映射，缺乏领域内聚 | P0 | 合并为 10 个限界上下文（3.1 节） |
| DDD-02 | finops-v2/finops、ticketing/ticket 命名冲突 | P0 | 统一为 finops、ticket（3.3 节） |
| DDD-03 | orion-infra-ops-svc-go（176r）巨型上下文 | P1 | 拆分为 infra-compute/infra-ops/digital-twin/chaos |
| DDD-04 | Gateway 无防腐层(ACL)设计 | P1 | Gateway 显式定义 DTO 转换层 |
| DDD-05 | Phase 按路由数排序而非领域核心度 | P2 | 核心域优先（Phase 3 提前） |

### A.2 软件架构师（评分：C）

| 编号 | 问题 | 严重程度 | 修正 |
|------|------|---------|------|
| SW-01 | 缺少模块间依赖治理策略 | P0 | 定义 DAG + 禁止跨上下文 import（3.2 节） |
| SW-02 | 模块间未通过接口解耦 | P0 | Phase 0 建立 interface 契约 + DI 框架 |
| SW-03 | 验证门控仅 build+vet，严重不足 | P0 | 6.2-6.6 增强验证门控 |
| SW-04 | 缺少跨模块数据一致性方案 | P0 | 明确事务边界 + Saga 补偿接口 |
| SW-05 | Gateway 纯代理忽略 BFF 需求 | P1 | 保留 BFF 层能力（高频页面聚合端点） |
| SW-06 | 风险清单遗漏 Schema 漂移/循环依赖/TS 锁定 | P1 | 补充到第 7 节 |

### A.3 算法专家（评分：D）

| 编号 | 问题 | 严重程度 | 修正 |
|------|------|---------|------|
| ALG-01 | 数据面完全未涉及 | P0 | 新增 Phase 0.5 Schema 对齐 |
| ALG-02 | 双写一致性无设计 | P0 | 5 步切换策略（4.5 节） |
| ALG-03 | 幂等性无设计 | P0 | 幂等性 Key 机制（4.4 节） |
| ALG-04 | 无性能基线 | P1 | Phase 0 采集 TS 性能基线 |
| ALG-05 | 限流/熔断/降级无方案 | P1 | Gateway 保留通用中间件 + Go 侧 circuitbreaker |
| ALG-06 | 无零停机回退方案 | P0 | 回退契约 + Feature Flag 灰度切换 |
| ALG-07 | Phase 3 切换策略过于简单 | P0 | 拆分为 5 步（只读→影子→主备→清理） |

### A.4 DevOps 专家（评分：C）

| 编号 | 问题 | 严重程度 | 修正 |
|------|------|---------|------|
| OPS-01 | 无 Dockerfile | P0 | Phase 0 创建多阶段 Dockerfile |
| OPS-02 | 不在 CI 构建矩阵中 | P0 | Phase 0 加入 CI 矩阵 |
| OPS-03 | 健康检查过简（无依赖检查） | P0 | 实现 DB/Redis/NATS 依赖检查 |
| OPS-04 | 无 OpenTelemetry 集成 | P1 | Phase 0 集成 OTel |
| OPS-05 | 无 Prometheus `/metrics` 端点 | P1 | Phase 0 注册 /metrics |
| OPS-06 | 日志格式未统一（TS pino vs Go zap） | P1 | 统一 JSON schema |
| OPS-07 | 无迁移期间监控指标 | P1 | 双源指标对比（TS vs Go） |
| OPS-08 | 配置管理无迁移方案 | P2 | 定义配置格式转换策略 |
| OPS-09 | 回退策略缺乏可操作性 | P2 | 定义回退触发条件和流程 |
| OPS-10 | 启动顺序依赖未定义 | P2 | 明确的启动顺序图 |

### A.5 AI 专家（评分：C-）

| 编号 | 问题 | 严重程度 | 修正 |
|------|------|---------|------|
| AI-01 | AI 被当普通模块处理，缺乏架构定位 | P0 | AI 作为独立子系统（3.2 节） |
| AI-02 | Gateway 三个 AI 路由迁移方案碎片化 | P0 | 合入 AI 子系统，不创建独立模块 |
| AI-03 | 与 Python AI 权威服务关系未定义 | P0 | 增加 AI 技术选型策略说明 |
| AI-04 | aisecurity/ai-security 重叠 | P1 | 厘清边界并合并 |
| AI-05 | AI 专属 Gateway 未讨论 | P1 | 短期 AI 中间件层，长期独立 Gateway |
| AI-06 | LLM 流式响应(SSE)实现未规划 | P1 | 增加 SSE 技术设计子项 |
| AI-07 | aiagent/skill 职责边界模糊 | P2 | 区分技能目录 vs AI 技能执行 |

---

## 附录 C: 模块状态总表

### B.1 已在 Go 平台完整实现（27 个）

approval, audit, capability, chaos, code-repo, cron, dba, deploy, digital-twin, finops, handler-registry, i18n, iac, inception, incident, infrastructure, knowledge, monitoring, multi-cloud, project, security-compliance, serverless, service-registry, sprint, team, tenant, ticket

**修正**: finops-v2→finops, ticketing→ticket

### B.2 部分在 Go 平台（19 个 → 修正为 17 个）

alert, artifact, artifact-ops, build-env, chatops, cmdb, config, environment, feature-flag, federation, gateway-dynamic, internal-library, page-registry, plugin, policy, product-line, subapp, workbench

**修正**: developer-portal（52r）从"部分在 Go 平台"改为"已在 Go 平台完整实现"

### B.3 仅蓝图存在（41 个子模块 → 修正版）

abac-policy, ai-security, api-governance, capacity, change, change-request, compliance, confirmation, data-lineage, data-quality, degradation, efficiency, ephemeral-env, escalation, eventbus, finops, governance, maintenance-window, message-queue, middleware-ops, multi-modal-trigger, notification, oci-registry, oncall, pipeline-template, problem, queue, report-designer, risk, runbook, secret, security, self-healing, service-catalog, service-topology, session, skill, sso, terminal-audit, ticket-knowledge, webhook, workflow

### B.4 仅 TS 存在（102 个模块）

ai-agent, ai-cost, ai-decision, ai-gateway, ai-review, alert-breaker, api-key, api-market, apk-upload-history, apm, artifact-lifecycle, artifact-version, auth-enhanced, auth-mfa, autonomous-pipeline, backup, bi-dashboard, billing, branch-policy, cache, cache-cleanup, canary-analysis, canary-traffic, change-intelligence, channel, chaos-enhanced, ci-type, circuit-breaker, community, community-advanced, config-mgmt-enhanced, cost-allocation, cross-domain, data-pipeline, decision-explanation, dependency-coordination, deploy-enhanced, diagnostic, disaster-recovery, do-not-disturb, dual-engine, env-profile, event-trigger, event-trigger-registry, global-param, health-check, hook-chain, inspection, integration, llm-trace, lowcode, mcp, metadata, metrics, mlops, module, notification-policy, notification-template, observability, performance, pipeline-audit-log, pipeline-batch, pipeline-batch-operations, pipeline-error-detail, pipeline-execution-control, pipeline-graph, pipeline-run-history, pipeline-sse, pipeline-trend, pipeline-version, plugin-hotreload, process-step, progressive, role, scheduled-notification, script, script-library, script-version, self-service, service-health, sla, slo, sso-providers, sso-unified, supply-chain, task-timeout, test-generation, test-selector, tracing, unified-config, user, user-activity, user-profile, user-status, user-token, vector, vector-store, vectorize-rules, version-archive, visor-exec, workflow-dependency, workflow-trigger

### B.5 在 Gateway routes.ts 中（12 个）

ai-models, ai-decisions, ai-degradation, chaos, digital-twin, governance, pipeline-versions, pipeline-budget, pipeline-templates, resilience-score, sbom, tenant

---

## 附录 D: 蓝图目录清单（代码分析修正版）

### C.1 含业务路由的蓝图（17 个）

| 蓝图 | 总路由 | 子模块 |
|------|--------|--------|
| orion-ai-svc-go | 72 | aiagent, aicost, aigateway, aireview, aisecurity, intelligence, llm, skill |
| orion-artifact-svc-go | 24 | artifact, code |
| orion-build-env-svc-go | 22 | build_cache, build_env, build_logs, cache_monitor |
| orion-ci-cd-svc-go | 142 | build, canary, deploy, pipeline, pipeline-template, runner |
| orion-cmdb-svc-go | 25 | cmdb, data-lineage, data-quality, service-catalog, service-topology |
| orion-config-mgmt-svc-go | 17 | config |
| orion-event-bus-svc-go | 20 | eventbus, message-queue, multi-modal-trigger, webhook |
| orion-finops-svc-go | 30 | efficiency, finops, report-designer |
| orion-governance-svc-go | 57 | abac-policy, api-governance, audit, compliance, governance, permission-audit, policy, risk, terminal-audit |
| orion-identity-svc-go | 12 | apikey, confirmation, session, sso |
| orion-incident-svc-go | 44 | change, changeintelligence, changerequest, escalation, oncall, selfhealing |
| orion-infra-ops-svc-go | 176 | capacity, chaos, dba, degradation, digital-twin, dr, ephemeral-env, iac, middleware-ops, multicloud, oci-registry, serverless（**无 backup**）|
| orion-monitoring-svc-go | 10 | alert |
| orion-notification-svc-go | 21 | chatops, notification |
| orion-security-svc-go | 58 | ai-security, secret, security, vulnerability |
| orion-ticket-svc-go | 25 | problem, queue, runbook, ticket-knowledge, ticketing |
| orion-workflow-svc-go | 16 | approval, workflow |

### C.2 空壳蓝图（16 个）

alert-breaker, approval, audit, cache-cleanup, community, deploy, infrastructure, inspection, lowcode, mcp, monitor, pandawiki, skill-config, tenant, tool, visor

---

## 附录 D: 执行路线图总览

```
Phase 0 (基础设施先行) ───────────────────────────────── 2.5d
  ├── pkg/ 共享内核 + 接口契约
  ├── OTel + Prometheus + 统一日志
  ├── Dockerfile + CI 构建
  ├── 健康检查 + 依赖检查
  └── 性能基线采集

Phase 0.5 (DDD 梳理 + Schema 对齐) ──────────────────── 2d
  ├── 10 限界上下文重组
  ├── 通用语言统一 (finops/ticket)
  ├── AI 子系统设计
  └── Schema 一致性测试

Phase 1 (代码去重 + 模块注册) ───────────────────────── 4d
  └── 11 重复模块 + 新模块注册

Phase 2 (蓝图合并) ──────────────────────────────────── 7d
  ├── AI 子系统 (72r) - 独立路由注册器
  ├── security (37r) - 新增
  ├── governance (20r) - 拆分
  ├── ticket/notification/identity 等
  └── infra-ops (65r) - backup 不存在（代码验证）

Phase 3 (核心域 TS 迁移) ────────────────────────────── 5d
  ├── pipeline/runner/canary (76r)
  ├── sla/visor-exec/change (56r)
  ├── 幂等性 Key 机制
  └── 性能基线对比

Phase 4 (Gateway 迁移 + P1) ─────────────────────────── 16.5d
  ├── 12 Gateway 路由 5 步切换
  ├── chaos-gateway/digital-twin-simulation 新建
  └── ~50 P1 模块

Phase 5 (剩余 TS + Gateway 瘦身) ────────────────────── 10d
  └── ~70 P2 模块 + Gateway ~6K 行

Phase 6 (可选微服务拆分) ────────────────────────────── 待定
  └── pipeline/ci-cd/ticket/skill 独立部署

总计: ~47d（不含 Phase 6）
```