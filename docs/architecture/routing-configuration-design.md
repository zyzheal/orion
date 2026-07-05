# Orion 路由配置化设计方案

**文档版本**: v1.0
**创建日期**: 2026-07-04
**状态**: 待评审
**作者**: Orion Architecture Team

---

## 一、问题概述

### 1.1 路由硬编码四层问题

当前 Orion 平台的路由配置存在 **4 层硬编码**，新增/修改服务需手动改动多个文件，极易遗漏。

| 层级 | 位置 | 硬编码方式 | 影响范围 |
|------|------|-----------|---------|
| **L1 前端页面路由** | `orion-frontend/src/router/routes.tsx` | 202 个路径全部字面量写死 | 新增页面必须手动加路由 |
| **L2 前端 API 路径** | `orion-frontend/src/api/*.ts` (245 文件) | 每个 API 客户端独立硬编码路径 | 后端路径变更需逐文件修改 |
| **L3 网关路由映射** | `orion-api-gateway/src/routes/api.ts` | 静态数组，前缀→目标硬编码 | 新服务上线需手动加路由条目 |
| **L4 Go 微服务端口/前缀** | `internal/config/config.go` + `main.go` | 端口默认值 + API 前缀硬编码 | 端口冲突风险，环境切换需改代码 |

### 1.2 具体问题清单

#### 问题 1：前端路由全硬码（L1）

```
文件: orion-frontend/src/router/routes.tsx
规模: 202 个路由条目，全部字面量路径
问题: 无配置文件，无环境变量注入，新增子应用需手动添加
```

#### 问题 2：前端 API 客户端路径分散（L2）

```
文件: orion-frontend/src/api/ 下 245 个文件
现状: baseURL 可通过 VITE_API_BASE_URL 配置 ✅
问题: 每个 API 客户端内部路径仍硬编码（如 /api/v1/pipelines）
```

#### 问题 3：网关缺失新服务注册（L3）

```
文件: orion-api-gateway/src/config/index.ts
现状: 29 个服务已注册 ✅
注册: canary / compliance / report-designer 已在 gateway/src/config/index.ts 和 routes/api.ts 中注册

文件: orion-api-gateway/src/routes/api.ts
现状: /api/v1/compliance → compliance (port 8087) ✅ 已修复
已注册: /api/v1/canary / /api/v1/canary-analysis / /api/v1/canary-ml / /api/v1/canary-config / /api/v1/compliance / /api/v1/compliance-reports / /api/v1/compliance-schedules / /api/v1/reports / /api/v1/report-definitions / /api/v1/report-datasources / /api/v1/report-schedules 共 12 条路由
```

#### 问题 4：Go 微服务端口冲突（L4）

| 服务 | 当前默认端口 | 冲突 |
|------|------------|------|
| canary-svc-go | 8086 | ✅ 无冲突 |
| compliance-svc-go | 8087 | ✅ 无冲突 |
| report-designer-svc-go | 8088 | ✅ 已修复（原 8087 与 compliance 冲突，已改为 8088） |

#### 问题 5：API 前缀硬编码在代码中

```go
// orion-canary-svc-go/cmd/server/main.go:78
rg := r.Group(cfg.APIPrefix)  // ✅ 配置化，默认 /api/v1

// orion-compliance-svc-go/cmd/server/main.go:75
rg := r.Group(cfg.APIPrefix)  // ✅ 配置化，默认 /api/v1

// orion-report-designer-svc-go/cmd/server/main.go:74
rg := r.Group(cfg.APIPrefix)  // ✅ 配置化，默认 /api/v1
```

---

## 二、架构原则

### 2.1 配置优先级

```
环境变量 > 配置文件 > 代码默认值
```

- **环境变量**: `COMPLIANCE_SVC_PORT=8087` → 最高优先级
- **配置文件**: `configs/compliance.yaml` → 次优先级
- **代码默认值**: `viper.SetDefault("server_port", 8087)` → 兜底

### 2.2 路由注册原则

```
唯一事实来源 (Single Source of Truth): gateway/src/config/index.ts
```

- 网关服务配置 = 所有服务注册的权威来源
- 路由映射自动从服务配置派生
- 新增服务只需：1) 加服务配置 2) 加路由映射（可自动）

