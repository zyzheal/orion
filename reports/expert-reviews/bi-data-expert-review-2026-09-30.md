# Orion BI / 数据仓库 / 报表能力深度评审（对标 NeatLogic 基础功能）

**评审日期**：2026-09-30
**评审角色**：BI / 数据工程领域专家（dbt / Metabase / Superset / Tableau / Looker 实施背景，ODS/DWD/DWS/ADS 分层建模）
**评审对象**：
- `legacy/orion-platform-service-ts/src/services/report-designer/`（TS 权威实现，882 行）
- `orion-platform-svc-go/internal/report-designer/`、`internal/bi-dashboard/`（Go 蓝图）
- `orion-frontend/src/pages/{ReportDesigner, DashboardNew, MetricsDashboard, DashboardCore}`
- `orion-frontend/src/components/{charts, DashboardLayout, MatrixConfigurator}`
- `orion-frontend/src/pages/NotificationEnhanced/MatrixTab.tsx`
- `orion-frontend/src/api/reports.ts`

**结论等级**：⚠️ **报表骨架完整但零渲染/零定时执行/零导出；数据矩阵与数据仓库完全缺失；仪表板为硬编码页面**
**真实完成度**：≈ **14%**（加权），BI 域在 Orion 是**功能最不完整的一个基础功能族**

> **认知边界（诚实声明）**：本报告所有代码结论均经实际 grep / Read 验证。本工作区**未检出 `orion-platform-service`** 主目录（仅 `legacy/orion-platform-service-ts/`），故仅对 TS legacy + Go 蓝图 + 前端下判断；如果权威实现在 `orion-platform-service/src/services/`，本报告的"无 XXX"结论需以 `git ls-tree` 复核后再采信。

---

## 1. BI 视角能力矩阵（对标 NeatLogic 25 项）

标记：✅ 真实可用 ｜ ⚠️ 部分可用/骨架 ｜ 🚫 桩代码/蓝图 ｜ ❌ 完全缺失

### 1.1 仪表板（NeatLogic 6 项）

| # | 功能点 | 状态 | 证据 | Gap | 工时(人天) |
|---|---|---|---|---|---|
| 1 | 系统/个人面板 | ⚠️ | `pages/DashboardNew`（1112 行 8 文件）+ `pages/DashboardCore`（446 行 5 文件）两个硬编码面板；无"用户可创建个人面板"入口 | P1 | 12 |
| 2 | CRUD/复制/导入/导出 | 🚫 | Go `internal/bi-dashboard/models/models.go:6-12` 模型**只有 `Name` 字段**（连 Layout/Components 都没有）；`UpdateRequest` 仅接受 `name`（`service.go:69-74`）——即**"仪表板"实体是空壳**，无法承载任何可视化定义。`grep copy/import/export` 无结果 | P0 | 25 |
| 3 | 组件丰富（12 种图表） | ⚠️ | 前端 `components/charts/` 有 11 个 ECharts 封装（Bar/Pie/Radar/Gauge/Heatmap/Sankey/Scatter/StatCard/Timeline/TreeMap/TrendLine），**图表组件库齐全**。但**没有任何后端"组件定义"表**——组件只能硬编码在页面 tsx 里，无法被用户配置 | P1 | 15 |
| 4 | 配置式呈现 | ❌ | 无 schema-driven 渲染。`pages/DashboardNew/index.tsx:62-97` 硬编码 `<Row><Col>` 布局，12+ 个卡片各绑固定 API | P0 | 20 |
| 5 | 拖拽布局 | ❌ | 全仓 `grep react-grid-layout / react-beautiful-dnd / dnd-kit` 无命中。`DashboardLayout/index.tsx`（34 行）仅为静态布局容器 | P0 | 12 |
| 6 | 系统仪表板授权 | ⚠️ | Go handler 有 `auth.RequirePermission("bi_dashboard", "read"/"write"/"delete")` 三条 ACL（`handler.go:23-27`），**权限位齐备但实体只有 name** | P2 | 3 |

### 1.2 数据矩阵（NeatLogic 7 项）

| # | 功能点 | 状态 | 证据 | Gap | 工时(人天) |
|---|---|---|---|---|---|
| 7 | CRUD/导入/导出 | 🚫 | `pages/NotificationEnhanced/MatrixTab.tsx:1-80` **叫 MatrixTab 但实际是"通知矩阵"**（TYPE_OPTIONS 是 `integration/subscription/channel/custom`）；`components/MatrixConfigurator/` 是 **CI/CD 矩阵构建**（OS×Node 版本笛卡尔积）。**两处命名撞车，均与"数据矩阵（数据源抽象）"无关** | P0 | 20 |
| 8 | 静态数据源 | ❌ | 无 | P0 | 6 |
| 9 | 接口数据源 | ❌ | 无 | P0 | 8 |
| 10 | CMDB 视图数据源 | ❌ | CMDB 有资产模型，但**无数据矩阵抽象层**，无法被"数据源"复用 | P1 | 10 |
| 11 | SQL 查询视图 | ⚠️ | `api/reports.ts:27` `ReportDatasource.type: 'sql' | 'api' | 'promql'` **类型定义存在**，`report_datasource` 表有 `config JSONB` 列；但**服务层无任何 SQL 执行**（`ReportDesignerService.ts` 只 CRUD `ReportDatasource` 元数据，从不 `pgPool.query(config.sql)`） | P0 | 15 |
| 12 | 复制 | ❌ | 无 | P2 | 3 |
| 13 | 导入导出 | ❌ | 无 | P2 | 3 |

