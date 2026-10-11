# 架构融入设计（BB，2026-10-03）

**范围**：把 8 份模块级升级设计 + AA 数据模型 + 7 份方法级评审中的架构改动整合为**单一权威架构融入蓝图**
**上游文档**：
- AA：`reports/module-upgrade-designs/data-model-migration-design-2026-10-03.md`（Migration 699-765）
- 8 模块：`reports/module-upgrade-designs/{cmdb,itsm,inspection,automation,bi,alert,rdm,devops}-upgrade-design-2026-10-03.md`
- 方法级：`reports/expert-reviews/{cmdb-itsm,alert-devops,automation-bi-rdm,inspection,frontend}-*method-level-2026-10-03.md`
- NeatLogic 一手：`reports/expert-reviews/neatlogic-deploy-tagent-change-firsthand-2026-10-03.md`（NL-4 已落地，其他 NL-1/2/3/5 仍在跑）
**硬约束**：不估算人天；不修改生产代码；只产出 Markdown；不动 PipelineEngine 3163 行 A 级引擎；不重写已有 wiring（130+ `wiring-*.go` 文件保持）

---

## 0. TL;DR

- **架构原则**：**最小侵入 + 分层融入 + 双写过渡 + 可独立回滚**
- **融入层级**：5 层（DB / Repository / Service / Handler / Wiring）
- **新增模块**：14 个新 `internal/` 目录（含 5 自动化子域 + 4 Alert 子域 + 2 DevOps 子域 + 3 其他）
- **改造模块**：8 个现有模块（CMDB / ITSM / Inspection / BI / Alert / DevOps / RDM / Automation）
- **Wiring 文件新增**：14 个 `wiring-*.go`（按现有 130+ 命名规范）
- **Router 改造**：1 处 `cmd/server/router.go` 增加 5 新路由组
- **依赖注入**：复用现有 `infrastructure` + `*zap.Logger` + `*sql.DB` 三件套
- **跨模块通信**：3 种模式（直接调用 / 事件总线 / 共享表）
- **不动的部分**：`PipelineEngine` 3163 行 + `gin` 中间件链 + `auth.Auth` PERM-8 + `extension-point/registry` + `crossover/registry`

---

## 1. 当前架构现状（代码实证）

### 1.1 入口与分层

| 层 | 文件 | 职责 |
|----|------|------|
| 入口 | `cmd/server/main.go` | 启动 + 信号处理 + graceful shutdown |
| 基础设施 | `cmd/server/config.go` + `core_infra_wiring.go` | DB / Logger / Config 加载 |
| Wiring | `cmd/server/wiring.go` + 130+ `wiring-*.go` | 模块装配（DI） |
| Router | `cmd/server/router.go` | Gin 路由注册 + 中间件链 |
| 模块 | `internal/<module>/{handler,service,repository,models}` 295 个 | 标准四层 |

### 1.2 Wiring 装配模式

**当前模式**（130+ `wiring-*.go` 文件统计得出的事实）：

```go
// 文件名：cmd/server/wiring-{module-name}.go
package main

import (
    "orion/platform-svc-go/internal/{module}/handler"
    "orion/platform-svc-go/internal/{module}/repository"
    "orion/platform-svc-go/internal/{module}/service"
)

func wire{ModuleName}(db *sql.DB, logger *zap.Logger) {
    repo := repository.NewRepository(db)
    svc := service.NewService(repo)
    h := handler.NewHandler(svc)
    handler.RegisterRoutes(h)  // 通过 init 或全局注册
}
```

**已存在 wiring 文件数**：130+ 个（按 `ls cmd/server/wiring-*.go | wc -l`）

**`wiring.go` 主调度**：
```go
func initWiring(infra *infrastructure, logger *zap.Logger) {
    db := infra.db
    wireAlertPipeline(db, logger)
    wireAlertAdapter(db, logger)
    // ... 130+ 次调用
}
```

### 1.3 Router 路由注册模式

**`router.go` setupRouter**：
- 全局中间件：Logger / Recovery / RateLimit / Timeout / SecurityHeaders / Prometheus / CircuitBreaker
- `/metrics` / `/circuit-breakers/status` 裸露
- `/api/v1` group：OptionalAuth / StrictAuth（PERM-8）
- 各模块 `RegisterRoutes(api)` 自注册

### 1.4 模块内部标准四层

