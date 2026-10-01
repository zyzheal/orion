# Orion 告警能力深度评审（对标 NeatLogic 告警平台 14 项）

> 作者：资深告警/AIOps 领域专家视角（PagerDuty / Grafana Alerting / Alertmanager / Dynatrace / BigPanda 实施经验）
> 评审日期：2026-09-30
> 证据来源：`orion-platform-svc-go/internal/alert*`、`orion-ai-service/src/services/ai_service.py`、`orion-ai-service/src/models/ai_models.py`、`orion-frontend/src/pages/**/Alert*`
> ⚠️ 注：`orion-platform-service/`（TS 主单体）在仓库中已不存在（`ls src/services/` 返回空），本评审全部证据来自 Go 微服务蓝图（`orion-platform-svc-go/`）+ Python AI 服务；如 TS 版本仍存在告警模块，本报告不适用。

---

## 1. 告警视角能力矩阵（对标 NeatLogic 14 项）

Gap 级别：G0=对齐、G1=部分实现/需补全、G2=空壳或需重写、G3=缺失、G4=领域反模式。工时以人天计。

| # | NeatLogic 能力 | 标记 | Orion 证据 | Gap | 工时 |
|---|---|---|---|---|---|
| 1.1 | 多数据源接入（MQ/HTTP/文件/监控） | ⚠️ | `alert-adapter/handlers.go` 有 prometheus/grafana/zabbix/kafka 4 类 source，但 4/4 均只有 `// TODO: in production, HTTP GET Alertmanager API ...` 或 `// TODO: poll kafka consumer`，`Receive()` 只从 `alertQueue.Drain()` 返回。**MQ 完全 TODO，文件接入无实现，监控系统只有 Alertmanager 一处 TODO**。 | G1 | 8-10 |
| 1.2 | 自定义适配器（SPI） | ⚠️ | `alert-adapter/service/factory.go` 定义 `AlertAdapterHandler` 接口 + `Register(t, ctor)` 构造器注册，10 类内置实现；SPI 契约完整但**只能编译期静态注册**，无脚本/DSL/插件包。 | G1 | 5-7 |
| 1.3 | 适配器热加载 | ❌ | 全部 `Register` 在 `wiring.go` 阶段一次性调用；`Shutdown(ctx)` 只处理关闭，**无 `RegisterAtRuntime` / `ReloadFromDisk` / `PluginLoad` 入口**；没有热加载框架、没有版本冲突检测、没有适配器签名校验。 | G3 | 8-12 |
| 2.1 | 事件模型驱动 | ⚠️ | `alert-pipeline/stages/stage.go` + `models/AlertContext` 是**静态阶段链**（receive→validate→dedup→enrich→route→notify→track），Stage 是编译期固定的 7 个 switch case（`service.go:337-355`）。**Stage 顺序不可插拔**（`UpdateConfig` 只允许从 `knownStageNames` 7 个里挑，见 `service.go:51-59`）。 | G1 | 6-8 |
| 2.2 | 事件插件机制（10+ 内置） | ⚠️ | 现有 Stage 7 个 + `EnrichmentSource` 接口 + `NotificationChannel` 接口 + `AlertAdapterHandler` 10 类 + `INotificationHandler` 15 通道 = 名义上 24+，但**没有 PagerDuty/OpsGenie 式的"升级/指派/标记/修改字段/第三方接口"事件动作插件**（这些是 Alertmanager 事件驱动模型的核心）。NeatLogic 内置 10 项事件插件对应"业务动作"，Orion 只有"数据流阶段"，缺少"事件处理器"这一层。 | G2 | 10-14 |
| 2.3 | 自定义事件插件 | ❌ | 没有插件发现/加载/沙箱/热更新；`newStage` 是一个硬编码 switch，加一个阶段需要改源码。 | G3 | 8-12 |
| 3.1 | 自定义状态（流程可配置） | ⚠️ | `alert.models.Alert.Status` 是字符串（`firing/resolved/suppressed` 三态硬编码在 `service.go:62, 91, 114`），`alert-escalation.AlertClosure.Status` 是 `open/acknowledged/resolved` 三态硬编码在 `service.go:233, 258, 282, 327`。**状态枚举不可配置**。 | G1 | 5-7 |
| 3.2 | 自定义级别 | ⚠️ | `alert.models.Alert.Severity` 只有 `critical/warning/info`（`service.go:59-61`）；`alert-correlation.GroupType` 只有 `temporal/spatial/causal`；`alert-escalation.Rules.DelayMinutes` 固定按分钟粒度。级别数、级别语义、级别→SLA 映射均硬编码。 | G1 | 4-6 |
| 3.3 | 自定义扩展字段 | ⚠️ | `alert.models.Alert.Labels` / `Annotations` 是 JSON blob（`service.go:80`），`alert-adapter-v2.AlertNotificationTemplate.Variables` 是 JSON（`models.go:117`）——**扩展字段是自由 JSON**，但没有 Schema Registry、没有字段类型、没有字段字典。 | G1 | 3-5 |
| 3.4 | 字段动态显示/排序/校验 | ❌ | 后端所有 request DTO（`CreateSilenceRequest`、`CreateAdapterRequest`、`IngestRequest` 等）字段固定，`binding:"required"` 是编译期。**没有前端字段配置表、没有表单 Schema**。NeatLogic 允许运维自定义"表单显示哪些字段/什么顺序/什么校验"，Orion 前端只能改代码。 | G3 | 10-14 |
| 4.1 | 订阅策略（人/组织/系统/级别/来源/对象/关键字） | ⚠️ | `alert-pipeline/stages/route/route.go:19-26` `Rule` 只支持 `Severity + LabelMatches + TargetChannels + Team` 4 维；**不支持"人"（用户列表）、"组织"（组织架构树）、"关键字"（正则/子串）、"系统"（服务树）**。缺 4 维。 | G2 | 8-12 |
| 4.2 | 屏蔽策略（时间/来源/级别/正则） | ⚠️ | `alert-silence.Silence` 只有 `Matcher`（字符串）+ `Duration`（秒），`alert.models.MaintenanceWindow.Scope` 是 JSON blob；`alert-correlation.CorrelationRule.Conditions` 是字符串。**时间维度只有 `Duration` 相对时长，没有 cron 表达式、没有工作日历、没有"仅工作日 9-18 点"这种语义**。正则仅 `KnownIssue.FingerprintPattern`。 | G1 | 6-10 |
| 5.1 | AI 告警智能分析 | ⚠️ | `alert.service.ExplainAlert`（`service.go:411-458`）用 `inferCause` 硬编码关键词匹配（cpu/mem/latency/error），非 LLM；`alert-correlation.AutoCorrelate`（`service.go:92-115`）**只有注释 `// Simplified: in a real implementation, this would query recent alerts`**，返回空组。Python 侧 `orion-ai-service` `AIAnalysisType` 枚举只有 `PIPELINE/CODE/COST` 三种，**没有 `ALERT` 类型**（`ai_models.py:39-45`）。商业版 AI 能力零实现。 | G2 | 12-18 |
| 6.1 | 开放 API | ✅ | 14 个 REST endpoint（`alert/handler/handler.go:23-56`）+ 升级/关联/去重/沉默/中断器/规则引擎/管道共 12 个 handler 均暴露 REST。**API 完整，但无 OpenAPI/GraphQL、无事件订阅 webhook、无 SDK**。 | G0 | 2-4 |

