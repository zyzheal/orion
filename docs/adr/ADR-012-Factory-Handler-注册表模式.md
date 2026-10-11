# ADR-012: Factory+Handler 注册表模式

| 元数据 | |
|--------|------|
| 状态 | 已接受（Accepted）|
| 提出日期 | 2026-10-03 |
| 决策日期 | 2026-10-11 |
| 提出人 | 架构团队 |
| 决策人 | 待确认 |
| 关联模块 | 全平台（Alert/Automation/Notification 等）|
| 前置依赖 | ADR-0001 微服务架构、ADR-002 Plugin SPI、ADR-010 AlertBreaker 并发模型 |
| 参考对标 | NeatLogic 100+ Handler + Factory 注册表（NL-3 一手：AlertEventHandlerFactory 25+ handler）|

---

## 1. 背景与问题

### 1.1 决策背景

**NeatLogic 一手证据**（NL-3、NL-6）：

NeatLogic 大规模使用 **Factory + Handler 注册表模式**：
```java
// Factory: 集中管理所有 handler
public class AlertEventHandlerFactory {
    private static final Map<String, AlertEventHandler> HANDLERS = new ConcurrentHashMap<>();
    
    public static void register(String type, AlertEventHandler handler) {
        HANDLERS.put(type, handler);
    }
    
    public static AlertEventHandler get(String type) {
        return HANDLERS.get(type);
    }
}

// Handler 实现：分散在各模块
@Component
public class AlertRouteHandler implements AlertEventHandler {
    @Override
    public String type() { return "route"; }
    
    @Override
    public void handle(AlertEvent event) { /* ... */ }
}

// 使用：通过 type 字符串路由
AlertEventHandler handler = AlertEventHandlerFactory.get(event.type());
handler.handle(event);
```

**NeatLogic 生态规模**：
- AlertEventHandlerFactory：25+ handler
- TaskHandlerType：10+ handler
- CITypeHandlerFactory：多类型
- ChangeProcessStepHandlerType：8+ handler
- **总计 100+ Handler**（跨模块）

### 1.2 Orion 现状（直接 Service 调用）

当前 Orion 主要使用**直接 Service 调用**或 `if-else` / `switch` 分发：

```go
// Orion 现状：直接 switch 分发
func (s *AlertService) HandleEvent(ctx context.Context, event *AlertEvent) error {
    switch event.Type {
    case "route":
        return s.routeHandler.Handle(ctx, event)
    case "notify":
        return s.notifyHandler.Handle(ctx, event)
    case "escalate":
        return s.escalateHandler.Handle(ctx, event)
    default:
        return ErrUnknownEventType
    }
}
```

**问题**：
1. 新增 handler 类型必须修改主 switch 代码
2. 违反开闭原则（OCP）
3. 无法通过运行时动态注册 handler
4. 测试困难（需 mock 整个 switch）
5. 无法用 Factory 管理依赖注入

### 1.3 决策驱动问题

**Q1**：Orion 是否需要 Factory 注册表模式？
- 若"是"：可扩展性大幅提升，对齐 NL 生态
- 若"否"：保持简单，但扩展成本随时间增长

**Q2**：Factory 与 Plugin SPI（ADR-002）的关系？
- Plugin SPI 是**跨模块**插件（第三方）
- Factory 是**模块内**扩展点（同仓库）
- 两者互补不冲突

**Q3**：是否用 Go 的 init() 自动注册？
- ✅ 自动注册简洁，但隐式依赖难追踪
- ❌ 全局变量难测试

### 1.4 决策目标

- 定义 Factory+Handler 注册表标准模式
- 明确适用范围（哪些场景用 Factory，哪些不用）
- 定义与 Plugin SPI 的边界

---

## 2. 备选方案对比

### 2.1 方案 A：全局 Factory 注册表（NL 方案）