```
internal/{module}/
├── handler/      # HTTP 层（Gin）
│   ├── handler.go        # RegisterRoutes + 业务方法
│   └── handler_test.go
├── service/      # 业务逻辑
│   └── service.go
├── repository/   # 数据访问
│   └── repository.go
├── models/       # 数据模型
│   └── models.go
└── migrations/   # 模块内 migration（可选）
```

### 1.5 跨模块通信现状

| 模式 | 实现 | 使用场景 |
|------|------|---------|
| 直接调用 | Service A → Service B | 大量使用（紧耦合） |
| 事件总线 | `internal/eventbus/` | 告警/工单/部署事件 |
| 共享表 | 跨模块读对方表 | RDM 读 tickets / Alert 读 alerts |
| Registry | `extension-point/registry` `crossover/registry` | 扩展点 |
| NATS | `internal/{incident,self-healing}/nats/` | 异步分发 |

---

## 2. 架构融入原则

### 2.1 最小侵入原则

**原则**：新功能优先新增模块，不重写现有模块。

**强制约束**：
- 不动 `PipelineEngine` 3163 行（A级引擎）
- 不动 `gin` 中间件链
- 不动 `auth.Auth` PERM-8 链路
- 不动 130+ 个已存在 `wiring-*.go` 文件
- 不重命名现有 `internal/` 目录
- Migration 699-765 不改动 698 及之前的 migration

**例外**：明确标注的"改造点"（如 alert-adapter-v2 加 TenantContext）

### 2.2 分层融入原则

| 层 | 融入策略 | 优先级 |
|----|---------|-------|
| DB（Migration） | 全新表 + ALTER，参考 AA | P0 |
| Repository | 新模块新 Repo，ALTER 字段加方法 | P0 |
| Service | 新模块新 Service，跨模块调用走接口 | P0 |
| Handler | 新模块新 Handler，路由自注册 | P0 |
| Wiring | 新增 `wiring-{module}.go`，不改动旧的 | P0 |
| Router | 在 `setupRouter` 末尾追加调用 | P0 |

### 2.3 双写过渡原则

**适用场景**：
- Alert 5 家族从 memory 迁到 PG（735-739）
- ITSM Workcenter 与现有 tickets 双向关联
- RDM tasks 与 tickets 双向关联
- Tagent 若引入（待 NL-5 确认）

**双写规则**：
1. 新表写入 + 旧存储写入（memory 或旧表）
2. 读优先新表，失败回退旧存储
3. 双写期 2 周（不写死，由用户决定）
4. 验证数据一致后切读新表
5. 旧存储标 deprecated 但不删

### 2.4 可独立回滚原则

**每个新模块必须满足**：
- 删除 `internal/{module}/` 目录
- 删除 `wiring-{module}.go`
- 从 `wiring.go` 移除一行调用
- `migrate down NNN_*_down.sql`
- 不影响其他模块编译

---

## 3. 14 个新模块融入清单

### 3.1 自动化 5 新子域（automation-upgrade-design）

| 模块 | 路径 | Wiring 文件 | Migration | 依赖 |
|------|------|-----------|---------|------|
| automation-catalog | `internal/automation-catalog/` | `wiring-automation-catalog.go` | 722 | 无 |
| automation-scenario | `internal/automation-scenario/` | `wiring-automation-scenario.go` | 723 | automation-profile |
| automation-profile | `internal/automation-profile/` | `wiring-automation-profile.go` | 724 | 无 |
| automation-combop | `internal/automation-combop/` | `wiring-automation-combop.go` | 725 | automation-scenario |
| automation-customtemplate | `internal/automation-customtemplate/` | `wiring-automation-customtemplate.go` | 726 | 无 |

**模块内目录结构**（标准四层）：
```
internal/automation-catalog/
├── handler/handler.go        # 6 端点 RegisterRoutes
├── service/service.go        # CatalogService
├── repository/repository.go  # CatalogRepo
├── models/models.go          # CatalogItem/Category
└── migrations/               # 模块内 migration（可选）
```

### 3.2 Alert 4 新子域（alert-upgrade-design）

| 模块 | 路径 | Wiring 文件 | Migration | 依赖 |
|------|------|-----------|---------|------|
| alert-oncall | `internal/alert-oncall/` | `wiring-alert-oncall.go` | 740 | alert |
| alert-shift | `internal/alert-shift/` | `wiring-alert-shift.go` | 741 | alert-oncall |
| alert-sla | `internal/alert-sla/` | `wiring-alert-sla.go` | 742 | alert |
| alert-dashboard | `internal/alert-dashboard/` | `wiring-alert-dashboard.go` | 743 | alert |

