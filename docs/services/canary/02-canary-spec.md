# 金丝雀发布服务 Spec 文档

**生成日期**: 2026-07-03
**状态**: 编写中
**成熟度**: L1（初始定义）

---

## 一、服务定位

金丝雀发布服务（Canary Service）是 Orion 平台中负责应用增量发布和金丝雀分析的微服务。它提供从金丝雀部署创建、流量逐步迁移、多维度指标对比分析到自动决策（Promote/Rollback）的全生命周期管理。服务内置 ML 模型集成能力，支持 XGBoost / Random Forest / Logistic Regression 的模拟分析和基于 SHAP 的特征解释，同时提供 Istio VirtualService 和 NGINX Upstream 两种流量管理策略的配置下发。

**核心价值**：降低新版本上线的风险——通过逐步放量、实时指标对比和 ML 辅助决策，在影响范围可控的前提下验证新版本的稳定性，实现安全、自动化的灰度发布流程。

---

## 二、验收标准

| 编号 | 验收标准 | 优先级 | 验证方式 |
|------|---------|--------|---------|
| CS-01 | 支持创建金丝雀部署并返回完整实体（含 ID、时间戳），设置初始权重 | P0 | API 测试 |
| CS-02 | 支持按租户分页查询金丝雀部署列表，默认 page=1, page_size=20 | P0 | API 测试 |
| CS-03 | 支持按 ID 查询单个金丝雀部署详情 | P0 | API 测试 |
| CS-04 | 支持 Promote 操作：将 running 状态的金丝雀标记为 success 并记录完成时间 | P0 | API 测试 |
| CS-05 | 支持 Rollback 操作：将 running 状态的金丝雀标记为 rolled_back | P0 | API 测试 |
| CS-06 | 非 running 状态的金丝雀调用 Promote/Rollback 返回 500 + ErrInvalidStatus | P0 | 集成测试 |
| CS-07 | 支持按租户统计金丝雀部署总数 | P1 | API 测试 |
| CS-08 | 支持删除金丝雀部署（含外键级联关联数据） | P0 | API 测试 |
| CS-09 | 支持为金丝雀添加原始指标采样并查询 | P1 | API 测试 |
| CS-10 | 支持创建模拟分析运行：自动生成 4 个核心指标的统计结果（P99 延迟、错误率、吞吐量、CPU 利用率），含 Mann-Whitney U 检验 P 值、KS 统计量、Cliff's Delta | P0 | 集成测试 |
| CS-11 | 模拟分析运行完成后自动计算决策（promote/rollback/inconclusive）和置信度 | P0 | 集成测试 |
| CS-12 | 每次分析运行自动生成决策审计记录 | P0 | 集成测试 |
| CS-13 | 支持按 run ID 查询单个分析运行详情 | P1 | API 测试 |
| CS-14 | 支持按 deployment_id 或 status 维度查询分析运行列表 | P1 | API 测试 |
| CS-15 | 支持查询单次分析运行的指标结果和 ML 预测结果 | P1 | API 测试 |
| CS-16 | 支持查询累计分析运行统计摘要（总运行数、各状态计数、平均置信度、通过率） | P1 | API 测试 |
| CS-17 | 支持创建/读取/更新/删除分析配置（按 service_name+environment 唯一约束） | P0 | API 测试 |
| CS-18 | 分析配置支持设置间隔时间、最大轮次、预热周期、升降级阈值、流量步长、指标权重 | P0 | 集成测试 |
| CS-19 | 支持按 service_name+environment 查询单一分析配置 | P1 | API 测试 |
| CS-20 | 支持 Force Promote / Force Rollback 人工干预操作，覆盖自动分析结果 | P0 | API 测试 |
| CS-21 | Force 操作自动记录决策覆盖信息（overridden_by, override_reason） | P0 | 集成测试 |
| CS-22 | 支持流量管理：设置/查询/更新/删除流量配置 | P0 | API 测试 |
| CS-23 | 支持三种流量策略：weighted / istio / nginx | P0 | 集成测试 |
| CS-24 | Istio 策略：配置 Host、Baseline/Canary Destination、Subset、权重 | P0 | 集成测试 |
| CS-25 | NGINX 策略：配置 Upstream 名称、权重 | P0 | 集成测试 |
| CS-26 | 支持流量分步递增（+10%，最大 100%） | P1 | 集成测试 |
| CS-27 | 支持流量 Promote（Canary=100%）和 Rollback（Canary=0%）操作 | P0 | 集成测试 |
| CS-28 | 每次流量变更自动记录执行历史（含成功/失败、结果详情） | P1 | 集成测试 |
| CS-29 | 支持查询流量变更历史（按 canary_id） | P1 | API 测试 |
| CS-30 | 支持触发 ML 模型重训练作业并查询作业列表 | P2 | API 测试 |
| CS-31 | 支持查询可发现指标的列表（8 个预定义指标） | P2 | API 测试 |
| CS-32 | 所有 API 端点（除 healthz）均需经过 JWT 认证 | P0 | 集成测试 |
| CS-33 | 写操作端点需经过 RBAC 权限控制（canary:write / canary:execute / canary:delete） | P0 | 集成测试 |
| CS-34 | 所有列表接口支持按 tenant_id 隔离（从 JWT 提取） | P0 | 集成测试 |
| CS-35 | 服务启动时自动运行数据库迁移 | P0 | 部署测试 |
| CS-36 | 服务端口可通过配置变更，默认 8086 | P2 | 部署测试 |