### 2.3 端口分配原则

```
Go 微服务端口: 8080-8099 (可独立部署)
Node.js 微服务端口: 3001-3100 (现有平台服务)
网关端口: 3000
```

---

## 三、设计方案

### 3.1 L4 修复：Go 微服务端口/前缀配置化

**目标**: 端口和 API 前缀从环境变量读取，不硬编码

#### 方案：环境变量 + Viper 默认值

```go
// internal/config/config.go
type Config struct {
    ServerPort int    `mapstructure:"server_port"`  // 环境变量: COMPLIANCE_SVC_PORT
    ServerHost string `mapstructure:"server_host"`  // 环境变量: COMPLIANCE_SVC_HOST
    APIPrefix  string `mapstructure:"api_prefix"`   // 环境变量: COMPLIANCE_SVC_API_PREFIX
    // ... DB config
}

func Load() (*Config, error) {
    viper.SetDefault("server_port", 8087)      // 兜底值
    viper.SetDefault("server_host", "0.0.0.0") // 兜底值
    viper.SetDefault("api_prefix", "/api/v1")  // 统一前缀
    viper.AutomaticEnv()                        // 自动读取环境变量
    // ...
}
```

```go
// cmd/server/main.go — 配置化
func main() {
    cfg, _ := config.Load()
    
    // 端口配置化
    addr := fmt.Sprintf("%s:%d", cfg.ServerHost, cfg.ServerPort)
    
    // API 前缀配置化
    apiPrefix := cfg.APIPrefix  // 默认为 /api/v1
    rg := r.Group(apiPrefix)
    
    logger.Info("service starting",
        zap.String("service", "orion-compliance-svc"),
        zap.String("addr", addr),
        zap.String("api_prefix", apiPrefix),
    )
}
```

**环境变量示例**:

```bash
# .env 文件
COMPLIANCE_SVC_PORT=8087
COMPLIANCE_SVC_HOST=0.0.0.0
COMPLIANCE_SVC_API_PREFIX=/api/v1

CANARY_SVC_PORT=8086
CANARY_SVC_API_PREFIX=/api/v1

REPORT_DESIGNER_SVC_PORT=8088
REPORT_DESIGNER_SVC_API_PREFIX=/api/v1
```

### 3.2 L3 修复：网关新服务注册

**目标**: canary / compliance / report-designer 注册到网关

#### 变更 1：gateway/src/config/index.ts

```typescript
services: {
  // ... 现有 26 个服务 ...

  // ========== Canary Service (8086) ==========
  canary: {
    url: process.env.CANARY_SERVICE_URL || 'http://localhost:8086',
    timeout: parseInt(process.env.CANARY_TIMEOUT || '60000', 10),
  },

  // ========== Compliance Service (8087) ==========
  compliance: {
    url: process.env.COMPLIANCE_SERVICE_URL || 'http://localhost:8087',
    timeout: parseInt(process.env.COMPLIANCE_TIMEOUT || '30000', 10),
  },

  // ========== Report Designer Service (8088) ==========
  'report-designer': {
    url: process.env.REPORT_DESIGNER_SERVICE_URL || 'http://localhost:8088',
    timeout: parseInt(process.env.REPORT_DESIGNER_TIMEOUT || '30000', 10),
  },
},
```

#### 变更 2：gateway/src/routes/api.ts

