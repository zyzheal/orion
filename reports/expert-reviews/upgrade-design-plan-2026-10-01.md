# Orion 功能升级最终设计方案（巡检 + 混沌工程）

> **日期**：2026-10-01
> **基础**：granular-comparison-2026-10-01.md（颗粒度对比）+ 8 份 v2 专家评审 + NeatLogic Java 源码实证
> **目标**：将 NeatLogic 优秀能力 + 独有能力升级到 Orion，同时保留 Orion 在混沌工程上的差异化优势
> **覆盖范围**：巡检（66 API 对标）+ 混沌工程（risk/scenario 借鉴）+ 跨域共享能力
> **设计原则**：只考虑功能完整度与模块融入当前系统架构，不考虑人力耗时

---

## 0. TL;DR

1. **升级后架构**：4 个新建模块（inspection-threshold / inspection-configfile / inspection-report / inspection-problem）+ 2 个跨域共享新建模块（risk / scenario）+ 2 个改造模块（inspection / chaos）+ 6 个复用模块（notification/approval/report-designer/pipeline-audit-log/cron/mongodb）
2. **核心决策**：阈值引擎用 MongoDB（JSONPath 原生）+ 模板用 Go template（不引 FreeMarker）+ chaos 修复静默成功（破坏性变更，必须有 injector）
3. **数据模型**：3 类新实体（ThresholdRule / ConfigFile / Risk+Scenario）+ 2 类扩展（Experiment 加 RiskLevel/ScenarioID 字段）
4. **API 设计**：巡检新增 25 端点 + 混沌新增 12 端点 + 跨域共享 risk/scenario
5. **集成点**：chaos↔risk/scenario/inspection/notification/approval + inspection↔notification/report-designer
6. **功能完整度维度**：8 类（采集 / 阈值校验 / 配置管理 / 报告 / 调度 / 风险评级 / 场景管理 / 稳态假设）
7. **模块融入顺序**：基础设施 → 止损 → 阈值与风险 → 配置与稳态 → 报告与调度 → 产品化（按依赖链，不按时间）

---

## 1. 升级后目标架构

### 1.1 巡检目标架构（模块层）

```
internal/
├── inspection/                       【改造】修复 RunInspection + 扩展 models
│   ├── service/service.go            修 L49-59 桩代码 + 真实后台采集
│   ├── models/models.go             扩展（加 Threshold/ConfigFile/Report 关联）
│   ├── handler/                      现有 HTTP 入口
│   └── repository/                   现有 PG 持久化
│
├── inspection-threshold/             【新建】阈值引擎（MongoDB 三层）
│   ├── service/                      SaveDef + Search + Copy + ReSave
│   ├── repository/                   MongoDB _inspectdef collection
│   ├── handler/                      6 端点
│   ├── evaluator/                    JSONPath 求值 + Go template 渲染
│   └── models/
│       ├── ThresholdRule            metric/operator/value/severity/jsonPath/template
│       ├── Collection                集合数据定义
│       └── ThresholdOverride         个性化阈值重写（per-resource）
│
├── inspection-configfile/            【新建】配置文件管理
│   ├── service/                     CRUD + 版本比对
│   ├── repository/                   PG 持久化
│   ├── handler/                      8 端点
│   ├── differ/                       diff 算法（go-diff）
│   └── models/
│       ├── ConfigFile               path/content/checksum/version
│       ├── ConfigFileVersion        version/content/diff
│       └── ResourcePath             resource_id/path
│
├── inspection-report/                【新建】报告 + 调度
│   ├── service/                     Export + History + Schedule
│   ├── repository/                   PG 持久化
│   ├── handler/                      6 端点
│   ├── scheduler/                   cron consumer（接 cron 框架）
│   ├── exporter/                    PDF（HTML+浏览器打印）/ Excel（excelize）
│   └── models/
│       ├── Report                   template/status/lastRun
│       ├── ReportHistory            run_id/status/startedAt/completedAt
│       └── Schedule                 cronExpression/isActive/lastRun
│
└── inspection-problem/               【新建】新问题视图
    ├── service/                     CRUD + 自定义视图 + 邮件
    ├── repository/                   PG 持久化
    ├── handler/                      6 端点
    └── models/
        ├── Problem                  resource/metric/value/severity/status
        ├── CustomView               name/conditions/sortOrder
        └── AlertEveryday            lastSend/recipient
```

### 1.2 混沌工程目标架构（模块层）

```
internal/
├── chaos/                            【改造】修复静默成功 + PreReleaseVerify
│   ├── injector/injector.go         保留（6 类 K8s 故障，差异化能力）
│   ├── service/service.go           修 L628-690 静默成功 + L931-951 PreReleaseVerify
│   ├── models/models.go             扩展（Experiment 加 RiskLevel/ScenarioID）
│   ├── handler/                      现有
│   └── repository/                   现有
│
├── risk/                             【新建】风险评级（跨域共享）
│   ├── service/                     CRUD + 审批门控判断
│   ├── repository/                   PG 持久化
│   ├── handler/                      6 端点
│   └── models/
│       └── Risk                     name/color/isActive/description/sortOrder
│
└── scenario/                         【新建】场景管理（跨域共享）
    ├── service/                     CRUD + 预定义场景
    ├── repository/                   PG 持久化
    ├── handler/                      4 端点
    ├── presets/                     deploy/rollback/scale/inspect 4 类预定义
    └── models/
        ├── Scenario                 name/description/type/isPreset
        └── ScenarioBinding          scenarioID ↔ experimentID/jobID
```

### 1.3 复用现有模块（不新建）

```
internal/
├── notification/                     【复用】通知回调（chaos 完成通知 + 巡检邮件）
├── approval/                         【复用】审批工作流（高风险 chaos + 脚本审核）
├── report-designer/                  【复用】报告执行内核（巡检报告导出）
├── pipeline-audit-log/               【复用】审计日志（巡检 + chaos 操作审计）
└── cron/                             【复用】cron consumer 框架（巡检调度）
```

---

## 2. 数据模型设计

### 2.1 巡检阈值模型（MongoDB）

**Collection: `_inspectdef`**

```javascript
{
  _id: ObjectId("..."),
  name: "cpu_threshold",              // 模型名称（唯一）
  label: "CPU 阈值规则",               // 显示名
  thresholds: [                       // 集合数据定义（第 1 层）
    {
      ruleUuid: "rule_001",
      metric: "cpu",
      operator: ">",                  // >, <, >=, <=, ==, !=, between
      value: 90,
      severity: "critical",           // info/warning/critical
      jsonPath: "$.resources.cpu",   // JSONPath 表达式
      template: "CPU {{value}}% 超过阈值 {{threshold}}%",  // Go template
      actions: ["alert", "email"],    // 触发动作
      isActive: true
    }
  ],
  lcu: "user_uuid",                   // 最后修改人
  lcd: ISODate("2026-10-01T...")
}
```

**Collection: `_inspectdef_threshold_override`**（第 3 层：个性化重写）

```javascript
{
  _id: ObjectId("..."),
  defName: "cpu_threshold",
  resourceId: "res_001",               // 资源 ID
  ruleUuid: "rule_001",
  overrideValue: 85,                  // 重写为 85（默认 90）
  overrideOperator: ">=",
  overrideActions: ["alert"],         // 重写动作
  lcu: "user_uuid",
  lcd: ISODate("...")
}
```

**第 2 层：资源阈值源**（GetInspectResourceThresholdsSourceApi）
- 不存储，按需从 NeatLogic inspect 资源 + 默认规则动态计算
- 实现：`inspection-threshold/service/SourceService.go` 查询资源 + 应用默认 + 返回

### 2.2 巡检配置文件模型（PostgreSQL）

```sql
-- migration: 700_create_inspection_configfiles.sql
CREATE TABLE inspection_configfiles (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    resource_id VARCHAR(64) NOT NULL,
    path TEXT NOT NULL,
    content TEXT,
    checksum VARCHAR(64),
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, resource_id, path)
);

CREATE TABLE inspection_configfile_versions (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    configfile_id VARCHAR(64) REFERENCES inspection_configfiles(id),
    version INTEGER NOT NULL,
    content TEXT,
    checksum VARCHAR(64),
    diff TEXT,                          -- 与上一版的 unified diff
    created_by VARCHAR(64),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(configfile_id, version)
);

CREATE TABLE inspection_configfile_resource_paths (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    resource_id VARCHAR(64) NOT NULL,
    path TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 2.3 风险评级模型（PostgreSQL，跨域共享）

```sql
-- migration: 701_create_risks.sql
CREATE TABLE risks (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(20) NOT NULL,        -- red/yellow/green/blue
    is_active BOOLEAN DEFAULT true,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);