---

## 三、API 设计

所有 API 以 `/api/v1` 为前缀，通过 Gin RouterGroup 注册。

### 辅助端点

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| GET | /healthz | 健康检查 | - | `{ "status": "ok" }` |

### 金丝雀部署 CRUD

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| POST | /api/v1/canaries | 创建金丝雀部署 | Body: `{ deployment_id (必填), service_name (必填), version (必填), weight (选填,默认10), target_weight (选填,默认100) }` | `201` + Canary 实体 |
| GET | /api/v1/canaries | 分页查询金丝雀列表 | Query: `page`(默认1), `page_size`(默认20,最大100) | `{ "data": [Canary...] }` |
| GET | /api/v1/canaries/count | 统计金丝雀总数 | - | `{ "count": int }` |
| GET | /api/v1/canaries/:id | 查询金丝雀详情 | Path: `id` | Canary 实体 |
| DELETE | /api/v1/canaries/:id | 删除金丝雀部署 | Path: `id` | `{ "message": "deleted" }` |

### 金丝雀操作

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| POST | /api/v1/canaries/:id/promote | Promote 金丝雀（running→success） | Path: `id` | `{ "message": "promoted" }` |
| POST | /api/v1/canaries/:id/rollback | Rollback 金丝雀（running→rolled_back） | Path: `id` | `{ "message": "rolled back" }` |

### 指标管理

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| POST | /api/v1/canaries/:id/metrics | 添加指标采样 | Path: `id`, Body: `{ metric_name, value, source, timestamp }` | `201` + CanaryMetric 实体 |
| GET | /api/v1/canaries/:id/metrics | 查询指标列表 | Path: `id` | `{ "data": [CanaryMetric...] }` |

### 分析运行

> 注意：分析运行的 API 路由当前在 handler.go 中没有注册为 /api/v1 下的独立路由组，但 service 层提供了完整实现。当前模拟运行通过 service 代码内部调用触发，后续需要补充对应的 HTTP 端点注册。

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| GET | /api/v1/canaries/analysis/metrics-summary | 查询全局分析运行统计摘要 | - | `MetricsSummary` |
| GET | /api/v1/canaries/metrics/discover | 查询可发现指标列表 | - | `[MetricInfo...]` |

### 分析配置 CRUD

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| GET | /api/v1/canaries/configs | 查询所有分析配置 | - | `[CanaryAnalysisConfig...]` |
| GET | /api/v1/canaries/configs/:service/:env | 查询指定服务+环境的分析配置 | Path: `service`, `env` | CanaryAnalysisConfig 实体 |
| POST | /api/v1/canaries/configs | 创建分析配置 | Body: `CanaryAnalysisConfigCreateInput` | `201` + CanaryAnalysisConfig 实体 |
| PUT | /api/v1/canaries/configs/:id | 更新分析配置 | Path: `id`, Body: `CanaryAnalysisConfigUpdateInput` | CanaryAnalysisConfig 实体 |
| DELETE | /api/v1/canaries/configs/:id | 删除分析配置 | Path: `id` | `204` |

