# 数据平台模块深度分析报告

**生成日期**: 2026-07-02
**分析模块**: `orion-platform-service/src/services/data-pipeline/`、`vector-store/`、`dba/`、`finops/`

---

## 模块概览

Orion 平台的数据平台模块包含 4 大子模块：DataPipeline（数据管道）、VectorStore（向量存储）、DBA（数据库管理）、FinOps（成本运营）。全部采用 PostgreSQL Repository 持久化，但存在部分功能模拟实现和内存 Map 降级残留。

| 模块 | 路径 | 文件数 | 完成度 |
|------|------|--------|--------|
| **DataPipeline** | `src/services/data-pipeline/` | 5 + 3 tests | 70% |
| **VectorStore** | `src/services/vector-store/` | 3 + 2 tests | 40% |
| **DBA** | `src/services/dba/` | 3 + 1 test | 85% |
| **FinOps** | `src/services/finops/` | 14 + 13 tests | 90% |

---

## 架构设计

### DataPipeline（数据管道）

**分层架构**：
```
API Routes (data-pipeline-routes.ts)
    ↓
Controller (DataPipelineController)
    ↓
Service (DataPipelineService)
    ↓
Repository (DataPipelineRepository + PipelineExecutionRepository)
    ↓
PostgreSQL (data_pipelines, pipeline_executions, stage_results)
```

**关键问题**：
- `listPipelines()` 在 DB 模式下返回空数组（注释："full async impl needs separate query"）
- `getExecutions()` 在 DB 模式下返回空数组
- `updatePipeline()` 未使用 Repository，仅更新内存 Map
- `schedulePipeline/unschedulePipeline` 在 DB 模式下为 no-op

### VectorStore（向量存储）

**分层架构**：
```
VectorStoreService
    ├── VectorizeRuleRepository (vectorize_rules)
    └── VectorCollectionRepository (vector_collections)
```

**关键问题**：仅管理向量化规则和集合配置，**无实际向量搜索能力**（无向量插入、相似性查询、Embedding 模型调用、索引管理）。

### DBA（数据库管理）

**分层架构**：
```
dba-routes.ts
    ↓
DbaService
    ├── SqlOrderRepository (dba_sql_orders)
    ├── DataSourceRepository (dba_data_sources)
    └── AuditRuleRepository (dba_audit_rules)
```

**关键问题**：
- `/dba/query` 直接查询返回 mock 数据（注释："implement with actual DB connection"）
- 连接测试仅更新状态，无实际连接测试
- SQL 审计规则未实际执行

### FinOps（成本运营）

**分层架构**：
```
finops-v2-routes.ts
    ↓
FinOpsV2Controller
    ↓
FinOpsService
    ↓
FinOpsRepository
    ↓
PostgreSQL (finops_* 系列表)
```

**关键问题**：
- 双路由层（`finops-routes.ts` legacy + `finops-v2-routes.ts` 完整）
- 3 个 501 端点未实现（deleteBudgetGuard、applyOptimization、rejectOptimization）
- 成本总览硬编码返回 0

---

## 功能完整性评估

### DataPipeline

| 功能域 | 功能点 | 实现状态 | 备注 |
|--------|--------|----------|------|
| CRUD | 创建管道 | ✅ | 内存/DB 双模式 |
| CRUD | 查看管道 | ⚠️ | DB 模式 listPipelines 返回空 |
| CRUD | 更新管道 | ⚠️ | 仅内存模式，DB 模式未实现 |
| CRUD | 删除管道 | ✅ | 内存模式 |
| 执行 | 同步执行 | ✅ | 模拟 stage 执行 |
| 执行 | 异步执行 | ❌ | 无后台执行引擎 |
| 执行 | 状态追踪 | ⚠️ | DB 模式 getExecutions 返回空 |
| 调度 | Cron 调度 | ⚠️ | 内存模式有 timer，DB 模式 no-op |
| 血缘 | 静态血缘 | ✅ | 基于 stage 依赖生成 |
| 血缘 | 动态血缘 | ❌ | 无实际数据血缘追踪 |

### VectorStore

| 功能域 | 功能点 | 实现状态 | 备注 |
|--------|--------|----------|------|
| 向量化规则 | CRUD | ✅ | 元数据管理完整 |
| 集合管理 | CRUD | ✅ | 元数据管理完整 |
| 向量搜索 | 相似性搜索 | ❌ | **完全缺失** |
| 向量搜索 | ANN 查询 | ❌ | **完全缺失** |
| 文档管理 | 插入/删除 | ❌ | **完全缺失** |
| Embedding | 模型调用 | ❌ | **完全缺失** |
| 索引管理 | 创建/重建 | ❌ | **完全缺失** |

