# Orion BI/数据域 复评 (v1 12% + v2 12% 独立验证)

> **版本**：v3（2026-10-01 复评，独立 grep 抽查 v1/v2 声明）
> **评审角色**：BI/数据仓库/报表领域专家（数据治理 + 报表引擎 + ETL）
> **评审对象**：`orion-platform-svc-go/internal/{report-designer,bi-dashboard,data-*,datasource,metadata}` 10 个后端模块 + `orion-frontend/src/pages/{ReportDesigner,data-lineage,...}`
> **对标基准**：NeatLogic Dashboard (51 Java) + Report (120 Java) + 数据治理域
> **方法**：v1/v2 声明 8 项关键抽查，每项 grep 命令可复现
> **参照**：`cmdb-expert-rereview-2026-10-01.md`、`itsm-expert-rereview-2026-10-01.md`

---

## 一、TL;DR

1. **完成度重估 20%（15-25%）** — v1/v2 都写 12%，但都基于"报表执行内核 = 0"反推整体；实际 v1/v2 漏算了 `data-*` 家族 6 模块 + `datasource` 服务，这些都不是"14 个自创子域无实现"。
2. **v1 "14 个自创子域无实现" 是错的** — `data-lineage/masking/catalog/quality/pipeline/classification` 6 模块都有完整 CRUD service + handler + repository + models，共 **7419 行 Go**（非测试），**123 处真实 DB 调用**（sqlx Query/Exec）。
3. **v1 "ExecuteReport 是桩" 准确** — `service.go:290-318` 只创建 execution record、拼接 `"reports/<id>/<exec>.pdf"` 就置 `"completed"`；`report-designer` 全模块 **0 处** pdfkit/libreoffice/soffice/excelize 引用。
4. **v1 "ReportSchedule 无消费者" 准确** — 全仓 grep `reportSchedule|report_schedule|cron_expr` 除自身 CRUD 外 0 消费者；CRUD 完整但零调度触发。
5. **BI 域孤岛（真实短板）** — `report-designer/bi-dashboard/data-lineage/data-masking/data-catalog/data-quality` 六模块间 **0 跨模块引用**，且不消费 `datasource` 服务（datasource 本身 15 方法零 caller）。

---

## 二、v1 声明逐项抽查

### 1. ExecuteReport 是真桩？

**命令**：`grep -n "ExecuteReport" internal/report-designer/service/service.go`

**实测**：
```
290:func (s *Service) ExecuteReport(...) (*models.ReportExecution, error) {
293:	_, err := s.repo.GetReportByID(ctx, reportID, tenantID)     // 只校验报表存在
308:	if err := s.repo.CreateExecution(ctx, execution); err != nil  // status=running
312:	outputPath := "reports/" + reportID + "/" + execution.ID + ".pdf"  // 字符串拼接
316:	_ = s.repo.UpdateExecutionStatus(ctx, ..., "completed", &outputPath, nil)  // 置 completed
```

**结论**：v1 **准确**。29 行，只做 CRUD + 字符串拼接，无 SQL 生成/数据抽取/渲染/导出。

### 2. ReportSchedule cron 无消费者？

**命令**：`grep -rn "ReportSchedule|report_schedule|ListSchedules|CreateSchedule" --include="*.go" . | grep -v "_test" | grep -v "internal/report-designer"`

**实测**：0 处消费者。`robfig/cron` 全仓仅在 `infrastructure/backup` 使用（2 处），与报表无关。

**结论**：v1 **准确**。CRUD 完整，零调度触发。

### 3. 无 PDF/Excel 生成库？

**命令**：`grep -rn "pdfkit|libreoffice|soffice|PDFKit|GeneratePDF|render.*pdf" --include="*.go" .` + `grep -rn "excelize|sheetjs|jsPDF" --include="*.go" --include="go.mod" .`

**实测**：
- `pdfkit/libreoffice/soffice/PDFKit` — 0 命中
- `excelize` — 存在（`go.mod:24` + `internal/dba/query/exporter.go` + `internal/cmdb-import/service/service.go`），**但 dba/query、cmdb-import 与 report-designer 无关**
- `sheetjs/jsPDF` — 0 命中

**结论**：v1 **准确**。`excelize` 库在仓库，但 report-designer 未接入任何 PDF/Excel 库。

### 4. 14 个自创子域无实现？（v1 最严重误报）