### 3.3 DevOps 2 新子域（devops-upgrade-design）

| 模块 | 路径 | Wiring 文件 | Migration | 依赖 |
|------|------|-----------|---------|------|
| appconfig | `internal/appconfig/` | `wiring-appconfig.go` | 757-760 | 无 |
| apppipeline | `internal/apppipeline/` | `wiring-apppipeline.go` | 761-762 | pipeline / application |

### 3.4 DevOps 5 个 K8s/Helm 适配器（devops-upgrade-design）

| 模块 | 路径 | Wiring 文件 | 依赖 |
|------|------|-----------|------|
| k8s-client | `internal/k8s-client/` | `wiring-k8s-client.go` | 无 |
| helm-client | `internal/helm-client/` | `wiring-helm-client.go` | 无 |
| argocd-client | `internal/argocd-client/` | `wiring-argocd-client.go` | 无 |
| tekton-client | `internal/tekton-client/` | `wiring-tekton-client.go` | 无 |
| knative-client | `internal/knative-client/` | `wiring-knative-client.go` | 无 |

**说明**：5 个 client 模块**不挂载 HTTP 路由**，仅作为 service 层被 `deploy/service` 调用。

### 3.4 ITSM 2 新子域（itsm-upgrade-design）

| 模块 | 路径 | Wiring 文件 | Migration | 依赖 |
|------|------|-----------|---------|------|
| workcenter | `internal/workcenter/` | `wiring-workcenter.go` | 710 | tickets |
| itsm-sla-engine | `internal/itsm-sla-engine/` | `wiring-itsm-sla-engine.go` | 706-709 | tickets |

### 3.5 其他

| 模块 | 路径 | Wiring 文件 | Migration | 依赖 |
|------|------|-----------|---------|------|
| code-repo-webhook | `internal/code-repo/webhook/` | 改造现有 `wiring-code-repo.go` | 765 | code-repo |
| artifact-sbom | `internal/artifact/sbom/` | 改造现有 `wiring-artifact.go` | 763 | artifact |
| artifact-signature | `internal/artifact/signature/` | 同上 | 764 | artifact |

**说明**：以上 3 项是改造现有模块，不新增 `wiring-*.go`。

### 3.6 新模块合计

| 类型 | 数量 |
|------|------|
| 全新独立模块 | 14 个（automation 5 + alert 4 + devops 2 + itsm 2 + k8s-client 5 = 18，去掉 K8s-client 5 个非 HTTP = 14 个 HTTP 模块） |
| 改造现有模块 | 8 个（cmdb / itsm / inspection / automation / bi / alert / devops / rdm） |
| 新增 `wiring-*.go` | 14 个 |
| 改造 `wiring-*.go` | 3 个（code-repo / artifact / alert-adapter-v2） |

---

## 4. 跨模块通信设计

### 4.1 通信模式选择

| 场景 | 模式 | 示例 |
|------|------|------|
| 同步读取 | 直接调用 Service | RDM → ITSM ReadTicket |
| 异步通知 | 事件总线 | Alert 升级 → ITSM CreateIncident |
| 大量数据共享 | 共享表 | RDM rdm_tasks 读 tickets |
| 跨服务（未来） | gRPC | 平台 → Runner Agent |
| 扩展点 | Registry | automation-runner-types 注册 |

### 4.2 直接调用接口规范

**原则**：跨模块直接调用必须通过 Service 接口，不直接读对方 Repository。

**示例**：
```go
// internal/rdm/service/service.go
type TicketReader interface {
    GetTicket(ctx context.Context, id int64) (*Ticket, error)
    UpdateTicketExt(ctx context.Context, ticketID int64, ext TicketExt) error
}

type Service struct {
    ticketReader TicketReader  // 通过接口注入
}
```

**装配**（wiring-rdm.go）：
```go
func wireRDM(db *sql.DB, logger *zap.Logger) {
    itsmSvc := itsm_service.NewService(itsm_repo.NewRepository(db))
    rdmRepo := rdm_repo.NewRepository(db)
    rdmSvc := rdm_service.NewService(rdmRepo, itsmSvc)  // 注入 ITSM Service
    h := rdm_handler.NewHandler(rdmSvc)
    handler.RegisterRoutes(h)
}
```