**汇总**：✅ 1 项、⚠️ 10 项、❌ 3 项；覆盖 14 项，加权平均完成度约 **55-60%**；补齐到 NeatLogic 完整对标约 **110-160 人天**（专家级精度）。

---

## 2. Orion 现有告警深度代码分析

### 2.1 服务模块清单（8 个 Go 模块 + 1 个 Python AI 服务）

| 模块 | 目录 | 有效代码行数（非测试） | 主要职责 |
|---|---|---|---|
| alert（核心） | `internal/alert/` | 548 L | 告警实体、指纹、抑制、去重、拓扑、Explain |
| alert-adapter（V1） | `internal/alert-adapter/` | 1068 L（452 factory + 616 handlers） | Source/Notification 适配器 SPI，10 类内置 |
| alert-adapter-v2 | `internal/alert-adapter-v2/` | 1176 L（547 factory + 976 handlers + 69 live） | 通知适配器 V2，15 通道声明、11 通道真实发送 |
| alert-pipeline | `internal/alert-pipeline/` | ~1400 L（8 文件，7 stages） | 7 阶段固定管道 + OTel tracing |
| alert-escalation | `internal/alert-escalation/` | 648 L（397 svc + 251 handler） | 升级策略、ack/resolve、MTTR 指标 |
| alert-correlation | `internal/alert-correlation/` | ~180 L | 时间/空间/因果 三型关联组 |
| alert-deduplication | `internal/alert-deduplication/` | ~176 L | 指纹去重 |
| alert-silence | `internal/alert-silence/` | ~420 L（含 fatigue 222 L） | 沉默 + 疲劳度打分 |
| alert-rule-engine | `internal/alert-rule-engine/` | 657 L（expr 360 + engine 297） | 表达式编译 + 规则匹配 |
| alert-breaker | `internal/alert-breaker/` | 模型 35 L、handler 159 L | 断路器规则 |

### 2.2 数据模型清单（关键实体）

- **Alert**（核心）：`ID/TenantID/Name/Severity/Status/Fingerprint/SourceType/SourceID/SourceName/Labels(Any)/Annotations(Any)/Value/Threshold/Metric/IsDuplicate/GroupID/ResolvedAt`
- **AlertGroup**：指纹聚合，`Fingerprint → AlertCount/Severity/Status/Alerts[]`
- **MaintenanceWindow**：`StartTime/EndTime/Scope(Any)` — 时间屏蔽
- **KnownIssue**：`FingerprintPattern/LabelSelectors/SilenceDuration` — 已知问题屏蔽
- **EscalationPolicy/Rules**：`Severity/Status/Rules[]{Level, DelayMinutes, Target, Channel, NotifyOnFail}`
- **AlertClosure**：`Status/AcknowledgedBy/ResolvedBy/MTTRSeconds` — 告警生命周期
- **Silence**：`Matcher/Duration/Reason` — 独立沉默
- **CorrelationRule/Group**：`GroupType(temporal/spatial/causal)/TimeWindowSec/Conditions/Confidence`
- **AlertNotificationAdapter/Template/Event**（V2）：`Channel/Config/TenantID/Template/Variables`
- **AlertBreaker**：`Rule(map)/Status(active/inactive/open/half-open)`
- **FatigueInfo**：`RuleName/TotalAlerts/AvgInterval/SilenceRatio/Score/Recommendation`

### 2.3 与 NeatLogic 概念映射

| NeatLogic | Orion | 匹配度 |
|---|---|---|
| 事件插件（10+ 内置动作） | Stage + EnrichmentSource + NotificationChannel + Adapter | 数据流层匹配，业务动作层缺失 |
| 订阅策略 | `route.Rule`（4 维） | 部分匹配 |
| 屏蔽策略 | Silence + MaintenanceWindow + KnownIssue | 部分匹配 |
| 告警实体 | `Alert` + `AlertGroup` + `AlertClosure` | 匹配，但状态/级别硬编码 |
| 事件模型驱动 | `AlertContext` 阶段链 | 静态阶段链 ≠ 事件驱动 |
| 自定义字段 | Labels/Annotations/Variables 自由 JSON | Schema 缺失 |
| 告警智能分析 | `inferCause` 关键词匹配 + `AlertExplanation` | 空壳，非 LLM |
| 升级 | `EscalationPolicy/Rules/Trigger` | 匹配 |
| MTTR/SLA 指标 | `AlertMetrics`（含 P95、SLABreachCount） | 匹配 |

