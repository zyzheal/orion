# Orion 本地系统全量扫描 — 缺口分析与设计文档

> **版本**: v2.0 | **日期**: 2026-08-26  
> **方法**: 全量代码扫描（非抽样），所有结论引用具体文件路径与行数  
> **后端约束**: Go (module orion/platform-svc-go, go 1.25.0, Gin, GORM)  
> **公共库**: orion/go-common (18 packages, symlinked as go-common)

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
| go.mod 依赖 | Gin, GORM(sqlx), Redis, NATS, Prometheus, Viper, JWT | `orion-platform-svc-go/go.mod` |

### 1.2 orion-go-common (公共库)

| 包名 | 非测试行数 | 核心类型/函数 |
|------|-----------|-------------|
| auth | 2,265 | AuthorizationEngine(RBAC→ABAC→relationship→audit), PermissionCache(Redis), ABACEngine |
| audit | 2,386 | WORMStore(Postgres/S3), UEBAEngine(6规则), ChainHasher, AlertRouter, LogSyncer(ES/Loki/HTTP) |
| database | 1,029 | DB(GORM), BaseRepository, Migration(811行), RLS |
| condition | 1,002 | Engine, Evaluator, Parser, Validator |
| form | 1,192 | FormValidator, FormRenderer(JSON/HTML/React) |
| cron | 1,495 | Scheduler, History, Registry, JobScheduler |
| middleware | 366 | interfaces, repository, service, handler |
| dag | 313 | Graph(V), Acyclic, Directed, PreventCycles |
| idempotency | 578 | Checker, Middleware, RedisStore, PgStore |
| config | 251 | Config(Viper-based) |
| messaging | 443 | messaging abstractions |
| plugin | 216 | Plugin interface, PluginContext, ExecuteResult |
| sse | 404 | Hub, Client, SSEEvent, Broadcast |
| redis | 87 | Redis wrapper |
| logger | 74 | zap-based logger |
| errors | 216 | error types |
| otel | 70 | Init(OTLP HTTP), Tracer |
| sentinel | 37 | **仅错误哨兵值** (NotFound, Unauthorized, Forbidden, Conflict, BadRequest, Internal) |

### 1.3 前端 (orion-frontend)

| 指标 | 数值 | 证据 |
|------|------|------|
| 页面 (.tsx) | 679 | `find src/pages -name "*.tsx" \| wc -l` |
| API 模块 | 177 | `ls src/api/*.ts \| wc -l` |
| 组件 | 106 | `ls src/components/` |
| Hooks | 15 | `ls src/hooks/*.ts` |
| Stores | 8 | `ls src/stores/*.ts` |
| 测试文件 | 295 | `find src -name "*.test.*" \| wc -l` |
| API 测试覆盖 | 13/177 (7.3%) | `ls src/api/__tests__/*.test.ts` |
| Design Tokens | 13 文件 1,564 行 | `src/tokens/` |
| ErrorBoundary | 已存在 | `src/components/ErrorBoundary/PageErrorBoundary.tsx` |
| PageSkeleton | 已存在 | `src/components/PageSkeleton/index.tsx` |
| i18n 使用率 | 0/679 (0%) | `grep -rl "useTranslation" src/pages/` |
| E2E 测试 | 1 文件 | `tests/e2e/login.spec.ts` |
| Lighthouse CI | 未配置 | 无 .lighthouserc 文件 |
| Web Vitals | 未集成 | 无 web-vitals 依赖 |

---

## 二、缺口分析 (按优先级排列)

### P0-01: i18n 国际化 — 前端完全未接入

**现状证据**:
- `orion-frontend/src/locales/zh-CN.json`: 273 行，仅 5 个命名空间 (alertRuleEditor:17, dashboardTemplateMarket:11, cmdbDrift:11, testExecution:10, formRenderer:15)
- `orion-frontend/src/locales/en-US.json`: 存在但同样稀疏
- `grep -rl "useTranslation" orion-frontend/src/pages/` 返回 **0 个文件**
- 679 个页面全部使用硬编码中文字符串
- 后端 i18n 模块已存在: `orion-platform-svc-go/internal/i18n/service/service.go` (完整 CRUD)

**能力缺失**:
1. 前端无 `react-i18next` 或等价库集成
2. 679 页面无一个使用翻译函数
3. 后端 i18n API (`/api/v1/i18n`) 已有 CRUD，但前端未调用
4. 无法支持多语言切换

**可借鉴的现有能力**:
- `orion-platform-svc-go/internal/i18n/service/service.go`: 已有 `CreateLocale`, `SetTranslation`, `GetAllTranslations`, `SetBulkTranslations` — 后端能力完整
- `orion-frontend/src/api/i18n.ts`: 已定义 `I18nLocale`, `I18nTranslation` 接口和 API 调用
- `orion-frontend/src/hooks/useTheme.ts`: 主题切换 hook 可作为 i18n hook 的模式参考

**设计方案**:

```
前端改造:
1. 安装 react-i18next + i18next
2. 创建 src/i18n/config.ts — 初始化 i18next，从 /api/v1/i18n/locales 拉取租户翻译
3. 创建 src/hooks/useI18n.ts — 封装 useTranslation，回退到 zh-CN
4. 创建 i18n 提取脚本 scripts/extract-i18n.ts — 扫描 679 页面的硬编码中文
5. 批量替换: 将 "操作成功" → t('common.success')
6. 在 Layout 中添加语言切换器 (<LanguageSwitcher />)

后端增强:
1. 在 i18n service 中增加 namespace 自动注册
2. 添加翻译导出/导入 API (Excel/JSON 格式)
3. 添加翻译缺失告警机制
```

**涉及文件**:
- 新建: `orion-frontend/src/i18n/config.ts`, `orion-frontend/src/hooks/useI18n.ts`
- 修改: 679 个页面文件 (批量替换), `orion-frontend/package.json` (添加 i18next 依赖)
- 后端: `orion-platform-svc-go/internal/i18n/service/service.go` (增加 export/import 方法)

---

### P0-02: 前端 API 测试覆盖严重不足 — 7.3%

**现状证据**:
- 177 个 API 模块 (`orion-frontend/src/api/*.ts`)，仅 13 个有测试 (`src/api/__tests__/`)
- 有测试的: ai-security, api-key, backup, client, cron, eventbus, knowledge, llm-trace, notificationRules, plugin-spi, session, test-selector, webhook
- 无测试的: auth.ts, projects.ts, pipelines.ts, deployments.ts, cmdb.ts, agents.ts 等 164 个核心模块

