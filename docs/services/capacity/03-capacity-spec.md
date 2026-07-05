# 容量规划服务 Spec 文档

**生成日期**: 2026-07-03
**状态**: 编写中
**成熟度**: L1（初始定义）

---

## 一、服务定位

**容量规划服务 (capacity-svc-go)** 提供集群/资源池的资源容量管理与预测能力，涵盖资源池生命周期管理、资源利用率指标采集、容量趋势预测、自动扩缩容策略配置、容量瓶颈分析以及周期性容量报告生成。

### 服务边界

| 维度 | 范围 |
|------|------|
| **核心职责** | 资源池管理、容量指标采集、容量趋势预测、扩缩容策略管理、容量告警与报告、瓶颈分析 |
| **不负责** | 实际扩缩容执行（交由调度器或编排层）、指标采集（由 Prometheus/monitoring 服务完成）、资源调度决策 |
| **数据归属** | 租户隔离（所有表均包含 `tenant_id` 字段，路由通过 JWT 解析 `tenant_id`） |

### 用户角色与场景

| 角色 | 典型场景 |
|------|---------|
| **平台管理员** | 创建/管理资源池，配置全局容量阈值 |
| **运维人员** | 查看容量使用趋势、接收容量告警、生成容量报告 |
| **开发团队** | 配置应用级扩缩容策略、查看资源瓶颈分析 |

### 与 Orion 平台的关系

- 作为独立 Go 微服务蓝图，未来可独立部署
- 当前通过 `orion/go-common` 共享库集成，使用统一的 auth/middleware/logger/database 基础设施
- 命名遵循 `orion-<domain>-svc-go` 模式，47 个 Go 微服务蓝图之一

---

## 二、验收标准

| 编号 | 验收标准 | 优先级 | 验证方式 |
|------|---------|--------|---------|
| ACC-01 | 支持资源池的完整 CRUD（创建/列表/详情/更新/删除） | P0 | API 测试 |
| ACC-02 | 支持资源池数量统计 | P1 | API 测试 |
| ACC-03 | 支持记录资源利用率指标，自动计算利用率百分比 | P0 | API 测试 + 数据校验 |
| ACC-04 | 支持按资源类型和指标名称过滤指标列表 | P1 | API 测试 |
| ACC-05 | 支持基于最新指标自动生成 90 天容量预测 | P0 | 单元测试 + API 测试 |
| ACC-06 | 预测时对利用率 ≥80% 的资源自动产生告警（warning/critical） | P0 | 单元测试 |
| ACC-07 | 支持查看和管理容量告警 | P1 | API 测试 |
| ACC-08 | 支持自动生成容量报告（聚合告警+预测快照+健康打分） | P0 | 集成测试 |
| ACC-09 | 支持按 ID 查看报告和分页列表报告 | P1 | API 测试 |
| ACC-10 | 支持容量瓶颈分析（利用率 ≥50% 的资源按严重程度降序排序） | P0 | 单元测试 |
| ACC-11 | 支持扩缩容策略的创建和列表 | P1 | API 测试 |
| ACC-12 | 所有写操作（pool/metric/forecast/policy/alert）通过 ACL 权限守卫 | P0 | 集成测试 |
| ACC-13 | 所有接口按 tenant_id 隔离 | P0 | 集成测试 |
| ACC-14 | 数据库迁移（migrations 目录）自动执行 | P0 | 构建验证 |

---

## 三、API 设计

**基础路径**: `/api/v1/capacity`

**全局认证**: JWT Bearer Token（通过 `orion/go-common/pkg/auth.Auth` 中间件），支持 `/healthz` 跳过认证。

**权限模型**:
| 操作 | 所需权限 | Scope |
|------|---------|-------|
| 写操作（创建/更新） | `capacity:write` | 需要 `auth.RequirePermission("capacity", "write")` |
| 删除操作 | `capacity:delete` | 需要 `auth.RequirePermission("capacity", "delete")` |
| 读操作（列表/详情） | 无额外权限 | 仅需 JWT 认证 + tenant_id 隔离 |