### 4.3 事件总线使用规范

**事件总线**：`internal/eventbus/`（已存在）

**事件类型**（沿用现有）：
- `alert.created` / `alert.resolved` / `alert.escalated`
- `ticket.created` / `ticket.updated` / `ticket.closed`
- `pipeline.run.started` / `pipeline.run.completed`
- `deployment.succeeded` / `deployment.failed`
- `inspection.problem.detected`

**新增事件**（本轮融入）：
- `automation.scenario.executed`
- `alert.oncall.assigned`
- `alert.sla.violated`
- `apppipeline.triggered`
- `rdm.requirement.changed`

**发布规范**：
```go
// 发布方
eventbus.Publish(ctx, "alert.sla.violated", AlertSLAViolationEvent{
    AlertID: aid, SLAID: sid, ViolationType: "response",
})
```

**订阅规范**：
```go
// 订阅方
eventbus.Subscribe("alert.sla.violated", func(ctx context.Context, e Event) error {
    // 处理 SLA 违规，触发 escalation
    return nil
})
```

### 4.4 共享表读规范

**约束**：跨模块读对方表必须通过 Repository 接口，不直接 SQL 拼接。

**示例**：
```go
// ❌ 错误：RDM service 直接读 tickets 表
db.Query("SELECT * FROM tickets WHERE id = $1", id)

// ✅ 正确：通过 ITSM Repository 接口
type TicketRepository interface {
    FindByID(ctx context.Context, id int64) (*Ticket, error)
}
```

### 4.5 Registry 扩展点使用

**适用场景**：策略可插拔（Runner 类型 / 通知渠道 / 部署 Adapter）

**automation-runner-types 注册**：
```go
// internal/automation-runner-types/registry/registry.go
type RunnerTypeRegistry interface {
    Register(t string, factory RunnerFactory) error
    Get(t string) (RunnerFactory, error)
    List() []string
}

// 注册时机：在 wiring 阶段
func wireRunnerTypes() {
    registry.Register("ssh", NewSSHRunnerFactory())
    registry.Register("k8s-exec", NewK8sExecRunnerFactory())
    registry.Register("winrm", NewWinRMRunnerFactory())
    registry.Register("grpc", NewGRPCRunnerFactory())
}
```

**deploy Adapter 注册**：
```go
// internal/deploy/service/adapter_registry.go
type AdapterRegistry interface {
    Register(targetType string, factory AdapterFactory) error
    Get(targetType string) (AdapterFactory, error)
}

// 在 wiring-deploy.go 改造时注册
registry.Register("k8s", NewK8sAdapter(k8sClient))
registry.Register("helm", NewHelmAdapter(helmClient))
registry.Register("argocd", NewArgoCDAdapter(argocdClient))
```

---

## 5. 路由注册融入

### 5.1 `setupRouter` 改造点

**文件**：`cmd/server/router.go`

**改造位置**：`setupRouter` 函数末尾的模块路由注册段。

**改造方式**：在现有 `ticket_handler.RegisterRoutes(api)` 等调用之后追加：

```go
// === NeatLogic 对标升级（2026-10-03）新增路由组 ===
// CMDB 二阶模型
cmdbcitype_handler.RegisterRoutes(api)         // 699-704
// ITSM SLA + Workcenter
itsmsla_handler.RegisterRoutes(api)            // 706-709
workcenter_handler.RegisterRoutes(api)         // 710
// Inspection v2
inspectionv2_handler.RegisterRoutes(api)       // 713-720
// Automation 5 子域
automationcatalog_handler.RegisterRoutes(api)   // 722
automationscenario_handler.RegisterRoutes(api) // 723
automationprofile_handler.RegisterRoutes(api)  // 724
automationcombop_handler.RegisterRoutes(api)   // 725
automationcustomtemplate_handler.RegisterRoutes(api) // 726
// BI Dashboard
bidashboard_handler.RegisterRoutes(api)        // 730
// Alert 4 新子域
alertoncall_handler.RegisterRoutes(api)       // 740
alertshift_handler.RegisterRoutes(api)        // 741
alertsla_handler.RegisterRoutes(api)          // 742
alertdashboard_handler.RegisterRoutes(api)     // 743
// RDM
rdm_handler.RegisterRoutes(api)                // 745-754
// DevOps AppConfig + AppPipeline
appconfig_handler.RegisterRoutes(api)          // 757-760
apppipeline_handler.RegisterRoutes(api)        // 761-762
```