**能力缺失**:
1. 认证 API (`auth.ts`) 无测试 — 登录/登出/token 刷新链路无保护
2. 核心 CRUD API (projects, pipelines, deployments) 无测试
3. CMDB API (`cmdb.ts`) 无测试
4. AI 相关 API (agents, ai-gateway, ai-review) 无测试

**可借鉴的现有能力**:
- `orion-frontend/src/api/__tests__/client.test.ts`: 已有 client.ts 的完整测试 (拦截器、401 刷新、错误处理)
- `orion-frontend/src/api/__tests__/backup.test.ts`: 可作为 CRUD API 测试模式参考
- `orion-frontend/vitest.config.ts`: 已配置 vitest + react 插件

**设计方案**:

```
1. 创建测试模板: src/api/__tests__/_template.test.ts
   - mock api client (jest.mock('./client'))
   - 每个模块测试: 成功响应、错误响应、网络超时
2. 按优先级补全:
   P0: auth.ts, projects.ts, pipelines.ts, deployments.ts, cmdb.ts
   P1: agents.ts, ai-gateway.ts, alert.ts, incident.ts, ticketing.ts
   P2: 其余 164 个模块
3. CI 门禁: vitest --coverage --threshold=50 (API 模块)
```

---

### P0-03: Circuit Breaker — 有数据模型无中间件集成

**现状证据**:
- 后端模块: `orion-platform-svc-go/internal/circuit-breaker/service/service.go` (251 行)
  - 有完整的 Service: Create, Get, List, ListOpen, RecordFailure, RecordSuccess, Evaluate, Update
  - 使用 `orion/go-common/pkg/sentinel` (仅错误哨兵，非熔断器)
- **关键缺口**: `grep -l "circuit\|breaker\|CircuitBreaker" orion-platform-svc-go/internal/middleware/*.go` 返回空 — middleware 中无 circuit breaker
- 前端: `orion-frontend/src/api/circuit-breaker.ts` 头部注释 "Backend API not yet implemented"
- orion-go-common/pkg/sentinel (37 行) **仅包含错误哨兵值**，不是熔断器

**能力缺失**:
1. Circuit breaker 只有 CRUD 数据管理，没有实际的 HTTP/gRPC 拦截能力
2. `router.go` 中间件链只有 RateLimit + Timeout + SecurityHeaders + Prometheus，**无 CircuitBreaker**
3. 无法在下游服务故障时自动熔断
4. 前端虽然有 API 定义但后端未实现实际拦截

**可借鉴的现有能力**:
- `orion-platform-svc-go/internal/circuit-breaker/models/models.go`: 已有 State (closed/open/half-open), CircuitEvent 数据模型
- `orion-platform-svc-go/internal/circuit-breaker/service/service.go`: RecordFailure/RecordSuccess/Evaluate 逻辑已实现
- `orion-platform-svc-go/internal/middleware/ratelimit.go` (359 行): tokenBucket 实现 + bucketStore + 多租户支持 — circuit breaker 可参考此模式
- `orion-go-common/pkg/sentinel/sentinel.go`: 提供 NotFound 等错误哨兵

**设计方案**:

```go
// 文件: orion-platform-svc-go/internal/middleware/circuit_breaker.go

package middleware

import (
    "context"
    "sync"
    "time"
    "github.com/gin-gonic/gin"
    "orion/platform-svc-go/internal/circuit-breaker/models"
    "orion/platform-svc-go/internal/circuit-breaker/repository"
)

// CircuitBreakerConfig 定义熔断器中间件配置
type CircuitBreakerConfig struct {
    // ServiceName 标识当前服务名称
    ServiceName string
    // DefaultFailureThreshold 默认失败阈值 (5)
    DefaultFailureThreshold int
    // DefaultTimeout 默认熔断恢复超时 (30s)
    DefaultTimeout time.Duration
    // Repository 熔断器状态仓库 (可选，不设置则内存模式)
    Repository *repository.Repository
}

// circuitBreakerStore 内存中的熔断器状态
type circuitBreakerStore struct {
    mu       sync.RWMutex
    breakers map[string]*circuitState
}

type circuitState struct {
    state          models.CircuitState
    failureCount   int
    successCount   int
    lastFailure    time.Time
    openedAt       time.Time
    config         CircuitBreakerConfig
}

// CircuitBreaker 返回 Gin 中间件，对指定路由前缀自动熔断
// 熔断条件:
//   - 连续失败 >= FailureThreshold → open
//   - open 状态持续 TimeoutSeconds → half-open
//   - half-open 状态成功 >= SuccessThreshold → closed
//   - half-open 状态失败 → 重新 open
func CircuitBreaker(cfg CircuitBreakerConfig) gin.HandlerFunc {
    store := &circuitBreakerStore{
        breakers: make(map[string]*circuitState),
    }
    return func(c *gin.Context) {
        key := c.Request.URL.Path
        cb := store.getOrCreate(key, cfg)
        
        switch cb.state {
        case models.StateOpen:
            if time.Since(cb.openedAt) > cb.config.DefaultTimeout {
                cb.transitionTo(models.StateHalfOpen)
            } else {
                c.AbortWithStatusJSON(503, gin.H{
                    "error": gin.H{
                        "code": "CIRCUIT_OPEN",
                        "message": "service temporarily unavailable due to circuit breaker",
                    },
                })
                return
            }
        }
        
        c.Next()
        
        status := c.Writer.Status()
        if status >= 500 {
            cb.recordFailure()
        } else if status < 400 {
            cb.recordSuccess()
        }
    }
}
```

**涉及文件**:
- 新建: `orion-platform-svc-go/internal/middleware/circuit_breaker.go`
- 修改: `orion-platform-svc-go/cmd/server/router.go` — 在中间件链中添加 CircuitBreaker
- 修改: `orion-frontend/src/api/circuit-breaker.ts` — 移除 "not yet implemented" 注释

---

### P0-04: E2E 测试 — 仅 1 个登录测试

**现状证据**:
- `orion-frontend/playwright.config.ts`: 已配置 (testDir: `./tests/e2e`, 串行运行, chromium)
- `orion-frontend/tests/e2e/login.spec.ts`: 仅 1 个 E2E 测试文件
- 679 个页面中仅登录页有 E2E 覆盖

