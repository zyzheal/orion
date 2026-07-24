package engine

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"

	"orion/notification-svc-go/internal/notification/models"
)

// ---------------------------------------------------------------------------
// NotifyChannel - SPI 接口（单渠道发送器）
//
// 对应 NeatLogic 的 INotifyHandler，每个渠道实现一个具体 handler。
// 工厂基于 ChannelType 路由，支持热插拔。
// ---------------------------------------------------------------------------

// NotifyChannel is the SPI interface for a single notification delivery channel.
// Each concrete channel (Email, Slack, Webhook, SMS, WeChat, DingTalk, etc.)
// implements this interface and registers itself with NotifyHandlerFactory via init().
//
// This is the Go equivalent of NeatLogic's INotifyHandler:
//
//	public interface INotifyHandler {
//	    String getHandler();   // channel type key
//	    void execute(NotifyVo notifyVo);
//	}
type NotifyChannel interface {
	// Type returns the canonical channel type key (e.g. "email", "slack").
	// Used as the lookup key in NotifyHandlerFactory.
	Type() models.ChannelType

	// Execute sends a notification through this channel.
	// Returns a SendResult with delivery metadata.
	// Implementations should be idempotent and handle retries internally.
	Execute(ctx context.Context, msg *NotifyMessage) (*SendResult, error)

	// Healthy returns whether this channel is currently operational.
	// Used for health checks and failover routing.
	Healthy() bool
}

// ---------------------------------------------------------------------------
// NotifyMessage - 消息载体（类似 NeatLogic 的 NotifyVo）
// ---------------------------------------------------------------------------

// NotifyMessage is the canonical data carrier for notifications.
// Equivalent to NeatLogic's NotifyVo:
//
//	type NotifyVo {
//	    Title, Content, Recipients, CC, Attachments, Error, TenantID, TriggerType
//	}
type NotifyMessage struct {
	// 核心字段
	ID          string       `json:"id"`          // 通知唯一 ID
	TenantID    string       `json:"tenantId"`    // 租户 ID
	UserID      string       `json:"userId"`      // 目标用户
	Type        string       `json:"type"`        // 事件类型 (ALERT_CREATED, PIPELINE_FAILED, etc.)
	Title       string       `json:"title"`       // 消息标题
	Content     string       `json:"content"`     // 消息正文
	Subject     string       `json:"subject"`     // 邮件/消息主题
	Recipient   string       `json:"recipient"`   // 直接接收人
	CC          []string     `json:"cc"`          // 抄送列表
	BCC         []string     `json:"bcc"`         // 密送列表
	Attachments []string     `json:"attachments"` // 附件链接
	Metadata    models.JSONB `json:"metadata"`    // 扩展属性
	// 模板变量（FreeMarker 风格）
	TemplVars map[string]any `json:"-"` // 模板替换变量
	// 优先级与限流
	Priority   int `json:"priority"`   // 0=normal, 1=high, 2=urgent
	RetryCount int `json:"retryCount"` // 已重试次数
	MaxRetries int `json:"maxRetries"` // 最大重试次数
}

// ---------------------------------------------------------------------------
// SendResult - 发送结果
// ---------------------------------------------------------------------------

// SendResult records the outcome of a channel delivery attempt.
type SendResult struct {
	Success      bool   `json:"success"`
	MessageID    string `json:"messageId"`
	ResponseCode int    `json:"responseCode"`
	ResponseBody string `json:"responseBody"`
	Error        string `json:"error"`
	DurationMS   int64  `json:"durationMs"`
}

// ---------------------------------------------------------------------------
// NotifyHandlerFactory - 渠道发送器工厂（sync.Map + init 注册）
//
// 对应 NeatLogic 的 NotifyHandlerFactory，使用 sync.Map 存储所有注册的渠道 handler。
// Go 版本通过 init() 注册替代 Spring @Component 自动扫描。
// ---------------------------------------------------------------------------

// NotifyHandlerFactory manages registered NotifyChannel implementations.
//
// Example registration (in each channel package's init()):
//
//	func init() {
//	    engine.GlobalHandlerFactory.Register(channels.NewEmailHandler())
//	    engine.GlobalHandlerFactory.Register(channels.NewSlackHandler())
//	}
//
// Example usage:
//
//	handler, ok := engine.GlobalHandlerFactory.Get(models.ChannelEmail)
//	if ok {
//	    result, err := handler.Execute(ctx, msg)
//	}
type NotifyHandlerFactory struct {
	// channels holds the registered NotifyChannel instances, keyed by ChannelType string.
	channels sync.Map // map[string]NotifyChannel

	// defaultHandler is used when no specific handler matches the requested type.
	defaultHandler atomic.Value // holds a NotifyChannel

	// metrics collects factory-level statistics.
	metrics FactoryMetrics
}

// FactoryMetrics tracks factory-level statistics.
type FactoryMetrics struct {
	RegisterCount int64 `json:"registerCount"`
	GetCount      int64 `json:"getCount"`
	MissCount     int64 `json:"missCount"`
	ErrorCount    int64 `json:"errorCount"`
}

// GlobalHandlerFactory is the singleton factory instance.
// All channel packages register their NotifyChannel implementations here.
var GlobalHandlerFactory = NewNotifyHandlerFactory()

// NewNotifyHandlerFactory creates a new factory instance.
func NewNotifyHandlerFactory() *NotifyHandlerFactory {
	return &NotifyHandlerFactory{}
}

