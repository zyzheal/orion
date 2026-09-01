# 深度评审：方案遗漏 + 系统交互问题 + 数据库类型支持现状

> 评审日期: 2026-08-29  
> 评审对象: `docs/dba-data-ai-agent-gap-analysis-2026-08-29.md`（DBA/数据/AI 缺口设计方案）  
> 评审维度: (1) 方案本身遗漏 (2) 与当前整体系统的交互问题 (3) 数据库类型支持现状  
> 评审方法: 代码级实测（grep + AST + 服务方法 + 连接管理 + 事件总线 + 权限模型）  
> 评审结论: **发现 8 项方案遗漏 + 9 项系统交互问题 + 3 项数据库支持缺口**

---

## 一、方案遗漏（8 项）

### 1.1 遗漏清单

| ID | 遗漏项 | 影响 | 原方案位置 | 补充建议 |
|----|--------|------|-----------|---------|
| GAP-1 | **审核规则引擎执行**（AuditRule 仅 CRUD 无执行） | Text2SQL 生成后无法自动审核，方案假设有引擎 | 第五章 5.3.1 | 新增 `internal/dba/advisor/audit_engine.go`，在 Text2SQL 后自动调用 |
| GAP-2 | **连接池统一管理**（DBA 自建 sql.Open 无池） | 每次 Text2SQL 执行都新建连接，性能瓶颈 | 未提及 | DBA 应复用 datasource 模块的连接池（见 2.2） |
| GAP-3 | **数据模块间零互调**（6 模块完全孤立） | 数据探查无法用 catalog 元数据、质量扫描无法触发血缘更新 | 未提及 | 需新增模块间 Service 调用（见 2.4） |
| GAP-4 | **事件总线未接入数据域**（EventBus 存在但数据模块未用） | SQL 工单执行/数据质量告警无法触发下游动作（告警/工单/通知） | 未提及 | 数据模块应发事件到 EventBus（见 2.5） |
| GAP-5 | **Saga 事务编排未覆盖数据操作** | DDL 工单/数据管道执行无分布式事务保护 | 未提及 | 高风险 SQL 执行应纳入 Saga（见 2.6） |
| GAP-6 | **密码加密不一致**（DBA 明文 *string vs datasource AES-256-GCM） | DBA 数据源密码存储安全性低于 datasource 模块 | 未提及 | 统一用 datasource 的 AES-256-GCM 加密 |
| GAP-7 | **LLM 调用成本与限流**（方案大量使用 LLM 但未设计成本控制） | Text2SQL/BI 生成/根因分析全用 LLM，无预算控制会爆炸 | 第五章未提 | 复用 `tokenbucket` + `llm-trace` 计费 |
| GAP-8 | **Schema 变更与 CMDB 联动**（数据库也是 CI 资产） | DDL 工单未同步到 CMDB 资产变更 | 未提及 | DBA 工单执行后发事件给 CMDB |

### 1.2 最严重遗漏：GAP-1 审核规则引擎

原方案 5.3.1 设计 `internal/dba/advisor/text2sql.go` 生成 SQL 后直接执行，但**实测 DBA 的 AuditRule 仅有 CRUD，无执行引擎**：

```
internal/dba/service/service.go 中 AuditRule 相关方法：
  CreateAuditRule   ✅ (仅 CRUD)
  ListAuditRules    ✅ (仅 CRUD)
  UpdateAuditRule   ✅ (仅 CRUD)
  // ❌ 无 ExecuteAudit / CheckRule / Evaluate
```

对比 `internal/data-quality/engine/evaluator.go`（490 行）有完整 6 种规则执行器（Threshold/Range/Pattern/Null/Uniqueness/Referential），DBA 的 AuditRule 是**纯数据存储**。

**修正方案**：Text2SQL 生成 SQL 后，必须先经过 AuditEngine 审核：
```
Text2SQL → 生成 SQL → AuditEngine.Check(sql, rules[]) → 风险评分 →
  低风险 → 可执行
  高风险 → 标记 + 建议 → 人工审批
```

---

## 二、与当前整体系统的交互问题（9 项）

### 2.1 问题清单