### 5.2 路由前缀规范

**强制规范**：所有新路由必须挂在 `/api/v1/` 下，前缀与模块名对应。

| 模块 | 前缀 | 示例端点 |
|------|------|---------|
| automation-catalog | `/api/v1/automation/catalog` | `GET /api/v1/automation/catalog/items` |
| automation-scenario | `/api/v1/automation/scenarios` | `POST /api/v1/automation/scenarios` |
| alert-oncall | `/api/v1/alerts/oncall` | `GET /api/v1/alerts/oncall/current` |
| alert-sla | `/api/v1/alerts/sla` | `GET /api/v1/alerts/sla/violations` |
| rdm | `/api/v1/rdm` | `GET /api/v1/rdm/requirements` |
| appconfig | `/api/v1/appconfig` | `GET /api/v1/appconfig/merge` |
| apppipeline | `/api/v1/apppipeline` | `POST /api/v1/apppipeline` |

### 5.3 路由冲突检测

**门控**：每个新路由注册前必须跑：
```bash
go test ./cmd/server/ -run TestRouteConflictScan
```

**已有测试**：`route_conflict_scan_test.go`（已存在）

---

## 6. Wiring 装配融入

### 6.1 新增 wiring 文件清单（14 个）

```
cmd/server/wiring-automation-catalog.go
cmd/server/wiring-automation-scenario.go
cmd/server/wiring-automation-profile.go
cmd/server/wiring-automation-combop.go
cmd/server/wiring-automation-customtemplate.go
cmd/server/wiring-alert-oncall.go
cmd/server/wiring-alert-shift.go
cmd/server/wiring-alert-sla.go
cmd/server/wiring-alert-dashboard.go
cmd/server/wiring-appconfig.go
cmd/server/wiring-apppipeline.go
cmd/server/wiring-workcenter.go
cmd/server/wiring-itsm-sla-engine.go
cmd/server/wiring-rdm.go
```

### 6.2 wiring 文件模板

```go
// cmd/server/wiring-{module}.go
package main

import (
    "go.uber.org/zap"
    "database/sql"

    "{module}/handler"
    "{module}/repository"
    "{module}/service"
)

func wire{ModuleName}(db *sql.DB, logger *zap.Logger) {
    repo := repository.NewRepository(db)
    svc := service.NewService(repo)
    h := handler.NewHandler(svc)
    handler.RegisterRoutes(h)
    // 如有依赖，注入其他模块
    // itsmSvc := ...; svc.SetTicketReader(itsmSvc)
}
```

### 6.3 `wiring.go` 主调度改造

**改造文件**：`cmd/server/wiring.go`

**改造位置**：`initWiring` 函数末尾追加：

```go
// === NeatLogic 对标升级（2026-10-03）新增模块 ===
wireAutomationCatalog(db, logger)
wireAutomationScenario(db, logger)
wireAutomationProfile(db, logger)
wireAutomationCombop(db, logger)
wireAutomationCustomtemplate(db, logger)
wireAlertOncall(db, logger)
wireAlertShift(db, logger)
wireAlertSla(db, logger)
wireAlertDashboard(db, logger)
wireAppconfig(db, logger)
wireApppipeline(db, logger)
wireWorkcenter(db, logger)
wireItsmSlaEngine(db, logger)
wireRDM(db, logger)
```

### 6.4 改造现有 wiring（3 个）

**改造 `wiring-alert-adapter-v2.go`**：注入 TenantContext
```go
func wireAlertAdapterV2(db *sql.DB, logger *zap.Logger) {
    // 改造：在 service 构造时注入 TenantContext 解析器
    tenantCtxResolver := auth.NewTenantContextResolver()
    repo := alert_adapter_v2_repository.NewRepository(db)
    svc := alert_adapter_v2_service.NewService(repo, tenantCtxResolver)  // 新增参数
    h := alert_adapter_v2_handler.NewHandler(svc)
    handler.RegisterRoutes(h)
}
```

**改造 `wiring-code-repo.go`**：注入 webhook 处理器
```go
func wireCodeRepo(db *sql.DB, logger *zap.Logger) {
    // ... 现有代码
    webhookHandler := coderepo_webhook.NewHandler(svc)
    coderepo_webhook.RegisterRoutes(webhookHandler, api)
}
```

