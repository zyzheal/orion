# BI/数据域升级设计（2026-10-03）

**目标模块**：`orion-platform-svc-go/internal/{report-designer,bi-dashboard,data-*,datasource,metadata}` 10 个后端模块 + `orion-frontend/src/pages/{ReportDesigner,data-lineage,...}`
**基线数据**：`reports/expert-reviews/bi-data-expert-rereview-2026-10-01.md`（317 行独立复评 20%）
**相关报告**：`reports/expert-reviews/bi-data-expert-review-2026-09-30.md`（v1 12%）+ `bi-data-expert-supplement-2026-10-01.md`（v2 12%）

---

## 1. TL;DR

- **当前完成度**：20%（复评中值 15-25%，v1/v2 均 12% 低估）
- **目标完成度**：55-60%（打通孤岛 + 补执行内核 + 补导出）
- **关键改动**：
  1. **P0-1**：修复 `ExecuteReport` 29 行真桩（`service.go:290-318` 只拼接字符串）
  2. **P0-2**：接入 PDF/Excel 导出（`excelize` 已在 go.mod，`gofpdf` 待引入）
  3. **P0-3**：打通 BI 域孤岛（6 模块 0 跨模块引用 → report-designer 消费 datasource，data-lineage 被 pipeline 写入）
  4. **P0-4**：ReportSchedule 挂 worker（robfig/cron 触发 ExecuteReport）
  5. **P0-5**：PreviewReport 真实化（当前只回显参数）
  6. **P1**：data-pipeline.GetLineage 从"永远空信封"改真实；前端 reportDashboard.ts 孤儿 API client 补后端
- **不动的部分**：6 个 data-* 模块 7419 行 CRUD 骨架 + datasource 15 方法 + 23 张真实 PG 表 + 前端 data-lineage 916 行 G6 渲染

---

## 2. 当前状态（代码实证）

### 2.1 Orion 侧 10 模块

| 模块 | 行数 | 方法数 | 真实 DB 调用 |
|------|------|--------|-------------|
| report-designer | 401 | 18（4 CRUD + 2 桩 + 8 CRUD + 4 表操作） | ✅ |
| bi-dashboard | 203 | 5（CRUD） | ✅ |
| data-lineage | 851 | 10 | ✅（无写入方） |
| data-masking | 472 | 6 | ✅（0 消费者） |
| data-catalog | 564 | 9（Discover/Search） | ✅ |
| data-quality | 610 | 13 | ✅ |
| data-pipeline | 378 | 12（Run/Pause/Resume/GetLogs） | ✅ |
| data-classification | 351 | 5（含真实 Classify 规则匹配） | ✅ |
| datasource | 319 | 15 | ✅（唯一真业务） |
| metadata | — | CRUD | ✅ |
| **合计** | **~4200 行** | **95 方法** | **123 处真实 SQL** |

### 2.2 关键实证

- `report-designer/service.go:290-318` ExecuteReport：29 行只拼接 `"reports/<id>/<exec>.pdf"` 字符串，0 渲染
- `report-designer/service.go:326-339` PreviewReport：只回显 `req.Parameters`
- `data-pipeline/service.go:112-125` GetLineage：注释明说 "thin envelope" 返回空 sources/sinks
- 前端 `data-lineage/` 9 文件 916 行有 G6 渲染，但图谱永远空
- 全仓 `grep "pdfkit\|libreoffice\|soffice\|sheetjs\|jsPDF"` → 0 命中
- `excelize` 在 `go.mod:24`，但 report-designer 未接入
- 6 模块孤岛验证：所有跨模块 grep 全部 0 命中
- `internal/middleware/dlp.go` 有独立 DLP 规则表，不消费 `masking_rules`

---

## 3. NeatLogic 对标差距（Gap 分级）