| ID | 交互问题 | 实测证据 | 严重度 |
|----|---------|---------|--------|
| IX-1 | **DBA 与 datasource 模块重复实现数据源** | dba/models 有 DataSource，datasource/models 也有 DataSource，两套独立 | 🔴 高 |
| IX-2 | **DBA 连接管理不复用 datasource 池** | `executePGQuery` 每次新建连接无池，datasource 有完整连接池 + AES 加密 | 🔴 高 |
| IX-3 | **6 个数据模块完全孤立零互调** | grep 实测 dba/data-catalog/data-quality/data-lineage/data-pipeline/bi-dashboard 彼此无 import | 🔴 高 |
| IX-4 | **assistant 未接入任何数据模块** | 实测 assistant 仅调 knowledge + pipeline，0 个数据模块 | 🔴 高（已在原方案提及） |
| IX-5 | **数据模块未发事件到 EventBus** | EventBus 存在（eventbus 模块），但 dba/data-quality/data-pipeline 无 Publish 调用 | 🟡 中 |
| IX-6 | **数据质量告警未接入 alert-pipeline** | data-quality 有 Alert 模型，但未发到 alert-pipeline/eventbus | 🟡 中 |
| IX-7 | **数据管道未接入 pipeline-engine** | data-pipeline 有 Run/Pause，但与主 pipeline-engine/Saga 独立 | 🟡 中 |
| IX-8 | **密码加密不一致**（DBA 明文 vs datasource AES） | dba `Password *string`，datasource `PasswordEnc + AES-256-GCM` | 🔴 高 |
| IX-9 | **血缘未与 CMDB 联动** | data-lineage 手工管理，CMDB 有数据库资产但无关联 | 🟡 中 |

### 2.2 IX-1 + IX-2 详解：数据源管理分裂

**现状**（代码实测）：

```
internal/dba/models/models.go:        DataSource{ Password *string }   // 明文
internal/datasource/models/models.go: DataSource{ PasswordEnc string }  // AES-256-GCM

internal/dba/service/service.go:440   sql.Open("postgres", dsn)          // 无连接池
internal/datasource/service/service.go:96   sync.RWMutex + 连接池缓存    // 有池
```

**问题**：
- 同一个用户管理的数据库，在 DBA 模块和 datasource 模块是**两套独立的数据源记录**
- DBA 的 `executePGQuery` 每次查询都 `sql.Open` 新建连接 + `SetMaxOpenConns(1)`，**无连接复用**
- DBA 密码明文存储，datasource 有 AES-256-GCM 加密
- 用户在 DBA 工作台添加的数据源，在数据工程工作台看不到（反之亦然）

**修正方案**：
- DBA 模块移除自有的 DataSource 模型，**复用 datasource 模块**
- `executePGQuery` 改为调用 `datasource.Service.GetConnection(id)`
- 密码加密统一用 datasource 的 AES-256-GCM

### 2.3 IX-3 详解：6 模块孤立

```
实测 import 关系（grep internal/）:
  dba → 只 import 自己
  data-catalog → 只 import 自己
  data-quality → 只 import 自己
  data-lineage → 只 import 自己
  data-pipeline → 只 import 自己
  bi-dashboard → 只 import 自己
```

**后果**：
- 数据探查无法用 catalog 的 schema 元数据（要重新查 information_schema）
- 质量扫描发现异常无法触发血缘标记
- BI 仪表盘无法用 catalog 的表/列信息
- 血缘变更无法通知 data-quality 重算规则

**修正方案**：建立模块间 Service 调用（通过接口注入，不直接 import）：

```
data-catalog.Service  ←  data-quality.Service (查询表结构)
data-catalog.Service  ←  bi-dashboard.Service (查询表/列)
data-quality.Service  →  data-lineage.Service (标记问题节点)
data-pipeline.Service →  data-lineage.Service (写入血缘)
dba.Service           →  data-quality.Service (SQL 质量检查)
```

### 2.4 IX-5 + IX-6 详解：事件链路断裂

**现状**：EventBus 模块存在（`internal/eventbus/`），但数据模块完全不发事件：

```
grep "Publish\|EventBus" internal/dba/ internal/data-quality/ internal/data-pipeline/ → 0 结果
```

**应该有的事件链路**（当前全部断裂）：

```
DBA SQL 工单执行 → [事件: sql.executed] →
  ├── alert-pipeline (触发慢 SQL 告警)
  ├── CMDB (数据库资产变更)
  ├── audit-log (操作审计)
  └── assistant (通知 DBA Copilot)

数据质量扫描 → [事件: quality.alert] →
  ├── alert-pipeline (触发数据质量告警)
  ├── data-lineage (标记问题节点)
  └── assistant (通知数据治理员)

数据管道执行完成 → [事件: pipeline.completed] →
  ├── data-lineage (更新血缘)
  ├── data-quality (触发质量扫描)
  └── bi-dashboard (刷新报表缓存)
```