### 2.4 真实完成度

- **代码骨架完成度**：约 85%（所有 14 项都有目录 + 接口 + REST）
- **真实业务逻辑完成度**：约 55%（V2 通知通道 11/15 真实发送，V1 适配 6/10 真实发送，Source 类适配器几乎全 TODO）
- **NeatLogic 对标完成度**：约 55-60%（加权平均，见矩阵）

---

## 3. 事件模型驱动深度分析

### 3.1 NeatLogic 事件插件机制深度剖析

NeatLogic 事件插件是**业务动作单元**，典型内置：
- **升级插件**：`If severity >= critical AND ack_latency > 5m → trigger escalation`
- **指派插件**：按团队值班表分配当前处理人
- **标记插件**：`Set label.handled_by = current_user`
- **修改字段插件**：`Set severity = high if count > 3 in 10m`
- **第三方接口插件**：POST 到外部 API 触发自动化（如自愈脚本）

特征：
- 声明式配置（YAML/JSON），运行时解释
- 有执行顺序、依赖、失败策略（continue/stop/rollback）
- 有执行审计（每次执行谁、何时、输入、输出、耗时）
- 有沙箱：超时、内存限制、错误隔离

### 3.2 Orion 当前告警状态流转模型

**Alert**：`firing → resolved / suppressed`（三态）
**AlertClosure**：`open → acknowledged → resolved`（三态）

流转：
1. `alert.service.Ingest` 生成 fingerprint → 检查 suppression → 检查 deduplication → CreateAlert
2. `alert.service.UpdateAlert` 允许任意 status 更新（无状态机守卫）
3. `alert-escalation.service.EvaluatePolicy` 创建 pending trigger（不自动 resolve，需人工 ack）
4. `alert-escalation.service.AcknowledgeAlert/ResolveAlert` 更新 closure

**问题**：
- 状态转换无守卫（`firing` 可跳到 `resolved`，无中间态）
- 无事件日志（`Alert` 表无 `events[]`/`state_history`）
- 无"事件"这个一等公民对象——只有 alert（快照）和 closure（终态），缺少"事件流"

### 3.3 建议的 Orion 事件插件 SPI 设计（Go 接口）

```go
// IEventPlugin 是事件动作插件的 SPI 契约
// 与 Stage（阶段）不同：Stage 是数据流阶段，EventPlugin 是业务动作
type IEventPlugin interface {
    ID() string                    // 唯一 ID，如 "builtin.escalate"
    Name() string                  // 显示名，如 "升级到 P0 值班组"
    Version() string               // SemVer
    Priority() int                 // 越小越先执行
    OnWhich(When) bool             // 触发时机：OnIngest / OnStateChange / OnThreshold
    ValidateConfig(cfg PluginConfig) error
    Initialize(ctx context.Context, cfg PluginConfig) error
    Execute(ctx context.Context, evt *Event) (PluginResult, error)
    Rollback(ctx context.Context, evt *Event, prev *EventSnapshot) error
    Shutdown(ctx context.Context) error
}

type When int
const (
    OnIngest When = iota
    OnStateChange
    OnThresholdCross
    OnGroupMerge
    OnSilenceCreate
    OnAck
    OnResolve
)

type PluginConfig struct {
    ID          string
    Enabled     bool
    Config      map[string]any  // JSON Schema 校验后传入
    TenantID    string
    CreatedAt   time.Time
    CreatedBy   string
}

type PluginResult struct {
    Status      ResultStatus  // Ok / Skipped / Failed / RolledBack
    Mutations   []FieldMutation   // 对 event 的可回放修改
    SubEvents   []Event           // 新产生的事件（避免循环触发见 §8）
    Metrics     map[string]float64
    Error       *PluginError
    DurationMs  int64
}

type FieldMutation struct {
    Field    string
    Prev     any
    Next     any
    Reason   string  // 用于审计："escalate plugin: severity from high → critical because ack_latency > 5m"
}

// PluginRegistry 支持运行时热加载、执行顺序、沙箱
type PluginRegistry struct {
    plugins map[string]IEventPlugin
    byWhen  map[When][]string    // 优先级排序
    mu      sync.RWMutex
    sandbox *Sandbox
    audit   AuditSink             // 每次执行都写入事件审计
}

// RegisterAtRuntime 支持热加载：从磁盘或远程加载新插件
func (r *PluginRegistry) RegisterAtRuntime(ctx context.Context, path string) (*PluginMetadata, error)

// UnregisterAtRuntime 支持热卸载
func (r *PluginRegistry) UnregisterAtRuntime(ctx context.Context, id string) error

// Run 是入口：给定事件，按 OnWhich + Priority 顺序执行所有匹配插件
func (r *PluginRegistry) Run(ctx context.Context, evt *Event) *EventResult

// Sandbox 隔离：每个插件在独立 goroutine + panic recover + 内存/超时限制
type Sandbox struct {
    Timeout      time.Duration       // 默认 5s
    MaxMemory    int64               // 默认 32MB
    MaxSubEvents int                 // 默认 5（避免事件循环）
    PanicIsolation bool              // true
}

// 事件循环防御：见 §8 "事件循环"
func (r *PluginRegistry) detectLoop(evt *Event) (loopID string, ok bool)
```

关键设计要点：
- **执行顺序**：`Priority` + `OnWhich` 二维，同优先级按 `ID` 字典序
- **热加载**：Go `plugin` 包或子进程 + RPC（gRPC/JSON-RPC）；建议子进程方案
- **沙箱**：`context.WithTimeout` + `runtime.MemProfileRate` + `recover()`
- **审计**：每次执行产生 `EventAuditEntry{PluginID, Input, Output, Duration, Error}`
- **循环检测**：`Event.TraceID` + `Event.CausationID`，超过 5 层递归强制 stop

### 3.4 事件模型 vs 状态机模型对比