**能力缺失**:
1. 核心业务流程无 E2E: Dashboard、Pipeline、CMDB、Ticket、Deployment
2. 无跨页面流程测试 (如: 创建工单→审批→部署)
3. 无 API Mock 层 (E2E 依赖完整后端环境)

**可借鉴的现有能力**:
- `orion-frontend/playwright.config.ts`: 配置完善 (trace on-first-retry, screenshot only-on-failure)
- `orion-frontend/src/router/routes.tsx`: 路由结构清晰，可提取页面列表

**设计方案**:

```
tests/e2e/
├── login.spec.ts          # 已有
├── dashboard.spec.ts      # Dashboard 加载、统计卡片渲染
├── pipeline.spec.ts       # Pipeline 列表→详情→执行
├── cmdb.spec.ts           # CMDB CI 类型→实例→关系
├── ticket-flow.spec.ts    # 工单创建→审批→关闭
├── deploy.spec.ts         # 部署流程→灰度→回滚
├── auth.spec.ts           # 权限控制: 不同角色访问不同路由
└── helpers/
    ├── api-mock.ts        # MSW (Mock Service Worker) 拦截
    └── test-data.ts       # 测试数据工厂
```

---

### P1-01: Web Vitals 性能监控 — 完全缺失

**现状证据**:
- `grep -rl "web-vitals\|reportWebVitals\|onCLS\|onLCP\|onFID" orion-frontend/src/` 返回空
- `package.json` 中无 `web-vitals` 依赖
- 后端 `orion-platform-svc-go/internal/metrics/` 有 CRUD 但无前端性能指标采集

**能力缺失**:
1. 无法监控前端性能 (LCP, CLS, FID, INP, TTFB)
2. 无法设置性能阈值告警
3. 无法关联前端性能与后端 API 延迟

**可借鉴的现有能力**:
- `orion-platform-svc-go/internal/middleware/prometheus.go` (149 行): 已有 `orion_http_requests_total`, `orion_http_requests_duration_seconds` — 后端指标已有
- `orion-platform-svc-go/internal/performance/`: 有性能数据模块 (handler+service+repository+models)
- `deploy/prometheus/`: 已有 Prometheus 部署配置

**设计方案**:

```typescript
// 文件: orion-frontend/src/lib/web-vitals.ts
import { onCLS, onLCP, onFID, onINP, onTTFB, Metric } from 'web-vitals';

const vitalsEndpoint = '/api/v1/metrics/web-vitals';

function sendMetric(metric: Metric) {
  const body = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating, // 'good' | 'needs-improvement' | 'poor'
    delta: metric.delta,
    id: metric.id,
    pathname: window.location.pathname,
    sessionId: sessionStorage.getItem('session_id'),
  };
  
  // 使用 sendBeacon 避免阻塞
  navigator.sendBeacon(vitalsEndpoint, JSON.stringify(body));
}

export function initWebVitals() {
  onCLS(sendMetric);
  onLCP(sendMetric);
  onFID(sendMetric);
  onINP(sendMetric);
  onTTFB(sendMetric);
}
```

```go
// 文件: orion-platform-svc-go/internal/metrics/handler/web_vitals.go
// 接收前端 Web Vitals 数据，写入 Prometheus + DB
func (h *Handler) RecordWebVital(c *gin.Context) {
    var req struct {
        Name      string  `json:"name"`
        Value      float64 `json:"value"`
        Rating     string  `json:"rating"`
        Pathname   string  `json:"pathname"`
        SessionID  string  `json:"sessionId"`
    }
    // 记录到 Prometheus
    webVitalGauge.WithLabelValues(req.Name, req.Rating, req.Pathname).Set(req.Value)
    // 存入 DB 用于趋势分析
    h.service.RecordWebVital(ctx, ...)
}
```

---

### P1-02: Lighthouse CI 性能门禁 — 未配置

**现状证据**:
- `ls orion-frontend/.lighthouserc*` 返回空
- `package.json` scripts 中无 lighthouse 相关命令
- CI 流程中无性能门禁

**设计方案**:

```json
// 文件: orion-frontend/.lighthouserc.json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:3000/dashboard",
        "http://localhost:3000/pipelines",
        "http://localhost:3000/cmdb"
      ],
      "numberOfRuns": 3,
      "settings": {
        "preset": "desktop"
      }
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.8 }],
        "categories:accessibility": ["error", { "minScore": 0.9 }],
        "categories:best-practices": ["warn", { "minScore": 0.85 }],
        "categories:seo": ["warn", { "minScore": 0.8 }]
      }
    },
    "upload": {
      "target": "filesystem",
      "outputDir": "lighthouse-reports"
    }
  }
}
```

---

### P1-03: 消息队列模块 — 内存模式未接入 NATS

**现状证据**:
- `orion-platform-svc-go/go.mod`: 已有 `github.com/nats-io/nats.go v1.52.0` 依赖
- `orion-platform-svc-go/internal/message-queue/service/service.go`: 存在但使用 `busConn` (内存连接)
- `orion-platform-svc-go/internal/eventbus/service/eventbus_service.go` (284 行): 使用 `busConn` (本地内存)
- `orion-platform-svc-go/internal/eventbus/service/conn.go` (248 行): `newBusConn()` — 纯内存 pub/sub
- NATS 依赖已安装但未在任何消息队列模块中使用

**能力缺失**:
1. 事件总线纯内存实现 — 服务重启丢消息
2. 无法跨服务/跨实例通信
3. 无消息持久化
4. 无死信队列 (DLQ)

**可借鉴的现有能力**:
- `orion-platform-svc-go/go.mod`: `nats.go v1.52.0` 已在依赖中
- `orion-go-common/pkg/messaging/` (443 行): 消息抽象层
- `orion-go-common/pkg/sse/` (404 行): SSE Hub 用于实时推送
- `orion-platform-svc-go/internal/lock/` (5 文件): Redis 分布式锁 — 可用于消息幂等

**设计方案**:

