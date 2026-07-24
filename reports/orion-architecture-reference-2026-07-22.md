# Orion 系统架构开发参考

> **生成日期**: 2026-07-22
> **用途**: 新功能开发、代码阅读、架构理解 — 开发者的日常参考手册
> **适用**: Go 1.25 + Gin + PostgreSQL + NATS

---

## 目录

1. [架构总览](#1-架构总览)
2. [开发规范速查](#2-开发规范速查)
3. [平台核心域 (170+)](#3-平台核心域-170)
4. [API 网关路由映射](#4-api-网关路由映射)
5. [Go 公共库速查](#5-go-公共库速查)
6. [蓝图微服务速查](#6-蓝图微服务速查)
7. [数据库与迁移](#7-数据库与迁移)
8. [测试规范](#8-测试规范)
9. [常见开发模式](#9-常见开发模式)
10. [错误处理规范](#10-错误处理规范)

---

## 1. 架构总览

### 1.1 六层架构

```
cmd/                    # 可执行入口
├── server/             # 主服务 (wiring.go → DI 组装)
│   ├── main.go
│   ├── config.go
│   ├── router.go
│   ├── wiring.go           # 核心 DI 组装
│   ├── core_infra_wiring.go
│   ├── cicd_domain_wiring.go
│   ├── pipeline_wave_wiring.go
│   ├── blueprint_batch_wiring.go
│   └── notification_auth_wiring.go
├── audit-cli/          # 审计 CLI
│   ├── main.go
│   ├── commands/
│   │   ├── data_compare
│   │   ├── report
│   │   ├── schema_check
│   │   └── source_audit
│   ├── output/formatter.go
│   └── types/
└── pipeline-engine/    # Pipeline 独立引擎
    └── main.go

internal/               # 170+ 业务域 (每个域: handler/service/repository/models)
├── {domain}/
│   ├── handler/        # HTTP 处理器 (gin.Handler)
│   ├── service/        # 业务服务 (ServiceInterface 接口 + serviceImpl)
│   ├── repository/     # 数据访问 (RepositoryInterface 接口 + repository)
│   ├── models/         # 模型 (struct + validator)
│   └── config/         # 域配置
│
pkg/                    # 公共工具包
├── idempotency/        # 幂等性 (Checker/Redis/PG/中间件)
├── nats/               # NATS 订阅
├── errors/             # 结构化错误
├── logger/             # 统一日志
└── middleware/         # 通用中间件

test/                   # 测试套件
├── benchmark/          # 性能基准
├── integration/        # 集成测试 (auth + pipeline)
└── e2e/                # 端到端测试 (auth)
```

### 1.2 技术栈

| 组件 | 技术 | 版本 |
|------|------|------|
| 后端 | Go | 1.25 |
| Web 框架 | Gin + sqlx | — |
| 消息 | NATS | — |
| 数据库 | PostgreSQL + Redis | — |
| AI 服务 | Python 3.14 + FastAPI | — |
| 前端 | React 19 + Vite + Ant Design | — |
| 部署 | K8s (67 模块) | — |
| 可观测性 | OpenTelemetry + Prometheus + Grafana | — |
| 权限 | RBAC + ABAC | orion-go-common/auth |
| 幂等性 | Redis + PostgreSQL | orion-go-common/idempotency |

### 1.3 服务拓扑

```
orion-api-gateway (Node.js, Express, 14 中间件 + 14 路由)
    │  鉴权: JWT + RBAC + ABAC + 设备指纹
    │  路由: 灰度路由 + Token 管理 + WebSocket
    │
    ├── orion-platform-svc-go     # 核心平台 (170+ 域)
    ├── orion-ai-svc-go           # AI 独立服务 (aigateway/aiagent)
    ├── orion-ci-cd-svc-go        # CI/CD 独立服务 (pipeline 域)
    ├── orion-ticket-svc-go       # 工单独立服务 (ticket/queue/automation)
    ├── orion-notification-svc-go # 通知独立服务 (template/channel/scheduled)
    ├── orion-identity-svc-go     # 身份独立服务 (confirmation/apikey/sso/mfa/role/permission)
    ├── orion-knowledge           # 知识库 (Go + Next.js + Vue)
    ├── orion-visor               # 堡垒机 (Go + Vue)
    ├── orion-dba                 # 数据库管理 (Go + Vue)
    ├── orion-ai-service          # Python FastAPI (66 文件)
    ├── orion-ai-agents-svc       # Python FastAPI + OTel (2224 文件)
    └── orion-intelligence-svc    # Python FastAPI (3940 文件, 7 种 AI 分析)
```

---

## 2. 开发规范速查

### 2.1 新域创建模板

```bash
# 在 internal/ 下创建新域
mkdir -p internal/{my-domain}/{handler,service,repository,models,config}
```

### 2.2 Handler 模式（含租户感知）

```go
package mydomain

import (
    "context"
    "github.com/gin-gonic/gin"
    "github.com/orion/go-common/auth"
)

type Handler struct {
    Service ServiceInterface
}

func (h *Handler) RegisterRoutes(r gin.RouterGroup) {
    r.POST("/create", h.Create)
    r.GET("/list", h.List)
    r.GET("/:id", h.Get)
    r.PUT("/:id", h.Update)
    r.DELETE("/:id", h.Delete)
}

func (h *Handler) Create(c *gin.Context) {
    // 1. 获取租户 ID（所有 API 必须）
    tenantID := auth.GetTenantID(c)
    
    // 2. 绑定请求体
    var req CreateRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, NewErrorResponse(400, "invalid request body", err.Error()))
        return
    }
    
    // 3. 权限校验
    if err := auth.RequirePermission(c, "my_domain:create"); err != nil {
        c.JSON(403, NewErrorResponse(403, "permission denied", ""))
        return
    }
    
    // 4. 调用服务层
    result, err := h.Service.Create(c, tenantID, req)
    if err != nil {
        c.JSON(500, NewErrorResponse(500, "internal error", err.Error()))
        return
    }
    
    // 5. 统一响应
    c.JSON(201, NewSuccessResponse(result))
}

func (h *Handler) List(c *gin.Context) {
    tenantID := auth.GetTenantID(c)
    page := c.DefaultQuery("page", "1")
    size := c.DefaultQuery("size", "20")
    
    items, total, err := h.Service.List(c, tenantID, page, size)
    if err != nil {
        c.JSON(500, NewErrorResponse(500, "internal error", err.Error()))
        return
    }
    c.JSON(200, NewPaginatedResponse(items, total))
}
```

### 2.3 Service 模式（含 context + tenant）

```go
type ServiceInterface interface {
    Create(ctx context.Context, tenantID string, req CreateRequest) (*MyModel, error)
    Get(ctx context.Context, tenantID string, id int64) (*MyModel, error)
    List(ctx context.Context, tenantID string, page, size string) ([]*MyModel, int64, error)
    Update(ctx context.Context, tenantID string, id int64, req UpdateRequest) error
    Delete(ctx context.Context, tenantID string, id int64) error
}

type serviceImpl struct {
    Repository RepositoryInterface
}

func NewService(repo RepositoryInterface) ServiceInterface {
    return &serviceImpl{Repository: repo}
}

func (s *serviceImpl) Create(ctx context.Context, tenantID string, req CreateRequest) (*MyModel, error) {
    model := &MyModel{
        TenantID: tenantID,
        // ... 从 req 填充字段
    }
    if err := s.Repository.Insert(ctx, model); err != nil {
        return nil, fmt.Errorf("create mymodel: %w", err)
    }
    return model, nil
}
```

### 2.4 Repository 模式（含 context）

```go
type RepositoryInterface interface {
    Insert(ctx context.Context, model *MyModel) error
    FindByID(ctx context.Context, id int64) (*MyModel, error)
    FindAll(ctx context.Context, opts *ListOptions) ([]*MyModel, error)
    Update(ctx context.Context, model *MyModel) error
    Delete(ctx context.Context, id int64) error
    Count(ctx context.Context, opts *ListOptions) (int64, error)
}

type ListOptions struct {
    TenantID string
    Page     int
    Size     int
    Filter   map[string]interface{}
}

func NewRepository(db *sql.DB) RepositoryInterface {
    return &repository{db: db}
}

func (r *repository) Insert(ctx context.Context, model *MyModel) error {
    query := `INSERT INTO my_domain_models (id, tenant_id, name, ...) VALUES ($1, $2, $3, ...)`
    _, err := r.db.ExecContext(ctx, query, model.ID, model.TenantID, model.Name)
    return err
}

func (r *repository) FindAll(ctx context.Context, opts *ListOptions) ([]*MyModel, error) {
    query := `SELECT ... FROM my_domain_models WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
    rows, err := r.db.QueryContext(ctx, query, opts.TenantID, opts.Size, opts.Page)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    // ... 扫描结果
}
```

### 2.5 Wiring (DI) 模式

```go
// cmd/server/wiring.go
func NewMyDomainHandler(db *sql.DB) *mydomain.Handler {
    repo := mydomain.NewRepository(db)
    service := mydomain.NewService(repo)
    return &mydomain.Handler{Service: service}
}

// 注册路由
func registerRoutes(r *gin.Engine) {
    handler := NewMyDomainHandler(db)
    handler.RegisterRoutes(r.Group("/api/v1/my-domain"))
}
```

### 2.6 响应格式

```go
// 统一成功响应
type SuccessResponse struct {
    Code    int         `json:"code"`
    Message string      `json:"message"`
    Data    interface{} `json:"data"`
}

func NewSuccessResponse(data interface{}) SuccessResponse {
    return SuccessResponse{Code: 0, Message: "success", Data: data}
}

// 统一错误响应
type ErrorResponse struct {
    Code    int    `json:"code"`
    Message string `json:"message"`
    Detail  string `json:"detail,omitempty"`
}

func NewErrorResponse(code int, message string, detail string) ErrorResponse {
    return ErrorResponse{Code: code, Message: message, Detail: detail}
}

// 统一分页响应
type PaginatedResponse struct {
    Code    int         `json:"code"`
    Message string      `json:"message"`
    Data    interface{} `json:"data"`
    Total   int64       `json:"total"`
    Page    int         `json:"page"`
    Size    int         `json:"size"`
}
```

---

## 3. 平台核心域 (170+)

> 以下为主要域，完整 170+ 域列表详见 `orion-system-comprehensive-review-2026-07-22.md` §2.3

### 3.1 认证与授权 (6 域)

| 域 | 文件 | 功能 | 路由 |
|----|------|------|------|
| `auth` | 8 | 登录/注册/刷新/登出 | `/auth/*` |
| `auth-enhanced` | 8 | 增强认证 | — |
| `auth-mfa` | 7 | MFA | `/auth/mfa/*` |
| `sso` | 7 | SSO | `/sso/*` |
| `sso-providers` | 7 | SSO 提供者 | `/sso/providers/*` |
| `sso-unified` | 7 | 统一 SSO | — |

### 3.2 CI/CD 与 Pipeline (22 域)

| 域 | 文件 | 功能 |
|----|------|------|
| `pipeline-engine` | 12 | **核心引擎** |
| `pipeline` | 6 | Pipeline CRUD |
| `pipeline-template` | 7 | 模板 |
| `pipeline-templates` | 7 | 模板库 |
| `pipeline-version` | 6 | 版本管理 |
| `pipeline-versions` | 7 | 版本历史 |
| `pipeline-run-history` | 7 | 运行历史 |
| `pipeline-graph` | 7 | DAG 图 |
| `pipeline-sse` | 7 | SSE 推送 |
| `pipeline-budget` | 7 | 预算管控 |
| `pipeline-error-detail` | 7 | 错误详情 |
| `pipeline-execution-control` | 6 | 执行控制 |
| `pipeline-batch` | 6 | 批量执行 |
| `pipeline-batch-operations` | 6 | 批量操作 |
| `pipeline-audit-log` | 6 | 审计日志 |
| `pipeline-trend` | 6 | 趋势分析 |
| `autonomous-pipeline` | 7 | 自主 Pipeline |
| `build` | 7 | 构建 |
| `build-env` | 7 | 构建环境 |
| `deploy` | 8 | 部署 |
| `deploy-enhanced` | 7 | 增强部署 |
| `deployment-trigger` | 7 | 部署触发器 |

### 3.3 部署与基础设施 (14 域)

| 域 | 功能 |
|----|------|
| `environment` | 环境管理 |
| `env-lifecycle` | 环境生命周期 |
| `env-profile` | 环境配置 |
| `ephemeral-env` | 临时环境 |
| `cluster` | K8s 集群管理 |
| `serverless` | Serverless 函数 |
| `multi-cloud` | 多云管理 |
| `iac` | IaC 管理 |
| `network` | 网络管理 |
| `storage` | 存储管理 |
| `canary-analysis` | 金丝雀分析 |
| `canary-traffic` | 金丝雀流量 |
| `smart-deploy` | 智能部署 |

### 3.4 工单与事件 (8 域)

| 域 | 文件 | 功能 |
|----|------|------|
| `ticketing` | 15 | **工单系统核心** |
| `ticket-automation` | 7 | 工单自动化 |
| `ticket-knowledge` | 7 | 工单知识库 |
| `incident` | 6 | 事件管理 |
| `incident-action` | 6 | 事件操作 |
| `problem` | 7 | 问题管理 |
| `change` | 7 | 变更管理 |
| `change-request` | 7 | 变更请求 |

### 3.5 安全与合规 (8 域)

| 域 | 文件 | 功能 |
|----|------|------|
| `security` | 8 | 安全扫描 (Trivy) |
| `security-compliance` | 8 | 安全合规 |
| `vulnerability` | 7 | 漏洞管理 |
| `sbom` | 8 | SBOM 物料清单 |
| `supply-chain` | 7 | 供应链安全 |
| `compliance` | 7 | 合规管理 |
| `policy` | 9 | 策略管理 |
| `governance` | 7 | 治理 |

### 3.6 告警与通知 (8 域)

| 域 | 功能 |
|----|------|
| `alert` | 告警核心 |
| `alert-breaker` | 告警熔断 |
| `notification` | 通知管理 |
| `notification-management` | 通知管理增强 |
| `notification-policy` | 通知策略 |
| `notification-template` | 通知模板 |
| `scheduled-notification` | 定时通知 |
| `escalation` | 告警升级 |

### 3.7 数据平台 (7 域)

| 域 | 文件 | 功能 |
|----|------|------|
| `data-catalog` | 7 | 数据目录 (含 introspector) |
| `data-lineage` | 8 | 数据血缘 |
| `data-pipeline` | 8 | 数据管线 |
| `data-quality` | 11 | 数据质量 (含 engine 子包) |
| `vector` | 7 | 向量管理 |
| `vector-store` | 8 | 向量存储 |
| `vectorize-rules` | 7 | 向量化规则 |

### 3.8 工作流与编排 (6 域)

| 域 | 文件 | 功能 |
|----|------|------|
| `workflow` | 8 | 工作流定义/执行 |
| `workflow-task` | 7 | 工作流任务 |
| `workflow-trigger` | 7 | 工作流触发器 |
| `workflow-dependency` | 7 | 工作流依赖 |
| `workflow-webhook` | 7 | 工作流 Webhook |
| `saga` | 11 | **Saga 分布式事务** |

### 3.9 项目管理 (7 域)

| 域 | 功能 |
|----|------|
| `project` | 项目管理 |
| `project-member` | 项目成员 |
| `sprint` | 冲刺管理 |
| `product-line` | 产品线 |
| `efficiency` | 效能度量 |
| `report-designer` | 报表设计器 |
| `bi-dashboard` | BI 仪表盘 |

### 3.10 应用与模块 (6 域)

| 域 | 文件 | 功能 |
|----|------|------|
| `application` | 22 | **应用管理** (CQRS + Saga + HTTP) |
| `module` | 6 | 模块管理 |
| `subapp` | 8 | 子应用 |
| `service-catalog` | 9 | 服务目录 |
| `service-registry` | 8 | 服务注册 |
| `service-health` | 7 | 服务健康 |
| `service-topology` | 7 | 服务拓扑 |

### 3.11 AI (11 域)

| 域 | 功能 |
|----|------|
| `ai` | AI 基础配置 |
| `ai-gateway` | AI 网关路由/代理 |
| `ai-agents` | AI 代理注册/管理 |
| `ai-models` | AI 模型管理 |
| `ai-inference` | AI 推理代理 |
| `ai-cost` | AI 成本追踪 |
| `ai-decisions` | AI 决策引擎 |
| `ai-degradation` | AI 降级策略 |
| `ai-review` | AI 代码审查 |
| `ai-security` | AI 安全 (提示注入检测) |
| `mlops` | MLOps 管线 |

### 3.12 其他重要域 (60+)

| 域 | 文件 | 功能 |
|----|------|------|
| `domain` | 19 | 领域模型 (DDD: aggregates/commands/events/eventstore/readmodel) |
| `infrastructure` | 16 | 基础设施层 |
| `plugin` | 13 | 插件系统 (SPI) |
| `plugin-hotreload` | 6 | 插件热加载 |
| `webhook` | 13 | Webhook 管理 |
| `gateway-dynamic` | 11 | 动态网关 |
| `audit` | 9 | 审计日志 |
| `chaos` | 7 | 混沌工程核心 |
| `chaos-enhanced` | 7 | 增强混沌 |
| `circuit-breaker` | 7 | 熔断器 |
| `cron` | 8 | 定时任务 |
| `feature-flag` | 8 | 功能开关 |
| `integration` | 6 | 集成 |
| `knowledge` | 6 | 知识管理 |
| `monitoring` | 8 | 监控核心 |
| `observability` | 6 | 可观测性 |
| `apm` | 8 | APM 性能监控 |
| `tracing` | 7 | 链路追踪 |
| `health-check` | 6 | 健康检查 |
| `finops` | 7 | FinOps |
| `billing` | 8 | 计费 |
| `backup` | 7 | 备份 |
| `disaster-recovery` | 7 | 灾备 |
| `digital-twin` | 8 | 数字孪生 |
| `terminal-audit` | 7 | 终端审计 |
| `visor-exec` | 7 | Visor 执行 |
| `config` | 7 | 配置管理 |
| `secret` | 7 | 密钥管理 |
| `global-param` | 6 | 全局参数 |
| `unified-config` | 7 | 统一配置 |
| `oncall` | 7 | 值班管理 |
| `runbook` | 7 | 运维手册 |
| `risk` | 7 | 风险管理 |
| `sla` | 7 | SLA 管理 |
| `slo` | 7 | SLO 管理 |
| `queue` | 9 | 队列 |
| `lock` | 1 | 分布式锁 (最小域) |
| ... | — | 共 60+ 域，完整列表见原始报告 |

---

## 4. API 网关路由映射

| 路由前缀 | 后端服务 | 鉴权 | 中间件链 |
|----------|---------|------|---------|
| `/auth/*` | auth-svc | — (公开) | health → error |
| `/ai/*` | ai-svc | RBAC | auth → permission → tenant → version → proxy |
| `/pipeline/*` | pipeline-svc | RBAC + 租户 | auth → permission → tenant → version → proxy |
| `/ticket/*` | ticket-svc | RBAC + 租户 | auth → permission → tenant → version → proxy |
| `/notification/*` | notification-svc | RBAC + 租户 | auth → permission → tenant → version → proxy |
| `/tenant/*` | platform-svc | RBAC + 租户 | auth → permission → tenant → version → proxy |
| `/config/*` | config-svc | RBAC + 租户 | auth → permission → tenant → version → proxy |
| `/governance/*` | governance-svc | RBAC | auth → permission → version → proxy |
| `/chaos/*` | chaos-svc | RBAC | auth → permission → version → proxy |
| `/digital-twin/*` | digital-twin-svc | RBAC + 租户 | auth → permission → tenant → version → proxy |
| `/ws/*` | WebSocket 代理 | WS 认证 | ws-auth → ws-heartbeat → ws-proxy |
| `/healthz` | 健康检查 | — (公开) | health |

---

## 5. Go 公共库速查

| 包 | 功能 | 关键类型/函数 | 使用示例 |
|----|------|-------------|---------|
| `auth` | RBAC + ABAC + 中间件 | `RequirePermission(ctx, resource, action)` `GetTenantID(ctx)` `IsAdmin(ctx)` | `if err := auth.RequirePermission(c, "cmdb:ci:create"); err != nil { ... }` |
| `audit` | 审计链 + UEBA | `AuditChain` `WithOperation(op)` `Log(ctx)` | `audit.Log(ctx, "create", "cmdb.ci", id)` |
| `config` | 配置管理 | `Load()` `Watch()` `GetString(key)` `GetInt(key)` | `port := config.GetInt("server.port")` |
| `cron` | 定时任务 | `AddJob(spec, fn)` `RemoveJob(name)` `GetJobStatus(name)` | `cron.AddJob("0 */5 * * *", backupJob)` |
| `dag` | DAG 有向无环图 | `NewDAG()` `AddNode(id)` `AddEdge(from, to)` `TopologicalSort()` | `nodes, err := dag.TopologicalSort()` |
| `database` | DB + 迁移 + RLS | `RepositoryBase` `NewPG(db)` `NewRedis(r)` | `r := database.NewPG(db)` |
| `errors` | 结构化错误 | `NewError(code, msg)` `IsNotFound(err)` `IsPermissionDenied(err)` | `return errors.NewError(404, "not found")` |
| `idempotency` | 幂等性 | `NewChecker(redis, pg)` `Check(ctx, key)` `Release(ctx, key)` | `checker := idempotency.NewChecker(redis, pg)` |
| `logger` | 日志 | `Info(msg, kv...)` `Error(err, kv...)` `Debug(msg, kv...)` | `logger.Info("job started", "job_id", id)` |
| `messaging` | Kafka + NATS | `NATSProducer` `NATSConsumer` `Publish(topic, msg)` `Subscribe(topic, handler)` | `producer.Publish("pipeline.completed", payload)` |
| `middleware` | 通用中间件 | `ReadOnly()` `RateLimit(limit)` `RequestID()` | `r.Use(middleware.RequestID())` |
| `otel` | OpenTelemetry | `StartTracer(serviceName)` `EndSpan(span)` `NewSpan(ctx, name)` | `otel.StartTracer("my-domain-svc")` |
| `plugin` | 插件 SPI | `NewPluginManager()` `Register(name, impl)` `Get(name)` | `pm := plugin.NewPluginManager()` |
| `redis` | Redis | `Get(key)` `Set(key, val, ttl)` `Del(key)` `Incr(key)` | `redis.Set("lock:"+id, "1", 30*time.Second)` |
| `sse` | SSE 推送 | `NewHub()` `Publish(event)` `Subscribe(topic)` `Disconnect(id)` | `sse.Publish("pipeline.update", payload)` |

---

## 6. 蓝图微服务速查

### 6.1 Go 蓝图 (24 个，有代码)

| 蓝图 | 文件 | 核心域 | 适用场景 |
|------|------|--------|---------|
| `orion-ci-cd-svc-go` | 115 | pipeline (budget/trigger/run/control/graph) | CI/CD 独立部署 |
| `orion-notification-svc-go` | 108 | notification-template/channel/scheduled-notification/do-not-disturb | 通知独立部署 |
| `orion-workflow-svc-go` | 102 | approval/workflow/ticket | 工作流独立部署 |
| `orion-ticket-svc-go` | 98 | ticket/queue/automation/dispatch/analytics/load-balancer | 工单独立部署 |
| `orion-infra-ops-svc-go` | 97 | ephemeral-env/multicloud/dr/virtual-machine/network/storage | 基础设施运维 |
| `orion-identity-svc-go` | 72 | confirmation/apikey/sso/mfa/role/permission | 身份认证独立部署 |
| `orion-finops-svc-go` | 71 | finops (budget/cost-trend/optimization/analysis) | FinOps 独立部署 |
| `orion-governance-svc-go` | 68 | governance/permission-audit/policy/compliance | 治理与合规 |
| `orion-config-mgmt-svc-go` | 67 | env-profile/cache-cleanup/config | 配置管理 |
| `orion-security-svc-go` | 62 | secret/cross-domain/supply-chain | 安全独立部署 |
| `orion-ai-svc-go` | 56 | aigateway/aiagent | AI 独立服务 |
| `orion-event-bus-svc-go` | 46 | event-bus | 事件总线 |
| `orion-auth-svc` | 31 | auth | 认证独立服务 (Go) |
| `orion-cmdb-service` | 29 | topology/relation/database | CMDB 独立服务 |
| `orion-monitor-svc-go` | 20 | monitor (alert/metric/notification/escalation) | 监控独立服务 |
| `orion-skill-config-svc-go` | 11 | skill-config | 技能配置 |
| `orion-lowcode-svc-go` | 11 | lowcode | 低代码 |
| `orion-visor-svc-go` | 10 | visor | Visor |
| `orion-pandawiki-svc-go` | 10 | pandawiki | 知识库 |
| `orion-inspection-svc-go` | 10 | inspection | 检查 |
| `orion-community-svc-go` | 10 | community | 社区 |
| `orion-api-gateway-go` | 10 | gateway | API 网关 Go 版 |
| `orion-tool-svc-go` | 9 | tool | 工具 |
| `orion-alert-breaker-svc-go` | 7 | alert-breaker | 告警熔断 |

### 6.2 Node.js 蓝图 (Top 10/45 个)

| 蓝图 | 文件 | 功能 |
|------|------|------|
| `orion-pipeline-svc` | 306 | Pipeline (Node.js 版) |
| `orion-monitor-svc` | 72 | 监控 (Node.js 版) |
| `orion-ai-svc` | 58 | AI (Node.js 版) |
| `orion-chatops-svc` | 53 | 聊天运维 |
| `orion-audit-svc` | 45 | 审计 |
| `orion-code-svc` | 49 | 代码服务 |
| `orion-agent-svc` | 33 | 代理服务 |
| `orion-ticket-svc` | 34 | 工单 (Node.js 版) |
| `orion-security-svc` | 30 | 安全 (Node.js 版) |
| `orion-risk-svc` | 27 | 风险服务 |

> **注意**: 36/70+ 蓝图为空目录，详见 `orion-problem-analysis-2026-07-22.md` §1.3

### 6.3 蓝图通用结构

```
cmd/server/
    ├── main.go             # 入口 + 路由注册
    └── config.go           # 配置加载
internal/
    ├── {domain}/
    │   ├── handler/        # HTTP 处理器
    │   ├── service/        # 业务服务
    │   ├── repository/     # 数据访问
    │   └── models/         # 模型
    ├── config/config.go    # 域配置
    └── response_writer.go  # 统一响应格式
pkg/nats/
    └── subscriber.go       # NATS 订阅器
```

---

## 7. 数据库与迁移

### 7.1 迁移文件

| 文件 | 用途 |
|------|------|
| `migrations/002_enable_rls.sql` | 启用 RLS (Row Level Security) |
| `migrations/003_rbac_tables.sql` | RBAC 表结构 |

### 7.2 如何创建新迁移

```bash
# 1. 创建迁移文件（按时间戳排序）
cat > migrations/004_add_my_domain.sql << 'SQL'
-- Migration: add my_domain_models table
-- Author: your-name
-- Date: 2026-07-22

CREATE TABLE IF NOT EXISTS my_domain_models (
    id          BIGINT PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL,
    name        VARCHAR(256) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 启用 RLS
ALTER TABLE my_domain_models ENABLE ROW LEVEL SECURITY;

-- 租户隔离策略
CREATE POLICY tenant_isolation_policy ON my_domain_models
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id'));
SQL

# 2. 在 migration manager 中注册
# 3. 测试迁移 (本地)
go run cmd/migrate/main.go --dir migrations
```

### 7.3 K8s ConfigMap 配置

```yaml
DATABASE_URL: "postgresql://user:pass@host:5432/db"
REDIS_ADDR: "redis://host:6379"
NATS_ADDR: "nats://host:4222"
JWT_SECRET: "xxx"  # 从 Secret 获取
LOG_LEVEL: "info"
LOG_FORMAT: "json"  # 结构化日志
OTEL_ENABLED: "true"
OTEL_TRACES_ENDPOINT: "http://otel-collector:4317"
```

---

## 8. 测试规范

### 8.1 测试目录

```
test/
├── benchmark/          # 性能基准
├── integration/        # 集成测试 (auth + pipeline)
└── e2e/                # 端到端测试 (auth)
```

### 8.2 Mock 模式

```go
// 1. 使用 mockgen 生成 mock
//go:generate mockgen -source=service.go -destination=service_mock.go -package=mydomain_test

// 2. 测试示例
func TestServiceCreate(t *testing.T) {
    ctx := context.Background()
    mockRepo := &MockRepository{
        InsertFunc: func(ctx context.Context, m *MyModel) error {
            return nil // 模拟成功
        },
    }
    service := NewService(mockRepo)
    
    model, err := service.Create(ctx, "tenant-1", CreateRequest{Name: "test"})
    assert.NoError(t, err)
    assert.Equal(t, "test", model.Name)
}
```

### 8.3 测试最佳实践

| 实践 | 说明 |
|------|------|
| Table-driven tests | 使用 `t.Run` + 子测试覆盖多场景 |
| 每个接口测试 | ServiceInterface 的每个方法至少 3 个测试用例 |
| Repository 集成测试 | 使用 Testcontainers 或 SQLite 内存数据库 |
| Handler 测试 | 使用 `httptest.NewRecorder` + Gin 测试上下文 |
| 覆盖率目标 | 核心域 50%+，基础设施 80%+ |

---

## 9. 常见开发模式

### 9.1 添加新 API

```
Step 1: internal/{domain}/models/     → 定义请求/响应 struct
Step 2: internal/{domain}/repository/  → 实现 RepositoryInterface
Step 3: internal/{domain}/service/     → 实现 ServiceInterface
Step 4: internal/{domain}/handler/     → 实现 Handler + RegisterRoutes
Step 5: cmd/server/wiring.go           → 注册 DI
Step 6: 测试                           → 单元测试 + 集成测试
```

### 9.2 添加新 Blueprint 服务

```
Step 1: blueprints/orion-{name}-svc-go/  → 创建目录
Step 2: cmd/server/main.go                → 入口
Step 3: go.mod                            → 模块定义
Step 4: 复制 response_writer.go           → 统一响应
Step 5: internal/{domain}/                → domain 结构
Step 6: K8s 部署                          → infrastructure/k8s/
```

### 9.3 添加 K8s 部署

```
Step 1: infrastructure/k8s/orion-{name}/  → 创建目录
Step 2: deployment.yaml                   → Deployment (replicas: 2)
Step 3: service.yaml                      → Service
Step 4: hpa.yaml                          → HPA
Step 5: configmap.yaml                    → ConfigMap
```

### 9.4 添加 NATS 消息订阅

```go
// 1. 定义事件处理器
func (h *handler) OnPipelineCompleted(ctx context.Context, msg *nats.Msg) error {
    var payload PipelineCompletedEvent
    json.Unmarshal(msg.Data, &payload)
    // 业务逻辑
    return nil
}

// 2. 注册订阅
nats.Subscribe("pipeline.completed", h.OnPipelineCompleted)
```

---

## 10. 错误处理规范

### 10.1 错误码体系

| 范围 | 含义 | 示例 |
|------|------|------|
| 0 | 成功 | `{"code": 0, "message": "success"}` |
| 400 | 请求参数错误 | `{"code": 400, "message": "invalid request"}` |
| 401 | 未认证 | `{"code": 401, "message": "unauthorized"}` |
| 403 | 权限不足 | `{"code": 403, "message": "permission denied"}` |
| 404 | 资源不存在 | `{"code": 404, "message": "not found"}` |
| 409 | 资源冲突 | `{"code": 409, "message": "duplicate entry"}` |
| 422 | 验证失败 | `{"code": 422, "message": "validation failed"}` |
| 500 | 内部错误 | `{"code": 500, "message": "internal error"}` |
| 503 | 服务不可用 | `{"code": 503, "message": "service unavailable"}` |

### 10.2 错误传递

```go
// 服务层: 使用 fmt.Errorf 包装错误，保留调用栈
func (s *serviceImpl) Create(ctx context.Context, ...) (*Model, error) {
    if err := s.validate(req); err != nil {
        return nil, errors.NewError(422, "validation failed", err.Error())
    }
    if err := s.Repository.Insert(ctx, model); err != nil {
        return nil, fmt.Errorf("create model: %w", err)
    }
    return model, nil
}

// Handler 层: 根据错误类型返回对应状态码
func (h *Handler) Create(c *gin.Context) {
    result, err := h.Service.Create(c, tenantID, req)
    if err != nil {
        if errors.IsNotFound(err) {
            c.JSON(404, NewErrorResponse(404, "not found", err.Error()))
        } else if errors.IsPermissionDenied(err) {
            c.JSON(403, NewErrorResponse(403, "permission denied", ""))
        } else {
            c.JSON(500, NewErrorResponse(500, "internal error", err.Error()))
        }
        return
    }
    c.JSON(201, NewSuccessResponse(result))
}
```

### 10.3 日志规范

```go
// 结构化日志，使用 KV 对
logger.Info("pipeline created",
    "tenant_id", tenantID,
    "pipeline_id", id,
    "user_id", userID,
)

logger.Error("pipeline execution failed",
    "pipeline_id", id,
    "error", err.Error(),
    "stage", "build",
)
```

---

> *本参考手册用于日常开发。问题分析请参考 `orion-problem-analysis-2026-07-22.md`，NeatLogic 标杆设计请参考 `neatlogic-benchmark-analysis-2026-07-22.md`。*

---

## 11. Go 统一技术栈迁移计划（SDD-2026-001）

### 11.1 背景与目标

**架构目标**: 所有蓝图微服务统一为 Go 技术栈，消除 TS 双实现，实现"一次开发，Go 处运行"。

**当前状态**: 68 个蓝图中 32 个纯 Go + 12 对 Go/TS 双实现 + 20 个纯 TS + 3 Python + 1 Rust。

**目标状态**: 55 个 Go 微服务 + 3 Python + 1 Rust，零 TS 蓝图。

### 11.2 目标架构

```
蓝图服务统一架构 (Go 1.25 + Gin + PostgreSQL + NATS)
├── 核心平台 (1 个)
│   └── orion-platform-svc-go (170+ 域)
├── 独立微服务 (54 个 Go)
│   ├── CI/CD 域: orion-ci-cd-svc-go, orion-monitor-svc-go
│   ├── AI 域: orion-ai-svc-go, orion-chatops-svc-go
│   ├── 工单域: orion-ticket-svc-go, orion-workflow-svc-go
│   ├── 通知域: orion-notification-svc-go
│   ├── 身份域: orion-identity-svc-go, orion-auth-svc
│   ├── 治理域: orion-governance-svc-go, orion-security-svc-go
│   ├── 运维域: orion-infra-ops-svc-go, orion-agent-svc-go
│   ├── 数据域: orion-code-svc-go, orion-audit-svc-go
│   ├── 成本域: orion-finops-svc-go, orion-config-mgmt-svc-go
│   └── 其他 33 个 Go 服务
├── 独立 Python 服务 (3 个)
│   └── orion-ai-service, orion-ai-agents-svc, orion-intelligence-svc
└── 独立 Rust 服务 (1 个)
    └── orion-security-svc-rust
```

### 11.3 新建 Go 服务标准模板

每个新建 Go 服务必须遵循以下 4 层架构模式：

```
blueprints/orion-{name}-svc-go/
├── cmd/server/main.go          # 入口 + DI 组装
├── internal/
│   ├── {domain}/
│   │   ├── handler/            # HTTP 处理器 (gin.HandlerFunc)
│   │   ├── service/            # ServiceInterface + serviceImpl
│   │   ├── repository/         # RepositoryInterface + repositoryImpl
│   │   └── models/             # 强类型 struct
│   ├── config/config.go        # 配置加载
│   └── response_writer.go      # 统一响应格式
├── pkg/nats/subscriber.go      # NATS 订阅器
├── migrations/                 # 数据库迁移
├── Dockerfile                  # 多阶段构建
├── .env.example                # 环境变量示例
├── go.mod                      # 模块定义
└── MIGRATION.md                # 迁移记录 (TS→Go 时)
```

### 11.4 迁移实现步骤

#### 步骤 1: 差距分析（Day 1）

```
1. 读取 TS 蓝图 API 路由 (Express routes → gin routes)
   ├── 提取所有路由路径和方法
   └── 映射到 Go handler 方法
2. 读取 TS 模型定义 → 映射到 Go struct
3. 读取 TS 服务逻辑 → 映射到 Go service
4. 产出: 功能差距清单 (GAP.md)
```

#### 步骤 2: Go 实现（Day 1-3）

```
1. 创建目录结构 (handler/service/repository/models/config)
2. 实现 models (强类型 struct + JSON tags)
3. 实现 repository (接口 + PostgreSQL sqlx)
4. 实现 service (接口 + 业务逻辑)
5. 实现 handler (路由注册 + 请求/响应处理)
6. 实现 wiring (main.go DI 组装)
7. 创建 go.mod + Dockerfile
8. 创建迁移脚本 (migrations/)
```

#### 步骤 3: 验证与归档（Day 1）

```
1. go build 编译通过
2. 路由数量对等 (TS 路由数 == Go 路由数)
3. 添加 MIGRATION.md 记录
4. TS 源目录添加 ARCHIVED.md
5. 更新 TRACKER.md
```

### 11.5 各服务迁移工程量

| 服务 | TS 文件 | Go 文件 | 差距 | 复杂度 | 预计人天 |
|------|---------|---------|------|--------|---------|
| pipeline | 351 | 115 | 236 (30 域) | 🔴 极高 | 6 |
| monitor | 105 | 20 | 85 | 🔴 高 | 4 |
| ai | 76 | 56 | 20 | 🟡 中 | 3 |
| security | 43 | 62 | 0 (功能对等) | 🟢 低 | 1 |
| chatops | 81 | 0 | 81 | 🔴 高 | 3 |
| code | 52 | 0 | 52 | 🟡 中 | 2 |
| audit | 45 | 0 | 45 | 🟢 低 | 1 |
| agent | 33 | 0 | 33 | 🟡 中 | 1 |
| 其他 18 个小服务 | 7-28 | 0 | 7-28 | 🟢 低 | 0.5 每个 |

### 11.6 迁移追踪

迁移状态实时追踪: `blueprints/MIGRATION/TRACKER.md`

```
状态说明:
🟢 已完成 (TS 已归档)
🟡 进行中 (Go 实现中)
🔴 未开始 (待启动)
⚪ 跳过 (Python/Rust 独立)
```

### 11.7 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| TS 功能遗漏导致 Go 版功能不全 | 功能回退 | 差距分析阶段逐路由对比 |
| 同时修改 Go 和 TS 导致冲突 | 迁移进度延迟 | Wave 内先完成 Go 再归档 TS |
| 新建 Go 服务与现有域重叠 | 代码重复 | 迁移前检查 `internal/` 已有域 |
| Agent 并行提交导致 merge 冲突 | 合并耗时 | 按文件区域隔离 (每服务独立目录)

---

## 附录 A. Go 公共库详细清单

> **Go 文件**: 60+ | **包数**: 18

| 包 | 功能 | 文件 |
|----|------|------|
| `auth` | RBAC + ABAC + CORS + 中间件 + 权限缓存 | 12 |
| `audit` | 审计链 + 日志同步 + UEBA + 签名 + 告警 | 7 |
| `config` | 配置管理 | 2 |
| `cron` | 定时任务 | 3 |
| `dag` | DAG 有向无环图 | 3 |
| `database` | DB 连接 + 迁移 + RLS + Repository 基类 | 4 |
| `errors` | 错误定义 + 中间件 | 2 |
| `idempotency` | 幂等性 (Checker/Redis/PG/中间件) | 6 |
| `logger` | 日志 | 2 |
| `messaging` | Kafka + NATS 消息 | 2 |
| `middleware` | 中间件 + 只读 | 3 |
| `otel` | OpenTelemetry | 1 |
| `plugin` | 插件系统 (SPI) | 3 |
| `redis` | Redis 客户端 | 2 |
| `sentinel` | 哨兵错误 | 1 |
| `sse` | SSE 推送 (Hub/Client/Options) | 3 |

## 附录 B. 知识库服务 (orion-knowledge)

> **Go 后端**: 262 files | **Web App**: Next.js (154 TS) | **Web Admin**: Vite+Vue (545 TS)

**Go 后端架构**:
```
backend/
├── cmd/                  # 可执行入口
│   ├── api/main.go       # API 服务 (Echo framework + Swagger)
│   ├── consumer/         # 消息消费者
│   └── migrate/          # 迁移工具
├── api/                  # API 路由 (按业务域)
│   ├── auth/v1/          # 认证
│   ├── conversation/v1/  # 对话
│   ├── crawler/v1/       # 爬虫
│   ├── kb/v1/            # 知识库
│   ├── nav/v1/           # 导航
│   ├── node/v1/          # 节点
│   ├── openapi/v1/       # OpenAPI
│   ├── share/v1/         # 分享
│   ├── stat/v1/          # 统计
│   └── user/v1/          # 用户
├── handler/              # 处理器
│   ├── v1/               # v1 处理器
│   ├── share/            # 分享处理器
│   └── mq/               # MQ 处理器
├── middleware/           # 中间件 (auth/jwt/tenant/permission/session/api_token/share_auth)
├── domain/               # 领域模型 (12+ 子域: knowledge/rag/conversation/crawler/node/user/bot...)
├── pkg/                  # 工具包 (anydoc 文档处理, bot 多平台机器人)
├── mq/                   # 消息队列 (NATS)
├── migration/            # 数据库迁移
├── apm/                  # APM 追踪
├── config/               # 配置
├── log/                  # 日志
└── utils/                # 工具函数
```

## 附录 C. DBA 工具 (orion-dba)

> **Go 后端**: ~200 files | **Vue 前端**: ~70 files

**Go 后端**: cmd/main.go → router/router.go → handler/ → apis/ → model/ → service/ → engine/engine.go → i18n/

**Vue 前端**: apis/ + components/ + config/ + lang/ (en-us/zh-cn) + socket/ + store/ + views/ (advisor/analysis/apply/config/home/layout/login/manager/query/record/server)

## 附录 D. Visor 运维 (orion-visor)

> **Vue 前端**: 589 files (291 Vue + 298 TS)

完整堡垒机/运维管理界面，集成 Guacamole (远程桌面) + xterm.js (终端)。

## 附录 E. 蓝图完整清单

> **总计**: 70+ 蓝图目录 | **Go 模块**: 24 个 | **Node 模块**: 45 个 | **Rust 模块**: 1 个

### E.1 Go 蓝图 (24 个，有代码)

| 蓝图 | Go 文件 | 内部域 | 备注 |
|------|---------|--------|------|
| `orion-ci-cd-svc-go` | 115 | pipeline (budget/trigger/run/control/graph/autonomous/batch/sse/audit/approval/version/rbac) | 最复杂 Go 蓝图 |
| `orion-notification-svc-go` | 108 | notification-template/channel/scheduled-notification/do-not-disturb | 含 2 个 NATS 订阅器 |
| `orion-workflow-svc-go` | 102 | approval/workflow/ticket | 含 approval middleware |
| `orion-ticket-svc-go` | 98 | ticket/queue/automation/dispatch/analytics/load-balancer | 工单系统独立服务 |
| `orion-infra-ops-svc-go` | 97 | ephemeral-env/multicloud/dr/virtual-machine/network/storage | 基础设施运维 |
| `orion-identity-svc-go` | 72 | confirmation/apikey/sso/mfa/role/permission | 身份认证独立服务 |
| `orion-finops-svc-go` | 71 | finops (budget/cost-trend/optimization/analysis) | 含 NATS 订阅 |
| `orion-governance-svc-go` | 68 | governance/permission-audit/policy/compliance | 治理与合规 |
| `orion-config-mgmt-svc-go` | 67 | env-profile/cache-cleanup/config | 配置管理 |
| `orion-security-svc-go` | 62 | secret/cross-domain/supply-chain | 安全独立服务 |
| `orion-ai-svc-go` | 56 | aigateway/aiagent | AI 独立服务 |
| `orion-event-bus-svc-go` | 46 | event-bus | 事件总线独立服务 |
| `orion-auth-svc` | 31 | auth | 认证独立服务 (Go) |
| `orion-cmdb-service` | 29 | topology/relation/database | CMDB 独立服务 |
| `orion-monitor-svc-go` | 20 | monitor (alert/metric/notification/escalation) | 监控独立服务 |
| `orion-skill-config-svc-go` | 11 | skill-config | 技能配置独立服务 |
| `orion-lowcode-svc-go` | 11 | lowcode | 低代码独立服务 |
| `orion-visor-svc-go` | 10 | visor | Visor 独立服务 |
| `orion-pandawiki-svc-go` | 10 | pandawiki | 知识库独立服务 |
| `orion-inspection-svc-go` | 10 | inspection | 检查独立服务 |
| `orion-community-svc-go` | 10 | community | 社区独立服务 |
| `orion-api-gateway-go` | 10 | gateway | API 网关 Go 版 |
| `orion-tool-svc-go` | 9 | tool | 工具独立服务 |
| `orion-alert-breaker-svc-go` | 7 | alert-breaker | 告警熔断独立服务 |

### E.2 Node.js 蓝图 (45 个，有代码)

| 蓝图 | 非 Go 文件 | 功能 |
|------|-----------|------|
| `orion-pipeline-svc` | 306 | Pipeline 服务 (Node.js 版) |
| `orion-monitor-svc` | 72 | 监控服务 (Node.js 版) |
| `orion-notify-svc` | 54 | 通知服务 (Node.js 版) |
| `orion-ai-svc` | 58 | AI 服务 (Node.js 版) |
| `orion-chatops-svc` | 53 | 聊天运维服务 |
| `orion-audit-svc` | 45 | 审计服务 |
| `orion-agent-svc` | 33 | 代理服务 |
| `orion-code-svc` | 49 | 代码服务 |
| `orion-security-svc` | 30 | 安全服务 (Node.js 版) |
| `orion-ticket-svc` | 34 | 工单服务 (Node.js 版) |
| `orion-risk-svc` | 27 | 风险服务 |
| `orion-platform-core` | 23 | 平台核心 (Node.js 版) |
| `orion-deploy-svc` | 23 | 部署服务 |
| `orion-digital-twin-svc` | 24 | 数字孪生服务 |
| `orion-dr-svc` | 21 | 灾备服务 |
| `orion-federation-svc` | 18 | 联邦服务 |
| `orion-finops-svc` | 21 | FinOps 服务 (Node.js 版) |
| `orion-governance-svc` | 17 | 治理服务 (Node.js 版) |
| `orion-community-svc` | 17 | 社区服务 (Node.js 版) |
| `orion-artifact-svc` | 21 | 制品服务 |
| `orion-approval-svc` | 12 | 审批服务 |
| `orion-efficiency-svc` | 16 | 效能服务 |
| `orion-cmdb-svc` | 8 | CMDB 服务 (Node.js 版) |
| `orion-config-mgmt-svc` | 9 | 配置管理服务 |
| `orion-pandawiki-svc` | 9 | 知识库服务 (Node.js 版) |
| `orion-visor-svc` | 10 | Visor 服务 (Node.js 版) |
| `orion-knowledge-svc` | 15 | 知识服务 (Node.js 版) |
| `orion-llm-svc` | 14 | LLM 服务 |
| `orion-inception-svc` | 8 | 启动服务 |
| `orion-graph-svc` | 9 | 图服务 |
| `orion-runner-svc` | 8 | Runner 服务 |
| `orion-selfhealing-svc` | 7 | 自愈服务 |
| `orion-skill-svc` | 11 | 技能服务 |
| `orion-plugin-svc` | 21 | 插件服务 |
| `orion-dba-svc` | 10 | DBA 服务 |
| `orion-db` | 4 | 数据库服务 |
| 剩余 9 个 | — | 未在此完整列出（详见源文档） |

### E.3 Rust 蓝图

| 蓝图 | 文件 | 功能 |
|------|------|------|
| `orion-security-svc-rust` | 8 | 安全服务 (Rust 版) |

### E.4 空白蓝图 (36 个，仅有目录)

`orion-security-svc`, `orion-runner-svc`, `orion-risk-svc`, `orion-plugin-svc`, `orion-platform-core`, `orion-pipeline-svc`(Go), `orion-pandawiki-svc`(Go), `orion-notify-svc`(Go), `orion-monitor-svc`(Go), `orion-llm-trace-svc-py`, `orion-llm-svc`(Go), `orion-knowledge-svc-py`, `orion-knowledge-svc`(Go), `orion-inception-svc`(Go), `orion-graph-svc`(Go), `orion-governance-svc`(Go), `orion-finops-svc`(Go), `orion-federation-svc`(Go), `orion-efficiency-svc`(Go), `orion-dr-svc`(Go), `orion-digital-twin-svc`(Go), `orion-deploy-svc`(Go), `orion-dba-svc`(Go), `orion-db`(Go), `orion-config-mgmt-svc`(Go), `orion-community-svc`(Go), `orion-code-svc`(Go), `orion-cmdb-svc`(Go), `orion-chatops-svc`(Go), `orion-audit-svc`(Go), `orion-artifact-svc`(Go), `orion-approval-svc`(Go), `orion-ai-svc`(Go), `orion-agent-svc`(Go)

## 附录 F. 独立服务架构

### F.1 orion-ai-service (Python FastAPI)

**语言**: Python 3.14 | **框架**: FastAPI | **源码**: 66 文件 | **测试**: 19 文件

`src/main.py` → events/ (NATS 订阅) → api/ (ai_routes/inference_routes/mlops_routes) → models/ → services/ (ai_service.py) → repositories/ (ai_result/llm_trace/metric_storage)

### F.2 orion-ai-agents-svc (Python FastAPI + OTel)

**语言**: Python 3.14 | **框架**: FastAPI + OTel | **源码**: 2224 文件

`app/main.py` → config.py → dependencies.py → api/agent_routes.py → models/agent.py → services/agent_service.py → repositories/agent_repo.py

### F.3 orion-intelligence-svc (Python FastAPI + Alembic)

**语言**: Python 3.14 | **框架**: FastAPI + Alembic | **源码**: 3940 文件

`src/main.py` → api/ (classify/code_review/predict_sla/root_cause/sentiment/solution/summarize) → services/ (ai_service/llm_client) → models/

### F.4 orion-runner-agent (Node.js TypeScript)

**语言**: TypeScript | **源码**: 2 文件 | 极简 Runner Agent

## 附录 G. API 网关完整架构

> **语言**: TypeScript | **框架**: Express.js | **文件**: 92

**src/**: index.ts → app.ts → config/ → middleware/ (14 个: auth/permission/tenant/version/proxy/health/logging/error/csp/gray-route/subAppAuthAdapter/token-exchange) → routes/ (14 个: auth/ai-decisions/ai-degradation/ai-models/chaos/digital-twin/governance/pipeline-budget/pipeline-templates/pipeline-versions/resilience-score/sbom/tenant/version) → services/ (auth/rbac/tenant-quota/service-client/service-registry/gateway-dynamic-routes/gray-release/module-routing/namespace-pool/token/token-blacklist) → websocket/ (5 个: ws-server/ws-auth/ws-heartbeat/ws-proxy/ws-errors) → errors/ → utils/

**特性**: 多层鉴权 (JWT + RBAC + ABAC + 设备指纹) + 灰度发布 + Token 管理 + WebSocket 代理 + 动态路由

## 附录 H. 部署配置

| 文件 | 用途 |
|------|------|
| `prometheus/alert-rules.yaml` | Prometheus 告警规则 |
| `prometheus/alerts.yml` | Prometheus 告警配置 |
| `grafana/dashboards/orion-overview.json` | 总览仪表盘 |
| `grafana/dashboards/orion-tenant.json` | 租户仪表盘 |
| `grafana/dashboards/orion-service-metrics.json` | 服务指标仪表盘 |
| `grafana/dashboards/orion-service-health.json` | 服务健康仪表盘 |

## 附录 I. 迁移脚本

| 文件 | 用途 |
|------|------|
| `migrations/002_enable_rls.sql` | 启用 Row Level Security |
| `migrations/003_rbac_tables.sql` | RBAC 表结构 |

## 附录 J. 工具集 (18 个)

| 工具 | 语言 | 功能 |
|------|------|------|
| `gen-interface/main.go` | Go | 接口生成器 |
| `generate_service_interface.go` | Go | Service 接口生成 |
| `fix_service_interface.go` | Go | 接口修复 |
| `debug_interface.go` | Go | 接口调试 |
| `full-check-and-update.sh` | Shell | 全量检查更新 |
| `audit-docs.sh` | Shell | 文档审计 |
| `search.sh` | Shell | 搜索工具 |
| `module-mapper.py` | Python | 模块映射 |
| `trace-design-code.py` | Python | 设计-代码追踪 |
| `check-detail-completeness.py` | Python | 完整性检查 |
| `auto-update-index.py` | Python | 索引自动更新 |
| `manage-progress.py` | Python | 进度管理 |
| `dashboard-generator.py` | Python | 仪表盘生成 |
| `api-server.py` | Python | API 服务器 |
| `contrast-checker.js` | JS | 对比检查 |
| `full-benchmark.ts` | TS | 全量基准测试 |
| `migration/` | TS | 迁移工具 (generate-go-scaffold/validate/extract-api-contract) |

## 附录 K. 脚本集 (14 个)

| 脚本 | 用途 |
|------|------|
| `check-acceptance-criteria.{js,ts,sh}` | 验收标准检查 |
| `verify-9-layer.sh` | 9 层架构验证 |
| `verify-spec-traceability.{sh,ts}` | 需求可追溯性验证 |
| `verify-api-paths.sh` | API 路径验证 |
| `check-spec-acceptance.ts` | 规格验收检查 |
| `update-spec-traceability.sh` | 更新需求可追溯性 |
| `startup-check.sh` | 启动检查 |
| `import-docs-to-pandawiki.ts` | 文档导入知识库 |
| `renumber-migrations.sh` | 迁移重新编号 |
| `spec-mapping.json` | 需求映射 |

## 附录 L. SDK

**Python SDK** (8 文件): client.py + agents.py + pipelines.py + integrations.py + diagnostics.py

**TypeScript SDK** (7 文件): client.ts + agents.ts + pipelines.ts + integrations.ts + diagnostics.ts

## 附录 M. 文档体系与 ADR

**ADR 清单**:

| ADR | 内容 |
|-----|------|
| `0002-repository-pattern.md` | 仓储模式 |
| `0006-saga-compensation.md` | Saga 补偿 |
| `0007-pipeline-engine-architecture.md` | Pipeline 引擎架构 |
| `0010-api-gateway-architecture.md` | API 网关架构 |
| `0012-prometheus-monitoring.md` | Prometheus 监控 |
| `015-phase5-go-migration-architecture.md` | Go 迁移架构 |
| `ADR-002-Plugin-SPI 接口设计.md` | 插件 SPI |
| `ADR-003-成本数据采集架构.md` | 成本采集 |
| `ADR-004-备份恢复策略设计.md` | 备份恢复 |
| `ADR-008-ProductLine-CRD 多分支产品线设计.md` | 产品线设计 |
| `ADR-009-依赖追踪设计.md` | 依赖追踪 |

## 附录 N. 汇总统计

| 类别 | 文件数 | 代码行 |
|------|--------|--------|
| **Go** | ~2,200 | 595,737 |
| **Python** | ~4,000 | 532,387 |
| **TypeScript/JS** | ~1,800 | 704,639 |
| **Vue** | ~400 | 65,836 |
| **YAML (K8s)** | 234 | — |
| **SQL (Migrations)** | 2 | — |
| **总计** | ~8,600+ | ~1,898,599 |

| 区域 | 模块数 | 主要语言 |
|------|--------|----------|
| 平台核心域 | 170+ | Go |
| 蓝图微服务 | 70+ | Go/TS/Rust |
| K8s 部署 | 67 | YAML |
| 独立 Python 服务 | 3 | Python |
| 前端应用 | 4 | TS/Vue |
| Go 公共库 | 18 包 | Go |
| 工具集 | 18 | Go/Python/JS/TS |
| 脚本集 | 14 | JS/TS/Sh |
| 文档 | 25+ | Markdown |

| 模块 | 测试文件 | 测试类型 |
|------|----------|----------|
| platform-svc-go | 303 | unit |
| platform-svc-go | 10 | integration + e2e |
| ai-service | 19 | unit |
| api-gateway | 25+ | unit + integration |
| go-common | 20+ | unit + integration |