| Gap 编号 | 能力项 | 分级 | 描述 |
|---------|-------|------|------|
| G0-1 | ExecuteReport 执行内核 | **G0** | 29 行真桩，无 SQL 生成/抽取/渲染 |
| G0-2 | PDF/Excel 导出 | **G0** | 全仓 0 库引用 |
| G0-3 | BI 域孤岛 | **G0** | 6 模块 0 跨模块引用 |
| G0-4 | ReportSchedule 无消费者 | **G0** | CRUD 完整但零调度 |
| G0-5 | PreviewReport 无渲染 | **G0** | 只回显参数 |
| G1-1 | SQL 生成 / AST parser | **G1** | 无 sqlparser/tidb/parser 引入 |
| G1-2 | 血缘字段级（column-level） | **G1** | 无 SQL parser |
| G1-3 | data-pipeline.GetLineage 假实现 | **G1** | 永远空信封，误导性代码 |
| G1-4 | 前端 reportDashboard.ts 孤儿 | **G1** | 366 行 API client 无后端 |
| G1-5 | data-quality 无扫描引擎 | **G1** | 有 rules CRUD，无 scanner |
| G2-1 | 前端 ReportDesigner 无设计画布 | **G2** | 0 echarts/G2/G6（data-lineage 有 G6） |
| G2-2 | bi-dashboard 前端 0 页面 | **G2** | 后端 CRUD 有，前端无页面 |
| G2-3 | data-masking 无应用场景 | **G2** | 0 消费者 |
| G2-4 | data-catalog 无扫描器 | **G2** | Discover 骨架 |
| G2-5 | metadata 无采集器 | **G2** | CRUD 骨架 |

---

## 4. 升级目标

### 4.1 架构层

- **ExecuteReport 执行内核补齐**：
  - SQL 生成：读 `report_definitions.sql_template`
  - 数据抽取：调用 `datasource.Query`
  - 结果渲染：Go `text/template` + sprig
  - 输出：Excel（excelize）+ PDF（gofpdf）双格式
- **BI 域打通孤岛**：
  - report-designer → 消费 datasource
  - pipeline → 写入 data-lineage
  - data-masking → 被 middleware/dlp.go 消费（合并 DLP 规则表到 masking_rules）
  - data-quality → 扫描器消费 rules
- **ReportScheduler worker**：
  - `robfig/cron` 启动 worker
  - 定期扫 `report_schedules` 表
  - 匹配 cron 表达式 → 调用 ExecuteReport

### 4.2 数据模型层（Migration 729-734）

- `729_bi_report_executions_ext.sql`：报表执行扩展（增加 input_sql/row_count/exec_duration_ms 字段）
  - 或 ALTER 现有 report_executions 表
- `730_bi_report_dashboard_widgets.sql`：Dashboard widget 配置（前端 bi-dashboard 需要）
- `731_bi_column_lineage.sql`：字段级血缘（column_id 关联 lineage_nodes）
- `732_bi_masking_consumption.sql`：masking 消费记录表（谁在何时用了哪条规则）
- `733_bi_quality_scans.sql`：质量扫描执行记录
- `734_bi_metadata_collections.sql`：元数据采集任务

### 4.3 API 层

- `/api/v1/report-designer/reports/{id}/execute`：真实执行（改造现有端点）
- `/api/v1/report-designer/reports/{id}/preview`：真实预览（改造现有端点）
- `/api/v1/report-designer/reports/{id}/export`：POST，返回 PDF/Excel 二进制
- `/api/v1/report-dashboard/*`：新建模块 8 端点（对齐前端 366 行 API client）
- `/api/v1/data-lineage/{id}/columns`：字段级血缘查询
- `/api/v1/data-quality/scans/run`：POST 触发扫描

---

## 5. 依赖链

### 5.1 前置模块

- **datasource 服务**：ExecuteReport 核心依赖（319 行 15 方法已就绪）
- **CMDB**：血缘起点为 CMDB CI（间接依赖）
- **Alert**：质量扫描告警通过 Alert 主链路

### 5.2 复用组件

