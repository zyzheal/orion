# Orion 服务治理方案设计

**生成日期**: 2026-07-02
**依据**: 当前系统已有能力 + 缺失能力分析 + 架构设计评估报告

---

## 一、现状分析

### 1.1 已有能力（部分实现）

| 能力 | 前端页面 | 后端实现 | 完成度 |
|------|---------|---------|--------|
| 前端子应用管理 | ✅ SubAppManagement | ✅ SubAppService + Repository + 路由 | 90% |
| 插件管理 | ✅ PluginManagement | ✅ PluginRegistry + PluginService + Sandbox | 85% |
| 服务目录 | ✅ ServiceCatalog | ✅ ServiceCatalogService + CatalogRequest | 80% |
| Runner 管理（心跳） | ✅ RunnerManagement | ✅ 心跳检测 + 状态管理 | 85% |
| 金丝雀流量 | ✅ canary-traffic | ✅ CanaryTrafficService | 90% |
| 速率限制页面 | ✅ rate-limiting | ❌ 后端未实现 | 30% |
| 熔断器页面 | ✅ circuit-breaker | ❌ 后端未实现 | 30% |

### 1.2 缺失能力

| 能力 | 优先级 | 说明 |
|------|--------|------|
| **服务注册/发现页面** | P0 | 无统一页面管理所有微服务注册、状态、健康检查 |
| **API Gateway 路由管理页面** | P0 | Gateway 路由硬编码在 `src/routes/api.ts`，无管理界面 |
| **服务拓扑/依赖可视化** | P1 | 无页面展示服务间调用关系 |
| **服务版本管理** | P1 | 无页面管理服务版本发布/回滚 |
| **全局服务健康仪表盘** | P1 | 各服务有独立 health check，但无统一视图 |
| **Handler 注册表页面** | P2 | HandlerRegistry (三级存储) 无前端 |
| **Connector 注册页面** | P2 | ConnectorRegistry (外部集成) 无前端 |

---

## 二、服务治理架构设计

### 2.1 目标架构

