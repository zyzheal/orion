# Orion 系统全量综合审查报告

> **生成日期**: 2026-07-22  
> **分析范围**: 全量模块，无跳过  
> **当前分支**: `fix/p0-route-auth-and-error-envelope`  
> **总代码规模**: ~998K 行 (Go 595K + Python 532K + TS/JS 704K + Vue 65K)

---

## 目录

1. [系统架构总览](#1-系统架构总览)
2. [核心平台服务 (orion-platform-svc-go)](#2-核心平台服务-orion-platform-svc-go)
3. [蓝图微服务 (blueprints/)](#3-蓝图微服务-blueprints)
4. [独立服务 (Standalone Services)](#4-独立服务-standalone-services)
5. [前端应用 (Frontend)](#5-前端应用-frontend)
6. [API 网关 (orion-api-gateway)](#6-api-网关-orion-api-gateway)
7. [Go 公共库 (orion-go-common)](#7-go-公共库-orion-go-common)
8. [SDK (orion-sdk)](#8-sdk-orion-sdk)
9. [知识库服务 (orion-knowledge)](#9-知识库服务-orion-knowledge)
10. [DBA 工具 (orion-dba)](#10-dba-工具-orion-dba)
11. [Visor 运维 (orion-visor)](#11-visor-运维-orion-visor)
12. [K8s 基础设施 (infrastructure/)](#12-k8s-基础设施-infrastructure)
13. [部署配置 (deploy/)](#13-部署配置-deploy)
14. [迁移脚本 (migrations/)](#14-迁移脚本-migrations)
15. [工具集 (tools/)](#15-工具集-tools)
16. [脚本集 (scripts/)](#16-脚本集-scripts)
17. [文档体系 (docs/)](#17-文档体系-docs)
18. [遗留系统 (legacy/)](#18-遗留系统-legacy)
19. [需求规范 (requirements/)](#19-需求规范-requirements)
20. [汇总统计](#20-汇总统计)
21. [关键发现与风险](#21-关键发现与风险)

---

## 1. 系统架构总览

```
orion-design/
├── orion-platform-svc-go/     # 核心 Go 平台 (1756 Go files, 170+ 内部域)
├── orion-api-gateway/         # Node.js API 网关 (TypeScript)
├── orion-ai-service/          # Python AI 服务 (FastAPI)
├── orion-ai-agents-svc/       # Python AI 代理服务 (FastAPI)
├── orion-intelligence-svc/    # Python 智能分析服务 (FastAPI)
├── orion-runner-agent/        # Node.js Runner Agent (TypeScript)
├── orion-knowledge/           # 知识库 (Go 后端 + Next.js/Vue 前端)
├── orion-dba/                 # 数据库管理 (Go 后端 + Vue 前端)
├── orion-visor/               # 运维堡垒机 (Go 后端 + Vue 前端)
├── orion-frontend/            # 主前端 (React + TypeScript + Vite)
├── orion-go-common/           # Go 公共库
├── orion-sdk/                 # Python + TypeScript SDK
├── blueprints/                # 70+ 微服务蓝图 (Go/Node/Rust)
├── infrastructure/k8s/        # 67 K8s 部署配置
├── deploy/                    # Prometheus/Grafana 配置
├── migrations/                # PostgreSQL 迁移
├── tools/                     # 开发工具集
├── scripts/                   # CI/验证脚本
├── docs/                      # 设计文档
├── legacy/                    # 遗留 TS 服务
└── requirements/              # 需求规范
```

### 1.1 技术栈分布

| 技术栈 | 语言 | 框架 | 用途 |
|--------|------|------|------|
| Go 后端 | Go 1.25 | Gin + sqlx + NATS | 核心平台 + 微服务 |
| AI 服务 | Python 3.14 | FastAPI + SQLAlchemy | AI 推理/代理/智能分析 |
| API 网关 | Node.js/TS | Express + WebSocket | 路由/鉴权/代理 |
| 主前端 | TypeScript | React 19 + Vite + Ant Design | 管理控制台 |
| 知识库前端 | TypeScript | Next.js + MUI (App) / Vite + Vue (Admin) | 知识库界面 |
| Visor 前端 | TypeScript | Vue 3 + Vite | 运维堡垒机界面 |
| DBA 前端 | TypeScript | Vue 3 + Vite | 数据库管理界面 |

---

## 2. 核心平台服务 (orion-platform-svc-go)

> **Go 文件数**: 1756 | **代码行**: ~250K+ | **内部域**: 170+

### 2.1 架构分层

```
cmd/                # 可执行入口 (server / audit-cli / pipeline-engine)
├── server/         # 主服务入口 + Wiring (依赖注入)
│   ├── main.go
│   ├── config.go
│   ├── router.go
│   ├── wiring.go           # DI 组装
│   ├── core_infra_wiring.go
│   ├── cicd_domain_wiring.go
│   ├── pipeline_wave_wiring.go
│   ├── blueprint_batch_wiring.go
│   └── notification_auth_wiring.go
├── audit-cli/      # 审计 CLI 工具
│   ├── main.go
│   ├── commands/   # data_compare, report, schema_check, source_audit
│   ├── output/formatter.go
│   └── types/
└── pipeline-engine/ # 独立 Pipeline 引擎
    └── main.go

internal/           # 170+ 业务域 (handler/service/repository/models)
pkg/                # 公共工具包
├── idempotency/    # 幂等性 (15 files, 含完整测试)
└── nats/           # NATS 订阅

test/               # 测试套件
├── benchmark/      # 性能基准
├── integration/    # 集成测试 (auth + pipeline)
└── e2e/            # 端到端测试 (auth)
```

### 2.2 Wiring (依赖注入) 系统

`cmd/server/wiring.go` 采用**显式 DI 组装模式**，将所有域的服务通过 `NewService(NewRepository(db))` 模式组合，支持接口注入用于测试 mock。

### 2.3 全量内部域分析 (170+ 域)

按业务类别分组，每个域遵循 `handler → service → repository → models` 四层架构：

#### 2.3.1 认证与授权 (6 域)

| 域 | Go 文件 | 功能 | 备注 |
|----|---------|------|------|
| `auth` | 8 | 登录/注册/刷新/登出/个人 | JWT 双路由 (public + protected) |
| `auth-enhanced` | 8 | 增强认证 | 扩展认证能力 |
| `auth-mfa` | 7 | 多因素认证 | MFA 支持 |
| `sso` | 7 | 单点登录 | SSO 协议集成 |
| `sso-providers` | 7 | SSO 提供者管理 | 多 SSO 后端 |
| `sso-unified` | 7 | 统一 SSO | 统一 SSO 抽象 |

**代码质量**: Handler 层使用 `AuthService` 接口隔离，支持 mock 测试。权限中间件基于 `auth.RequirePermission(resource, action)`。

#### 2.3.2 用户与租户管理 (13 域)

| 域 | Go 文件 | 功能 |
|----|---------|------|
| `user` | 7 | 用户 CRUD |
| `user-activity` | 7 | 用户活动追踪 |
| `user-profile` | 7 | 用户档案 |
| `user-status` | 7 | 用户状态管理 |
| `user-token` | 7 | 用户令牌管理 |
| `tenant` | 8 | 租户 CRUD + 配额 + 命名空间 |
| `tenant-gateway` | 7 | 租户网关 |
| `role` | 7 | 角色管理 |
| `permission` | 6 | 权限管理 |
| `permission-audit` | 6 | 权限审计 |
| `team` | 8 | 团队管理 |
| `session` | 7 | 会话管理 |
| `abac-policy` | 7 | ABAC 策略 |

**代码质量**: `tenant` 域使用 `RepositoryInterface` 定义 26+ 方法（CRUD + 配额 + 命名空间 + 迁移），`map[string]any` 返回类型需关注类型安全。

#### 2.3.3 AI 相关 (11 域)

| 域 | Go 文件 | 功能 |
|----|---------|------|
| `ai` | 5 | AI 基础配置 |
| `ai-gateway` | 8 | AI 网关路由/代理 |
| `ai-agents` | 9 | AI 代理注册/管理 |
| `ai-models` | 8 | AI 模型管理 |
| `ai-inference` | 3 | AI 推理代理 |
| `ai-cost` | 8 | AI 成本追踪 |
| `ai-decisions` | 8 | AI 决策引擎 |
| `ai-degradation` | 8 | AI 降级策略 |
| `ai-review` | 8 | AI 代码审查 |
| `ai-security` | 8 | AI 安全 (提示注入检测等) |
| `mlops` | 6 | MLOps 管线 |

**代码质量**: `ai-gateway` Handler 使用 `gin.RouterGroup` 注册路由，所有路由均有 `auth.RequirePermission` 守卫。`ai-agents` 有 agentregistry 子包支持代理注册。`ai-security` 包含提示注入检测功能。

#### 2.3.4 CI/CD 与 Pipeline (22 域)

| 域 | Go 文件 | 功能 |
|----|---------|------|
| `pipeline-engine` | 12 | Pipeline 执行引擎 (核心) |
| `pipeline` | 6 | Pipeline 定义 CRUD |
| `pipeline-template` | 7 | Pipeline 模板 |
| `pipeline-templates` | 7 | Pipeline 模板库 |
| `pipeline-version` | 6 | Pipeline 版本管理 |
| `pipeline-versions` | 7 | Pipeline 版本历史 |
| `pipeline-run-history` | 7 | 运行历史 |
| `pipeline-graph` | 7 | DAG 图 |
| `pipeline-sse` | 7 | SSE 实时推送 |
| `pipeline-budget` | 7 | 预算管控 |
| `pipeline-error-detail` | 7 | 错误详情 |
| `pipeline-execution-control` | 6 | 执行控制 |
| `pipeline-batch` | 6 | 批量执行 |
| `pipeline-batch-operations` | 6 | 批量操作 |
| `pipeline-audit-log` | 6 | 审计日志 |
| `pipeline-trend` | 6 | 趋势分析 |
| `autonomous-pipeline` | 7 | 自主 Pipeline |
| `build` | 7 | 构建管理 |
| `build-env` | 7 | 构建环境 |
| `deploy` | 8 | 部署管理 |
| `deploy-enhanced` | 7 | 增强部署 |
| `deployment-trigger` | 7 | 部署触发器 |

**代码质量**: `pipeline-engine` 是核心引擎域 (12 files)，使用 `PipelineEngine` 服务接口。支持 SSE 实时推送、DAG 图、预算管控。`deploy` 域支持回滚、审计追踪、发布说明、Git commit 关联。

#### 2.3.5 部署与基础设施 (14 域)

| 域 | Go 文件 | 功能 |
|----|---------|------|
| `environment` | 8 | 环境管理 |
| `env-lifecycle` | 6 | 环境生命周期 |
| `env-profile` | 6 | 环境配置 |
| `ephemeral-env` | 6 | 临时环境 |
| `cluster` | 4 | K8s 集群管理 |
| `serverless` | 7 | Serverless 函数 |
| `multi-cloud` | 6 | 多云管理 |
| `iac` | 7 | IaC 管理 |
| `container` | — | 容器管理 |
| `network` | 4 | 网络管理 |
| `storage` | 5 | 存储管理 |
| `canary-analysis` | 8 | 金丝雀分析 |
| `canary-traffic` | 7 | 金丝雀流量 |
| `smart-deploy` | 7 | 智能部署 |

#### 2.3.6 监控与可观测性 (10 域)

| 域 | Go 文件 | 功能 |
|----|---------|------|
| `monitoring` | 8 | 监控核心 |
| `observability` | 6 | 可观测性 |
| `apm` | 8 | APM 性能监控 |
| `metrics` | 6 | 指标采集 |
| `tracing` | 7 | 链路追踪 |
| `llm-trace` | 6 | LLM 调用追踪 |
| `logging` | 5 | 日志管理 |
| `health-check` | 6 | 健康检查 |
| `diagnostic` | 7 | 诊断 |
| `performance` | 6 | 性能分析 |

#### 2.3.7 安全与合规 (8 域)

| 域 | Go 文件 | 功能 |
|----|---------|------|
| `security` | 8 | 安全扫描 (Trivy) |
| `security-compliance` | 8 | 安全合规 |
| `vulnerability` | 7 | 漏洞管理 |
| `sbom` | 8 | SBOM 物料清单 |
| `supply-chain` | 7 | 供应链安全 |
| `compliance` | 7 | 合规管理 |
| `policy` | 9 | 策略管理 |
| `governance` | 7 | 治理 |

**代码质量**: `security` 域集成 Trivy CLI 进行扫描 (`os/exec` 调用)，定义了 `RepositoryInterface` 用于漏洞 CRUD + CVE 查询。

#### 2.3.8 告警与通知 (8 域)

| 域 | Go 文件 | 功能 |
|----|---------|------|
| `alert` | 8 | 告警核心 |
| `alert-breaker` | 7 | 告警熔断 |
| `notification` | 7 | 通知管理 |
| `notification-management` | 6 | 通知管理增强 |
| `notification-policy` | 6 | 通知策略 |
| `notification-template` | 6 | 通知模板 |
| `scheduled-notification` | 7 | 定时通知 |
| `escalation` | 7 | 告警升级 |

#### 2.3.9 配置与参数 (8 域)

| 域 | Go 文件 | 功能 |
|----|---------|------|
| `config` | 7 | 配置管理 |
| `config-mgmt-enhanced` | 8 | 配置管理增强 |
| `global-param` | 6 | 全局参数 |
| `feature-flag` | 8 | 功能开关 |
| `unified-config` | 7 | 统一配置 |
| `secret` | 7 | 密钥管理 |
| `middleware-ops` | 6 | 中间件运维 |
| `capability` | 9 | 能力管理 |

#### 2.3.10 工单与事件 (8 域)

| 域 | Go 文件 | 功能 |
|----|---------|------|
| `ticketing` | 15 | 工单系统 (核心) |
| `ticket-automation` | 7 | 工单自动化 |
| `ticket-knowledge` | 7 | 工单知识库 |
| `incident` | 6 | 事件管理 |
| `incident-action` | 6 | 事件操作 |
| `problem` | 7 | 问题管理 |
| `change` | 7 | 变更管理 |
| `change-request` | 7 | 变更请求 |

**代码质量**: `ticketing` 是平台中最大的域之一 (15 files)，支持工单 CRUD + 自动化 + 知识关联。

#### 2.3.11 数据平台 (7 域)

| 域 | Go 文件 | 功能 |
|----|---------|------|
| `data-catalog` | 7 | 数据目录 (含 introspector) |
| `data-lineage` | 8 | 数据血缘 |
| `data-pipeline` | 8 | 数据管线 |
| `data-quality` | 11 | 数据质量 (含 engine 子包) |
| `vector` | 7 | 向量管理 |
| `vector-store` | 8 | 向量存储 |
| `vectorize-rules` | 7 | 向量化规则 |

#### 2.3.12 工作流与编排 (6 域)

| 域 | Go 文件 | 功能 |
|----|---------|------|
| `workflow` | 8 | 工作流定义/执行 |
| `workflow-task` | 7 | 工作流任务 |
| `workflow-trigger` | 7 | 工作流触发器 |
| `workflow-dependency` | 7 | 工作流依赖 |
| `workflow-webhook` | 7 | 工作流 Webhook |
| `saga` | 11 | Saga 事务补偿 |

**代码质量**: `workflow` 支持分页列表、执行追踪。`saga` 提供分布式事务补偿机制 (11 files)。

#### 2.3.13 项目管理 (7 域)

| 域 | Go 文件 | 功能 |
|----|---------|------|
| `project` | 6 | 项目管理 |
| `project-member` | 7 | 项目成员 |
| `sprint` | 8 | 冲刺管理 |
| `product-line` | 7 | 产品线 |
| `efficiency` | 11 | 效能度量 |
| `report-designer` | 7 | 报表设计器 |
| `bi-dashboard` | 7 | BI 仪表盘 |

#### 2.3.14 应用与模块 (6 域)

| 域 | Go 文件 | 功能 |
|----|---------|------|
| `application` | 22 | 应用管理 (含 commands/queries/saga/http) |
| `module` | 6 | 模块管理 |
| `subapp` | 8 | 子应用 |
| `service-catalog` | 9 | 服务目录 |
| `service-registry` | 8 | 服务注册 |
| `service-health` | 7 | 服务健康 |
| `service-topology` | 7 | 服务拓扑 |

**代码质量**: `application` 是最大域 (22 files)，包含 CQRS (commands/queries) + Saga + HTTP 层。

#### 2.3.15 插件与扩展 (5 域)

| 域 | Go 文件 | 功能 |
|----|---------|------|
| `plugin` | 13 | 插件系统 |
| `plugin-hotreload` | 6 | 插件热加载 |
| `webhook` | 13 | Webhook 管理 |
| `gateway-dynamic` | 11 | 动态网关 |
| `handler-registry` | 7 | Handler 注册 |

#### 2.3.16 混沌工程与韧性 (6 域)

| 域 | Go 文件 | 功能 |
|----|---------|------|
| `chaos` | 7 | 混沌工程核心 |
| `chaos-enhanced` | 7 | 增强混沌 |
| `chaos-gateway` | 7 | 混沌网关 |
| `circuit-breaker` | 7 | 熔断器 |
| `degradation` | 7 | 服务降级 |
| `resilience-score` | 7 | 韧性评分 |

#### 2.3.17 消息与事件 (4 域)

| 域 | Go 文件 | 功能 |
|----|---------|------|
| `eventbus` | 8 | 事件总线 |
| `event-trigger` | 6 | 事件触发 |
| `event-trigger-registry` | 6 | 事件触发注册 |
| `message-queue` | 6 | 消息队列 |

#### 2.3.18 其他业务域

| 域 | Go 文件 | 功能 |
|----|---------|------|
| `bi-dashboard` | 7 | BI 仪表盘 |
| `billing` | 8 | 计费 |
| `cost-allocation` | 8 | 成本分摊 |
| `financial` | — | 财务 |
| `finops` | 7 | FinOps |
| `finops-v2` | 7 | FinOps v2 |
| `capacity` | 7 | 容量规划 |
| `backup` | 7 | 备份 |
| `disaster-recovery` | 7 | 灾备 |
| `digital-twin` | 8 | 数字孪生 |
| `digital-twin-simulation` | 8 | 数字孪生仿真 |
| `knowledge` | 6 | 知识管理 |
| `cron` | 8 | 定时任务 |
| `channel` | 7 | 渠道管理 |
| `community` | 7 | 社区 |
| `community-advanced` | 8 | 高级社区 |
| `approval` | 7 | 审批 |
| `contract` | 7 | 合同管理 |
| `artifact` | 8 | 制品管理 |
| `artifact-lifecycle` | 7 | 制品生命周期 |
| `artifact-ops` | 7 | 制品运维 |
| `artifact-version` | 7 | 制品版本 |
| `apk-upload-history` | 7 | APK 上传历史 |
| `api-consumption` | 7 | API 消费 |
| `api-governance` | 7 | API 治理 |
| `api-key` | 7 | API 密钥 |
| `api-market` | 7 | API 市场 |
| `audit` | 9 | 审计日志 |
| `branch-policy` | 7 | 分支策略 |
| `cache` | 8 | 缓存管理 |
| `cache-cleanup` | 7 | 缓存清理 |
| `change-intelligence` | 7 | 变更智能 |
| `code-repo` | 7 | 代码仓库 |
| `confirmation` | 7 | 确认管理 |
| `cross-domain` | 7 | 跨域管理 |
| `decision-explanation` | 7 | 决策解释 |
| `dependency-coordination` | 7 | 依赖协调 |
| `developer-portal` | 9 | 开发者门户 |
| `do-not-disturb` | 7 | 免打扰 |
| `dual-engine` | 7 | 双引擎 |
| `env-profile` | 6 | 环境配置 |
| `federation` | 8 | 联邦管理 |
| `global-param` | 6 | 全局参数 |
| `health-check` | 6 | 健康检查 |
| `hook-chain` | 6 | Hook 链 |
| `i18n` | 7 | 国际化 |
| `integration` | 6 | 集成 |
| `internal-library` | 7 | 内部库 |
| `inspection` | 6 | 检查 |
| `lowcode` | 6 | 低代码 |
| `maintenance-window` | 6 | 维护窗口 |
| `mcp` | 6 | MCP 协议 |
| `metadata` | 6 | 元数据 |
| `middleware` | 7 | 中间件 |
| `multi-modal-trigger` | 7 | 多模态触发 |
| `oci-registry` | 7 | OCI 注册表 |
| `oncall` | 7 | 值班管理 |
| `page-registry` | 7 | 页面注册 |
| `process-step` | 6 | 流程步骤 |
| `privacy` | 6 | 隐私 |
| `progressive` | 6 | 渐进式交付 |
| `queue` | 9 | 队列 |
| `runbook` | 7 | 运维手册 |
| `risk` | 7 | 风险管理 |
| `sandbox` | 6 | 沙箱 |
| `self-healing` | 7 | 自愈 |
| `self-service` | 7 | 自助服务 |
| `skill` | 5 | 技能管理 |
| `sla` | 7 | SLA 管理 |
| `slo` | 7 | SLO 管理 |
| `terminal-audit` | 7 | 终端审计 |
| `test-generation` | 7 | 测试生成 |
| `test-selector` | 8 | 测试选择器 |
| `topology` | 7 | 拓扑 |
| `ueba` | 7 | UEBA 用户行为分析 |
| `version-archive` | 7 | 版本归档 |
| `visor-exec` | 7 | Visor 执行 |
| `workbench` | 8 | 工作台 |
| `domain` | 19 | 领域模型 (aggregates/commands/events/eventstore/readmodel) |
| `infrastructure` | 16 | 基础设施层 |
| `lock` | 1 | 分布式锁 (最小域) |

---

## 3. 蓝图微服务 (blueprints/)

> **总计**: 70+ 蓝图目录 | **Go 模块**: 24 个 | **Node 模块**: 45 个 | **Rust 模块**: 1 个

### 3.1 Go 蓝图 (有 go.mod, 含实际代码)

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

### 3.2 Node.js/TypeScript 蓝图 (有 package.json, 含实际代码)

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

### 3.3 Rust 蓝图

| 蓝图 | 文件 | 功能 |
|------|------|------|
| `orion-security-svc-rust` | 8 | 安全服务 (Rust 版) |

### 3.4 空白蓝图 (无代码, 仅有目录)

以下 36 个蓝图目录仅有目录结构，无实际代码文件：

`orion-security-svc`, `orion-runner-svc`, `orion-risk-svc`, `orion-plugin-svc`, `orion-platform-core`, `orion-pipeline-svc`(Go), `orion-pandawiki-svc`(Go), `orion-notify-svc`(Go), `orion-monitor-svc`(Go), `orion-llm-trace-svc-py`, `orion-llm-svc`(Go), `orion-knowledge-svc-py`, `orion-knowledge-svc`(Go), `orion-inception-svc`(Go), `orion-graph-svc`(Go), `orion-governance-svc`(Go), `orion-finops-svc`(Go), `orion-federation-svc`(Go), `orion-efficiency-svc`(Go), `orion-dr-svc`(Go), `orion-digital-twin-svc`(Go), `orion-deploy-svc`(Go), `orion-dba-svc`(Go), `orion-db`(Go), `orion-config-mgmt-svc`(Go), `orion-community-svc`(Go), `orion-code-svc`(Go), `orion-cmdb-svc`(Go), `orion-chatops-svc`(Go), `orion-audit-svc`(Go), `orion-artifact-svc`(Go), `orion-approval-svc`(Go), `orion-ai-svc`(Go), `orion-agent-svc`(Go)

### 3.5 蓝图代码质量分析

**Go 蓝图通用模式**:
- 所有 Go 蓝图遵循 `cmd/server/main.go → internal/{domain}/{handler,service,repository,models,config}` 结构
- 每个 domain 有 `response_writer.go` 统一响应格式
- 大多数域有 `config/config.go` 独立配置
- 使用 NATS 进行服务间通信 (`pkg/nats/subscriber.go`)
- `go:generate mockgen` 支持测试 mock

**Node 蓝图通用模式**:
- 基于 Express.js/Koa 框架
- 使用 TypeScript
- 独立 package.json

---

## 4. 独立服务 (Standalone Services)

### 4.1 orion-ai-service (Python FastAPI)

| 属性 | 值 |
|------|-----|
| 语言 | Python 3.14 |
| 框架 | FastAPI |
| 源码文件 | 66 |
| 测试 | 19 个测试文件 |

**架构**:
```
src/
├── main.py           # FastAPI 入口 + NATS 订阅 + 事件处理
├── config.py         # 配置
├── events/           # NATS 事件处理器
│   ├── subscriber.py  # NATS 订阅
│   └── ...            # handle_code_pr_opened, handle_pipeline_run_completed
├── api/              # API 路由
│   ├── ai_routes.py
│   ├── inference_routes.py
│   └── mlops_routes.py
├── models/           # 数据模型
│   ├── ai_models.py, ai_gateway_models.py
│   ├── mlops_models.py, training_models.py
│   ├── metric_models.py, trace.py, vector_types.py
│   ├── review.py, ml.py
│   └── prompt_security_models.py, training.py
├── services/         # 业务服务
│   └── ai_service.py
└── repositories/     # 数据仓库
    ├── ai_result_repository.py
    ├── llm_trace_repository.py
    └── metric_storage_repository.py
```

**测试覆盖**: 包含 19 个测试文件 (conftest, metric_collector, circuit_breaker, cost_optimizer, code_review, training, llm_trace, api_routes, config, models, decision_service, events, ai_service, mlops, vector_store, inference_service)。

### 4.2 orion-ai-agents-svc (Python FastAPI)

| 属性 | 值 |
|------|-----|
| 语言 | Python 3.14 |
| 框架 | FastAPI + OpenTelemetry |
| 源码文件 | 2224 (含 venv) |

**架构**:
```
app/
├── main.py           # FastAPI 入口 + OTel 配置
├── config.py         # 配置
├── dependencies.py   # 依赖注入
├── api/              # API 路由
│   └── agent_routes.py
├── models/           # 数据模型
│   └── agent.py
├── schemas/          # Pydantic Schema
│   └── agent.py
├── services/         # 业务服务
│   └── agent_service.py
└── repositories/     # 数据仓库
    └── agent_repo.py
```

**特性**: 集成 OpenTelemetry 分布式追踪 (TracerProvider + BatchSpanProcessor + InMemorySpanExporter)。

### 4.3 orion-intelligence-svc (Python FastAPI)

| 属性 | 值 |
|------|-----|
| 语言 | Python 3.14 |
| 框架 | FastAPI + Alembic |
| 源码文件 | 3940 |

**架构**:
```
src/
├── main.py           # FastAPI 入口
├── api/              # 8 个 API 路由
│   ├── classify.py       # 分类
│   ├── code_review.py    # 代码审查
│   ├── predict_sla.py    # SLA 预测
│   ├── root_cause.py     # 根因分析
│   ├── sentiment.py      # 情感分析
│   ├── solution.py       # 方案生成
│   ├── summarize.py      # 摘要
│   └── dependencies.py
├── services/         # AI 服务
│   ├── ai_service.py
│   └── llm_client.py
└── models/           # 数据模型
alembic/              # 数据库迁移
config/               # 配置
tests/                # 测试
```

**功能**: 提供 7 种 AI 分析能力 (分类/代码审查/SLA预测/根因分析/情感分析/方案生成/摘要)。

### 4.4 orion-runner-agent (Node.js TypeScript)

| 属性 | 值 |
|------|-----|
| 语言 | TypeScript |
| 源码文件 | 2 |
| 配置 | runner.example.json |

**功能**: 极简 Runner Agent，仅 2 个文件 (index.ts + TaskExecutor.ts)。用于执行远程任务。

---

## 5. 前端应用 (Frontend)

### 5.1 orion-frontend (React + TypeScript + Vite)

| 属性 | 值 |
|------|-----|
| 框架 | React 19 + Vite |
| UI 库 | Ant Design |
| TSX/TS 文件 | 1223 |
| 页面数 | 150+ |

**架构**:
```
src/
├── App.tsx                    # 应用根组件 (仅路由)
├── main.tsx                   # 入口 (含微前端/HMR/Auth/Theme)
├── router/                    # 路由配置
├── pages/                     # 150+ 页面
│   ├── DashboardCore/         # 核心仪表盘
│   ├── Pipeline*              # Pipeline 系列页面
│   ├── Agent*                 # Agent 系列页面
│   ├── AI*                    # AI 系列页面
│   ├── Deploy*                # 部署系列页面
│   ├── Security*              # 安全系列页面
│   ├── ...                    # 覆盖所有后端域
├── components/                # 50+ 共享组件
│   ├── DAGGraph/              # DAG 图
│   ├── Chart/                 # 图表
│   ├── PermissionGuard/       # 权限守卫
│   ├── TenantSelector/        # 租户选择器
│   ├── SubAppLauncher/        # 子应用启动器
│   ├── Lowcode/               # 低代码组件
│   ├── VirtualList/           # 虚拟列表
│   └── ...
├── hooks/                     # 自定义 Hooks
├── stores/                    # 状态管理 (Pinia/Zustand)
├── api/                       # API 层
├── types/                     # TypeScript 类型
├── utils/                     # 工具函数
├── tokens/                    # 设计令牌 (theme/colors/spacing)
├── microfront/                # 微前端配置
└── websocket/                 # WebSocket 连接
```

**设计系统**: 使用 CSS Variables 实现完整设计令牌 (colors/spacing/typography/radius/shadows)，支持主题切换。

**微前端**: 支持微前端加载 (`initMicroFrontend`, `cleanupMicroFrontend`)，HMR 时模块热替换。

**测试**: 使用 Vitest + Playwright (含 e2e)。

### 5.2 orion-visor/orion-visor-ui (Vue 3 + Vite)

| 属性 | 值 |
|------|-----|
| 框架 | Vue 3 + Vite |
| Vue 文件 | 291 |
| TS 文件 | 298 |

**架构**:
```
src/
├── views/                    # 页面
│   ├── terminal/             # 终端
│   ├── asset/                # 资产管理
│   ├── exec/                 # 命令执行
│   ├── monitor/              # 监控
│   ├── system/               # 系统管理
│   ├── user/                 # 用户管理
│   └── dashboard/            # 仪表盘
├── components/               # 组件
│   ├── xterm/                # xterm 终端组件
│   ├── monitor/              # 监控组件
│   └── ...
├── api/                      # API 层 (asset/exec/meta/monitor/statistics/system/terminal/user)
├── store/                    # Vuex
├── router/                   # 路由 (含 guard)
├── directive/                # 自定义指令 (focus/permission)
├── locale/                   # 国际化
└── utils/                    # 工具
```

**特性**: 集成 Guacamole (远程控制), xterm.js (终端), 支持多配置 (base/dev/prod/micro-frontend)。

### 5.3 orion-knowledge/web (双前端)

#### 5.3.1 App (Next.js + MUI)

| 属性 | 值 |
|------|-----|
| 框架 | Next.js |
| UI 库 | MUI |
| TS 文件 | 154 |

**架构**: `src/app/` (App Router) + `src/components/` + `src/hooks/` + `src/provider/` + `src/request/` + `src/utils/` + `src/views/`

#### 5.3.2 Admin (Vite + Vue 3)

| 属性 | 值 |
|------|-----|
| 框架 | Vite + Vue 3 |
| TS 文件 | 545 |

**架构**: `src/api/` + `src/components/` + `src/hooks/` + `src/layouts/` + `src/pages/` + `src/request/` + `src/services/` + `src/store/` + `src/themes/` + `src/utils/`

### 5.4 orion-dba/frontend (Vue 3 + Vite)

| 属性 | 值 |
|------|-----|
| 框架 | Vite + Vue 3 |
| 功能 | 数据库管理 |

**架构**: `src/apis/` + `src/components/` (chartCard/editor/listApp/menu/steps/table/user) + `src/config/` + `src/lang/` (en-us/zh-cn) + `src/lib/` + `src/mixins/` + `src/socket/` + `src/store/` + `src/views/` (advisor/analysis/apply/config/home/layout/login/manager/query/record/server)

---

## 6. API 网关 (orion-api-gateway)

> **语言**: TypeScript | **框架**: Express.js | **文件**: 92

### 6.1 架构

```
src/
├── index.ts              # 入口
├── app.ts                # Express App
├── config/               # 配置
│   ├── index.ts
│   └── gray-config.ts    # 灰度配置
├── middleware/           # 中间件 (14 个)
│   ├── auth.ts           # JWT 认证
│   ├── permission.ts     # 权限校验
│   ├── tenant.ts         # 租户隔离
│   ├── version.ts        # API 版本
│   ├── proxy.ts          # 反向代理
│   ├── health.ts         # 健康检查
│   ├── logging.ts        # 日志
│   ├── error.ts          # 错误处理
│   ├── csp.ts            # CSP 安全头
│   ├── gray-route.ts     # 灰度路由
│   ├── subAppAuthAdapter.ts # 子应用认证适配
│   └── token-exchange.ts # Token 交换
├── routes/               # 路由 (14 个)
│   ├── index.ts
│   ├── api.ts            # 聚合路由
│   ├── auth.routes.ts
│   ├── ai-decisions.routes.ts
│   ├── ai-degradation.routes.ts
│   ├── ai-models.routes.ts
│   ├── chaos.routes.ts
│   ├── digital-twin.routes.ts
│   ├── governance.routes.ts
│   ├── pipeline-budget.routes.ts
│   ├── pipeline-templates.routes.ts
│   ├── pipeline-versions.routes.ts
│   ├── resilience-score.routes.ts
│   ├── sbom.routes.ts
│   ├── tenant.routes.ts
│   └── version.ts
├── services/             # 服务层
│   ├── auth/             # ABAC/DeviceFingerprint/TokenRefreshGuard
│   ├── rbac.service.ts
│   ├── tenant-quota.service.ts
│   ├── service-client.ts
│   ├── service-registry.ts
│   ├── gateway-dynamic-routes.ts
│   ├── gateway-route-sync.ts
│   ├── gray-release.service.ts
│   ├── module-routing.ts
│   ├── namespace-pool.service.ts
│   ├── pandawiki-token.ts
│   ├── token.service.ts
│   ├── token-blacklist-checker.ts
│   ├── ApiVersionManager.ts
│   └── ApiVersionRegistry.ts
├── routing/              # 路由管理
│   ├── index.ts
│   └── grayscale.ts
├── websocket/            # WebSocket (5 个文件)
│   ├── ws-server.ts      # WS 服务器
│   ├── ws-auth.ts        # WS 认证
│   ├── ws-heartbeat.ts   # 心跳
│   ├── ws-proxy.ts       # WS 代理
│   └── ws-errors.ts      # WS 错误
├── errors/               # 错误定义
│   ├── base-error.ts
│   ├── error-codes.ts
│   └── index.ts
└── utils/                # 工具
    ├── index.ts
    ├── pagination.ts
    └── redis.ts
```

### 6.2 特性

- **多层鉴权**: JWT + RBAC + ABAC + 设备指纹
- **灰度发布**: 支持按租户/版本灰度路由
- **Token 管理**: 刷新守卫 + 黑名单检查 + 交换
- **WebSocket**: 完整的 WS 代理 (认证/心跳/错误)
- **动态路由**: 服务注册表 + 动态路由同步
- **测试覆盖**: 25+ 测试文件

---

## 7. Go 公共库 (orion-go-common)

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

**特性**: 提供完整的平台基础能力，包括 RBAC/ABAC 双重授权、审计链不可篡改、DAG 图、幂等性、SSE 推送、插件 SPI。

---

## 8. SDK (orion-sdk)

### 8.1 Python SDK

| 属性 | 值 |
|------|-----|
| 包 | `orion` |
| 文件 | 8 |

**模块**: `client.py` (HTTP 客户端) + `agents.py` (Agent SDK) + `pipelines.py` (Pipeline SDK) + `integrations.py` (集成 SDK) + `diagnostics.py` (诊断 SDK)

### 8.2 TypeScript SDK

| 属性 | 值 |
|------|-----|
| 包 | `orion-sdk` |
| 文件 | 7 |

**模块**: `client.ts` + `agents.ts` + `pipelines.ts` + `integrations.ts` + `diagnostics.ts`

**测试**: TypeScript SDK 有 `__tests__/client.test.ts`。

---

## 9. 知识库服务 (orion-knowledge)

> **Go 后端**: 262 files | **Web App**: Next.js (154 TS) | **Web Admin**: Vite+Vue (545 TS)

### 9.1 Go 后端架构

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
├── middleware/           # 中间件
│   ├── auth.go           # 认证
│   ├── jwt.go            # JWT
│   ├── tenant.go         # 租户
│   ├── orion_permission.go # 权限
│   ├── session.go        # 会话
│   ├── api_token.go      # API Token
│   ├── share_auth.go     # 分享认证
│   └── provider.go       # 中间件工厂
├── domain/               # 领域模型 (12+ 子域)
│   ├── knowledge/        # 知识库
│   ├── rag/              # RAG
│   ├── conversation/     # 对话
│   ├── crawler/          # 爬虫
│   ├── node/             # 节点
│   ├── user/             # 用户
│   ├── auth/             # 认证
│   ├── share/            # 分享
│   ├── bot/              # 机器人
│   ├── stats/            # 统计
│   └── ...
├── pkg/                  # 工具包
│   ├── anydoc/           # 文档处理
│   ├── bot/              # 多平台机器人 (dingtalk/discord/feishu/lark/wechat/official_account/service_account)
│   └── ...
├── mq/                   # 消息队列 (NATS)
├── migration/            # 数据库迁移
│   ├── manager.go
│   ├── provider.go
│   ├── func.go
│   └── fns/              # 迁移函数
├── apm/                  # APM 追踪
├── config/               # 配置
├── consts/               # 常量
│   ├── auth.go, consts.go, system_setting.go, license.go, app.go,
│   ├── admin.go, model.go, captcha.go, crawler.go, contribute.go,
│   ├── node.go, parse.go
├── contextkey/           # Context Key
├── docs/                 # Swagger 文档
├── log/                  # 日志
├── setup/                # 初始化 (证书等)
└── utils/                # 工具函数
    ├── time.go, feed.go, processor.go, DFA.go, utils.go, file.go, ip_addr.go, epub.go
```

**特性**: Echo 框架 + Swagger 文档 + 多平台机器人 (6 个平台) + 文档处理 (anydoc) + RAG。

---

## 10. DBA 工具 (orion-dba)

> **Go 后端**: ~200 files | **Vue 前端**: ~70 files

### 10.1 Go 后端

```
backend/
├── cmd/main.go           # 入口
├── router/router.go      # 路由
├── handler/              # 处理器 (dashboard)
├── apis/                 # API (query/fetch/dash)
├── model/                # 模型 (global/db/subModel/modal/impl)
├── service/              # 服务 (cron/migrate/yearning)
├── engine/engine.go      # 引擎
└── i18n/                 # 国际化 (cn/us)
```

### 10.2 Vue 前端

```
frontend/src/
├── apis/                 # API 层
├── components/           # 组件 (chartCard/editor/listApp/menu/steps/table/user)
├── config/               # 配置
├── lang/                 # 国际化 (en-us/zh-cn)
├── lib/                  # 库
├── mixins/               # Mixins
├── socket/               # WebSocket
├── store/                # Vuex
├── style/                # 样式
├── types/                # 类型
└── views/                # 页面
    ├── advisor/          # 顾问
    ├── analysis/         # 分析
    ├── apply/            # 申请
    ├── config/           # 配置
    ├── home/             # 首页
    ├── layout/           # 布局
    ├── login/            # 登录
    ├── manager/          # 管理
    ├── query/            # 查询
    ├── record/           # 记录
    └── server/           # 服务器
```

---

## 11. Visor 运维 (orion-visor)

> **Vue 前端**: 589 files (291 Vue + 298 TS)

完整堡垒机/运维管理界面，集成 Guacamole (远程桌面) + xterm.js (终端)。

---

## 12. K8s 基础设施 (infrastructure/)

> **YAML 文件**: 234 | **部署模块**: 67

### 12.1 K8s 部署覆盖的服务

```
orion-ai-agents-svc, orion-ai-service, orion-approval-svc-go,
orion-artifact-svc-go, orion-audit-svc-go, orion-auth-svc-go,
orion-build-svc-go, orion-canary-svc-go, orion-capacity-svc-go,
orion-chaos-svc-go, orion-chatops-svc-go, orion-cmdb-svc-go,
orion-code-svc-go, orion-community-svc-go, orion-compliance-svc-go,
orion-config-mgmt-svc-go, orion-config-svc-go, orion-cron-svc-go,
orion-deploy-svc-go, orion-digital-twin-svc-go, orion-dr-svc-go,
orion-efficiency-svc-go, orion-event-bus-svc-go, orion-eventbus-svc-go,
orion-feature-flag-svc-go, orion-federation-svc-go, orion-finops-svc-go,
orion-governance-svc-go, orion-graph-svc-go, orion-inception-svc-go,
orion-incident-svc-go, orion-inspection-svc-go, orion-intelligence-svc-go,
orion-knowledge-svc-go, orion-llm-svc-go, orion-lowcode-svc-go,
orion-middleware-ops-svc-go, orion-monitor-svc-go, orion-notification-svc-go,
orion-notify-svc-go, orion-pandawiki-svc-go, orion-pipeline-svc-go,
orion-pipeline-template-svc-go, orion-plugin-svc-go, orion-report-designer-svc-go,
orion-risk-svc-go, orion-runner-svc-go, orion-scheduler-svc-go,
orion-secret-svc-go, orion-security-svc-go, orion-selfhealing-svc-go,
orion-skill-config-svc-go, orion-skill-svc-go, orion-ticket-svc-go,
orion-tool-svc-go, orion-user-svc-go, orion-visor-svc-go, orion-workflow-svc-go
```

### 12.2 每个 K8s 模块包含

- `deployment.yaml` - Deployment (replicas: 2, resource limits)
- `service.yaml` - Service
- `hpa.yaml` - HorizontalPodAutoscaler
- `configmap.yaml` - ConfigMap

### 12.3 通用模板

- `hpa-template.yaml` - HPA 模板
- `ingress-template.yaml` - Ingress 模板

**K8s 配置特征**:
- 所有服务使用 `orion` namespace
- 统一标签 (`app.kubernetes.io/name`, `app.kubernetes.io/part-of`)
- ConfigMap 管理配置 (DATABASE_URL, REDIS_ADDR, NATS_ADDR)
- Secret 管理敏感信息 (JWT_SECRET)
- 资源限制 (100m-500m CPU, 128Mi-512Mi Memory)
- 健康检查 (liveness/readiness probe on /healthz)

---

## 13. 部署配置 (deploy/)

| 文件 | 用途 |
|------|------|
| `prometheus/alert-rules.yaml` | Prometheus 告警规则 |
| `prometheus/alerts.yml` | Prometheus 告警配置 |
| `grafana/dashboards/orion-overview.json` | 总览仪表盘 |
| `grafana/dashboards/orion-tenant.json` | 租户仪表盘 |
| `grafana/dashboards/orion-service-metrics.json` | 服务指标仪表盘 |
| `grafana/dashboards/orion-service-health.json` | 服务健康仪表盘 |

---

## 14. 迁移脚本 (migrations/)

| 文件 | 用途 |
|------|------|
| `002_enable_rls.sql` | 启用 Row Level Security |
| `003_rbac_tables.sql` | RBAC 表结构 |

---

## 15. 工具集 (tools/)

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

---

## 16. 脚本集 (scripts/)

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

---

## 17. 文档体系 (docs/)

### 17.1 分析报告

| 文档 | 内容 |
|------|------|
| `orion-system-deep-analysis-2026-07-01.md` | 深度分析 |
| `system-truth-report-2026-07-01.md` | 系统真相报告 |
| `orion-system-full-analysis-report-2026-07-02.md` | 全量分析报告 |
| `orion-system-comprehensive-report-2026-07-02.md` | 综合报告 |
| `orion-system-complementary-analysis-2026-07-02.md` | 补充分析 |
| `document-four-way-comparison-2026-07-02.md` | 四向对比 |
| `document-progress-analysis-2026-07-02.md` | 文档进度 |
| `feature-completion-analysis-2026-07-08.md` | 功能完成度 |

### 17.2 设计文档

| 文档 | 内容 |
|------|------|
| `frontend-backend-mapping.md` | 前后端映射 |
| `module-completion-status-report.md` | 模块完成度 |
| `business-module-inventory.md` | 业务模块清单 |
| `ai-migration-plan-2026-07-02.md` | AI 迁移计划 |
| `implementation-plan-2026-07-02.md` | 实施计划 |
| `documentation-map-2026-07-02.md` | 文档地图 |
| `INDEX.md` | 文档索引 |

### 17.3 ADR (架构决策记录)

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

### 17.4 设计约束

- `design-constraints/README.md` - 设计约束文档

### 17.5 管理规范

- `文档管理规范.md` - 文档管理规范

---

## 18. 遗留系统 (legacy/)

```
legacy/
├── README.md
└── orion-platform-service-ts/   # 旧版 TypeScript 平台服务
    ├── Dockerfile
    ├── jest.config.js
    ├── jest.setup.js
    ├── fix-null-safety.js
    ├── PROGRESS-LOG.md
    └── seed-pipeline-data.sql
```

旧版 TypeScript 平台服务，已迁移至 Go。

---

## 19. 需求规范 (requirements/)

需求规范目录包含产品需求和验收标准，用于需求可追溯性追踪。

---

## 20. 汇总统计

### 20.1 代码规模

| 类别 | 文件数 | 代码行 |
|------|--------|--------|
| **Go** | ~2,200 | 595,737 |
| **Python** | ~4,000 | 532,387 |
| **TypeScript/JS** | ~1,800 | 704,639 |
| **Vue** | ~400 | 65,836 |
| **YAML (K8s)** | 234 | — |
| **SQL (Migrations)** | 2 | — |
| **总计** | ~8,600+ | ~1,898,599 |

### 20.2 模块分布

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

### 20.3 测试覆盖

| 模块 | 测试文件 | 测试类型 |
|------|----------|----------|
| platform-svc-go | 303 | unit |
| platform-svc-go | 10 | integration + e2e |
| ai-service | 19 | unit |
| api-gateway | 25+ | unit + integration |
| go-common | 20+ | unit + integration |

---

## 21. 关键发现与风险

### 21.1 架构优点

1. **清晰的六层架构**: `cmd → internal/{handler,service,repository,models} → pkg`
2. **显式 DI**: Wiring 模式便于测试和依赖管理
3. **接口隔离**: Handler/Service/Repository 层使用接口，支持 mock
4. **多租户设计**: 几乎所有 API 都有 `tenantID` 参数
5. **权限模型**: RBAC + ABAC 双重授权
6. **可观测性**: OpenTelemetry + APM + 分布式追踪
7. **事件驱动**: NATS 消息总线 + Saga 分布式事务
8. **幂等性**: 完整的幂等性中间件 (Redis + PostgreSQL)

### 21.2 风险与关注点

1. **重复代码**: 170+ 域中 handler/service/repository 高度同质化，部分可通过代码生成减少
2. **Blueprint 碎片化**: 70+ 蓝图中 36 个为空，24 个有 Go 代码但多数仅 10-20 文件，存在 Go/TS 双实现
3. **`map[string]any` 返回**: tenant 等域大量使用 `map[string]any` 而非强类型，影响类型安全
4. **K8s 配置**: 234 个 YAML 文件中大量重复模板，可进一步参数化
5. **遗留系统**: legacy/ 中旧 TS 服务已迁移但代码仍保留

---

*报告结束 — 全量 170+ 域 + 70+ 蓝图 + 6 独立服务 + 4 前端 + 全基础设施已覆盖*