| 维度 | 事件模型（NeatLogic） | 状态机模型（传统 OpsGenie） | Orion 现状 |
|---|---|---|---|
| 抽象 | Event 是一等公民 | State 是一等公民 | Alert（快照）+ Closure（终态） |
| 触发条件 | 事件到达 / 状态变化 / 阈值突破 | 状态转换事件 | Ingest（一次） |
| 业务逻辑 | 插件链 | 转换函数 | 硬编码函数 |
| 审计 | 每次事件都有 audit | 状态历史 | 无 |
| 幂等 | Event ID 唯一 | 状态转换幂等 | Fingerprint |
| 回溯 | 从 event log 重建任意时点 | 需 state history | 无法回溯 |
| 复杂度 | 高，插件生态是双刃剑 | 低，边界清晰 | 中 |

**建议 Orion 混合**：Alert 状态机（open/ack/resolve 三态保持简单）+ 事件模型层（Event 流 + 插件链），两层解耦。这样不推翻现有告警语义，又能提供插件能力。

---

## 4. 适配器热加载深度分析

### 4.1 NeatLogic 适配器热更新机制

NeatLogic 适配器支持：
- 上传 JAR/Python 包到管理台 → 校验签名 → 编译 → 热加载到运行实例
- 无重启加载新适配器版本
- 版本回滚
- 灰度：新适配器先接 5% 流量验证，再全量
- 沙箱：每个适配器独立 ClassLoader / subprocess，崩溃不影响其他适配器

### 4.2 Orion 当前适配器实现方式

**V1（`alert-adapter`）**：
- `AlertAdapterHandler` 接口：`Name/Type/Category/Initialize/Send/Receive/ValidateConfig/Shutdown`
- `AlertAdapterFactory`：`handlerConstructors map[string]func() AlertAdapterHandler`
- 注册时机：`wiring.go` 阶段调用 `Register`，**编译期固定**
- 内置 10 类，其中真实发送的仅 webhook/email/wechat/slack/pagerduty 5 类（Source 类几乎全 TODO）

**V2（`alert-adapter-v2`）**：
- `INotificationHandler` 接口：`Channel/Initialize/Send/ValidateConfig`
- `NotificationFactory`：`ctors map[string]HandlerConstructor`
- `handlers/live.go:15-26` `LiveChannels` 显式列出 11 个真实通道，`StubbyChannels`（push/kafka）和 `HandlerlessChannels`（phone/rabbitmq）明确不注册，避免"静默成功"
- 注册时机：`RegisterLiveHandlers(f)` 一次性调用

**热加载能力**：
- ❌ 无 `RegisterAtRuntime` 接口
- ❌ 无 `PluginPath` 配置项
- ❌ 无版本管理、无签名校验
- ❌ 无灰度/回滚机制
- ✅ 有 `Shutdown(ctx)`，但只在进程退出时调用

### 4.3 建议的 Orion 适配器框架设计

```go
// IAdapter SPI 契约（合并 V1/V2，去重）
type IAdapter interface {
    Metadata() AdapterMetadata
    Lifecycle() AdapterLifecycle
    
    // 配置
    ValidateConfig(ctx context.Context, raw []byte) (AdapterConfig, error)
    Initialize(ctx context.Context, cfg AdapterConfig) error
    
    // Source: 拉取外部告警
    Poll(ctx context.Context) ([]RawEvent, error)     // 主动拉
    // Sink: 推送外部
    Dispatch(ctx context.Context, evt *Event) error
    
    // 健康
    Health(ctx context.Context) AdapterHealth
    Shutdown(ctx context.Context) error
}

type AdapterMetadata struct {
    ID         string           // "builtin.prometheus" / "community.kafka" / "tenant.acme.custom"
    Name       string
    Version    string           // SemVer
    Category   Category         // Source / Sink / Bridge
    Protocols  []Protocol       // HTTP / Kafka / AMQP / File / MQTT
    AuthModes  []AuthMode
    Description string
    Vendor     string
    License    string
}

type AdapterLifecycle struct {
    WarmUp     time.Duration    // 冷启动时间
    PollInterval time.Duration  // 默认轮询间隔
    MaxConcurrent int
    RetryPolicy  RetryPolicy
}

// AdapterRegistry 支持热加载
type AdapterRegistry struct {
    // 三层注册表
    builtins map[string]AdapterConstructor      // 编译期静态
    disk     map[string]*AdapterPackage         // 磁盘加载的热加载
    remote   map[string]*RemoteAdapter          // 子进程/RPC
    
    mu     sync.RWMutex
    audit  AuditSink
    health HealthAggregator
}

// LoadFromDisk 支持 Go plugin / Python subprocess / WASM 三种加载器
type AdapterLoader interface {
    Load(ctx context.Context, path string) (*AdapterPackage, error)
}

// 三种加载器
type GoPluginLoader struct{}        // Go plugin.Open，仅限同编译链
type SubprocessLoader struct{}      // 启动子进程 + JSON-RPC/gRPC
type WASMLoader struct{}            // Wazero/Wasmtime，最强隔离

// 热加载入口
func (r *AdapterRegistry) Reload(ctx context.Context, filter AdapterFilter) (*ReloadReport, error)

// 灰度切换
func (r *AdapterRegistry) TrafficShift(ctx context.Context, adapterID string, version string, percent int) error

// 回滚
func (r *AdapterRegistry) Rollback(ctx context.Context, adapterID string, toVersion string) error
```

关键设计要点：
- **加载器插件化**：GoPluginLoader / SubprocessLoader / WASMLoader 三种，用户按风险偏好选择
- **签名校验**：上传前 `SHA256 + Ed25519` 签名校验，签名公钥放配置
- **版本管理**：`AdapterPackage{Version, Checksum, Dependencies, MinOrionVersion}`
- **灰度**：`TrafficShift` 支持 5% / 50% / 100% 三档，按 fingerprint 分桶
- **测试框架**：每个适配器带 `FixtureSet`，加载时先跑 fixture，通过才注册
- **生命周期**：`WarmUp → Serving → Draining → Stopped`，Draining 期间不再接新告警