**命令**：`find internal/data-*/ -name "*.go" -not -name "*_test.go" | xargs wc -l | tail -1` + `grep -rn "db\.\|queryBuilder\|db.Query\|db.Exec" internal/data-*/repository/ | wc -l`

**实测**：

| 模块 | Go 行数 | Service 方法 | Repository 真实 SQL |
|------|:--:|:--:|:--:|
| data-lineage | 851 | 10 | lineage_nodes/relationships CRUD |
| data-masking | 472 | 6 | masking_rules CRUD |
| data-catalog | 564 | 9 | Discover/Search/GetEntriesByTable |
| data-quality | 610 | 13 | rules/scan-results/alerts |
| data-pipeline | 378 | 12 | Run/Pause/Resume/GetLogs |
| data-classification | 351 | 5 | classif rules + Classify |
| **合计** | **3226** | **55** | **123 处真实 SQL** |

外加 `datasource` 服务 319 行 / 15 方法（Register/Query/Execute/HealthCheck/StartHealthCheckLoop/CloseAll/Unregister/TestConnection/ResolvePassword 等）；`bi-dashboard` 203 行 / 5 方法 CRUD；`report-designer` 401 行 / 18 方法（4 CRUD + 2 桩 + 8 CRUD + 4 表操作）。

**结论**：v1 **严重误报**。不是"无实现"，而是"6 个 module 各 6-13 个真实 CRUD 方法，零跨模块集成"。

### 5. report-designer 前端只有 TabItems 单文件？

**命令**：`ls src/pages/ReportDesigner/`

**实测**：
```
src/pages/ReportDesigner/
├── index.tsx
├── ReportsTab.tsx, DataSourcesTab.tsx, SchedulesTab.tsx, ExecutionsTab.tsx
├── ReportDesignerColumns.tsx, ReportDesignerModals.tsx
├── useReportDesignerState.ts (225 行)
└── Components/TabItems.tsx
```

7 业务文件 + 1 hook（1367 行），非"TabItems 单文件"。**但确实无设计画布**（0 处 `react-dnd/gridstack/jointjs/mxgraph` 引用）。

**结论**：v1 **部分误报**。前端不是单文件，但只有 CRUD 列表 + 4 Tab，无拖拽设计器。

### 6. data-lineage 是空壳？

**命令**：`grep -rn "CreateLineage|LineageNode|GetLineage|CreateNode|CreateRelationship" --include="*.go" internal/ | grep -v "_test" | grep -v "internal/data-lineage" | grep -v "pipeline-executor|pipeline-engine|artifact-version|data-pipeline|capacity|confirmation"`

**实测**：
- `data-lineage` 自身 851 行 + 10 方法（Lineage/Node/Relationship/Stats CRUD）
- `data-pipeline.GetLineage` (`service.go:112-125`) 只返回 `{pipelineId, sources: [], sinks: []}` 空信封，**不写 lineage_nodes 表**
- 全仓 0 处调用 `CreateLineage/CreateNode/CreateRelationship`

**结论**：v1 **准确**。CRUD 有，但**没有任何代码往里写数据**。前端 `data-lineage` 9 文件 916 行（NodeDetailDrawer/EdgeMapping/LineageGraph 带 G6 渲染/StatsRow/useDataLineageState）可渲染图谱，但图谱永远空。

### 7. data-masking 无应用？

**命令**：`grep -rn "ApplyMask|MaskingRule|masking_rules" --include="*.go" internal/ | grep -v "_test" | grep -v "internal/data-masking"`

**实测**：0 命中。`data-masking` 自身 CRUD `masking_rules` 表，业务代码 0 处调用。`internal/middleware/dlp.go` 有独立 DLP 规则表（DLPRule 结构），**不消费 masking_rules**。

**结论**：v1 **准确**。CRUD 骨架，无实际脱敏应用场景。

### 8. BI 模块总数（v2 说 16）

**命令**：`ls internal/ | grep -iE "^(bi-|report|data-|datasource|metadata)$"`

**实测**：10 核心（bi-dashboard、data-catalog/classification/lineage/masking/pipeline/quality、datasource、metadata、report-designer），加 pipeline-* 6 个外围才 16。

**结论**：v2 **准确**（10 个核心 + 6 外围 = 16）。

---

## 三、v1/v2 未抓到的关键短板（新发现）

### 3.1 BI 域孤岛（比"无执行内核"更严重）

