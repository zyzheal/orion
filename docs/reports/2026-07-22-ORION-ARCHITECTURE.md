# Orion 系统架构全量报告 (2026-07-22)

> **版本**: v1.0（合并版）| **生成日期**: 2026-07-22 | **数据截至**: 2026-07-22
> **合并来源**: `orion-system-comprehensive-review`, `orion-architecture-reference`, `orion-problem-analysis`, `REVIEW-SUMMARY`
> **分支**: `fix/p0-route-auth-and-error-envelope` | **代码规模**: ~998K 行 (Go 595K + Python 532K + TS/JS 704K + Vue 65K)

---

## 目录

1. [系统架构总览](#1-系统架构总览)
2. [平台核心服务 (orion-platform-svc-go)](#2-平台核心服务)
3. [独立服务与基础设施](#3-独立服务与基础设施)
4. [前端与网关](#4-前端与网关)
5. [开发规范速查](#5-开发规范速查)
6. [Go 公共库速查](#6-go-公共库速查)
7. [Blueprint 微服务速查](#7-blueprint-微服务速查)
8. [代码规模与测试统计](#8-代码规模与测试统计)
9. [问题分析与风险](#9-问题分析与风险)
10. [7 领域专家评分](#10-7-领域专家评分)
11. [下一步行动计划](#11-下一步行动计划)

---

## 1. 系统架构总览

### 1.1 六层架构

```
orion-design/
├── orion-platform-svc-go/     # 核心 Go 平台 (1756 Go files, 170+ 内部域)
├── orion-api-gateway/         # Node.js API 网关 (Express.js, 92 文件)
├── orion-ai-service/          # Python AI 服务 (FastAPI, 66 文件)
├── orion-ai-agents-svc/       # Python AI 代理 (FastAPI + OTel, 2224 文件)
├── orion-intelligence-svc/    # Python 智能分析 (FastAPI + Alembic, 3940 文件)
├── orion-runner-agent/        # Node.js Runner Agent (TS, 2 文件)
├── orion-knowledge/           # 知识库 (Go + Next.js + Vue)
├── orion-dba/                 # DBA 工具 (Go + Vue)
├── orion-visor/               # 堡垒机 (Go + Vue)
├── orion-frontend/            # 主前端 (React 19 + Vite)
├── orion-go-common/           # Go 公共库 (18 包)
├── orion-sdk/                 # Python + TS SDK
├── blueprints/                # 70+ 微服务蓝图 (Go/TS/Rust)
├── infrastructure/k8s/        # 67 K8s 部署配置
├── deploy/                    # Prometheus/Grafana
├── migrations/                # PostgreSQL 迁移
├── tools/                     # 18 个开发工具
├── scripts/                   # 14 个 CI/验证脚本
└── docs/                      # 设计文档
```

### 1.2 技术栈

| 组件 | 语言 | 框架 | 用途 |
|------|------|------|------|
| Go 后端 | Go 1.25 | Gin + sqlx + NATS | 核心平台 + 微服务 |
| AI 服务 | Python 3.14 | FastAPI + SQLAlchemy | AI 推理/代理/分析 |
| API 网关 | Node.js/TS | Express + WebSocket | 路由/鉴权/代理 |
| 主前端 | TypeScript | React 19 + Vite + Ant Design | 管理控制台 |
| 知识库前端 | TS | Next.js + MUI / Vite + Vue | 知识库界面 |
| 部署 | K8s | 67 模块 YAML 配置 | 容器编排 |
| 可观测性 | — | OpenTelemetry + Prometheus + Grafana | 监控 |

### 1.3 服务拓扑

```
orion-api-gateway (Node.js, 14 中间件 + 14 路由)
    │  鉴权: JWT + RBAC + ABAC + 设备指纹
    │  路由: 灰度路由 + Token 管理 + WebSocket
    ├── orion-platform-svc-go     # 核心平台 (170+ 域)
    ├── orion-ai-svc-go           # AI 独立服务
    ├── orion-ci-cd-svc-go        # CI/CD 独立服务 (115 文件)
    ├── orion-ticket-svc-go       # 工单独立服务 (98 文件)
    ├── orion-notification-svc-go # 通知独立服务 (108 文件)
    ├── orion-identity-svc-go     # 身份独立服务 (72 文件)
    ├── orion-knowledge           # 知识库 (Go + Next.js + Vue)
    ├── orion-visor               # 堡垒机 (Go + Vue)
    ├── orion-dba                 # DBA 工具 (Go + Vue)
    ├── orion-ai-service          # Python FastAPI
    ├── orion-ai-agents-svc       # Python FastAPI + OTel
    └── orion-intelligence-svc    # Python FastAPI (7 种 AI 分析)
```

---

## 2. 平台核心服务

### 2.1 架构分层 (orion-platform-svc-go)

```
cmd/                # 可执行入口
├── server/         # 主服务 (wiring.go → DI 组装)
│   ├── main.go
│   ├── config.go
│   ├── router.go
│   ├── wiring.go              # 核心 DI
│   ├── core_infra_wiring.go
│   ├── cicd_domain_wiring.go
│   ├── pipeline_wave_wiring.go
│   ├── blueprint_batch_wiring.go
│   └── notification_auth_wiring.go
├── audit-cli/      # 审计 CLI
└── pipeline-engine/# 独立 Pipeline 引擎

internal/           # 170+ 业务域 (handler/service/repository/models)
pkg/                # 公共工具包 (idempotency, nats)
test/               # 测试套件 (benchmark/integration/e2e)
```

### 2.2 全量业务域 (170+ 域)

#### 认证与授权 (6 域)
| 域 | 文件 | 功能 |
|----|------|------|
| `auth` | 8 | 登录/注册/刷新/登出（JWT 双路由） |
| `auth-enhanced` | 8 | 增强认证 |
| `auth-mfa` | 7 | 多因素认证 |
| `sso` | 7 | 单点登录 |
| `sso-providers` | 7 | SSO 提供者管理 |
| `sso-unified` | 7 | 统一 SSO 抽象 |

#### 用户与租户 (13 域)
`user`, `user-activity`, `user-profile`, `user-status`, `user-token`, `tenant`, `tenant-gateway`, `role`, `permission`, `permission-audit`, `team`, `session`, `abac-policy`

#### CI/CD 与 Pipeline (22 域)
`pipeline-engine`(12), `pipeline`, `pipeline-template`, `pipeline-templates`, `pipeline-version`, `pipeline-versions`, `pipeline-run-history`, `pipeline-graph`, `pipeline-sse`, `pipeline-budget`, `pipeline-error-detail`, `pipeline-execution-control`, `pipeline-batch`, `pipeline-batch-operations`, `pipeline-audit-log`, `pipeline-trend`, `autonomous-pipeline`, `build`, `build-env`, `deploy`, `deploy-enhanced`, `deployment-trigger`

#### 部署与基础设施 (14 域)
`environment`, `env-lifecycle`, `env-profile`, `ephemeral-env`, `cluster`, `serverless`, `multi-cloud`, `iac`, `container`, `network`, `storage`, `canary-analysis`, `canary-traffic`, `smart-deploy`

#### 监控与可观测性 (10 域)
`monitoring`, `observability`, `apm`, `metrics`, `tracing`, `llm-trace`, `logging`, `health-check`, `diagnostic`, `performance`

#### 安全与合规 (8 域)
`security`(Trivy), `security-compliance`, `vulnerability`, `sbom`, `supply-chain`, `compliance`, `policy`(9), `governance`

#### 告警与通知 (8 域)
`alert`, `alert-breaker`, `notification`, `notification-management`, `notification-policy`, `notification-template`, `scheduled-notification`, `escalation`

#### 配置与参数 (8 域)
`config`, `config-mgmt-enhanced`, `global-param`, `feature-flag`, `unified-config`, `secret`, `middleware-ops`, `capability`(9)

#### 工单与事件 (8 域)
`ticketing`(15), `ticket-automation`, `ticket-knowledge`, `incident`, `incident-action`, `problem`, `change`, `change-request`

#### 数据平台 (7 域)
`data-catalog`(含 introspector), `data-lineage`, `data-pipeline`, `data-quality`(含 engine), `vector`, `vector-store`, `vectorize-rules`

#### 工作流与编排 (6 域)
`workflow`, `workflow-task`, `workflow-trigger`, `workflow-dependency`, `workflow-webhook`, `saga`(11, 分布式事务)

#### 项目管理 (7 域)
`project`, `project-member`, `sprint`, `product-line`, `efficiency`(11), `report-designer`, `bi-dashboard`

#### 应用与模块 (6 域)
`application`(22, 含 CQRS+Saga), `module`, `subapp`, `service-catalog`(9), `service-registry`, `service-health`, `service-topology`

#### 插件与扩展 (5 域)
`plugin`(13), `plugin-hotreload`, `webhook`(13), `gateway-dynamic`(11), `handler-registry`

#### 混沌工程与韧性 (6 域)
`chaos`, `chaos-enhanced`, `chaos-gateway`, `circuit-breaker`, `degradation`, `resilience-score`

#### AI 相关 (11 域)
`ai`, `ai-gateway`, `ai-agents`(含 agentregistry), `ai-models`, `ai-inference`, `ai-cost`, `ai-decisions`, `ai-degradation`, `ai-review`, `ai-security`(提示注入检测), `mlops`

#### 消息与事件 (4 域)
`eventbus`(8), `event-trigger`, `event-trigger-registry`, `message-queue`

#### 其他重要域 (50+)
`domain`(19, DDD), `infrastructure`(16), `audit`(9), `cron`(8), `billing`(8), `finops`, `finops-v2`, `capacity`, `backup`, `disaster-recovery`, `digital-twin`, `knowledge`(6), `channel`, `community`, `approval`, `contract`, `artifact`(8), `artifact-lifecycle`, `artifact-ops`, `artifact-version`, `api-market`, `audit`, `code-repo`, `integration`, `inspection`, `lowcode`, `maintenance-window`, `mcp`, `metadata`, `oci-registry`, `oncall`, `queue`(9), `runbook`, `risk`, `sandbox`, `self-healing`, `self-service`, `skill`(5), `sla`, `slo`, `terminal-audit`, `test-generation`, `test-selector`, `topology`, `ueba`, `visor-exec`, `workbench`(8), `lock`(1)

---

## 3. 独立服务与基础设施

### 3.1 orion-ai-service (Python FastAPI)

| 属性 | 值 |
|------|-----|
| 语言 | Python 3.14 | 框架 | FastAPI + SQLAlchemy | 测试 | 19 文件 |

架构: `src/main.py` → events/ (NATS 订阅) → api/ (ai/inference/mlops routes) → models/ → services/ (ai_service.py) → repositories/ (ai_result/llm_trace/metric_storage)

### 3.2 orion-ai-agents-svc (Python FastAPI + OTel)

| 属性 | 值 |
|------|-----|
| 语言 | Python 3.14 | 框架 | FastAPI + OpenTelemetry | 文件 | 2224 (含 venv) |

架构: `app/main.py` → dependencies.py → api/agent_routes.py → models/agent.py → services/agent_service.py → repositories/agent_repo.py
特性: 集成 OpenTelemetry (TracerProvider + BatchSpanProcessor + InMemorySpanExporter)

### 3.3 orion-intelligence-svc (Python FastAPI + Alembic)

| 属性 | 值 |
|------|-----|
| 语言 | Python 3.14 | 框架 | FastAPI + Alembic | 文件 | 3940 |

架构: `src/main.py` → api/ (classify/code_review/predict_sla/root_cause/sentiment/solution/summarize) → services/ (ai_service/llm_client) → models/
功能: 7 种 AI 分析能力

### 3.4 orion-runner-agent (Node.js TypeScript)
极简 Runner Agent，2 个文件 (index.ts + TaskExecutor.ts)，配置 `runner.example.json`。

### 3.5 K8s 基础设施

| 指标 | 值 |
|------|-----|
| YAML 文件 | 234 个 |
| 部署模块 | 67 个 |
| 配置 | deployment.yaml + service.yaml + hpa.yaml + configmap.yaml |
| 特征 | 统一 namespace `orion`，统一标签，ConfigMap 管理配置，Secret 管理敏感信息，资源限制 100m-500m CPU / 128Mi-512Mi Memory |

### 3.6 部署配置
| 文件 | 用途 |
|------|------|
| `prometheus/alert-rules.yaml` | Prometheus 告警规则 |
| `prometheus/alerts.yml` | Prometheus 告警配置 |
| `grafana/dashboards/orion-overview.json` | 总览仪表盘 |
| `grafana/dashboards/orion-tenant.json` | 租户仪表盘 |
| `grafana/dashboards/orion-service-metrics.json` | 服务指标仪表盘 |
| `grafana/dashboards/orion-service-health.json` | 服务健康仪表盘 |

---

## 4. 前端与网关

### 4.1 orion-frontend (React + TypeScript + Vite)

| 属性 | 值 |
|------|-----|
| 框架 | React 19 + Vite |
| UI 库 | Ant Design |
| TSX/TS 文件 | 1223 |
| 页面数 | 150+ |

架构: `App.tsx` (仅路由) → `main.tsx` (微前端/HMR/Auth/Theme) → `router/` → `pages/`(150+) → `components/`(50+) → `hooks/` → `stores/`(Pinia/Zustand) → `api/` → `types/` → `utils/` → `tokens/`(Design Token) → `microfront/` → `websocket/`

**设计系统**: CSS Variables 实现完整 Design Token (colors/spacing/typography/radius/shadows)，支持主题切换。
**微前端**: `initMicroFrontend` / `cleanupMicroFrontend`，HMR 时模块热替换。
**测试**: Vitest + Playwright (含 e2e)。

### 4.2 orion-api-gateway (TypeScript + Express.js)

| 属性 | 值 |
|------|-----|
| 语言 | TypeScript |
| 框架 | Express.js |
| 文件 | 92 |

架构: `index.ts` → `app.ts` → middleware/ (14 个: auth/permission/tenant/version/proxy/health/logging/error/csp/gray-route/subAppAuthAdapter/token-exchange) → routes/ (14 个) → services/ (auth/rbac/tenant-quota/service-client/service-registry/gateway-dynamic-routes/gray-release/module-routing/namespace-pool/token/token-blacklist) → websocket/ (5 个: ws-server/ws-auth/ws-heartbeat/ws-proxy/ws-errors)

**特性**: 多层鉴权 (JWT + RBAC + ABAC + 设备指纹)，灰度发布，Token 管理，WebSocket 代理，动态路由，测试 25+ 文件。

### 4.3 其他前端
| 前端 | 框架 | 文件 | 功能 |
|------|------|------|------|
| orion-visor | Vue 3 + Vite | 589 (291 Vue + 298 TS) | 堡垒机 (Guacamole + xterm.js) |
| orion-knowledge App | Next.js + MUI | 154 TS | 知识库用户端 |
| orion-knowledge Admin | Vite + Vue 3 | 545 TS | 知识库管理端 |
| orion-dba | Vue 3 + Vite | ~70 | 数据库管理 |

### 4.4 API 网关路由映射

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

## 5. 开发规范速查

### 5.1 新域创建模板

```bash
# 在 internal/ 下创建新域
mkdir -p internal/{my-domain}/{handler,service,repository,models,config}
```

### 5.2 Handler 模式

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
    tenantID := auth.GetTenantID(c)
    var req CreateRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, NewErrorResponse(400, "invalid request body", err.Error()))
        return
    }
    if err := auth.RequirePermission(c, "my_domain:create"); err != nil {
        c.JSON(403, NewErrorResponse(403, "permission denied", ""))
        return
    }
    result, err := h.Service.Create(c, tenantID, req)
    if err != nil {
        c.JSON(500, NewErrorResponse(500, "internal error", err.Error()))
        return
    }
    c.JSON(201, NewSuccessResponse(result))
}
```

### 5.3 Service 模式

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
    model := &MyModel{TenantID: tenantID, /* ... */}
    if err := s.Repository.Insert(ctx, model); err != nil {
        return nil, fmt.Errorf("create mymodel: %w", err)
    }
    return model, nil
}
```

### 5.4 Repository 模式

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
```

### 5.5 响应格式

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

### 5.6 错误码体系

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

### 5.7 常见开发模式

**添加新 API 的步骤**:
```
Step 1: internal/{domain}/models/      → 定义请求/响应 struct
Step 2: internal/{domain}/repository/  → 实现 RepositoryInterface
Step 3: internal/{domain}/service/     → 实现 ServiceInterface
Step 4: internal/{domain}/handler/     → 实现 Handler + RegisterRoutes
Step 5: cmd/server/wiring.go           → 注册 DI
Step 6: 测试                           → 单元测试 + 集成测试
```

**添加新 Blueprint 服务**:
```
Step 1: blueprints/orion-{name}-svc-go/ → 创建目录
Step 2: cmd/server/main.go              → 入口
Step 3: go.mod                          → 模块定义
Step 4: 复制 response_writer.go         → 统一响应
Step 5: internal/{domain}/              → domain 结构
Step 6: K8s 部署                        → infrastructure/k8s/
```

**添加 K8s 部署**:
```
Step 1: infrastructure/k8s/orion-{name}/ → 创建目录
Step 2: deployment.yaml                  → Deployment (replicas: 2)
Step 3: service.yaml                     → Service
Step 4: hpa.yaml                         → HPA
Step 5: configmap.yaml                   → ConfigMap
```

**添加 NATS 消息订阅**:
```go
// 1. 定义事件处理器
func (h *handler) OnPipelineCompleted(ctx context.Context, msg *nats.Msg) error {
    var payload PipelineCompletedEvent
    json.Unmarshal(msg.Data, &payload)
    return nil
}
// 2. 注册订阅
nats.Subscribe("pipeline.completed", h.OnPipelineCompleted)
```

### 5.8 测试规范

**目录**: `test/benchmark/` (性能基准), `test/integration/` (auth + pipeline), `test/e2e/` (auth)

**Mock 模式**:
```go
//go:generate mockgen -source=service.go -destination=service_mock.go -package=mydomain_test

func TestServiceCreate(t *testing.T) {
    ctx := context.Background()
    mockRepo := &MockRepository{
        InsertFunc: func(ctx context.Context, m *MyModel) error { return nil },
    }
    service := NewService(mockRepo)
    model, err := service.Create(ctx, "tenant-1", CreateRequest{Name: "test"})
    assert.NoError(t, err)
    assert.Equal(t, "test", model.Name)
}
```

**最佳实践**:
- Table-driven tests: `t.Run` + 子测试
- 每个接口至少 3 个测试用例
- Repository 集成测试: Testcontainers 或 SQLite 内存库
- Handler 测试: `httptest.NewRecorder` + Gin 测试上下文
- 覆盖率目标: 核心域 50%+，基础设施 80%+

### 5.9 日志规范

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

## 6. Go 公共库速查

> **Go 文件**: 60+ | **包数**: 18

| 包 | 功能 | 文件 | 关键类型/函数 |
|----|------|------|-------------|
| `auth` | RBAC + ABAC + CORS + 中间件 + 权限缓存 | 12 | `RequirePermission(ctx, resource, action)`, `GetTenantID(ctx)`, `IsAdmin(ctx)` |
| `audit` | 审计链 + 日志同步 + UEBA + 签名 + 告警 | 7 | `AuditChain`, `WithOperation(op)`, `Log(ctx)` |
| `config` | 配置管理 | 2 | `Load()`, `Watch()`, `GetString(key)`, `GetInt(key)` |
| `cron` | 定时任务 | 3 | `AddJob(spec, fn)`, `RemoveJob(name)`, `GetJobStatus(name)` |
| `dag` | DAG 有向无环图 | 3 | `NewDAG()`, `AddNode(id)`, `AddEdge(from, to)`, `TopologicalSort()` |
| `database` | DB 连接 + 迁移 + RLS + Repository 基类 | 4 | `RepositoryBase`, `NewPG(db)`, `NewRedis(r)` |
| `errors` | 结构化错误 | 2 | `NewError(code, msg)`, `IsNotFound(err)`, `IsPermissionDenied(err)` |
| `idempotency` | 幂等性 (Checker/Redis/PG/中间件) | 6 | `NewChecker(redis, pg)`, `Check(ctx, key)`, `Release(ctx, key)` |
| `logger` | 日志 | 2 | `Info(msg, kv...)`, `Error(err, kv...)`, `Debug(msg, kv...)` |
| `messaging` | Kafka + NATS | 2 | `NATSProducer`, `NATSConsumer`, `Publish(topic, msg)`, `Subscribe(topic, handler)` |
| `middleware` | 通用中间件 | 3 | `ReadOnly()`, `RateLimit(limit)`, `RequestID()` |
| `otel` | OpenTelemetry | 1 | `StartTracer(serviceName)`, `EndSpan(span)`, `NewSpan(ctx, name)` |
| `plugin` | 插件系统 (SPI) | 3 | `NewPluginManager()`, `Register(name, impl)`, `Get(name)` |
| `redis` | Redis 客户端 | 2 | `Get(key)`, `Set(key, val, ttl)`, `Del(key)`, `Incr(key)` |
| `sentinel` | 哨兵错误 | 1 | — |
| `sse` | SSE 推送 | 3 | `NewHub()`, `Publish(event)`, `Subscribe(topic)`, `Disconnect(id)` |

---

## 7. Blueprint 微服务速查

> **总计**: 70+ 蓝图目录 | **Go 模块**: 24 个 | **Node 模块**: 45 个 | **Rust 模块**: 1 个

### 7.1 Go 蓝图 (24 个，有代码)

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

### 7.2 Node.js/TypeScript 蓝图 (Top 15/45 个)

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
| `orion-platform-core` | 23 | 平台核心 (Node.js 版) |
| `orion-deploy-svc` | 23 | 部署服务 |
| `orion-digital-twin-svc` | 24 | 数字孪生服务 |
| `orion-dr-svc` | 21 | 灾备服务 |
| `orion-federation-svc` | 18 | 联邦服务 |

### 7.3 蓝图通用结构

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

### 7.4 空白蓝图 (36 个，仅有目录)

`orion-security-svc`, `orion-runner-svc`, `orion-risk-svc`, `orion-plugin-svc`, `orion-platform-core`(Go), `orion-pipeline-svc`(Go), `orion-pandawiki-svc`(Go), `orion-notify-svc`(Go), `orion-monitor-svc`(Go), `orion-llm-trace-svc-py`, `orion-llm-svc`(Go), `orion-knowledge-svc-py`, `orion-knowledge-svc`(Go), `orion-inception-svc`(Go), `orion-graph-svc`(Go), `orion-governance-svc`(Go), `orion-finops-svc`(Go), `orion-federation-svc`(Go), `orion-efficiency-svc`(Go), `orion-dr-svc`(Go), `orion-digital-twin-svc`(Go), `orion-deploy-svc`(Go), `orion-dba-svc`(Go), `orion-db`(Go), `orion-config-mgmt-svc`(Go), `orion-community-svc`(Go), `orion-code-svc`(Go), `orion-cmdb-svc`(Go), `orion-chatops-svc`(Go), `orion-audit-svc`(Go), `orion-artifact-svc`(Go), `orion-approval-svc`(Go), `orion-ai-svc`(Go), `orion-agent-svc`(Go)

---

## 8. 代码规模与测试统计

### 8.1 代码规模

| 类别 | 文件数 | 代码行 |
|------|--------|--------|
| **Go** | ~2,200 | 595,737 |
| **Python** | ~4,000 | 532,387 |
| **TypeScript/JS** | ~1,800 | 704,639 |
| **Vue** | ~400 | 65,836 |
| **YAML (K8s)** | 234 | — |
| **SQL (Migrations)** | 2 | — |
| **总计** | ~8,600+ | ~1,898,599 |

### 8.2 模块分布

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

### 8.3 测试覆盖

| 模块 | 测试文件 | 测试类型 |
|------|----------|----------|
| platform-svc-go | 303 | unit |
| platform-svc-go | 10 | integration + e2e |
| ai-service | 19 | unit |
| api-gateway | 25+ | unit + integration |
| go-common | 20+ | unit + integration |

### 8.4 模块完成度

| 完成度 | 数量 | 占比 |
|:------:|:----:|:----:|
| ✅ 完整 4 层 | 235 | 93% |
| ⚠️ 部分实现 | 12 | 5% |
| ❌ 仅蓝图 | 5 | 2% |
| 🔴 有测试 | 31 | 14% |

### 8.5 持久化状态

| 类型 | 数量 | 占比 |
|:----:|:----:|:----:|
| SQL Repository | 57 | 27% |
| Map Repository | 158 | 73% |
| 真正使用 PG | 57 | 27% |

---

## 9. 问题分析与风险

### 9.1 架构优点

1. **清晰的六层架构**: `cmd → internal/{handler,service,repository,models} → pkg`
2. **显式 DI**: Wiring 模式便于测试和依赖管理
3. **接口隔离**: Handler/Service/Repository 层使用接口，支持 mock
4. **多租户设计**: 几乎所有 API 都有 `tenantID` 参数
5. **权限模型**: RBAC + ABAC 双重授权
6. **可观测性**: OpenTelemetry + APM + 分布式追踪
7. **事件驱动**: NATS 消息总线 + Saga 分布式事务
8. **幂等性**: 完整的幂等性中间件 (Redis + PostgreSQL)

### 9.2 风险与关注点

| # | 问题 | 详情 | 影响量化 | 修复方向 |
|---|------|------|---------|---------|
| 1 | **重复代码** | 170+ 域中 handler/service/repository 高度同质化 | 60-70% 域仅 5-8 文件 | 引入代码生成工具（go generate） |
| 2 | **Blueprint 碎片化** | 70+ 蓝图中 36 个为空，存在 Go/TS 双实现 | 36 空目录 + 24 Go + 45 TS | 统一 Go 技术栈，归档 TS |
| 3 | **`map[string]any` 返回** | tenant 等域大量使用 `map[string]any` | 26+ 方法 | 替换为强类型 struct |
| 4 | **K8s 配置重复** | 234 个 YAML 文件大量重复模板 | ~80% 内容相同 | 提取 Kustomize base/overlays |
| 5 | **遗留系统** | legacy/ 中旧 TS 服务已迁移但代码仍保留 | — | 标注废弃标记后删除 |
| 6 | **权限检查分散** | 权限检查散落在 handler 中 | 各域不一致 | 提取统一 permission middleware |
| 7 | **RLS 策略覆盖不完整** | 部分表可能未启用 RLS | 租户数据泄露风险 | 验证 RLS 策略覆盖所有租户隔离表 |
| 8 | **日志格式不统一** | 各域使用不同 logger 实现 | 日志聚合困难 | 统一 logger 接口 + 结构化日志 |
| 9 | **APM 覆盖不完整** | 仅 `orion-ai-agents-svc` 集成 OpenTelemetry | 大部分服务无分布式追踪 | 全服务 OTel 注入 |
| 10 | **测试覆盖不足** | 平台核心域 ~15%，Blueprint 0% | 1000+ 测试文件差距 | 优先核心域 50%+ 覆盖率 |

### 9.3 修复优先级矩阵

| 优先级 | 问题 | 工作量 | 影响面 | 验收标准 |
|--------|------|--------|--------|---------|
| **P0** | 路由鉴权 + 错误信封 | 2-3 人天 | 全局 | 所有非公开 API 有守卫；统一 error envelope；JWT 双路由合并 |
| **P1** | `map[string]any` → 强类型 | 5-8 人天 | 170+ 域 | tenant 域 26+ Repository 方法返回强类型 |
| **P1** | Blueprint 清理 | 3-5 人天 | 开发体验 | 36 空目录全部处理；Go/TS 职责划分文档 |
| **P2** | K8s Kustomize 化 | 3-4 人天 | 运维 | Kustomize base/overlays 可用 |

---

## 10. 7 领域专家评分

> **综合评分: C+** (加权平均)

| 领域 | 评分 | 核心缺陷 |
|:----:|:----:|---------|
| 🔧 后端 | **B** | 188 模块无测试 |
| 🎨 前端 | **C+** | 96 目录未注册路由, 39% API 客户端未使用 |
| 🤖 AI | **C** | ai-security 已修复+16测试 |
| 🔒 安全运维 | **B** | Go CI 已加入, CVE 框架完成 |
| 📈 数据平台 | **C** | data-pipeline 已修复 |
| 🏗️ 架构 | **B** | 3 P0: 无 Read Model, Saga 补偿空壳, Pipeline 未集成 Saga |
| 🔌 生态集成 | **C** | 插件 SPI 已完成 + 测试 |

### 代码评审缺陷修复状态

| 优先级 | 总数 | 已修复 | 待修复 | 状态 |
|:------:|:----:|:------:|:------:|:----:|
| **CRITICAL** | 14 | 14 | 0 | ✅ **全部完成** |
| **HIGH** | 10 | 10 | 0 | ✅ **全部完成** |
| **MEDIUM** | 7 | 7 | 0 | ✅ **全部完成** |
| **合计** | **31** | **31** | **0** | **✅ 100%** |

---

## 11. 下一步行动计划

### 11.1 已完成的 Phase

| Phase | 内容 | 状态 |
|-------|------|------|
| Phase 1 | 代码评审缺陷修复 (31/31) | ✅ 完成 |
| Phase 2 | 架构升级 — Event-Driven 基础设施 (SnapshotStore+CommandBus+ReadModel) | ✅ 完成 |
| Phase 3 | AI Python 迁移 Phase 1-3 (7 migrations+CircuitBreaker+CostOptimizer+48 tests) | ✅ 完成 |
| Phase 4 | PipelineEngine gRPC 暴露 + Gateway 模块路由对齐 (6 模块接入+审计报告) | ✅ 完成 |

### 11.2 待执行计划

| 优先级 | 任务 | 来源 | 状态 |
|:------:|------|------|:----:|
| P0 | 自动化执行引擎（参考 NeatLogic AutoExec 三层架构） | NeatLogic 对标 | 🔄 开发中 |
| P1 | CMDB 采集适配器（120+ 厂商适配器） | NeatLogic 对标 | 🔄 开发中 |
| P1 | 统一通知引擎（NotifyHandlerFactory 工厂模式） | NeatLogic 对标 | 🔄 开发中 |
| P1 | 全局搜索（GlobalSearchManager + 多模块索引） | NeatLogic 对标 | 🔄 开发中 |
| P1 | 数据库迁移体系（changelog + version.json） | NeatLogic 对标 | 🔄 部分完成 |
| P2 | 全文搜索统一 | NeatLogic 对标 | 🔄 开发中 |

### 11.3 工具集与脚本集

**工具集 (18 个)**:
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
| `migration/` | TS | 迁移工具 |

**脚本集 (14 个)**:
`check-acceptance-criteria.{js,ts,sh}`, `verify-9-layer.sh`, `verify-spec-traceability.{sh,ts}`, `verify-api-paths.sh`, `check-spec-acceptance.ts`, `update-spec-traceability.sh`, `startup-check.sh`, `import-docs-to-pandawiki.ts`, `renumber-migrations.sh`, `spec-mapping.json`

---

> *本文档合并了 4 份分散的 2026-07-22 文档，是 Orion 系统架构的单一权威来源。*
> *NeatLogic 对标分析请参考 `docs/reports/2026-07-22-NEATLOGIC-BENCHMARK.md`。*