### 2.5 IX-7 详解：两套 pipeline 系统

- `internal/pipeline-engine/` — 主 Pipeline 引擎（PipelineEngine → StageExecutor → TaskRunner + Saga）
- `internal/data-pipeline/` — 数据管道（独立 Run/Pause/Resume，无 DAG 无 Saga）

**问题**：数据管道的执行不纳入主引擎的 Saga 事务保护，失败无法回滚。

---

## 三、数据库类型支持现状（回答用户问题）

### 3.1 实测支持的数据库类型

| 模块 | 支持类型 | 实测证据 | 问题 |
|------|---------|---------|------|
| **datasource**（统一数据源管理） | PostgreSQL ✅ / MySQL ✅ / ClickHouse ✅ / Elasticsearch ✅ / MongoDB ✅ | `models.go:9-13` DataSourceType 枚举 | 最全，5 种 |
| **data-catalog introspector**（schema 发现） | PostgreSQL ✅ / MySQL ✅ / SQLite ✅ | `introspector.go:35-40` drivers map | 仅 3 种 |
| **DBA ExecuteDirectQuery**（SQL 执行） | **仅 PostgreSQL** ❌ | `service.go:246` 硬编码 `if sourceType != "postgresql"` | 最受限 |
| **DBA TestConnection** | **仅 PostgreSQL** ❌ | `service.go:436` `testPGConnection` 硬编码 postgres | 最受限 |
| **database-devops**（备份恢复） | 未明确，需验证 | - | 待验证 |
| **orion-dba 插件**（Yearning fork） | MySQL 为主 | Yearning 原生 MySQL | 与主服务不一致 |

### 3.2 数据库类型支持矩阵

```
                PG    MySQL   ClickHouse   ES    MongoDB   SQLite   Oracle   SQLServer
datasource      ✅     ✅        ✅         ✅      ✅        -        -        -
data-catalog    ✅     ✅        -          -      -        ✅        -        -
DBA 执行        ✅     ❌        ❌         ❌     ❌        ❌        ❌        ❌
DBA 测试        ✅     ❌        ❌         ❌     ❌        ❌        ❌        ❌
```

### 3.3 关键问题

1. **DBA 模块仅支持 PostgreSQL**：`ExecuteDirectQuery` 和 `TestConnection` 硬编码 `postgres` driver，MySQL/ClickHouse/ES/MongoDB 数据源在 DBA 工作台无法执行 SQL
2. **三模块支持类型不一致**：datasource 支持 5 种，data-catalog 支持 3 种，DBA 仅 1 种
3. **orion-dba 插件以 MySQL 为主**（Yearning 原生），与主服务 DBA 的 PostgreSQL 优先相反
4. **缺少 Oracle / SQL Server / OceanBase / openGauss**：企业级 DBA 平台通常需要支持

### 3.4 修正建议

统一数据库类型支持，分层实现：

```
Layer 1: datasource 模块（连接管理）—— 已支持 5 种，扩展至 8 种
  补充: Oracle / SQL Server / OceanBase

Layer 2: DBA 模块（SQL 执行）—— 通过 datasource 获取连接，不再硬编码
  复用 datasource.Service.GetConnection(id) → 任何支持的类型都可执行

Layer 3: data-catalog（schema 发现）—— 扩展 introspector
  补充: ClickHouse / Oracle / SQL Server

Layer 4: AI Advisor —— 适配不同方言的 Prompt
  PostgreSQL/MySQL/Oracle/... 的 SQL 语法差异需在 Prompt 中处理
```

---

## 四、修正后的架构设计

### 4.1 修正要点

原方案需补充以下设计：

1. **统一数据源管理**：DBA 移除自有 DataSource，复用 datasource 模块（解决 IX-1/IX-2/IX-8）
2. **审核规则引擎**：新增 `AuditEngine`，Text2SQL 后自动审核（解决 GAP-1）
3. **模块间调用接口**：定义跨模块 Service 接口，通过 wiring 注入（解决 IX-3）
4. **事件总线接入**：数据模块发事件到 EventBus（解决 IX-5/IX-6）
5. **Saga 事务保护**：高风险 SQL/数据管道纳入 Saga（解决 GAP-5/IX-7）
6. **多数据库类型支持**：DBA 通过 datasource 获取连接，不硬编码（解决 3.3）
7. **LLM 成本控制**：复用 tokenbucket + llm-trace（解决 GAP-7）
8. **CMDB 联动**：DDL 执行后发事件给 CMDB（解决 GAP-8/IX-9）