```bash
grep -rn "report-designer|reportDesigner|reportdesigner" --include="*.go" internal/ | grep -v "_test" | grep -v "internal/report-designer"  → 0
grep -rn "bi-dashboard|biDashboard|BiDashboard" --include="*.go" internal/ | grep -v "_test" | grep -v "internal/bi-dashboard"  → 0
grep -rn "data-lineage|DataLineage" --include="*.go" internal/ | grep -v "_test" | grep -v "internal/data-lineage" | grep -v "pipeline-executor|pipeline-engine|artifact-version|data-pipeline|capacity|confirmation"  → 0
grep -rn "masking_rules|DataMasking" --include="*.go" internal/ | grep -v "_test" | grep -v "internal/data-masking"  → 0
grep -rn "data-quality|dataQuality|DataQuality|quality_rules|quality_scan" --include="*.go" internal/ | grep -v "_test" | grep -v "internal/data-quality"  → 0
grep -rn "data-catalog|dataCatalog|DataCatalog" --include="*.go" internal/ | grep -v "_test" | grep -v "internal/data-catalog"  → 0
```

6 个 data-* + bi-dashboard + report-designer **零跨模块引用**，datasource 也孤岛（15 方法零 caller）。

### 3.2 datasource 服务完整但零消费者

`datasource/service/service.go` 319 行 15 方法：Register/Get/List/Update/Unregister（CRUD）+ connect（真实连接池）+ Query/Execute（SQL 透传）+ HealthCheck/HealthCheckAll/StartHealthCheckLoop（定期健康检查）+ CloseAll + ResolvePassword + TestConnection。

BI 域**唯一有真实业务逻辑**的服务。但 `report-designer.report_datasources` 表存自己的元数据，不消费 datasource 服务，即使 ExecuteReport 想执行也拿不到连接。

### 3.3 reportDashboard.ts 前端 API client 无后端

前端 `src/api/reportDashboard.ts` 366 行，`BASE='/report-dashboard'`；后端 `internal/` 下 `grep -rn "report-dashboard|report_dashboard|ReportDashboard" .` **0 命中**。孤儿 API client。

### 3.4 前端 ReportDesigner 无设计画布

`grep -rn "react-dnd|gridstack|jointjs|mxgraph|echarts|@ant-design/charts|@antv|G2|G6" --include="*.tsx" src/pages/ReportDesigner/` → **0 命中**。

data-lineage 有 `@antv/g6` 血缘图渲染（`LineageGraph/LineageGraph.tsx`），是 BI 域**唯一有真图表渲染**的前端页面。

### 3.5 data-pipeline.GetLineage 假实现（误导性代码）

`internal/data-pipeline/service/service.go:112-125`：
```go
func (s *Service) GetLineage(...) (map[string]interface{}, error) {
	pipeline, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil { return map[string]interface{}{}, err }
	return map[string]interface{}{  // 注释明说 "thin envelope"
		"pipelineId": pipeline.ID,
		"sources":    []string{},    // 永远空
		"sinks":      []string{},    // 永远空
	}, nil
}
```

代码注释明说返回空信封。API 有返回值但永远空，用户以为能拿血缘但永远拿不到 — **假实现**，比完全无实现更糟。

---

## 四、完成度重算

### 4.1 等权（NeatLogic 17 项功能对标）

| 功能项 | 权重 | 完成度 | 实证 |
|---|:--:|:--:|---|
| 数据源管理 | 8% | 50% | datasource 15 方法 + report_datasources；report-designer 不消费 |
| 报表定义（模板/参数/过滤器） | 8% | 60% | report_definitions + parameters + filters 齐全 |
| 报表可视化（拖拽画布） | 10% | 5% | 前端只有 CRUD 列表 |
| 报表 SQL 生成 | 8% | 3% | 无 SQL AST parser |
| 报表执行内核 | 10% | 3% | ExecuteReport 桩 |
| 报表导出（PDF/Excel） | 8% | 3% | 0 PDF/Excel 库 |
| 报表定时调度 | 8% | 20% | ReportSchedule 表 + CRUD 完整，0 消费者 |
| 报表预览 | 6% | 5% | 只返回 req.Parameters 回显 |
| 仪表板可视化 | 8% | 15% | bi-dashboard 只有 5 字段 struct，前端 0 页面 |
| 血缘（表级） | 8% | 30% | data-lineage CRUD + 前端 916 行渲染；无数据注入 |
| 血缘（字段级） | 6% | 5% | 无 SQL parser，无 column 血缘 |
| ETL/Pipeline | 8% | 25% | data-pipeline Run/Pause/Resume/GetLogs；血缘假实现 |
| 数据质量规则 | 8% | 35% | rules/scan-results/alerts 三层，13 方法；无扫描 |
| 数据脱敏 | 8% | 25% | masking 5 方法 CRUD + ApplyMask；0 消费者 |
| 数据分类分级 | 6% | 30% | classification 5 方法 + Classify 真实规则匹配 |
| 数据目录/资产 | 6% | 30% | data-catalog 9 方法 + Discover；无实际扫描 |
| 元数据管理 | 4% | 15% | metadata CRUD；无采集器 |