```go
// 文件: orion-platform-svc-go/internal/eventbus/service/nats_conn.go

package service

import (
    "context"
    "encoding/json"
    "sync"
    
    "github.com/nats-io/nats.go"
    "orion/platform-svc-go/internal/eventbus/models"
)

// natsBusConn 实现 busConn 接口，使用 NATS JetStream
type natsBusConn struct {
    nc      *nats.Conn
    js      nats.JetStreamContext
    mu      sync.RWMutex
    streams map[string]*nats.StreamInfo
}

func newNatsBusConn(natsURL string) (*natsBusConn, error) {
    nc, err := nats.Connect(natsURL,
        nats.MaxReconnects(-1),
        nats.ReconnectWait(2*time.Second),
    )
    if err != nil {
        return nil, fmt.Errorf("nats connect: %w", err)
    }
    js, err := nc.JetStream()
    if err != nil {
        return nil, fmt.Errorf("jetstream: %w", err)
    }
    // 创建 stream
    js.AddStream(&nats.StreamConfig{
        Name:      "ORION_EVENTS",
        Subjects:   []string{"orion.events.>"},
        Retention:  nats.LimitsPolicy,
        MaxAge:     72 * time.Hour,
        Storage:    nats.FileStorage,
    })
    return &natsBusConn{nc: nc, js: js, streams: make(map[string]*nats.StreamInfo)}, nil
}

// Publish 发布事件到 NATS JetStream
func (n *natsBusConn) Publish(ctx context.Context, event *models.Event) error {
    subject := fmt.Sprintf("orion.events.%s", event.Type)
    data, err := json.Marshal(event)
    if err != nil {
        return err
    }
    _, err = n.js.Publish(subject, data, nats.MsgId(event.ID)) // 幂等发布
    return err
}

// Subscribe 订阅事件，使用队列组实现负载均衡
func (n *natsBusConn) Subscribe(ctx context.Context, eventType string, handler func(*models.Event)) error {
    subject := fmt.Sprintf("orion.events.%s", eventType)
    _, err := n.js.QueueSubscribe(subject, "orion-workers", func(msg *nats.Msg) {
        var event models.Event
        if err := json.Unmarshal(msg.Data, &event); err != nil {
            return
        }
        handler(&event)
        msg.Ack()
    }, nats.Durable("orion-"+eventType), nats.ManualAck())
    return err
}
```

**涉及文件**:
- 新建: `orion-platform-svc-go/internal/eventbus/service/nats_conn.go`
- 修改: `orion-platform-svc-go/internal/eventbus/service/eventbus_service.go` — 注入 natsBusConn
- 新建: `orion-platform-svc-go/internal/eventbus/service/dlq.go` — 死信队列处理

---

### P1-04: OTel 链路追踪 — 中间件已有但服务层未接入

**现状证据**:
- `orion-platform-svc-go/internal/middleware/tracing.go` (完整 OTel 中间件): 已实现 Extract/Inject trace ID、创建 server span、传播到 gin context
- `orion-go-common/pkg/otel/otel.go` (70 行): 基础 OTel 初始化 (OTLP HTTP exporter)
- `grep -r "otel\.\|trace\.SpanFromContext\|tracer\.Start" orion-platform-svc-go/internal/ --include="*.go" -l`: 仅 5 个 handler 文件包含 OTel 引用
- 300+ 模块中**仅 5 个**在 handler 中引用 OTel

**能力缺失**:
1. Tracing 中间件已配置，但 service/repository 层未创建子 span
2. 95%+ 的模块无 span 追踪 — 只有 HTTP 入口 span，无数据库查询 span
3. 无跨服务传播 (API Gateway → Platform Service → Runner Agent)
4. orion-go-common/pkg/otel 只有 Init 和 Tracer，缺少 Span 工具函数

**可借鉴的现有能力**:
- `orion-platform-svc-go/internal/middleware/tracing.go`: 已有 `GetTraceID()`, `TraceContext()`, `WithTraceID()`, `GetTraceIDFromCtx()` — 工具函数已齐备
- `orion-go-common/pkg/otel/otel.go`: Init 函数可初始化全局 TracerProvider

**设计方案**:

```go
// 文件: orion-go-common/pkg/otel/tracing.go

package otel

import (
    "context"
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/attribute"
    "go.opentelemetry.io/otel/codes"
    "go.opentelemetry.io/otel/trace"
)

// StartSpan 从 context 创建子 span，返回新的 context 和 span
// 使用方式: ctx, span := otel.StartSpan(ctx, "service.CreateCircuitBreaker")
//           defer span.End()
func StartSpan(ctx context.Context, name string, attrs ...attribute.KeyValue) (context.Context, trace.Span) {
    tracer := otel.Tracer("orion/platform-svc-go")
    return tracer.Start(ctx, name, trace.WithAttributes(attrs...))
}

// SpanFromContext 获取当前 context 中的 span
func SpanFromContext(ctx context.Context) trace.Span {
    return trace.SpanFromContext(ctx)
}

// RecordError 在 span 中记录错误
func RecordError(ctx context.Context, err error) {
    span := trace.SpanFromContext(ctx)
    if span.IsRecording() {
        span.RecordError(err)
        span.SetStatus(codes.Error, err.Error())
    }
}

// SetDBSpanAttributes 设置数据库查询 span 的标准属性
func SetDBSpanAttributes(ctx context.Context, operation, table string) {
    span := trace.SpanFromContext(ctx)
    span.SetAttributes(
        attribute.String("db.system", "postgresql"),
        attribute.String("db.operation", operation),
        attribute.String("db.sql.table", table),
    )
}
```

```go
// 使用示例 — 在 service 层接入
// 文件: orion-platform-svc-go/internal/circuit-breaker/service/service.go

func (s *Service) Create(ctx context.Context, req *models.CreateRequest, tenantID string) (*models.CircuitBreaker, error) {
    ctx, span := otel.StartSpan(ctx, "circuit-breaker.Create",
        attribute.String("tenant.id", tenantID),
        attribute.String("cb.name", req.Name),
    )
    defer span.End()
    
    entity := &models.CircuitBreaker{...}
    if err := s.repo.Create(ctx, entity); err != nil {
        otel.RecordError(ctx, err)
        return nil, err
    }
    return entity, nil
}
```

---

### P1-05: Self-Healing 自愈 — CRUD 有但无实际自愈动作

**现状证据**:
- `orion-platform-svc-go/internal/self-healing/`: 有 handler (handler.go + handler_test.go)、repository (3 文件)、models
- 但 service 目录只有 action_repository_interface.go — **无 service.go 实现文件**
- 无实际自愈动作执行器 (如: 重启 Pod、清理缓存、扩容)