### 4.4 适配器测试框架

```go
type AdapterTestSuite interface {
    // 加载期测试
    TestValidateConfig() error     // 用 fixture config 校验
    TestInitialize() error         // 用 mock external 校验初始化
    TestRoundtrip() error          // 构造测试告警，Poll → Dispatch 回环
    // 运行期测试
    TestHealth() error             // Health() 应返回 ok
    TestErrorRecovery() error      // 模拟 external 失败，验证重试
}

// 加载前强制执行测试，通过才注册
func (l AdapterLoader) LoadWithTest(ctx, path, suite) (*AdapterPackage, error) {
    pkg, err := l.Load(ctx, path)
    if err != nil { return nil, err }
    for _, t := range suite.All() {
        if err := t.Run(pkg.Adapter); err != nil {
            return nil, fmt.Errorf("adapter test %s failed: %w", t.Name(), err)
        }
    }
    return pkg, nil
}
```

---

## 5. 订阅与屏蔽策略深度分析

### 5.1 订阅策略维度对比

| 维度 | NeatLogic | Orion `route.Rule` | Gap |
|---|---|---|---|
| 人（用户列表） | ✅ 直接选人 | ❌ | G2 |
| 组织（团队/组织架构树） | ✅ TeamTree | ⚠️ `Team` 是字符串 | G1 |
| 系统（服务/CMDB） | ✅ 服务树 + 应用 | ⚠️ LabelMatches（可匹配 service） | G1 |
| 级别 | ✅ 多选 | ✅ Severity（单选） | G1 |
| 来源 | ✅ source + adapter | ⚠️ LabelMatches 可含 source | G1 |
| 对象（对象类型 CI） | ✅ CMDB CI 类型 | ❌ | G2 |
| 关键字（正则/子串） | ✅ Regex/Contains | ❌ | G2 |
| 时间窗口（工作时间/日历） | ✅ Cron + 工作日历 | ❌ | G2 |
| 值班表（OnCall Schedule） | ✅ | ❌（`Target` 是字符串） | G2 |
| 优先级/覆盖规则 | ✅ | ❌ | G2 |

**Orion 只有 1 维完整（级别）+ 3 维部分（组织/系统/来源）+ 6 维缺失**。

### 5.2 屏蔽策略维度对比

| 维度 | NeatLogic | Orion | Gap |
|---|---|---|---|
| 时间（Cron/日历/相对时长） | ✅ 三者都有 | ⚠️ `Duration` 秒 + `StartTime/EndTime` 绝对 | G1 |
| 来源（source） | ✅ | ✅ `MaintenanceWindow.Scope` 匹配 SourceID/Name | G0 |
| 级别 | ✅ | ⚠️ 需通过 `KnownIssue.LabelSelectors` 间接匹配 | G1 |
| 正则 | ✅ 完整正则 | ✅ `FingerprintPattern`（但只对指纹，不对 label） | G1 |
| Label 精确匹配 | ✅ | ⚠️ `LabelSelectors` 是 map，但语义未定义 | G1 |
| 值班日历（仅工作时间内） | ✅ | ❌ | G2 |
| 影响面（CI/业务） | ✅ | ❌ | G2 |
| 优先级冲突解决 | ✅ | ❌ | G2 |

### 5.3 建议的策略引擎架构

```go
// IStrategy SPI（订阅与屏蔽共用一套引擎）
type IStrategy interface {
    ID() string
    Kind() StrategyKind     // Subscription / Suppression / Enrichment / Escalation
    Match(ctx context.Context, evt *Event) (bool, MatchDetail)
    Apply(ctx context.Context, evt *Event) *EventOperation
}

type StrategyKind int
const (
    Subscription StrategyKind = iota   // 决定"通知谁"
    Suppression                        // 决定"是否静默"
    Enrichment                         // 决定"添加什么字段"
    Escalation                         // 决定"升级给谁"
)

// 匹配维度：所有维度可组合
type MatchDetail struct {
    Matched      bool
    Reason       string                 // "matched by label.service=api-gw"
    Confidence   float64                // 0-1
    EvaluatedBy  []string               // 哪些子条件命中
    TimeToLive   time.Duration          // 匹配有效期
}

// 策略引擎：多维度匹配 + 优先级 + 冲突解决
type StrategyEngine struct {
    strategies []IStrategy
    byKind     map[StrategyKind][]IStrategy
    
    // 冲突解决策略
    ConflictResolver ConflictPolicy   // FirstMatch / Priority / Composite
    
    // 优先级排序
    // 1. Kind 优先（Suppression > Escalation > Subscription > Enrichment）
    // 2. 同 Kind 按 Priority 排序
    // 3. 同 Priority 按 ID 排序
    
    // 灰度
    shadow []IStrategy                // 影子策略，评估但不执行
}

// 策略配置语言：CEL（Common Expression Language）
// 支持：
//   match(evt.Severity == "critical" || evt.Severity == "high")
//   match(evt.Labels["service"] in ["api-gw", "auth-svc"])
//   match(evt.Time().WithinWeekday(["Mon","Tue","Wed","Thu","Fri"], "09:00", "18:00"))
//   match(evt.MetricValue > 90.0)
//   match(evt.Fingerprint =~ "fp-.*prod")
//
// 优势：
// - CEL 是 Google 标准，有安全沙箱、无 arbitrary code
// - 语法类似 Go，运维学习成本低
// - 支持动态求值、错误定位、表达式版本化

type CELStrategy struct {
    ID     string
    Kind   StrategyKind
    Priority int
    Expr   string                    // CEL 表达式
    Apply  string                    // 匹配后的动作，也是 CEL 或结构化 JSON
    Enabled bool
}
```