```
┌─────────────────────────────────────────────────────────────────────┐
│  Orion 服务治理平台                                                    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  服务治理控制台 (前端页面)                                     │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌─────────────┐  │   │
│  │  │ 服务注册   │ │ 路由管理   │ │ 健康检查   │ │ 服务拓扑    │  │   │
│  │  │ 发现       │ │           │ │           │ │             │  │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └─────────────┘  │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌─────────────┐  │   │
│  │  │ 版本管理   │ │ 流量治理   │ │ 限流熔断   │ │ 插件管理    │  │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └─────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  服务治理 API 层 (orion-platform-service)                     │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │  ServiceRegistryService (服务注册/发现)              │   │   │
│  │  │  GatewayRouteService (路由管理)                      │   │   │
│  │  │  HealthCheckService (健康检查聚合)                    │   │   │
│  │  │  ServiceTopologyService (拓扑分析)                   │   │   │
│  │  │  VersionService (版本管理)                           │   │   │
│  │  │  TrafficService (流量治理)                           │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  存储层                                                        │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌─────────────┐  │   │
│  │  │ PostgreSQL │ │   Redis   │ │ NATS JS   │ │ 文件系统     │  │   │
│  │  │ 服务注册表  │ │ 健康缓存   │ │ 事件总线   │ │ 插件包       │  │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └─────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心服务设计

#### 2.2.1 ServiceRegistryService（服务注册/发现）

**职责**: 统一管理所有微服务（平台单体 + Go 微服务 + Python 服务）的注册、发现、状态。

**数据模型**:

```typescript
interface ServiceRegistration {
  id: string;
  name: string;              // 服务名，如 'pipeline', 'ticket'
  type: 'monolith' | 'go' | 'python' | 'java' | 'frontend-subapp';
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  version: string;           // 语义化版本号
  host: string;              // 主机地址
  port: number;              // 端口号
  protocol: 'http' | 'grpc' | 'websocket';
  healthCheckUrl: string;    // 健康检查端点
  metadata: Record<string, unknown>;  // 扩展元数据
  registeredAt: Date;
  lastHeartbeat: Date;
  tags: string[];            // 标签：如 ['production', 'core', 'pipeline-domain']
}
```

**API 端点**:

```
GET    /api/v1/services              - 服务列表（支持分页/过滤/标签）
GET    /api/v1/services/:name        - 服务详情
POST   /api/v1/services              - 服务注册
PUT    /api/v1/services/:name        - 服务更新
DELETE /api/v1/services/:name        - 服务注销
GET    /api/v1/services/:name/health  - 服务健康检查
POST   /api/v1/services/:name/heartbeat - 心跳上报
GET    /api/v1/services/:name/versions - 版本历史
```

**后端实现文件**:

```
orion-platform-service/
├── src/services/service-registry/
│   ├── ServiceRegistryService.ts     # 核心服务
│   ├── ServiceRegistryRepository.ts  # Repository
│   ├── ServiceHealthChecker.ts       # 健康检查器
│   ├── ServiceDiscovery.ts           # 服务发现（内存缓存 + DB）
│   ├── ServiceVersionService.ts      # 版本管理
│   └── index.ts                      # Barrel export
├── src/api/service-registry-routes.ts  # 路由
└── src/repositories/ServiceRegistryRepository.ts  # 仓储
```

#### 2.2.2 GatewayRouteService（路由管理）

**职责**: 管理 API Gateway 的路由配置，替代硬编码的 `src/routes/api.ts`。

**数据模型**:

```typescript
interface GatewayRouteConfig {
  id: string;
  prefix: string;              // 路由前缀，如 '/api/v1/pipelines'
  targetService: string;       // 目标服务名
  targetHost: string;          // 目标主机
  targetPort: number;          // 目标端口
  timeout: number;             // 超时（毫秒）
  stripPrefix: boolean;        // 是否剥离前缀
  enabled: boolean;            // 是否启用
  rateLimit: {                 // 限流配置
    requests: number;
    window: string;            // '1m', '5m', '1h'
  };
  circuitBreaker: {            // 熔断配置
    threshold: number;
    timeout: string;
  };
  updatedAt: Date;
  updatedBy: string;
}
```

**API 端点**:

```
GET    /api/v1/gateway/routes          - 路由列表
GET    /api/v1/gateway/routes/:id      - 路由详情
POST   /api/v1/gateway/routes          - 创建路由
PUT    /api/v1/gateway/routes/:id      - 更新路由
DELETE /api/v1/gateway/routes/:id      - 删除路由
POST   /api/v1/gateway/routes/import   - 批量导入（YAML/JSON）
POST   /api/v1/gateway/routes/export   - 批量导出
PUT    /api/v1/gateway/routes/reload   - 重载配置（热更新）
```

**后端实现文件**:

```
orion-platform-service/
├── src/services/gateway-route/
│   ├── GatewayRouteService.ts
│   ├── GatewayRouteRepository.ts
│   ├── GatewayConfigLoader.ts        # 配置加载器
│   └── index.ts
├── src/api/gateway-routes.ts          # 路由
└── src/repositories/GatewayRouteRepository.ts
```

#### 2.2.3 ServiceTopologyService（服务拓扑）

**职责**: 分析并展示服务间的调用关系和依赖。

**数据来源**:
1. API Gateway 路由配置（静态依赖）
2. NATS JetStream 事件订阅关系（动态依赖）
3. Service-to-Service 调用日志（动态依赖）
4. HandlerRegistry 注册表（SPI 依赖）

**API 端点**:

```
GET    /api/v1/services/topology       - 服务拓扑数据
GET    /api/v1/services/:name/dependents - 某服务的依赖方
GET    /api/v1/services/:name/dependencies - 某服务依赖的服务
GET    /api/v1/services/topology/graph - 拓扑图数据（用于可视化）
```

#### 2.2.4 HealthCheckAggregatorService（健康检查聚合）

**职责**: 聚合所有服务的健康检查状态，提供统一视图。

**实现方式**:
- 定期轮询各服务的 `/healthz` 端点
- 接收服务心跳（主动上报）
- 缓存健康状态到 Redis（TTL 5 分钟）
- 通过 SSE 推送状态变化到前端

**API 端点**:

```
GET    /api/v1/health/aggregated       - 聚合健康状态
GET    /api/v1/health/:service         - 单服务健康
WS     /api/v1/health/stream           - 实时健康状态流（SSE/WS）
```

### 2.3 前端页面设计

#### 2.3.1 服务治理控制台（ServiceGovernanceDashboard）

```
orion-frontend/src/pages/ServiceGovernance/
├── index.tsx                    # 主页面（Tab 切换）
├── ServiceRegistryPage.tsx      # Tab 1: 服务注册/发现
├── GatewayRoutesPage.tsx        # Tab 2: API 路由管理
├── HealthDashboardPage.tsx      # Tab 3: 全局健康仪表盘
├── TopologyPage.tsx             # Tab 4: 服务拓扑可视化
├── VersionManagementPage.tsx    # Tab 5: 版本管理
├── TrafficManagementPage.tsx    # Tab 6: 流量治理
└── components/
    ├── ServiceCard.tsx          # 服务卡片组件
    ├── HealthBadge.tsx          # 健康状态徽章
    ├── TopologyGraph.tsx        # 拓扑图（使用 @ant-design/plots）
    ├── RouteTable.tsx           # 路由表格
    └── HeartbeatIndicator.tsx   # 心跳指示器