```typescript
// 在 // ========== Visor Service (3034) ========== 之后添加

// ========== Canary Service (8086) ==========
{
  prefix: '/api/v1/canary',
  target: services().canary?.url || 'http://localhost:8086',
  timeout: 60000,
  stripPrefix: false,
},
{
  prefix: '/api/v1/canary-analysis',
  target: services().canary?.url || 'http://localhost:8086',
  timeout: 60000,
  stripPrefix: false,
},
{
  prefix: '/api/v1/canary-ml',
  target: services().canary?.url || 'http://localhost:8086',
  timeout: 60000,
  stripPrefix: false,
},
{
  prefix: '/api/v1/canary-config',
  target: services().canary?.url || 'http://localhost:8086',
  timeout: 30000,
  stripPrefix: false,
},

// ========== Compliance Service (8087) ==========
{
  prefix: '/api/v1/compliance',
  target: services().compliance?.url || 'http://localhost:8087',
  timeout: 30000,
  stripPrefix: false,
},
{
  prefix: '/api/v1/compliance-reports',
  target: services().compliance?.url || 'http://localhost:8087',
  timeout: 30000,
  stripPrefix: false,
},
{
  prefix: '/api/v1/compliance-schedules',
  target: services().compliance?.url || 'http://localhost:8087',
  timeout: 30000,
  stripPrefix: false,
},

// ========== Report Designer Service (8088) ==========
{
  prefix: '/api/v1/reports',
  target: services()['report-designer']?.url || 'http://localhost:8088',
  timeout: 30000,
  stripPrefix: false,
},
{
  prefix: '/api/v1/report-definitions',
  target: services()['report-designer']?.url || 'http://localhost:8088',
  timeout: 30000,
  stripPrefix: false,
},
{
  prefix: '/api/v1/report-datasources',
  target: services()['report-designer']?.url || 'http://localhost:8088',
  timeout: 30000,
  stripPrefix: false,
},
{
  prefix: '/api/v1/report-schedules',
  target: services()['report-designer']?.url || 'http://localhost:8088',
  timeout: 30000,
  stripPrefix: false,
},
```

**⚠️ 重要**: 原 `/api/v1/compliance` 路由指向 `governance (3022)`，需 **移除或替换** 为新的 compliance 服务。

### 3.3 L2 改进：前端 API 路径管理

**目标**: 减少重复硬编码，统一 API 路径定义

#### 方案 A：服务端提供 OpenAPI Spec（推荐）

后端服务提供 `/openapi.json`，前端自动生成 API 客户端。

```typescript
// 生成步骤（开发时）
// 1. 后端服务启动后暴露 /openapi.json
// 2. 使用 openapi-typescript 生成类型
// 3. 前端导入类型化的 API 函数
```

#### 方案 B：前端统一路径常量（过渡方案）

```typescript
// frontend/src/constants/api-paths.ts
export const API_PATHS = {
  CANARY: {
    BASE: '/api/v1/canary',
    RUNS: '/api/v1/canary/runs',
    CONFIGS: '/api/v1/canary/configs',
    ML_RESULTS: '/api/v1/canary/ml-results',
  },
  COMPLIANCE: {
    BASE: '/api/v1/compliance',
    REPORTS: '/api/v1/compliance/reports',
    SCHEDULES: '/api/v1/compliance/schedules',
  },
  REPORTS: {
    BASE: '/api/v1/reports',
    DEFINITIONS: '/api/v1/report-definitions',
    DATASOURCES: '/api/v1/report-datasources',
  },
} as const;
```

**设计决策：`api-paths.ts` 保持静态常量，不持久化到数据库**

| 维度 | `subapp_configs`（数据库持久化） | `api-paths.ts`（静态常量） |
|------|--------------------------------|--------------------------|
| 路径定义方 | 前端运维（入口 URL、路由前缀） | Go 后端服务（`cfg.APIPrefix + /runs`） |
| 变更频率 | 高频（新子应用上线） | 低频（后端 API 版本升级） |
| 变更触发方 | 前端团队 | 后端团队（改 Go 代码后路径跟着变） |
| 租户隔离需求 | 需要（不同租户不同子应用） | 不需要（所有租户调用相同 API） |
| 类型安全价值 | 低（JSONB 运行时解析） | **高**（`as const` + TS 类型，编译时校验） |

**核心逻辑**：API 路径是后端契约。若存入数据库，Go 服务端路径修改后前端无法自动同步，必然导致两端不一致。后端契约由后端代码定义，前端通过常量文件跟随。

**正确分工**：
- `api-paths.ts` = 后端 API 契约 → 静态常量，TypeScript 类型安全
- `page_registry` 表 = 前端页面路由 → 数据库持久化，运维可管理
- `gateway/src/config/index.ts` = 服务注册 → 静态配置 + 环境变量
- Go `.env` / Viper = 端口/前缀 → 环境变量注入

### 3.4 L1 改进：前端路由配置化（中期方案）

**目标**: 减少 `routes.tsx` 中的重复代码

#### 方案：路由元数据驱动

