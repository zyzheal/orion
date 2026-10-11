# 巡检升级设计（2026-10-03）

**目标模块**：`orion-platform-svc-go/internal/inspection/` + 4 个新建模块（`inspection-threshold/inspection-configfile/inspection-report/inspection-problem`）
**基线数据**：`reports/expert-reviews/inspection-expert-method-level-2026-10-03.md`（357 行方法级）+ `inspection-expert-rereview-2026-10-01.md`（v3 2.7%）+ `upgrade-design-plan-2026-10-01.md` §巡检

---

## 1. TL;DR

- **当前完成度**：3-10%（rereview v3 2.7% 业务实质口径 / 方法级扩展 10.47% 骨架口径 / v3 综合报告 10%）
- **目标完成度**：55-60%（业务实质口径）/ 80%（骨架口径）
- **关键改动**：
  1. **P0-1**：修复 `RunInspection` 4 处假实现（`service.go` L49-59 / L63-69 / L72-78 / L81-83）
  2. **P0-2**：新增 `inspection-threshold` 模块（阈值引擎 3 层：存储 + JSONPath + FreeMarker）
  3. **P0-3**：新增 4 个模块（threshold / configfile / report / problem）对齐 NeatLogic 44 API
  4. **P1-1**：Model 层从 3 struct / 12 字段扩展到 12+ struct / 60+ 字段
- **不动的部分**：现有 6 个 CRUD 方法（List/Get/Create/Update/Delete/BatchCreate）+ Repository 176 行 + Handler 207 行

---

## 2. 当前状态（代码实证）

### 2.1 Orion 侧

| 项目 | 位置 | 行数 | 状态 |
|------|------|------|------|
| Service | `internal/inspection/service/service.go` | 142 行 / 12 方法 | ⚠️ 4 假实现 + 2 部分实现 + 6 CRUD 转发 |
| Repository | `internal/inspection/repository/repository.go` | 176 行 / 7 方法 | ✅ 唯一真实持久化 |
| Handler | `internal/inspection/handler/handler.go` | 207 行 / 12 路由 | ✅ 带 auth + otel（业务假） |
| Models | `internal/inspection/models.go` | 29 行 / 3 struct / 12 字段 | ❌ 极简模型 |
| **假实现明细** | L49-59 RunInspection / L63-69 GetResults / L72-78 UpdateStatus / L81-83 ListTemplates | — | ❌ P0 |
| Migration | 已有 inspection_records 表 | — | ✅ |

### 2.2 NeatLogic 侧（对照基准）

| 项目 | 位置 | 行数 | 方法数 |
|------|------|------|--------|
| InspectServiceImpl | 387 行 | 9 方法 | 资源查询 + SQL 拼接 |
| InspectCollectServiceImpl | 290 行 | 7 方法 | 采集→解析→阈值→告警核心链 |
| InspectReportServiceImpl | 348 行 | 9 方法 | 报告 + JSONPath + FreeMarker |
| InspectConfigFileServiceImpl | 472 行 | 11 方法 | 配置文件版本管理 |
| InspectResourceBuildSqlServiceImpl | 549 行 | 12 方法 | SQL 拼接引擎 |
| **合计** | 121 Java 文件 | **2046 行** | **48 方法** |

---

## 3. NeatLogic 对标差距（Gap 分级）

| Gap 编号 | 能力项 | 分级 | 描述 |
|---------|-------|------|------|
| G0-1 | RunInspection 4 处假实现 | **G0** | 只改 Status，无采集/阈值/收敛 |
| G0-2 | Threshold 模块（阈值引擎 3 层） | **G0** | MongoDB/JSONPath/FreeMarker 全缺 |
| G0-3 | ConfigFile 模块（14 API） | **G0** | 配置文件版本管理完全无 |
| G0-4 | Report 模块（16 API） | **G0** | 报告生成 + 导出完全无 |
| G0-5 | Problem 模块（11 API） | **G0** | 自定义视图 + 每日告警刷新 |
| G1-1 | Schedule 子域（4 API） | **G1** | 巡检计划调度缺失 |
| G1-2 | Job 子域（7 API） | **G1** | 巡检任务定义缺失 |
| G1-3 | 采集 SQL 拼接引擎 | **G1** | NeatLogic 独有 549 行 SQL builder |
| G2-1 | Model 层扩展 | **G2** | 从 3 struct 到 12+ struct |
| G2-2 | Service 拆分（1→5 服务） | **G2** | 单文件 142 行拆为 5 服务 |
| G3-1 | MongoDB 双存储 | **G3** | 可选，或走 PG JSONB |

---

## 4. 升级目标

### 4.1 架构层