### DBA

| 功能域 | 功能点 | 实现状态 | 备注 |
|--------|--------|----------|------|
| SQL 工单 | 创建/审批/执行 | ✅ | 工作流完整 |
| SQL 工单 | 结果回写 | ⚠️ | executeOrder 硬编码结果 |
| 数据源 | CRUD | ✅ | 完整 |
| 连接测试 | 连通性检查 | ⚠️ | Mock 实现（仅更新状态） |
| 审计规则 | CRUD | ✅ | 完整 |
| 审计执行 | SQL 审计 | ❌ | 规则未实际执行 |
| 查询 | 直接查询 | ❌ | Mock 返回空 |

### FinOps

| 功能域 | 功能点 | 实现状态 | 备注 |
|--------|--------|----------|------|
| 成本采集 | Cloud 成本 | ✅ | batch insert |
| 成本采集 | K8s 成本 | ✅ | 含 namespace/pod 维度 |
| 成本采集 | SaaS 成本 | ✅ | 订阅管理 |
| 成本追踪 | 实体维度 | ✅ | project/tenant/team |
| 成本汇总 | 总览 | ✅ | compute/storage/network/saaS |
| 成本分解 | 多维度 | ✅ | category/tenant/environment/provider/namespace |
| 预算管理 | CRUD | ✅ | 完整 |
| 预算告警 | 阈值检查 | ✅ | 百分比告警 |
| 预算预测 | 消耗预测 | ✅ | 基于历史日均 |
| ROI 分析 | 计算/历史 | ✅ | 自动计算 payback |
| 优化建议 | 生成/查询 | ✅ | unused/right-sizing/scheduling |
| 成本对比 | 前后对比 | ✅ | 节省百分比 |

---

## API 端点清单

### DataPipeline API (`/v1/data-pipelines`)

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| POST | `/` | 创建管道 | ✅ |
| GET | `/` | 列出管道 | ⚠️ DB 模式返回空 |
| POST | `/:id/execute` | 执行管道 | ✅ 模拟 |
| GET | `/:id/executions` | 执行历史 | ⚠️ DB 模式返回空 |
| GET | `/:id/lineage` | 数据血缘 | ✅ |
| GET | `/:id/schedule` | 获取调度 | ✅ |
| POST | `/:id/schedule` | 设置调度 | ⚠️ DB 模式 no-op |
| GET | `/lineage/graph` | 血缘图谱 | ✅ |
| GET | `/executions` | 所有执行 | ⚠️ 依赖 listPipelines |

### VectorStore API

**当前无独立 API 路由文件**。Service 层存在 CRUD 方法但无 HTTP 暴露。

### DBA API (`/api/v1/dba`)

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| GET | `/orders` | SQL 工单列表 | ✅ 分页 |
| GET | `/orders/:id` | 工单详情 | ✅ |
| POST | `/orders` | 创建工单 | ✅ |
| POST | `/orders/:id/approve` | 审批通过 | ✅ |
| POST | `/orders/:id/reject` | 驳回 | ✅ |
| POST | `/orders/:id/execute` | 执行 | ⚠️ Mock 实现 |
| GET | `/datasources` | 数据源列表 | ✅ |
| GET | `/datasources/:id` | 数据源详情 | ✅ |
| POST | `/datasources` | 创建数据源 | ✅ |
| PUT | `/datasources/:id` | 更新数据源 | ✅ |
| DELETE | `/datasources/:id` | 删除数据源 | ✅ |
| POST | `/datasources/:id/test` | 测试连接 | ⚠️ Mock |
| GET | `/audit-rules` | 审计规则列表 | ✅ |
| POST | `/audit-rules` | 创建规则 | ✅ |
| PUT | `/audit-rules/:id` | 更新规则 | ✅ |
| POST | `/query` | 直接查询 | ❌ Mock |

### FinOps API

#### finops-routes.ts（Legacy）

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| POST | `/cost-operations/budget-guards` | 创建预算守卫 | ✅ |
| GET | `/cost-operations/budget-guards` | 预算守卫列表 | ✅ |
| DELETE | `/cost-operations/budget-guards/:id` | 删除预算守卫 | ❌ 501 |
| POST | `/cost-operations/evaluate` | 成本评估 | ✅ |
| GET | `/cost-operations/anomalies` | 异常检测 | ✅ |
| GET | `/cost-operations/trend` | 成本趋势 | ✅ |
| GET | `/cost-operations/overview` | 总览 | ⚠️ 硬编码 0 |
| GET | `/cost-operations/optimizations` | 优化建议 | ✅ |
| POST | `/cost-operations/optimizations/:id/apply` | 应用优化 | ❌ 501 |
| POST | `/cost-operations/optimizations/:id/reject` | 拒绝优化 | ❌ 501 |