### 1.3 数据仓库（NeatLogic 7 项）

| # | 功能点 | 状态 | 证据 | Gap | 工时(人天) |
|---|---|---|---|---|---|
| 14 | CRUD/导入/导出 | ❌ | 全仓 `grep data_warehouse / DataWarehouse / dwh / DWD / DWS / ADS / ODS` **零命中**（`semantic-search` 是 AI 检索，与数仓无关） | P0 | 30 |
| 15 | 过程数据→高阶管理对象 | ❌ | 无 | P0 | 25 |
| 16 | 数据源（业务/日志/监控/事件） | ⚠️ | 业务表散落各处，无统一 source-of-truth 层；**Prometheus 集成只有 PipelineMetricsService 一处**，Grafana/Loki 集成 `grep` 无结果（Orion CLAUDE.md 声称"有 Prometheus/Grafana/Loki 集成"是**不准确**的） | P0 | 30 |
| 17 | 数据对象+过滤条件 | ❌ | 无 | P0 | 20 |
| 18 | 数据模式（全量/增量） | ❌ | 无 | P1 | 15 |
| 19 | 人工/定时同步 | ❌ | 无 | P1 | 12 |
| 20 | 数仓消费（大屏/仪表板/报表） | ❌ | 无（同 #14） | P0 | 0（含在 #14） |

### 1.4 报表（NeatLogic 11 项）

| # | 功能点 | 状态 | 证据 | Gap | 工时(人天) |
|---|---|---|---|---|---|
| 21 | 报表模板 CRUD/复制/导入/导出 | ⚠️ | TS `ReportDesignerService.ts:101-129` 完整 CRUD（create/get/update/delete/listReports），字段齐（`name/description/category/layout/components/datasourceBindings/templateId/enabled`）；**无 copy/import/export** | P1 | 8 |
| 22 | 显示界面/过滤条件/数据源 | ⚠️ | 数据结构支持 `layout` + `components` + `datasourceBindings`（三张 JSONB 表），**结构到位**；但 `ReportDesignerModals.tsx:1-160` **只有元数据表单**（Name/Category/Enabled），**无 layout 可视化编辑器** | P1 | 18 |
| 23 | HTML 组件 | ❌ | 无 HTML 注入/iframe 沙箱能力 | P2 | 6 |
| 24 | 呈现控件 | ⚠️ | `components: Record<string, any>[]` 是自由 JSONB，无控件 schema | P2 | 5 |
| 25 | TSQL/rest 数据源 | 🚫 | 类型 `'sql' | 'api' | 'promql'` 定义了，但 `ReportDesignerService.createDatasource:172-181` 只是把 config JSONB 存库——**无任何执行引擎**。TSQL 特指 TeamSystem/TongTech SQL 方言，无适配 | P0 | 15 |
| 26 | 报表访问权限 | ⚠️ | `report-designer-routes.ts:54-323` 全部端点挂 `requirePermission({resource:'report-designer', action:'read/write/delete'})`——**只有全局 ACL，无 per-report ACL**（NeatLogic 要求 per-report 授权） | P1 | 8 |
| 27 | 模板生成报表实例 | ❌ | `templateId` 字段存在但**从不被读**（`grep templateId` 仅定义处）；无"模板→实例化"流程 | P1 | 10 |
| 28 | 实时更新 | ❌ | `refreshInterval` 字段仅在元数据表存下，**无 WebSocket/SSE 广播机制** | P1 | 8 |
| 29 | Word/Excel/PDF 导出 | 🚫 | `exportFormat: 'pdf' | 'excel' | 'csv'` 类型定义齐；Go `ExecuteReport:312-316` **`outputPath = "reports/"+id+"/"+execution.ID+".pdf"` 是字符串拼接，然后立刻 `UpdateExecutionStatus("completed")`——不生成任何文件**。全仓 `grep pdfkit/sheetjs/excelize/libreOffice/jsPDF` **零命中** | P0 | 25 |
| 30 | 定时发送 | 🚫 | TS/Go 都有 `ReportSchedule` 表 + `cronExpression` + `recipients JSONB`；但**全仓无 cron 消费者**（`grep cron-consumer / cron-consumer / node-cron / robfig/cron` 无业务代码调用）。**Schedules 表建好了、Runner 没写** | P0 | 15 |

### 1.5 矩阵汇总

| 状态 | 数量 | 占比 |
|---|---|---|
| ✅ 真实可用 | 0 | 0% |
| ⚠️ 部分可用/骨架 | 8 | 32% |
| 🚫 桩代码/蓝图 | 4 | 16% |
| ❌ 完全缺失 | 13 | 52% |

**加权完成度 ≈ 14%**（✅=1、⚠️=0.5、🚫=0.15、❌=0）。**最致命**的是 3 组"元数据完备但无执行内核"的骨架：报表执行器、定时调度器、文件导出器——这三项加起来占了 NeatLogic 报表域的 60% 权重。

---

## 2. Orion 现有仪表板/报表深度代码分析

### 2.1 服务接口与数据模型清单