// Register adds a NotifyChannel to the factory.
// This is the Go equivalent of NeatLogic's spring context auto-registration.
// Must be called from init() in each channel package.
//
// If a handler for the same type already exists, the new one replaces it.
func (f *NotifyHandlerFactory) Register(ch NotifyChannel) {
	if ch == nil {
		return
	}
	f.channels.Store(string(ch.Type()), ch)
	atomic.AddInt64(&f.metrics.RegisterCount, 1)
}

// RegisterIfAbsent adds a NotifyChannel only if no handler exists for that type.
// Useful for built-in defaults that should not be overridden.
func (f *NotifyHandlerFactory) RegisterIfAbsent(ch NotifyChannel) bool {
	if ch == nil {
		return false
	}
	_, loaded := f.channels.LoadOrStore(string(ch.Type()), ch)
	if !loaded {
		atomic.AddInt64(&f.metrics.RegisterCount, 1)
	}
	return !loaded // true if newly registered
}

// Get retrieves a NotifyChannel by its type.
func (f *NotifyHandlerFactory) Get(channelType models.ChannelType) (NotifyChannel, bool) {
	atomic.AddInt64(&f.metrics.GetCount, 1)
	v, ok := f.channels.Load(string(channelType))
	if !ok {
		atomic.AddInt64(&f.metrics.MissCount, 1)
		return nil, false
	}
	return v.(NotifyChannel), true
}

// GetOrDefault returns a NotifyChannel, falling back to the default if not found.
func (f *NotifyHandlerFactory) GetOrDefault(channelType models.ChannelType) NotifyChannel {
	ch, ok := f.Get(channelType)
	if ok {
		return ch
	}
	v := f.defaultHandler.Load()
	if v != nil {
		return v.(NotifyChannel)
	}
	return nil
}

// SetDefaultHandler sets the fallback handler for unregistered channel types.
func (f *NotifyHandlerFactory) SetDefaultHandler(ch NotifyChannel) {
	f.defaultHandler.Store(ch)
}

// Has returns whether a handler exists for the given type.
func (f *NotifyHandlerFactory) Has(channelType models.ChannelType) bool {
	_, ok := f.channels.Load(string(channelType))
	return ok
}

// All returns a copy of all registered channel types.
func (f *NotifyHandlerFactory) All() []models.ChannelType {
	var result []models.ChannelType
	f.channels.Range(func(key, value any) bool {
		result = append(result, models.ChannelType(key.(string)))
		return true
	})
	return result
}

// ForEach iterates over all registered handlers.
func (f *NotifyHandlerFactory) ForEach(fn func(ch NotifyChannel)) {
	f.channels.Range(func(key, value any) bool {
		if ch, ok := value.(NotifyChannel); ok {
			fn(ch)
		}
		return true
	})
}

// Metrics returns a snapshot of factory metrics.
func (f *NotifyHandlerFactory) Metrics() FactoryMetrics {
	return FactoryMetrics{
		RegisterCount: atomic.LoadInt64(&f.metrics.RegisterCount),
		GetCount:      atomic.LoadInt64(&f.metrics.GetCount),
		MissCount:     atomic.LoadInt64(&f.metrics.MissCount),
		ErrorCount:    atomic.LoadInt64(&f.metrics.ErrorCount),
	}
}

// Unregister removes a handler (useful for testing).
func (f *NotifyHandlerFactory) Unregister(channelType models.ChannelType) {
	f.channels.Delete(string(channelType))
}

// ---------------------------------------------------------------------------
// ChannelRouter - 多路由（fallback chain）
// ---------------------------------------------------------------------------

// ChannelRouter attempts delivery through a chain of channel types in order.
// The first successful delivery wins; if all fail, returns the last error.
type ChannelRouter struct {
	factory *NotifyHandlerFactory
	chains  map[string][]models.ChannelType // policy name -> ordered chain
}

// NewChannelRouter creates a new router with the given factory.
func NewChannelRouter(factory *NotifyHandlerFactory) *ChannelRouter {
	return &ChannelRouter{
		factory: factory,
		chains:  make(map[string][]models.ChannelType),
	}
}

// SetChain defines a delivery chain for a policy/event type.
// Delivery attempts each channel in order until one succeeds.
func (r *ChannelRouter) SetChain(name string, channels []models.ChannelType) {
	r.chains[name] = channels
}

// Route dispatches a message through the first available healthy channel in the chain.
func (r *ChannelRouter) Route(ctx context.Context, policyName string, msg *NotifyMessage) (*SendResult, error) {
	chains := r.chains[policyName]
	if len(chains) == 0 {
		// Fallback: try the message's preferred channel type from metadata
		prefCh, _ := msg.Metadata["channel"].(string)
		if prefCh != "" {
			handler, ok := r.factory.Get(models.ChannelType(prefCh))
			if ok {
				return handler.Execute(ctx, msg)
			}
		}
		return nil, ErrNoChannelConfigured
	}

	var lastErr error
	for _, ct := range chains {
		handler, ok := r.factory.Get(ct)
		if !ok {
			lastErr = fmt.Errorf("channel not registered: %s", ct)
			continue
		}
		if !handler.Healthy() {
			lastErr = fmt.Errorf("channel unhealthy: %s", ct)
			continue
		}
		result, err := handler.Execute(ctx, msg)
		if err == nil && result.Success {
			return result, nil
		}
		// Record error on factory metrics
		atomic.AddInt64(&r.factory.metrics.ErrorCount, 1)
		lastErr = err
	}
	return nil, lastErr
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

var (
	ErrNoChannelConfigured = fmt.Errorf("no channel configured for this delivery")
)