#### finops-v2-routes.ts（完整）

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| POST | `/finops/track/project` | 项目成本追踪 | ✅ |
| POST | `/finops/track/tenant` | 租户成本追踪 | ✅ |
| POST | `/finops/track/team` | 团队成本追踪 | ✅ |
| GET | `/finops/track/:entityType/:entityId` | 实体成本查询 | ✅ |
| GET | `/finops/track/:entityType/:entityId/trend` | 成本趋势 | ✅ |
| GET | `/finops/cost-overview` | 成本总览 | ✅ |
| GET | `/finops/cost-breakdown` | 成本分解 | ✅ |
| GET | `/finops/chargeback` | chargeback 报告 | ✅ |
| GET/POST/PUT/DELETE | `/finops/budgets` | 预算 CRUD | ✅ |
| GET | `/finops/budgets/:id/status` | 预算状态 | ✅ |
| GET | `/finops/budgets/:id/forecast` | 预算预测 | ✅ |
| POST | `/finops/budgets/check-alerts` | 检查预算告警 | ✅ |
| GET | `/finops/budgets/alert-triggers` | 告警触发记录 | ✅ |
| GET | `/finops/recommendations` | 优化建议 | ✅ |
| PATCH | `/finops/recommendations/:id` | 更新建议状态 | ✅ |
| DELETE | `/finops/recommendations/:id` | 删除建议 | ✅ |
| GET | `/finops/recommendations/right-sizing` | 配型建议 | ✅ |
| GET | `/finops/recommendations/unused` | 闲置资源 | ✅ |
| GET | `/finops/recommendations/savings` | 节省估算 | ✅ |
| GET | `/finops/reports` | 报告历史 | ✅ |
| GET | `/finops/roi/history` | ROI 历史 | ✅ |
| GET | `/finops/roi/summary` | ROI 摘要 | ✅ |
| GET | `/finops/metrics` | FinOps KPIs | ✅ |
| GET | `/finops/health` | 健康检查 | ✅ |

---

## 缺失功能

### P0 级（阻塞生产）

| 模块 | 缺失功能 | 影响 | 建议修复方式 |
|------|----------|------|-------------|
| VectorStore | 向量搜索能力 | 无法实现语义搜索 | 集成 pgvector/qdrant |
| VectorStore | 文档向量化执行 | 规则仅元数据，无实际处理 | 实现 DocumentProcessor |
| VectorStore | Embedding 模型集成 | 无法生成向量 | 对接 OpenAI/本地模型 |
| DBA | 直接查询执行 | 无法执行 SQL | 集成实际数据库连接池 |
| DBA | SQL 审计执行 | 规则不生效 | 实现审计引擎拦截 SQL |

### P1 级（高优先级）

| 模块 | 缺失功能 | 影响 | 建议修复方式 |
|------|----------|------|-------------|
| DataPipeline | DB 模式 listPipelines | 管道列表为空 | 实现 `findByTenant` 调用 |
| DataPipeline | DB 模式 getExecutions | 执行历史为空 | 实现 `findByPipeline` 调用 |
| DataPipeline | DB 模式 updatePipeline | 无法更新管道 | 调用 Repository |
| DataPipeline | 异步执行引擎 | 大管道阻塞请求 | 引入 BullMQ + Redis |
| FinOps | 预算删除 | 501 错误 | 实现 controller 方法 |
| FinOps | 优化应用/拒绝 | 501 错误 | 实现 controller 方法 |
| FinOps | 成本总览硬编码 | 数据不准确 | 接入实际聚合查询 |
| DBA | 连接测试真实化 | 无法验证连通性 | 集成 mysql2/pg 客户端 |
| DBA | 执行结果回写 | 结果不真实 | 实际执行 SQL 并回写 |

### P2 级（改进项）

| 模块 | 缺失功能 | 影响 | 建议修复方式 |
|------|----------|------|-------------|
| DataPipeline | 执行取消 | 无法停止运行中管道 | 实现 cancel 接口 |
| DataPipeline | 版本管理 | 无法回滚 | 增加 pipeline_versions 表 |
| VectorStore | 集合统计 | 无文档计数更新 | 实现 updateVectorCount |
| VectorStore | 向量删除 | 无法清理 | 增加删除接口 |
| FinOps | 成本数据采集调度 | 需手动录入 | 对接 CloudWatch/Billing API |
| FinOps | 多币种支持 | 仅 USD | 增加汇率转换 |
| DBA | 工单搜索 | 仅列表过滤 | 增加全文搜索 |
| DBA | 审计日志 | 无审计记录 | 记录审计操作日志 |

