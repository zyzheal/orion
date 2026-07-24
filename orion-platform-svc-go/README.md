# Orion Platform Service (Go)

> Orion AI-driven DevOps 平台核心服务（Go 版本）
>
> 项目根目录: [MICROSERVICES.md](../MICROSERVICES.md) · 设计规范: [CLAUDE.md](../CLAUDE.md) · API 参考: [API-QUICK-REFERENCE.md](../API-QUICK-REFERENCE.md)

## 项目简介

Orion 平台是面向研发效能的 AI 驱动的 DevOps 平台。核心主张：
> **不替代现有工具链，而是让现有工具链变聪明** — 集成 Tekton、Knative、Prometheus、K8s 等，而非替代它们。

`orion-platform-svc-go` 是核心后端服务的 **Go 单体架构**实现，基于 Gin + sqlx + PostgreSQL，包含 **225 个业务模块**和 **455 个迁移文件**。当前生产部署以 Node.js 单体 `orion-platform-service` 为主，Go 版本正在持续迁移中。

### 关键指标

| 指标 | 数值 |
|------|------|
| 业务模块 | 225 (`internal/` 目录) |
| 数据库迁移文件 | 455 (`migrations/`) |
| Go 版本 | 1.25 |
| 模块名 | `orion/platform-svc-go` |
| 可执行入口 | 3 (`cmd/server`, `cmd/pipeline-engine`, `cmd/audit-cli`) |
| 公共库 | 2 (`pkg/idempotency`, `pkg/nats`) |
| 文档 | 11 份 (`docs/`) |

## 架构概览

| 组件 | 技术选型 | 说明 |
|------|----------|------|
| **框架** | Gin v1.10 | HTTP 路由与中间件 |
| **数据库** | PostgreSQL (via sqlx) | 主数据存储 |
| **缓存** | Redis (go-redis v9) | 会话、限流、缓存 |
| **消息** | NATS (JetStream) | 事件驱动、异步通信 |
| **认证** | JWT (golang-jwt v5) | Token 签发与验证 |
| **日志** | zap (go.uber.org/zap) | 结构化日志 |
| **追踪** | OpenTelemetry (otel) | 分布式链路追踪 |
| **配置** | yaml.v3 + 环境变量 | 多环境配置 |

### 分层架构

```
orion-platform-svc-go/
├── cmd/                    # 可执行入口
│   ├── server/             # 主服务入口
│   ├── pipeline-engine/    # 流水线引擎独立进程
│   └── audit-cli/          # 审计 CLI 工具
├── internal/               # 225 个业务模块
│   ├── <module>/
│   │   ├── handler/        # HTTP 路由处理（Gin handler）
│   │   ├── service/        # 业务逻辑层
│   │   ├── repository/     # 数据访问层（sqlx + PostgreSQL）
│   │   └── model/          # 领域模型
│   ├── middleware/          # 全局中间件（认证、日志、CORS）
│   └── domain/             # DDD 领域层（eventstore, commands）
├── pkg/                    # 公共库
│   ├── idempotency/        # 幂等性控制
│   └── nats/               # NATS 事件总线封装
├── migrations/             # 455 个数据库迁移文件
└── docs/                   # 项目文档
```

### 请求处理流程

```
Client -> Gin Router -> Middleware Chain (Auth/Logger/CORS) -> Handler -> Service -> Repository -> PostgreSQL
                                                                  |
                                                               NATS (事件)
                                                                  |
                                                               Redis (缓存)
```

## 快速开始

### 前提条件

- Go 1.25+
- Docker & Docker Compose（本地开发环境）

### 开发环境