**能力缺失**:
1. 只能记录自愈规则和动作历史，不能执行
2. 无与 K8s API 的集成 (无法重启 Pod)
3. 无与 Prometheus 告警的联动 (无法自动响应告警)
4. 无自愈策略引擎 (规则→动作映射)

**可借鉴的现有能力**:
- `orion-platform-svc-go/internal/chaos/service/service.go`: 有 `ExecuteCPUSpike`, `ExecuteMemoryLeak`, `ExecuteNetworkLatency`, `ExecuteServiceDown` — 故障注入执行器已实现，自愈可参考此模式
- `orion-platform-svc-go/internal/alert-pipeline/`: 告警流水线可触发自愈
- `orion-platform-svc-go/internal/auto-recovery/`: 有自动恢复模块

**设计方案**:

```go
// 文件: orion-platform-svc-go/internal/self-healing/service/service.go

package service

import (
    "context"
    "fmt"
    "time"
    
    "orion/platform-svc-go/internal/self-healing/models"
    "orion/platform-svc-go/internal/self-healing/repository"
    
    "k8s.io/client-go/kubernetes"
)

type Service struct {
    repo      repository.RepositoryInterface
    actionRepo repository.ActionRepositoryInterface
    k8sClient  *kubernetes.Clientset
    alertCh    <-chan AlertEvent // 从 alert-pipeline 接收告警
}

// ActionType 定义自愈动作类型
type ActionType string

const (
    ActionRestartPod      ActionType = "restart_pod"
    ActionScaleDeployment  ActionType = "scale_deployment"
    ActionCleanCache        ActionType = "clean_cache"
    ActionRollbackDeploy    ActionType = "rollback_deployment"
    ActionCleanDisk         ActionType = "clean_disk"
    ActionRestartService    ActionType = "restart_service"
)

// StartHealLoop 启动自愈循环，监听告警并执行匹配的自愈策略
func (s *Service) StartHealLoop(ctx context.Context) {
    for {
        select {
        case <-ctx.Done():
            return
        case alert := <-s.alertCh:
            go s.handleAlert(ctx, alert)
        }
    }
}

// handleAlert 根据告警匹配自愈规则并执行
func (s *Service) handleAlert(ctx context.Context, alert AlertEvent) {
    rules, err := s.repo.ListRules(ctx, alert.TenantID)
    if err != nil {
        return
    }
    for _, rule := range rules {
        if s.matchRule(rule, alert) {
            s.executeAction(ctx, alert.TenantID, rule, alert)
        }
    }
}

// executeAction 执行自愈动作并记录结果
func (s *Service) executeAction(ctx context.Context, tenantID string, rule *models.HealingRule, alert AlertEvent) {
    record := &models.HealingAction{
        TenantID:   tenantID,
        RuleID:     rule.ID,
        AlertID:    alert.ID,
        Action:     rule.Action,
        Status:     "running",
        StartedAt:  time.Now().UTC(),
    }
    s.actionRepo.Create(ctx, record)
    
    var err error
    switch ActionType(rule.Action) {
    case ActionRestartPod:
        err = s.restartPod(ctx, rule.Target)
    case ActionScaleDeployment:
        err = s.scaleDeployment(ctx, rule.Target, rule.Replicas)
    case ActionCleanCache:
        err = s.cleanCache(ctx, rule.Target)
    case ActionRollbackDeploy:
        err = s.rollbackDeployment(ctx, rule.Target)
    default:
        err = fmt.Errorf("unknown action: %s", rule.Action)
    }
    
    if err != nil {
        record.Status = "failed"
        record.Error = err.Error()
    } else {
        record.Status = "success"
    }
    record.FinishedAt = time.Now().UTC()
    s.actionRepo.Update(ctx, record)
}
```

---

### P1-06: Chaos Engineering — 有框架无真实故障注入

**现状证据**:
- `orion-platform-svc-go/internal/chaos/service/service.go`: 有 `ExecuteCPUSpike`, `ExecuteMemoryLeak`, `ExecuteNetworkLatency`, `ExecuteServiceDown`
- `orion-platform-svc-go/internal/chaos/anomaly/detector.go`: 有异常检测器
- **关键缺口**: 检查 service.go 内容发现 Execute 函数仅创建 `InjectResult` 记录，**不执行真实故障注入**
- 无与 Docker/K8s API 的集成

**可借鉴的现有能力**:
- `orion-platform-svc-go/internal/chaos-enhanced/`: 有增强版 chaos 模块
- `orion-platform-svc-go/internal/chaos-gateway/`: chaos 网关

**设计方案**:

```go
// 文件: orion-platform-svc-go/internal/chaos/service/injector.go

package service

import (
    "context"
    "fmt"
    "time"
    
    "github.com/docker/docker/client"
    "k8s.io/client-go/kubernetes"
)

type FaultInjector struct {
    dockerCli  *client.Client
    k8sClient   *kubernetes.Clientset
}

// InjectNetworkLatency 注入网络延迟
func (i *FaultInjector) InjectNetworkLatency(ctx context.Context, target string, latency time.Duration) error {
    // 使用 tc (traffic control) 在容器内注入延迟
    cmd := fmt.Sprintf("tc qdisc add dev eth0 root netem delay %v", latency)
    return i.execInContainer(ctx, target, cmd)
}

// InjectCPUStress 注入 CPU 压力
func (i *FaultInjector) InjectCPUStress(ctx context.Context, target string, cores int, duration time.Duration) error {
    // 使用 stress-ng 注入 CPU 压力
    cmd := fmt.Sprintf("stress-ng --cpu %d --timeout %v", cores, duration)
    return i.execInContainer(ctx, target, cmd)
}

// InjectMemoryLeak 注入内存泄漏
func (i *FaultInjector) InjectMemoryLeak(ctx context.Context, target string, sizeMB int, duration time.Duration) error {
    cmd := fmt.Sprintf("stress-ng --vm 1 --vm-bytes %dM --timeout %v", sizeMB, duration)
    return i.execInContainer(ctx, target, cmd)
}

// KillPod 杀掉指定 Pod (K8s 环境)
func (i *FaultInjector) KillPod(ctx context.Context, namespace, podName string) error {
    return i.k8sClient.CoreV1().Pods(namespace).Delete(ctx, podName, metav1.DeleteOptions{})
}
```