- **单模块拆五服务**：`inspection/service/` 拆为 `service/`（主） + `collector/`（采集） + `reporter/`（报告） + `scheduler/`（调度） + `template/`（模板渲染）
- **4 新独立模块**：
  - `internal/inspection-threshold/`：阈值规则 + JSONPath 评估
  - `internal/inspection-configfile/`：配置文件版本 + 审计
  - `internal/inspection-report/`：报告生成 + FreeMarker 渲染
  - `internal/inspection-problem/`：问题视图 + 每日告警刷新
- **阈值引擎 3 层**：
  - 存储层：PostgreSQL JSONB（不引入 MongoDB，遵循用户约束）
  - 定位层：`github.com/ohler55/ojg`（JSONPath 库）
  - 渲染层：Go `text/template` + sprig（FreeMarker 替代）

### 4.2 数据模型层（Migration 713-720）

- `713_inspection_thresholds.sql`：阈值规则（jsonPath + rule + level）
- `714_inspection_results.sql`：采集结果（JSONB）
- `715_inspection_config_file_versions.sql`：配置文件版本
- `716_inspection_config_file_audits.sql`：配置文件审计
- `717_inspection_reports.sql`：报告
- `718_inspection_problem_views.sql`：自定义问题视图
- `719_inspection_schedules.sql`：巡检计划
- `720_inspection_jobs.sql`：巡检任务

### 4.3 API 层（对齐 NeatLogic 44 API）

统一挂载 `/api/v1/inspection/v2/*`，与当前 v1 CRUD 骨架并存：

**Threshold 5 端点**：
- `POST /v2/thresholds` / `GET /v2/thresholds` / `PUT /v2/thresholds/{id}` / `POST /v2/thresholds/copy` / `GET /v2/thresholds/{id}/source`

**ConfigFile 8 端点**：
- 版本 CRUD 3 + 比对 1 + 路径 CRUD 4 + 审计 2 = 10 端点（合并同类）

**Report 6 端点**：
- 查询 2 + 导出 1 + 环境 1 + 脚本 2 + 计划 2 = 8 端点

**Problem 5 端点**：
- 视图 CRUD 5 + 条件更新 1 + 报告 3 = 9 端点

---

## 5. 依赖链

### 5.1 前置模块

- **CMDB**：巡检目标 CI 从 CMDB 读取（`cmdb_ci_relations`）
- **Alert**：阈值不达标 → 告警（复用 `alert-escalation` 445 行）
- **Notification**：告警通知（复用 `internal/notification/`）
- **Report-Designer**：巡检报告渲染可复用（`internal/report-designer` 但当前是桩，见 bi-upgrade-design）

### 5.2 复用组件

| 组件 | 用途 |
|------|------|
| `internal/audit/` | 配置文件审计 |
| `internal/approval/` | 巡检变更审批 |
| `github.com/ohler55/ojg` | JSONPath 库（新引入） |
| `github.com/Masterminds/sprig` | 模板函数库（新引入） |
| `robfig/cron` | 巡检调度（已有 backup 用） |

### 5.3 下游消费者

- **Alert**：阈值告警进入 Alert 主链路
- **BI**：巡检结果作为血缘数据源
- **DevOps**：巡检触发自愈（`auto-recovery` 183 行）

---

## 6. 实施步骤

### 阶段 1：模型层扩展（G2-1）

1. 扩展 `internal/inspection/models.go` 到 12+ struct：
   - InspectionRecord（现有，扩字段到 20+）
   - InspectionThreshold
   - InspectionResult（JSONB）
   - InspectionConfigFileVersion
   - InspectionConfigFileAudit
   - InspectionReport
   - InspectionProblemView
   - InspectionSchedule
   - InspectionJob
   - InspectionTemplate

### 阶段 2：Migration 713-720（数据层）

1. 按顺序编写 8 张新表 migration
2. 每张表都带 `tenant_id` 字段 + 索引（复用租户隔离模式）
3. 验证：`migrate up 720` 全流程跑通

### 阶段 3：Service 拆分（G2-2）

1. `internal/inspection/service/service.go` 拆为：
   - `service/main.go`：主服务协调（保留 CRUD）
   - `service/collector.go`：采集逻辑（对应 NeatLogic InspectCollectServiceImpl 290 行）
   - `service/reporter.go`：报告（对应 InspectReportServiceImpl 348 行）
   - `service/scheduler.go`：调度（robfig/cron）
   - `service/template.go`：模板渲染
2. 引入 JSONPath 库与 sprig 到 `go.mod`

### 阶段 4：4 新独立模块（G0-2/3/4/5）

按依赖顺序：
1. **inspection-threshold**（无前置）
   - `service/evaluator.go`：Evaluate(jsonPath, result, rule) → (bool, float64)
   - `service/repository.go`：thresholds CRUD
   - `handler/handler.go`：5 端点