| 组件 | 用途 |
|------|------|
| `internal/datasource/` | 报表数据抽取（15 方法唯一真业务） |
| `excelize` (go.mod 已有) | Excel 导出 |
| `github.com/jung-kurt/gofpdf` | PDF 导出（新引入）或 `github.com/chromedp/chromedp` HTML→PDF |
| `robfig/cron` (go.mod 已有) | 报表调度 worker |
| `github.com/Masterminds/sprig` | 模板函数（新引入） |
| `github.com/apache/arrow`（可选） | 大数据集聚合 |

### 5.3 下游消费者

- **前端 ReportDesigner**：调用执行/预览/导出
- **Alert**：质量扫描告警
- **DevOps**：成本分析可复用 finops 4326 行

---

## 6. 实施步骤

### 阶段 1：ExecuteReport 执行内核（P0-1）

1. 修改 `report-designer/service.go:290-318`：
   ```go
   func (s *Service) ExecuteReport(ctx, tenantID, reportID, req) (*ReportExecution, error) {
       report, _ := s.repo.GetReportByID(ctx, reportID, tenantID)
       exec := &ReportExecution{ID: uuid.New(), ReportID: reportID, Status: "running", ...}
       s.repo.CreateExecution(ctx, exec)
       
       // 1. SQL 生成：读 report_definitions.sql_template 并参数化
       sql := s.buildSQL(report.SQLTemplate, req.Parameters)
       
       // 2. 数据抽取：调 datasource.Query
       ds, _ := s.datasourceSvc.Get(ctx, tenantID, report.DatasourceID)
       rows, err := ds.Query(ctx, sql)
       if err != nil { return nil, err }
       
       // 3. 结果渲染
       outputPath := s.renderOutput(exec, report, rows)  // 新增方法
       
       s.repo.UpdateExecutionStatus(ctx, exec, "completed", &outputPath, nil)
       return exec, nil
   }
   ```
2. 新增 `buildSQL` 方法：支持参数化查询（防注入）
3. 新增 `renderOutput` 方法：根据 report.format 分派到 excelize / gofpdf

### 阶段 2：PDF/Excel 导出（P0-2）

1. `go.mod` 引入 `github.com/jung-kurt/gofpdf`（或 chromedp 走浏览器渲染）
2. 新建 `internal/report-designer/exporter/` 目录：
   - `excel.go`：使用 excelize 生成 .xlsx
   - `pdf.go`：使用 gofpdf 生成 .pdf（简单表格）或 chromedp 走 HTML
   - `interface.go`：`Exporter` 接口
3. Handler 新增 `POST /:id/export` 端点
4. 单元测试：3 用例（成功/大数据集/空结果）

### 阶段 3：BI 域孤岛打通（P0-3，最高复杂度）

1. **report-designer → datasource**：
   - `report-designer/service.go` 注入 `datasource.Service`
   - `ExecuteReport` 中通过 datasource 服务取连接
2. **pipeline → data-lineage**：
   - `pipeline-executor` 或 `pipeline-engine` 中每次执行完，调用 `data-lineage.CreateNode/CreateRelationship`
   - 或新建 `internal/pipeline-lineage/` 适配层
3. **middleware/dlp.go → data-masking**：
   - 合并两套规则表：DLP 规则表数据迁移到 `masking_rules`
   - `middleware/dlp.go` 调用 `data-masking.ApplyMask`
4. **data-quality 扫描器**：
   - 新建 `data-quality/scanner/`：定期扫 `rules` 表，执行 SQL 检查
   - 结果写入 `quality_scan_results` 表
   - 触达阈值时通过 Alert 通知

### 阶段 4：ReportScheduler worker（P0-4）

1. 新建 `internal/report-designer/scheduler/worker.go`
2. `robfig/cron` 每分钟扫 `report_schedules` 表
3. 匹配 cron 表达式 → 调用 `ExecuteReport`
4. main.go 启动 worker

### 阶段 5：PreviewReport 真实化（P0-5）