---

### P1-07: Swagger/OpenAPI 自动生成 — 无生成管线

**现状证据**:
- `orion-platform-svc-go/docs/swagger.yaml` 和 `swagger.json`: 存在但可能是手动维护
- `orion-platform-svc-go/cmd/server/router.go`: 1,083 行路由注册，无 swagger 注解
- 无 `swag` 工具或 `swaggo/swag` 依赖
- 无 Makefile 中的 swagger 生成命令
- `orion-api-gateway/src/`: TS 实现的网关，无 OpenAPI 聚合

**能力缺失**:
1. 300+ 模块的 API 无自动文档
2. swagger.json 静态文件无法反映最新 API 变更
3. 无 API 契约驱动开发

**设计方案**:

```makefile
# 文件: orion-platform-svc-go/Makefile

.PHONY: swagger

swagger:
	@echo "Generating Swagger docs..."
	swag init -g cmd/server/main.go \
		--parseDependency \
		--parseInternal \
		-d docs \
		--outputTypes json,yaml \
		--exclude internal/test \
		--title "Orion Platform API" \
		--version "1.0" \
		--basePath "/api/v1"
```

```go
// 文件: orion-platform-svc-go/cmd/server/main.go (添加 swagger 路由)

import (
    swaggerFiles "github.com/swaggo/files"
    ginSwagger "github.com/swaggo/gin-swagger"
    _ "orion/platform-svc-go/docs" // swagger docs
)

// 在 router 中添加
r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
```

---

### P1-08: Supply Chain Security — 有 CRUD 无实际扫描

**现状证据**:
- `orion-platform-svc-go/internal/supply-chain/`: 有 handler + repository + models + service_interface
- `orion-platform-svc-go/internal/sbom/`: 有 SBOM 模块
- `orion-platform-svc-go/internal/vulnerability/`: 有漏洞管理模块
- **关键缺口**: 无实际 SBOM 生成工具 (如 syft/trivy 集成)，无 CVE 数据库查询

**可借鉴的现有能力**:
- `orion-platform-svc-go/internal/sbom/`: 已有 SBOM 数据模型
- `orion-go-common/pkg/audit/`: WORM 存储可用于审计追踪

**设计方案**:

```go
// 文件: orion-platform-svc-go/internal/supply-chain/service/scanner.go

package service

import (
    "context"
    "os/exec"
    "encoding/json"
)

type Scanner struct {
    repo RepositoryInterface
}

// ScanImage 扫描容器镜像，生成 SBOM
func (s *Scanner) ScanImage(ctx context.Context, image string) (*SBOMReport, error) {
    // 使用 syft 生成 SBOM
    cmd := exec.CommandContext(ctx, "syft", "scan", "-o", "json", image)
    output, err := cmd.Output()
    if err != nil {
        return nil, fmt.Errorf("syft scan: %w", err)
    }
    var sbom SBOMReport
    if err := json.Unmarshal(output, &sbom); err != nil {
        return nil, err
    }
    // 持久化
    s.repo.SaveSBOM(ctx, &sbom)
    // 触发漏洞扫描
    go s.scanVulnerabilities(ctx, &sbom)
    return &sbom, nil
}

// scanVulnerabilities 使用 trivy 扫描漏洞
func (s *Scanner) scanVulnerabilities(ctx context.Context, sbom *SBOMReport) error {
    for _, pkg := range sbom.Packages {
        cmd := exec.CommandContext(ctx, "trivy", "pkg", "--format", "json", pkg.Name+"@"+pkg.Version)
        output, err := cmd.Output()
        if err != nil {
            continue
        }
        var vuln VulnerabilityReport
        json.Unmarshal(output, &vuln)
        s.repo.SaveVulnerabilities(ctx, &vuln)
    }
    return nil
}
```

---

### P1-09: 多数据源管理 — 无统一数据源抽象层

**现状证据**:
- `orion-go-common/pkg/database/db.go` (90 行): 只有单一 Postgres 连接 (`Connect`, `ConnectWithRetry`, `Health`)
- `orion-go-common/pkg/database/repository.go` (128 行): BaseRepository 绑定单一 DB
- 平台无多数据源管理模块 (MySQL, MongoDB, ClickHouse, ES)
- `orion-platform-svc-go/internal/finops/report-designer/datasource/`: 有数据源概念但仅限报表

**能力缺失**:
1. 无法动态注册和管理外部数据源
2. 无连接池管理
3. 无数据源健康检查
4. 无跨数据源查询

**设计方案**:

```go
// 文件: orion-platform-svc-go/internal/datasource/service/service.go

package service

type DataSourceType string

const (
    DSCPostgres   DataSourceType = "postgres"
    DSCMySQL      DataSourceType = "mysql"
    DSCClickHouse DataSourceType = "clickhouse"
    DSCElasticsearch DataSourceType = "elasticsearch"
    DSCMongoDB    DataSourceType = "mongodb"
)

type DataSource struct {
    ID       string         `json:"id"`
    TenantID string         `json:"tenantId"`
    Name     string         `json:"name"`
    Type     DataSourceType `json:"type"`
    DSN      string         `json:"-"`          // 加密存储
    Config   map[string]any `json:"config"`
    Status   string         `json:"status"`     // active/inactive/error
}

type DataSourceManager struct {
    mu       sync.RWMutex
    sources  map[string]*ManagedDataSource
    secret   *secret.Service // 复用 secret 模块加密 DSN
}

type ManagedDataSource struct {
    Config   *DataSource
    DB       *sql.DB         // 关系型
    Client   interface{}     // 非关系型 (ES/Mongo)
    Health   time.Time
}

// Register 注册新数据源，建立连接池
func (m *DataSourceManager) Register(ctx context.Context, ds *DataSource) error {
    // 解密 DSN
    decrypted, err := m.secret.Decrypt(ds.DSN)
    // 根据类型创建连接
    switch ds.Type {
    case DSCPostgres:
        db, err := sql.Open("pgx", decrypted)
    case DSCMySQL:
        db, err := sql.Open("mysql", decrypted)
    case DSCClickHouse:
        db, err := sql.Open("clickhouse", decrypted)
    // ...
    }
    // 配置连接池
    db.SetMaxOpenConns(20)
    db.SetMaxIdleConns(5)
    db.SetConnMaxLifetime(30 * time.Minute)
    // 存入管理器
    m.mu.Lock()
    m.sources[ds.ID] = &ManagedDataSource{Config: ds, DB: db}
    m.mu.Unlock()
    return nil
}
```