2. **inspection-configfile**（无前置）
   - Service：11 方法（对应 NeatLogic 472 行 11 方法）
   - Handler：8 端点
3. **inspection-report**（依赖 threshold）
   - Service：ReportService + ReportTemplateRenderer + JSONPathEvaluator
   - Handler：6 端点
4. **inspection-problem**（依赖 threshold + report）
   - Service：ProblemViewService + ProblemReportService
   - Handler：5 端点

### 阶段 5：修复 4 处假实现（P0-1）

修复 `RunInspection` 主链路：
```go
func (s *Service) RunInspection(ctx, tenantID, id) {
    // L49-59 原假实现：只改 Status = "running"
    // 新实现：
    job, _ := s.jobRepo.Get(ctx, tenantID, id)
    collector := s.collector.Get(job.Type)
    results, err := collector.Collect(ctx, job.Target)
    thresholds := s.thresholdRepo.List(ctx, tenantID, job.ThresholdIDs)
    for _, r := range results {
        for _, t := range thresholds {
            hit, val := threshold.Evaluate(t.JSONPath, r, t.Rule)
            if hit {
                s.problemRepo.Create(...)  // 记录问题
                s.alertPublisher.Publish(...)  // 触发告警
            }
        }
    }
    report := s.reporter.Generate(ctx, job, results)
    s.recordRepo.UpdateStatus(ctx, ..., "completed", report)
}
```

### 阶段 6：路由挂载

- `routes.go` 新增 `/api/v1/inspection/v2/*` 挂载 4 新模块 handler
- 保留 v1 CRUD 路由不变
- 权限：`auth.RequirePermission("inspection:v2", "read/write/delete")`

---

## 7. 验证方式

### 7.1 grep 验证

```bash
# 假实现已修复
grep -A30 "func (s \*Service) RunInspection" internal/inspection/service/
# 期望：调用 collector.Collect + threshold.Evaluate + problemRepo.Create + reporter.Generate

# 4 新模块存在
ls internal/inspection-threshold/ internal/inspection-configfile/ internal/inspection-report/ internal/inspection-problem/

# JSONPath 库引入
grep "ohler55/ojg\|PaesslerAG/jsonpath" go.mod
```

### 7.2 单元测试

- JSONPath Evaluate：10 用例（正常/边界/缺失/嵌套/错误路径）
- Threshold CRUD：6 用例
- RunInspection 端到端：3 用例（正常/超时/无阈值）
- ConfigFileVersion 版本比对：4 用例
- ProblemView 条件更新：3 用例

### 7.3 e2e 验证

1. 创建 Threshold 规则（CPU > 90% → warning，CPU > 95% → critical）
2. 创建 InspectionJob 指向一台服务器
3. RunInspection → 采集 → 阈值判定 → 命中 critical
4. 触发告警（Alert 主链路接收）
5. 生成报告（FreeMarker 渲染）
6. 问题视图展示

---

## 8. 风险与回滚

### 8.1 主要风险

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| FreeMarker 语义与 Go template 差异大 | 中 | 中 | 提供 sprig 函数集弥补 |
| JSONPath 库行为与 Java fastjson 不一致 | 高 | 中 | 迁移期并行校验两种实现 |
| 4 新模块与现有 v1 骨架数据兼容 | 中 | 高 | 保持 v1 CRUD 骨架不改动，v2 路由独立挂载 |
| 修复 RunInspection 破坏现有测试 | 中 | 中 | 保留原假实现方法名，新实现放入 collector service |
| PostgreSQL JSONB 性能 | 中 | 低 | 索引 btree_gin，采集结果按 job_id 分区 |

### 8.2 回滚策略

- **4 新模块回滚**：删除 `internal/inspection-*/` 目录 + `migrate down 720`
- **RunInspection 修复回滚**：调用方降级到原假实现（保留原代码路径）
- **JSONPath/FreeMarker 库回滚**：`go.mod` 移除依赖，`service/evaluator.go` 用 stub 返回
- **Model 层回滚**：新表数据保留但代码不消费（灰度）

### 8.3 认知边界

- 未验证 NeatLogic 549 行 SQL 拼接引擎在 Go 侧的等价实现成本
- MongoDB 双存储已放弃，走 PG JSONB，若未来需要真正的双存储需重新设计
- 4 新模块具体 API 命名对齐 NeatLogic，但字段类型可能需要按 Go 习惯调整
- FreeMarker 渲染效果与原 Java 版本可能有细微差异（未实测）

---

**文档编号**：`inspection-upgrade-design-2026-10-03.md`
**关联报告**：`inspection-expert-method-level-2026-10-03.md` / `upgrade-design-plan-2026-10-01.md` §巡检
**交叉依赖**：CMDB（巡检目标 CI） / Alert（阈值告警） / BI（结果数据） / DevOps（自愈触发）