**改造 `wiring-artifact.go`**：注入 SBOM + 签名
```go
func wireArtifact(db *sql.DB, logger *zap.Logger) {
    // ... 现有代码
    sbomSvc := artifact_sbom.NewService(syftClient)
    signatureSvc := artifact_signature.NewService(cosignClient)
    // 注入到 artifact service
    svc.SetSBOMService(sbomSvc)
    svc.SetSignatureService(signatureSvc)
}
```

---

## 7. 内部模块结构规范

### 7.1 标准四层目录

每个新 `internal/{module}/` 必须遵守：

```
internal/{module}/
├── handler/
│   ├── handler.go        # HTTP 入口 + RegisterRoutes
│   └── handler_test.go
├── service/
│   ├── service.go        # 业务逻辑
│   └── service_test.go
├── repository/
│   ├── repository.go     # 数据访问
│   └── repository_test.go
├── models/
│   └── models.go        # 数据模型 + 请求/响应 DTO
└── migrations/          # 模块内 migration（可选，仅当模块独立部署时）
```

### 7.2 模块对外接口

**对外暴露的最小接口集**（其他模块只通过这些接口调用）：

```go
// internal/{module}/service/iface.go
package service

type {ModuleName}Service interface {
    Create(ctx context.Context, req *CreateReq) (*Model, error)
    Get(ctx context.Context, id int64) (*Model, error)
    List(ctx context.Context, filter *Filter) ([]*Model, error)
    Update(ctx context.Context, id int64, req *UpdateReq) (*Model, error)
    Delete(ctx context.Context, id int64) error
}
```

### 7.3 测试覆盖规范

**每个新模块最少测试**：
- `handler_test.go`：路由 + 中间件 + 权限
- `service_test.go`：业务逻辑 + 边界
- `repository_test.go`：CRUD + 边界

**测试要求**：
- 单元测试 ≥ 80% 覆盖
- 关键路径 e2e 测试
- Migration up/down 幂等

---

## 8. 依赖图与启动顺序

### 8.1 模块依赖 DAG

```
                   ┌──────────────┐
                   │  CMDB CIType  │
                   │  (699-704)   │
                   └──────┬───────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
  ┌──────────┐      ┌──────────┐      ┌──────────┐
  │   ITSM   │      │Automation│      │   Alert  │
  │ (705-712)│      │ (721-728)│      │ (735-744)│
  └────┬─────┘      └────┬─────┘      └────┬─────┘
       │                  │                  │
       │  ┌───────────────┼──────────────┐  │
       │  ▼               ▼              ▼  │
       │ Inspection    BI Dashboard    DevOps│
       │ (713-720)    (729-734)      (755-765)
       │  │               │              │  │
       └──┼───────────────┼──────────────┘  │
          │               │                 │
          └───────────────┼─────────────────┘
                          │
                     ┌────┴─────┐
                     │   RDM    │
                     │(745-754) │
                     └──────────┘
```

### 8.2 Wiring 执行顺序

**强制顺序**（在 `initWiring` 中）：

1. **基础设施层**：DB / Logger / Config / Auth
2. **CMDB 二阶模型**：`wireCmdbCiType` → `wireCmdbCiAttributes`
3. **ITSM 扩展**：`wireItsmSlaEngine` → `wireWorkcenter`
4. **Automation 5 子域**：`wireAutomationCatalog` → `wireAutomationProfile` → `wireAutomationScenario` → `wireAutomationCombop` → `wireAutomationCustomtemplate`
5. **BI Dashboard**：`wireBiDashboard`
6. **Alert 4 子域**：`wireAlertOncall` → `wireAlertShift` → `wireAlertSla` → `wireAlertDashboard`
7. **DevOps 扩展**：`wireAppconfig` → `wireApppipeline`
8. **RDM**：`wireRDM`（依赖 ITSM + BI）

### 8.3 Migration 顺序与 Wiring 协调

**严格规则**：Migration 必须先于 Wiring 应用。

```
Migration 699-704 应用 → wireCmdbCiType 启用
Migration 705-712 应用 → wireItsmSlaEngine 启用
... 依次类推
```

