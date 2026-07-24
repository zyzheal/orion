# Orion 实施计划 — 2026-07-24

> 分支: feat/wave2-parallel-execution | 版本: v1.0
> 目标：将 blueprints 功能全部合并到 orion-platform-svc-go 单体应用，并借鉴 NeatLogic 功能

---

## 一、实施总览

### 1.1 三大任务

| 任务 | 状态 | Agent |
|------|------|-------|
| **Task 1**: blueprints → platform-svc-go 合并（13 完整域 + 11 空壳）| 🔄 进行中 | 6 个合并 Agent + 11 空壳待启动 |
| **Task 2**: NeatLogic 功能借鉴到项目计划 | 🔄 进行中 | Batch 1（5 个开发 Agent）|
| **Task 3**: P0 缺陷修复 | 🔄 进行中 | identity 测试待完成 |

### 1.2 架构决策

**决策 1**：blueprints 功能全部合并到 `orion-platform-svc-go` 单体应用，不再维护独立微服务蓝图。

理由：
- 当前生产部署是 `orion-platform-svc-go` 单体（1775 Go 文件）
- 13 个完整 Go 服务在 blueprints 中比 platform-svc-go 更完整
- 减少维护负担，避免代码重复
- 独立微服务拆分可在未来按需抽取

**决策 2**：删除 `workflow-svc-go` 的 ticket 子域（56 文件），与 `ticket-svc-go` 100% 重复。

---

## 二、Task 1: blueprints → platform-svc-go 合并

### 2.1 13 个完整域合并（用 blueprints 替换 platform-svc-go）

| # | 域 | blueprints | platform-svc-go | 合并方式 | 状态 |
|---|----|-----------|----------------|---------|------|
| 1 | CI-CD | 122 Go | 55 Go | 替换 | 🔄 Agent `a898c7c0` |
| 2 | Notification | 115 Go | 46 Go | 替换 | 🔄 Agent `ae522bd2` |
| 3 | Workflow | 57 Go | 43 Go | 替换 | 🔄 Agent `a8c28458` |
| 4 | Ticket | 98 Go | 43 Go | 合并 | 🔄 Agent `a8c28458` |
| 5 | InfraOps | 97 Go | 61 Go | 替换 | 🔄 Agent `acc8cb36` |
| 6 | AI | 95 Go | 76 Go | 替换 | 🔄 Agent `a347d9cd` |
| 7 | Identity | 73 Go | 58 Go | 替换 | 🔄 Agent `a8c28458` |
| 8 | FinOps | 71 Go | 44 Go | 替换 | 🔄 Agent `adda8f3f` |
| 9 | Governance | 68 Go | 41 Go | 替换 | 🔄 Agent `adda8f3f` |
| 10 | ConfigMgmt | 67 Go | 43 Go | 替换 | 🔄 Agent `acc8cb36` |
| 11 | Security | 62 Go | 35 Go | 替换 | 🔄 Agent `adda8f3f` |
| 12 | Monitor | 50 Go | 23 Go | 替换 | 🔄 Agent `acc8cb36` |
| 13 | EventBus | 46 Go | 40 Go | 替换 | 🔄 Agent `a8c28458` |

**合并后预期**：platform-svc-go 从 1775 Go 文件增至约 **2300 Go 文件**（+525 增量）。

### 2.2 11 个空壳服务合并（需补全后合并）

| # | 域 | TS 源 | 工作量 | 优先级 | 前置条件 |
|---|----|-------|-------|--------|---------|
| 1 | approval | 20 TS | 5-7 天 | P2 | go-common 完成 |
| 2 | artifact | 24 TS | 8-10 天 | P2 | go-common 完成 |
| 3 | dba | 11 TS | 3-5 天 | P2 | go-common 完成 |
| 4 | deploy | 27 TS | 8-10 天 | P2 | go-common 完成 |
| 5 | digital-twin | 8 TS | 10-12 天 | P2 | go-common 完成 |
| 6 | dr | 24 TS | 7-9 天 | P2 | go-common 完成 |
| 7 | efficiency | 22 TS | 5-7 天 | P2 | go-common 完成 |
| 8 | federation | 22 TS | 10-12 天 | P2 | go-common 完成 |
| 9 | knowledge | 15 TS | 3-5 天 | P2 | go-common 完成 |
| 10 | plugin | 27 TS | 7-9 天 | P2 | go-common 完成 |
| 11 | risk | 10 TS | 10-12 天 | P2 | go-common 完成 |

