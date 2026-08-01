package engine

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"

	"orion/platform-svc-go/internal/notification/notification/models"
)

// ---------------------------------------------------------------------------
// NotifyPolicyHandler - 策略处理器接口（对应 NeatLogic NotifyPolicyHandlerBase）
//
// 对应 NeatLogic 的 NotifyPolicyHandlerBase：
//
//	public class NotifyPolicyHandlerBase {
//	    String getTriggerType();
//	    void handle(NotifyPolicyConfig config, NotifyParam param);
//	}
//
// 每个业务模块（Alert, Pipeline, Deployment, Ticket）实现一个 PolicyHandler，
// 负责将业务事件转换为 NotifyMessage，并由工厂路由到合适的渠道。
// ---------------------------------------------------------------------------

// NotifyPolicyHandler processes a business event and converts it into one or more
// NotifyMessages for delivery. Each handler is keyed by a trigger type
// (e.g. "ALERT_CREATED", "PIPELINE_FAILED", "TICKET_ASSIGNED").
//
// This is the Go equivalent of NeatLogic's NotifyPolicyHandlerBase.
type NotifyPolicyHandler interface {
	// TriggerType returns the event trigger type this handler responds to.
	// Must be unique across all registered handlers.
	TriggerType() string

	// Handle receives a business event and returns a list of NotifyMessages to send.
	// The policy config is used for filtering and templating.
	// Returns nil if the event does not match the handler's criteria.
	Handle(ctx context.Context, event *PolicyEvent, config *NotifyPolicyConfig) ([]*NotifyMessage, error)

	// Priority returns the handler's priority (higher = evaluated first when multiple match).
	Priority() int
}

// ---------------------------------------------------------------------------
// PolicyEvent - 策略事件（传入的业务事件）
// ---------------------------------------------------------------------------

// PolicyEvent represents a business event that may trigger notifications.
type PolicyEvent struct {
	// 事件标识
	EventType  string                 `json:"eventType"` // e.g. "ALERT_CREATED"
	SourceID   string                 `json:"sourceId"`  // e.g. alert ID
	Source     string                 `json:"source"`    // e.g. "monitor", "pipeline"
	TenantID   string                 `json:"tenantId"`
	Attributes map[string]interface{} `json:"attributes"` // 事件属性
	Timestamp  string                 `json:"timestamp"`  // ISO8601
}

// ---------------------------------------------------------------------------
// NotifyPolicyConfig - 通知策略配置
// ---------------------------------------------------------------------------

// NotifyPolicyConfig defines the rules for how events are converted to notifications.
type NotifyPolicyConfig struct {
	ID              string                   `json:"id"`
	Name            string                   `json:"name"`
	TenantID        string                   `json:"tenantId"`
	TriggerType     string                   `json:"triggerType"` // 匹配的事件类型
	Channels        []models.ChannelType     `json:"channels"`    // 目标渠道列表
	Recipients      []string                 `json:"recipients"`  // 固定接收人
	TemplateID      *string                  `json:"templateId"`  // 模板 ID
	SubjectTemplate *string                  `json:"subjectTemplate"`
	BodyTemplate    *string                  `json:"bodyTemplate"`
	Conditions      []models.PolicyCondition `json:"conditions"` // 过滤条件
	ThrottleMinutes *int                     `json:"throttleMinutes"`
	Enabled         bool                     `json:"enabled"`
}

// ---------------------------------------------------------------------------
// NotifyPolicyHandlerFactory - 策略处理器工厂（sync.Map + init 注册）
//
// 对应 NeatLogic 的 NotifyPolicyHandlerFactory（自动扫描 NotifyPolicyHandlerBase 子类）。
// Go 版本通过 init() 注册替代 Spring @Component 自动扫描。
//
// 执行链路（与 NeatLogic 完全对应）：
//
//	eventReceived(event)
//	  → matchHandler(event.EventType) 获取策略处理器
//	  → handler.Handle(event, policyConfig) 转换为通知消息
//	  → NotifyHandlerFactory.Get(channelType) 获取渠道处理器
//	  → handler.Execute(message) 发送通知
// ---------------------------------------------------------------------------

// NotifyPolicyHandlerFactory manages registered NotifyPolicyHandler implementations.
type NotifyPolicyHandlerFactory struct {
	// handlers stores policy handlers keyed by trigger type.
	handlers sync.Map // map[string]NotifyPolicyHandler

	// metrics collects factory-level statistics.
	metrics PolicyFactoryMetrics
}

// PolicyFactoryMetrics tracks policy factory statistics.
type PolicyFactoryMetrics struct {
	RegisterCount int64 `json:"registerCount"`
	HandleCount   int64 `json:"handleCount"`
	MissCount     int64 `json:"missCount"`
	MessageCount  int64 `json:"messageCount"`
}