---

### P1-10: DLP 数据防泄漏 — 有 data-masking 无全链路 DLP

**现状证据**:
- `orion-platform-svc-go/internal/data-masking/`: 有 handler + repository + models + service (有测试)
- `orion-platform-svc-go/internal/data-classification/`: 有 interfaces + handler + repository + models + service (有测试)
- `orion-platform-svc-go/internal/privacy/`: 有 handler + repository + models + service (有测试)
- **关键缺口**: 无出站流量扫描 (API 响应、导出文件)，无实时拦截能力

**设计方案**:

```go
// 文件: orion-platform-svc-go/internal/middleware/dlp.go

package middleware

// DLPScanner 在 HTTP 响应出站时扫描敏感数据
type DLPScanner struct {
    rules    []DLPRule
    masking  *datamasking.Service
}

type DLPRule struct {
    ID       string
    Pattern  *regexp.Regexp  // 手机号、身份证、银行卡等
    Action   string          // mask | block | log
    Fields   []string         // 限定字段 (如 phone, id_card)
}

// DLP 中间件 — 在 c.Next() 后扫描响应体
func DLP(scanner *DLPScanner) gin.HandlerFunc {
    return func(c *gin.Context) {
        // 使用 response writer wrapper 捕获响应体
        writer := &dlpResponseWriter{c.Writer, &bytes.Buffer{}}
        c.Writer = writer
        
        c.Next()
        
        // 扫描响应体
        body := writer.buffer.Bytes()
        for _, rule := range scanner.rules {
            if rule.Pattern.Match(body) {
                switch rule.Action {
                case "mask":
                    masked := rule.Pattern.ReplaceAllFunc(body, maskSensitive)
                    c.Writer.Write(masked)
                case "block":
                    c.AbortWithStatusJSON(403, gin.H{"error": "DLP policy violation"})
                case "log":
                    // 记录到审计日志
                    audit.Log(ctx, "dlp.violation", ...)
                }
            }
        }
    }
}
```

---

### P1-11: 灾备编排 — 有 CRUD 无实际 DR 流程

**现状证据**:
- `orion-platform-svc-go/internal/disaster-recovery/`: 有 handler + repository + models (CRUD)
- `orion-platform-svc-go/internal/dr/`: 有独立 DR 模块
- **关键缺口**: 无实际灾备切换流程编排，无 RTO/RPO 监控

**设计方案**:

```go
// 文件: orion-platform-svc-go/internal/disaster-recovery/service/orchestrator.go

package service

type DROrchestrator struct {
    repo   RepositoryInterface
    steps  []DRStep
}

type DRStep struct {
    ID       string
    Name     string
    Action   func(ctx context.Context) error
    Timeout  time.Duration
    OnFail   string  // continue | abort | retry
}

// Failover 执行灾备切换
func (o *DROrchestrator) Failover(ctx context.Context, planID string) (*DRResult, error) {
    plan, err := o.repo.GetPlan(ctx, planID)
    result := &DRResult{PlanID: planID, StartTime: time.Now()}
    
    for _, step := range o.steps {
        stepCtx, cancel := context.WithTimeout(ctx, step.Timeout)
        err := step.Action(stepCtx)
        cancel()
        
        if err != nil && step.OnFail == "abort" {
            result.Status = "failed"
            result.FailedStep = step.ID
            result.EndTime = time.Now()
            result.RTO = time.Since(result.StartTime)
            return result, err
        }
    }
    
    result.Status = "success"
    result.EndTime = time.Now()
    result.RTO = time.Since(result.StartTime)
    return result, nil
}
```

---

### P2-01: AI 巨型模块拆分

**现状证据**:
- `orion-platform-svc-go/internal/ai/` 下有 30 个子目录: agents, aiagent, aicost, aigateway, aireview, aisecurity, auto-recovery, code-embedding, cost, decisions, degradation, gateway, handler, inference, intelligence, knowledge, llm, llm-provider, llm-trace, models, orchestration, prompt-security, repository, review, rule-engine, security, semantic-search, service, skill, task-executor, vector
- 159 个 Go 文件，32 个测试文件 (20% 测试覆盖)
- 这是系统中最大的模块

**设计方案**:

```
将 internal/ai/ 拆分为:
internal/ai-gateway/      — LLM 路由、provider 管理、token bucket
internal/ai-trace/         — LLM trace、cost 追踪
internal/ai-security/      — prompt-security、红队评估
internal/ai-knowledge/     — semantic-search、code-embedding、vector
internal/ai-agents/        — agent 执行、orchestration、task-executor
internal/ai-review/         — AI 代码审查、规则引擎
internal/ai-shared/         — models、repository (共享)
```

---

### P2-02: 事件驱动架构 — 已有 EventBus 但无 Schema Registry

**现状证据**:
- `orion-platform-svc-go/internal/eventbus/service/eventbus_service.go` (284 行): 有 Publish/Subscribe
- `orion-platform-svc-go/internal/eventbus/models/event.go`: 有 Event 结构
- **缺口**: 无 Schema Registry (事件版本管理、兼容性检查)

**设计方案**:

```go
// 文件: orion-platform-svc-go/internal/eventbus/service/schema_registry.go

type SchemaRegistry struct {
    mu      sync.RWMutex
    schemas map[string]*EventSchema // eventType → schema
}

type EventSchema struct {
    Type       string
    Version    int
    JSONSchema []byte  // JSON Schema 定义
    Compatible []int   // 兼容的旧版本
}

// Validate 验证事件 payload 是否符合 schema
func (r *SchemaRegistry) Validate(event *models.Event) error {
    schema, ok := r.schemas[event.Type]
    if !ok {
        return ErrSchemaNotFound
    }
    // JSON Schema 验证
    return validatePayload(schema.JSONSchema, event.Payload)
}
```

---

### P2-03: 多租户隔离增强 — RLS 已有但未全覆盖

