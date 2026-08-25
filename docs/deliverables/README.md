# Orion 可交付级设计文档 — 全量代码扫描缺口分析 v2.0

> **版本**: v2.0 | **日期**: 2026-08-26  
> **方法**: 全量代码扫描（非抽样），所有结论引用具体文件路径与行数  
> **后端约束**: Go (module `orion/platform-svc-go`, go 1.25.0, Gin, sqlx+pgx)  
> **公共库**: `orion/go-common` (18 packages, symlinked as `go-common`)  
> **前端**: React 18 + Ant Design 5 + Vite 5 + Vitest + Playwright

---

## 一、扫描基线

### 1.1 Go 后端 (orion-platform-svc-go)

| 指标 | 数值 | 证据 |
|------|------|------|
| Go 文件总数 | 3,816 | `find orion-platform-svc-go -name "*.go" \| wc -l` |
| 非测试文件 | 3,242 | `find ... -not -name "*_test*"` |
| 测试文件 | 590 | `find ... -name "*_test.go"` |
| 内部模块数 | 300+ | `ls orion-platform-svc-go/internal/ \| wc -l` |
| 完整实现模块 | 260 | 有 service.go + repository.go + handler.go + models.go |
| 迁移 SQL 文件 | 544 | `ls orion-platform-svc-go/migrations/*.sql \| wc -l` |
| 路由文件 | 1,083 行 | `orion-platform-svc-go/cmd/server/router.go` |
| go.mod 依赖 | Gin, sqlx, Redis, NATS, Prometheus, Viper, JWT | `orion-platform-svc-go/go.mod` |

### 1.2 orion-go-common (公共库, symlink → go-common)

| 包名 | 非测试行数 | 核心能力 |
|------|-----------|---------|
| auth | 2,265 | AuthorizationEngine(RBAC→ABAC→relationship), PermissionCache(Redis) |
| audit | 2,386 | WORMStore(Postgres/S3), UEBAEngine(6规则), ChainHasher, AlertRouter, LogSyncer |
| database | 1,029 | DB, BaseRepository, Migration(811行), RLS |
| condition | 1,002 | Engine, Evaluator, Parser, Validator |
| form | 1,192 | FormValidator, FormRenderer(JSON/HTML/React) |
| cron | 1,495 | Scheduler, History, Registry |
| dag | 313 | Graph(V), Acyclic, Directed |
| idempotency | 578 | Checker, Middleware, RedisStore, PgStore |
| messaging | 443 | 消息抽象层 |
| sse | 404 | Hub, Client, Broadcast |
| config | 251 | Viper-based |
| plugin | 216 | Plugin interface, ExecuteResult |
| errors | 216 | 错误类型 |
| sentinel | **37** | **仅错误哨兵值**(NotFound/Unauthorized/Forbidden...) — **非熔断器** |
| otel | 70 | Init(OTLP HTTP), Tracer |
| redis | 87 | Redis wrapper |
| logger | 74 | zap-based |
| middleware | 366 | interfaces, repository, service, handler |

### 1.3 前端 (orion-frontend)

| 指标 | 数值 | 证据 |
|------|------|------|
| 页面 (.tsx) | 679 | `find src/pages -name "*.tsx" \| wc -l` |
| API 模块 | 177 | `ls src/api/*.ts \| wc -l` |
| 组件 | 106 | `ls src/components/` (含 ErrorBoundary, PageSkeleton, PermissionGate 等) |
| Hooks | 15 | `src/hooks/*.ts` |
| Stores | 8 | `src/stores/*.ts` (Zustand) |
| 测试文件 | 295 | `find src -name "*.test.*" \| wc -l` |
| API 测试覆盖 | 13/177 (7.3%) | `ls src/api/__tests__/*.test.ts` |
| Design Tokens | 13 文件 1,564 行 | `src/tokens/` (colors, spacing, typography, shadows...) |
| ErrorBoundary | **已存在** | `src/components/ErrorBoundary/PageErrorBoundary.tsx` — 已在 router/index.tsx 中包裹全部路由 |
| PageSkeleton | **已存在** | `src/components/PageSkeleton/index.tsx` — Skeleton-based 骨架屏 |
| i18n 使用率 | **0/679 (0%)** | `grep -rl "useTranslation" src/pages/` → 空 |
| E2E 测试 | 1 文件 | `tests/e2e/login.spec.ts` (playwright.config.ts 已配置) |
| Lighthouse CI | 未配置 | 无 `.lighthouserc` 文件 |
| Web Vitals | 未集成 | 无 `web-vitals` 依赖 |
| client.ts | 260 行 | 已有 Axios 拦截器、401 刷新队列、统一错误处理 |

### 1.4 非 Go 服务 (不在本次 Go 设计范围内但需知悉)

| 服务 | 语言 | 路径 |
|------|------|------|
| orion-api-gateway | TypeScript | `orion-api-gateway/src/` |
| orion-runner-agent | TypeScript | `orion-runner-agent/src/` |
| orion-ai-service | Python | `orion-ai-service/src/` |
| orion-ai-agents-svc | Python | `orion-ai-agents-svc/app/` |
| orion-intelligence-svc | Python | `orion-intelligence-svc/src/` |
| orion-visor | Java (Maven) | `orion-visor/` |
| orion-knowledge | Go | `orion-knowledge/backend/` |

---

## 二、已交付方案与本地实际状态对照

### 2.1 已有交付物清单