**总工作量**：51-74 人天，并行路径约 10-12 天。

### 2.3 合并操作步骤

```
Phase 1 (并行, 6 Agent):
  ├── Agent 1: CI-CD 域合并 → 15 子域到 internal/
  ├── Agent 2: Notification 域合并 → 8 子域
  ├── Agent 3: AI 域合并 → 19 子域
  ├── Agent 4: FinOps/Governance/Security → 替换
  ├── Agent 5: Workflow/Ticket/Identity/EventBus → 合并
  └── Agent 6: InfraOps/ConfigMgmt/Monitor → 替换

Phase 2 (串行, 需等 Phase 1):
  ├── 修复所有 import 路径冲突
  ├── 合并 migrations/ 到 platform-svc-go/migrations/
  ├── 更新 cmd/server/wiring.go 注册所有新子域
  ├── 更新 go.mod 依赖
  └── go build 全量验证

Phase 3 (并行, 11 空壳):
  ├── 等 go-common 完成后
  ├── 按复杂度分批启动（简单→复杂）
  └── 每个服务独立 Agent
```

---

## 三、Task 2: NeatLogic 功能借鉴

### 3.1 借鉴来源

`reports/neatlogic-benchmark-analysis-2026-07-22.md`（2589 行，16 个模块源码分析）

### 3.2 高优先级借鉴功能（P0/P1）

| # | 借鉴点 | NeatLogic 做法 | Orion 落地方案 | 优先级 | Agent |
|---|--------|---------------|---------------|--------|-------|
| 1 | **自动化执行引擎** | Java 编排 + Python/Perl 执行 + 280 插件 | 统一 `Executor` 接口 + 插件 SPI + `ExecutorFactory` | **P0** | Batch 2 |
| 2 | **统一通知引擎** | `NotifyPolicyHandlerFactory` + 工厂模式 | 提取 `notification` 域为 `NotifyHandlerFactory` + `sync.Map` + `init()` 注册 | P1 | ✅ `a259b5c2` |
| 3 | **CMDB 采集适配器** | 120+ 厂商适配器 | 设计采集适配器 SPI (`Collector` 接口)，首批覆盖网络 (Cisco/Huawei/H3C) + 数据库 (MySQL/Oracle/PG) | P1 | 🔄 `a9b0f83c` |
| 4 | **全局搜索** | `GlobalSearchManager` + 6 模块索引 | ES 集成 + `SearchIndexer` 接口 + 多模块索引统一入口 | P1 | Batch 2 |
| 5 | **数据库迁移规范** | changelog + version.json | 完善 Flyway 规范：时间戳排序 + version 追踪 + 回滚支持 | P1 | Batch 2 |
| 6 | **流程引擎执行层** | 步骤处理器工厂 + SLA | 补全 process/processtask 的执行逻辑：`StepHandler` 接口 + `StepHandlerFactory` + SLA 计算器 | P1 | ✅ `a1dcc406` |

### 3.3 中优先级借鉴功能（P2）

| # | 借鉴点 | NeatLogic 做法 | Orion 落地方案 | 优先级 |
|---|--------|---------------|---------------|--------|
| 7 | **动态表单引擎** | FormVo + FormAttributeVo + 数据转换 | 设计 `Form` struct + `FormField` + 表单渲染引擎 | P2 | ✅ `a71f983b` |
| 8 | **条件引擎** | `IConditionHandler` + ConditionGroup | 条件表达式引擎 (Aviator/Go expression) | P2 | ✅ `a309b644` |
| 9 | **图可视化** | GraphViz.Builder + 模板系统 | 集成 graphviz Go 库 + 图模板 + 自动填充 | P2 | Batch 3 |
| 10 | **全文索引工厂** | `FullTextIndexHandlerFactory` | 多模块索引抽象 (`Indexer` 接口) + ES 统一入口 | P2 | Batch 3 |
| 11 | **导入导出工厂** | `ImportExportHandlerFactory` | 统一导入导出框架 (`Importer`/`Exporter` 接口) | P2 | Batch 3 |
| 12 | **SQL 动态生成** | `$sql` + ExpressionVo | Go SQL 构建器 (参考 squirrel) | P2 | Batch 3 |

### 3.4 低优先级借鉴功能（P3）