### 3.1 资源池管理 (Pool CRUD)

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| `POST` | `/pools` | 创建资源池 | Body: CreatePoolRequest | `201` ResourcePool |
| `GET` | `/pools` | 获取资源池列表（分页） | Query: `page`(default1), `page_size`(default20) | `200` `{"data": ResourcePool[]}` |
| `GET` | `/pools/:id` | 获取单个资源池详情 | Path: `id` | `200` ResourcePool |
| `PUT` | `/pools/:id` | 更新资源池 | Path: `id`, Body: CreatePoolRequest | `200` ResourcePool |
| `DELETE` | `/pools/:id` | 删除资源池 | Path: `id` | `200` `{"message":"deleted"}` |
| `GET` | `/pools-count` | 统计资源池总数 | - | `200` `{"count": int}` |

### 3.2 容量指标 (Metrics)

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| `POST` | `/metrics` | 记录容量指标 | Body: RecordMetricRequest | `201` CapacityMetric |
| `GET` | `/metrics` | 查询指标列表 | Query: `resource_type`, `metric_name`（可选过滤） | `200` `{"data": CapacityMetric[]}` |

### 3.3 容量预测 (Forecasts)

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| `POST` | `/forecasts/generate` | 基于最新指标生成容量预测 | - | `201` `{"data": CapacityForecast[]}` |
| `GET` | `/forecasts` | 获取预测列表（分页） | Query: `page`, `page_size` | `200` `{"data": CapacityForecast[]}` |

### 3.4 容量告警 (Alerts)

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| `GET` | `/alerts` | 获取告警列表 | -（handler 传 nil filter，暂不支持 severity 过滤） | `200` `{"data": CapacityAlert[]}` |
| `DELETE` | `/alerts/:id` | 删除告警 | Path: `id` | `200` `{"message":"deleted"}` |

### 3.5 容量报告 (Reports)

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| `POST` | `/reports/generate` | 生成容量报告 | Query: `title` | `201` CapacityReport |
| `GET` | `/reports` | 获取报告列表（分页） | Query: `page`, `page_size` | `200` `{"data": CapacityReport[]}` |
| `GET` | `/reports/:id` | 获取单个报告详情 | Path: `id` | `200` CapacityReport |

### 3.6 瓶颈分析 (Bottleneck Analysis)

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| `GET` | `/bottlenecks` | 分析容量瓶颈 | - | `200` Bottleneck[] |

### 3.7 扩缩容策略 (Policies)

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| `POST` | `/policies` | 创建扩缩容策略 | Body: CreatePolicyRequest | `201` ScalingPolicy |
| `GET` | `/policies` | 获取策略列表 | - | `200` `{"data": ScalingPolicy[]}` |

### 3.8 健康检查

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| `GET` | `/healthz` | 健康检查（跳过认证） | - | `200` `{"status":"ok"}` |

---

## 四、数据模型

### 4.1 ResourcePool（资源池）

| 字段 | 类型 | 标签 | 说明 |
|------|------|------|------|
| `id` | `VARCHAR(36) PK` | `db:id json:id` | UUID |
| `tenant_id` | `VARCHAR(64) NOT NULL` | `db:tenant_id json:tenant_id` | 租户标识 |
| `name` | `VARCHAR(255) NOT NULL` | `db:name json:name` | 资源池名称 |
| `resource_type` | `VARCHAR(64) NOT NULL` | `db:resource_type json:resource_type` | 资源类型（如 k8s, vm, baremetal） |
| `total_cpu` | `FLOAT8` | `db:total_cpu json:total_cpu` | 总 CPU（核数） |
| `total_memory` | `FLOAT8` | `db:total_memory json:total_memory` | 总内存（GB） |
| `used_cpu` | `FLOAT8` | `db:used_cpu json:used_cpu` | 已用 CPU（默认 0） |
| `used_memory` | `FLOAT8` | `db:used_memory json:used_memory` | 已用内存（默认 0） |
| `node_count` | `INTEGER` | `db:node_count json:node_count` | 节点数量 |
| `labels` | `JSONB` | `db:labels json:labels,omitempty` | 标签（map[string]interface{}） |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | `db:created_at json:created_at` | 创建时间 |
| `updated_at` | `TIMESTAMP WITH TIME ZONE` | `db:updated_at json:updated_at` | 更新时间 |

