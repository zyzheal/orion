# DBA 平台 Phase 2 + 慢查询分析 (P0-2) 设计文档

**日期**：2026-09-06
**分支**：`feat/wave2-parallel-execution`
**范围**：Phase 2 DBA 扩展（4 模块） + DBA-P0-2 慢查询分析

---

## 一、背景与目标

Orion DBA 模块此前停留在"CRUD 工单流"阶段，缺乏 DBA 专家视角的深度能力。
本交付包含两条主线：

1. **Phase 2 扩展**：4 个独立模块填补 DBA 平台基础能力空白
   - Multi-stage Approval（多级审批）
   - Paged Query + Excel Export（分页查询 + Excel 导出）
   - AI SQL Review（LLM 辅助 SQL 评审）
   - Online Schema Change（gh-ost 零停机 DDL）
2. **P0-2 慢查询分析**：`pg_stat_statements` / `performance_schema` 采集 +
   启发式优化建议

---

## 二、架构

### 2.1 模块边界

```
internal/dba/
├── approval/     # Phase 2 - Multi-stage approval (DAG)
├── aireview/     # Phase 2 - LLM-assisted SQL review
├── osc/          # Phase 2 - gh-ost online schema change
├── query/        # Phase 2 - Paged query + Excel export
└── slowquery/    # P0-2  - Slow query collection + heuristic analyzer
```

每个模块遵循统一的 `repo → service → handler` 分层，模块之间无循环依赖。

### 2.2 接线

`cmd/server/wiring-dba-extensions.go` 是全部 5 个模块的单一接线入口，
在 `initWiring` 中调用一次，各模块 handler 通过 `cmd/server/router.go`
的 `registerRoutes` 批量注册。

### 2.3 权限模型

所有 DBA 端点使用 `auth.RequirePermission("dba", action)`，action 取值：

| Action | 用途 | 示例端点 |
|--------|------|---------|
| `read`   | 只读列表/详情 | `GET /dba/slowquery/top` |
| `write`  | 创建/更新 | `POST /dba/approval/workflows` |
| `execute`| 执行 SQL/DDL | `POST /dba/slowquery/collect` |
| `approve`| 审批动作 | `POST /dba/approval/instances/:id/steps/:idx/approve` |

---

## 三、模块设计

### 3.1 Multi-stage Approval (`internal/dba/approval/`)

**表结构**（`migrations/dba/approval_workflows.sql`）：

- `dba_approval_workflows`：命名审批流定义（步骤 JSONB）
- `dba_approval_instances`：一次提交的实例（快照 workflow steps）
- `dba_approval_records`：审批人操作记录

**步骤模式**：`any` / `unanimous` / `majority`
**超时动作**：`reject` / `escalate` / `approve`

**关键决策**：workflow 提交时快照到 instance，避免后续 workflow 编辑
影响在跑实例。

### 3.2 Paged Query (`internal/dba/query/`)

- 游标分页：`page_token` 不透明 base64 编码
- 结果集上限：默认 500 行/页
- 本地审计引擎桥接：`engineAuditAdapter` 把 `LocalAuditEngine` 的
  `Passed` 布尔值传给 query 模块
- Excel 导出：异步 job + HMAC 签名 URL

### 3.3 AI SQL Review (`internal/dba/aireview/`)

- 本地引擎（`LocalAuditEngine`）始终运行
- AI 客户端只在 `AI_BASE_URL` + `AI_API_KEY` 都配置时创建
- 未配置时优雅降级到本地-only 模式

### 3.4 Online Schema Change (`internal/dba/osc/`)

- 复用 `gh-ost` binary（可通过 env `GHOST_BINARY` 覆盖路径）
- `DataSourceProvider` 接口在 wiring 层实现，从 `data_sources` 表
  查凭证
- Dry-run 模式先跑一遍校验再正式启动

### 3.5 Slow Query (`internal/dba/slowquery/`)

**采集源**：

| DB | 视图 | 阈值字段 |
|----|------|---------|
| PostgreSQL | `pg_stat_statements` | `mean_time_ms` |
| MySQL | `performance_schema.events_statements_summary_by_digest` | `AVG_TIMER_WAIT` |

**幂等 upsert**：`(data_source_id, query_hash)` 唯一约束 +
`ON CONFLICT ... DO UPDATE` 累加 `call_count` / `total_time_ms`。

**启发式规则**（`analyzer.go`，8 条）：