// GlobalPolicyHandlerFactory is the singleton policy handler factory instance.
var GlobalPolicyHandlerFactory = NewNotifyPolicyHandlerFactory()

// NewNotifyPolicyHandlerFactory creates a new policy handler factory.
func NewNotifyPolicyHandlerFactory() *NotifyPolicyHandlerFactory {
	return &NotifyPolicyHandlerFactory{}
}

// Register adds a NotifyPolicyHandler.
// Must be called from init() in each policy handler package.
func (f *NotifyPolicyHandlerFactory) Register(h NotifyPolicyHandler) {
	if h == nil {
		return
	}
	f.handlers.Store(h.TriggerType(), h)
	atomic.AddInt64(&f.metrics.RegisterCount, 1)
}

// Get retrieves a policy handler by trigger type.
func (f *NotifyPolicyHandlerFactory) Get(triggerType string) (NotifyPolicyHandler, bool) {
	v, ok := f.handlers.Load(triggerType)
	if !ok {
		atomic.AddInt64(&f.metrics.MissCount, 1)
		return nil, false
	}
	return v.(NotifyPolicyHandler), true
}

// All returns all registered trigger types.
func (f *NotifyPolicyHandlerFactory) All() []string {
	var result []string
	f.handlers.Range(func(key, value any) bool {
		result = append(result, key.(string))
		return true
	})
	return result
}

// ForEach iterates over all registered handlers.
func (f *NotifyPolicyHandlerFactory) ForEach(fn func(h NotifyPolicyHandler)) {
	f.handlers.Range(func(key, value any) bool {
		if h, ok := value.(NotifyPolicyHandler); ok {
			fn(h)
		}
		return true
	})
}

// Metrics returns a snapshot of policy factory metrics.
func (f *NotifyPolicyHandlerFactory) Metrics() PolicyFactoryMetrics {
	return PolicyFactoryMetrics{
		RegisterCount: atomic.LoadInt64(&f.metrics.RegisterCount),
		MissCount:     atomic.LoadInt64(&f.metrics.MissCount),
	}
}

// ---------------------------------------------------------------------------
// NotifyPolicyExecutor - 策略执行器（对应 NeatLogic NotifyPolicyUtil.executeAsync）
//
// 串联完整的执行链路：
//  1. 接收业务事件
//  2. 匹配策略处理器（NotifyPolicyHandlerFactory）
//  3. 处理器转换事件为消息列表
//  4. 对每条消息，通过渠道工厂（NotifyHandlerFactory）路由到具体渠道
//  5. 记录审计日志
// ---------------------------------------------------------------------------

// NotifyPolicyExecutor orchestrates the complete notification policy execution pipeline.
type NotifyPolicyExecutor struct {
	policyFactory  *NotifyPolicyHandlerFactory
	handlerFactory *NotifyHandlerFactory
	router         *ChannelRouter
	auditLogger    AuditLogger
	metrics        ExecutorMetrics
}

// AuditLogger logs notification delivery audit records.
type AuditLogger interface {
	Log(ctx context.Context, record *AuditRecord) error
}

// ExecutorMetrics tracks executor-level statistics.
type ExecutorMetrics struct {
	ExecutedCount   int64 `json:"executedCount"`
	SucceededCount  int64 `json:"succeededCount"`
	FailedCount     int64 `json:"failedCount"`
	HandlerCount    int64 `json:"handlerCount"`   // successful policy handler matches
	MessageCount    int64 `json:"messageCount"`   // total messages produced
}

// AuditRecord is an audit entry for a notification delivery attempt.
type AuditRecord struct {
	TenantID    string `json:"tenantId"`
	EventType   string `json:"eventType"`
	SourceID    string `json:"sourceId"`
	ChannelType string `json:"channelType"`
	Recipient   string `json:"recipient"`
	Status      string `json:"status"` // "sent", "failed", "skipped"
	Error       string `json:"error,omitempty"`
	MessageID   string `json:"messageId"`
	Timestamp   string `json:"timestamp"`
}

// NewNotifyPolicyExecutor creates a new executor.
func NewNotifyPolicyExecutor(
	policyFactory *NotifyPolicyHandlerFactory,
	handlerFactory *NotifyHandlerFactory,
) *NotifyPolicyExecutor {
	return &NotifyPolicyExecutor{
		policyFactory:  policyFactory,
		handlerFactory: handlerFactory,
		router:         NewChannelRouter(handlerFactory),
	}
}

// WithAuditLogger sets an audit logger for delivery tracking.
func (e *NotifyPolicyExecutor) WithAuditLogger(logger AuditLogger) *NotifyPolicyExecutor {
	e.auditLogger = logger
	return e
}

// WithChannelChains sets delivery chains for policies.
func (e *NotifyPolicyExecutor) WithChannelChains(chains map[string][]models.ChannelType) *NotifyPolicyExecutor {
	for name, chs := range chains {
		e.router.SetChain(name, chs)
	}
	return e
}