---

## 技术债务

| 类别 | 模块 | 具体问题 | 风险等级 | 建议 |
|------|------|----------|----------|------|
| 内存降级残留 | DataPipeline | 保留 pipelines/executions/timers Map | 🔴 高 | 移除内存存储，强制 PostgreSQL |
| 空实现 | DataPipeline | listPipelines、getExecutions DB 模式返回空 | 🔴 高 | 实现 Repository 查询 |
| Mock 接口 | DBA | /dba/query 和 /datasources/:id/test 返回硬编码 | 🔴 高 | 实现真实 DB 连接执行 |
| 硬编码数据 | FinOps | /cost-operations/overview 返回全 0 | 🟡 中 | 接入 getCostSummary 真实查询 |
| 双路由层 | FinOps | finops-routes.ts 和 finops-v2-routes.ts 功能重叠 | 🟡 中 | 合并为单一路由层 |
| 未实现 TODO | FinOps | 3 个 501 端点 | 🟡 中 | 补全 Controller 实现 |
| 类型不一致 | FinOps | alerts 字段 JSON.stringify / 对象解析不一致 | 🟡 中 | 统一为 JSONB + 自动解析 |
| 分页缺失 | VectorStore | listRules/listCollections 无分页 | 🟢 低 | 增加 limit/offset |
| 租户隔离 | VectorStore | 无租户过滤 | 🔴 高 | 所有查询增加 tenant_id |

---

## 与其他模块集成点

| 集成模块 | 集成方式 | 状态 |
|----------|----------|------|
| DataLineage | getDataLineage() 返回节点/边 | ✅ 静态血缘 |
| DataQuality | stage 可配置 validate 类型 | ⚠️ 未实际调用 |
| Notification | 执行完成需发送通知 | ❌ 未实现 |
| Auth | authenticateUser + requirePermission | ✅ ACL 集成 |
| AIDocManagement | 文档上传后触发向量化 | ❌ 无触发机制 |
| AIReview | 代码审查结果存入向量库 | ❌ 无写入接口 |
| Approval | 工单审批流 | ✅ 集成 |
| Security | SQL 注入检测 | ❌ 未实现 |

---

## 建议优先级

### Phase 1：修复 P0 阻塞项（预计 2 周）

1. **VectorStore 向量搜索能力**：集成 pgvector 或外部向量数据库
2. **DataPipeline DB 模式修复**：实现 findByTenant/findByPipeline/updatePipeline
3. **DBA 真实查询执行**：集成数据库连接池

### Phase 2：完善 P1 项（预计 2 周）

4. **DataPipeline 异步执行引擎**：引入 BullMQ + Redis
5. **FinOps 501 端点补全**：实现 deleteBudgetGuard、applyOptimization、rejectOptimization
6. **VectorStore 租户隔离**：所有查询增加 tenant_id 过滤

### Phase 3：P2 优化项（预计 1 周）

7. **统一 FinOps 路由层**：合并 finops-routes.ts 和 finops-v2-routes.ts
8. **FinOps 自动采集**：对接 CloudWatch/Billing API
9. **DBA 审计引擎**：实现 SQL 拦截/解析

---

## 关键文件索引

| 功能 | 文件路径 | 重要性 |
|------|----------|--------|
| DataPipeline Service | `src/services/data-pipeline/DataPipelineService.ts` | ⭐⭐⭐ |
| DataPipeline Repository | `src/repositories/DataPipelineRepository.ts` | ⭐⭐⭐ |
| VectorStore Service | `src/services/vector-store/VectorStoreService.ts` | ⭐⭐ |
| DBA Service | `src/services/dba/DbaService.ts` | ⭐⭐⭐ |
| FinOps Service | `src/services/finops/FinOpsService.ts` | ⭐⭐⭐ |
| FinOps V2 Routes | `src/api/finops-v2-routes.ts` | ⭐⭐⭐ |

---

## 结论

**整体完成度**：
- **DBA**：85%（SQL 工单、数据源、审计规则完整，查询执行待完善）
- **FinOps**：90%（成本追踪、预算、ROI、优化完整，部分端点 501）
- **DataPipeline**：70%（元数据 CRUD 完整，执行引擎和调度需修复）
- **VectorStore**：40%（仅元数据管理，**核心向量搜索能力完全缺失**）

**最大风险**：
1. VectorStore 无实际向量搜索能力
2. DataPipeline DB 模式存在功能性 bug（list/executions 返回空）
3. DBA 和 FinOps 部分端点返回 mock 数据

建议优先修复 VectorStore 向量搜索集成和 DataPipeline DB 模式兼容性问题。