```typescript
// frontend/src/config/page-registry.ts
export interface PageConfig {
  path: string;
  component: string;  // lazy import path
  protected?: boolean;
  requiredPermission?: { resource: string; action: string };
  menu?: { key: string; label: string; icon?: string };
}

// 从后端配置中心或本地 JSON 加载
export const PAGE_REGISTRY: PageConfig[] = [
  {
    path: '/compliance/reports',
    component: '@/pages/compliance-svc/ComplianceReports',
    protected: true,
    menu: { key: 'compliance', label: '合规管理', icon: 'SafetyCertificateOutlined' },
  },
  // ...
];
```

---

## 四、实施优先级

### Phase 1：紧急修复（本周）

| 序号 | 任务 | 影响 | 工作量 |
|------|------|------|--------|
| 1 | report-designer 端口 8087→8088 | 高（端口冲突） | ✅ 已完成 |
| 2 | 网关注册 canary/compliance/report-designer | 高（新服务不可访问） | 30 min |
| 3 | 修复 compliance 路由指向（governance → compliance） | 高（路由错误） | 5 min |

### Phase 2：Go 服务配置化（2 周）

| 序号 | 任务 | 影响 | 工作量 |
|------|------|------|--------|
| 4 | canary-svc-go: API 前缀配置化 | 中 | 10 min |
| 5 | compliance-svc-go: API 前缀配置化 | 中 | 10 min |
| 6 | report-designer-svc-go: API 前缀配置化 | 中 | 10 min |

### Phase 3：前端 API 路径统一（1 周）

| 序号 | 任务 | 影响 | 工作量 |
|------|------|------|--------|
| 7 | 创建 `API_PATHS` 常量文件 | 中（减少重复） | 2h |
| 8 | 逐步迁移现有 API 客户端使用常量 | 中 | 4h |

### Phase 4：前端路由配置化（2 周，中期）

| 序号 | 任务 | 影响 | 工作量 |
|------|------|------|--------|
| 9 | 设计 page-registry 配置格式 | 低 | 1d |
| 10 | 实现配置加载 + 路由生成 | 中 | 3d |

---

## 五、文件变更清单

### 立即变更

| 文件 | 变更 | 类型 |
|------|------|------|
| `orion-report-designer-svc-go/internal/config/config.go` | 端口 8087→8088 | ✅ 已完成 |
| `orion-api-gateway/src/config/index.ts` | 新增 canary/compliance/report-designer | ✅ 已完成 |
| `orion-api-gateway/src/routes/api.ts` | 新增 12 条路由 + 修复 compliance | ✅ 已完成 |
| `docs/architecture/service-authority-registry.md` | 新增 3 个 Go 服务 | ✅ 已完成 |

### 后续变更

| 文件 | 变更 | 类型 |
|------|------|------|
| `orion-canary-svc-go/cmd/server/main.go` | API 前缀配置化 | ✅ 已完成 |
| `orion-compliance-svc-go/cmd/server/main.go` | API 前缀配置化 | ✅ 已完成 |
| `orion-report-designer-svc-go/cmd/server/main.go` | API 前缀配置化 | ✅ 已完成 |
| `orion-frontend/src/constants/api-paths.ts` | 新建 | ✅ 已完成 |
| `orion-frontend/src/config/page-registry.ts` | 新建（中期） | 待执行 |

---

## 六、架构评分

| 维度 | 当前 | 目标 | 差距 |
|------|------|------|------|
| 路由配置化 | 20% | 80% | 60% |
| 服务发现 | 10% | 60% | 50% |
| 环境隔离 | 50% | 90% | 40% |
| L4 配置化 | 40% | 80% | 40% |
| 新增服务成本 | 中（改 3 文件） | 低（改 1-2 文件） | - |

---

## 七、参考设计

### 7.1 统一配置中心（已有设计）

`docs/architecture/Orion统一配置中心设计文档.md` 已定义 `serviceDiscovery` 配置域（71 域之一），当前为设计阶段，待实施。

### 7.2 服务通信设计

`docs/architecture/service-communication-design.md` 定义了 HTTP + NATS JetStream 混合通信方案，与本设计的网关路由层互补。

### 7.3 Go 微服务统一设计

`docs/architecture/go-service-unification-design.md` 定义了 Go 服务标准结构和端口分配规则。