```bash
cd orion-platform-svc-go

# 1. 启动依赖服务（PostgreSQL + Redis + NATS）
docker compose up -d

# 等待数据库就绪
docker compose exec postgres pg_isready

# 2. 安装 Go 依赖
go mod download

# 3. 运行数据库迁移
# 迁移文件位于 migrations/ 目录（455 个文件）
# 通过 server 启动时自动执行迁移

# 4. 配置环境变量
cp .env.example .env
# 编辑 .env 填入实际配置

# 5. 启动服务
go run ./cmd/server/

# 6. 验证健康检查
curl http://localhost:8080/healthz
```

### 构建生产镜像

```bash
# 构建 Docker 镜像
docker build -t orion-platform-svc:latest .

# 运行容器
docker run -p 8080:8080 --env-file .env orion-platform-svc:latest

# 构建静态二进制（Linux）
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 \
  go build -trimpath -ldflags="-s -w" -o server ./cmd/server
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_URL` | `postgres://orion:oriondev@localhost:5432/orion?sslmode=disable` | PostgreSQL DSN |
| `DB_HOST` | `localhost` | 数据库主机 |
| `DB_PORT` | `5432` | 数据库端口 |
| `DB_USER` | `orion` | 数据库用户 |
| `DB_PASSWORD` | `oriondev` | 数据库密码 |
| `DB_NAME` | `orion` | 数据库名 |
| `REDIS_ADDR` | `localhost:6379` | Redis 地址 |
| `REDIS_PASSWORD` | - | Redis 密码 |
| `NATS_ADDR` | `nats://localhost:4222` | NATS 服务器地址 |
| `NATS_STREAM` | `ORION_EVENTS` | NATS JetStream 流名 |
| `JWT_SECRET` | `change-me-to-a-random-secret` | JWT 签名密钥 |
| `JWT_EXPIRATION` | `5m` | JWT Access Token 过期时间 |
| `JWT_REFRESH_EXPIRATION` | `168h` | JWT Refresh Token 过期时间 |
| `HTTP_ADDR` | `:8080` | HTTP 服务监听地址 |
| `LOG_LEVEL` | `info` | 日志级别 |
| `ENVIRONMENT` | `development` | 运行环境 |
| `OTEL_ENDPOINT` | - | OpenTelemetry Collector 地址 |

完整配置参见 [.env.example](.env.example)。

## 核心模块列表

`internal/` 下包含 **225 个业务模块**，按领域划分：

### 认证与权限 (14 模块)

| 模块 | 说明 |
|------|------|
| `auth` | 基础认证（登录、注册、Token） |
| `auth-enhanced` | 增强认证（双因素等） |
| `auth-mfa` | 多因素认证（MFA） |
| `sso` / `sso-unified` / `sso-providers` | 单点登录（SSO）统一认证 |
| `permission` / `permission-audit` | 权限管理 |
| `role` | 角色管理 |
| `tenant` / `tenant-gateway` | 多租户隔离 |
| `session` | 会话管理 |
| `user` / `user-activity` / `user-profile` / `user-status` / `user-token` | 用户体系 |

### 流水线与制品 (18 模块)

| 模块 | 说明 |
|------|------|
| `pipeline` | 流水线编排 |
| `pipeline-engine` | 流水线执行引擎 |
| `pipeline-sse` | 实时日志 SSE 推送 |
| `pipeline-template` / `pipeline-templates` | 模板管理 |
| `pipeline-run-history` / `pipeline-version` / `pipeline-versions` | 运行历史与版本 |
| `pipeline-graph` / `pipeline-audit-log` / `pipeline-batch` | 图、审计、批量 |
| `pipeline-budget` / `pipeline-batch-operations` / `pipeline-execution-control` | 预算、批量操作、执行控制 |
| `build` / `build-env` | 构建环境 |
| `artifact` / `artifact-lifecycle` / `artifact-ops` / `artifact-version` | 制品全生命周期 |
| `version-archive` | 版本归档 |

### AI 平台 (14 模块)