**实现**：
```go
// handler_factory.go
type AlertEventHandler interface {
    Type() string
    Handle(ctx context.Context, event *AlertEvent) error
}

type AlertEventHandlerFactory struct {
    mu       sync.RWMutex
    handlers map[string]AlertEventHandler
}

var GlobalAlertFactory = &AlertEventHandlerFactory{
    handlers: make(map[string]AlertEventHandler),
}

func RegisterAlertHandler(h AlertEventHandler) {
    GlobalAlertFactory.mu.Lock()
    defer GlobalAlertFactory.mu.Unlock()
    GlobalAlertFactory.handlers[h.Type()] = h
}

func GetAlertHandler(t string) (AlertEventHandler, bool) {
    GlobalAlertFactory.mu.RLock()
    defer GlobalAlertFactory.mu.RUnlock()
    h, ok := GlobalAlertFactory.handlers[t]
    return h, ok
}

// 自动注册（init 函数）
// handler_route.go
func init() {
    RegisterAlertHandler(&AlertRouteHandler{})
}
```

**优点**：
- ✅ 与 NL 生态 1:1 对齐
- ✅ 扩展简单（新增 handler 只需实现接口 + init 注册）
- ✅ 运行时动态注册（支持外部扩展）
- ✅ 与 ADR-002 Plugin SPI 兼容（可用作 SPI 内部实现）

**缺点**：
- ⚠️ 全局变量隐式依赖，难追踪
- ⚠️ init() 顺序不保证（可能引发问题）
- ⚠️ 测试需清理全局状态

### 2.2 方案 B：依赖注入 + Provider（Spring 风格）

**实现**：
```go
// Provider 模式
type AlertEventHandlerProvider struct {
    routeHandler    AlertEventHandler
    notifyHandler   AlertEventHandler
    escalateHandler AlertEventHandler
    // ...
}

func (p *AlertEventHandlerProvider) Get(t string) AlertEventHandler {
    switch t {
    case "route": return p.routeHandler
    case "notify": return p.notifyHandler
    default: return nil
    }
}
```

**优点**：
- ✅ 依赖显式注入（便于测试）
- ✅ 无全局状态
- ✅ 编译时检查

**缺点**：
- ❌ 新增 handler 需修改 Provider 定义
- ❌ 与 NL 生态不对齐
- ❌ 扩展不灵活

### 2.3 方案 C：直接 Service 调用（Orion 现状）

**优点**：
- ✅ 简单直接
- ✅ 无额外抽象
- ✅ 编译时检查

**缺点**：
- ❌ 违反 OCP
- ❌ 扩展需修改主代码
- ❌ 与 NL 生态不对齐

### 2.4 方案 D：Go plugins / 反射动态加载

**优点**：
- ✅ 真正运行时扩展
- ✅ 支持外部动态加载

**缺点**：
- ❌ Go plugins 复杂且不稳定
- ❌ 反射性能开销
- ❌ 安全审计难

### 2.5 方案对比矩阵

| 维度 | A: 全局 Factory | B: Provider | C: 直接调用 | D: Plugins |
|------|----------------|-------------|------------|-----------|
| NL 对齐 | ⭐⭐⭐⭐⭐ 1:1 | ⭐⭐ | ⭐ | ⭐ |
| 扩展性 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| 测试性 | ⭐⭐⭐（需清理全局）| ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| 隐式依赖 | ⚠️ 中 | ✅ 无 | ✅ 无 | ⚠️ 高 |
| 实施复杂度 | 低 | 低 | 无 | 高 |
| 安全审计 | ⚠️ 中 | ✅ 高 | ✅ 高 | ❌ 低 |
| Go 生态成熟度 | ✅ 中 | ✅ 高 | ✅ 高 | ❌ 低 |

---

## 3. 决策

### 3.1 选定方案

**方案 A：全局 Factory 注册表**（NL 对齐 + Go 原生）

**修改点**（相较原始方案 A）：
1. **不用 init() 自动注册**：改用显式 `Register()` 函数调用（可控）
2. **不用单例全局变量**：用依赖注入的 `Factory` 实例（可测试）
3. **不用 map 直接索引**：用 `map[string]Handler` + 索引表（便于枚举）

理由：
1. **NL 生态对齐**：语义 1:1（便于将来数据同步）
2. **Go 生态适配**：不用 init()（避免隐式依赖）
3. **可测试**：Factory 实例可注入
4. **与 ADR-002 Plugin SPI 互补**：Factory 是内部扩展，SPI 是外部插件