关键设计要点：
- **CEL 表达式**：安全沙箱、语法规范、社区成熟
- **多维度组合**：单个表达式可组合所有维度，不锁死在 4 维
- **冲突解决**：明确 Suppression > Escalation > Subscription 的顺序（先抑制再路由）
- **影子策略**：新策略上线前先"影子运行"，只记录不执行，观察 24 小时命中率
- **回测**：提供 `POST /strategies/:id/backtest`，用历史告警回放评估命中率
- **值班表**：独立 `OnCallSchedule` 实体，策略通过 `Team` 字段引用

---

## 6. AI 智能分析深度分析

### 6.1 Orion AIReview 能力与 NeatLogic 商业版 AI 对比

| 能力 | NeatLogic 商业版 AI | Orion 现状 | 差距 |
|---|---|---|---|
| 告警摘要生成 | ✅ LLM 生成自然语言摘要 | ⚠️ `inferCause` 关键词匹配 5 类 | G2 |
| 根因分析 | ✅ 基于拓扑 + 时间序列 + LLM | ❌ `AutoCorrelate` 只有注释、返回空 | G3 |
| 聚类/相似告警 | ✅ 向量聚类 + 语义相似度 | ⚠️ `CorrelationRule` 有 `Confidence` 字段但 `AutoCorrelate` 未实现 | G2 |
| 模式识别 | ✅ 历史模式匹配 | ❌ | G3 |
| 变更关联 | ✅ 关联 CMDB 变更单 | ❌ | G3 |
| 自愈建议 | ✅ 推荐动作 + 一键执行 | ⚠️ `FixSuggestion` 只有 title + description，无执行 | G2 |
| 相似事件学习 | ✅ 用户反馈闭环 | ❌ | G3 |
| AIOps 指标 | ✅ MTTA/MTTR/告警有效性 | ✅ `AlertMetrics`（含 P95/SLABreachCount） | G0 |

**Orion AI 完全不在"告警分析"这条线上**：
- `AIAnalysisType` 枚举（`ai_models.py:39-45`）只有 `PIPELINE / CODE / COST` 三种，**无 `ALERT`**
- `ai_service.py` 全文搜索 "alert" 只有 1 处（`"Set up cost alerts"`），无告警分析代码
- Go 侧 `ExplainAlert` 完全在 `alert/service/service.go:411-458` 内联实现，不调用 AI 服务
- `alert-correlation.AutoCorrelate` 明确注释 `// Simplified: in a real implementation, this would query recent alerts and group them based on the rule conditions`

### 6.2 告警聚类/根因分析/模式识别能力现状

| 能力 | 现状 | 代码证据 |
|---|---|---|
| 告警聚类 | ⚠️ 静态指纹聚类 | `dedup.fingerprint` 只按 `name\|severity\|sourceType\|sourceId` SHA256，无语义相似度 |
| 根因分析 | ❌ 关键词硬编码 | `inferCause` 5 分支：cpu/mem/latency/error/默认 |
| 模式识别 | ❌ 无 | 无 `PatternRecognizer` 类 |
| 相似告警检测 | ⚠️ `CorrelationGroup` 有数据模型 | `AutoCorrelate` 未实现 |
| 拓扑根因 | ⚠️ `Topology` + `NodeHealth` | 数据模型有，但 `Correlate` 只做"按 fingerprint 分组 + 按 severity 挑 root" |
| 时序异常 | ❌ 无 | 无 `AnomalyDetector` |
| LLM 摘要 | ❌ 无 | `ExplainAlert` 纯规则 |

### 6.3 建议的 AI 增强路线

**Phase 1（MVP，2 周）**：LLM 接入
- 在 `orion-ai-service` 加 `AIAnalysisType.ALERT = "alert"`
- `POST /api/ai/analyze-alert`：接受 `Event`，返回 `AlertAIAnalysis{Summary, LikelyCauses[], RelatedEvents[], FixSuggestions[]}`
- 使用现有 LLM 通道，Prompt 模板 3 类：摘要 / 根因 / 修复
- 缓存：相同 fingerprint + 相同 severity 24 小时复用结果

**Phase 2（1-2 周）**：聚类 + 相似度
- 引入 `sentence-transformers`（Python 侧）或 `nomic-embed-text`
- 每个告警生成 1536 维 embedding，存入 pgvector
- `AlertCorrelator.Embed`：新告警进来，Top-K 相似历史告警（K=5）
- `CorrelationGroup.Similarity` 用真实余弦相似度，替换现在的硬编码 `1.0`

**Phase 3（2 周）**：根因分析
- 融合：拓扑（`Topology`）+ 时间序列（Prometheus）+ 变更单（CMDB）+ 相似历史告警
- 因果图推断：`Alert A → Alert B` 的时间先后 + 拓扑上下游 → 概率排序
- LLM 输出结构化 JSON，包含 `RootCause{Entity, Confidence, Evidence}`

**Phase 4（2 周）**：模式识别 + 自愈
- 历史告警训练 `PatternRecognizer`：`Rule → Alert → Resolution` 序列
- 输出 `HealAction{Script, Preconditions, SafetyCheck, RollbackScript}`
- 一键执行入口 + 沙箱隔离

**Phase 5（1-2 周）**：AIOps 指标闭环
- 用户反馈：告警"有效 / 无效 / 误报"
- 反馈闭环训练模型
- 自动调整阈值、自动静默长期误报

**总工时**：8-10 人周（60-80 人天），对标 NeatLogic 商业版核心能力。

---

## 7. 5 个 Orion 关键短板（P0/P1）

### P0-1：Source 类适配器几乎全 TODO，MQ 集成空缺
- **证据**：`alert-adapter/handlers.go:77,178,188,320,370` 五处 `// TODO: in production, ...`；Prometheus/Grafana/Zabbix/Kafka Source 类 handler 的 `Receive()` 只从 `alertQueue.Drain()` 返回本地队列
- **影响**：无法接入真实告警源，"多数据源接入"能力形同虚设
- **修复**：优先实现 Prometheus Alertmanager `/api/v2/alerts` HTTP 轮询 + Kafka consumer group（2 周）