**TS 侧（`services/report-designer/`，882 行，4 张 Repository + 1 Service）**

| 文件 | 行数 | 数据模型核心字段 |
|---|---|---|
| `ReportDefinitionRepository.ts` | 216 | `report_definition` 表：`name / description / category / layout JSONB / components JSONB / datasource_bindings JSONB / template_id / enabled / created_by`；带 `ILIKE` 关键字搜索 + `limit/offset` 分页 + 租户隔离 |
| `ReportDatasourceRepository.ts` | 167 | `report_datasource`：`name / datasource_type / config JSONB / refresh_interval / report_id / status` |
| `ReportScheduleRepository.ts` | 156 | `report_schedule`：`report_id / cron_expression / export_format / recipients JSONB / enabled` |
| `ReportExecutionRepository.ts` | 92 | `report_execution`：`report_id / schedule_id / export_format / status / file_url / error / started_at / triggered_by` |
| `ReportDesignerService.ts` | 242 | 4 Repo 组合，18 方法：`listReports/getReport/createReport/updateReport/deleteReport/previewReport/executeReport/listDatasources/createDatasource/updateDatasource/deleteDatasource/listSchedules/createSchedule/updateSchedule/deleteSchedule/getExecutionHistory` |

**Go 侧（`internal/report-designer/` + `internal/bi-dashboard/`）**

| 模块 | 行数 | 差异 |
|---|---|---|
| `report-designer/service/service.go` | 341 | 完整镜像 TS 版本，**但 `ExecuteReport:290-318` 是 mock**——建一条 `status:running` 记录，立刻 `UpdateExecutionStatus("completed")` + `outputPath = "reports/"+id+"/"+eid+".pdf"` 字符串拼接返回 |
| `bi-dashboard/models.go` | 31 | **只有 `id / tenant_id / name / created_at / updated_at` 五字段**——**bi-dashboard 是空壳模块**，与 report-designer 无关 |

**前端（`pages/ReportDesigner/`，1460 行）**

| 文件 | 行数 | 内容 |
|---|---|---|
| `index.tsx` | 79 | Tab 容器 |
| `ReportsTab.tsx` | 90 | 报表列表 |
| `DataSourcesTab.tsx` | 68 | 数据源列表 |
| `SchedulesTab.tsx` | 65 | 定时列表 |
| `ExecutionsTab.tsx` | 48 | 执行历史 |
| `ReportDesignerModals.tsx` | 321 | 元数据 CRUD Modal（**无 layout 编辑器**） |
| `ReportDesignerColumns.tsx` | 334 | 表格列定义 |
| `useReportDesignerState.ts` | 355 | 状态管理 |

### 2.2 与 NeatLogic 概念映射

| NeatLogic 概念 | Orion 现状 | 差距 |
|---|---|---|
| Dashboard（系统/个人） | `DashboardNew` + `DashboardCore`（硬编码 2 页）+ `bi-dashboard`（空壳） | Orion 的"仪表板"实际是"运营工作台"，是**页面代码**而非"数据实体" |
| Data Matrix | 无对应 | Orion 有 `NotificationEnhanced/MatrixTab` 但语义是"通知矩阵"，是命名污染 |
| Data Warehouse | 无对应 | 全仓零命中 |
| Report Template | `ReportDefinition` 表 | 结构接近，缺 layout 可视化 |
| Report Data Source | `ReportDatasource` 表 | 有类型（sql/api/promql）无执行 |
| Report Schedule | `ReportSchedule` 表 | 有表无 Runner |
| Report Export | `ReportExecution.exportFormat` 字段 | 有字段无文件生成 |

### 2.3 真实完成度百分比

- **报表域**：TS 服务 CRUD 完整度 **~70%**（18/18 方法都在）；执行器/调度器/导出器 **0%**；前端编辑 **20%**（仅元数据表单）。综合 ≈ **25%**
- **仪表板域**：**0%**（`bi-dashboard` 只有 name 字段，无 layout 无组件；硬编码页面不算 BI 仪表板）
- **数据矩阵域**：**0%**（无数据矩阵，两处"Matrix"均是其他语义）
- **数据仓库域**：**0%**（完全无此概念）
- **整体 BI 域**：≈ **14%**（加权，报表占权重最大）

---

## 3. 数据矩阵深度分析

### 3.1 NeatLogic 数据矩阵的 4 种数据源

NeatLogic "数据矩阵"不是"数据表格"，而是**"下拉选项/维度值的数据源抽象"**——它是 BI 与业务数据之间的第一层解耦：
- **静态数据源**：`[{label:"生产", value:"prod"}, ...]`，硬编码在矩阵中
- **接口数据源**：HTTP GET `/api/envs`，响应映射成 `label/value`
- **CMDB 视图数据源**：调用 CMDB 视图 API（如"所有运行中的应用"）
- **SQL 查询视图**：内嵌 SQL（如 `SELECT DISTINCT env FROM deployments`），带参数绑定

NeatLogic 数据矩阵的**核心价值**：让所有仪表板组件、报表过滤条件、下拉字段共用同一份"维度定义"，实现**指标口径统一**。这是 Looker Semantic Layer / dbt Semantic Layer 的核心思想。

### 3.2 Orion 当前"下拉数据源"方案