**DDL 推断**:
```sql
CREATE TABLE resource_pools (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    total_cpu DOUBLE PRECISION DEFAULT 0,
    total_memory DOUBLE PRECISION DEFAULT 0,
    used_cpu DOUBLE PRECISION DEFAULT 0,
    used_memory DOUBLE PRECISION DEFAULT 0,
    node_count INTEGER DEFAULT 0,
    labels JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_resource_pools_tenant ON resource_pools(tenant_id);
```

### 4.2 CapacityMetric（容量指标）

| 字段 | 类型 | 标签 | 说明 |
|------|------|------|------|
| `id` | `VARCHAR(36) PK` | `db:id json:id` | UUID |
| `tenant_id` | `VARCHAR(64) NOT NULL` | `db:tenant_id json:tenant_id` | 租户标识 |
| `resource_type` | `VARCHAR(64) NOT NULL` | `db:resource_type json:resource_type` | 资源类型 |
| `resource_id` | `VARCHAR(128) NOT NULL` | `db:resource_id json:resource_id` | 资源标识 |
| `metric_name` | `VARCHAR(64) NOT NULL` | `db:metric_name json:metric_name` | 指标名称（如 cpu, memory, disk, iops） |
| `current_value` | `FLOAT8` | `db:current_value json:current_value` | 当前值 |
| `max_value` | `FLOAT8` | `db:max_value json:max_value` | 最大值 |
| `unit` | `VARCHAR(32)` | `db:unit json:unit` | 单位（如 cores, GB, MB/s） |
| `utilization_percent` | `FLOAT8` | `db:utilization_percent json:utilization_percent` | 利用率百分比（auto-calc: current/max*100） |
| `recorded_at` | `TIMESTAMP WITH TIME ZONE` | `db:recorded_at json:recorded_at` | 记录时间 |

**DDL 推断**:
```sql
CREATE TABLE capacity_metrics (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id VARCHAR(128) NOT NULL,
    metric_name VARCHAR(64) NOT NULL,
    current_value DOUBLE PRECISION DEFAULT 0,
    max_value DOUBLE PRECISION DEFAULT 0,
    unit VARCHAR(32),
    utilization_percent DOUBLE PRECISION DEFAULT 0,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_capacity_metrics_tenant ON capacity_metrics(tenant_id);
CREATE INDEX idx_capacity_metrics_lookup ON capacity_metrics(tenant_id, resource_type, resource_id, metric_name, recorded_at DESC);
```

### 4.3 CapacityForecast（容量预测）

| 字段 | 类型 | 标签 | 说明 |
|------|------|------|------|
| `id` | `VARCHAR(36) PK` | `db:id json:id` | UUID |
| `tenant_id` | `VARCHAR(64) NOT NULL` | `db:tenant_id json:tenant_id` | 租户标识 |
| `resource_type` | `VARCHAR(64) NOT NULL` | `db:resource_type json:resource_type` | 资源类型 |
| `current_usage` | `FLOAT8` | `db:current_usage json:current_usage` | 当前使用率（%） |
| `predicted` | `FLOAT8` | `db:predicted json:predicted` | 预测使用率（%，90 天预测） |
| `threshold` | `FLOAT8` | `db:threshold json:threshold` | 告警阈值（固定 80） |
| `days_until_full` | `INTEGER` | `db:days_until_full json:days_until_full` | 预计耗尽天数（predicted≥90 时计算） |
| `recommendation` | `TEXT` | `db:recommendation json:recommendation,omitempty` | 中文建议文本 |
| `forecast_date` | `TIMESTAMP WITH TIME ZONE` | `db:forecast_date json:forecast_date` | 预测生成时间 |

**DDL 推断**:
```sql
CREATE TABLE capacity_forecasts (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    current_usage DOUBLE PRECISION DEFAULT 0,
    predicted DOUBLE PRECISION DEFAULT 0,
    threshold DOUBLE PRECISION DEFAULT 80,
    days_until_full INTEGER DEFAULT 0,
    recommendation TEXT,
    forecast_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_capacity_forecasts_tenant ON capacity_forecasts(tenant_id, forecast_date DESC);
```

### 4.4 CapacityAlert（容量告警）