| 模块 | 说明 |
|------|------|
| `ai-agents` | AI 智能体 |
| `ai-cost` | AI 成本追踪 |
| `ai-decisions` | AI 决策记录 |
| `ai-degradation` | AI 降级 |
| `ai-gateway` | AI 网关 |
| `ai-models` | 模型管理 |
| `ai-review` | AI 评审 |
| `ai-security` | AI 安全 |
| `mlops` | MLOps 流程 |
| `llm-trace` | LLM 调用追踪 |
| `knowledge` | 知识库 |
| `vector` / `vector-store` / `vectorize-rules` | 向量数据库 |
| `chatops` | ChatOps 对话 |

### 可观测性与告警 (14 模块)

| 模块 | 说明 |
|------|------|
| `alert` / `alert-breaker` | 告警与告警熔断 |
| `monitoring` | 监控中心 |
| `observability` | 可观测性 |
| `apm` | 应用性能监控 |
| `diagnostic` | 诊断中心 |
| `tracing` | 链路追踪 |
| `metrics` | 指标采集 |
| `inspection` | 巡检 |
| `incident` / `incident-action` | 事件管理 |
| `self-healing` / `self-service` | 自愈/自助 |
| `slo` / `sla` | 服务等级目标/协议 |

### 治理与合规 (10 模块)

| 模块 | 说明 |
|------|------|
| `governance` | 平台治理 |
| `compliance` | 合规 |
| `policy` | 策略管理 |
| `audit` | 审计日志 |
| `security` / `security-compliance` | 安全 |
| `risk` | 风险管理 |
| `sbom` | 软件物料清单 |
| `change` / `change-request` | 变更管理 |
| `approval` | 审批流程 |

### 基础设施与部署 (12 模块)

| 模块 | 说明 |
|------|------|
| `deploy` / `deploy-enhanced` | 部署管理 |
| `environment` / `env-lifecycle` / `env-profile` | 环境管理 |
| `infrastructure` | 基础设施 |
| `serverless` | 无服务器 |
| `multi-cloud` | 多云 |
| `iac` | 基础设施即代码 |
| `disaster-recovery` | 灾备 |
| `backup` | 备份 |
| `ephemeral-env` | 临时环境 |

### CMDB 与服务 (8 模块)

| 模块 | 说明 |
|------|------|
| `cmdb` | 配置管理数据库 |
| `service-registry` / `service-catalog` | 服务注册与目录 |
| `service-health` / `service-topology` | 服务健康与拓扑 |
| `topology` | 拓扑发现 |
| `digital-twin` / `digital-twin-simulation` | 数字孪生 |

### 配置与密钥 (6 模块)

| 模块 | 说明 |
|------|------|
| `config` / `config-mgmt-enhanced` | 配置管理 |
| `unified-config` | 统一配置 |
| `global-param` | 全局参数 |
| `secret` | 密钥管理 |

### 成本与计费 (5 模块)

| 模块 | 说明 |
|------|------|
| `finops` / `finops-v2` | 财务运维 |
| `billing` | 计费 |
| `cost-allocation` | 成本分摊 |
| `capacity` | 容量管理 |

### 通知与消息 (8 模块)

| 模块 | 说明 |
|------|------|
| `notification` | 通知中心 |
| `notification-management` | 通知管理 |
| `notification-policy` / `notification-template` | 通知策略与模板 |
| `scheduled-notification` | 定时通知 |
| `message-queue` | 消息队列 |
| `do-not-disturb` | 免打扰 |

### CI/CD 与自动化 (18 模块)

| 模块 | 说明 |
|------|------|
| `cron` | 定时任务 |
| `ticketing` / `ticket-automation` / `ticket-knowledge` | 工单系统 |
| `workflow` / `workflow-task` / `workflow-trigger` / `workflow-webhook` | 工作流 |
| `event-trigger` / `event-trigger-registry` | 事件触发 |
| `plugin` / `plugin-hotreload` | 插件系统 |
| `feature-flag` | 功能开关 |
| `webhook` / `webhook/store` | Webhook |
| `mcp` | Model Context Protocol |
| `code-repo` / `branch-policy` | 代码仓库与分支策略 |
| `ci-type` | CI 类型管理 |