// ExecuteAsync handles a policy event asynchronously (caller must manage goroutine).
// This corresponds to NeatLogic's NotifyPolicyUtil.executeAsync() / AfterTransactionJob.
func (e *NotifyPolicyExecutor) ExecuteAsync(ctx context.Context, event *PolicyEvent, config *NotifyPolicyConfig) {
	go func() {
		if err := e.Execute(ctx, event, config); err != nil {
			// Log but don't panic - notifications are best-effort
		}
	}()
}

// Execute handles a policy event synchronously.
//
// Full execution pipeline:
//
//	event → policyHandler.Handle() → []NotifyMessage → handlerFactory.Get(channel) → Execute()
func (e *NotifyPolicyExecutor) Execute(ctx context.Context, event *PolicyEvent, config *NotifyPolicyConfig) error {
	atomic.AddInt64(&e.metrics.ExecutedCount, 1)
	defer func() {
		if r := recover(); r != nil {
			e.logError(event, fmt.Sprintf("panic: %v", r))
		}
	}()

	// Step 1: Match policy handler by trigger type
	handler, ok := e.policyFactory.Get(event.EventType)
	if !ok {
		atomic.AddInt64(&e.metrics.FailedCount, 1)
		return fmt.Errorf("no policy handler for trigger type: %s", event.EventType)
	}
	atomic.AddInt64(&e.metrics.HandlerCount, 1)

	// Step 2: Handler converts event to messages
	messages, err := handler.Handle(ctx, event, config)
	if err != nil {
		atomic.AddInt64(&e.metrics.FailedCount, 1)
		e.logError(event, err.Error())
		return fmt.Errorf("policy handler error: %w", err)
	}
	if len(messages) == 0 {
		// No messages produced - event didn't match criteria, not an error
		return nil
	}
	atomic.AddInt64(&e.metrics.MessageCount, int64(len(messages)))

	// Step 3: Route each message to channels
	for _, msg := range messages {
		if err := e.deliverMessage(ctx, event, msg); err != nil {
			e.logError(event, fmt.Sprintf("delivery failed for %s: %v", msg.ID, err))
		}
	}

	return nil
}

// deliverMessage routes a single NotifyMessage to its channel handler(s).
func (e *NotifyPolicyExecutor) deliverMessage(ctx context.Context, event *PolicyEvent, msg *NotifyMessage) error {
	// Determine channel type from message metadata or first recipient preference
	chType := msg.Metadata["channel"]
	if chType == nil {
		// Fallback: try to determine from recipient type
		chType = models.ChannelInApp
	}

	handler, ok := e.handlerFactory.Get(models.ChannelType(chType.(string)))
	if !ok {
		return fmt.Errorf("no handler for channel: %s", chType)
	}

	result, err := handler.Execute(ctx, msg)
	if err != nil {
		return err
	}

	e.recordAudit(ctx, event, msg, result)

	if result.Success {
		atomic.AddInt64(&e.metrics.SucceededCount, 1)
	} else {
		atomic.AddInt64(&e.metrics.FailedCount, 1)
	}

	if result.Error != "" {
		return fmt.Errorf("%s", result.Error)
	}
	return nil
}

func (e *NotifyPolicyExecutor) recordAudit(ctx context.Context, event *PolicyEvent, msg *NotifyMessage, result *SendResult) {
	if e.auditLogger == nil {
		return
	}
	status := "sent"
	if result != nil && !result.Success {
		status = "failed"
	}
	rec := &AuditRecord{
		TenantID:    event.TenantID,
		EventType:   event.EventType,
		SourceID:    event.SourceID,
		ChannelType: msg.Recipient,
		Recipient:   msg.Recipient,
		Status:      status,
		MessageID:   msg.ID,
	}
	if result != nil {
		rec.Error = result.Error
	}
	_ = e.auditLogger.Log(ctx, rec)
}

func (e *NotifyPolicyExecutor) logError(event *PolicyEvent, err string) {
	if e.auditLogger != nil {
		_ = e.auditLogger.Log(context.Background(), &AuditRecord{
			TenantID:  event.TenantID,
			EventType: event.EventType,
			SourceID:  event.SourceID,
			Status:    "failed",
			Error:     err,
		})
	}
}

// Metrics returns executor metrics.
func (e *NotifyPolicyExecutor) Metrics() ExecutorMetrics {
	return ExecutorMetrics{
		ExecutedCount:  atomic.LoadInt64(&e.metrics.ExecutedCount),
		SucceededCount: atomic.LoadInt64(&e.metrics.SucceededCount),
		FailedCount:    atomic.LoadInt64(&e.metrics.FailedCount),
		HandlerCount:   atomic.LoadInt64(&e.metrics.HandlerCount),
		MessageCount:   atomic.LoadInt64(&e.metrics.MessageCount),
	}
}