| Plan | 名称 | 状态 | 本地实际状态 | 差异 |
|------|------|:----:|-------------|------|
| 01 | API 统一客户端 | ✅ 已交付 | `src/api/client.ts` 260行已存在 | 交付代码是增强版，本地已有基础版 |
| 02 | 设计令牌系统 | ✅ 已交付 | `src/tokens/` 13文件1,564行**已存在** | 本地已实现，交付物可作参考增强 |
| 03 | 构建优化 | ✅ 已交付 | Vite 5 已配置 | 需验证 splitChunk 等优化项 |
| 04 | E2E 测试框架 | ✅ 已交付 | `playwright.config.ts` 已有，仅 1 个测试 | **交付物提供更多测试用例** |
| 05 | 骨架屏加载 | ✅ 已交付 | `src/components/PageSkeleton/` **已存在** | 本地已实现，交付物可作参考增强 |
| 06 | 状态管理 | ✅ 已交付 | 8 个 Zustand stores 已存在 | 交付物提供统一模式 |
| 07 | i18n 国际化 | ✅ 已交付 | 后端 i18n 模块已存在，**前端 0% 使用** | **交付物需要与后端 API 对接** |
| 08 | 错误边界 | ✅ 已交付 | `PageErrorBoundary.tsx` **已存在且已在 router 中使用** | 交付物应基于现有实现增强 |
| 09 | database-devops | ✅ 已交付 | `internal/database-devops/` 有 3 文件 (无测试) | **需补充 service 实现** |

### 2.2 已交付 Go 代码 (plan-09, 21, 24, 26-29)

| Plan | 名称 | 交付文件 | 本地对应模块 | 差异分析 |
|------|------|---------|-------------|---------|
| 09 | database-devops | handler.go+models.go+repository.go+service.go+schema.sql | `internal/database-devops/` (3文件, 无测试) | 交付物比本地多 service.go+schema.sql |
| 21 | 红队评估 | redteam.go (215行) | 无独立模块 | **全新能力，需新建 `internal/red-team/`** |
| 24 | 事件驱动 | event_bus.go (156行) | `internal/eventbus/` (10文件, 632行) | **本地已有更完整实现**，交付物的 SchemaRegistry 需合并 |
| 26 | 供应链安全 | scanner.go (162行) | `internal/supply-chain/` (5文件) | 交付物有扫描逻辑，本地只有 CRUD |
| 27 | DLP 引擎 | dlp_engine.go (205行) | `internal/data-masking/` + `internal/privacy/` | 本地有 masking 和 privacy，**缺 DLP 中间件** |
| 28 | 混沌工程 | chaos.go (205行) | `internal/chaos/` (10文件) + `internal/chaos-enhanced/` | 本地已有更完整实现，**缺真实故障注入** |
| 29 | 多租户隔离 | multitenancy.go (260行) | `internal/tenant/` + `internal/tenant-quota/` + RLS | 本地已有，**需审计 RLS 覆盖率** |

---

## 三、缺口分析与设计方案 (按优先级)

### P0-01: i18n 国际化 — 前端完全未接入

**本地证据**:
- `orion-frontend/src/locales/zh-CN.json`: 273 行，仅 5 命名空间 (alertRuleEditor:17, dashboardTemplateMarket:11, cmdbDrift:11, testExecution:10, formRenderer:15)
- `grep -rl "useTranslation" orion-frontend/src/pages/` → **0 个文件** (679 页面全部硬编码中文)
- 后端 i18n: `orion-platform-svc-go/internal/i18n/service/service.go` 已有完整 CRUD (CreateLocale, SetTranslation, GetAllTranslations, SetBulkTranslations)
- 前端 API: `orion-frontend/src/api/i18n.ts` 已定义 I18nLocale/I18nTranslation 接口

**与 Plan-07 交付物的差异**:
- Plan-07 提供独立的 i18n 引擎 (i18n.ts + IntlProvider.tsx + zh-CN.ts + en-US.ts)
- 本地后端已有 i18n API，Plan-07 交付物**未与后端 API 对接**
- Plan-07 提供的翻译条目仅 ~80 条，679 页面需要数千条

**合并方案**:
1. **采用 Plan-07 的 IntlProvider + useIntl 模式**作为前端框架
2. **增强**: IntlProvider 初始化时从 `/api/v1/i18n/locales` 拉取租户翻译，合并本地 fallback
3. **增强**: 添加 `scripts/extract-i18n.ts` 提取脚本，扫描 679 页面硬编码中文
4. **后端无改动**: 后端 i18n 模块已完整

```typescript
// 增强 Plan-07 的 i18n.ts — 增加后端 API 同步
class I18n {
  // ... Plan-07 原有代码 ...
  
  // 新增: 从后端 API 加载租户翻译
  async loadFromServer(tenantId: string): Promise<void> {
    try {
      const [localesRes, translationsRes] = await Promise.all([
        fetch('/api/v1/i18n/locales'),
        fetch(`/api/v1/i18n/translations?locale=${this.state.locale}`),
      ]);
      const locales = await localesRes.json();
      const translations = await translationsRes.json();
      // 合并服务器翻译到本地 (服务器优先)
      this.serverMessages = new Map(Object.entries(translations));
    } catch {
      // 降级: 仅使用本地翻译
    }
  }
  
  t(key: string, fallback?: string): string {
    // 优先: 服务器翻译 → 本地翻译 → fallback
    return this.serverMessages?.get(key) 
      ?? this.current.messages[key] 
      ?? fallback ?? key;
  }
}
```