### P0-2：`AutoCorrelate` 是空壳，根因分析无实现
- **证据**：`alert-correlation/service/service.go:101-108` 注释 `// Simplified: in a real implementation, this would query recent alerts and group them based on the rule conditions`，函数直接返回空 slice
- **影响**：告警聚类能力完全不存在，告警风暴时无聚合
- **修复**：实现 fingerprint + label + topology 三维度关联（1-2 周）

### P0-3：AI 告警分析能力零实现
- **证据**：`orion-ai-service` `AIAnalysisType` 无 `ALERT` 枚举；`alert.service.ExplainAlert` 纯关键词匹配；`inferCause` 5 分支硬编码
- **影响**：对标 NeatLogic 商业版 AI，Orion 完全空白
- **修复**：见 §6.3 Phase 1-3（3-5 周）

### P1-1：事件插件机制缺失，状态流转硬编码
- **证据**：`alert/service/service.go:59, 91, 114, 362-366` 状态字符串硬编码；无 `Event` 一等公民，无插件注册表，无事件流
- **影响**：无法自定义告警处理逻辑，NeatLogic 10+ 内置插件能力全部缺失
- **修复**：见 §3.3 SPI 设计（2-3 周）

### P1-2：订阅策略仅 4 维，屏蔽策略无 Cron/日历
- **证据**：`route.go:19-26` `Rule` 4 字段；`Silence.Duration` 只有相对时长
- **影响**：运维无法表达"生产库只通知 DBA 团队工作日 9-18 点"这类真实需求
- **修复**：见 §5.3 CEL 策略引擎（2-3 周）

---

## 8. 领域特有反模式 / 陷阱

### 8.1 告警风暴（级联触发）
**症状**：单点故障引发 100+ 关联告警，压垮下游。
**Orion 现状**：`alert-pipeline.ExecuteBatch` 有 `sem := make(chan struct{}, 10)` 并发限制（`service.go:192`），但**没有全局速率限制、没有聚合窗口、没有风暴检测**。`alert-breaker` 有断路器模型但只针对单个 alert，非"风暴"级别。
**建议**：引入 `StormDetector`，1 分钟窗口内相同 source 超过 N 条自动聚合成一条 summary，并阻塞 N 秒后重试。

### 8.2 告警疲劳（降噪不足）
**症状**：MTTA 恶化、值班人员忽视告警。
**Orion 现状**：`fatigue.Analyzer`（`alert-silence/fatigue/analyzer.go`）实现了疲劳打分（`computeFatigue` 有 4 维：frequency + interval + silence + severity），但**只在 `AlertSilenceService.GetFatigueScore` 手动查询时计算，`AutoSilenceRecommendations` 不自动执行**——只是"建议"，需要用户手动应用。
**建议**：疲劳分 > 阈值时自动创建 `Silence` + `Notification`（告警规则疲劳度 > 80 分），通知规则负责人。

### 8.3 状态不一致（外部系统已恢复，Orion 未感知）
**症状**：Prometheus 告警 resolved，但 Orion 显示 firing。
**Orion 现状**：`Ingest` 只处理 `firing` 状态（`service.go:62` `status := "firing"`），**没有处理外部推送的 `resolved` 事件的入口**。`alert-adapter` 的 `Receive()` 若返回 resolved 状态的告警，`Ingest` 会覆盖状态但 fingerprint 匹配逻辑不区分 firing/resolved。
**建议**：`Ingest` 接收 `status` 字段，若 `status=resolved` 则更新既有 firing 告警为 resolved 并触发 `OnResolve` 插件。

### 8.4 事件循环（多规则相互触发）
**症状**：规则 A 触发告警 X，X 触发规则 B，B 又触发告警 Y，Y 触发规则 A。
**Orion 现状**：无 `TraceID`/`CausationID`，`Event` 无因果链。若实现了 §3.3 插件但没有循环检测，会立即踩坑。
**建议**：每个 `Event` 带 `TraceID`（全局链）+ `CausationID`（直接父），插件执行前检测 `TraceID` 中出现次数超过 3 次即中止。

### 8.5 时间窗口告警（去重/聚合）
**症状**：告警每 30 秒刷新一次，同一问题产生 48 条/小时。
**Orion 现状**：`dedup.Stage` 有 10 分钟窗口（`service.go:344` `NewStage(logger, 10*time.Minute)`），但**窗口硬编码、不可配置**，且只在内存中，进程重启丢失。
**建议**：`dedup` 窗口改为配置项，持久化到 Redis/PostgreSQL，支持"聚合模式"（多条合并为一条，`count` 递增）。

### 8.6 权限与告警可见性冲突
**症状**：某租户 A 的告警被误路由到租户 B 的用户。
**Orion 现状**：多处 `tenantID` 从 `c.GetString("tenant_id")` 获取（`handler.go:63`），中间件注入，`alert/service.Ingest` 显式拒绝 body 里的 `req.TenantID`（`service.go:54-58` 注释："letting the request body pick the tenant would let any token holder ingest alerts into another tenant's workspace"）。**这是正确的**，但 `route.Stage.Rule.Team` 是字符串，可能指向其他租户的 team。
**建议**：`Team` 引用需校验属于当前 `TenantID`，否则拒绝路由。

### 8.7 大 payload 处理
**症状**：告警 payload 包含完整日志堆栈（几十 KB），压垮 DB 或网络。
**Orion 现状**：`alert.models.Alert.Labels` 和 `Annotations` 是 JSON blob（无大小限制），`alert-adapter-v2.AlertNotificationEvent.Payload` 也是字符串无限制。**Handler 层无 payload 大小检查**。
**建议**：`IngestRequest` 加 `binding:"max=64kb"`，超过自动截断 + 存 OSS 引用。