| # | 借鉴点 | 说明 |
|---|--------|------|
| 13 | **LCS 基线管理** | 基线变更追踪 |
| 14 | **数据仓库抽象** | DataSource 抽象层 |
| 15 | **Agent 管理** | tagent 注册/升级/心跳 |

### 3.5 借鉴开发计划

```
Batch 1 (已完成/进行中, 5 Agent, 35-48 人天):
  ✅ Agent-1: 统一通知引擎 (NotifyHandlerFactory + 多渠道 SPI)
  🔄 Agent-2: CMDB 采集适配器 (Collector SPI + 厂商适配器)
  ✅ Agent-3: 流程引擎执行层 (StepHandler + SLA)
  ✅ Agent-4: 动态表单引擎 (Form + FormField + 渲染)
  ✅ Agent-5: 条件表达式引擎 (16 种运算符 + Function SPI, 39 测试)

Batch 2 (需等 Batch 1, 3 Agent, 27-38 人天):
  ├── Agent-6: 自动化执行引擎 (Executor + Plugin SPI) — P0 核心
  ├── Agent-7: 全局搜索 (ES + SearchIndexer)
  └── Agent-8: 数据库迁移规范 (Flyway 完善)

Batch 3 (最后, 2 Agent, 11-15 人天):
  ├── Agent-9: 图可视化 (GraphViz + 模板)
  └── Agent-10: 全文索引工厂 (Indexer 接口)
```

---

## 四、Task 3: P0 缺陷修复

| # | 问题 | 状态 | Commit |
|---|------|------|--------|
| 1 | Skill 双重实现（Map→Repository）| ✅ 已完成 | 4 文件，27+7 测试 |
| 2 | Self-Healing wiring 未注册 | ✅ 已完成 | wiring.go 三处添加 |
| 3 | 模块路径编译失败 | ✅ 已完成 | `61a27f231` |
| 4 | identity 无 RunMigrations + 0 测试 | 🔄 进行中 | — |
| 5 | infra-ops 无迁移 + 直连 postgres | ✅ 已完成 | 改用 go-common |
| 6 | workflow ticket 重复域删除 | ✅ 已完成 | 56 .go + 1 migration |
| 7 | 6 个服务缺 Dockerfile | ✅ 已完成 | `7f2b4fdfa` |

---

## 五、时间线

```
Week 1 (2026-07-24 → 2026-07-30):
  ├── Task 1 Phase 1: 13 个完整域合并 → 6 Agent 并行 (3-4 天)
  ├── Task 1 Phase 2: import/migration/wiring 修复 (1 天)
  ├── Task 2 Batch 1: 已完成的 4 个借鉴功能集成 (并行)
  └── Task 3: identity 测试完成 (1 天)

Week 2 (2026-07-31 → 2026-08-06):
  ├── Task 1 Phase 3: 11 个空壳服务 (51-74 人天, 并行 10-12 天)
  └── Task 2 Batch 2: 自动化执行引擎 + 全局搜索 + 迁移规范 (并行)

Week 3 (2026-08-07 → 2026-08-13):
  └── Task 2 Batch 3: 图可视化 + 全文索引工厂 (并行)

Week 4 (2026-08-14 → 2026-08-20):
  └── 全量验证 + 回归测试 + go build 全量通过
```

---

## 六、风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| go-common 库构建失败 | 11 个空壳无法启动 | 已发现根目录 `orion-go-common` 已存在，修复 messaging 错误即可 |
| import 路径冲突（blueprints vs platform）| 编译失败 | 统一使用 `orion/platform-svc-go/` 作为 module 路径 |
| migration 文件重复（多服务连接同一 DB）| 表结构冲突 | 已删除 workflow ticket 重复 migration |
| Agent 并行冲突（同一文件被修改）| 代码丢失 | 合并 Agent 各自负责独立子域，不交叉 |

---

## 七、成功标准

1. `orion-platform-svc-go` 包含所有 blueprints 功能（2300+ Go 文件）
2. `go build ./...` 全量通过
3. 所有 migration 可执行，无重复表结构
4. NeatLogic P0/P1 功能全部落地（自动化引擎、通知、CMDB 采集、全局搜索、流程引擎）
5. 所有 P0 缺陷修复完成
6. blueprints/ 目录归档（合并完成后移至 `legacy/` 或添加 `.archived` 后缀）

---

_维护者：Orion 架构团队 | 最后更新：2026-07-24_