### 3.2 关键设计决定

#### 3.2.1 Factory 接口标准

```go
// handler_factory.go
package factory

type Handler[T any] interface {
    Type() string
    Handle(ctx context.Context, event T) error
}

type HandlerFactory[T any] struct {
    mu       sync.RWMutex
    handlers map[string]Handler[T]
    order    []string  // 保留注册顺序
}

func NewHandlerFactory[T any]() *HandlerFactory[T] {
    return &HandlerFactory[T]{
        handlers: make(map[string]Handler[T]),
    }
}

func (f *HandlerFactory[T]) Register(h Handler[T]) error {
    f.mu.Lock()
    defer f.mu.Unlock()
    if _, exists := f.handlers[h.Type()]; exists {
        return fmt.Errorf("duplicate handler type: %s", h.Type())
    }
    f.handlers[h.Type()] = h
    f.order = append(f.order, h.Type())
    return nil
}

func (f *HandlerFactory[T]) Get(t string) (Handler[T], bool) {
    f.mu.RLock()
    defer f.mu.RUnlock()
    h, ok := f.handlers[t]
    return h, ok
}

func (f *HandlerFactory[T]) List() []string {
    f.mu.RLock()
    defer f.mu.RUnlock()
    return append([]string{}, f.order...)
}

func (f *HandlerFactory[T]) Count() int {
    f.mu.RLock()
    defer f.mu.RUnlock()
    return len(f.handlers)
}
```

#### 3.2.2 使用示例：Alert EventHandler

```go
// alert_event_handler.go
type AlertEvent interface {
    GetID() string
    GetTenantID() string
    GetEventType() string
    GetPayload() map[string]any
}

type AlertEventHandler interface {
    Type() string
    Handle(ctx context.Context, event AlertEvent) error
}

// alert_event_handler_factory.go
package alert

var GlobalEventHandlerFactory = factory.NewHandlerFactory[AlertEvent]()

// handler_route.go
type AlertRouteHandler struct{}

func (h *AlertRouteHandler) Type() string { return "route" }

func (h *AlertRouteHandler) Handle(ctx context.Context, event AlertEvent) error {
    // 实际路由逻辑
    return nil
}

// wiring.go（启动时显式注册）
func wireAlertModule() {
    GlobalEventHandlerFactory.Register(&AlertRouteHandler{})
    GlobalEventHandlerFactory.Register(&AlertNotifyHandler{})
    GlobalEventHandlerFactory.Register(&AlertEscalateHandler{})
    // ...
}

// 使用
func (s *AlertService) HandleEvent(ctx context.Context, event AlertEvent) error {
    handler, ok := GlobalEventHandlerFactory.Get(event.GetEventType())
    if !ok {
        return fmt.Errorf("no handler for event type: %s", event.GetEventType())
    }
    return handler.Handle(ctx, event)
}
```

#### 3.2.3 测试支持

```go
// factory 单测：清理全局状态
func TestHandlerFactory_Register(t *testing.T) {
    factory := factory.NewHandlerFactory[string]()
    err := factory.Register(NewMockHandler("type-a"))
    assert.NoError(t, err)
    err = factory.Register(NewMockHandler("type-a"))  // 重复
    assert.Error(t, err)
}

// handler 单测：无需 mock 全局
func TestAlertRouteHandler(t *testing.T) {
    h := &AlertRouteHandler{}
    err := h.Handle(ctx, mockEvent)
    assert.NoError(t, err)
}
```

#### 3.2.4 与 ADR-002 Plugin SPI 的关系

**边界划分**：
- **Factory**：模块内扩展点（同仓库，编译期注册）
- **Plugin SPI**：跨模块外部插件（第三方，运行时加载）

**集成方式**：
```go
// Plugin 可通过 Factory 注册
func (p *ExternalAlertPlugin) Init() error {
    // 外部插件通过 Factory 注册自己的 handler
    return alert.GlobalEventHandlerFactory.Register(p)
}
```

### 3.3 适用范围