### 7.4 Phase 3 前端 API 路径统一（已实施）

`orion-frontend/src/constants/api-paths.ts` — 集中管理 CANARY / COMPLIANCE / REPORTS 路径常量，已迁移 3 个 API 客户端（canary-analysis / compliance / report-designer），替换 **35 处**硬编码路径。

**设计决策**：`api-paths.ts` 保持静态常量（`as const` TypeScript 类型安全），不持久化到数据库。API 路径是后端契约，由 Go 服务端代码定义，前端通过常量文件跟随。持久化仅适用于前端页面路由（`page_registry` 表）。

### 7.5 Phase 4 前端路由配置化（设计完成）

`docs/architecture/frontend-routing-config-design.md` — PageRegistry 接口 + 路由生成器 + 迁移方案，设计已完成。

---

## 八、运维验证与排错指南

### 8.1 验证 Go 服务配置

```bash
# 验证 canary-svc-go 配置
curl -s http://localhost:8086/healthz | jq .

# 验证 compliance-svc-go 配置
curl -s http://localhost:8087/healthz | jq .

# 验证 report-designer-svc-go 配置
curl -s http://localhost:8088/healthz | jq .

# 验证 API 前缀正确（以 canary 为例）
curl -s http://localhost:8086/api/v1/canary/healthz | jq .
```

### 8.2 验证网关路由

```bash
# 验证网关服务发现（列出所有已注册服务）
curl -s http://localhost:3000/api/v1/services | jq .

# 验证 canary 路由穿透
curl -s http://localhost:3000/api/v1/canary/healthz | jq .

# 验证 compliance 路由穿透（确认不再指向 governance）
curl -s http://localhost:3000/api/v1/compliance/healthz | jq .

# 验证 report-designer 路由穿透
curl -s http://localhost:3000/api/v1/reports/healthz | jq .

# 查看网关日志中的路由匹配记录
# 在网关启动日志中搜索 "registering route" 或 "proxy"
```

### 8.3 验证环境变量覆盖

```bash
# 方式 1：直接设置环境变量启动服务
COMPLIANCE_SVC_PORT=9090 COMPLIANCE_SVC_API_PREFIX=/api/v2 \
  go run cmd/server/main.go

# 方式 2：使用 .env 文件（需确保 viper 读取 .env）
# .env.test
COMPLIANCE_SVC_PORT=9090
COMPLIANCE_SVC_API_PREFIX=/api/v2

# 启动时加载
source .env.test && go run cmd/server/main.go

# 验证配置生效
curl -s http://localhost:9090/api/v2/compliance/healthz
```

### 8.4 排错指南

| 症状 | 可能原因 | 排查命令 |
|------|---------|---------|
| 服务启动报 "address already in use" | 端口冲突 | `lsof -i :8087` 或 `netstat -tlnp \| grep 8087` |
| 网关返回 502 Bad Gateway | 目标服务未启动或端口错误 | `curl -v http://localhost:3000/api/v1/canary/healthz` |
| 网关返回 404 路由不存在 | 路由未注册或前缀不匹配 | 检查 `gateway/src/routes/api.ts` 中的 `prefix` 字段 |
| 环境变量未生效 | viper 未加载 .env 或变量名不匹配 | 在 main.go 添加 `zap.String("port", cfg.ServerPort)` 日志 |
| API 前缀返回 404 | `cfg.APIPrefix` 值错误 | 检查启动日志中的 `api_prefix` 字段 |
| compliance 路由仍指向 governance | 旧路由未清理 | 检查 `routes/api.ts` 是否有重复的 `/api/v1/compliance` 条目 |

### 8.5 健康检查端点规范

所有 Go 微服务应实现统一的健康检查端点：

```go
// 标准健康检查响应
{
  "status": "healthy",
  "service": "orion-compliance-svc",
  "version": "1.0.0",
  "timestamp": "2026-07-04T10:00:00Z",
  "config": {
    "port": 8087,
    "api_prefix": "/api/v1"
  }
}
```

```bash
# 健康检查
curl -s http://localhost:<PORT>/healthz | jq .

#  readiness 检查（K8s 探针用）
curl -s http://localhost:<PORT>/readyz | jq .
```