**应用启动检查**：每个 wiring 函数在构造 Repository 时检查对应表是否存在：
```go
func wireCmdbCiType(db *sql.DB, logger *zap.Logger) {
    if err := db.Ping(); err != nil { /* fatal */ }
    var exists bool
    db.QueryRow("SELECT EXISTS (...)").Scan(&exists)
    if !exists {
        logger.Warn("cmdb_ci_types table not exists, skip wiring")
        return
    }
    // ... 正常 wiring
}
```

---

## 9. Pipeline Engine 融入（特殊处理）

### 9.1 不动原则

**PipelineEngine**（3163 行 A 级）**完全不动**，包括：
- `engine.go` 448 行
- `StageExecutor.go` 609 行
- `StageOrchestrator.go` 533 行
- `container_executor.go` 307 行
- `multi_target_executor.go` 221 行
- `gRPC/server.go` 204 行
- `retry.go` + `checkpoint.go` + `parallel_stage.go` 478 行

### 9.2 StageExecutor artifact 传播（G0-1）改造

**问题**：`StageExecutor.go:503-511` 注释明确写"Upstream task outputs are not yet propagated to dependent stages"

**改造方案**（最小侵入）：
1. **新增** `internal/pipeline-engine/service/artifact_bus.go`（新文件，不改 StageExecutor.go）
2. StageExecutor `executeTask` 完成后**调用** ArtifactBus.Publish(result)
3. `resolveTaskParameters`（462 行）**调用** ArtifactBus.Read(stage_id, task_id)
4. ArtifactBus 后端是 `pipeline_task_results` 表（Migration 721）

**代码示意**：
```go
// internal/pipeline-engine/service/artifact_bus.go（新文件）
type ArtifactBus struct {
    repo PipelineTaskResultRepository
}

func (b *ArtifactBus) Publish(ctx context.Context, stageID, taskID int64, result map[string]any) error {
    return b.repo.WriteResult(ctx, stageID, taskID, result)
}

func (b *ArtifactBus) Read(ctx context.Context, stageID, taskID int64) (map[string]any, error) {
    return b.repo.ReadResult(ctx, stageID, taskID)
}

// 在 StageExecutor 中（最小改动）：
// L462: params, err := s.resolveTaskParameters(task, s.artifactBus)
// L511: s.artifactBus.Publish(ctx, stageID, task.ID, result)
```

**对 StageExecutor.go 改动量**：约 5-10 行（仅注入 ArtifactBus 调用）

### 9.3 TaskRunner 扩展（G0-2）改造

**问题**：当前 TaskRunner 只有 3 种（shell/docker/sub-pipeline）

**改造方案**：
1. **新增** 3 个 TaskRunner 实现文件（不动 StageExecutor.go 的 switch 分支本体）
2. StageExecutor switch 分支**扩展** 3 个 case（约 5 行）

**代码示意**：
```go
// internal/pipeline-engine/service/task_runner_ssh.go（新文件）
func (s *StageExecutor) executeSSHTask(ctx context.Context, task *Task) (*Result, error) {
    // SSH 实现，约 200-400 行
}

// internal/pipeline-engine/service/task_runner_winrm.go（新文件）
func (s *StageExecutor) executeWinRMTask(...) (*Result, error) { ... }

// internal/pipeline-engine/service/task_runner_k8sexec.go（新文件）
func (s *StageExecutor) executeK8sExecTask(...) (*Result, error) { ... }

// StageExecutor.go switch 分支（约 5-10 行新增）：
case "ssh": return s.executeSSHTask(ctx, task)
case "winrm": return s.executeWinRMTask(ctx, task)
case "k8s-exec": return s.executeK8sExecTask(ctx, task)
```

**对 StageExecutor.go 改动量**：约 10 行（switch 新增 3 个 case）

---

## 10. 前端融入

### 10.1 前端发现（来自 frontend-frontend-method-level-2026-10-03.md）

| 指标 | 数值 |
|------|------|
| 前后端 API 路径覆盖率 | 49.7%（179 clients / 358 handlers） |
| CRUD 完整性 | 41.7%（5/12 核心域） |
| 契约对齐 | 85% 精确 / 93% 语义 |
| 前端孤岛 | 7 个 |
| API 客户端孤岛 | 15+ 个 |

### 10.2 前端融入原则

**原则**：后端先行，前端跟随。

**优先级**：
1. **P0**：后端补齐 API → 前端 API client 减少孤岛
2. **P1**：前端 CRUD 补齐（Update 入口缺失最严重）
3. **P2**：交互完整性（loading / disabled / message 反馈）