| 场景 | 是否用 Factory | 理由 |
|------|--------------|------|
| Alert EventHandler | ✅ 是 | 多类型（route/notify/escalate）|
| Automation TaskRunner | ✅ 是 | 多类型（shell/docker/ssh/k8s）|
| Notification Channel | ✅ 是 | 多类型（slack/dingtalk/email）|
| CMDB CI Type Handler | ✅ 是 | 多类型（server/database/app）|
| Pipeline StageExecutor | ⚠️ 部分 | 已有 Stage 编排，仅 TaskRunner 用 Factory |
| Webhook Handler | ✅ 是 | 多事件类型 |
| 单一 handler 场景 | ❌ 否 | 过度设计 |

---

## 4. 风险与缓解

### 4.1 已知风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 重复注册导致冲突 | 中 | 低 | Register() 返回 error（已实现）|
| Handler 类型字符串错误 | 中 | 中 | 单元测试 + 编译期常量 |
| 全局 Factory 并发访问 | 低 | 中 | RWMutex 保护 |
| Handler 生命周期管理 | 低 | 中 | Factory 内保留 handler 引用 |

### 4.2 监控指标

| 指标 | 类型 | 阈值 |
|------|------|------|
| `factory_handlers_registered_total` | Counter | 每启动 +N |
| `factory_handler_invocations_total` | Counter | 按 type 分组 |
| `factory_handler_invocation_duration_ms` | Histogram | p99 > 1000ms 告警 |
| `factory_duplicate_registration_total` | Counter | > 0 告警 |

---

## 5. 影响面

### 5.1 对代码库的影响

- **新增**：`internal/common/factory/handler_factory.go`（通用泛型 Factory）
- **改造**：Alert / Automation / Notification 3 大模块改用 Factory
- **保留**：其他模块保持直接 Service 调用（不强制改造）

### 5.2 对执行阶段的影响

| 阶段 | 影响 | 门控 |
|------|------|------|
| S0 基础设施 | 新增 Factory 通用库 | 必过 |
| S4 Automation | TaskRunner Factory 落地 | 必过 |
| S6 Alert | AlertEventHandlerFactory 落地 | 必过 |
| 全局 | 未来新模块可选用 Factory | 非阻塞 |

### 5.3 对风险登记册的影响

- 新增 **R-P2-20**：Handler 重复注册（低-低，Register 已防）
- 新增 **R-P2-21**：Handler 类型字符串错误（低-中，单测覆盖）

---

## 6. 与 NeatLogic 的对齐细节

### 6.1 语义对齐

| 概念 | NeatLogic | Orion ADR-012 |
|------|-----------|---------------|
| Factory | `AlertEventHandlerFactory` | `HandlerFactory[AlertEvent]` |
| Handler | `AlertEventHandler` interface | `AlertEventHandler` interface |
| 注册 | `register(type, handler)` | `Register(handler)` |
| 获取 | `get(type)` | `Get(type)` |
| 数量 | 25+ Alert handlers | 目标 10+ |

### 6.2 差异点

| 维度 | NeatLogic | Orion ADR-012 |
|------|-----------|---------------|
| 注册方式 | Spring 注解（@Component）| 显式 Register() 调用 |
| 泛型 | Java 无泛型，用反射 | Go 泛型（类型安全）|
| 线程安全 | ConcurrentHashMap | sync.RWMutex |
| 顺序 | 无序 | 有序（保留注册顺序）|

---

## 7. 相关 ADR

- **ADR-001** 微服务架构（Factory 在模块内）
- **ADR-002** Plugin SPI（互补，不冲突）
- **ADR-010** AlertBreaker 并发模型（Alert EventHandler Factory 是下游）
- **ADR-013** CMDB 二阶模型（CI Type Handler 可用 Factory）

---

## 8. 参考

- NL-3 一手证据：`reports/expert-reviews/neatlogic-deploy-tagent-change-firsthand-2026-10-03.md` §Alert
- v5 综合报告：`cross-review-synthesis-2026-10-03-v5.md` §架构哲学
- ADR-002：`docs/adr/ADR-002-Plugin-SPI 接口设计.md`

---

**文档编号**：`ADR-012-Factory-Handler-注册表模式.md`
**下一步**：本 ADR 决策批准 → S0 阶段新增 Factory 通用库 → S4/S6 阶段落地 TaskRunner/AlertEventHandler Factory
