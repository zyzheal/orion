# DBA 代码评审修复记录 (2026-09-07)

**日期**：2026-09-07
**分支**：`feat/wave2-parallel-execution`
**范围**：DBA 模块 5 维代码评审（安全/性能/可靠性/可读性/可维护性）发现的问题及修复

---

## 一、评审方法

按用户指令"按照顺序开始实施直到完成所有并进行代码评审修复问题"，对以下 DBA
相关模块执行 5 维代码评审：

| 维度 | 关注点 |
|------|--------|
| 安全 | 租户隔离、SQL 注入、凭证处理、越权 |
| 性能 | 查询、连接、N+1、资源泄漏 |
| 可靠性 | 错误传播、nil 检查、幂等性 |
| 可读性 | 命名、注释、函数边界 |
| 可维护性 | 死代码、接线模式一致性、重复逻辑 |

## 二、评审发现与修复

### 2.1 主 dba 包 handler 路由 bug（已修复）

**文件**：`orion-platform-svc-go/internal/dba/handler/handler.go`

| 问题 | 严重度 | 修复 |
|------|--------|------|
| 第 63 行 `rg.PUT("/dba/audit-rules/:id", ...)` 使用外层 group，跳过内层 `f` group | 中 | 改为 `f.PUT` |
| 第 69 行 `rg.GET("/dba/query-logs", ...)` 同样使用外层 group | 中 | 改为 `f.GET` |
| `DELETE /datasources/:id` 权限为 `write`，删除操作应更严格 | 低 | 改为 `dba:delete` 权限 |

**影响**：audit-rules 更新与 query-logs 列表此前会被路由到错误 prefix，前端请求
实际无法命中。

### 2.2 internal/infrastructure/dba 租户漏洞（已修复）

**文件**：`orion-platform-svc-go/internal/infrastructure/dba/`（repository + handler）

| 问题 | 严重度 | 修复 |
|------|--------|------|
| `GetOrderByID` / `GetDataSourceByID` / `GetAuditRuleByID` 仅按 id 查询，未过滤 tenant_id | **高** | 在 service 层增加租户校验后回查 |
| `UpdateDataSource` / `UpdateAuditRule` 动态 SET 未做列白名单 | 中 | 白名单化可更新列 |

**影响**：任意租户可凭 id 越权读取/修改其他租户的数据源、工单、审计规则。

### 2.3 auditrule/models.go 死代码（已修复）

| 问题 | 严重度 | 修复 |
|------|--------|------|
| 未使用的方法/字段残留 | 低 | 删除 |

### 2.4 AI Copilot 接入真实 DBA 数据（NewDBAProvider）（已修复）

**文件**：`orion-platform-svc-go/cmd/server/wiring-dba-extensions.go`、
`cmd/server/cicd_domain_wiring.go`

背景：`internal/assistant/service/providers.go` 中已有 `dbaProvider` 框架
（`NewDBAProvider(DBASearchFn)`），但从未被接线 —— 属于"待激活死代码"。
修复后 AI Copilot 可以检索真实 DBA 数据：

| 数据源 | 入口 | 说明 |
|--------|------|------|
| EXPLAIN 历史 | `dbaExplainSvc.RecentHistory` | 仅需 tenantID，天然适合 provider |
| 慢查询 Top-N | `dbaSlowQuerySvc.TopN` | 需 data_source_id → 先枚举数据源 |
| 索引建议 | `dbaAdvisorSvc.SuggestIndexes` | 内部已做慢查询扫描，不重复调用 TopN |

**关键接线模式**（延迟依赖）：

```
initWiring:
  wireCICDModules(db)      # assistant providers 在此构建
  wireDomainModules(db)    # NewDBAProvider 闭包在此构造（捕获 db）
  wireDbaExtensions(...)   # dbaSlowQuerySvc / dbaExplainSvc / dbaAdvisorSvc 在此赋值
```

由于 `wireDomainModules` 先于 `wireDbaExtensions` 执行，闭包必须以
`if svc != nil` 延迟解引用包级变量。为此在 `wiring-dba-extensions.go` 新增
service 包级变量块：

```go
var (
    dbaSlowQuerySvc *dba_slowquery.Service
    dbaExplainSvc   *dba_explain.Service
    dbaAdvisorSvc   *dba_advisor.IndexAdvisorService
)
```

并新增 3 个辅助函数：`truncateSQL`、`formatSlowQuery`、`formatIndexSuggestion`
（格式化 DBARef 的 Title/Body）。

### 2.5 慢查询收集器只读会话（已修复）

**文件**：`orion-platform-svc-go/internal/dba/slowquery/collector.go`

| 问题 | 严重度 | 修复 |
|------|--------|------|
| 采集连接持有完整写权限，若账号配置过宽则收集路径可写目标库 | 中 | PG: `SET default_transaction_read_only = on`；MySQL: `SET SESSION TRANSACTION READ ONLY` |

**原则**：采集器只读 `pg_stat_statements` / `performance_schema`，强制会话只读
是纵深防御 —— 即使账号权限过宽也无法通过该连接写入。

## 三、验证

| 验证项 | 结果 |
|--------|------|
| `go build ./internal/dba/slowquery/...` | ✅ |
| `go vet ./internal/dba/slowquery/...` | ✅ |
| `go test ./internal/dba/...` (12 包) | ✅ 全部通过 |
| `go test ./internal/assistant/service/...` | ✅ 通过 |
| `go build ./cmd/server/...`（过滤无关预存错误后） | ✅ 无新增错误 |

> 注：`go build ./...` 全量仍存在预先存在、与本轮改动无关的失败包
> （alert-correlation / alert-rule-engine / semantic-search / observability /
> rca 等 handler 层 `undefined: middleware`），不在本轮范围。

## 四、待办（低优先级 / 后续）

| 项 | 说明 |
|----|------|
| DBA-P0-1 SQL 审核规则引擎 | 设计文档已列，未实施 |
| 后端端到端集成测试（wiring → HTTP） | 现有局限，仅有单模块单测 |
| 全量 `go build ./...` 预存错误清理 | 涉及多个无关包，需单独排期 |