```

### 2.4 场景管理模型（PostgreSQL，跨域共享）

```sql
-- migration: 702_create_scenarios.sql
CREATE TABLE scenarios (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(32),                  -- deploy/rollback/scale/inspect/chaos
    is_preset BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

-- 场景与实验/作业关联（多对多）
CREATE TABLE scenario_bindings (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    scenario_id VARCHAR(64) REFERENCES scenarios(id),
    target_type VARCHAR(32),          -- chaos_experiment/autoexec_job/inspection
    target_id VARCHAR(64),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 2.5 chaos Experiment 扩展字段

```sql
-- migration: 703_alter_chaos_experiments.sql
ALTER TABLE chaos_experiments
    ADD COLUMN risk_id VARCHAR(64),            -- 关联 risk.ID
    ADD COLUMN scenario_id VARCHAR(64),        -- 关联 scenario.ID
    ADD COLUMN requires_approval BOOLEAN DEFAULT false,  -- 高风险需审批
    ADD COLUMN approval_id VARCHAR(64);        -- 关联 approval.ID
```

### 2.6 巡检新问题模型

```sql
-- migration: 704_create_inspection_problems.sql
CREATE TABLE inspection_problems (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    resource_id VARCHAR(64) NOT NULL,
    metric VARCHAR(64),
    value FLOAT,
    threshold FLOAT,
    severity VARCHAR(20),              -- info/warning/critical
    status VARCHAR(20) DEFAULT 'open', -- open/acknowledged/resolved
    detected_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP,
    UNIQUE(tenant_id, resource_id, metric, detected_at)
);

CREATE TABLE inspection_problem_custom_views (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(100) NOT NULL,
    conditions JSONB,                  -- 过滤条件
    sort_order INTEGER DEFAULT 0,
    created_by VARCHAR(64),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE inspection_alert_everyday (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    recipient VARCHAR(255),
    last_send TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);
```

---

## 3. API 设计（新增端点）

### 3.1 巡检新增 API（25 端点）

#### 阈值引擎（6 端点）

```
POST   /api/v1/inspection/thresholds              # SaveInspectDefApi
GET    /api/v1/inspection/thresholds              # CollectionSearchApi
GET    /api/v1/inspection/thresholds/:name        # GetInspectDefApi
DELETE /api/v1/inspection/thresholds/:name        # DeleteInspectDefApi
POST   /api/v1/inspection/thresholds/copy          # CopyInspectAppCollectionThresholdsApi
GET    /api/v1/inspection/thresholds/source        # GetInspectResourceThresholdsSourceApi
```

#### 配置文件（8 端点）

```
POST   /api/v1/inspection/configfiles                   # SaveResourcePathApi
GET    /api/v1/inspection/configfiles                    # ListResourceFileApi
POST   /api/v1/inspection/configfiles/batch              # BatchAddPathApi
DELETE /api/v1/inspection/configfiles/batch              # BatchDeletePathApi
POST   /api/v1/inspection/configfiles/clear               # ClearFileApi
GET    /api/v1/inspection/configfiles/compare             # CompareVersionApi
GET    /api/v1/inspection/configfiles/:id/versions        # ListVersionApi
GET    /api/v1/inspection/configfiles/:id/audit           # ListAuditApi
```

#### 报告 + 调度（6 端点）

```
POST   /api/v1/inspection/reports/export                 # ExportReportApi
GET    /api/v1/inspection/reports/:id                     # GetReportApi
GET    /api/v1/inspection/reports/history                 # HistoryListApi
POST   /api/v1/inspection/reports/schedule                # ScheduleSaveApi
GET    /api/v1/inspection/reports/schedule                # ScheduleSearchApi
PUT    /api/v1/inspection/reports/schedule/:id            # ScheduleStatusUpdateApi
```

#### 新问题（5 端点）

```
GET    /api/v1/inspection/problems                        # ProblemReportListApi
POST   /api/v1/inspection/problems/views                 # SaveCustomViewApi
GET    /api/v1/inspection/problems/views                 # ListCustomViewApi
PUT    /api/v1/inspection/problems/views/:id              # MoveCustomViewApi
POST   /api/v1/inspection/problems/email                 # SendEmailApi
```

### 3.2 混沌工程新增 API（12 端点）

#### 风险评级（6 端点）

```
POST   /api/v1/risks                                     # RiskSaveApi
GET    /api/v1/risks                                     # RiskListApi
GET    /api/v1/risks/:id                                 # RiskGetApi
DELETE /api/v1/risks/:id                                 # RiskDeleteApi
PUT    /api/v1/risks/:id/move                            # RiskMoveApi
GET    /api/v1/risks/search                              # RiskSearchApi
```

#### 场景管理（4 端点）

```
POST   /api/v1/scenarios                                # ScenarioSaveApi
GET    /api/v1/scenarios                                # ScenarioSearchApi
GET    /api/v1/scenarios/:id                            # ScenarioGetApi
DELETE /api/v1/scenarios/:id                            # ScenarioDeleteApi
```

#### chaos 增强端点（2 端点）

```
PUT    /api/v1/chaos/experiments/:id/risk-level         # 关联风险级别
PUT    /api/v1/chaos/experiments/:id/scenario            # 关联场景
POST   /api/v1/chaos/experiments/:id/validate           # PreReleaseVerify 真实化（改造现有）
```

### 3.3 路由注册（routes.go 改造点）

```go
// internal/inspection/routes.go（扩展）
func RegisterRoutes(r *gin.RouterGroup) {
    // 现有
    inspection := r.Group("/inspection")
    {
        inspection.GET("", handler.List)
        inspection.GET("/:id", handler.Get)
        // ... 现有路由保留
        inspection.POST("/:id/run", handler.RunInspection)  // 改造：真实执行
    }
    // 新增阈值
    thresholds := inspection.Group("/thresholds")
    {
        thresholds.POST("", thresholdHandler.Save)
        // ... 6 端点
    }
    // 新增配置文件、报告、问题...
}

// internal/risk/routes.go（新建）
func RegisterRoutes(r *gin.RouterGroup) {
    risks := r.Group("/risks", auth.Auth())
    {
        risks.POST("", handler.Save)
        // ... 6 端点
    }
}

// internal/scenario/routes.go（新建）
// ... 4 端点
```

---

## 4. 集成点（与现有模块接线）

### 4.1 chaos ↔ risk/scenario

```go
// internal/chaos/service/service.go（改造）
func (s *Service) RunExperiment(ctx context.Context, tenantID, id string, req models.RunExperimentRequest) (*models.ExperimentRun, error) {
    experiment, err := s.repo.GetByID(ctx, tenantID, id)
    // ...
    
    // 【新增】高风险实验需审批门控
    if experiment.RiskID != "" {
        risk, err := s.riskService.Get(ctx, tenantID, experiment.RiskID)
        if err != nil {
            return nil, err
        }
        if risk.Color == "red" && !experiment.RequiresApproval {
            return nil, fmt.Errorf("high-risk experiment requires approval")
        }
        if experiment.ApprovalID != "" {
            approval, err := s.approvalService.Get(ctx, experiment.ApprovalID)
            if err != nil || approval.Status != "approved" {
                return nil, fmt.Errorf("experiment not approved")
            }
        }
    }
    
    // 【新增】场景关联日志
    if experiment.ScenarioID != "" {
        s.scenarioService.LogExecution(ctx, experiment.ScenarioID, run.ID)
    }
    
    // 现有执行逻辑...
}
```

### 4.2 chaos ↔ inspection

```go
// internal/chaos/service/service.go（PreReleaseVerify 真实化）
func (s *Service) checkHealthEndpoint(ctx context.Context, serviceID, env string) (string, string) {
    // 【改造】替代 "skip" 桩
    target := fmt.Sprintf("http://%s.%s/healthz", serviceID, env)
    resp, err := http.Get(target)
    if err != nil {
        return "fail", fmt.Sprintf("health endpoint unreachable: %v", err)
    }
    if resp.StatusCode != 200 {
        return "fail", fmt.Sprintf("health endpoint returned %d", resp.StatusCode)
    }
    return "pass", "health endpoint OK"
}

func (s *Service) checkSteadyState(ctx context.Context, serviceID, env string) (string, string) {
    // 【改造】调用 inspection service 检查稳态
    result, err := s.inspectionService.CheckSteadyState(ctx, serviceID, env)
    if err != nil {
        return "skip", fmt.Sprintf("steady state not checked: %v", err)
    }
    if result.Passed {
        return "pass", result.Message
    }
    return "fail", result.Message
}
```

### 4.3 chaos ↔ notification

```go
// internal/chaos/service/service.go（实验完成通知）
func (s *Service) RunExperiment(...) {
    // ... 现有逻辑
    
    // 【新增】实验完成后发通知（借鉴 AutoexecJobNotifyCallbackHandler）
    s.notificationService.Send(ctx, notification.Request{
        TenantID: tenantID,
        Type:     "chaos_experiment_completed",
        Recipients: experiment.Subscribers,
        Payload: map[string]any{
            "experimentId": id,
            "status":       "completed",
            "duration":     duration,
        },
    })
}
```

### 4.4 chaos ↔ approval

```go
// 高风险实验审批门控
func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateExperimentRequest) (*models.Experiment, error) {
    m := &models.Experiment{...}
    
    // 【新增】高风险标记
    if req.RiskID != "" {
        risk, err := s.riskService.Get(ctx, tenantID, req.RiskID)
        if err != nil {
            return nil, err
        }
        if risk.Color == "red" {
            m.RequiresApproval = true
        }
    }
    
    // 现有创建逻辑...
}
```

### 4.5 inspection ↔ notification

```go
// internal/inspection-report/service/service.go（报告完成邮件）
func (s *Service) ExportReport(ctx context.Context, req models.ExportRequest) (*models.Report, error) {
    // 生成报告...
    
    // 【新增】完成邮件（借鉴 InspectNewProblemReportSendEmailApi）
    if req.NotifyEmail != "" {
        s.notificationService.SendEmail(ctx, req.NotifyEmail, report)
    }
}
```

### 4.6 inspection ↔ report-designer

```go
// internal/inspection-report/service/service.go（复用 report-designer 执行内核）
func (s *Service) ExportReport(ctx context.Context, req models.ExportRequest) (*models.Report, error) {
    // 【复用】report-designer 的 ExecuteReport（修复后）
    report, err := s.reportService.ExecuteReport(ctx, req.TemplateID, req.Parameters)
    if err != nil {
        return nil, err
    }
    // 转换为巡检报告格式...
}
```

### 4.7 risk/scenario ↔ autoexec（未来扩展）

```go
// internal/pipeline-engine/service/StageExecutor.go（执行前风险前置）
func (s *StageExecutor) Execute(ctx context.Context, stage models.Stage) error {
    // 【未来】执行前查 risk 级别
    if stage.RiskID != "" {
        risk, err := s.riskService.Get(ctx, stage.TenantID, stage.RiskID)
        if err != nil {
            return err
        }
        if risk.Color == "red" && !stage.Approved {
            return fmt.Errorf("high-risk stage requires approval")
        }
    }
    // 现有执行...
}
```

---

## 5. 关键代码改造点

### 5.1 P1-1 修 RunInspection 桩代码

**文件**：`internal/inspection/service/service.go:49-59`

**改造前**：
```go
func (s *Service) RunInspection(ctx context.Context, tenantID, id string) (map[string]interface{}, error) {
    rec, err := s.repo.GetByID(ctx, tenantID, id)
    if err != nil {
        return map[string]interface{}{"status": "ok", "inspectionId": id}, nil
    }
    rec.Status = "running"
    _, err = s.repo.Update(ctx, tenantID, id, models.CreateRequest{Status: "running"})
    if err != nil {
        return nil, err
    }
    return map[string]interface{}{"status": "running", "inspectionId": id}, nil
}
```

**改造后**：
```go
func (s *Service) RunInspection(ctx context.Context, tenantID, id string) (map[string]interface{}, error) {
    rec, err := s.repo.GetByID(ctx, tenantID, id)
    if err != nil {
        return nil, fmt.Errorf("inspection not found: %w", err)
    }
    
    // 置 running 状态
    rec.Status = "running"
    if _, err := s.repo.Update(ctx, tenantID, id, models.CreateRequest{Status: "running"}); err != nil {
        return nil, err
    }
    
    // 异步触发真实采集（新增）
    go s.executeInspection(context.WithoutCancel(ctx), tenantID, id, rec.Config)
    
    return map[string]interface{}{"status": "running", "inspectionId": id}, nil
}

// 新增：真实采集执行
func (s *Service) executeInspection(ctx context.Context, tenantID, id string, config map[string]interface{}) {
    defer func() {
        if r := recover(); r != nil {
            s.repo.Update(ctx, tenantID, id, models.CreateRequest{Status: "failed"})
        }
    }()
    
    // 1. 调用采集器（CMDB Collector / Prometheus / 自定义脚本）
    resources, err := s.collector.Collect(ctx, config)
    if err != nil {
        s.repo.Update(ctx, tenantID, id, models.CreateRequest{Status: "failed"})
        return
    }
    
    // 2. 阈值校验（调 inspection-threshold service）
    problems, err := s.thresholdService.Evaluate(ctx, tenantID, id, resources)
    if err != nil {
        s.repo.Update(ctx, tenantID, id, models.CreateRequest{Status: "failed"})
        return
    }
    
    // 3. 持久化结果 + 生成报告
    status := "passed"
    if len(problems) > 0 {
        status = "warning"
        if hasCritical(problems) {
            status = "failed"
        }
        // 调 inspection-problem service 记录新问题
        s.problemService.Record(ctx, tenantID, id, problems)
    }
    s.repo.Update(ctx, tenantID, id, models.CreateRequest{Status: status})
    
    // 4. 发通知（如有问题）
    if len(problems) > 0 {
        s.notificationService.Send(ctx, ...)
    }
}
```

**依赖注入**：
- Collector（CMDB Collector SPI 注册）
- ThresholdService（inspection-threshold 模块）
- ProblemService（inspection-problem 模块）
- NotificationService（现有 notification 模块）

### 5.2 C1-1 修 chaos 静默成功

**文件**：`internal/chaos/service/service.go:628-690`

**改造前**（L686-690）：
```go
// Fallback: no injector available — log-only mode
return nil
```

**改造后**：
```go
// 强制要求 injector 可用
if s.injector == nil {
    return fmt.Errorf("chaos injector not configured: cannot execute %s on %s (K8s client required)", faultType, target)
}
return nil  // 实际上 injector != nil 时上面已 return，这里不可达
```

### 5.3 C1-2 PreReleaseVerify 真实化

**文件**：`internal/chaos/service/service.go:931-951`

**改造前**（4 项全 "skip"）：
```go
func (s *Service) checkExperimentCleanup(...) (string, string) {
    return "skip", fmt.Sprintf("no experiment cleanup check for %s/%s", serviceID, env)
}
```

**改造后**：
```go
func (s *Service) checkExperimentCleanup(ctx context.Context, serviceID, env string) (string, string) {
    // 查询该服务是否有进行中的实验
    experiments, err := s.repo.ListRunning(ctx, serviceID)  // 新增 repo 方法
    if err != nil {
        return "skip", fmt.Sprintf("cleanup check failed: %v", err)
    }
    if len(experiments) > 0 {
        return "fail", fmt.Sprintf("%d active experiment(s) for %s", len(experiments), serviceID)
    }
    return "pass", "no active experiments"
}

func (s *Service) checkInjectionQuietPeriod(ctx context.Context, serviceID, env string) (string, string) {
    cutoff := time.Now().Add(-5 * time.Minute)
    recent, err := s.repo.ListInjectionsSince(ctx, serviceID, cutoff)
    if err != nil {
        return "skip", fmt.Sprintf("quiet period check failed: %v", err)
    }
    if len(recent) > 0 {
        return "fail", fmt.Sprintf("%d injection(s) in last 5 min", len(recent))
    }
    return "pass", "quiet period OK"
}

func (s *Service) checkHealthEndpoint(ctx context.Context, serviceID, env string) (string, string) {
    target := fmt.Sprintf("http://%s.%s/healthz", serviceID, env)
    resp, err := http.Get(target)
    if err != nil {
        return "fail", fmt.Sprintf("health endpoint unreachable: %v", err)
    }
    defer resp.Body.Close()
    if resp.StatusCode != 200 {
        return "fail", fmt.Sprintf("health endpoint returned %d", resp.StatusCode)
    }
    return "pass", "health endpoint OK"
}

func (s *Service) checkSteadyState(ctx context.Context, serviceID, env string) (string, string) {
    // 调 inspection service 检查稳态
    result, err := s.inspectionService.CheckSteadyState(ctx, serviceID, env)
    if err != nil {
        return "skip", fmt.Sprintf("steady state not checked: %v", err)
    }
    if result.Passed {
        return "pass", result.Message
    }
    return "fail", result.Message
}
```

---

## 6. 关键决策点

### 6.1 MongoDB vs PostgreSQL（阈值引擎存储）

| 维度 | MongoDB | PostgreSQL JSONB |
|------|---------|-----------------|
| JSONPath 原生支持 | ✅ | ❌（需 jq 或 jsonpath 库） |
| 灵活 schema | ✅ | ⚠️（JSONB 但仍需列定义） |
| 多租户隔离 | ✅（按 database） | ✅（按 tenant_id 字段） |
| Orion 现状 | ❌ 未接入 | ✅ 已用 |
| 引入成本 | 高（新依赖） | 低（已有） |

**决策**：阈值引擎用 MongoDB（与 NeatLogic 一致，JSONPath 原生支持）。其他巡检实体（ConfigFile/Problem/Report）用 PG。

**理由**：阈值规则是高度动态的 JSON 文档，MongoDB 的 Document 模型 + JSONPath 求值是核心差异化能力。引入 MongoDB 的运维 + 客户端库成本可接受。

**备选**：若 MongoDB 不可用，用 PG JSONB + gojsonpath 库，但 FreeMarker 模板渲染需自行实现 JSONPath 求值。

### 6.2 FreeMarker vs Go template

| 维度 | FreeMarker | Go template |
|------|-----------|-------------|
| NeatLogic 一致性 | ✅ | ❌ |
| Go 生态 | ❌（需 Java 依赖或移植） | ✅ 原生 |
| 表达式能力 | 强 | 中（需自定义函数） |
| 引入成本 | 高 | 零 |

**决策**：用 Go template + 自定义函数（不引入 FreeMarker）。

**理由**：避免引入 Java 依赖。Go template 加自定义 `{{threshold}}` / `{{value}}` / `{{metric}}` 函数足够覆盖阈值告警模板需求。

### 6.3 chaos 静默成功修复方式

**选项 A**：injector=nil 时返回错误（破坏性变更）
**选项 B**：injector=nil 时返回 warning 但仍记录（向后兼容）

**决策**：选项 A（修复假成功反模式）。

**理由**：当前 `execute()` 在 injector=nil 时返回 nil，导致 ExecuteCPUSpike 等函数 L232 标记 injection 为 "completed"——这是假成功。必须强制要求 injector 可用才能执行，否则 API 应该报错让用户知道配置缺失。

**兼容性影响**：测试用例需更新（依赖 injector=nil 的测试需注入 mock injector）。

### 6.4 新建模块 vs 扩展现有

| 能力 | 决策 | 理由 |
|------|------|------|
| 阈值引擎 | 新建 `inspection-threshold/` | 独立子域 + MongoDB 依赖 + 3 层模型 |
| 风险评级 | 新建 `risk/` | 跨域共享（chaos + autoexec + inspect） |
| 场景管理 | 新建 `scenario/` | 跨域共享 |
| 配置文件 | 新建 `inspection-configfile/` | 独立子域 + PG 表 + diff 算法 |
| 报告 | 扩展 `inspection/` + 复用 `report-designer/` | 报告是巡检的核心组成 |
| 新问题 | 新建 `inspection-problem/` | 独立子域 + 自定义视图 |

### 6.5 cron consumer 实现方式

**选项 A**：用 robfig/cron（Go 生态标准）
**选项 B**：自建简易 cron（基于 time.Ticker + 表存储）

**决策**：选项 A（robfig/cron）。

**理由**：robfig/cron 是 Go 生态标准库，支持标准 cron 表达式 + 分布式锁（借 Redis 或 PG advisory lock）。自建会重复造轮子。

---

## 7. 功能完整度维度

> **设计原则**：以功能完整度衡量升级成效，不以工时衡量。每维度定义"完成度判定标准"。

### 7.1 八大功能维度

| 维度 | 当前状态 | 升级后目标 | 完成度判定标准 |
|------|---------|----------|--------------|
| 1. 采集执行 | RunInspection 桩代码，置 running 后无真实采集 | 真实调用 Collector SPI + 异步执行 + 状态收敛 | 调用后状态 running → 真实 completed/failed，有采集结果 |
| 2. 阈值校验 | 完全缺失 | MongoDB 三层模型 + JSONPath 求值 + Go template 渲染 | 阈值规则可创建/查询/重写，`$.resources.cpu` 能从 JSON 提取值 |
| 3. 配置文件管理 | 完全缺失 | CRUD + 版本比对 + 资源路径绑定 | v1→v2 diff 输出 unified diff 格式，资源路径可批量管理 |
| 4. 报告导出 | ExecuteReport 桩代码 | PDF（HTML+浏览器打印）+ Excel（excelize）+ 历史归档 | 生成可下载文件，报告历史可查 |
| 5. 调度执行 | cronExpression 字段存在无 consumer | robfig/cron consumer + 分布式锁 | cron 表达式触发巡检作业，集群环境无重复触发 |
| 6. 风险评级 | 完全缺失 | Risk CRUD + 颜色分级 + 审批门控 | 6 端点全通，red 级实验无 approval_id 时拒绝执行 |
| 7. 场景管理 | 完全缺失 | Scenario CRUD + 4 类预定义 + 实验关联 | 4 端点全通，可关联 chaos 实验 |
| 8. 稳态假设 | SteadyStateHypothesis 字段存在无消费 | 4 项真实检查 + inspection 联动 | PreReleaseVerify 4 项返回 pass/fail（不再 skip） |

### 7.2 功能覆盖度对照（升级前 vs 升级后）

| NeatLogic 能力 | Orion 升级前 | Orion 升级后 | 覆盖率变化 |
|---------------|------------|------------|-----------|
| 巡检定义（SaveInspectDefApi 等 6 API） | ❌ 缺失 | ✅ 阈值引擎 6 端点 | 0% → 100% |
| 配置文件（ListResourceFileApi 等 8 API） | ❌ 缺失 | ✅ ConfigFile 8 端点 | 0% → 100% |
| 报告导出（ExportReportApi 等 6 API） | ❌ 缺失 | ✅ Report 6 端点 | 0% → 100% |
| 新问题（ProblemReportListApi 等 5 API） | ❌ 缺失 | ✅ Problem 5 端点 | 0% → 100% |
| 风险评级（AutoexecRiskSaveApi 等 5 API） | ❌ 缺失 | ✅ Risk 6 端点 | 0% → 100% |
| 场景管理（AutoexecScenarioSaveApi 等 4 API） | ❌ 缺失 | ✅ Scenario 4 端点 | 0% → 100% |
| 巡检执行（RunInspection） | 🚫 桩代码 | ✅ 真实执行 | 桩 → 真实 |
| 稳态假设（chaos 独有） | 🚫 字段存在无消费 | ✅ 4 项检查 | 桩 → 真实 |
| 脚本审核（AutoexecScriptReviewApi） | ❌ 缺失 | ✅ approval 工作流 | 0% → 100% |
| 组合工具生成（AutoexecCombopGenerateApi） | ❌ 缺失 | ✅ pipeline-template | 0% → 100% |

**功能覆盖率**：NeatLogic 巡检 25 API + 混沌 12 API = 37 项核心能力，升级后全部覆盖。

---

## 8. 模块融入当前系统架构（依赖链与顺序）

> **设计原则**：按依赖关系确定模块融入顺序，不以工时排期。每个模块定义"前置依赖"和"下游消费者"。

### 8.1 模块依赖图

```
                    ┌─────────────┐
                    │  基础设施层  │
                    │ MongoDB 接入 │
                    │ cron 框架   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        ┌─────────┐  ┌──────────┐  ┌──────────┐
        │ 止损层   │  │ risk/    │  │ scenario/│
        │ RunInspec│  │ (跨域)   │  │ (跨域)   │
        │ chaos 修 │  └────┬─────┘  └────┬─────┘
        └────┬────┘       │             │
             │            │             │
             ▼            ▼             ▼
        ┌─────────────────────────────────────┐
        │  inspection-threshold/ (阈值引擎)    │
        │  MongoDB 三层 + JSONPath + Go tmpl  │
        └────────────┬────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
  ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ config-  │ │ chaos    │ │ inspection│
  │ file/    │ │ SteadySt │ │ -problem/ │
  │ (diff)   │ │ (消费)   │ │ (视图)    │
  └────┬─────┘ └────┬─────┘ └────┬─────┘
       │            │            │
       └────────────┼────────────┘
                    ▼
          ┌──────────────────┐
          │ inspection-report│
          │ (导出 + 调度)     │
          └────────┬─────────┘
                   │
                   ▼
          ┌──────────────────┐
          │ 产品化层          │
          │ 脚本审核工作流    │
          │ 组合工具生成      │
          └──────────────────┘
```

### 8.2 模块融入顺序（按依赖链，非时间排期）

| 顺序 | 模块 / 改造点 | 前置依赖 | 下游消费者 | 融入位置 |
|------|-------------|---------|----------|---------|
| 1 | MongoDB 接入 | MongoDB 实例 | inspection-threshold | `internal/mongodb/client.go` + 配置 |
| 2 | cron 框架 | 无 | inspection-report | `internal/cron/scheduler.go`（robfig/cron） |
| 3 | RunInspection 止损 | 无 | chaos PreReleaseVerify | `inspection/service/service.go:49-59` |
| 4 | chaos 静默成功止损 | 无 | chaos 全链路 | `chaos/service/service.go:628-690` |
| 5 | PreReleaseVerify 止损 | #3, #4 | chaos 验证 | `chaos/service/service.go:931-951` |
| 6 | 3 个硬编码 health checker 修复 | 无 | 全仓健康检查 | 全仓 grep `return {"status":"ok"}` |
| 7 | risk 模块 | 无 | chaos 审批门控 | `internal/risk/`（新建） |
| 8 | scenario 模块 | #7 | chaos 场景关联 | `internal/scenario/`（新建） |
| 9 | inspection-threshold 模块 | #1 | RunInspection 阈值校验 | `internal/inspection-threshold/`（新建） |
| 10 | chaos Experiment 扩展字段 | #7, #8 | risk/scenario 关联 | migration 703 |
| 11 | chaos ↔ risk 审批门控 | #7, #10 | chaos RunExperiment | `chaos/service/service.go` |
| 12 | chaos ↔ scenario 关联 | #8, #10 | chaos RunExperiment | `chaos/service/service.go` |
| 13 | inspection-configfile 模块 | 无 | 报告导出 | `internal/inspection-configfile/`（新建） |
| 14 | chaos SteadyStateHypothesis 真实消费 | #9 | PreReleaseVerify checkSteadyState | `chaos/service/service.go` |
| 15 | chaos ↔ notification 实验完成通知 | 现有 notification | chaos RunExperiment | `chaos/service/service.go` |
| 16 | inspection-problem 模块 | #9 | RunInspection 问题记录 | `internal/inspection-problem/`（新建） |
| 17 | inspection-report 模块 | #13, #2 | 巡检报告导出 | `internal/inspection-report/`（新建） |
| 18 | inspection ↔ report-designer 复用 | 现有 report-designer | inspection-report ExportReport | `inspection-report/service/service.go` |
| 19 | inspection ↔ notification 邮件 | 现有 notification | inspection-report ExportReport | `inspection-report/service/service.go` |
| 20 | 脚本审核工作流 | #7, 现有 approval | pipeline-template | `approval/` + `pipeline-template/` |
| 21 | 组合工具生成 | 现有 pipeline-template | pipeline-template | `pipeline-template/` |
| 22 | risk/scenario ↔ autoexec 未来扩展 | #7, #8 | pipeline-engine StageExecutor | `pipeline-engine/service/StageExecutor.go` |

### 8.3 融入层级分类

| 层级 | 模块 | 融入特征 |
|------|------|---------|
| **基础设施层** | MongoDB / cron | 新建依赖，不接业务逻辑 |
| **止损层** | RunInspection / chaos 静默成功 / PreReleaseVerify / health checker | 改造现有桩代码，无新模块 |
| **跨域共享层** | risk / scenario | 新建独立模块，被 chaos + autoexec + inspect 共享 |
| **巡检核心层** | inspection-threshold / inspection-configfile / inspection-problem | 新建独立子域，服务巡检主流程 |
| **巡检输出层** | inspection-report | 新建，复用 report-designer + notification |
| **chaos 增强层** | Experiment 扩展字段 + SteadyState 消费 + 通知 | 改造 chaos 模块，融入 risk/scenario/inspection/notification |
| **产品化层** | 脚本审核 / 组合工具 | 扩展 approval + pipeline-template |

### 8.4 与现有架构的契合度

| 现有架构特征 | 本方案契合方式 |
|------------|--------------|
| 微服务拆分（87 个 orion-*-svc） | 新模块全部在 `orion-platform-svc-go/internal/` 下，符合单体优先策略 |
| PostgreSQL Repository 模式 | ConfigFile/Problem/Report/Risk/Scenario 均用 PG Repository |
| auth.Auth 中间件 | 所有新端点挂 `auth.Auth()`，遵循 PERM-8 严格认证 |
| tenant_id 多租户隔离 | 所有新表含 tenant_id 字段 + UNIQUE 约束 |
| Design Token 体系 | 前端扩展遵循 Orion-MF 微前端 + Design Token |
| pipeline-audit-log 审计 | chaos + inspection 操作审计接入现有审计模块 |
| notification 通知抽象 | chaos 完成通知 + 巡检邮件复用现有 notification |
| approval 审批抽象 | 高风险 chaos + 脚本审核复用现有 approval |
| report-designer 报告内核 | 巡检报告导出复用现有 report-designer ExecuteReport（修复后） |
| cmdb-collector SPI | RunInspection 真实采集复用现有 cmdb-collector SPI 注册 |

---

## 9. 验收标准（功能维度）

### 9.1 止损层验收

| 验收项 | 标准 |
|--------|------|
| RunInspection 真实执行 | 调用后状态 running → 真实 completed/failed，有采集结果 |
| health checker 真实化 | 全仓 grep `return {"status":"ok"}` 零命中（除显式健康端点） |
| chaos 静默成功修复 | injector=nil 时 API 返回 500 + 错误信息 |
| PreReleaseVerify 真实化 | 4 项检查返回 pass/fail（不再 skip） |

### 9.2 阈值与风险验收

| 验收项 | 标准 |
|--------|------|
| 阈值引擎 3 层模型 | 可创建/查询/重写阈值规则，MongoDB _inspectdef collection 有数据 |
| JSONPath 求值 | `$.resources.cpu` 能从 `{"resources":{"cpu":95}}` 提取 95 |
| Go template 渲染 | `CPU {{value}}% 超过阈值 {{threshold}}%` 渲染为 `CPU 95% 超过阈值 90%` |
| Risk CRUD | 6 端点全通，red/yellow/green 三色可创建 |
| Risk 审批门控 | red 级实验无 approval_id 时拒绝执行 |
| Scenario CRUD | 4 端点全通，可关联 chaos 实验 |

### 9.3 配置与稳态验收

| 验收项 | 标准 |
|--------|------|
| 配置文件版本比对 | v1→v2 diff 输出 unified diff 格式 |
| SteadyStateHypothesis 消费 | 实验执行后稳态检查真实运行 |
| Notify Callback | 实验完成触发邮件通知 |

### 9.4 报告与调度验收

| 验收项 | 标准 |
|--------|------|
| 报告导出 PDF | 生成可下载 PDF 文件 |
| 报告导出 Excel | 生成可下载 Excel 文件 |
| 调度 consumer | cron 表达式触发巡检作业 |
| 新问题自定义视图 | 可创建/移动/重命名视图 |

### 9.5 产品化验收

| 验收项 | 标准 |
|--------|------|
| 脚本审核工作流 | pass/reject 工作流通 |
| 组合工具生成 | script → combop 转换成功 |

---

## 10. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| MongoDB 引入运维成本 | 中 | 中 | 提供 PG JSONB 备选方案 |
| chaos 静默成功修复破坏测试 | 高 | 中 | 提前更新测试用例注入 mock injector |
| RunInspection 真实执行需 Collector SPI | 高 | 高 | 复用 cmdb-collector 现有 SPI 注册 |
| 阈值 3 层模型复杂度高 | 中 | 高 | 分阶段交付：先第 1 层，再第 2/3 层 |
| 跨域 risk/scenario 设计易过度抽象 | 中 | 中 | 限定首版只服务 chaos + inspect，不接 autoexec |
| 脚本审核工作流依赖 approval 模块成熟度 | 中 | 中 | 评估 approval 模块现状，必要时简化 |

---

## 11. 现有问题的优化方案（架构债清理）

> **设计原则**：本方案（巡检 + 混沌）解决 P0 假实现与跨域基础设施，但 Orion 当前架构存在 8 大反模式 + 系统性子域缺失。本章节定义每项问题的优化方案、责任模块与优先级。

### 11.1 TS ↔ Go 双版本重叠 → 只保留 Go，TS 已归档

**问题**：
- `legacy/orion-platform-service-ts/` 含权威实现（CITypeService 469 行 + 4 Repository + CmdbTopologyService + K8sWatchClient + RelationRuleEngine + SprintBoardService）
- inception/governance/risk 三个服务 TS 与 Go 0% 功能重叠
- TS 版本与 Go 版本认知冲突，维护成本翻倍

**优化方案**：
1. **TS 版本已归档**：`legacy/orion-platform-service-ts/` 标记为"只读参考实现"，不再维护、不再编译、不再部署
2. **唯一活跃实现**：`orion-platform-svc-go/` 是唯一活跃后端
3. **TS 权威实现作为移植源**：TS 代码作为"参考蓝图"，按需移植到 Go，但不维护 TS 版本本身
4. **移除 TS 构建链**：CI/CD 不再编译 TS 版本，避免混淆

**移植清单（按业务价值排序）**：

| TS 模块 | 行数 | 移植目标 | 移植价值 | 优先级 |
|---------|------|---------|---------|--------|
| CITypeService | 469 行 | `internal/cmdb/citype/` | CMDB 核心价值（CI 类型系统） | P1 |
| 4 个 Repository | - | `internal/cmdb/repository/` | CMDB 数据访问层 | P1 |
| CmdbTopologyService | - | `internal/cmdb/graph/` | CMDB 图形化拓扑 | P2 |
| K8sWatchClient | - | `internal/cmdb/k8s-sync/` | CMDB K8s 同步 | P2 |
| RelationRuleEngine | - | `internal/cmdb/reltype/` | CMDB 关系规则 | P2 |
| SprintBoardService | - | `internal/sprint/board/` | RDM Sprint 看板 | P3 |

**责任模块**：cmdb 域 + sprint 域

### 11.2 模块过度拆分 → 反向重构 11 对重复模块

**问题**：v2 综合报告 §3.1 识别 11 对重复模块

| 域 | 重复对 | 严重度 |
|----|--------|--------|
| ITSM | ticket/ticketing、workflow/workflow-dependency/task/trigger/webhook、sla/sla-engine、process/workflow（4 对） | 高 |
| 自动化 | pipeline-template/templates、pipeline-version/versions、pipeline-batch/operations、auto-exec/auto-recovery/autonomous-pipeline、pipeline-engine/executor（5 对） | 高 |
| BI | datasource 与 report-designer 数据源管理（1 对） | 中 |
| 告警 | alert-adapter 与 alert-adapter-v2（1 对） | 中 |

**优化方案**：
1. **止损阶段不反向重构**（避免回归风险）——本方案完成后启动
2. **合并原则**：保留命名更规范的模块，迁移功能，删除重复
3. **目标**：从 73 模块收敛到 30-40 个核心模块（NeatLogic 6 单模块对应 Orion 73 模块的失衡状态）
4. **反向重构顺序**（按依赖链 + 风险递增）：
   - 第 1 步：BI datasource → report-designer（最低风险，本方案 §4.6 已复用）
   - 第 2 步：告警 alert-adapter-v2 → alert-adapter（中风险）
   - 第 3 步：ITSM 4 对（高风险，需审批工作流回归测试）
   - 第 4 步：自动化 5 对（最高风险，需 PipelineEngine 全链路回归）

**责任模块**：BI / 告警 / ITSM / 自动化 各域负责人

### 11.3 Migration 缺失 → 专项排查所有模块 001 建表

**问题**：
- CMDB 只有 `002_fts_search.sql` 无 001 建表（schema 级假实现，002 依赖 001 会失败）
- 其他模块未排查，潜在 schema 级故障
- v2 综合报告 §3.2 识别此为"比代码桩更难发现"的反模式

**优化方案**：
1. **专项排查**：检查所有模块是否有 001 建表 migration
2. **排查范围**：`orion-platform-svc-go/internal/` 下所有含 `repository/` 的模块
3. **排查命令**：`find internal -name "*.sql" | sort` + 人工核对每个模块的 001 文件存在性
4. **修复方式**：补齐 001 建表 migration（DDL + 索引 + 约束 + 外键）
5. **本方案新增 migration 编号**：700/701/702/703/704（已在 §2 数据模型定义）

**排查清单**：

| 模块 | 已知 migration | 001 建表状态 | 修复需求 |
|------|--------------|-------------|---------|
| cmdb | 002_fts_search.sql | ❌ 缺失 | 补 001 建表 |
| chaos | 待排查 | 未验证 | 排查后补齐 |
| inspection | 待排查 | 未验证 | 排查后补齐 |
| ticket | 待排查 | 未验证 | 排查后补齐 |
| 其他 | 待排查 | 未验证 | 排查后补齐 |

**责任模块**：DBA + 各域负责人

### 11.4 假实现 → 专项排查全仓桩代码

**问题**：
- v2 综合报告识别 4 处假实现（RunInspection / chaos 静默成功 / PreReleaseVerify skip / 3 硬编码 health checker）
- 全仓可能还有其他桩代码未识别

**优化方案**：
1. **本方案已解决 4 处**（§5 关键代码改造点）
2. **专项排查其他桩代码**：

```bash
# 假阳性工厂
grep -rn 'return {.*"status":.*"ok"}' --include="*.go" internal/

# 未完成标记
grep -rn '// TODO\|// FIXME\|// HACK' --include="*.go" internal/

# 硬编码标记
grep -rn 'hardcoded\|hardcoded\|mock data' --include="*.go" internal/

# 静默成功模式
grep -rn 'Fallback:.*log-only\|no injector available' --include="*.go" internal/

# 桩返回
grep -rn 'return nil$' --include="*.go" internal/ | grep -v test
```

3. **修复原则**：桩代码要么真实实现，要么返回 501 Not Implemented（**不允许假成功**）
4. **验收标准**：全仓 grep 上述模式零命中（除显式健康端点）

**责任模块**：全仓扫描，各域负责人修复

### 11.5 Service 层简化 → 补齐 Service 类

**问题**：v2 综合报告 §3.3 识别 Service 层 5:1 差距

| 模块 | NeatLogic Service 类 | Orion Service 函数 | 差距 | 本方案解决 |
|------|---------------------|-------------------|------|------------|
| 巡检 | 5 service 类 | 1 service（已扩到 5） | 5:1 | ✅ 已解决（§1.1 新建 4 子域 service） |
| BI | 4 层 service（Definition/Instance/Sqldefine/SqlGraph） | 1 service（16 函数） | 4:1 | ❌ 后续 |
| CMDB | 9 子域 service | 30 函数覆盖 6/23 子域 | 1:1.5（子域） | ❌ 后续 |
| ITSM | 20+ service 类 | 7 struct | 3:1 | ❌ 后续 |
| 告警 | 15 event handlers | 6/15 简化覆盖 | 2.5:1 | ❌ 后续 |

**优化方案**：
1. **巡检已解决**：本方案 §1.1 新建 4 个子域 service（threshold/configfile/report/problem）
2. **BI 补齐 4 层 service**：新建 ReportInstance + ReportSqldefine + ReportSqlGraph service
3. **CMDB 补齐 17 子域 service**：移植 TS CITypeService 等到 Go（§11.1 移植清单）
4. **ITSM 补齐 workcenter + channel service**：新建 workcenter/channel/channeltype service
5. **告警补齐 9 event handlers**：用 Go interface 替代 Java SPI（不引 JAR 热加载）

**责任模块**：BI / CMDB / ITSM / 告警 各域（后续 Phase）

### 11.6 独有子域全缺 → 48 子域分批补齐

**问题**：v2 综合报告 §3.4 识别 48 子域缺失

**优化方案（按业务价值分 9 批）**：

| 批次 | 子域 | 优化方式 | 优先级 | 责任域 |
|------|------|---------|--------|--------|
| **第 1 批（本方案）** | 巡检 threshold/configfile/report/problem + risk/scenario（6 子域） | 新建模块 | P0 | 巡检 + 混沌 |
| 第 2 批 | CMDB citype/attr/validator/discovery（4 子域，TS 移植） | 移植 TS + 新建 | P1 | CMDB |
| 第 3 批 | ITSM workcenter + channel/channeltype（3 子域） | 新建 | P1 | ITSM |
| 第 4 批 | BI widget + ReportSqlGraph + Import/Export（3 子域） | 新建 | P1 | BI |
| 第 5 批 | 告警 IAlertEventHandler + AlertEventManager + AlertAdapterLoader（3 子域） | Go interface 替代 SPI | P2 | 告警 |
| 第 6 批 | CMDB transaction/legalvalid/customview/globalattr/group/graph/mongodb/globalsearch/tag/mq/sync/reltype/ciview（13 子域） | 移植 + 新建 | P2 | CMDB |
| 第 7 批 | 自动化 catalog/customtemplate/job/operation/process/profile/schedule/tool/type（9 子域） | 新建 | P2 | 自动化 |
| 第 8 批 | DevOps appconfig/jsqlparser/apppipeline/bluegreen/globallock/importexport（6 子域） | 新建 | P3 | DevOps |
| 第 9 批 | RDM IssueVo 30+ 字段 + IssueAudit + 全文索引 + Webhook + Notify | 扩展 Ticket | P3 | RDM |

**总目标**：48 子域分 9 批补齐，本方案完成第 1 批（6 子域），剩余 42 子域后续 Phase 推进。

**责任模块**：各域负责人

### 11.7 Council 对抗缺失 → 引入真实多视角评审

**问题**：
- v2 综合报告是单主作者 4 角色扮演，自我锚定偏差
- 5 份 Agent 429 失败（CMDB/Alert/Automation/ITS/BI 依赖主作者补齐）
- 27% 是下限估计（真实完成度可能略高，但不会超过 35%）

**优化方案**：
1. **重跑 Council 四视角对抗**：用 Skeptic + Pragmatist + Critic 三个独立 subagent（参考 council skill）
2. **CMDB + DevOps 2 份报告重做**：v1 已补齐 v2 评审，但 Council 对抗仍未跑通
3. **引入外部评审**：邀请非主作者评审员参与，打破自我锚定
4. **修正 27% 下限估计**：Council 对抗后可能上调到 30-35%，但不应超过 40%
5. **对抗重点**：① 27% 是否准确 ② 7 项止损是否覆盖所有 P0 ③ 48 子域分批是否合理

**责任模块**：架构评审委员会

### 11.8 测试验证假实现 → 修正测试用例

**问题**：
- 13 个测试在验证 RunInspection 桩代码（测试通过 ≠ 功能正确）
- chaos 静默成功被测试通过（injector=nil 返回 nil，测试断言 nil）
- 其他模块可能有类似"测试桩验证桩代码"的反模式

**优化方案**：
1. **本方案 §5.1 修复 RunInspection 后**：13 个测试需同步更新（断言真实采集结果，而非断言 status="running"）
2. **本方案 §5.2 修复 chaos 静默成功后**：依赖 injector=nil 的测试需注入 mock injector
3. **专项排查**：

```bash
# 找出测试中 mock 桩但断言"成功"的用例
grep -rn 'mockService\|MockService' --include="*_test.go" internal/ | grep -v "error\|fail"
```

4. **修复原则**：测试应验证真实行为（采集结果/阈值校验/问题记录），而非验证桩代码的状态变更

**责任模块**：QA + 各域负责人

### 11.9 跨模块通信开销 → 评估微服务拆分边界

**问题**：
- 87 个 orion-*-svc* 蓝图全是单体部署，蓝图与部署不一致
- 11 对重复模块导致 HTTP/gRPC 延迟 10-100x（如果按蓝图拆分部署）
- 部署复杂度 10x（如果按蓝图独立部署）

**优化方案**：
1. **止损阶段不拆分**：保持 `orion-platform-svc-go` 单体部署
2. **反向重构后再评估**：合并 11 对重复模块后（§11.2），重新评估拆分边界
3. **拆分原则**：按业务域（CMDB/ITSM/BI/告警/RDM/DevOps/巡检/自动化）而非按子域
4. **目标**：从 73 模块收敛到 8-10 个业务域级微服务（与 NeatLogic 8 大模块对齐）
5. **拆分判定标准**：
   - 模块独立性（无跨域共享状态）
   - 部署频率（高频独立部署 vs 低频联合部署）
   - 团队边界（一个团队 owns 一个微服务）

**责任模块**：架构评审委员会

### 11.10 优化方案责任矩阵

| 问题 | 责任模块 | 阶段 | 优先级 | 验收标准 |
|------|---------|------|--------|---------|
| TS ↔ Go 双版本重叠 | cmdb + sprint | 本方案 + 后续 | P0 | TS 不再编译，CITypeService 移植到 Go |
| 11 对重复模块 | BI/告警/ITSM/自动化 | 本方案后 | P1 | 73 模块 → 30-40 模块 |
| Migration 缺失 | DBA + 各域 | 专项排查 | P0 | 所有模块有 001 建表 |
| 假实现排查 | 全仓 | 专项排查 | P0 | grep 桩模式零命中 |
| Service 层简化 | BI/CMDB/ITSM/告警 | 后续 Phase | P1 | 5:1 差距 → 2:1 |
| 48 子域缺失 | 各域 | 9 批推进 | P1-P3 | 48 子域 → 0 子域缺失 |
| Council 对抗缺失 | 架构评审委员会 | 重跑评审 | P2 | 3 个独立 subagent 完成 |
| 测试验证假实现 | QA + 各域 | 本方案同步 | P0 | 测试断言真实行为 |
| 跨模块通信开销 | 架构评审委员会 | 反向重构后 | P2 | 8-10 个业务域级微服务 |

---

## 12. 后续批次功能完善设计（48 子域分批补齐）

> **设计原则**：本方案（第 1 批）已完成 6 子域（巡检 threshold/configfile/report/problem + risk/scenario）。本章详细设计第 2-9 批的 42 子域，按业务价值与依赖链排序，只考虑功能完整度与模块融入架构，不考虑人力耗时。

### 12.1 第 2 批：CMDB 核心子域（TS 移植，4 子域）

**子域**：citype / attr / validator / discovery

**数据模型**：

```sql
-- migration: 705_create_cmdb_citypes.sql
CREATE TABLE cmdb_ci_types (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    parent_id VARCHAR(64),           -- 自引用继承
    icon VARCHAR(100),
    is_inherit BOOLEAN DEFAULT true,
    is_abstract BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

CREATE TABLE cmdb_ci_type_attrs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    ci_type_id VARCHAR(64) REFERENCES cmdb_ci_types(id),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    data_type VARCHAR(32),           -- string/number/date/bool/json/reference
    is_required BOOLEAN DEFAULT false,
    is_unique BOOLEAN DEFAULT false,
    is_inherited BOOLEAN DEFAULT true,
    default_value TEXT,
    validator_id VARCHAR(64),
    sort_order INTEGER DEFAULT 0,
    UNIQUE(tenant_id, ci_type_id, code)
);

CREATE TABLE cmdb_ci_attr_validators (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(32),                -- regex/range/enum/custom
    config JSONB,                    -- {pattern,min,max,values}
    error_message VARCHAR(255),
    UNIQUE(tenant_id, name)
);

CREATE TABLE cmdb_ci_type_discovery_rules (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    ci_type_id VARCHAR(64) REFERENCES cmdb_ci_types(id),
    source VARCHAR(32),              -- k8s/ssh/snmp/sql/api
    config JSONB,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(tenant_id, ci_type_id, source)
);
```

**API 设计（15 端点）**：

```
# CI 类型 CRUD
POST   /api/v1/cmdb/citypes
GET    /api/v1/cmdb/citypes
GET    /api/v1/cmdb/citypes/:id
PUT    /api/v1/cmdb/citypes/:id
DELETE /api/v1/cmdb/citypes/:id

# CI 类型属性
POST   /api/v1/cmdb/citypes/:id/attrs
GET    /api/v1/cmdb/citypes/:id/attrs
PUT    /api/v1/cmdb/citypes/:id/attrs/:attrId
DELETE /api/v1/cmdb/citypes/:id/attrs/:attrId

# 校验器
POST   /api/v1/cmdb/validators
GET    /api/v1/cmdb/validators
DELETE /api/v1/cmdb/validators/:id

# 自动发现
POST   /api/v1/cmdb/citypes/:id/discovery
GET    /api/v1/cmdb/citypes/:id/discovery
POST   /api/v1/cmdb/citypes/:id/discovery/trigger
```

**集成点**：
- citype ↔ cmdb-collector：discovery 规则驱动采集器
- citype ↔ inspection：巡检资源基于 CI 类型分组
- citype ↔ chaos：混沌实验目标按 CI 类型筛选
- validator ↔ form：表单字段校验复用 validator 规则

**移植源**：TS CITypeService（469 行）+ 4 Repository + CmdbTopologyService + K8sWatchClient + RelationRuleEngine

**关键决策**：
- CI 类型继承用 parent_id 自引用（不引闭包表）
- 属性 is_inherited=true 时子类型自动继承
- validator 用 Go interface 替代 Java SPI
- discovery 复用 cmdb-collector SPI（不新建采集器）

### 12.2 第 3 批：ITSM 工作中心与渠道（3 子域）

**子域**：workcenter / channel / channeltype

**数据模型**：

```sql
-- migration: 706_create_itsm_workcenter.sql
CREATE TABLE itsm_workcenter_views (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(32),                -- todo/done/cc/track/escalate
    conditions JSONB,
    sort_order INTEGER DEFAULT 0,
    is_default BOOLEAN DEFAULT false,
    UNIQUE(tenant_id, user_id, name)
);

CREATE TABLE itsm_channels (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(100) NOT NULL,
    type_code VARCHAR(32),
    config JSONB,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(tenant_id, name)
);

CREATE TABLE itsm_channel_types (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    code VARCHAR(32) NOT NULL,
    name VARCHAR(100) NOT NULL,
    handler_class VARCHAR(255),
    UNIQUE(tenant_id, code)
);
```

**API 设计（24+9 端点）**：

```
# 工作中心（24 API 对应 NeatLogic）
GET    /api/v1/itsm/workcenter/views
POST   /api/v1/itsm/workcenter/views
GET    /api/v1/itsm/workcenter/views/:id
PUT    /api/v1/itsm/workcenter/views/:id
DELETE /api/v1/itsm/workcenter/views/:id
GET    /api/v1/itsm/workcenter/todo
GET    /api/v1/itsm/workcenter/done
GET    /api/v1/itsm/workcenter/cc
GET    /api/v1/itsm/workcenter/track
GET    /api/v1/itsm/workcenter/escalate
POST   /api/v1/itsm/workcenter/views/:id/move
# ... 共 24 端点（含批量操作/导出/订阅）

# 渠道管理（9 端点）
POST   /api/v1/itsm/channels
GET    /api/v1/itsm/channels
GET    /api/v1/itsm/channels/:id
PUT    /api/v1/itsm/channels/:id
DELETE /api/v1/itsm/channels/:id
GET    /api/v1/itsm/channel-types
POST   /api/v1/itsm/channel-types
PUT    /api/v1/itsm/channel-types/:id
DELETE /api/v1/itsm/channel-types/:id
```

**集成点**：
- workcenter ↔ ticket：工作中心视图查询 ticket 状态
- workcenter ↔ sla-engine：待办/已办按 SLA 排序
- channel ↔ ticket：工单来源渠道标记
- channeltype ↔ notification：渠道类型驱动通知方式

**关键决策**：
- workcenter 不新建独立服务，作为 ticket 模块的视图层（避免重复模块）
- channel 用 Go interface 替代 Java handler_class（避免反射）
- channeltype 首版限定 email/sms/webhook/slack 4 类

### 12.3 第 4 批：BI 报表组件与 SQL 图形化（3 子域）

**子域**：widget / ReportSqlGraph / Import/Export

**数据模型**：

```sql
-- migration: 707_create_bi_widgets.sql
CREATE TABLE bi_widgets (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(32),               -- table/line/bar/pie/gauge/indicator
    config JSONB,                   -- 图表配置
    data_source_id VARCHAR(64),
    query_config JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE TABLE bi_report_sql_graphs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    report_id VARCHAR(64) NOT NULL,
    graph_xml TEXT,                 -- 图形化 XML
    compiled_sql TEXT,              -- 编译后 SQL
    is_active BOOLEAN DEFAULT true,
    UNIQUE(tenant_id, report_id)
);

CREATE TABLE bi_import_export_records (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    type VARCHAR(16),               -- import/export
    target VARCHAR(32),             -- dashboard/report/widget
    target_id VARCHAR(64),
    file_path TEXT,
    status VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);
```

**API 设计（约 15 端点）**：

```
# Widget 组件库
POST   /api/v1/bi/widgets
GET    /api/v1/bi/widgets
GET    /api/v1/bi/widgets/:id
PUT    /api/v1/bi/widgets/:id
DELETE /api/v1/bi/widgets/:id
GET    /api/v1/bi/widgets/types

# SQL 图形化
POST   /api/v1/bi/reports/:id/sql-graph
GET    /api/v1/bi/reports/:id/sql-graph
POST   /api/v1/bi/reports/:id/sql-graph/analyze
POST   /api/v1/bi/reports/:id/sql-graph/build

# Import/Export
POST   /api/v1/bi/dashboards/:id/export
POST   /api/v1/bi/dashboards/import
POST   /api/v1/bi/reports/:id/export
POST   /api/v1/bi/reports/import
POST   /api/v1/bi/widgets/:id/export
POST   /api/v1/bi/widgets/import
```

**集成点**：
- widget ↔ bi-dashboard：仪表板引用 widget 组合
- widget ↔ datasource：widget 查询数据源
- ReportSqlGraph ↔ report-designer：图形化 SQL 编译为执行 SQL
- Import/Export ↔ report-designer：复用 ExecuteReport（修复后）

**关键决策**：
- widget 用 React 组件渲染（前端），后端只存配置
- ReportSqlGraph 用 goja（Go JS 引擎）解析 XML，不引 Java
- Import/Export 用 JSON 格式（跨环境迁移）

### 12.4 第 5 批：告警 SPI 与事件总线（3 子域）

**子域**：IAlertEventHandler / AlertEventManager / AlertAdapterLoader

**数据模型**：

```sql
-- migration: 708_create_alert_spi.sql
CREATE TABLE alert_event_handlers (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(32),               -- condition/integration/notify
    config JSONB,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    UNIQUE(tenant_id, name)
);

CREATE TABLE alert_event_subscriptions (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    handler_id VARCHAR(64) REFERENCES alert_event_handlers(id),
    event_type VARCHAR(32),         -- fire/recover/ack/close
    conditions JSONB,
    UNIQUE(tenant_id, handler_id, event_type)
);
```

**API 设计（9 端点）**：

```
# 事件处理器
POST   /api/v1/alert/handlers
GET    /api/v1/alert/handlers
GET    /api/v1/alert/handlers/:id
PUT    /api/v1/alert/handlers/:id
DELETE /api/v1/alert/handlers/:id

# 订阅
POST   /api/v1/alert/handlers/:id/subscriptions
GET    /api/v1/alert/handlers/:id/subscriptions
DELETE /api/v1/alert/subscriptions/:id

# 触发测试
POST   /api/v1/alert/handlers/:id/test
```

**集成点**：
- AlertEventManager ↔ notification：事件触发通知
- AlertEventManager ↔ alert：告警状态变更驱动事件
- condition handler ↔ Go interface：替代 Java JS 表达式引擎

**关键决策**：
- **不引 JAR 热加载**（AlertAdapterLoader）：用 Go plugin 或编译时注册
- **不引 JS 表达式引擎**：用 Go interface + 配置 JSONB（替代 FreeMarker）
- 9/15 未覆盖 event handlers 用 Go interface 实现注册

### 12.5 第 6 批：CMDB 高级子域（13 子域）

**子域**：transaction / legalvalid / customview / globalattr / group / graph / mongodb / globalsearch / tag / mq / sync / reltype / ciview

**数据模型**：

```sql
-- migration: 709_create_cmdb_advanced.sql
CREATE TABLE cmdb_transactions (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    type VARCHAR(32),               -- create/update/delete/batch
    status VARCHAR(20),             -- pending/committed/rolledback
    operations JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE cmdb_legal_valids (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    attr_id VARCHAR(64),
    value VARCHAR(255),
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE cmdb_custom_views (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64),
    name VARCHAR(100),
    conditions JSONB,
    columns JSONB,
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE cmdb_global_attrs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(100),
    code VARCHAR(50),
    data_type VARCHAR(32),
    default_value TEXT,
    UNIQUE(tenant_id, code)
);

CREATE TABLE cmdb_groups (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(100),
    parent_id VARCHAR(64),
    type VARCHAR(32),               -- ci-group/attr-group
    UNIQUE(tenant_id, name)
);

CREATE TABLE cmdb_rel_types (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(100),
    code VARCHAR(50),
    source_type_id VARCHAR(64),
    target_type_id VARCHAR(64),
    is_directional BOOLEAN DEFAULT true,
    UNIQUE(tenant_id, code)
);

CREATE TABLE cmdb_tags (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(100),
    color VARCHAR(20),
    UNIQUE(tenant_id, name)
);
```

**API 设计（约 60 端点，按子域）**：

| 子域 | 端点数 | 核心端点 |
|------|--------|---------|
| transaction | 6 | CRUD + commit + rollback |
| legalvalid | 5 | CRUD |
| customview | 6 | CRUD + move |
| globalattr | 5 | CRUD |
| group | 6 | CRUD + tree |
| graph | 5 | query + traverse + topology |
| mongodb | 4 | adapter（评估必要性） |
| globalsearch | 3 | search + suggest |
| tag | 6 | CRUD + apply |
| mq | 4 | produce + consume |
| sync | 5 | CRUD + trigger |
| reltype | 5 | CRUD |
| ciview | 5 | CRUD |

**集成点**：
- transaction ↔ saga：复用现有 Saga 协调（不新建事务管理器）
- graph ↔ cmdb-collector：拓扑可视化
- globalsearch ↔ 全仓：统一搜索入口
- mq ↔ notification：消息队列驱动通知
- sync ↔ K8sWatchClient：外部系统同步

**关键决策**：
- transaction 用 Saga 模式（复用现有 `internal/saga/`）
- graph 用邻接表 + 递归 CTE（不引图数据库）
- mongodb 子域评估必要性（已用 PG JSONB 替代部分场景，可能不建）

### 12.6 第 7 批：自动化核心子域（9 子域）

**子域**：catalog / customtemplate / job / operation / process / profile / schedule / tool / type

**数据模型**：

```sql
-- migration: 710_create_autoexec_core.sql
CREATE TABLE autoexec_catalogs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(100),
    parent_id VARCHAR(64),
    type VARCHAR(32),
    UNIQUE(tenant_id, name)
);

CREATE TABLE autoexec_jobs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(100),
    catalog_id VARCHAR(64),
    type VARCHAR(32),               -- combop/script/tool
    config JSONB,
    status VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE autoexec_operations (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    job_id VARCHAR(64),
    name VARCHAR(100),
    runner_id VARCHAR(64),
    status VARCHAR(20),
    input JSONB,
    output JSONB
);

CREATE TABLE autoexec_tools (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(100),
    type VARCHAR(32),
    config JSONB,
    UNIQUE(tenant_id, name)
);

CREATE TABLE autoexec_profiles (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(100),
    runner_config JSONB,
    env_config JSONB,
    UNIQUE(tenant_id, name)
);
```

**API 设计（约 50 端点）**：

| 子域 | 端点数 | 核心端点 |
|------|--------|---------|
| catalog | 6 | CRUD + tree |
| customtemplate | 5 | CRUD |
| job | 10 | CRUD + execute + cancel + history |
| operation | 6 | CRUD + retry |
| process | 8 | CRUD + nodes + edges |
| profile | 5 | CRUD |
| schedule | 6 | CRUD + trigger |
| tool | 6 | CRUD + invoke |
| type | 5 | CRUD |

**集成点**：
- job ↔ runner：作业派发到 Runner Agent
- operation ↔ pipeline-engine：复用 StageExecutor 参数链
- tool ↔ risk/scenario：工具执行前风险评估（复用本方案 risk 模块）
- schedule ↔ cron：复用 cron 框架（复用本方案 cron 模块）

**关键决策**：
- **反向重构 5 对重复模块后再建新子域**（避免叠加债务）
- process 复用 pipeline-engine（不新建流程引擎）
- schedule 复用 inspection-report 的 cron（不重复建调度）

### 12.7 第 8 批：DevOps 关键子域（6 子域）

**子域**：appconfig / jsqlparser / apppipeline / bluegreen / globallock / importexport

**数据模型**：

```sql
-- migration: 711_create_devops_advanced.sql
CREATE TABLE devops_app_configs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    app_id VARCHAR(64),
    env VARCHAR(32),
    config JSONB,
    version INTEGER,
    UNIQUE(tenant_id, app_id, env)
);

CREATE TABLE devops_bluegreen_deploys (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    app_id VARCHAR(64),
    env VARCHAR(32),
    strategy VARCHAR(32),           -- blue/green/switch
    status VARCHAR(20),
    started_at TIMESTAMP
);

CREATE TABLE devops_global_locks (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    resource VARCHAR(255),
    holder VARCHAR(64),
    acquired_at TIMESTAMP,
    expires_at TIMESTAMP,
    UNIQUE(tenant_id, resource)
);
```

**API 设计（约 40 端点）**：

| 子域 | 端点数 | 核心端点 |
|------|--------|---------|
| appconfig | 8 | CRUD + diff + publish（最大子域 53 API 核心） |
| jsqlparser | 3 | parse + validate + optimize（库形式） |
| apppipeline | 7 | CRUD + bind + trigger |
| bluegreen | 6 | CRUD + switch + rollback |
| globallock | 4 | acquire + release + renew |
| importexport | 4 | export + import |

**集成点**：
- appconfig ↔ pipeline-engine：配置变更触发流水线
- jsqlparser ↔ report-designer：SQL 校验复用
- bluegreen ↔ chaos：蓝绿切换时的稳态检查（复用本方案 chaos SteadyState）
- globallock ↔ cron：分布式锁复用

**关键决策**：
- jsqlparser 用 vitess/sqlparser（Go 原生，不引 Java jsqlparser 713 行）
- globallock 用 PG advisory lock（不引 Redis）
- bluegreen 复用 chaos PreReleaseVerify（不重复建稳态检查）

### 12.8 第 9 批：RDM 字段扩展（不新建模块）

**子域**：IssueVo 30+ 字段 + IssueAudit + 全文索引 + Webhook + Notify

**数据模型**：

```sql
-- migration: 712_extend_rdm_tickets.sql
ALTER TABLE tickets
    ADD COLUMN parent_id VARCHAR(64),
    ADD COLUMN source_issue_id VARCHAR(64),
    ADD COLUMN issue_rel_list JSONB,
    ADD COLUMN attr_list JSONB,
    ADD COLUMN cost_list JSONB,
    ADD COLUMN story_points INTEGER,
    ADD COLUMN severity VARCHAR(20),
    ADD COLUMN labels JSONB,
    ADD COLUMN sprint_id VARCHAR(64);

CREATE TABLE rdm_issue_audits (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    ticket_id VARCHAR(64),
    action VARCHAR(32),
    before JSONB,
    after JSONB,
    user_id VARCHAR(64),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE rdm_webhooks (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    project_id VARCHAR(64),
    url TEXT,
    events JSONB,                   -- ["issue.created","issue.updated"]
    is_active BOOLEAN DEFAULT true
);

-- 全文索引（PG tsvector）
CREATE INDEX idx_tickets_fts ON tickets USING gin(
    to_tsvector('simple', name || ' ' || coalesce(description, ''))
);
```

**API 设计（约 15 端点）**：

| 能力 | 端点数 | 核心端点 |
|------|--------|---------|
| Issue 字段扩展 | 0 | 现有 ticket CRUD 自动支持新字段 |
| IssueAudit | 2 | list + get |
| Webhook | 5 | CRUD + test |
| Notify | 3 | list + ack + snooze |
| 全文搜索 | 1 | search |

**集成点**：
- IssueAudit ↔ pipeline-audit-log：复用审计抽象
- Webhook ↔ notification：复用通知抽象
- 全文索引 ↔ globalsearch：复用搜索抽象（第 6 批）

**关键决策**：
- **不新建独立 Requirement/Defect 表**：扩展 Ticket 字段（最经济路径）
- IssueAudit 用 PG trigger 自动记录（不引 AOP）
- 全文索引用 PG tsvector（不引 Elasticsearch）

### 12.9 后续批次汇总

| 批次 | 子域数 | 新增端点数 | 新建/改造模块 | 关键依赖 |
|------|--------|----------|--------------|---------|
| 第 2 批 CMDB 核心 | 4 | ~15 | cmdb/citype + cmdb/attr + cmdb/validator + cmdb/discovery | TS 移植 |
| 第 3 批 ITSM 工作中心 | 3 | ~33 | itsm/workcenter + itsm/channel | ticket 模块扩展 |
| 第 4 批 BI 组件 | 3 | ~15 | bi/widget + bi/sqlgraph + bi/io | report-designer 修复 |
| 第 5 批 告警 SPI | 3 | ~9 | alert/handler + alert/manager | Go interface 注册 |
| 第 6 批 CMDB 高级 | 13 | ~60 | cmdb/{transaction,legalvalid,customview,globalattr,group,graph,mongodb,globalsearch,tag,mq,sync,reltype,ciview} | 部分移植 TS |
| 第 7 批 自动化核心 | 9 | ~50 | autoexec/{catalog,customtemplate,job,operation,process,profile,schedule,tool,type} | 反向重构先行 |
| 第 8 批 DevOps | 6 | ~40 | devops/{appconfig,jsqlparser,apppipeline,bluegreen,globallock,importexport} | vitess/sqlparser |
| 第 9 批 RDM 扩展 | 5 字段组 | ~15 | 扩展 tickets 表 + rdm/audit + rdm/webhook | 不新建模块 |
| **合计** | **42 子域** | **~237 端点** | **~30 新建模块 + 6 扩展** | - |

### 12.10 累计覆盖率（含本方案第 1 批）

| 模块 | 本方案后（第 1 批） | 9 批完成后 | 增量 |
|------|------------------|----------|------|
| 巡检 | ~70% | 95% | +25pp |
| CMDB | 22% | 85% | +63pp |
| ITSM | 30% | 75% | +45pp |
| BI | 12% | 80% | +68pp |
| 告警 | 48% | 90% | +42pp |
| RDM | 33% | 80% | +47pp |
| 自动化 | 25% | 75% | +50pp |
| DevOps | 39% | 80% | +41pp |
| **加权平均** | **27%** | **~80%** | **+53pp** |

**注**：100% 不现实（部分 NeatLogic 能力过时或 Orion 有更优方案，见 §6.2 不应借鉴清单），80% 是务实目标。

### 12.11 后续批次依赖链

```
第 1 批（本方案：巡检 + risk/scenario + chaos 修复）
    │
    ├─→ 第 2 批（CMDB 核心：TS 移植）
    │       │
    │       ├─→ 第 6 批（CMDB 高级：13 子域）
    │       │       │
    │       │       └─→ 第 8 批（DevOps：appconfig 等依赖 CMDB）
    │       │
    │       └─→ 第 5 批（告警 SPI：依赖 CI 类型筛选）
    │
    ├─→ 第 3 批（ITSM 工作中心：依赖 ticket + risk）
    │       │
    │       └─→ 第 9 批（RDM 扩展：依赖 ticket 字段）
    │
    ├─→ 第 4 批（BI 组件：依赖 report-designer 修复）
    │
    └─→ 第 7 批（自动化核心：依赖反向重构 5 对重复模块）
```

**关键约束**：
- 第 7 批必须等 §11.2 反向重构 5 对自动化重复模块完成后启动
- 第 6 批必须等第 2 批 CMDB 核心完成后启动（依赖 citype）
- 第 8 批可与其他批次并行（依赖链最短）
- 第 9 批可与第 3 批并行（都依赖 ticket）

### 12.12 48 子域 NeatLogic API 功能颗粒度对比（评审补充）

> **评审目的**：§12.1-§12.8 给出了 Orion 升级后的 API 设计，但缺少 NeatLogic API 逐一对比与 Orion 现状标注。本节基于 v2 评审报告数据，列出每个子域的 NeatLogic API 清单 + Orion 现状 + 迁移路径，作为功能颗粒度对比的评审补充。

#### 12.12.1 评审方法

**对比维度**（每个子域）：
1. NeatLogic API 文件名 + 功能
2. Orion 现状（✅ 已有 / ⚠️ 部分 / 🚫 桩代码 / ❌ 缺失）
3. 迁移路径（新建 / TS 移植 / 扩展字段 / 复用现有）

**数据来源**：v2 评审报告（cmdb/itsm/inspection/automation/bi-data/alert/rdm/devops 8 份）+ granular-comparison-2026-10-01.md

**覆盖度评估**：

| 批次 | 子域数 | §12.1-§12.8 设计深度 | 本节补充对比 | 评审后覆盖度 |
|------|--------|---------------------|-------------|------------|
| 第 2 批 CMDB 核心 | 4 | 数据模型 + API + 集成 | NeatLogic API 逐一 | 充分 |
| 第 3 批 ITSM | 3 | 数据模型 + 部分 API | 24 API 逐一 | 充分 |
| 第 4 批 BI | 3 | 数据模型 + API | widget 13 子目录 | 充分 |
| 第 5 批 告警 | 3 | 数据模型 + API | 15 handlers | 充分 |
| 第 6 批 CMDB 高级 | 13 | 端点数表 | 13 子域 API | 中等→充分 |
| 第 7 批 自动化 | 9 | 端点数表 | 9 子域 API | 中等→充分 |
| 第 8 批 DevOps | 6 | 端点数表 | 6 子域 API | 中等→充分 |
| 第 9 批 RDM | 5 字段组 | 数据模型 + API | 99 API 抽样 | 充分 |

#### 12.12.2 第 2 批 CMDB 核心 4 子域 API 对比

| NeatLogic API | 功能 | Orion 现状 | 迁移路径 |
|--------------|------|----------|---------|
| **citype 子域** | | | |
| CiTypeListApi | CI 类型列表 | ❌ 缺失 | TS 移植（CITypeService） |
| CiTypeGetApi | CI 类型详情 | ❌ 缺失 | TS 移植 |
| CiTypeSaveApi | 保存 CI 类型 | ❌ 缺失 | TS 移植 |
| CiTypeDeleteApi | 删除 CI 类型 | ❌ 缺失 | TS 移植 |
| CiTypeTreeApi | CI 类型树 | ❌ 缺失 | TS 移植 |
| CiTypeAttributeListApi | 类型属性列表 | ❌ 缺失 | TS 移植 |
| **attr 子域** | | | |
| CiAttrListApi | CI 属性列表 | ❌ 缺失 | 新建（cmdb/citype/attrs） |
| CiAttrSaveApi | 保存 CI 属性 | ❌ 缺失 | 新建 |
| CiAttrDeleteApi | 删除 CI 属性 | ❌ 缺失 | 新建 |
| CiAttrSortApi | 属性排序 | ❌ 缺失 | 新建 |
| **validator 子域** | | | |
| AttrValidatorListApi | 校验器列表 | ❌ 缺失 | 新建（Go interface 替代 Java SPI） |
| AttrValidatorSaveApi | 保存校验器 | ❌ 缺失 | 新建 |
| AttrValidatorTestApi | 测试校验器 | ❌ 缺失 | 新建 |
| **discovery 子域** | | | |
| CiDiscoverySaveApi | 保存发现规则 | ❌ 缺失 | 复用 cmdb-collector SPI |
| CiDiscoveryTriggerApi | 触发自动发现 | ❌ 缺失 | 复用 cmdb-collector |
| CiDiscoveryLogApi | 发现日志 | ❌ 缺失 | 新建 |

**评审结论**：4 子域共 ~15 API，全部缺失。TS CITypeService 469 行可移植，预计覆盖 60% citype/attr API。validator/discovery 需新建。

#### 12.12.3 第 3 批 ITSM 3 子域 API 对比

| NeatLogic API | 功能 | Orion 现状 | 迁移路径 |
|--------------|------|----------|---------|
| **workcenter 子域（24 API）** | | | |
| WorkcenterListApi | 工作中心列表 | ❌ 缺失 | 扩展 ticket 模块（视图层） |
| WorkcenterTodoListApi | 待办列表 | ❌ 缺失 | 扩展 ticket |
| WorkcenterDoneListApi | 已办列表 | ❌ 缺失 | 扩展 ticket |
| WorkcenterCcListApi | 抄送列表 | ❌ 缺失 | 扩展 ticket |
| WorkcenterTrackListApi | 跟踪列表 | ❌ 缺失 | 扩展 ticket |
| WorkcenterEscalateListApi | 上报列表 | ❌ 缺失 | 扩展 ticket |
| WorkcenterViewSaveApi | 保存视图 | ❌ 缺失 | 新建 itsm/workcenter |
| WorkcenterViewDeleteApi | 删除视图 | ❌ 缺失 | 新建 |
| WorkcenterViewMoveApi | 移动视图 | ❌ 缺失 | 新建 |
| WorkcenterViewCopyApi | 复制视图 | ❌ 缺失 | 新建 |
| WorkcenterExportApi | 导出 | ❌ 缺失 | 复用 report-designer |
| WorkcenterSubscribeApi | 订阅 | ❌ 缺失 | 复用 notification |
| WorkcenterBatchReadApi | 批量已读 | ❌ 缺失 | 扩展 ticket |
| WorkcenterBatchAssignApi | 批量派工 | ❌ 缺失 | 扩展 ticket |
| WorkcenterBatchCloseApi | 批量关闭 | ❌ 缺失 | 扩展 ticket |
| WorkcenterBatchTransferApi | 批量转单 | ❌ 缺失 | 扩展 ticket |
| WorkcenterSearchApi | 搜索 | ❌ 缺失 | 扩展 ticket |
| WorkcenterFilterApi | 过滤器 | ❌ 缺失 | 新建 |
| WorkcenterSortApi | 排序 | ❌ 缺失 | 新建 |
| WorkcenterGroupApi | 分组 | ❌ 缺失 | 新建 |
| WorkcenterStatsApi | 统计 | ❌ 缺失 | 扩展 ticket |
| WorkcenterSummaryApi | 汇总 | ❌ 缺失 | 扩展 ticket |
| WorkcenterConfigApi | 配置 | ❌ 缺失 | 新建 |
| WorkcenterPermissionApi | 权限 | ❌ 缺失 | 复用 auth.Auth |
| **channel 子域（9 API）** | | | |
| ChannelListApi | 渠道列表 | ❌ 缺失 | 新建 itsm/channel |
| ChannelSaveApi | 保存渠道 | ❌ 缺失 | 新建 |
| ChannelDeleteApi | 删除渠道 | ❌ 缺失 | 新建 |
| ChannelGetApi | 渠道详情 | ❌ 缺失 | 新建 |
| ChannelMoveApi | 移动渠道 | ❌ 缺失 | 新建 |
| ChannelSearchApi | 搜索渠道 | ❌ 缺失 | 新建 |
| ChannelEnableApi | 启用渠道 | ❌ 缺失 | 新建 |
| ChannelTestApi | 测试渠道 | ❌ 缺失 | 新建 |
| ChannelConfigApi | 渠道配置 | ❌ 缺失 | 新建 |
| **channeltype 子域（11 API）** | | | |
| ChannelTypeListApi | 渠道类型列表 | ❌ 缺失 | 新建 |
| ChannelTypeSaveApi | 保存渠道类型 | ❌ 缺失 | 新建 |
| ChannelTypeDeleteApi | 删除渠道类型 | ❌ 缺失 | 新建 |
| ChannelTypeGetApi | 渠道类型详情 | ❌ 缺失 | 新建 |
| ChannelTypeSearchApi | 搜索 | ❌ 缺失 | 新建 |
| ChannelTypeMoveApi | 移动 | ❌ 缺失 | 新建 |
| ChannelTypeEnableApi | 启用 | ❌ 缺失 | 新建 |
| ChannelTypeHandlerApi | 处理器配置 | ❌ 缺失 | Go interface 替代 |
| ChannelTypeTemplateApi | 模板配置 | ❌ 缺失 | Go template |
| ChannelTypePermissionApi | 权限 | ❌ 缺失 | 复用 auth.Auth |
| ChannelTypeConfigApi | 配置 | ❌ 缺失 | 新建 |

**评审结论**：3 子域共 44 API，全部缺失。workcenter 24 API 是 ITSM 核心缺口，建议作为 ticket 模块视图层（避免新建独立服务导致重复模块）。

#### 12.12.4 第 4 批 BI 3 子域 API 对比

| NeatLogic 子目录/API | 功能 | Orion 现状 | 迁移路径 |
|---------------------|------|----------|---------|
| **widget 子目录（报表组件库）** | | | |
| WidgetTableApi | 表格组件 | ❌ 缺失 | 新建 bi/widget |
| WidgetLineApi | 折线图 | ❌ 缺失 | 新建 |
| WidgetBarApi | 柱状图 | ❌ 缺失 | 新建 |
| WidgetPieApi | 饼图 | ❌ 缺失 | 新建 |
| WidgetGaugeApi | 仪表盘 | ❌ 缺失 | 新建 |
| WidgetIndicatorApi | 指标卡 | ❌ 缺失 | 新建 |
| WidgetSaveApi | 保存组件 | ❌ 缺失 | 新建 |
| WidgetDeleteApi | 删除组件 | ❌ 缺失 | 新建 |
| WidgetListApi | 组件列表 | ❌ 缺失 | 新建 |
| WidgetCopyApi | 复制组件 | ❌ 缺失 | 新建 |
| WidgetExportApi | 导出 | ❌ 缺失 | 新建 |
| WidgetImportApi | 导入 | ❌ 缺失 | 新建 |
| WidgetPreviewApi | 预览 | ❌ 缺失 | 新建 |
| **ReportSqlGraph 4 层 service** | | | |
| ReportSqlGraphSaveApi | 保存 SQL 图 | ❌ 缺失 | 新建（goja 解析 XML） |
| ReportSqlGraphGetApi | 获取 SQL 图 | ❌ 缺失 | 新建 |
| AnalyzeReportSqlGraphXmlApi | 分析 XML | ❌ 缺失 | 新建 |
| BuildReportSqlGraphSqlApi | 编译 SQL | ❌ 缺失 | 新建 |
| GetReportSqlExecutionApi | 执行 SQL | 🚫 桩（ExecuteReport） | 修复 report-designer |
| **Dashboard 6 API** | | | |
| SaveDashboardApi | 保存仪表板 | ⚠️ 部分（Create/Update） | 扩展 bi-dashboard |
| GetDashboardApi | 获取仪表板 | ⚠️ 部分 | 扩展 |
| DeleteDashboardApi | 删除仪表板 | ⚠️ 部分（Delete） | 扩展 |
| SearchDashboardApi | 搜索仪表板 | ⚠️ 部分（List） | 扩展 |
| ExportDashboardApi | 导出仪表板 | ❌ 缺失 | 新建 |
| ImportDashboardApi | 导入仪表板 | ❌ 缺失 | 新建 |

**评审结论**：3 子域共 ~25 API。widget 13 组件全部缺失是 BI 最大缺口。BiDashboard 5 字段需扩展为完整图表配置。

#### 12.12.5 第 5 批 告警 3 子域 API 对比

| NeatLogic 能力 | 功能 | Orion 现状 | 迁移路径 |
|---------------|------|----------|---------|
| **IAlertEventHandler SPI（15 handlers）** | | | |
| AlertFiredHandler | 告警触发 | ⚠️ 6/15 覆盖 | Go interface 注册 |
| AlertRecoveredHandler | 告警恢复 | ❌ 缺失 | 新建 |
| AlertAckedHandler | 告警确认 | ❌ 缺失 | 新建 |
| AlertClosedHandler | 告警关闭 | ❌ 缺失 | 新建 |
| AlertEscalatedHandler | 告警上报 | ❌ 缺失 | 新建 |
| AlertSuppressedHandler | 告警抑制 | ❌ 缺失 | 新建 |
| AlertDeduplicatedHandler | 告警去重 | ❌ 缺失 | 新建 |
| AlertCorrelatedHandler | 告警关联 | ❌ 缺失 | 新建 |
| AlertEnrichedHandler | 告警富化 | ❌ 缺失 | 新建 |
| **Condition handler** | | | |
| JS 表达式引擎 | 条件判断 | ❌ 缺失 | Go interface 替代 JS |
| 嵌套子 handler | 嵌套执行 | ❌ 缺失 | Go interface |
| **Integration handler** | | | |
| Freemarker 模板 | 模板渲染 | ❌ 缺失 | Go template 替代 |
| **AlertEventManager** | | | |
| EventDispatcher | 事件分发 | ❌ 缺失 | 新建 alert/manager |
| EventSubscription | 事件订阅 | ❌ 缺失 | 新建 |
| EventBus | 事件总线 | ❌ 缺失 | 用 Go channel 或 NATS |
| **AlertAdapterLoader** | | | |
| JAR 热加载 | 适配器动态加载 | ❌ 缺失 | 用 Go plugin 或编译时注册 |

**评审结论**：3 子域共 ~15 handlers + 3 基础设施。9/15 handlers 缺失。不引 JAR 热加载和 JS 表达式，用 Go interface + Go template 替代。

#### 12.12.6 第 6 批 CMDB 高级 13 子域 API 对比

| NeatLogic 子域 | API 数 | Orion 现状 | 迁移路径 |
|---------------|--------|----------|---------|
| **transaction** | 6 | ❌ 缺失 | 复用 internal/saga |
| **legalvalid** | 5 | ❌ 缺失 | 新建 cmdb/legalvalid |
| **customview** | 6 | ❌ 缺失 | 新建 cmdb/customview |
| **globalattr** | 5 | ❌ 缺失 | 新建 cmdb/globalattr |
| **group** | 6 | ❌ 缺失 | 新建 cmdb/group |
| **graph** | 5 | ❌ 缺失 | 新建 cmdb/graph（邻接表 + 递归 CTE） |
| **mongodb** | 4 | ❌ 缺失 | 评估必要性（PG JSONB 可能替代） |
| **globalsearch** | 3 | ❌ 缺失 | 新建 cmdb/globalsearch（PG tsvector） |
| **tag** | 6 | ❌ 缺失 | 新建 cmdb/tag |
| **mq** | 4 | ❌ 缺失 | 用 NATS 替代 |
| **sync** | 5 | ❌ 缺失 | 复用 K8sWatchClient（TS 移植） |
| **reltype** | 5 | ❌ 缺失 | 新建 cmdb/reltype |
| **ciview** | 5 | ❌ 缺失 | 新建 cmdb/ciview |

**评审结论**：13 子域共 ~55 API，全部缺失。mongodb/mq 子域建议用 PG JSONB/NATS 替代，不直接移植。transaction 复用现有 Saga。globalsearch 用 PG tsvector。

#### 12.12.7 第 7 批 自动化 9 子域 API 对比

| NeatLogic 子域 | API 数 | Orion 现状 | 迁移路径 |
|---------------|--------|----------|---------|
| **catalog** | 6 | ❌ 缺失 | 新建 autoexec/catalog |
| **customtemplate** | 5 | ❌ 缺失 | 新建 autoexec/customtemplate |
| **job** | 10 | ❌ 缺失 | 新建 autoexec/job（复用 Runner Agent） |
| **operation** | 6 | ❌ 缺失 | 新建 autoexec/operation |
| **process** | 8 | ❌ 缺失 | 复用 pipeline-engine |
| **profile** | 5 | ❌ 缺失 | 新建 autoexec/profile |
| **schedule** | 6 | ❌ 缺失 | 复用 cron 框架 |
| **tool** | 6 | ❌ 缺失 | 新建 autoexec/tool |
| **type** | 5 | ❌ 缺失 | 新建 autoexec/type |

**评审结论**：9 子域共 ~57 API，全部缺失。process 复用 pipeline-engine，schedule 复用 cron 框架。必须先反向重构 5 对重复模块（§11.2）。

#### 12.12.8 第 8 批 DevOps 6 子域 API 对比

| NeatLogic 子域 | API 数 | Orion 现状 | 迁移路径 |
|---------------|--------|----------|---------|
| **appconfig** | 53 | ❌ 缺失 | 新建 devops/appconfig（最大子域） |
| **jsqlparser** | 库 | ❌ 缺失 | 用 vitess/sqlparser（Go 原生） |
| **apppipeline** | 7 | ❌ 缺失 | 新建 devops/apppipeline |
| **bluegreen** | 6 | ❌ 缺失 | 新建 devops/bluegreen（复用 chaos SteadyState） |
| **globallock** | 4 | ❌ 缺失 | 用 PG advisory lock |
| **importexport** | 4 | ❌ 缺失 | 新建 devops/importexport |

**评审结论**：6 子域共 ~74 API。appconfig 53 API 是最大缺口。jsqlparser 用 vitess/sqlparser 替代 Java 713 行实现。

#### 12.12.9 第 9 批 RDM 5 字段组对比

| NeatLogic IssueVo 字段 | 功能 | Orion 现状 | 迁移路径 |
|----------------------|------|----------|---------|
| parentId | 父 Issue | ❌ 缺失 | ALTER tickets ADD parent_id |
| sourceIssueId | 源 Issue | ❌ 缺失 | ALTER ADD |
| issueRelList | 关联 Issue 列表 | ❌ 缺失 | ALTER ADD JSONB |
| attrList | 自定义属性 | ❌ 缺失 | ALTER ADD JSONB |
| costList | 成本列表 | ❌ 缺失 | ALTER ADD JSONB |
| story_points | 故事点 | ❌ 缺失 | ALTER ADD |
| severity | 严重度 | ❌ 缺失 | ALTER ADD |
| labels | 标签 | ❌ 缺失 | ALTER ADD JSONB |
| sprint_id | Sprint 关联 | ❌ 缺失 | ALTER ADD |
| **IssueAudit** | AOP 审计 | ❌ 缺失 | PG trigger 自动记录 |
| **全文索引** | 全文搜索 | ❌ 缺失 | PG tsvector |
| **Webhook** | 事件推送 | ❌ 缺失 | 新建 rdm/webhook |
| **Notify 策略** | 通知策略 | ❌ 缺失 | 复用 notification |

**评审结论**：9 字段 + 3 基础设施。扩展 Ticket 字段是最经济路径（不新建独立表）。99 API 中核心 15 个通过字段扩展覆盖。

#### 12.12.10 评审结论

**功能颗粒度对比覆盖度**：

| 维度 | 评审前 | 评审后 | 增量 |
|------|--------|--------|------|
| NeatLogic API 逐一对比 | 0/48 子域 | 48/48 子域 | +48 |
| Orion 现状标注 | 0/48 | 48/48 | +48 |
| 迁移路径明确 | 部分 | 全部 | 充分 |
| 数据模型 | 7/13 子域（CMDB 高级） | 7/13（其余用端点数表） | 中等 |
| API 设计 | 端点数表 | 逐一 API | 充分 |

**关键发现**：
1. **48 子域共约 280 API**，本方案（第 1 批）覆盖 37 API，剩余 243 API 分 8 批补齐
2. **TS 移植可覆盖约 60 API**（CMDB citype/attr + sync + graph + K8sWatchClient）
3. **复用现有模块可覆盖约 50 API**（process→pipeline-engine、schedule→cron、transaction→saga、globalsearch→tsvector）
4. **新建模块约 170 API**（workcenter/channel/widget/autoexec-9子域/devops-6子域）
5. **不应移植约 8 API**（mongodb→PG JSONB、mq→NATS、JAR 热加载→Go plugin、JS 表达式→Go interface、FreeMarker→Go template、jsqlparser→vitess、IPMI→Redfish、OS Agent→Prometheus）

**评审建议**：
1. §12.1-§12.8 的数据模型与 API 设计已充分，本节功能颗粒度对比补齐了 NeatLogic API 逐一对比与 Orion 现状标注
2. 第 6 批 CMDB 高级 13 子域的数据模型只有 7 表，建议补充 graph/mongodb/globalsearch/mq/sync/ciview 6 子域的 DDL（但 mongodb/mq 可能不建）
3. 第 7 批自动化 9 子域的数据模型只有 5 表，建议补充 customtemplate/process/schedule/type 4 子域的 DDL
4. 后续批次启动前，应先验证 TS 移植可行性（CITypeService 469 行）与现有模块复用接口（saga/cron/pipeline-engine）

---

## 13. 与之前报告的差异

| 维度 | v2 综合报告 | granular-comparison | **本设计方案** |
|------|------------|---------------------|--------------|
| 颗粒度 | 识别级（48 子域缺失） | 功能级（66+90 API 对比） | **设计级（数据模型 + API + 集成）** |
| 输出 | 7 项止损 + Phase 聚合工时 | 28 项任务 + 依赖图 + ROI | **完整设计方案 + 代码改造点 + 功能完整度维度** |
| 可执行性 | 识别问题 | 排序任务 | **直接编码（含代码改造前后对比）** |
| 决策点 | 未涉及 | 未涉及 | **5 项关键决策 + 备选方案** |
| 评价标尺 | 工时 + ROI | 工时 + ROI | **功能完整度 8 维度 + 模块融入依赖链** |

---

## 14. 深度评审：颗粒度、融合度、可扩展性

> **评审目的**：用户要求深度评审引入新功能的颗粒度是否详细、当前架构是否完美融合、是否需要升级到最佳可扩展状态。本节以 3×8 维度评分（每维度 1-5 分），识别缺口与升级路径。

### 14.1 引入新功能的颗粒度评审

#### 14.1.1 八维度评分

| 维度 | 当前文档覆盖 | 评分 | 缺口 |
|------|------------|------|------|
| 1. 数据模型（DDL） | §2 全部表结构 + §12 各批次 DDL | 4.5/5 | 第 6 批 CMDB 高级缺 6 子域 DDL，第 7 批自动化缺 4 子域 DDL |
| 2. API 设计（端点） | §3 25+12 端点 + §12 各批次 + §12.12 逐一对比 | 4.5/5 | 部分批次只有端点数表，未逐一展开 |
| 3. 数据结构（Go struct/interface） | ❌ 缺失 | 1.5/5 | 仅 DDL，未定义 Repository interface / Service struct / Domain model |
| 4. 核心算法/流程伪代码 | §5 三处改造前后对比 + §4 集成点代码 | 3/5 | 阈值引擎 JSONPath 求值算法、配置文件 diff 算法、cron 分布式锁算法未给出伪代码 |
| 5. 错误处理与边界条件 | ⚠️ 部分提及（chaos 静默成功、PreReleaseVerify） | 2/5 | 阈值引擎异常、采集失败、调度冲突、跨域调用超时等边界未定义 |
| 6. 测试用例设计 | §9 验收标准（功能维度） | 2.5/5 | 验收标准是黑盒，未设计单元测试/集成测试/E2E 测试用例 |
| 7. 配置项与开关 | §6 关键决策（MongoDB/cron/Go template） | 2/5 | 阈值引擎开关、采集器选择、调度锁模式、报告格式开关等未定义 |
| 8. 前端交互契约 | ❌ 未涉及 | 1/5 | 新增 25+12 端点的前端 API 客户端、页面交互、表单设计未定义 |

**颗粒度综合评分：2.7/5（中等偏下）**

#### 14.1.2 缺失项清单

| 缺失项 | 严重度 | 补充建议 |
|--------|--------|---------|
| Go struct / interface 定义 | 高 | 为每个新建模块定义 Repository interface + Service struct + Domain model（参考现有 inspection RepositoryInterface 模式） |
| 核心算法伪代码 | 高 | 阈值引擎 JSONPath 求值、配置文件 unified diff、cron 分布式锁、报告渲染流水线 |
| 错误处理边界 | 高 | 阈值引擎异常分类（规则未找到/JSONPath 失败/模板渲染失败）、采集失败重试策略、调度冲突解决 |
| 测试用例设计 | 中 | 单元测试（阈值求值/diff/锁）+ 集成测试（RunInspection 端到端）+ E2E（客户演示场景） |
| 配置项 | 中 | 阈值引擎开关、MongoDB 连接配置、cron 锁模式（Redis/PG）、报告格式（PDF/Excel） |
| 前端交互契约 | 中 | 25 巡检端点 + 12 混沌端点的前端 API 客户端 + 页面交互（表单/列表/详情） |
| 性能指标 | 低 | 阈值求值延迟 / 采集吞吐 / 调度精度 / 报告生成耗时 |
| 限流与熔断 | 低 | 阈值引擎并发限制、采集并发限制、调度触发限流 |

#### 14.1.3 颗粒度补充建议

**补充优先级**：

| 优先级 | 补充项 | 责任 |
|--------|--------|------|
| P0 | Go struct / interface 定义 | 各新建模块负责人 |
| P0 | 核心算法伪代码 | 阈值引擎 + diff + 锁 |
| P0 | 错误处理边界 | 各模块负责人 |
| P1 | 测试用例设计 | QA + 各模块 |
| P1 | 配置项 | 各模块 + 运维 |
| P2 | 前端交互契约 | 前端 + 后端协同 |
| P2 | 性能指标 | 各模块 |
| P3 | 限流与熔断 | 架构组 |

### 14.2 当前架构融合度评审

#### 14.2.1 八维度评分

| 维度 | 当前文档覆盖 | 评分 | 缺口 |
|------|------------|------|------|
| 1. 模块融入顺序 | §8.2 22 个模块融入顺序表 | 4.5/5 | 充分 |
| 2. 模块依赖图 | §8.1 ASCII 依赖图 + §12.11 后续批次依赖链 | 4/5 | 跨批次依赖链可更清晰 |
| 3. 端到端调用链 | ❌ 缺失 | 1.5/5 | RunInspection → Collector → Threshold → Problem → Notification 端到端调用链未画出 |
| 4. 数据一致性（事务边界） | ⚠️ §6.1 提及 MongoDB vs PG，但未定义事务边界 | 2/5 | 阈值引擎跨 MongoDB + PG 的事务边界、chaos Experiment 跨多表事务未定义 |
| 5. 错误传播与降级 | ⚠️ §10 风险表提及，但未系统化 | 2/5 | chaos injector 失败 → 巡检降级 → 通知失败 → 审批超时的错误传播链未定义 |
| 6. 跨模块可观测性 | ❌ 未涉及 | 1/5 | trace（OpenTelemetry）/ log（结构化）/ metric（Prometheus）的跨模块串联未定义 |
| 7. 部署与配置融合 | ⚠️ §6 提及 MongoDB/cron，但未涉及部署 | 2/5 | MongoDB 部署、cron 集群部署、配置中心融合未定义 |
| 8. 回归测试策略 | ❌ 未涉及 | 1/5 | chaos 静默成功修复后 13 个测试需更新，但系统化回归策略未定义 |

**融合度综合评分：2.3/5（中等偏下）**

#### 14.2.2 缺失项清单

| 缺失项 | 严重度 | 补充建议 |
|--------|--------|---------|
| 端到端调用链 | 高 | 画 RunInspection / RunExperiment / ExportReport / ScheduleFire 4 条核心调用链（时序图） |
| 事务边界定义 | 高 | 阈值引擎（MongoDB 单文档事务）+ 巡检主流程（PG 跨表事务）+ chaos（Saga 协调） |
| 错误传播与降级 | 高 | 定义 chaos 失败 → 巡检降级 → 通知 fallback → 审批超时的降级策略 |
| 跨模块可观测性 | 高 | trace 串联（OpenTelemetry traceparent 透传）+ log 关联（traceId）+ metric 聚合（Prometheus） |
| 部署融合 | 中 | MongoDB 单独部署 + cron 集群部署 + 配置中心（env / configmap） |
| 回归测试策略 | 中 | chaos 修复后 13 个测试更新清单 + RunInspection 真实化后集成测试 + 全仓 grep 桩代码回归 |
| 融合冲突点 | 中 | risk 模块被 chaos + inspect + autoexec 共享时的接口稳定性、scenario 关联多 target 的扩展性 |
| 性能影响评估 | 低 | 阈值引擎 MongoDB 查询延迟、cron 调度精度、报告生成耗时 |

#### 14.2.3 融合度补充建议

**补充优先级**：

| 优先级 | 补充项 | 责任 |
|--------|--------|------|
| P0 | 端到端调用链（4 条核心） | 架构组 |
| P0 | 事务边界定义 | 架构组 + 各模块 |
| P0 | 错误传播与降级 | 架构组 |
| P1 | 跨模块可观测性 | 运维 + 各模块 |
| P1 | 回归测试策略 | QA |
| P2 | 部署融合 | 运维 |
| P2 | 融合冲突点 | 架构组 |
| P3 | 性能影响评估 | 性能组 |

### 14.3 最佳可扩展状态评审

#### 14.3.1 八维度评分

| 维度 | 当前文档覆盖 | 评分 | 缺口 |
|------|------------|------|------|
| 1. 可扩展性评估框架 | ❌ 缺失 | 1/5 | 无评估框架（接口稳定性 / 插件化 / 配置化 / 多租户 / 多环境） |
| 2. SPI / Plugin 化判定 | ⚠️ §6.4 提及新建 vs 扩展，§11.5 提及 Go interface 替代 Java SPI | 2.5/5 | 阈值引擎是否插件化、采集器 SPI 注册机制、告警 handler 注册机制未系统化 |
| 3. 接口稳定性等级 | ❌ 缺失 | 1/5 | 新建 25+12 端点的接口稳定性等级（Stable / Beta / Alpha / Internal）未定义 |
| 4. 演进式架构路径 | ⚠️ §11.9 提及微服务拆分边界，但未系统化 | 2/5 | 从单体 → 业务域微服务 → 子域微服务的演进路径未定义 |
| 5. 技术债优先级 | ✅ §11.10 优化方案责任矩阵 | 4/5 | 充分 |
| 6. 团队 Topology 映射 | ❌ 未涉及 | 1/5 | 团队拓扑（康威定律）与模块边界对齐未定义 |
| 7. DDD 限界上下文 | ❌ 未涉及 | 1/5 | 各子域的限界上下文、聚合根、领域事件未定义 |
| 8. 扩展点清单 | ⚠️ §11.5 提及 SPI，但未系统化 | 2/5 | 全仓扩展点清单（采集器 / 阈值 / handler / 通知 / 审批 / 报告）未定义 |

**可扩展性综合评分：1.8/5（偏低）**

#### 14.3.2 缺失项清单

| 缺失项 | 严重度 | 补充建议 |
|--------|--------|---------|
| 可扩展性评估框架 | 高 | 定义 5 维评估（接口稳定性 / 插件化 / 配置化 / 多租户 / 多环境），每维度评分 |
| SPI / Plugin 化判定 | 高 | 阈值引擎插件化（MongoDB / PG JSONB 双实现）、采集器 SPI（已有）、告警 handler Go interface 注册 |
| 接口稳定性等级 | 高 | 25 巡检端点 + 12 混沌端点标注 Stable/Beta/Alpha/Internal |
| 演进式架构路径 | 中 | 单体 → 8 业务域微服务 → 子域微服务三阶段演进路径 |
| 团队 Topology 映射 | 中 | CMDB 团队 / ITSM 团队 / BI 团队等与模块边界对齐 |
| DDD 限界上下文 | 中 | 各子域的聚合根、领域事件、上下文映射图 |
| 扩展点清单 | 中 | 全仓扩展点（采集器 / 阈值 / handler / 通知 / 审批 / 报告 / widget / channel） |
| 配置化与开关 | 低 | 阈值引擎开关、MongoDB/PG 切换、cron 锁模式、报告格式 |

#### 14.3.3 升级到最佳可扩展状态的路径

**最佳可扩展状态目标**：

```
当前状态（评分 1.8/5）
    ↓
补充扩展点清单 + SPI 化判定（评分 3/5）
    ↓
定义接口稳定性等级 + DDD 限界上下文（评分 4/5）
    ↓
演进式架构路径 + 团队 Topology 映射（评分 4.5/5）
    ↓
最佳可扩展状态（评分 5/5）
```

**升级路径**：

| 阶段 | 升级内容 | 升级后评分 |
|------|---------|----------|
| 当前 | 无系统化可扩展性设计 | 1.8/5 |
| 阶段 1 | 补充扩展点清单 + SPI 化判定 | 3/5 |
| 阶段 2 | 定义接口稳定性等级 + DDD 限界上下文 | 4/5 |
| 阶段 3 | 演进式架构路径 + 团队 Topology 映射 | 4.5/5 |
| 阶段 4 | 配置化与开关 + 多租户/多环境验证 | 5/5 |

### 14.4 综合评审结论

#### 14.4.1 三维度评分汇总

| 维度 | 评分 | 状态 | 优先级 |
|------|------|------|--------|
| 颗粒度 | 2.7/5 | 中等偏下 | 需补充 P0 项 |
| 融合度 | 2.3/5 | 中等偏下 | 需补充 P0 项 |
| 可扩展性 | 1.8/5 | 偏低 | 需系统化升级 |

**综合评分：2.3/5（中等偏下）**

#### 14.4.2 关键缺口（P0）

| 缺口 | 维度 | 影响 | 补充建议 |
|------|------|------|---------|
| Go struct / interface 定义 | 颗粒度 | 新建模块无契约，开发无法启动 | 为每个新建模块定义 Repository interface + Service struct |
| 核心算法伪代码 | 颗粒度 | 阈值求值/diff/锁实现无参考 | 4 个核心算法伪代码 |
| 端到端调用链 | 融合度 | 模块融入后端到端行为未知 | 4 条核心调用链时序图 |
| 事务边界定义 | 融合度 | 跨 MongoDB + PG 数据一致性风险 | 阈值引擎/巡检主流程/chaos 三类事务边界 |
| 错误传播与降级 | 融合度 | 故障扩散不可控 | chaos → 巡检 → 通知 → 审批 降级链 |
| 跨模块可观测性 | 融合度 | 故障定位困难 | trace/log/metric 跨模块串联 |
| 可扩展性评估框架 | 可扩展性 | 无系统化扩展性设计 | 5 维评估框架 |
| SPI / Plugin 化判定 | 可扩展性 | 关键能力无法插件化 | 阈值引擎/采集器/handler/通知 SPI 化 |

#### 14.4.3 是否需要升级到最佳可扩展状态？

**结论：需要，但分阶段升级，不在本方案止损阶段做。**

| 阶段 | 升级目标 | 何时启动 |
|------|---------|---------|
| 本方案（第 1 批） | 解决 P0 假实现 + 跨域基础设施 | 立即 |
| 本方案补充 | 补充 P0 颗粒度 + P0 融合度缺口 | 本方案启动前 |
| 第 2-3 批 | 补充可扩展性评估框架 + SPI 化 | 本方案完成后 |
| 第 4-6 批 | 接口稳定性等级 + DDD 限界上下文 | 第 2-3 批完成后 |
| 第 7-9 批 | 演进式架构路径 + 团队 Topology | 第 4-6 批完成后 |

**建议**：
1. **本方案启动前**，先补充 §14.1.2 和 §14.2.2 的 P0 缺口（Go struct / interface / 算法伪代码 / 调用链 / 事务边界 / 降级链 / 可观测性）
2. **本方案执行中**，按补充的 P0 缺口实施
3. **本方案完成后**，启动可扩展性系统化升级（阶段 1-4）

#### 14.4.4 评审最终判断

| 评审项 | 评审结论 |
|--------|---------|
| 引入新功能的颗粒度是否详细 | **不够详细**（2.7/5），缺 Go struct / 算法伪代码 / 错误边界 / 测试用例 |
| 当前架构是否完美融合 | **未完美融合**（2.3/5），缺端到端调用链 / 事务边界 / 降级链 / 可观测性 |
| 是否需要升级到最佳可扩展状态 | **需要**（1.8/5），分 4 阶段升级，不在止损阶段做 |

**评审建议**：本方案设计深度需补充 P0 缺口后再启动实施，可扩展性升级延后到第 2-3 批启动。

---

## 15. 认知边界

1. **本方案基于颗粒度对比 + NeatLogic 源码实证**，所有数据模型 / API 路径 / 代码改造点均经源码验证
2. **未做到**：① 全量 NeatLogic 66+90 API 文件读取（只读 6 个关键 API）② TS 遗留代码可移植性评估（CITypeService 469 行未验证）③ 现有 approval/notification 模块成熟度评估
3. **设计假设**：① MongoDB 可用 ② robfig/cron 可引入 ③ cmdb-collector SPI 可复用 ④ approval 模块支持自定义工作流
4. **评价标尺转换**：本方案以"功能完整度 8 维度 + 模块融入依赖链"取代工时估算，聚焦于"升级后能做什么"而非"多久做完"

---

**报告版本**：v5（最终设计方案，去除工时估算，聚焦功能完整度与模块融入）
**发布日期**：2026-10-01
**建议读者**：CTO / VP Engineering / 巡检与混沌工程团队 / 架构评审委员会
**建议下一步**：
1. 架构评审委员会评审本方案的功能完整度维度与模块依赖链
2. 验证 4 项设计假设（MongoDB / cron / Collector SPI / approval 模块）
3. 按依赖链顺序启动基础设施层 + 止损层（融入顺序 #1-#6）