### 流量管理

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| GET | /api/v1/canaries/traffic | 查询所有流量配置 | - | `[TrafficConfig...]` |
| GET | /api/v1/canaries/traffic/:canaryID | 查询指定金丝雀的流量配置 | Path: `canaryID` | TrafficConfig 实体 |
| POST | /api/v1/canaries/traffic/:canaryID | 设置流量规则 | Path: `canaryID`, Query: `baselineWeight`, `canaryWeight`, `strategy`, `host`, `namespace` | TrafficConfig 实体 |
| PUT | /api/v1/canaries/traffic/:canaryID | 更新流量配置 | Path: `canaryID`, Body: `TrafficConfigUpdateInput` | TrafficConfig 实体 |
| DELETE | /api/v1/canaries/traffic/:canaryID | 删除流量配置 | Path: `canaryID` | `204` |
| POST | /api/v1/canaries/traffic/:canaryID/increment | 流量递增（+10%） | Path: `canaryID` | TrafficConfig 实体 |
| POST | /api/v1/canaries/traffic/:canaryID/promote | 流量 Promote（→100%） | Path: `canaryID` | TrafficConfig 实体 |
| POST | /api/v1/canaries/traffic/:canaryID/rollback | 流量 Rollback（→0%） | Path: `canaryID` | TrafficConfig 实体 |
| POST | /api/v1/canaries/traffic/:canaryID/execute | 执行流量切分 | Path: `canaryID`, Query: `strategy`, `canaryPercent` | `TrafficSplitResult` |
| POST | /api/v1/canaries/traffic/:canaryID/istio | 配置 Istio VirtualService | Path: `canaryID`, Query: `host`, `canaryPercent` | `TrafficSplitResult` |
| POST | /api/v1/canaries/traffic/:canaryID/nginx | 配置 NGINX 上游权重 | Path: `canaryID`, Query: `upstream`, `weight` | `TrafficSplitResult` |
| GET | /api/v1/canaries/traffic/:canaryID/history | 查询流量变更历史 | Path: `canaryID` | `[TrafficHistory...]` |

### 强制操作

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| POST | /api/v1/canaries/force-promote/:runID | 强制 Promote 指定分析运行 | Path: `runID`, Query: `reason` | CanaryAnalysisRun 实体 |
| POST | /api/v1/canaries/force-rollback/:runID | 强制 Rollback 指定分析运行 | Path: `runID`, Query: `reason` | CanaryAnalysisRun 实体 |

### ML 模型重训练

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| POST | /api/v1/canaries/retrain | 触发 ML 模型重训练 | Body: `{ model_name (必填) }` | `CanaryRetrainJob` |
| GET | /api/v1/canaries/retrain/jobs | 查询重训练作业列表 | - | `[CanaryRetrainJob...]` |

---

## 四、数据模型

### 4.1 核心实体概览

服务使用 PostgreSQL 作为存储，共 10 张表。所有表位于 `orion_canary` 数据库。

### 4.2 实体关系图

```
canaries ──1:N── canary_metrics
    │
    └──1:N── canary_analysis
    │
    └──1:N── canary_traffic_configs ──1:N── canary_traffic_history

canary_analysis_runs ──1:N── canary_metric_results
                      ──1:N── canary_ml_results
                      ──1:N── canary_decisions
             
canary_analysis_configs (独立配置表)
canary_retrain_jobs (独立作业表)
```

### 4.3 核心实体定义

#### canaries — 金丝雀部署

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID (PK) | 主键，自动生成 |
| tenant_id | UUID NOT NULL | 租户 ID，用于多租户隔离 |
| deployment_id | VARCHAR(255) NOT NULL | 关联的部署 ID |
| service_name | VARCHAR(255) NOT NULL | 服务名称 |
| version | VARCHAR(100) NOT NULL | 部署版本 |
| status | VARCHAR(50), DEFAULT 'pending' | 状态: pending / deploying / running / success / failed / rolled_back / promoted |
| weight | INT DEFAULT 10 | 当前流量权重 |
| target_weight | INT DEFAULT 100 | 目标流量权重 |
| started_at | TIMESTAMPTZ | 开始时间 |
| completed_at | TIMESTAMPTZ | 完成时间 |
| created_at | TIMESTAMPTZ DEFAULT NOW() | 创建时间 |

#### canary_analysis_runs — 分析运行

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID (PK) | 主键 |
| deployment_id | VARCHAR(255) NOT NULL | 关联部署 ID |
| run_number | INT DEFAULT 1 | 运行序号 |
| traffic_split | JSONB | 流量分布 `{ "canary": 10, "baseline": 90 }` |
| status | VARCHAR(50) DEFAULT 'running' | 状态: running / promote / rollback / inconclusive |
| confidence | DOUBLE PRECISION | 决策置信度 (0.0~1.0) |
| decision | VARCHAR(50) | 决策: promote / rollback / continue / pending / inconclusive |
| started_at | TIMESTAMPTZ DEFAULT NOW() | 开始时间 |
| completed_at | TIMESTAMPTZ | 完成时间 |
| duration_ms | DOUBLE PRECISION | 持续毫秒数 |