**没有**。全仓 `grep options / optionsApi / dropdown-source / dimension-source` **零命中**。所有下拉框都是硬编码：
- `pages/ReportDesigner/index.tsx` 的 `categoryOptions` 在 tsx 常量数组里
- `pages/NotificationEnhanced/MatrixTab.tsx:38-43` 的 `TYPE_OPTIONS` 也是硬编码

**这意味着**：如果用户改了"应用列表"，所有仪表板/报表的过滤下拉框都要改前端代码。

### 3.3 建议的 Orion 数据矩阵设计

**架构（5 层）**：

```
┌──────────────────────────────────────────────────┐
│  MatrixClient (frontend)                         │
│    api/dataMatrices/:id/values (带参数)          │
└───────────────────────┬──────────────────────────┘
                        │ HTTP
┌───────────────────────▼──────────────────────────┐
│  Matrix Service (Go)                             │
│    GetValues(matrixId, params) → []Option        │
│    带租户隔离 + ACL + 参数校验                    │
└───────────────────────┬──────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────┐
│  Adapter Interface                               │
│    Fetch(ctx, params) ([]Option, error)          │
└──┬──────────┬──────────┬──────────┬──────────────┘
   │          │          │          │
StaticHTTP    SQL        CMDB       (可扩展)
   │          │          │
   │    ┌─────▼────┐  ┌─▼─────┐
   │    │ pg pool  │  │ CMDB  │
   │    │ (只读)   │  │ client│
   │    └──────────┘  └───────┘
└──────────────────────────────────────────────────┘
              + Redis 缓存（TTL 可配）
```

**统一接口（Go 伪代码）**：

```go
type MatrixAdapter interface {
    Type() string                                    // "static"|"http"|"sql"|"cmdb"
    ValidateConfig(cfg json.RawMessage) error
    Fetch(ctx context.Context, params map[string]string) ([]Option, error)
}
type Option struct { Label, Value string; Meta json.RawMessage }
```

**缓存策略**：
- 静态：进程内 map，重启失效
- HTTP：Redis 60s TTL + 请求超时 5s
- SQL：**默认强制 read-only 用户 + `SET statement_timeout='5s'`**（防拖库）+ Redis 300s TTL
- CMDB：Redis 300s TTL + 租户隔离
- 全局：`Cache-Control: private, max-age=60` 让前端浏览器也缓存 60s

**权限模型**：
- Matrix 本身有 `tenant_id + owner_id + visibility(public/private)` 三属性
- 查询时校验：`caller.tenant_id == matrix.tenant_id AND (visibility='public' OR caller.role IN matrix.acl)`
- **关键**：矩阵返回的 `Option.value` 本身不能含 PII（不能放用户邮箱），只放内部 ID

---

## 4. 数据仓库深度分析

### 4.1 NeatLogic 数据仓库（过程数据→高阶管理对象）剖析

NeatLogic 数据仓库的定位是**面向 IT 运维语义的轻量数仓**，而非传统数仓的"仓库"：

- **过程数据**：Pipeline 运行日志、告警事件、变更单、CMDB 变更历史、任务执行结果——都是**高频写入、原始格式**（`pipeline_run_events`, `alert_events`, `change_orders` 等业务表）
- **高阶管理对象**：`团队月度交付效率`、`变更成功率`、`MTTR`、`变更失败率`、`SLA 达成率`——都是**低频查询、预聚合、有业务口径**
- **核心价值**：把"团队/服务/流水线/时间窗"四维聚合，让管理者一眼看到效率数字

**NeatLogic 的做法**：
1. **数据源绑定**：把过程数据表映射为"数据对象"（例如"流水线执行明细"）
2. **过滤条件 DSL**：`{service: 'payment', timeRange: 'last-30d', team: 'platform'}`
3. **数据模式**：
   - 全量替换：每次同步全表重算（如"团队列表"）
   - 增量追加：按 `updated_at > watermarks[i]` 追加（如"事件日志"）
4. **同步触发**：手工（管理员点按钮）+ 定时（cron 每 15 分钟）
5. **消费**：仪表板、报表、大屏直接查高阶对象，不碰原始表

### 4.2 Orion 当前有无类似能力

**完全没有**。证据：

| 检查项 | 命中 | 说明 |
|---|---|---|
| `grep -i "data_warehouse / dwh / ods / dwd / dws / ads"` | 0 | 无分层概念 |
| `grep -i "semantic_layer / metrics_layer / cube"` | 0 | 无语义层 |
| `grep -i "watermark / high_watermark"` | 0 | 无增量同步水位 |
| `grep -i "materialize / aggregation"` | 0 | 无物化聚合 |
| `grep "team_monthly / mttr / sla_rate"` | 0 | 无高阶管理对象 |

**Orion 现状**：所有"报表"都在原始业务表上直接 JOIN——`pipeline_runs JOIN pipeline_stages JOIN tasks`。当数据量到百万级，每次报表打开都要跑大 JOIN，会拖垮主库。

### 4.3 建议的 Orion 数仓分层设计

**分层**（贴齐 dbt 规范）：