**现状证据**:
- `migrations/002_enable_rls.sql`: 已启用 RLS
- `migrations/003_rbac_tables.sql`: RBAC 表结构
- `orion-go-common/pkg/database/rls_test.go`: 有 RLS 测试
- `orion-platform-svc-go/internal/tenant/`: 有租户管理模块
- `orion-platform-svc-go/internal/tenant-quota/`: 有配额管理
- **缺口**: 544 个迁移文件中仅 2 个顶层 RLS 文件，部分模块可能未启用 RLS

**设计方案**:

```sql
-- 审计脚本: 检查所有表是否启用 RLS
-- 文件: migrations/audit_rls_coverage.sql

SELECT 
    schemaname,
    tablename,
    rowsecurity,
    forcerowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity, tablename;

-- 为未启用的表批量启用 RLS
DO $$
DECLARE t record;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity=false LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.tablename);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t.tablename);
    END LOOP;
END $$;
```

---

## 三、可借鉴的现有能力索引

### 3.1 已完整实现可直接复用的能力

| 能力 | 文件路径 | 行数 | 复用场景 |
|------|---------|------|---------|
| RBAC+ABAC 授权引擎 | `orion-go-common/pkg/auth/authorization_engine.go` | 592 | 所有新模块的权限控制 |
| UEBA 异常检测 | `orion-go-common/pkg/audit/ueba.go` | 822 | 安全审计、行为分析 |
| WORM 审计存储 | `orion-go-common/pkg/audit/worm.go` | 343 | 合规审计、不可篡改日志 |
| ChainHasher 防篡改 | `orion-go-common/pkg/audit/chain.go` | 138 | 审计链完整性验证 |
| 条件引擎 | `orion-go-common/pkg/condition/evaluator.go` | 476 | 表单联动、告警规则 |
| DAG 图引擎 | `orion-go-common/pkg/dag/dag.go` | 269 | Pipeline 依赖、工作流 |
| 幂等中间件 | `orion-go-common/pkg/idempotency/middleware.go` | 206 | POST/PUT 接口幂等 |
| SSE Hub | `orion-go-common/pkg/sse/hub.go` | 223 | 实时推送、日志流 |
| 分布式锁 | `orion-platform-svc-go/internal/lock/lock.go` | - | 分布式任务互斥 |
| 表单引擎 | `orion-go-common/pkg/form/validator.go` | 392 | 动态表单验证 |
| 迁移引擎 | `orion-go-common/pkg/database/migrate.go` | 811 | 数据库版本管理 |
| Tracing 中间件 | `orion-platform-svc-go/internal/middleware/tracing.go` | - | 全链路追踪 |
| Rate Limit 中间件 | `orion-platform-svc-go/internal/middleware/ratelimit.go` | 359 | API 限流 |
| Security Headers | `orion-platform-svc-go/internal/middleware/security.go` | 48 | 安全响应头 |
| Prometheus 指标 | `orion-platform-svc-go/internal/middleware/prometheus.go` | 149 | HTTP 指标采集 |
| Secret 加密 | `orion-platform-svc-go/internal/secret/service/service.go` | 360 | AES-256-GCM 加密 |
| LLM Trace | `orion-platform-svc-go/internal/llm/service/llm_service.go` | 374 | LLM 调用追踪 |
| 事件总线 | `orion-platform-svc-go/internal/eventbus/service/eventbus_service.go` | 284 | 事件发布订阅 |

### 3.2 部分实现需补充的能力

| 能力 | 现有部分 | 缺失部分 | 设计方案编号 |
|------|---------|---------|------------|
| Circuit Breaker | service (251行) + models | middleware 集成 | P0-03 |
| 消息队列 | eventbus (内存) | NATS JetStream | P1-03 |
| OTel 追踪 | middleware (完整) | service 屁 span | P1-04 |
| Self-Healing | repository + models | service 执行器 | P1-05 |
| Chaos | service + detector | 真实故障注入 | P1-06 |
| Swagger | 静态文件 | 自动生成管线 | P1-07 |
| Supply Chain | CRUD | 实际扫描器 | P1-08 |
| DLP | data-masking | 出站扫描中间件 | P1-10 |
| 灾备 | CRUD | 切换编排 | P1-11 |
| i18n | 后端 CRUD | 前端集成 | P0-01 |

---

## 四、实施优先级

### Phase 1 (P0 — 立即执行)
1. **P0-01**: i18n 前端集成 — 影响 679 页面
2. **P0-02**: API 测试补全 — 164 个模块无测试
3. **P0-03**: Circuit Breaker middleware — 下游故障无保护
4. **P0-04**: E2E 测试扩展 — 仅 1 个测试

### Phase 2 (P1 — 近期执行)
5. **P1-01**: Web Vitals 监控
6. **P1-02**: Lighthouse CI 门禁
7. **P1-03**: NATS JetStream 接入
8. **P1-04**: OTel service 层 span
9. **P1-05**: Self-Healing 执行器
10. **P1-06**: Chaos 故障注入
11. **P1-07**: Swagger 自动生成
12. **P1-08**: Supply Chain 扫描器
13. **P1-09**: 多数据源管理
14. **P1-10**: DLP 出站扫描
15. **P1-11**: 灾备切换编排

### Phase 3 (P2 — 中期执行)
16. **P2-01**: AI 模块拆分 (30 子目录)
17. **P2-02**: 事件 Schema Registry
18. **P2-03**: RLS 全覆盖审计

---

## 五、技术约束

1. **后端语言**: Go (module `orion/platform-svc-go`, go 1.25.0)
2. **HTTP 框架**: Gin (`github.com/gin-gonic/gin v1.10.0`)
3. **ORM**: sqlx + pgx (`github.com/jmoiron/sqlx`, `github.com/jackc/pgx/v5`)
4. **公共库**: `orion/go-common` (replace directive 指向 `../orion-go-common`)
5. **数据库**: PostgreSQL (RLS 已启用)
6. **缓存**: Redis (`github.com/redis/go-redis/v9`)
7. **消息队列**: NATS (`github.com/nats-io/nats.go v1.52.0`) — 已在依赖但未使用
8. **监控**: Prometheus (`github.com/prometheus/client_golang v1.23.2`)
9. **前端**: React 18 + Ant Design 5 + Vite 5 + Vitest + Playwright
10. **非 Go 服务**: orion-api-gateway (TypeScript), orion-runner-agent (TypeScript), orion-ai-service (Python), orion-ai-agents-svc (Python), orion-intelligence-svc (Python)