```

#### 2.3.2 各页面功能

**Tab 1: 服务注册/发现**

| 功能 | 说明 |
|------|------|
| 服务列表 | 表格展示所有服务，支持搜索/过滤/分页 |
| 服务卡片 | 显示服务名、类型、版本、状态、最后心跳 |
| 服务详情 | 抽屉展示服务详情（元数据、依赖、版本历史） |
| 服务注册 | 手动注册新服务（或通过 Gateway 自动发现） |
| 服务注销 | 注销服务（软删除） |
| 状态切换 | 启用/禁用服务 |

**Tab 2: API 路由管理**

| 功能 | 说明 |
|------|------|
| 路由列表 | 表格展示所有 Gateway 路由配置 |
| 路由 CRUD | 创建/编辑/删除路由 |
| 批量导入 | 从 YAML/JSON 文件批量导入路由 |
| 批量导出 | 导出当前路由配置 |
| 热重载 | 一键重载 Gateway 配置（无需重启） |
| 路由测试 | 测试路由是否可达 |

**Tab 3: 全局健康仪表盘**

| 功能 | 说明 |
|------|------|
| 健康概览 | 卡片展示各服务健康状态（绿/黄/红） |
| 实时状态 | SSE 推送健康状态变化 |
| 健康趋势 | 折线图展示健康状态历史 |
| 告警列表 | 服务不健康时的告警记录 |

**Tab 4: 服务拓扑可视化**

| 功能 | 说明 |
|------|------|
| 拓扑图 | 力导向图展示服务依赖关系 |
| 依赖分析 | 点击节点查看上下游依赖 |
| 热点分析 | 高亮高频调用路径 |

**Tab 5: 版本管理**

| 功能 | 说明 |
|------|------|
| 版本列表 | 展示服务版本历史 |
| 版本对比 | 对比两个版本的配置差异 |
| 版本回滚 | 一键回滚到指定版本 |

**Tab 6: 流量治理**

| 功能 | 说明 |
|------|------|
| 限流配置 | 配置各服务的限流规则 |
| 熔断配置 | 配置熔断阈值 |
| 金丝雀发布 | 配置金丝雀流量比例 |
| 灰度发布 | 灰度发布管理 |

---

## 三、实施计划

### Phase 1: 基础服务注册/发现（2 周）

| 周 | 任务 | 产出 |
|----|------|------|
| W1 | 创建 ServiceRegistryService + Repository | 服务注册/注销 API |
| W1 | 创建 ServiceHealthChecker | 健康检查逻辑 |
| W2 | 创建 service-registry-routes.ts | 8 个 API 端点 |
| W2 | 创建 ServiceRegistryPage 前端 | 服务列表 + 详情 |

### Phase 2: Gateway 路由管理（2 周）

| 周 | 任务 | 产出 |
|----|------|------|
| W3 | 创建 GatewayRouteService + Repository | 路由 CRUD API |
| W3 | 创建 GatewayConfigLoader | 配置加载/热重载 |
| W4 | 创建 GatewayRoutesPage 前端 | 路由管理界面 |
| W4 | 集成到 API Gateway | 热重载生效 |

### Phase 3: 健康仪表盘 + 拓扑（2 周）

| 周 | 任务 | 产出 |
|----|------|------|
| W5 | 创建 HealthCheckAggregatorService | 聚合健康状态 |
| W5 | 创建 ServiceTopologyService | 拓扑数据 API |
| W6 | 创建 HealthDashboardPage | 健康仪表盘 |
| W6 | 创建 TopologyPage | 拓扑可视化 |

### Phase 4: 版本管理 + 流量治理（2 周）

| 周 | 任务 | 产出 |
|----|------|------|
| W7 | 创建 VersionService | 版本管理 API |
| W7 | 创建 TrafficService | 限流/熔断/金丝雀 API |
| W8 | 创建 VersionManagementPage | 版本管理界面 |
| W8 | 创建 TrafficManagementPage | 流量治理界面 |

### Phase 5: 集成与优化（1 周）

| 周 | 任务 | 产出 |
|----|------|------|
| W9 | 集成到 Console 页面 | 统一入口 |
| W9 | 端到端测试 | 完整工作流 |
| W9 | 文档更新 | 服务治理使用指南 |

---

## 四、与现有能力的集成

### 4.1 与 SubAppManagement 集成

```
SubAppManagement (现有)          ServiceGovernance (新增)
├── 前端子应用管理                ├── 服务注册/发现
├── CSS 隔离策略                  ├── 路由管理
├── 启用/禁用开关                  ├── 健康检查
└── 版本历史                      └── 拓扑可视化