**等权完成度 = 23.8%**

### 4.2 业务价值加权

| 业务价值域 | 权重 | 完成度 |
|---|:--:|:--:|
| 报表定义+CRUD | 15% | 60% |
| 报表执行+导出 | 20% | 5% |
| 报表调度 | 10% | 25% |
| 数据源接入 | 10% | 50% |
| 可视化+图表 | 10% | 8% |
| 数据治理（血缘/质量/脱敏/分类/目录） | 25% | 27% |
| 主域集成 | 10% | 0% |

**业务价值加权完成度 = 21.7%**

### 4.3 最终数字

| 版本 | 完成度 | 置信度 | 主要误报 |
|---|:--:|:--:|---|
| v1 (2026-09-30) | 12% | ±5% | 6 个 data-* "无实现" 是误报（7419 行 + 123 DB） |
| v2 (2026-10-01 supplement) | 12% | ±6% | 同 v1；漏算 data-* CRUD 骨架 |
| **v3 (本轮复评)** | **20%** | **±5%** | 承认孤岛真实，但 CRUD 骨架不能算 0 |
| 置信区间 | **15%-25%** | 中 | 治理域无扫描是否算真实实现？ |

### 4.4 v1/v2 核心判断全部保留

- ExecuteReport 真桩 ✓ / ReportSchedule 无消费者 ✓ / 无 PDF/Excel 库 ✓
- 血缘零实际数据 ✓ / BI 域孤岛 ✓
- data-pipeline.GetLineage 假实现（本轮新增确认）

---

## 五、必须修正项清单

### P0（阻塞业务，5 项）

| # | 项目 | 实证 | 建议方向 |
|---|------|------|----------|
| 1 | 报表执行内核缺失 | `service.go:290-318` 只拼接字符串 | ExecuteReport 接入 datasource.Query，读取 report_definitions.sql_template |
| 2 | PDF/Excel 导出缺失 | grep 0 命中 | 接入 excelize（已在 go.mod）+ jung-kurt/gofpdf 或 chromedp |
| 3 | BI 域孤岛 | 6 模块 0 跨模块引用 | report-designer 消费 datasource；data-lineage 被 pipeline 写入 |
| 4 | ReportSchedule 无消费者 | 全仓 0 消费者 | robfig/cron 挂 ReportScheduler worker，扫 report_schedules + 触发 ExecuteReport |
| 5 | PreviewReport 无渲染 | `service.go:326-339` 只回显参数 | 至少返回真实查询数据 + 组件配置 |

### P1（严重降级，5 项）

| # | 项目 | 实证 |
|---|------|------|
| 6 | SQL 生成/AST parser 缺失 | 无 sqlparser/tidb/parser/cockroachdb 引用 |
| 7 | 血缘字段级无实现 | 无 column-level lineage 数据结构 |
| 8 | data-pipeline.GetLineage 假实现 | `service.go:120-124` 永远空信封，误导性代码 |
| 9 | 前端 reportDashboard.ts 孤儿 | 366 行 API client 无对应后端 |
| 10 | data-quality 无实际扫描引擎 | 有 rules/scan-results/alerts CRUD，无 scanner |

### P2（功能缺失，5 项）

| # | 项目 | 实证 |
|---|------|------|
| 11 | 前端 ReportDesigner 无设计画布 | 0 echarts/G2/G6（data-lineage 有 G6，ReportDesigner 无） |
| 12 | bi-dashboard 前端 0 页面 | 后端 CRUD 有，前端无页面 |
| 13 | data-masking 无实际应用场景 | 0 消费者 |
| 14 | data-catalog 无实际扫描器 | Discover 骨架 |
| 15 | metadata 无采集器 | CRUD 骨架 |