| 字段 | 类型 | 标签 | 说明 |
|------|------|------|------|
| `id` | `VARCHAR(36) PK` | `db:id json:id` | UUID |
| `tenant_id` | `VARCHAR(64) NOT NULL` | `db:tenant_id json:tenant_id` | 租户标识 |
| `resource_id` | `VARCHAR(128) NOT NULL` | `db:resource_id json:resource_id` | 资源标识 |
| `resource_type` | `VARCHAR(64) NOT NULL` | `db:resource_type json:resource_type` | 资源类型 |
| `metric_name` | `VARCHAR(64) NOT NULL` | `db:metric_name json:metric_name` | 指标名称 |
| `current_utilization` | `FLOAT8` | `db:current_utilization json:current_utilization` | 当前利用率（%） |
| `threshold` | `FLOAT8` | `db:threshold json:threshold` | 触发阈值（warning=80, critical=90） |
| `severity` | `VARCHAR(16)` | `db:severity json:severity` | 严重级别（warning / critical） |
| `message` | `TEXT` | `db:message json:message` | 中文告警消息 |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | `db:created_at json:created_at` | 创建时间 |

**DDL 推断**:
```sql
CREATE TABLE capacity_alerts (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    resource_id VARCHAR(128) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    metric_name VARCHAR(64) NOT NULL,
    current_utilization DOUBLE PRECISION NOT NULL,
    threshold DOUBLE PRECISION NOT NULL,
    severity VARCHAR(16) NOT NULL,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_capacity_alerts_tenant ON capacity_alerts(tenant_id, created_at DESC);
```

### 4.5 ScalingPolicy（扩缩容策略）

| 字段 | 类型 | 标签 | 说明 |
|------|------|------|------|
| `id` | `VARCHAR(36) PK` | `db:id json:id` | UUID |
| `tenant_id` | `VARCHAR(64) NOT NULL` | `db:tenant_id json:tenant_id` | 租户标识 |
| `name` | `VARCHAR(255) NOT NULL` | `db:name json:name` | 策略名称 |
| `resource_type` | `VARCHAR(64) NOT NULL` | `db:resource_type json:resource_type` | 目标资源类型 |
| `min_replicas` | `INTEGER` | `db:min_replicas json:min_replicas` | 最小副本数 |
| `max_replicas` | `INTEGER` | `db:max_replicas json:max_replicas` | 最大副本数 |
| `scale_up_threshold` | `FLOAT8` | `db:scale_up_threshold json:scale_up_threshold` | 扩容阈值（利用率 %） |
| `scale_down_threshold` | `FLOAT8` | `db:scale_down_threshold json:scale_down_threshold` | 缩容阈值（利用率 %） |
| `cooldown_sec` | `INTEGER` | `db:cooldown_sec json:cooldown_sec` | 冷却时间（秒） |
| `enabled` | `BOOLEAN` | `db:enabled json:enabled` | 是否启用（默认 true） |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | `db:created_at json:created_at` | 创建时间 |

**DDL 推断**:
```sql
CREATE TABLE scaling_policies (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    min_replicas INTEGER DEFAULT 1,
    max_replicas INTEGER DEFAULT 10,
    scale_up_threshold DOUBLE PRECISION DEFAULT 80,
    scale_down_threshold DOUBLE PRECISION DEFAULT 30,
    cooldown_sec INTEGER DEFAULT 300,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_scaling_policies_tenant ON scaling_policies(tenant_id);
```

### 4.6 CapacityReport（容量报告）

| 字段 | 类型 | 标签 | 说明 |
|------|------|------|------|
| `id` | `VARCHAR(36) PK` | `db:id json:id` | UUID |
| `tenant_id` | `VARCHAR(64) NOT NULL` | `db:tenant_id json:tenant_id` | 租户标识 |
| `title` | `VARCHAR(255)` | `db:title json:title` | 报告标题 |
| `total_resources` | `INTEGER` | `db:total_resources json:total_resources` | 资源总数（alert 去重后） |
| `healthy_count` | `INTEGER` | `db:healthy_count json:healthy_count` | 健康资源数 |
| `warning_count` | `INTEGER` | `db:warning_count json:warning_count` | 警告资源数 |
| `critical_count` | `INTEGER` | `db:critical_count json:critical_count` | 严重资源数 |
| `overall_score` | `INTEGER` | `db:overall_score json:overall_score` | 总体健康评分（0-100） |
| `alerts_snapshot` | `JSONB` | `db:alerts_snapshot json:alerts_snapshot,omitempty` | 告警快照 `{"alerts": []}` |
| `forecasts_snapshot` | `JSONB` | `db:forecasts_snapshot json:forecasts_snapshot,omitempty` | 预测快照 `{"forecasts": []}` |
| `generated_at` | `TIMESTAMP WITH TIME ZONE` | `db:generated_at json:generated_at` | 生成时间 |