**涉及文件**: 
- 合并 Plan-07 交付物到 `src/i18n/` (i18n.ts, IntlProvider.tsx, locales/)
- 修改: IntlProvider.tsx 增加后端 API 同步
- 新建: `scripts/extract-i18n.ts` (i18n 提取脚本)
- 修改: 679 个页面文件 (批量替换，分批执行)

---

### P0-02: 前端 API 测试覆盖 — 7.3% → 目标 50%

**本地证据**:
- 177 个 API 模块，仅 13 个有测试: ai-security, api-key, backup, client, cron, eventbus, knowledge, llm-trace, notificationRules, plugin-spi, session, test-selector, webhook
- **无测试的核心模块**: auth.ts, projects.ts, pipelines.ts, deployments.ts, cmdb.ts, agents.ts, ai-gateway.ts, alert.ts, incident.ts, ticketing.ts

**可借鉴模式**: `src/api/__tests__/client.test.ts` (完整测试 client.ts 拦截器、401 刷新、错误处理)

**设计方案**:
```
按优先级补全:
P0 (核心业务): auth, projects, pipelines, deployments, cmdb, agents, ai-gateway
P1 (重要业务): alert, incident, ticketing, artifact, backup, chaos, sbom
P2 (其余 164 个模块)
CI 门禁: vitest --coverage --threshold=50 (API 模块覆盖)
```

---

### P0-03: Circuit Breaker — 有数据模型无中间件集成

**本地证据**:
- 后端: `internal/circuit-breaker/service/service.go` (251 行) — 有 Create/Get/List/RecordFailure/RecordSuccess/Evaluate
- **关键缺口**: `grep -l "circuit\|breaker" internal/middleware/*.go` → 空 (middleware 无熔断器)
- `router.go` 中间件链: RateLimit + Timeout + SecurityHeaders + Prometheus — **无 CircuitBreaker**
- 前端: `src/api/circuit-breaker.ts` 头部 "Backend API not yet implemented"
- `orion-go-common/pkg/sentinel/sentinel.go` (37 行) — **仅错误哨兵值，非熔断器**

**设计方案**:

```go
// 新建: orion-platform-svc-go/internal/middleware/circuit_breaker.go

package middleware

import (
    "sync"
    "time"
    "github.com/gin-gonic/gin"
)

type CircuitState string

const (
    StateClosed   CircuitState = "closed"
    StateOpen     CircuitState = "open"
    StateHalfOpen CircuitState = "half-open"
)

type circuitBreaker struct {
    mu               sync.RWMutex
    state            CircuitState
    failureCount     int
    successCount     int
    failureThreshold int
    successThreshold int
    timeout          time.Duration
    openedAt         time.Time
}

type CircuitBreakerConfig struct {
    FailureThreshold int           // default: 5
    SuccessThreshold int           // default: 3
    Timeout          time.Duration // default: 30s
}

// CircuitBreaker 返回 Gin 中间件
// - closed: 正常请求，记录失败/成功
// - open: 拒绝请求返回 503，超时后转 half-open
// - half-open: 放行请求，成功>=threshold 转 closed，失败转 open
func CircuitBreaker(cfg CircuitBreakerConfig) gin.HandlerFunc {
    cb := &circuitBreaker{
        state:            StateClosed,
        failureThreshold: cfg.FailureThreshold,
        successThreshold: cfg.SuccessThreshold,
        timeout:          cfg.Timeout,
    }
    if cb.failureThreshold == 0 { cb.failureThreshold = 5 }
    if cb.successThreshold == 0 { cb.successThreshold = 3 }
    if cb.timeout == 0 { cb.timeout = 30 * time.Second }
    
    return func(c *gin.Context) {
        cb.mu.RLock()
        state := cb.state
        cb.mu.RUnlock()
        
        if state == StateOpen {
            if time.Since(cb.openedAt) > cb.timeout {
                cb.mu.Lock()
                cb.state = StateHalfOpen
                cb.failureCount = 0
                cb.successCount = 0
                cb.mu.Unlock()
            } else {
                c.Header("Retry-After", strconv.Itoa(int(cb.timeout.Seconds())))
                c.AbortWithStatusJSON(503, gin.H{
                    "error": gin.H{
                        "code": "CIRCUIT_OPEN",
                        "message": "circuit breaker is open",
                    },
                })
                return
            }
        }
        
        c.Next()
        
        status := c.Writer.Status()
        cb.mu.Lock()
        if status >= 500 {
            cb.failureCount++
            if cb.failureCount >= cb.failureThreshold {
                cb.state = StateOpen
                cb.openedAt = time.Now()
            }
        } else if status < 400 {
            if cb.state == StateHalfOpen {
                cb.successCount++
                if cb.successCount >= cb.successThreshold {
                    cb.state = StateClosed
                }
            } else {
                cb.failureCount = 0 // 重置失败计数
            }
        }
        cb.mu.Unlock()
    }
}
```

**涉及文件**:
- 新建: `orion-platform-svc-go/internal/middleware/circuit_breaker.go`
- 修改: `orion-platform-svc-go/cmd/server/router.go` — 中间件链添加 CircuitBreaker
- 修改: `orion-frontend/src/api/circuit-breaker.ts` — 移除 "not yet implemented" 注释

---