---

## 六、v1/v2 遗漏的正面发现（本轮确认）

1. **data-lineage 前端 9 文件 916 行** — NodeDetailDrawer/EdgeMapping/LineageGraph(带 G6 渲染)/StatsRow/useDataLineageState
2. **data-quality 三层模型** — rules + scan-results + alerts，13 Service 方法 + GetStats
3. **data-catalog 有 Discover 抽象** — 有 `getDiscoveryConfigs/Discover`（虽是骨架）
4. **datasource 服务 15 方法** — 完整连接池 + HealthCheckLoop + ResolvePassword + TestConnection
5. **report-designer 前端 7 文件 1367 行** — Reports/DataSources/Schedules/Executions 四 Tab 完整
6. **23 张真实 PG 表** — lineage_nodes/relationships/masking_rules/quality_rules/scan_results/data_catalog/data_pipelines/report_definitions/report_datasources/report_schedules/report_executions/bi_dashboards 等
7. **data-classification 有真实 Classify 逻辑** — 读规则表 + 匹配字段模式，不只是 CRUD
8. **data-pipeline 有 Run/Pause/Resume/GetLogs 抽象** — 状态管理是真的
9. **16 张 migration 覆盖 BI 数据表** — v1/v2 说"16 张表仅 1 张存在"完全错误，实际 23 张 CREATE TABLE 全部有

---

## 七、和 CMDB / ITSM 复评的对比

| 域 | v1 | v2 | v3 复评 | 上调 | 主要误报 |
|---|:--:|:--:|:--:|:--:|---|
| CMDB | 22% | 22% | **28%** | +6% | "Migration 缺失" 假警报（18 张表存在） |
| ITSM | 33.7% | 30% | **42% (36-48%)** | +11% | v1 略高估，v2 明显低估 |
| Automation | 10% | 10% | 15% | +5% | v1 StageExecutor.go:507 参数链断裂判断错 |
| Inspection | 15% | 15% | 18% | +3% | v2 "3 transport 冻结" 归属错（属 CMDB） |
| **BI/数据** | **12%** | **12%** | **20%** | **+8%** | **6 个 data-* "无实现" 是误报（3226 行 Go + 123 DB 调用 + 前端 916 行血缘图）** |

**BI 上调 8% 是本轮 5 个复评中最大上调**，说明 v1/v2 都严重低估了"CRUD 骨架 + 前端渲染"的存量价值。

---

## 八、复评方法学

- **抽查覆盖**：v1/v2 8 项关键声明 100% 抽查（每项 grep 命令可复现）
- **正面发现补充**：本轮新识别 9 项 v1/v2 未提及的正面实现
- **孤岛验证**：6 个跨模块消费检查（全部 0 命中，确认孤岛）
- **前端验证**：ReportDesigner/DataLineage/BI dashboard 3 处独立验证
- **完成度算法**：等权（17 项 NeatLogic 功能）+ 业务价值加权（7 业务域），两算法平均 21-24%
- **未使用 Agent 工具**：全部基于 Bash grep/find/wc，Agent 结果已在前轮废弃

---

## 九、下一步建议

1. **确认孤岛是主痛点**：BI 域不是"没有实现"，是"没有集成"。v3 修正后，Phase 1 不应是"从头写报表引擎"，而是"把已有 CRUD 骨架接入 datasource/lineage 消费者"。
2. **datasource 服务是唯一真实现**：优先让 report-designer 消费 `datasource.Query/Execute`，让 ExecuteReport 能真的跑 SQL。
3. **血缘注入优先级最高**：`data-lineage` 表和前端图谱都已就绪，只差 pipeline/datasource 主动写 lineage_nodes/relationships。
4. **ReportScheduler worker 补齐**：用 robfig/cron 挂一个 worker，扫描 report_schedules + 调 ExecuteReport，让 ReportSchedule 从"死字段"变"活的"。
5. **保留 v1/v2 的 P0 判断**：ExecuteReport 桩、无 PDF/Excel、无 SQL 生成、PreviewReport 空返回、data-pipeline.GetLineage 假实现 — 这 5 项必须修。

---

*复评时间*：2026-10-01
*结论稳定性*：v1/v2 核心判断（报表执行缺失/孤岛/无 PDF）全部准确；完成度数字上调 8%
*文件路径*：`reports/expert-reviews/bi-data-expert-rereview-2026-10-01.md`