**DDL 推断**:
```sql
CREATE TABLE capacity_reports (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    title VARCHAR(255),
    total_resources INTEGER DEFAULT 0,
    healthy_count INTEGER DEFAULT 0,
    warning_count INTEGER DEFAULT 0,
    critical_count INTEGER DEFAULT 0,
    overall_score INTEGER DEFAULT 100,
    alerts_snapshot JSONB,
    forecasts_snapshot JSONB,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_capacity_reports_tenant ON capacity_reports(tenant_id, generated_at DESC);
```

### 4.7 请求类型（Request Types）

**CreatePoolRequest**:
```json
{
  "name": "string (required)",
  "resource_type": "string (required, e.g. k8s, vm, baremetal)",
  "total_cpu": 64.0,
  "total_memory": 256.0,
  "node_count": 8,
  "labels": {"env": "prod"}
}
```

**CreatePolicyRequest**:
```json
{
  "name": "string (required)",
  "resource_type": "string (required)",
  "min_replicas": 2,
  "max_replicas": 20,
  "scale_up_threshold": 80.0,
  "scale_down_threshold": 30.0,
  "cooldown_sec": 300
}
```

**RecordMetricRequest**:
```json
{
  "resource_type": "string (required)",
  "resource_id": "string (required)",
  "metric_name": "string (required, e.g. cpu, memory, disk, iops)",
  "current_value": 32.0,
  "max_value": 64.0,
  "unit": "cores"
}
```

**MetricFilter** (Query params):
| 参数 | 类型 | 说明 |
|------|------|------|
| `resource_type` | string | 按资源类型过滤 |
| `metric_name` | string | 按指标名称过滤 |

### 4.8 业务类型（Business Types）

**Bottleneck**（瓶颈分析结果，非持久化）:
```json
{
  "resource_id": "string",
  "resource_type": "string",
  "metric_name": "string",
  "utilization": 85.5,
  "impact": "high|medium|low",
  "recommendation": "string"
}
```

**Impact 等级**:
| 利用率 | Impact | 触发行为 |
|--------|--------|---------|
| ≥80% | `high` | 生成专用扩容建议 |
| 60-79% | `medium` | 标记为关注 |
| 50-59% | `low` | 仅监控 |
| <50% | 不返回 | 跳过 |

---

## 五、依赖与集成

### 5.1 直接依赖

| 依赖库 | 用途 | 来源 |
|--------|------|------|
| `github.com/gin-gonic/gin v1.10.0` | HTTP 路由框架 | 外部依赖 |
| `github.com/google/uuid v1.6.0` | UUID 生成 | 外部依赖 |
| `github.com/jmoiron/sqlx v1.4.0` | PostgreSQL 数据库操作 | 外部依赖 |
| `orion/go-common` | 共享基础设施（auth/database/logger/middleware/redis） | 内部 replace `../orion-go-common` |

### 5.2 基础设施集成

| 组件 | 集成方式 | 配置项 |
|------|---------|--------|
| **PostgreSQL** | `orion/go-common/pkg/database.Connect` | `DATABASE_URL` |
| **Redis** | `orion/go-common/pkg/redis.NewClient` | `REDIS_ADDR` |
| **Auth** | `orion/go-common/pkg/auth` (JWT + Redis session + Permission middleware) | `JWT_SECRET` |
| **Logger** | `orion/go-common/pkg/logger` (zap) | 自动配置 |
| **Middleware** | `orion/go-common/pkg/middleware` (Recovery, RequestID, StructuredLogger, CORS) | - |

### 5.3 数据库迁移

- 目录: `migrations/`
- 通过 `database.RunMigrations(db, "migrations")` 在启动时自动执行
- 包含所有 6 张表的建表/索引语句

### 5.4 服务依赖关系

| 依赖服务 | 依赖类型 | 说明 |
|---------|---------|------|
| 无外部服务依赖 | 内聚 | 所有数据本地存储，不调用其他微服务 |

### 5.5 内部集成 - 预测算法

容量预测使用简单线性增长模型（与 Node.js 版 orion-platform-service 实现一致）:

```
growthRate = 5-15% 随机月度增长率
forecast90 = utilization * (1 + growthRate * 3)  // 90 天预测
daysUntilFull = ceil((100 - utilization) / (growthRate * utilization / 30))  // 仅 forecast90 >= 90 时计算
```

---

## 六、注意事项

### 6.1 已知限制

| 编号 | 描述 | 影响 | 建议改进 |
|------|------|------|---------|
| LMT-01 | `randFloat()` 使用 `time.Now().UnixNano()%1000 / 1000` 实现，精度仅 0.001、重复调用可能产生相同值 | 预测结果在短时间内的多次调用可能产生相同增长率 | 改用 `math/rand/v2` 或 `crypto/rand` |
| LMT-02 | 预测算法仅使用**最新一条**指标值，未考虑历史趋势 | 预测精度受单点噪声影响 | 改为基于历史序列的线性回归或 Holt-Winters |
| LMT-03 | ListAlerts handler 传 `nil` 过滤器，severity 过滤功能虽在 Service 层实现但未暴露 | 前端无法按级别筛选告警 | handler 传 `&AlertFilter{}` 并绑定 query |
| LMT-04 | DeleteAlert 未验证 tenant_id（仅按 id 删除） | 跨租户可删除告警（严重安全风险） | 需增加 `WHERE tenant_id=$2` |
| LMT-05 | 无 ScalingPolicy 的更新/删除/详情接口 | 策略管理不完整（仅 Create + List） | 补充 UpdatePolicy / DeletePolicy / GetPolicy |
| LMT-06 | 无 ResourcePool 的 used_cpu / used_memory 自动更新逻辑 | used_cpu/used_memory 始终为 0 | 关联 Metric 记录或异步计算任务 |
| LMT-07 | Report 的 alerts_snapshot / forecasts_snapshot 是快照（无数据过期策略） | 报告中的告警/预测数据不随时间刷新 | 每次查看报告时重新计算或标记过期时间 |
| LMT-08 | Alert 创建在 forecast generation 中忽略重复插入错误（`_ = s.alertRepo.Create()`） | 重复生成预测会产生大量重复告警 | 增加去重逻辑（同 resource+metric+severity 一天内不重复创建） |

### 6.2 安全隐患

| 编号 | 描述 | 严重程度 | 建议修复 |
|------|------|---------|---------|
| SEC-01 | `DeleteAlert` 缺少 tenant_id 过滤 | 高 | 改为 `WHERE id=$1 AND tenant_id=$2` |
| SEC-02 | `JWT_SECRET` 默认值 `"change-me-in-production"` | 中 | 生产环境必须修改 |

### 6.3 部署配置

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `PORT` | `8080` | 服务监听端口 |
| `DATABASE_URL` | `postgres://orion:orion@localhost:5432/orion_capacity?sslmode=disable` | PostgreSQL 连接串 |
| `JWT_SECRET` | `change-me-in-production` | JWT 签名密钥 |
| `REDIS_ADDR` | `localhost:6379` | Redis 地址 |

### 6.4 测试覆盖

| 测试文件 | 覆盖内容 | 状态 |
|---------|---------|------|
| `internal/models/models_test.go` | 数据模型字段验证、JSON 序列化/反序列化 | ✅ 基线 |
| `internal/service/service_test.go` | 错误常量验证 | ✅ 基线（仅 3 条，覆盖率低） |

### 6.5 与 orion-platform-service 中容量规划功能的对应关系

或项目中 Node.js 版容量规划功能位于 `orion-platform-service`，该 Go 服务为其独立微服务蓝图。两者预测算法一致（简单线性增长），数据模型保持同步。当前 orion-platform-service 为生产部署版本，此服务为未来微服务拆分的独立部署候选。

### 6.6 后续优化建议（非阻塞）

1. **补充策略管理**：UpdatePolicy / DeletePolicy / GetPolicy 及详情接口
2. **丰富度量采集**：支持批量指标上报（batch metrics ingestion）
3. **增强预测**：引入 ARIMA 或 Prophet 模型替代简单线性增长
4. **通知集成**：容量告警自动推送到 Orion 事件总线或通知服务
5. **前端集成**：对接现有 frontend capacity 页面（`orion-frontend/src/pages/capacity/`）