### P0-04: E2E 测试 — 仅 1 个登录测试

**本地证据**: 
- `orion-frontend/playwright.config.ts`: 配置完善 (chromium, trace on-first-retry, screenshot only-on-failure)
- `orion-frontend/tests/e2e/login.spec.ts`: 仅 1 个文件
- 679 页面中仅登录页有 E2E

**与 Plan-04 交付物的合并**:
- Plan-04 提供了 `auth.spec.ts`, `devops-pipeline.spec.ts`, `security-scan.spec.ts` 三个测试
- 合并 Plan-04 的测试文件到 `tests/e2e/`
- 补充核心业务流程测试

**合并后 E2E 文件列表**:
```
tests/e2e/
├── login.spec.ts          # 已有
├── auth.spec.ts           # ← 来自 Plan-04 (权限控制测试)
├── devops-pipeline.spec.ts # ← 来自 Plan-04 (Pipeline 流程)
├── security-scan.spec.ts   # ← 来自 Plan-04 (安全扫描)
├── dashboard.spec.ts       # 新增: Dashboard 加载验证
├── cmdb.spec.ts            # 新增: CMDB CI 类型→实例
├── ticket-flow.spec.ts     # 新增: 工单创建→审批→关闭
├── deploy.spec.ts          # 新增: 部署→灰度→回滚
└── helpers/                # ← 来自 Plan-04 的 fixtures/helpers/assertions
```

---

### P1-01: Web Vitals 性能监控 — 完全缺失

**本地证据**: `grep -rl "web-vitals" orion-frontend/src/` → 空; `package.json` 无 web-vitals 依赖
**可借鉴**: `orion-platform-svc-go/internal/middleware/prometheus.go` (149行) — 后端 HTTP 指标已有

**设计方案**:
```typescript
// 新建: orion-frontend/src/lib/web-vitals.ts
import { onCLS, onLCP, onFID, onINP, onTTFB, Metric } from 'web-vitals';

function sendMetric(metric: Metric) {
  navigator.sendBeacon('/api/v1/metrics/web-vitals', JSON.stringify({
    name: metric.name, value: metric.value, rating: metric.rating,
    pathname: window.location.pathname,
  }));
}

export function initWebVitals() {
  onCLS(sendMetric); onLCP(sendMetric); onFID(sendMetric);
  onINP(sendMetric); onTTFB(sendMetric);
}
```
```go
// 新增 handler: orion-platform-svc-go/internal/metrics/handler/web_vitals.go
// 接收前端 Web Vitals，写入 Prometheus + DB
```

---

### P1-02: Lighthouse CI 性能门禁 — 未配置

**本地证据**: 无 `.lighthouserc` 文件; `package.json` 无 lighthouse 命令

**设计方案**: 
```json
// 新建: orion-frontend/.lighthouserc.json
{
  "ci": {
    "collect": { "url": ["http://localhost:3000/dashboard", "http://localhost:3000/pipelines"], "numberOfRuns": 3 },
    "assert": { "assertions": { "categories:performance": ["error", {"minScore": 0.8}], "categories:accessibility": ["error", {"minScore": 0.9}] } },
    "upload": { "target": "filesystem", "outputDir": "lighthouse-reports" }
  }
}
```

---

### P1-03: 消息队列 — 内存模式未接入 NATS

**本地证据**:
- `go.mod`: `github.com/nats-io/nats.go v1.52.0` 已在依赖
- `internal/eventbus/service/eventbus_service.go` (284行): 使用 `busConn` (本地内存)
- `internal/eventbus/service/conn.go` (248行): `newBusConn()` — 纯内存 pub/sub
- NATS 依赖已安装但未使用

**与 Plan-24 交付物的合并**:
- Plan-24 提供了 `event_bus.go` (156行) 含 SchemaRegistry — 可合并到本地 eventbus
- 本地 eventbus 已有更完整的 service (632行) + repository + models
- **合并方向**: 在本地 eventbus 基础上增加 NATS 连接 + Plan-24 的 SchemaRegistry

**设计方案**:
```go
// 新建: orion-platform-svc-go/internal/eventbus/service/nats_conn.go
// 使用 nats.go v1.52.0 (已在 go.mod)
type natsBusConn struct {
    nc *nats.Conn
    js nats.JetStreamContext  // 持久化消息
}
// 实现 busConn 接口，替换内存版
```
```go
// 合并 Plan-24 的 SchemaRegistry 到:
// orion-platform-svc-go/internal/eventbus/service/schema_registry.go
```

---

### P1-04: OTel 链路追踪 — 中间件已有但服务层未接入

**本地证据**:
- `internal/middleware/tracing.go`: 完整 OTel 中间件 (Extract/Inject trace ID, 创建 server span, 传播到 gin context)
- `grep -r "otel\.\|tracer\.Start" internal/ --include="*.go" -l`: **仅 5 个 handler 文件**引用 OTel
- 300+ 模块中 95%+ 无 span 追踪
- `orion-go-common/pkg/otel/otel.go` (70行): 仅 Init + Tracer，缺少 Span 工具函数

**设计方案**:
```go
// 新建: orion-go-common/pkg/otel/tracing.go
func StartSpan(ctx context.Context, name string, attrs ...attribute.KeyValue) (context.Context, trace.Span)
func RecordError(ctx context.Context, err error)
func SetDBSpanAttributes(ctx context.Context, operation, table string)
```
```go
// 使用示例 (在 service 层):
func (s *Service) Create(ctx context.Context, ...) {
    ctx, span := otel.StartSpan(ctx, "circuit-breaker.Create")
    defer span.End()
    // ... 业务逻辑 ...
    if err != nil { otel.RecordError(ctx, err) }
}
```