### 10.3 前端模块对应表

| 后端新模块 | 前端对应页面 | API client 文件 |
|-----------|------------|---------------|
| automation-catalog | 自动化/服务目录 | `api/automation-catalog.ts` |
| automation-scenario | 自动化/场景 | `api/automation-scenario.ts` |
| alert-oncall | 告警/值班 | `api/alert-oncall.ts` |
| alert-sla | 告警/SLA | `api/alert-sla.ts` |
| rdm | 需求管理 | `api/rdm.ts` |
| appconfig | 应用配置 | `api/appconfig.ts` |
| apppipeline | 应用流水线 | `api/apppipeline.ts` |
| workcenter | 工作台 | `api/workcenter.ts` |

### 10.4 前端路由注册

**前端路由文件**：`orion-frontend/src/router/routes.tsx`

**新增路由组**（按现有 8 大菜单归类）：
- 交付 / 工作台：automation-catalog / automation-scenario / apppipeline
- 可观测性：alert-oncall / alert-sla / alert-dashboard
- 治理：rdm / workcenter / appconfig

---

## 11. 风险与降级（与 CC 交叉引用）

详见 CC 文档（`risk-fallback-design-2026-10-03.md`）。

**架构层关键风险**：
1. **跨模块循环依赖**：RDM 依赖 ITSM，ITSM 依赖 Alert，Alert 升级到 ITSM
   - **降级**：通过事件总线解耦，避免直接调用
2. **Wiring 顺序错误**：依赖模块未启动先调用
   - **降级**：每个 wiring 函数自检依赖表存在
3. **Migration 失败**：单号失败阻塞全量
   - **降级**：每个号独立 up/down，失败可跳过
4. **前端 API 路径不匹配**：前后端联调失败
   - **降级**：契约对齐测试 + 自动生成 OpenAPI

---

## 12. 落地清单（与 AA 联动）

### 12.1 阶段 0（前置）

- [ ] AA 阶段 0 完成（PG 14+ / go build 0 错误）
- [ ] `ls cmd/server/wiring-*.go` 基线确认 130+ 个
- [ ] `internal/` 295 模块基线确认

### 12.2 阶段 1（CMDB + ITSM）

- [ ] 创建 `internal/cmdb-citype/` + 标准四层
- [ ] 创建 `wiring-cmdb-citype.go`
- [ ] 在 `wiring.go` 追加调用
- [ ] 在 `router.go` 追加路由注册
- [ ] 同步创建 `internal/workcenter/` + `internal/itsm-sla-engine/`

### 12.3 阶段 2-7

按 8 模块设计顺序执行，每段：
- [ ] 创建 N 个新 `internal/{module}/`
- [ ] 创建 N 个 `wiring-{module}.go`
- [ ] 在 `wiring.go` 追加调用
- [ ] 在 `router.go` 追加路由注册
- [ ] 单测覆盖

### 12.4 阶段 8（全量验证）

- [ ] `go build ./...` 0 错误
- [ ] `go test ./...` 全绿
- [ ] 路由冲突扫描通过
- [ ] 前后端契约对齐 95%+

---

## 13. 认知边界

- 未验证 14 个新模块全部能通过 `go build ./...`（需落地后验证）
- 未评估 130+ wiring 文件中是否已有命名冲突（新增 14 个文件名前先 `ls` 验证）
- 未评估 `internal/eventbus` 容量是否支撑新增 5 个事件类型
- 未验证 5 个 K8s/Helm 适配器库的版本兼容性（需 go.mod 验证）
- 未评估前端 8 个新页面对微前端 Orion-MF 加载性能的影响
- NL-1/2/3/5 4 个 NeatLogic 一手扫描仍在跑，结果可能修订某些模块设计

---

**文档编号**：`architecture-integration-design-2026-10-03.md`
**关联文档**：
- AA：`data-model-migration-design-2026-10-03.md`
- CC：`risk-fallback-design-2026-10-03.md`（待写）
- 上游：8 份 `module-upgrade-designs/*.md`
- 方法级：5 份 `expert-reviews/*-method-level-*.md`
- NeatLogic 一手：`expert-reviews/neatlogic-*.md`（5 份，NL-4 已落地）

**待更新**：NL 一手扫描全完成后，可能需要追加 patch 章节（如 Tagent 是否引入）。