集成点:
- SubAppManagement 的 SubAppConfig 注册到 ServiceRegistry
- ServiceGovernance 的"前端子应用"分类展示 SubApp
```

### 4.2 与 PluginManagement 集成

```
PluginManagement (现有)          ServiceGovernance (新增)
├── 插件注册/安装                  ├── 插件作为一类服务
├── 插件生命周期                   ├── 插件健康检查
├── 插件配置                       └── 插件版本管理
└── 插件沙箱
```

### 4.3 与 RunnerManagement 集成

```
RunnerManagement (现有)          ServiceGovernance (新增)
├── Runner 心跳                    ├── Runner 作为一类服务
├── Runner 状态管理                 ├── Runner 健康检查
├── Runner 标签                     └── Runner 拓扑展示
└── Runner 任务分配
```

### 4.4 与 ConnectorRegistry 集成

```
ConnectorRegistry (现有)         ServiceGovernance (新增)
├── 外部连接器注册                  ├── 连接器作为一类服务
├── 连接器能力声明                  ├── 连接器健康检查
├── 连接器配置                      └── 连接器版本管理
└── 连接器测试
```

---

## 五、数据库设计

### 5.1 服务注册表

```sql
CREATE TABLE service_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    type VARCHAR(32) NOT NULL,  -- 'monolith' | 'go' | 'python' | 'java' | 'frontend-subapp'
    status VARCHAR(32) NOT NULL DEFAULT 'unknown',
    version VARCHAR(32) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL,
    protocol VARCHAR(16) NOT NULL DEFAULT 'http',
    health_check_url VARCHAR(512),
    metadata JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    last_heartbeat TIMESTAMP NOT NULL DEFAULT NOW(),
    registered_at TIMESTAMP NOT NULL DEFAULT NOW(),
    registered_by VARCHAR(64),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_service_registrations_status ON service_registrations(tenant_id, status);
CREATE INDEX idx_service_registrations_type ON service_registrations(tenant_id, type);
CREATE INDEX idx_service_registrations_tags ON service_registrations USING GIN(tags);
```

### 5.2 网关路由表

```sql
CREATE TABLE gateway_route_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    prefix VARCHAR(256) NOT NULL,
    target_service VARCHAR(128) NOT NULL,
    target_host VARCHAR(255) NOT NULL,
    target_port INTEGER NOT NULL,
    timeout INTEGER NOT NULL DEFAULT 30000,
    strip_prefix BOOLEAN NOT NULL DEFAULT false,
    enabled BOOLEAN NOT NULL DEFAULT true,
    rate_limit_requests INTEGER,
    rate_limit_window VARCHAR(16),
    circuit_breaker_threshold INTEGER,
    circuit_breaker_timeout VARCHAR(16),
    config_json JSONB DEFAULT '{}',
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(64),
    UNIQUE(tenant_id, prefix)
);

CREATE INDEX idx_gateway_route_configs_enabled ON gateway_route_configs(tenant_id, enabled);
```

### 5.3 服务版本历史表

```sql
CREATE TABLE service_version_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    service_name VARCHAR(128) NOT NULL,
    version VARCHAR(32) NOT NULL,
    change_log TEXT,
    config_snapshot JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(64)
);

CREATE INDEX idx_service_version_history_name ON service_version_history(tenant_id, service_name, created_at DESC);
```

### 5.4 健康检查缓存表（Redis）

```
Key: service:health:{tenant_id}:{service_name}
Value: {
  status: 'healthy' | 'degraded' | 'unhealthy',
  lastCheck: ISO8601,
  responseTime: ms,
  error: string | null
}
TTL: 300s (5 分钟)
```

---

## 六、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 服务注册表成为单点 | 高 | 使用 PostgreSQL 主从 + Redis 缓存 |
| 健康检查轮询压力大 | 中 | 自适应轮询间隔（健康服务 5min，不稳定 30s） |
| 路由热重载导致短暂中断 | 中 | Gateway 支持双配置切换，原子替换 |
| 前端页面性能 | 低 | 拓扑图使用虚拟滚动 + 懒加载 |

---

## 七、与现有文档的关系

| 文档 | 关系 |
|------|------|
| architecture-design-evaluation-2026-07-02.md | 本报告是评估报告中"缺失关键能力"的解决方案 |
| frontend-backend-mapping.md | 服务治理页面需要补充到前后端映射 |
| module-completion-status-report.md | 服务治理是新模块，需要纳入完成度矩阵 |
| business-module-inventory.md | 服务治理作为第 9 个领域加入 |
| ts-to-go-migration-logic-2026-07-02.md | 服务治理需要管理 47 个 Go 微服务的注册状态 |
| go-service-unification-design.md | 服务治理是 Go 迁移的配套基础设施 |