### 其他核心模块 (20+ 模块)

| 模块 | 说明 |
|------|------|
| `federation` | 联邦 |
| `report-designer` / `bi-dashboard` | 报表与 BI |
| `lowcode` | 低代码 |
| `chaos` / `chaos-enhanced` / `chaos-gateway` | 混沌工程 |
| `team` / `project` / `product-line` / `sprint` | 团队协作 |
| `test-selector` / `test-generation` | 测试管理 |
| `subapp` | 微前端子应用 |
| `page-registry` | 页面注册 |
| `visor-exec` | 可视化执行 |
| `health-check` | 健康检查 |
| `smart-deploy` / `canary-traffic` / `progressive` | 智能部署与金丝雀 |
| `autonomous-pipeline` | 自主流水线 |
| `data-pipeline` / `data-quality` / `data-lineage` | 数据管道 |
| `integration` / `api-market` / `api-governance` / `api-consumption` | 集成与 API 管理 |
| `gateway-dynamic` | 动态网关 |

## 数据库迁移

迁移文件位于 `migrations/` 目录，共 **455 个文件**，格式为 SQL。

```bash
# 查看可用迁移
ls migrations/

# 服务启动时自动执行未应用的迁移
go run ./cmd/server/
```

迁移文件命名约定：
- `<seq>_<description>.sql` 正向迁移
- `<seq>_<description>_down.sql` 回滚迁移（部分文件）

## API

- API 端点通过 Gin 路由注册在各模块的 `handler/` 目录
- 完整 API 参考: [API-QUICK-REFERENCE.md](../API-QUICK-REFERENCE.md)（626 路由，77 模块）
- 健康检查: `GET /healthz`
- 服务端口: `8080`

## 测试

```bash
# 运行全部测试
go test ./internal/... -v

# 运行带竞态检测的测试
go test ./internal/... -race

# 运行单个模块测试
go test ./internal/auth/... -v

# 带覆盖率
go test ./internal/... -cover
```

## 文档索引

| 文档 | 说明 |
|------|------|
| [docs/go-workspace-guide.md](docs/go-workspace-guide.md) | Go Workspace 使用指南 |
| [docs/module-interface-contracts.md](docs/module-interface-contracts.md) | 模块接口契约 |
| [docs/full-module-audit-2026-07-17.md](docs/full-module-audit-2026-07-17.md) | 全模块审计报告 |
| [docs/unmigrated-modules-migration-plan.md](docs/unmigrated-modules-migration-plan.md) | 未迁移模块计划 |
| [docs/notification-cutover-runbook.md](docs/notification-cutover-runbook.md) | 通知模块切换手册 |
| [docs/ai-python-migration-plan.md](docs/ai-python-migration-plan.md) | AI Python 迁移计划 |
| [docs/ai-unified-cutover-plan.md](docs/ai-unified-cutover-plan.md) | AI 统一切换计划 |
| [docs/expert-review-2026-07-16.md](docs/expert-review-2026-07-16.md) | 专家评审报告 |
| [docs/schema-consistency-test.sql](docs/schema-consistency-test.sql) | 数据库 schema 一致性测试 |
| [docs/review/](docs/review/) | 代码评审文档目录 |
| [docs/expert-review-2026-07-16/](docs/expert-review-2026-07-16/) | 专家评审详细报告目录 |

## 生态与依赖

| 依赖 | 用途 |
|------|------|
| `orion/go-common` | Go 公共库（基础结构、工具函数） |
| `orion-platform-service` | Node.js 版本（当前生产权威实现） |
| `orion-api-gateway` | API 网关 |
| `orion-frontend` | React 前端 |
| `orion-visor` | 可视化运维（Java/Spring） |

## 许可证

见项目根目录 [LICENSE](../LICENSE)