1. 修改 `service.go:326-339`：
   - 走完整数据抽取链路
   - 但限制行数（LIMIT 100）
   - 返回 rows + 组件配置（report.template_json）

### 阶段 6：G1 补齐

1. **SQL AST parser**：引入 `github.com/apache/calcite-avatica`（Java）或 `github.com/xwb1989/sqlparser`（Go）
2. **字段级血缘**：SQL parser 提取 column → 写入 `bi_column_lineage`
3. **data-pipeline.GetLineage 修复**：`service.go:112-125` 从"永远空信封"改为真实查询
4. **前端 reportDashboard 后端**：新建 `internal/report-dashboard/` 模块，20+ endpoints

---

## 7. 验证方式

### 7.1 grep 验证

```bash
# ExecuteReport 已改造
grep -A30 "func (s \*Service) ExecuteReport" internal/report-designer/service/service.go
# 期望：包含 datasource.Query 调用

# PDF/Excel 库引入
grep -E "gofpdf|chromedp" go.mod

# BI 域孤岛已打通
grep -rn "datasource\|DataLineage\|masking_rules" internal/report-designer/ internal/pipeline-executor/ internal/middleware/
# 期望：>10 命中

# ReportScheduler worker
ls internal/report-designer/scheduler/worker.go
```

### 7.2 单元测试

- ExecuteReport SQL 参数化：5 用例（正常/SQL 注入/空参数/多参数/错误 SQL）
- Excel 导出：3 用例
- PDF 导出：3 用例
- ReportScheduler cron 匹配：4 用例
- data-lineage pipeline 写入：3 用例

### 7.3 e2e 验证

1. 创建 datasource（连接 PG）
2. 创建 report_definition（sql_template: `SELECT * FROM {table} WHERE id = {id}`）
3. 执行 ExecuteReport（参数 table=users, id=1）
4. 导出为 PDF 与 Excel
5. 定时报表 5 分钟后触发一次
6. data-quality 扫一次 rules → 结果写入 quality_scan_results
7. 中间件 DLP 触发时能查到 masking_rules

---

## 8. 风险与回滚

### 8.1 主要风险

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| ExecuteReport 改造破坏现有 API 契约 | 中 | 高 | 保留原执行签名，新增 renderOutput 方法不影响外部 |
| PDF/Excel 库引入大二进制 | 中 | 低 | gofpdf 纯 Go，chromedp 需 Chromium 二进制（可选） |
| SQL 注入攻击 | 高 | 高 | 强制参数化查询，禁止字符串拼接 |
| BI 域打通引入循环依赖 | 中 | 高 | 通过适配层解耦，禁止直接互相引用 |
| ReportScheduler 重复执行 | 中 | 中 | 使用分布式锁（Redis）防止多实例重复 |
| 前端 data-lineage 期望字段与后端不匹配 | 中 | 中 | 前后端字段类型表同步（migration 变更时通知前端） |

### 8.2 回滚策略

- **ExecuteReport 回滚**：git revert 单文件，恢复原 29 行桩
- **PDF/Excel 库回滚**：从 go.mod 移除，exporter 目录 stub
- **孤岛打通回滚**：各连接点可独立回滚（report-designer、pipeline、middleware、quality scanner）
- **ReportScheduler 回滚**：worker 移除，保留 report_schedules 表数据（不主动清理）

### 8.3 认知边界

- 未量化前端 reportDashboard.ts 366 行 API client 的具体端点需求
- 未评估 chromedp 在容器环境下的启动成本
- 未评估 SQL AST parser 选型（Go 原生 parser 覆盖度有限）
- 未评估 data-quality 扫描的实际规则集与扫描性能

---

**文档编号**：`bi-upgrade-design-2026-10-03.md`
**关联报告**：`bi-data-expert-rereview-2026-10-01.md` / `cross-review-synthesis-2026-10-03-v4.md`（当前权威）
**交叉依赖**：Alert（质量扫描告警） / Pipeline（血缘写入） / CMDB（血缘源） / DevOps（成本分析）