#### canary_analysis_configs — 分析配置（service+environment 唯一）

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | UUID (PK) | - | 主键 |
| service_name | VARCHAR(255) NOT NULL | - | 服务名称 |
| environment | VARCHAR(100) NOT NULL | - | 环境名称 |
| analysis_interval_sec | INT | 300 | 分析间隔（秒） |
| max_rounds | INT | 5 | 最大分析轮次 |
| warmup_period_sec | INT | 600 | 预热期（秒） |
| promote_threshold | DOUBLE PRECISION | 0.75 | 提升阈值 |
| rollback_threshold | DOUBLE PRECISION | 0.60 | 回滚阈值 |
| traffic_step | INT | 20 | 流量步长 |
| metric_weights | JSONB | - | 指标权重映射 |
| excluded_metrics | TEXT[] | '{}' | 排除的指标列表 |
| slo_metrics | TEXT[] | '{}' | SLO 指标列表 |

#### canary_traffic_configs — 流量配置

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(255) (PK) | 主键（格式: `{canaryID}-config`） |
| canary_id | VARCHAR(255) NOT NULL | 关联金丝雀 ID |
| strategy | VARCHAR(50) DEFAULT 'weighted' | 策略: weighted / istio / nginx |
| host | VARCHAR(255) | 主机名（Istio 用） |
| namespace | VARCHAR(100) DEFAULT 'default' | Kubernetes 命名空间 |
| upstream_name | VARCHAR(255) | 上游名称（NGINX 用） |
| phase | VARCHAR(50) DEFAULT 'initial' | 阶段: initial / gradual / full |
| baseline_weight | INT | 基线权重 |
| canary_weight | INT | 金丝雀权重 |
| baseline_destination | VARCHAR(500) | 基线目的地（Istio Subset Destination） |
| baseline_subset | VARCHAR(100) | 基线子集名称 |
| canary_destination | VARCHAR(500) | 金丝雀目的地 |
| canary_subset | VARCHAR(100) | 金丝雀子集名称 |
| servers | JSONB | 服务器配置 |

### 4.4 额外的子实体

| 实体 | 关联 | 核心字段 | 说明 |
|------|------|---------|------|
| `canary_metrics` | canaries (FK) | metric_name, value, source, timestamp | 原始指标采样 |
| `canary_analysis` | canaries (FK) | score, verdict, details | 简单分析结果 |
| `canary_metric_results` | analysis_runs (FK) | metric_name, baseline_value, canary_value, mann_whitney_p, ks_statistic, cliff_delta, verdict, category | 统计指标分析结果 |
| `canary_ml_results` | analysis_runs (FK) | model_name, prediction, confidence, shap_explanation (JSONB), cluster_id | ML 模型预测结果 |
| `canary_decisions` | analysis_runs (FK) | decision, reason, overridden_by, override_reason | 决策审计轨迹 |
| `canary_retrain_jobs` | - | model_name, status, submitted_at, completed_at, error_message | 模型重训练作业 |
| `canary_traffic_history` | traffic_configs | canary_id, success, result, error | 流量变更执行历史 |

### 4.5 状态机

```
金丝雀状态: pending → deploying → running → success (promote)
                                          ↘ rolled_back (rollback)
                                          ↘ failed

分析运行状态: running → promote / rollback / inconclusive
```

---

## 五、依赖与集成

### 5.1 内部依赖

| 依赖模块 | 用途 | 引用形式 |
|---------|------|---------|
| `orion/go-common` | 共享库：Database 连接、Redis 客户端、日志、中间件、认证、工具函数 | `replace` 指令本地引用 |

### 5.2 外部依赖

| 依赖 | 用途 | 版本 |
|------|------|------|
| `github.com/gin-gonic/gin` | HTTP 框架 | v1.10.0 |
| `github.com/jmoiron/sqlx` | PostgreSQL 数据访问层 | v1.4.0 |
| `github.com/spf13/viper` | 配置管理（环境变量） | v1.19.0 |
| `github.com/google/uuid` | UUID 生成 | （间接，Go 标准库兼容） |
| `github.com/lib/pq` | PostgreSQL 驱动 | v1.10.9 |
| PostgreSQL | 数据持久化 | - |
| Redis | JWT Session 缓存 | - |