```
┌─────────────────────────────────────────────────┐
│ ADS (Application)   ← Orion 报表/仪表板消费       │
│  ads.team_monthly_metrics (30d 窗口)              │
│  ads.service_sla_daily                            │
│  ads.change_failure_rate                          │
├─────────────────────────────────────────────────┤
│ DWS (Summary)       ← 预聚合，天/小时粒度         │
│  dws.pipeline_run_daily                           │
│  dws.alert_summary_hourly                         │
│  dws.change_summary_daily                         │
├─────────────────────────────────────────────────┤
│ DWD (Detail)        ← 清洗后的明细                │
│  dwd.pipeline_run_detail (去重/字段标准化)         │
│  dwd.alert_detail                                   │
├─────────────────────────────────────────────────┤
│ ODS (Raw)           ← 业务表快照/事件流           │
│  ods.pipeline_run_events                          │
│  ods.change_orders                                │
│  ods.loki_logs_hourly (Prometheus/Loki 拉取)     │
└─────────────────────────────────────────────────┘
```

**数据源适配（4 类）**：

| 类别 | 源 | 采集方式 |
|---|---|---|
| 业务库 | PG（当前生产库） | Replication Slot（逻辑复制）→ ODS |
| 日志 | Loki / ES | HTTP API 拉取 → `ods.logs_hourly` |
| 监控 | Prometheus | `api/v1/query_range` → `ods.metrics_daily` |
| 事件流 | NATS / Kafka | Consumer → `ods.events` |

**数据对象 + 过滤条件 DSL**（YAML）：

```yaml
id: team_monthly_delivery
name: 团队月度交付效率
layer: ADS
source: dws.pipeline_run_daily
dimensions: [team, month]
measures:
  total_runs: { agg: sum, col: runs }
  success_rate: { formula: "success_runs / total_runs" }
  avg_duration: { agg: avg, col: duration_seconds }
filters:
  - field: status
    op: in
    values: [success, failed]
  - field: created_at
    op: greater_than
    value: "${current_month_start}"
refresh:
  mode: full_replace
  cron: "0 0 3 * * *"    # 每天 03:00 全量刷新
```

**全量替换 vs 增量追加**：

- 全量：`TRUNCATE ads.team_monthly_delivery + INSERT SELECT ...`，事务保护；适用于小表（<100 万行）
- 增量：`INSERT INTO dws.pipeline_run_daily SELECT * FROM dwd.pipeline_run_detail WHERE created_at > watermarks.last_watermark`，事务后 `UPDATE watermarks SET last_watermark = $NOW WHERE key = 'pipeline_run_detail'`

**同步调度**：
- 人工：管理员 UI 触发 `POST /dw/sync/{datasetId}?force=true`
- 定时：`robfig/cron` 消费上表 `refresh.cron`
- **失败告警**：连续 3 次失败 → 发 P0 告警到 Slack/邮件

**数仓 API**：

```
GET  /api/v1/dw/datasets                              # 列出数据对象
GET  /api/v1/dw/datasets/:id/preview?params=...       # 预览数据
POST /api/v1/dw/datasets/:id/sync                     # 触发同步
GET  /api/v1/dw/datasets/:id/watermark                # 查水位
GET  /api/v1/dw/metrics/:metricId/query?team=X&month=Y  # 语义层查询
```

**关键设计原则**：
1. **ADS 表永远在独立 schema 或独立库**（避免拖垮主库）
2. **同步任务有幂等性**：重跑不重复
3. **数据对象版本号**：`version` 字段用于跨环境（dev→staging→prod）
4. **指标口径审计**：任何 ADS 表都有 `metric_definition` 表记录口径变更历史

---

## 5. 报表模板引擎深度分析

### 5.1 NeatLogic 报表模板的 6 大要素

| 要素 | NeatLogic 定义 |
|---|---|
| 显示界面 | 报表的整体布局（列宽、行高、分页） |
| 过滤条件 | 用户可交互的过滤器，参数注入数据源 |
| 数据源 | TSQL（TeamSystem/TongTech SQL）或 REST API |
| HTML 组件 | 允许注入自定义 HTML（图表/文字块） |
| 呈现控件 | 表格、图表、文本、图片、页眉页脚 |
| 权限 | 报表级 ACL，谁可以看、谁可以执行、谁可以导出 |

### 5.2 Orion report-designer 现状

**数据结构层面**（合格）：
- `report_definition.layout JSONB` 可以承载显示界面
- `report_definition.components JSONB[]` 可以承载呈现控件
- `report_definition.datasource_bindings JSONB` 可以承载数据源绑定
- `report_schedule.recipients JSONB` 可以承载权限+收件人
- 前端字段全部对应得上

**执行层面**（全缺）：
- **无布局编辑器**：`ReportDesignerModals.tsx` 只有 CRUD 表单
- **无 SQL 执行引擎**：`ReportDatasource` 只是元数据，无 `pgPool.query(sql)`
- **无 REST 数据源执行**：无 `axios.get(url, config.params)` 的报表执行器
- **无 HTML 组件**：全仓无 iframe sandbox / postMessage 通道
- **无导出引擎**：全仓 `grep pdfkit|sheetjs|excelize|libreOffice` **零命中**
- **无定时调度**：全仓无 cron 消费 `report_schedule.cron_expr`

### 5.3 建议的 Orion 报表引擎架构

**5.1 报表 DSL（JSON Schema）**：