---

### P1-05: Self-Healing 自愈 — 有 CRUD 无执行器

**本地证据**:
- `internal/self-healing/`: 有 handler + repository (3文件) + models
- **无 service.go** — 只有 `action_repository_interface.go`
- 无与 K8s API 的集成

**设计方案**:
```go
// 新建: orion-platform-svc-go/internal/self-healing/service/service.go
type ActionType string
const (
    ActionRestartPod     ActionType = "restart_pod"
    ActionScaleDeploy    ActionType = "scale_deployment"
    ActionCleanCache     ActionType = "clean_cache"
    ActionRollbackDeploy ActionType = "rollback_deployment"
)

type Service struct {
    repo      repository.RepositoryInterface
    actionRepo repository.ActionRepositoryInterface
    k8sClient  *kubernetes.Clientset
    alertCh    <-chan AlertEvent
}

func (s *Service) StartHealLoop(ctx context.Context) { /* 监听告警 → 匹配规则 → 执行动作 */ }
func (s *Service) executeAction(ctx context.Context, rule *models.HealingRule, alert AlertEvent) { /* K8s API 调用 */ }
```

---

### P1-06: Chaos Engineering — 有框架无真实故障注入

**本地证据**:
- `internal/chaos/service/service.go`: 有 ExecuteCPUSpike/ExecuteMemoryLeak/ExecuteNetworkLatency/ExecuteServiceDown
- `internal/chaos/anomaly/detector.go`: 有异常检测
- **关键缺口**: Execute 函数仅创建 `InjectResult` 记录，不执行真实故障注入
- 无 Docker/K8s API 集成

**与 Plan-28 交付物的合并**:
- Plan-28 提供了 `chaos.go` (205行) 含 FaultType 定义、Scenario、Experiment、ExperimentResult
- 本地 `internal/chaos/` 已有更完整的模块 (10文件)
- **合并方向**: 采用 Plan-28 的 FaultType 扩展，增加真实故障注入执行器

**设计方案**:
```go
// 新建: orion-platform-svc-go/internal/chaos/service/injector.go
type FaultInjector struct {
    dockerCli *client.Client
    k8sClient  *kubernetes.Clientset
}

// 真实故障注入 (使用 Docker exec 或 K8s API)
func (i *FaultInjector) InjectNetworkLatency(ctx context.Context, target string, latency time.Duration) error
func (i *FaultInjector) InjectCPUStress(ctx context.Context, target string, cores int, duration time.Duration) error
func (i *FaultInjector) KillPod(ctx context.Context, namespace, podName string) error
```

---

### P1-07: Swagger/OpenAPI 自动生成 — 无生成管线

**本地证据**:
- `orion-platform-svc-go/docs/swagger.yaml` + `swagger.json`: 存在但手动维护
- 1,083 行路由注册 (`router.go`) 无 swagger 注解
- 无 `swag` 工具依赖，无 Makefile 生成命令

**设计方案**:
```makefile
# 新建: orion-platform-svc-go/Makefile
swagger:
    swag init -g cmd/server/main.go --parseDependency --parseInternal \
        -d docs --outputTypes json,yaml --exclude internal/test \
        --title "Orion Platform API" --version "1.0" --basePath "/api/v1"
```
```go
// 修改: router.go 添加 swagger 路由
r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
```

---

### P1-08: Supply Chain Security — 有 CRUD 无实际扫描

**本地证据**:
- `internal/supply-chain/`: 有 handler + repository + models (5文件) — CRUD only
- `internal/sbom/`: 有 SBOM 模块
- `internal/vulnerability/`: 有漏洞管理
- **无实际 SBOM 生成** (无 syft/trivy 集成)

**与 Plan-26 交付物的合并**:
- Plan-26 提供了 `scanner.go` (162行) 含 Vulnerability、SBOMReport、Scanner 类型
- 本地 `internal/supply-chain/` 有更完整的 CRUD 模块
- **合并方向**: 将 Plan-26 的 Scanner 逻辑合并到本地 supply-chain 模块

**设计方案**:
```go
// 合并 Plan-26 scanner.go 到:
// orion-platform-svc-go/internal/supply-chain/service/scanner.go
// 增加 syft/trivy 命令行集成
func (s *Scanner) ScanImage(ctx context.Context, image string) (*SBOMReport, error) {
    cmd := exec.CommandContext(ctx, "syft", "scan", "-o", "json", image)
    // ...
}
```

---

### P1-09: 多数据源管理 — 无统一数据源抽象层

**本地证据**:
- `orion-go-common/pkg/database/db.go` (90行): 只有单一 Postgres 连接
- `orion-go-common/pkg/database/repository.go` (128行): BaseRepository 绑定单一 DB
- 无多数据源管理模块 (MySQL, ClickHouse, ES, MongoDB)
- `internal/finops/report-designer/datasource/`: 有数据源概念但仅限报表