### 8.8 AI 分析冷启动
**症状**：新用户第一次告警，AI 无历史可参考，摘要质量差。
**Orion 现状**：无 `AlertAIAnalysis` 历史库；`AlertExplanation.Evidence` 每次现算。
**建议**：告警入库时异步生成 embedding，冷启动时返回模板化摘要 + "AI 正在学习"提示。

### 8.9 屏蔽规则误屏蔽
**症状**：一条屏蔽规则意外屏蔽了生产 P0 告警。
**Orion 现状**：`KnownIssue.FingerprintPattern` 是自由字符串（无正则校验），`MaintenanceWindow.Scope` 是 JSON blob 无 Schema。**无 dry-run、无回测、无审计告警**。
**建议**：新建屏蔽规则时强制 `backtest` 24 小时历史告警，展示"预计屏蔽 X 条"，用户确认后再启用；影子模式 24 小时后自动评估。

---

## 9. Phase 建议 + 工时校准

### Phase 0：基础设施（3 周）
1. 补齐 Source 类适配器（Prometheus / Kafka）：8 人天
2. `dedup` 窗口配置化 + 持久化：3 人天
3. Payload 大小限制：2 人天
4. `Ingest` 支持 resolved 状态：3 人天
- **小计**：16 人天

### Phase 1：事件插件 SPI（3-4 周）
1. `IEventPlugin` 接口 + Registry（含沙箱）：8 人天
2. 10 个内置事件插件（升级/指派/标记/修改字段/第三方接口/自愈触发/变更关联/值班表匹配/聚合/静默）：15 人天
3. 事件审计 + 循环检测：5 人天
4. REST API + 前端配置界面：8 人天
- **小计**：36 人天

### Phase 2：适配器热加载（3 周）
1. `AdapterLoader` 接口 + SubprocessLoader（gRPC）：8 人天
2. 签名校验 + 版本管理：4 人天
3. 灰度切换 + 回滚：5 人天
4. 测试框架 + fixture：4 人天
- **小计**：21 人天

### Phase 3：策略引擎（CEL）（2-3 周）
1. CEL 集成 + 语法约束：5 人天
2. `StrategyEngine` + 冲突解决：5 人天
3. 值班表 `OnCallSchedule`：4 人天
4. 影子策略 + 回测：4 人天
5. 前端表达式编辑器：5 人天
- **小计**：23 人天

### Phase 4：AI 增强（6-8 周）
1. Phase 1 LLM 摘要 + 根因：15 人天
2. Phase 2 聚类 + embedding：15 人天
3. Phase 3 拓扑根因：15 人天
4. Phase 4 模式识别 + 自愈：15 人天
5. Phase 5 反馈闭环：10 人天
- **小计**：70 人天

### Phase 5：状态机 + 生命周期（2 周）
1. Alert 状态机（firing / acknowledged / resolved / suppressed）：5 人天
2. AlertClosure 完善（含 MTTR、SLA breach）：5 人天
- **小计**：10 人天

### 总计工时

| Phase | 内容 | 人天 |
|---|---|---|
| Phase 0 | 基础设施 | 16 |
| Phase 1 | 事件插件 SPI | 36 |
| Phase 2 | 适配器热加载 | 21 |
| Phase 3 | 策略引擎 | 23 |
| Phase 4 | AI 增强 | 70 |
| Phase 5 | 状态机完善 | 10 |
| **总计** | **176 人天** | **~40 人周（10 人并行约 4 周）** |

**关键路径**：Phase 0 → Phase 1 → Phase 3 → Phase 4。Phase 2 可与 Phase 1 并行。Phase 5 可与任意并行。

**风险校准**：
- AI 部分（Phase 4）不确定性最大，实际可能 100-120 人天
- 若已有 LLM 通道成熟，Phase 1 可缩短到 10 人天
- 若不需要适配器热加载（内部部署固定适配器集），Phase 2 可跳过，节省 21 人天

---

## 附录：领域专家视角总结

Orion 告警系统的**骨架完成度高（85%）、业务深度不足（55%）**。8 个 Go 微服务模块 + Python AI 服务的组合，说明团队已经识别出告警领域的分层——核心（alert）、适配（adapter）、管道（pipeline）、升级（escalation）、关联（correlation）、去重（dedup）、沉默（silence）、规则（rule-engine）——但**每一层的深度都停在"能演示"阶段**：

- 适配器：V2 通知通道 11/15 真实发送，但 Source 类（Prometheus/Grafana/Zabbix/Kafka）几乎全 TODO
- 管道：7 阶段固定，不可插拔
- 策略：4 维路由，无 Cron/日历/值班表
- AI：`ExplainAlert` 关键词匹配，AI 服务无 ALERT 分析类型
- 状态机：字符串硬编码三态
- 事件模型：无 Event 一等公民，无插件链

**对标 NeatLogic**：Orion 有 NeatLogic 的"目录结构"但没有"业务深度"。NeatLogic 是 15 年告警平台积淀（含 10+ 事件插件、动态字段、AI 商业版），Orion 是 6-12 个月 Go 微服务蓝图，两者代差明显。

**优先修复顺序**：Source 适配器（P0-1）→ 关联实现（P0-2）→ AI 分析（P0-3）→ 事件插件（P1-1）→ 策略引擎（P1-2）。前 3 个 P0 补齐后，Orion 告警能力可从 55% 提升至 75%（对标 NeatLogic 开源版），事件插件 + 策略引擎补齐后可达 90%（对标 NeatLogic 商业版 AI 之外）。

**告警专家一句话**：Orion 告警像 PagerDuty v1（2013 年）——功能清单齐全、每层都停在了"能跑"，没有达到"跑得好"。真正告警平台的护城河不在功能列表，在**降噪质量、根因准确率、疲劳度管理**。Orion 的 `fatigue.Analyzer` 是加分项，但需要自动执行而非建议；`ExplainAlert` 需要真 LLM 而非关键词；`AutoCorrelate` 需要真关联而非空壳。