```json
{
  "reportId": "rpt-payment-sla-2026",
  "version": "1.2.0",
  "meta": {
    "name": "支付服务 SLA 月度报告",
    "category": "SRE",
    "owner": "sre-team"
  },
  "parameters": [
    { "id": "team", "type": "select", "matrixRef": "mat.teams", "required": true },
    { "id": "month", "type": "date", "default": "${current_month}" }
  ],
  "sections": [
    {
      "id": "section-overview",
      "type": "grid",
      "columns": 3,
      "children": [
        {
          "id": "metric-total-runs",
          "type": "stat-card",
          "datasourceId": "ds.pipeline_daily",
          "metric": "total_runs",
          "params": { "team": "${team}", "month": "${month}" }
        },
        {
          "id": "chart-trend",
          "type": "line-chart",
          "datasourceId": "ds.pipeline_daily",
          "dimensions": ["date"],
          "measures": ["runs", "success_rate"],
          "x": "date",
          "series": "team"
        },
        {
          "id": "html-footer",
          "type": "html",
          "html": "<div class='signature'>签署：${author}</div>",
          "sandbox": true
        }
      ]
    }
  ]
}
```

**5.2 数据源适配器**：

```go
type ReportDatasourceAdapter interface {
    Type() string  // "sql" | "rest" | "promql" | "tongtech"
    Query(ctx context.Context, cfg ReportDatasourceConfig, params map[string]string) ([]ReportRow, error)
}
```

- **SQL 适配器**：走独立 read-only PG 连接 + `statement_timeout=30s` + SQL 白名单校验（`grep "SELECT|UNION"` 且不含 `DROP/DELETE/INSERT/UPDATE`）
- **REST 适配器**：走 http.Client + 认证头注入 + 响应 JSONPath 提取
- **TSQL 适配器**：如 NeatLogic 兼容需要，走 TongTech SQL 方言驱动

**5.3 呈现组件库**（前端，基于 ECharts + AntD）：

- **stat-card**：单个指标卡（已有 `components/charts/StatCard.tsx`）
- **table**：带筛选/排序/分页的数据表
- **line-chart / bar-chart / pie-chart**：已有 11 个 ECharts 封装
- **radar / gauge / heatmap / sankey / treemap**：已有
- **html**：iframe sandbox + CSP（**关键**：`sandbox="allow-scripts"` + `script-src 'self' 'unsafe-inline'` 白名单）
- **text-block**：富文本编辑器（TipTap / ProseMirror）
- **image / logo / watermark**：图片块

**5.4 权限控制**（3 层）：

1. **报表级**：`report.definition.tenant_id + acl JSONB`
2. **参数级**：报表参数（如 `team`）可限定可选范围（如只看自己团队的报表）
3. **导出级**：per-report 决定谁能 PDF/Excel 导出

**5.5 Word/Excel/PDF 导出技术选型**：

| 格式 | 推荐库 | 场景 |
|---|---|---|
| PDF | **`wkhtmltopdf`（headless Chromium）+ HTML** | 最推荐。HTML 报表 + wkhtmltopdf = 高质量 PDF，字体/样式可控 |
| Excel | **`excelize/v2`**（Go 原生）或 **SheetJS**（TS 侧） | 直接生成 xlsx，支持样式/合并/公式 |
| CSV | 纯文本 | 简单导出 |
| Word | **`docxtpl` 变体**：Go 用 `unidoc/unioffice`（付费）或 `pakepdf/docx`；更实用：HTML → LibreOffice CLI `soffice --convert-to docx` | 复杂样式走 LibreOffice，简单表格走 unioffice |

**LibreOffice 选型理由**：一个二进制搞定 Word/PPT/PDF 互转，容器镜像里跑 `soffice --headless --convert-to pdf in.html`，代价是镜像 +500MB。

**5.6 定时发送**：

- **cron 消费者**：`robfig/cron/v3` + `report_schedule` 表扫描
- **发送通道**：走 `internal/notification` 现有邮件/Slack/钉钉通道（`grep` 确认有真实 SMTP 实现）
- **失败重试**：最多 3 次，指数退避（1min/5min/15min）
- **发送记录**：`report_execution` 表 `status: succeeded/failed/retried`
- **并发控制**：全局 worker pool = CPU 核数 / 2，防止定时任务堆积打爆内存

---

## 6. 关键短板（BI / 数据工程专家视角，P0/P1）

### P0（必须解决，否则 BI 域不可用）

1. **报表执行器完全缺失（P0-1）**
   - 现状：`ReportDefinition` 元数据完备，但 `ExecuteReport` 只写一条 `status:completed` 记录，不生成任何输出
   - 影响：整个报表域的 60% 权重（生成 + 导出 + 定时）都是空的
   - 工时：**25 人天**

2. **数据矩阵完全缺失（P0-2）**
   - 现状：无 `data_matrix` 表，所有下拉硬编码在前端 tsx
   - 影响：指标口径无法统一，多报表之间数字对不上是必然
   - 工时：**20 人天**

3. **数据仓库完全缺失（P0-3）**
   - 现状：全仓零命中，直接在业务库上跑报表 JOIN
   - 影响：报表打开会拖垮生产库，无法承载团队/服务月度分析
   - 工时：**30 人天**（Phase 1：ODS/DWD/ADS 3 层 + 核心 5 个 ADS 数据集）