**设计方案**:
```go
// 新建: orion-platform-svc-go/internal/datasource/service/service.go
type DataSourceType string
const (
    DSCPostgres   DataSourceType = "postgres"
    DSCMySQL      DataSourceType = "mysql"
    DSCClickHouse DataSourceType = "clickhouse"
    DSCElasticsearch DataSourceType = "elasticsearch"
    DSCMongoDB    DataSourceType = "mongodb"
)

type DataSourceManager struct {
    sources map[string]*ManagedDataSource
    secret  *secret.Service // 复用 internal/secret AES-256-GCM 加密
}

func (m *DataSourceManager) Register(ctx context.Context, ds *DataSource) error
func (m *DataSourceManager) Query(ctx context.Context, dsID string, sql string, args ...any) (*QueryResult, error)
func (m *DataSourceManager) HealthCheck(ctx context.Context, dsID string) error
```

---

### P1-10: DLP 数据防泄漏 — 有 masking 无全链路 DLP

**本地证据**:
- `internal/data-masking/`: 有 handler + repository + models + service (有测试)
- `internal/data-classification/`: 有 interfaces + handler + repository + models + service (有测试)
- `internal/privacy/`: 有 handler + repository + models + service (有测试)
- **缺口**: 无出站流量扫描 (API 响应、导出文件)，无实时拦截中间件

**与 Plan-27 交付物的合并**:
- Plan-27 提供了 `dlp_engine.go` (205行) 含 DLPRule、DLPResult、DLPEngine (Scan/Mask/Block)
- 本地已有 data-masking + data-classification + privacy 三个模块
- **合并方向**: 将 Plan-27 的 DLPEngine 作为中间件，调用本地 data-masking service

**设计方案**:
```go
// 新建: orion-platform-svc-go/internal/middleware/dlp.go
// 合并 Plan-27 的 DLPRule/Pattern 逻辑
type DLPScanner struct {
    rules   []DLPRule          // ← 来自 Plan-27
    masking *datamasking.Service // ← 本地已有
}

// DLP 中间件 — 出站响应扫描
func DLP(scanner *DLPScanner) gin.HandlerFunc {
    return func(c *gin.Context) {
        writer := &dlpResponseWriter{c.Writer, &bytes.Buffer{}}
        c.Writer = writer
        c.Next()
        // 扫描响应体，匹配 DLPRule，执行 mask/block/log
    }
}
```

---

### P1-11: 灾备编排 — 有 CRUD 无实际 DR 流程

**本地证据**:
- `internal/disaster-recovery/`: 有 handler + repository + models (CRUD)
- `internal/dr/`: 有独立 DR 模块
- **无实际灾备切换流程编排**

**设计方案**:
```go
// 新建: orion-platform-svc-go/internal/disaster-recovery/service/orchestrator.go
type DROrchestrator struct {
    repo  RepositoryInterface
    steps []DRStep
}

type DRStep struct {
    ID      string
    Name    string
    Action  func(ctx context.Context) error
    Timeout time.Duration
    OnFail  string // continue | abort | retry
}

func (o *DROrchestrator) Failover(ctx context.Context, planID string) (*DRResult, error)
func (o *DROrchestrator) HealthCheck(ctx context.Context) (*DRHealth, error)
```

---

### P1-12: AI 巨型模块拆分

**本地证据**:
- `internal/ai/` 下 30 个子目录: agents, aiagent, aicost, aigateway, aireview, aisecurity, auto-recovery, code-embedding, cost, decisions, degradation, gateway, handler, inference, intelligence, knowledge, llm, llm-provider, llm-trace, models, orchestration, prompt-security, repository, review, rule-engine, security, semantic-search, service, skill, task-executor, vector
- 159 个 Go 文件，32 个测试 (20% 覆盖)
- 系统中最大模块

**设计方案**:
```
拆分 internal/ai/ → 6 个独立模块:
internal/ai-gateway/     — LLM 路由、provider 管理、token bucket
internal/ai-trace/        — LLM trace、cost 追踪
internal/ai-security/     — prompt-security、红队评估
internal/ai-knowledge/    — semantic-search、code-embedding、vector
internal/ai-agents/       — agent 执行、orchestration、task-executor
internal/ai-shared/       — models、repository (共享)
```

---

### P1-13: 事件 Schema Registry — 合并 Plan-24

**本地证据**: `internal/eventbus/` 有完整模块但无 Schema Registry
**Plan-24 交付物**: `event_bus.go` 含 SchemaRegistry + EventSchema + FieldDef + 兼容性检查

**合并方案**: 将 Plan-24 的 SchemaRegistry 提取为独立文件
```go
// 新建: orion-platform-svc-go/internal/eventbus/service/schema_registry.go
// ← 来自 Plan-24 event_bus.go 的 SchemaRegistry 部分
```

---

### P1-14: 多租户 RLS 覆盖审计

**本地证据**:
- `migrations/002_enable_rls.sql`: 已启用 RLS
- `orion-go-common/pkg/database/rls_test.go`: 有 RLS 测试
- 544 个迁移文件中仅 2 个顶层 RLS 文件 — 部分模块可能未启用 RLS

**与 Plan-29 交付物的合并**:
- Plan-29 提供了 `multitenancy.go` (260行) 含 TenantStore、BoundaryChecker、QuotaEnforcer、ABACEvaluator
- 本地已有 `internal/tenant/` + `internal/tenant-quota/` + RLS
- **合并方向**: 采用 Plan-29 的 BoundaryChecker 增强 RLS 审计

**设计方案**:
```sql
-- 新建: migrations/audit_rls_coverage.sql
-- 审计所有表的 RLS 状态
SELECT schemaname, tablename, rowsecurity, forcerowsecurity
FROM pg_tables WHERE schemaname = 'public' ORDER BY rowsecurity, tablename;
-- 批量为未启用的表启用 RLS
```