### 4.2 修正后的架构图

```
┌──────────────────────────────────────────────────────────────────────┐
│  前端工作台（第九章）                                                  │
│  /dba-workbench  +  /data-workbench                                  │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  assistant（扩展 SourceProvider + ActionExecutor）                    │
│  + DBAProvider + CatalogProvider + QualityProvider + LineageProvider │
│  + ActionGenerateSQL/RunSQLAudit/GenerateBI/RunQualityScan          │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ 调用
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  AI 能力层（第五章）                                                   │
│  dba/advisor/ (Text2SQL + SQLAdvisor + IndexAdvisor + AuditEngine)   │
│  data-catalog/profiler/ (AI Profile)                                  │
│  data-quality/agent/ (异常检测)                                       │
│  data-lineage/parser/ (血缘自动采集)                                  │
│  bi-dashboard/agent/ (NL→BI)                                          │
│  ┌──────────────────────────────────────────────────────────┐        │
│  │  LLM Provider (复用) + tokenbucket 限流 + llm-trace 计费  │ GAP-7 │
│  └──────────────────────────────────────────────────────────┘        │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ 调用
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  数据模块层（统一数据源 + 模块间接口 + 事件总线 + Saga）              │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────┐         │
│  │  datasource.Service (唯一数据源管理) 🆕 统一             │ IX-1  │
│  │  - AES-256-GCM 加密                                      │ IX-8  │
│  │  - 连接池缓存 (sync.RWMutex)                             │ IX-2  │
│  │  - 支持 PG/MySQL/ClickHouse/ES/Mongo + Oracle/MSSQL 🆕   │ 3.4  │
│  └──────────────────┬──────────────────────────────────────┘        │
│                     │ GetConnection(id)                              │
│     ┌───────────────┼───────────────┐                               │
│     ▼               ▼               ▼                               │
│  dba.Service    data-catalog    data-quality                         │
│  (复用连接)     .Service        .Service                             │
│     │               │               │                                 │
│     │  ← 接口注入 → │ ← 接口注入 → │  IX-3                          │
│     │               │               │                                 │
│     ▼               ▼               ▼                               │
│  ┌──────────────────────────────────────────────────┐               │
│  │  EventBus 🆕 接入                                  │ IX-5/IX-6   │
│  │  事件: sql.executed / quality.alert /             │               │
│  │        pipeline.completed / schema.changed         │               │
│  └──────────────────┬───────────────────────────────┘               │
│                     │                                                │
│     ┌───────────────┼───────────────┐                               │
│     ▼               ▼               ▼                               │
│  alert-pipeline  CMDB          audit-log                            │
│  (告警联动)      (资产变更)     (操作审计)    IX-9/GAP-8             │
│                                                                      │
│  ┌──────────────────────────────────────────────────┐               │
│  │  Saga 🆕 接入 (高风险 SQL / 数据管道)             │ GAP-5/IX-7  │
│  └──────────────────────────────────────────────────┘               │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.3 修正后的实施路线图

在原第六章路线图基础上，新增以下前置任务（Phase 0）：

#### Phase 0 — 架构统一（前置，1.5 周）

| # | 任务 | 解决问题 | 工作量 |
|---|------|---------|--------|
| 0.1 | DBA 移除自有 DataSource，复用 datasource 模块 | IX-1/IX-2/IX-8 | 2d |
| 0.2 | DBA ExecuteDirectQuery 改用 datasource.GetConnection | IX-2 + 3.3 | 1d |
| 0.3 | datasource 扩展 Oracle/SQL Server 驱动 | 3.4 | 2d |
| 0.4 | data-catalog introspector 扩展 ClickHouse/Oracle | 3.4 | 1d |
| 0.5 | 数据模块间 Service 接口定义 + wiring 注入 | IX-3 | 2d |
| 0.6 | 数据模块发事件到 EventBus（4 类事件） | IX-5/IX-6 | 2d |
| 0.7 | 高风险 SQL 执行纳入 Saga | GAP-5 | 2d |
| 0.8 | LLM 调用接入 tokenbucket + llm-trace | GAP-7 | 1d |

**Phase 0 合计**: 13 人天，是原路线图（35 人天）的前置依赖。

### 4.4 修正后的缺口优先级

| 优先级 | 数量 | 项目 |
|--------|------|------|
| **Phase 0（新增前置）** | 8 项 | 架构统一（数据源/连接/事件/Saga/成本） |
| P0（原方案） | 17 项 | DBA/DM/AI 能力 + 前端工作台 |
| P1（原方案） | 10 项 | 深度能力 |
| **合计** | **35 项** | Phase 0 + P0 + P1 |

**修正后总工作量**: 13（Phase 0）+ 35（原方案）+ 19（前端工作台）= **67 人天**（约 9.5 周，2-3 人并行）

---

## 五、验收标准补充

在原第七章验收标准基础上，新增以下技术验收：

| 维度 | 标准 | 验证方法 |
|------|------|---------|
| 数据源统一 | DBA 不再有自有 DataSource 模型 | grep `DataSource struct` 仅在 datasource/models |
| 连接池复用 | DBA 不再 sql.Open | grep `sql.Open` 在 dba/service 为 0 |
| 密码加密统一 | DBA 用 AES-256-GCM | grep `PasswordEnc` 在 dba/models |
| 数据库类型 | DBA 执行支持 ≥5 种 | ExecuteDirectQuery 不硬编码 postgres |
| 模块间调用 | ≥4 个跨模块 Service 调用 | grep import 关系 |
| 事件总线 | 数据模块 ≥4 类事件 | grep `Publish` 在 dba/data-quality/data-pipeline |
| Saga 覆盖 | 高风险 SQL 执行有 Saga | grep `Saga` 在 dba/service |
| LLM 成本 | 有 tokenbucket 限流 | grep `tokenbucket` 在 advisor/agent |

---

## 六、总结

### 6.1 深度评审结论

本次深度评审发现原方案有 **8 项遗漏 + 9 项系统交互问题 + 3 项数据库支持缺口**，核心问题：

1. **数据源管理分裂**（DBA vs datasource 两套独立）—— 最严重，必须 Phase 0 解决
2. **6 个数据模块完全孤立**（零互调）—— 需定义模块间接口
3. **事件链路断裂**（EventBus 存在但数据模块不用）—— 需接入事件总线
4. **DBA 仅支持 PostgreSQL**（硬编码）—— 需通过 datasource 统一支持多类型
5. **审核规则无引擎**（AuditRule 仅 CRUD）—— Text2SQL 后无法自动审核
6. **密码加密不一致**（DBA 明文 vs datasource AES）—— 安全风险

### 6.2 修正后的完整路线图

```
Phase 0 — 架构统一 (13d)
  数据源统一 + 连接池复用 + 模块间接口 + 事件总线 + Saga + LLM 成本