### 5.3 外部系统集成

| 系统 | 集成方式 | 说明 |
|------|---------|------|
| Istio | TrafficConfig → VirtualService 配置模型 | 金丝雀流量通过 Istio DestinationRule/Subset 分发 |
| NGINX | TrafficConfig → Upstream 权重配置模型 | 金丝雀流量通过 NGINX upstream weight 分发 |
| 监控系统 (Prometheus) | 数据模型引用 `PrometheusRangeQueryResponse` | 预留的 Prometheus 查询结果模型，用于指标采集 |
| 认证系统 (JWT + Redis) | 通过 `orion/go-common/pkg/auth` 中间件 | 所有 API 端点经过 JWT 验证和 RBAC 权限鉴定 |

### 5.4 基础设施配置

| 配置项 | 环境变量 | 默认值 | 说明 |
|--------|---------|--------|------|
| 服务端口 | `server_port` | 8086 | HTTP 监听端口 |
| 数据库主机 | `db_host` | localhost | PostgreSQL 主机 |
| 数据库端口 | `db_port` | 5432 | PostgreSQL 端口 |
| 数据库用户 | `db_user` | postgres | 数据库用户 |
| 数据库密码 | `db_password` | postgres | 数据库密码 |
| 数据库名称 | `db_name` | orion_canary | 数据库名称 |
| SSL 模式 | `db_ssl_mode` | disable | SSL 连接模式 |
| JWT 密钥 | `JWTSecret` | - | JWT 认证密钥 |
| Redis 地址 | `RedisAddr` | - | Redis 连接地址 |

---

## 六、注意事项

### 已知问题

1. **分析运行 API 端点未完全注册**：Handler 层当前只注册了金丝雀部署 CRUD 和指标管理的路由（`/api/v1/canaries` 下的 8 个端点）。分析运行（ListRuns、GetRunByID、GetMetricsForRun、GetMLResults、GetMetricsSummary）、分析配置 CRUD、流量管理、强制操作、重训练等功能的 HTTP 端点尚未在 `RegisterRoutes` 中注册。当前这些功能只能通过 service 层代码直接调用。

2. **模拟数据占位**：`SimulateAnalysisRun` 方法生成模拟的指标和 ML 预测结果（基于随机数），并非连接真实 Prometheus 或 ML 模型。`generateSimulatedMetrics` 和 `generateSimulatedMLResults` 为内部测试/演示方法，生产环境需替换为真实的 Prometheus 数据查询和 ML 模型推理。

3. **决策算法为简化版**：`calculateDecision` 基于简单的条件判断（通过/失败/警告计数 + ML 模型预测计数），非生产级置信度算法。生产环境中应根据业务场景设计更复杂的综合评分模型。

4. **流量策略为模型配置**：`ConfigureIstioVirtualService` 和 `ConfigureNGINXWeight` 当前仅保存配置到库，实际下发到集群（K8s / Istio / NGINX）的逻辑需要上游编排系统（如 Pipeline Engine 或 Operator）消费 traffic_configs 表中的数据后执行。

5. **缺少上限保护**：`IncrementTraffic` 方法每次 +10%，没有验证金丝雀部署的当前状态是否为 running，可能存在状态不一致。

6. **错误码未统一**：当前使用 `http.StatusInternalServerError(500)` 返回所有业务错误（包括 valid 的业务拒绝如 invalid status），不符合 RESTful 最佳实践。

### 后续优化方向

| 优先级 | 优化项 | 说明 |
|--------|--------|------|
| P0 | 补全所有 handler API 端点的路由注册 | 分析运行、分析配置、流量管理、强制操作、重训练接口 |
| P1 | 集成真实 Prometheus 指标 | 替代模拟数据，连接 Orion 可观测性栈 |
| P1 | 集成真实 ML 模型预测 | 接入 orion-ai-service 或外部 ML 平台 |
| P1 | 引入统一的错误码和结构化错误响应 | 替代当前的 500 + 文本错误 |
| P2 | 添加分布式追踪 | 集成 OpenTelemetry |
| P2 | 添加 Istio / NGINX 实际的配置下发 | 通过 K8s API 或 Operator 下发流量配置 |
| P2 | 添加 WebSocket/SSE 实时推送分析运行状态 | 前端实时查看金丝雀分析进度 |
| P2 | 增加金丝雀部署的自动生命周期管理 | 基于分析运行结果自动执行 promote/rollback |