---

### P1-15: 红队评估 — 全新能力

**本地证据**: 无独立红队评估模块
**Plan-21 交付物**: `redteam.go` (215行) 含 AttackScenario、Evaluator、AssessmentReport

**合并方案**: 将 Plan-21 作为新模块
```
新建: orion-platform-svc-go/internal/red-team/
├── handler/handler.go
├── models/models.go
├── service/service.go
└── redteam.go  ← 来自 Plan-21 (重命名)
```

---

## 四、可借鉴的现有能力索引

### 4.1 已完整实现可直接复用

| 能力 | 文件路径 | 行数 | 复用场景 |
|------|---------|------|---------|
| RBAC+ABAC 授权 | `orion-go-common/pkg/auth/authorization_engine.go` | 592 | 新模块权限控制 |
| UEBA 异常检测 | `orion-go-common/pkg/audit/ueba.go` | 822 | 行为分析、安全审计 |
| WORM 审计存储 | `orion-go-common/pkg/audit/worm.go` | 343 | 合规审计 |
| ChainHasher | `orion-go-common/pkg/audit/chain.go` | 138 | 审计链验证 |
| 条件引擎 | `orion-go-common/pkg/condition/evaluator.go` | 476 | 规则引擎 |
| DAG 图引擎 | `orion-go-common/pkg/dag/dag.go` | 269 | Pipeline 依赖 |
| 幂等中间件 | `orion-go-common/pkg/idempotency/middleware.go` | 206 | POST/PUT 幂等 |
| SSE Hub | `orion-go-common/pkg/sse/hub.go` | 223 | 实时推送 |
| 分布式锁 | `internal/lock/lock.go` | - | 分布式互斥 |
| 表单引擎 | `orion-go-common/pkg/form/validator.go` | 392 | 动态表单 |
| 迁移引擎 | `orion-go-common/pkg/database/migrate.go` | 811 | DB 版本管理 |
| Tracing 中间件 | `internal/middleware/tracing.go` | - | 全链路追踪 |
| Rate Limit | `internal/middleware/ratelimit.go` | 359 | API 限流 (token bucket) |
| Security Headers | `internal/middleware/security.go` | 48 | 安全响应头 |
| Prometheus 指标 | `internal/middleware/prometheus.go` | 149 | HTTP 指标采集 |
| Secret 加密 | `internal/secret/service/service.go` | 360 | AES-256-GCM |
| LLM Trace | `internal/llm/service/llm_service.go` | 374 | LLM 调用追踪 |
| 事件总线 | `internal/eventbus/service/eventbus_service.go` | 284 | 事件发布订阅 |
| Circuit Breaker CRUD | `internal/circuit-breaker/service/service.go` | 251 | 熔断器数据管理 |
| PageErrorBoundary | `src/components/ErrorBoundary/PageErrorBoundary.tsx` | - | 前端错误边界 (已使用) |
| PageSkeleton | `src/components/PageSkeleton/index.tsx` | - | 骨架屏 (已使用) |
| Design Tokens | `src/tokens/` | 1,564 | 设计令牌 (已使用) |
| API Client | `src/api/client.ts` | 260 | Axios 统一客户端 |

### 4.2 部分实现需补充

| 能力 | 现有部分 | 缺失部分 | 对应方案 |
|------|---------|---------|---------|
| Circuit Breaker | service (251行) | middleware 集成 | P0-03 |
| 消息队列 | eventbus (内存) | NATS JetStream | P1-03 |
| OTel 追踪 | middleware (完整) | service 层 span | P1-04 |
| Self-Healing | repository + models | service 执行器 | P1-05 |
| Chaos | service + detector | 真实故障注入 | P1-06 |
| Swagger | 静态文件 | 自动生成管线 | P1-07 |
| Supply Chain | CRUD | syft/trivy 扫描 | P1-08 |
| DLP | data-masking | 出站扫描中间件 | P1-10 |
| 灾备 | CRUD | 切换编排 | P1-11 |
| i18n | 后端 CRUD | 前端集成 | P0-01 |
| E2E | config + 1 test | 业务流程测试 | P0-04 |
| 多租户 RLS | 部分表 | 全覆盖审计 | P1-14 |

---

## 五、合并后文件清单