4. **仪表板"实体"是空壳（P0-4）**
   - 现状：Go `bi-dashboard` 模型只有 `name` 字段，无法承载任何可视化定义
   - 影响：用户无法创建个人仪表板，无法保存/分享
   - 工时：**15 人天**（对齐 report-designer 的 layout/components 结构）

5. **报表导出零实现（P0-5）**
   - 现状：`exportFormat` 字段齐、`ReportExecution.outputPath` 是字符串拼接，无文件生成
   - 影响：报表不能落地到用户邮箱/桌面
   - 工时：**15 人天**（PDF/Excel 二选一，推荐 PDF 走 wkhtmltopdf）

### P1（重要但可延后）

6. **报表访问权限只有全局 ACL（P1-1）**：`requirePermission` 挂的是资源级，不是报表级；无"某团队只能看自己报表"能力
7. **报表实时更新缺失（P1-2）**：无 WebSocket/SSE，`refreshInterval` 字段是死数据
8. **报表模板无实例化流程（P1-3）**：`templateId` 字段有定义但从不被读
9. **仪表板拖拽布局缺失（P1-4）**：无 react-grid-layout
10. **TSQL / REST 数据源无执行（P1-5）**：类型定义了但服务层不执行

---

## 7. 领域特有反模式 / 陷阱

作为 15 年 BI 老兵，我看到 Orion 目前的报表设计里埋着 **8 个定时炸弹**：

### 7.1 报表数据陈旧（缓存失效）
`ReportDatasource.refreshInterval` 字段定义了但**无任何缓存层**。如果不缓存，每次报表打开都打到源库；如果缓存不做 TTL，用户看到的永远是老数据。**必须**：Redis + `Cache-Control` + `X-Cache: HIT/MISS` 响应头，让运维知道数据新鲜度。

### 7.2 SQL 注入（用户自定义 SQL）
`ReportDatasource.config JSONB` 存 SQL 文本，未来一旦开放用户输入，**必须**：
- 强制走 **只读账号**（`GRANT SELECT ON ads.* TO report_ro`）
- SQL AST 解析校验（`prettier` / `pgsql-parser` / `libpg_query`），拒绝 `;` `DROP` `DELETE` `INSERT` `UPDATE` `CREATE` `ALTER`
- 白名单表（只能查 `ads.*` `dws.*` `dwd.*`，禁止 ODS 和主库表）
- `SET statement_timeout='30s'`（防拖库）
- `row_limit=10000`（防 OOM）

### 7.3 大数据量渲染性能
11 个 ECharts 图表默认无虚拟化。**报表打开超过 3 秒用户会走**。必须：
- 单报表数据点上限 **5000 个**（超出走服务端采样）
- 图表组件 `React.memo` + `useMemo`
- 大表分页（`limit=100`）
- 报表页 `React.lazy` + `Suspense` 拆包

### 7.4 权限泄露（越权查询）
**NeatLogic 有 per-report ACL，Orion 只有全局 ACL**。这意味着：租户 A 的用户能查看租户 B 的报表定义（如果 `tenant_id` 隔离不严）。必须：
- 所有查询强制 `WHERE tenant_id = $currentUser.tenantId`
- 报表参数注入前**双重校验**：`caller.tenant_id == report.tenant_id`
- 数据源 config JSONB 里禁止放 `password` 明文（用密钥管理服务引用）

### 7.5 定时任务堆积
`report_schedule.cron_expr` 一旦用户配了 `*/5 * * * *`（5 分钟一次），1000 个报表 × 每 5 分钟 = 12000 次/小时的报表执行。**必须**：
- 全局 worker pool（默认 = CPU 核数 / 2）
- 每租户配额（如每租户并发上限 = 5）
- 单报表并发锁（同一 report_id 不并发执行）
- 死信队列（连续失败 5 次自动禁用 schedule + 告警）

### 7.6 数据一致性与并发
全量替换同步时，ADS 表 `TRUNCATE + INSERT` **必须**在事务里，且要 `LOCK TABLE ... IN ACCESS EXCLUSIVE MODE`。否则**用户查询会读到空表**（TRUNCATE 已完成、INSERT 未完成）。**必须**：
- **双表切换模式**：`ads.team_monthly_v2` 全量写入 → `ALTER TABLE ... RENAME` → 原表变 `v1` 归档
- 或走 **`COPY ... TO TEMP_TABLE`** 再 swap

### 7.7 报表模板跨环境迁移
dev 环境报表定义 `datasource_id: ds.pipeline_daily`，推到 staging/prod 时这个 id 变了怎么办？必须：
- **数据源用 name 引用**而非 id（`datasource: "pipeline_daily"`，环境映射表解析）
- 报表 DSL 有 `version` 字段，跨环境走变更流程
- 提供 `POST /reports/import?versionFrom=dev&versionTo=staging` 迁移端点

### 7.8 报表性能雪崩（隐藏杀手）
11 张报表 × 每 5 分钟定时 × 每张查 30 个数据源 = 660 次/分钟的报表查询。如果每次 SQL 都是 `SELECT * FROM ods.pipeline_events WHERE team='X'` 且无索引，会把源库打爆。**必须**：
- 所有 ADS 查询走**物化视图**（`MATERIALIZED VIEW ... WITH DATA`）
- 报表服务独立 DB 连接池（不能复用主业务池）
- 单报表 SQL 耗时 > 5s 自动降级为 5 分钟前的缓存