Phase 1 — DBA AI 基础 (10d)    [原第五章]
  Text2SQL + SQLAdvisor + IndexAdvisor + Explain + 慢SQL + AuditEngine

Phase 2 — 数据挖掘 AI (10d)    [原第五章]
  Profiler + 血缘采集 + 质量引擎 + NL→BI

Phase 3 — 多 Agent 编排 (8d)   [原第五章]
  根因分析 + 异常检测 + 血缘影响 + 自动审批

Phase 4 — 深度能力 (8d)        [原第五章]
  容量规划 + ETL DAG + 脱敏联动 + 特征工程

UI-Phase 1-6 — 前端工作台 (19d) [原第九章]
  dba-workbench + data-workbench + 7 API 客户端 + 11 新页面

合计: 67-68 人天 (约 9.5 周, 2-3 人并行)
```

### 6.3 数据库类型支持回答

**当前系统支持的数据库类型**：
- **datasource 模块**（统一数据源管理）：PostgreSQL / MySQL / ClickHouse / Elasticsearch / MongoDB（5 种）
- **data-catalog introspector**（schema 发现）：PostgreSQL / MySQL / SQLite（3 种）
- **DBA 模块**（SQL 执行）：**仅 PostgreSQL**（硬编码，最受限）
- **缺失**：Oracle / SQL Server / OceanBase / openGauss / TiDB

**修正目标**：通过 datasource 统一连接管理，DBA 支持全部 ≥5 种 + 扩展 Oracle/SQL Server。

---

> 文档结束。本文档为对 `dba-data-ai-agent-gap-analysis-2026-08-29.md` 的深度评审补充，发现 8 项方案遗漏 + 9 项系统交互问题 + 3 项数据库支持缺口，并给出修正架构与 Phase 0 前置路线图。两份文档配套使用。