```
docs/deliverables/
├── README.md                                    # 本文件 (合并后索引)
│
├── plan-01-api-client/README.md                 # API 客户端 (与本地 client.ts 对照)
├── plan-02-design-tokens/README.md               # 设计令牌 (本地已实现)
├── plan-03-build-optimization/README.md           # 构建优化
├── plan-04-e2e-testing/README.md                 # E2E 测试 (合并到 tests/e2e/)
├── plan-05-skeleton-loading/README.md             # 骨架屏 (本地已实现)
├── plan-06-state-management/README.md             # 状态管理
├── plan-07-i18n/README.md                         # i18n (需增强后端 API 对接)
├── plan-08-error-boundary/README.md               # 错误边界 (本地已实现)
├── plan-09-database-devops/                       # DB DevOps Go 代码
│   ├── handler.go
│   ├── models.go
│   ├── repository.go
│   ├── service.go
│   └── schema.sql
│
├── plan-21-red-team/redteam.go                   # 红队评估 Go 代码
├── plan-24-event-driven/event_bus.go              # 事件驱动 (Schema Registry 合并)
├── plan-26-supply-chain/scanner.go               # 供应链扫描 Go 代码
├── plan-27-dlp/dlp_engine.go                     # DLP 引擎 Go 代码
├── plan-28-chaos/chaos.go                         # 混沌工程 Go 代码
├── plan-29-multitenancy/multitenancy.go           # 多租户 Go 代码
│
├── plan-31-circuit-breaker/                      # ← 新增: 熔断器中间件
│   └── circuit_breaker.go
├── plan-32-web-vitals/                           # ← 新增: Web Vitals 监控
│   ├── web-vitals.ts
│   └── web_vitals.go
├── plan-33-lighthouse-ci/                         # ← 新增: Lighthouse CI 门禁
│   └── .lighthouserc.json
├── plan-34-nats-jetstream/                       # ← 新增: NATS JetStream 接入
│   └── nats_conn.go
├── plan-35-otel-service-span/                    # ← 新增: OTel 服务层 span
│   └── tracing.go
├── plan-36-self-healing/                         # ← 新增: 自愈执行器
│   └── service.go
├── plan-37-chaos-injector/                      # ← 新增: 真实故障注入
│   └── injector.go
├── plan-38-swagger-gen/                          # ← 新增: Swagger 自动生成
│   └── Makefile
├── plan-39-datasource-mgr/                      # ← 新增: 多数据源管理
│   └── service.go
├── plan-40-dlp-middleware/                      # ← 新增: DLP 出站中间件
│   └── dlp.go
├── plan-41-dr-orchestrator/                     # ← 新增: 灾备编排
│   └── orchestrator.go
├── plan-42-ai-module-split/                     # ← 新增: AI 模块拆分
│   └── README.md
├── plan-43-schema-registry/                     # ← 新增: 事件 Schema Registry
│   └── schema_registry.go
├── plan-44-rls-audit/                           # ← 新增: RLS 覆盖审计
│   └── audit_rls_coverage.sql
└── plan-45-api-test-coverage/                   # ← 新增: API 测试补全
    └── README.md
```

---

## 六、实施优先级

### Phase 1 (P0 — 立即执行)
| # | 方案 | 来源 | 核心改动 |
|---|------|------|---------|
| 1 | i18n 前端集成 | Plan-07 增强 | 679 页面接入 i18n + 后端 API 对接 |
| 2 | API 测试补全 | 新增 | 164 个无测试模块补全 |
| 3 | Circuit Breaker middleware | 新增 | 新建 middleware + router 注册 |
| 4 | E2E 测试扩展 | Plan-04 合并 | 7 个核心业务流程测试 |

### Phase 2 (P1 — 近期执行)
| # | 方案 | 来源 | 核心改动 |
|---|------|------|---------|
| 5 | Web Vitals 监控 | 新增 | 前端采集 + 后端接收 |
| 6 | Lighthouse CI | 新增 | .lighthouserc 配置 |
| 7 | NATS JetStream | 新增 | 替换内存 eventbus |
| 8 | OTel service span | 新增 | go-common otel 增强 |
| 9 | Self-Healing 执行器 | 新增 | service.go + K8s 集成 |
| 10 | Chaos 故障注入 | Plan-28 增强 | Docker/K8s 真实注入 |
| 11 | Swagger 自动生成 | 新增 | swag + Makefile |
| 12 | Supply Chain 扫描 | Plan-26 合并 | syft/trivy 集成 |
| 13 | 多数据源管理 | 新增 | DataSourceManager |
| 14 | DLP 出站中间件 | Plan-27 合并 | middleware + data-masking |
| 15 | 灾备编排 | 新增 | DROrchestrator |
| 16 | AI 模块拆分 | 新增 | internal/ai/ → 6 模块 |
| 17 | Schema Registry | Plan-24 合并 | 独立文件 |
| 18 | RLS 覆盖审计 | Plan-29 合并 | SQL 审计脚本 |
| 19 | 红队评估 | Plan-21 合并 | 新建 internal/red-team/ |

---

## 七、技术约束

1. **后端**: Go (`module orion/platform-svc-go`, go 1.25.0, Gin v1.10.0, sqlx+pgx)
2. **公共库**: `orion/go-common` (replace → `../orion-go-common`)
3. **数据库**: PostgreSQL (RLS 已启用, 544 迁移文件)
4. **缓存**: Redis (`github.com/redis/go-redis/v9`)
5. **消息队列**: NATS (`github.com/nats-io/nats.go v1.52.0` — 已在依赖但未使用)
6. **监控**: Prometheus (`github.com/prometheus/client_golang v1.23.2`)
7. **前端**: React 18 + Ant Design 5 + Vite 5 + Zustand 4.4 + Vitest + Playwright
8. **Design Tokens**: 已有 (`src/tokens/` 13 文件 1,564 行)
9. **ErrorBoundary**: 已有 (`PageErrorBoundary.tsx` 已在 router 中使用)
10. **PageSkeleton**: 已有 (`src/components/PageSkeleton/index.tsx`)
11. **非 Go 服务**: orion-api-gateway (TS), orion-runner-agent (TS), orion-ai-service (Python), orion-ai-agents-svc (Python), orion-intelligence-svc (Python), orion-visor (Java/Maven)
12. **sentinel 包**: 仅 37 行错误哨兵值 — **不是熔断器**，Circuit Breaker 需从零实现