---

## 8. Phase 建议 + 工时校准

### Phase 0：报表可执行（基础止血，2 周）

**目标**：让 `ExecuteReport` 真的产出文件。

| 任务 | 工时 |
|---|---|
| 引入 `wkhtmltopdf` 二进制（Dockerfile 加 apt-get） | 1 |
| 报表 → HTML 模板引擎（`html/template`） | 5 |
| HTML → PDF 转换 + 上传对象存储 | 3 |
| 前端下载链接 | 2 |
| 单测 + 集成测试 | 3 |
| **合计** | **14 人天** |

### Phase 1：报表数据源执行（3 周）

**目标**：`ReportDatasource` 真的能查数据。

| 任务 | 工时 |
|---|---|
| SQL 适配器（只读账号 + AST 校验 + timeout） | 8 |
| REST 适配器（认证 + JSONPath） | 5 |
| 报表 DSL v1（`sections / parameters / components` schema） | 8 |
| 前端布局编辑器（react-jsonschema-form 起手，不上 Gantt） | 8 |
| **合计** | **29 人天** |

### Phase 2：数据矩阵 + 语义层（4 周）

**目标**：统一指标口径。

| 任务 | 工时 |
|---|---|
| `data_matrix` 表 + CRUD + 4 类 adapter | 15 |
| 前端 `MatrixPicker` 组件（下拉自动挂矩阵） | 5 |
| 缓存层（Redis + TTL + Cache-Control） | 5 |
| 权限模型（tenant + visibility + ACL） | 3 |
| **合计** | **28 人天** |

### Phase 3：轻量数仓（6 周）

**目标**：ODS/DWD/DWS/ADS 4 层 + 5 个核心数据集。

| 任务 | 工时 |
|---|---|
| 表设计 + Migration | 5 |
| ODS 层（业务表 snapshot + Prometheus/Loki 拉取） | 10 |
| DWD 层（清洗/去重/标准化） | 8 |
| DWS 层（预聚合 daily/hourly） | 8 |
| ADS 层（5 个管理数据集：团队月度/服务 SLA/变更成功率/MTTR/告警 TopN） | 12 |
| 同步调度器（cron + 水位 + 失败告警） | 8 |
| 数仓 API（`/dw/datasets` `/dw/metrics/query`） | 5 |
| **合计** | **56 人天** |

### Phase 4：仪表板 + 导出升级（4 周）

**目标**：用户可创建个人仪表板，报表可 Excel/Word 导出。

| 任务 | 工时 |
|---|---|
| `bi-dashboard` 模型升级（layout/components JSONB） | 5 |
| 前端拖拽布局（react-grid-layout） | 8 |
| Excel 导出（`excelize/v2`） | 5 |
| Word 导出（LibreOffice CLI + 镜像集成） | 5 |
| 定时调度（robfig/cron + worker pool + 死信队列） | 8 |
| 发送通道集成（SMTP + Slack + 钉钉） | 4 |
| **合计** | **35 人天** |

### 总工时

**Phase 0-4 合计 ≈ 162 人天 ≈ 32 周单人力 ≈ 8-10 周双人力**

### 优先级建议

如果只有 40 人天预算（4 周），做 **Phase 0 + Phase 1**：
- 报表能真的生成 PDF（止血）
- 报表能真的查 SQL（打通数据）
- 报表布局先跑起来（前端 JSON schema 编辑）

**Phase 2 数据矩阵必须与 Phase 3 数仓同期规划**，否则会有"每份报表各自查询、口径对不上"的经典灾难。

### 认知边界（诚实声明）

1. 本报告未验证 `orion-platform-service/src/services/`（工作区未检出，仅 `legacy/` 存在）
2. 本报告未验证 Python 微服务（`orion-ai-service` / `orion-ai-agents-svc`）是否有 BI 实现
3. `grep -i grafana` 在 TS 侧零命中，但 CLAUDE.md 声称"有 Grafana 集成"，此处存疑，需以权威实现复核
4. `ReportSchedule.recipients JSONB` 有字段但全仓 `grep` 无消费代码，可能是历史遗留

---

## 结语

Orion 在 BI 域的现状可以概括为：**"元数据完备、执行缺失"**。报表/仪表板/数据源/定时任务 4 张表都建好了，字段设计也贴合 NeatLogic 概念，但**没有一行代码真的把元数据变成输出**——报表执行器返回的是字符串路径而非文件，定时调度表建了但 cron 消费者不存在，Excel/PDF 导出类型定义了但没有依赖安装。

对于 BI / 数据工程领域，这种"半成品"比"完全缺失"更危险：
- 用户看到"报表设计器"会以为能用，实际不能
- 字段设计已经"约定俗成"，重构成本更高
- 前端有 UI 但后端空转，会累积大量 mock 数据污染测试

**建议**：Phase 0（14 人天）先做报表可执行，让 `ExecuteReport` 真的产出 PDF——这是所有 BI 域能力恢复信任的最小闭环。之后再逐步补齐数据矩阵和数仓。

**一句话总结**：**Orion 的 BI 域是"看起来齐、用起来空"的典型案例——建议按 Phase 0-4 分阶段落地，40 人天可实现 50% 权重，162 人天可实现 95% 权重。**