1. `SELECT *` → 建议显式列
2. `LIKE '%...'` → 建议后缀通配或 trigram 索引
3. WHERE OR → 建议 UNION ALL
4. 索引列上函数调用 → 建议 sargable 改写或函数索引
5. rows_read ≥ 10000 → 建议复合/覆盖索引
6. SELECT 缺 LIMIT → 建议加 LIMIT
7. 跨库引用 → 提示事务边界问题
8. 隐式类型转换 → **故意不实现**（无 schema 时误报率过高）

**Verdict**：`passed = len(suggestions) == 0`（任何建议都失败，
避免 dashboard 隐藏信号）。

---

## 四、API 汇总

### 4.1 Approval

```
POST /api/v1/dba/approval/workflows                    # 创建审批流
GET  /api/v1/dba/approval/workflows                    # 列表
GET  /api/v1/dba/approval/workflows/:id                # 详情
POST /api/v1/dba/approval/instances                    # 提交审批
GET  /api/v1/dba/approval/instances                    # 列表
GET  /api/v1/dba/approval/instances/:id                # 详情
POST /api/v1/dba/approval/instances/:id/steps/:idx/approve
POST /api/v1/dba/approval/instances/:id/steps/:idx/reject
POST /api/v1/dba/approval/instances/:id/steps/:idx/escalate
```

### 4.2 Paged Query

```
POST /api/v1/dba/query/paged              # 执行 SELECT
POST /api/v1/dba/query/export             # 启动 Excel 导出 job
GET  /api/v1/dba/query/export/:jobid      # 轮询导出状态
```

### 4.3 AI Review

```
POST /api/v1/db/aireview/review           # 提交评审
GET  /api/v1/db/aireview/history          # 历史记录
GET  /api/v1/db/aireview/:id              # 详情
```

> 注意：AI Review 挂在 `/db/aireview`（不是 `/dba/aireview`），
> 与 handler 定义保持一致，避免与其他 DBA 路径冲突。

### 4.4 Online Schema Change

```
GET  /api/v1/dba/osc/jobs                 # 列表
GET  /api/v1/dba/osc/jobs/:id             # 详情
POST /api/v1/dba/osc/jobs                 # 创建
POST /api/v1/dba/osc/jobs/:id/start       # 启动
POST /api/v1/dba/osc/jobs/:id/stop        # 停止
POST /api/v1/dba/osc/dryrun               # Dry-run
GET  /api/v1/dba/osc/jobs/:id/status      # 轮询状态
```

### 4.5 Slow Query

```
POST /api/v1/dba/slowquery/collect        # 触发一次采集
GET  /api/v1/dba/slowquery/top            # Top N 慢查询
POST /api/v1/dba/slowquery/analyze        # 启发式分析单条 SQL
GET  /api/v1/dba/slowquery/stats          # 24h 统计
```

---

## 五、迁移清单

| 文件 | 说明 |
|------|------|
| `migrations/dba/approval_workflows.sql` | 3 张审批相关表 |
| `migrations/dba/aireviews.sql` | AI 评审历史表 |
| `migrations/dba/aireviews_down.sql` | 反向迁移 |
| `migrations/dba/slowquery_records.sql` | 慢查询记录表 + 4 索引 |

**首次部署**：按上述顺序执行 SQL 文件。

---

## 六、验收标准

### 6.1 功能

- ✅ 每个模块 handler 都能被 `RegisterRoutes` 成功挂载
- ✅ 前端页面全部通过 tsc 类型检查
- ✅ Go 单元测试全部通过（slowquery 8/8）
- ✅ 权限模型覆盖所有端点

### 6.2 代码质量

- ✅ 所有模块无循环依赖
- ✅ 采集器幂等（可重复调用）
- ✅ 分析器纯函数，无 IO 副作用
- ✅ 类型断言和 nil 检查到位
- ✅ 错误路径结构化日志（zap）

### 6.3 已知局限

- ❌ 慢查询采集需目标服务器启用对应扩展（`pg_stat_statements` /
  `performance_schema`）
- ❌ AI Review 未配置 `AI_BASE_URL` 时仅本地引擎
- ❌ 隐式类型转换规则未实现（需 schema 支持才能避免误报）
- ❌ 后端未做端到端集成测试（wiring → HTTP），仅有单模块单测

---

## 七、后续路线

| 项 | 依赖 | 状态 |
|----|------|------|
| DBA-P0-3 EXPLAIN 分析 | P0-2 ✅ | 待做 |
| DBA-P0-4 索引建议 Agent | P0-2 + P0-3 | 待做 |
| DBA-P0-1 SQL 审核规则引擎 | 无 | 待做 |
| AI-P0-1 DBA Copilot 接入 assistant | P0-2 | 待做 |
