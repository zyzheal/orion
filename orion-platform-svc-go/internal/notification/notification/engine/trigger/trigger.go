package trigger

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"orion/platform-svc-go/internal/notification/notification/engine"
	"orion/platform-svc-go/internal/notification/notification/models"
)

// ---------------------------------------------------------------------------
// TriggerType - 触发器类型
// ---------------------------------------------------------------------------

// TriggerType identifies the trigger mechanism.
type TriggerType string

const (
	// TriggerEvent is a real-time event-based trigger (NATS, Kafka, webhook).
	TriggerEvent TriggerType = "event"
	// TriggerScheduled is a time-based trigger (cron, one-shot timer).
	TriggerScheduled TriggerType = "scheduled"
	// TriggerManual is a manual trigger (API call, CLI).
	TriggerManual TriggerType = "manual"
)

// ---------------------------------------------------------------------------
// TriggerConfig - 触发器配置
// ---------------------------------------------------------------------------

// TriggerConfig holds configuration for a trigger.
type TriggerConfig struct {
	Type       TriggerType         `json:"type"`
	Name       string              `json:"name"`
	Enabled    bool                `json:"enabled"`
	TenantID   string              `json:"tenantId"`
	Channel    models.ChannelType  `json:"channel"`
	Recipients []string            `json:"recipients"`
	PolicyID   string              `json:"policyId"`
	TemplVars  map[string]any      `json:"templVars,omitempty"`
	// CronExpr is required for scheduled triggers.
	CronExpr string `json:"cronExpr,omitempty"`
	// Message is used for manual triggers to carry the full payload.
	Message *engine.NotifyMessage `json:"-"`
}

// ---------------------------------------------------------------------------
// Trigger - 触发器接口
// ---------------------------------------------------------------------------

// Trigger defines the contract for a notification trigger point.
type Trigger interface {
	// Type returns the trigger type.
	Type() TriggerType

	// Name returns the trigger name.
	Name() string

	// Fire executes the trigger and returns the produced messages.
	// Context carries deadline/cancellation.
	Fire(ctx context.Context) ([]*engine.NotifyMessage, error)

	// Stop cancels the trigger (for scheduled triggers).
	Stop() error
}

// ---------------------------------------------------------------------------
// TriggerFactory - 触发器工厂
// ---------------------------------------------------------------------------

// TriggerFactory manages registered Trigger implementations.
type TriggerFactory struct {
	triggers sync.Map // map[string]Trigger (keyed by trigger name)
	metrics  TriggerFactoryMetrics
}

// TriggerFactoryMetrics tracks factory-level statistics.
type TriggerFactoryMetrics struct {
	RegisterCount int64 `json:"registerCount"`
	FireCount     int64 `json:"fireCount"`
}

// GlobalTriggerFactory is the singleton trigger factory instance.
var GlobalTriggerFactory = NewTriggerFactory()

// NewTriggerFactory creates a new trigger factory.
func NewTriggerFactory() *TriggerFactory {
	return &TriggerFactory{}
}

// Register adds a Trigger.
func (f *TriggerFactory) Register(t Trigger) {
	if t == nil {
		return
	}
	f.triggers.Store(t.Name(), t)
	atomic.AddInt64(&f.metrics.RegisterCount, 1)
}

// Get retrieves a Trigger by name.
func (f *TriggerFactory) Get(name string) (Trigger, bool) {
	v, ok := f.triggers.Load(name)
	if !ok {
		return nil, false
	}
	return v.(Trigger), true
}

// All returns all registered trigger names.
func (f *TriggerFactory) All() []string {
	var result []string
	f.triggers.Range(func(key, value any) bool {
		result = append(result, key.(string))
		return true
	})
	return result
}

// ForEach iterates over all registered triggers.
func (f *TriggerFactory) ForEach(fn func(t Trigger)) {
	f.triggers.Range(func(key, value any) bool {
		if t, ok := value.(Trigger); ok {
			fn(t)
		}
		return true
	})
}

// Metrics returns a snapshot of factory metrics.
func (f *TriggerFactory) Metrics() TriggerFactoryMetrics {
	return TriggerFactoryMetrics{
		RegisterCount: atomic.LoadInt64(&f.metrics.RegisterCount),
		FireCount:     atomic.LoadInt64(&f.metrics.FireCount),
	}
}

// Unregister removes a trigger by name.
func (f *TriggerFactory) Unregister(name string) {
	if t, ok := f.Get(name); ok {
		_ = t.Stop()
	}
	f.triggers.Delete(name)
}

// FireAll fires all registered triggers and aggregates results.
func (f *TriggerFactory) FireAll(ctx context.Context) ([]*engine.NotifyMessage, []error) {
	var (
		allMessages []*engine.NotifyMessage
		allErrors   []error
		mu          sync.Mutex
		wg          sync.WaitGroup
	)

	f.triggers.Range(func(key, value any) bool {
		t := value.(Trigger)
		wg.Add(1)
		go func() {
			defer wg.Done()
			atomic.AddInt64(&f.metrics.FireCount, 1)

			messages, err := t.Fire(ctx)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				allErrors = append(allErrors, fmt.Errorf("trigger %s: %w", key, err))
			} else {
				allMessages = append(allMessages, messages...)
			}
		}()
		return true
	})

	wg.Wait()
	return allMessages, allErrors
}

// ---------------------------------------------------------------------------
// EventTrigger - 事件触发器
//
// 基于业务事件的实时触发。当外部事件（NATS消息、Webhook回调等）
// 到达时，事件触发器将事件转换为通知消息。
// ---------------------------------------------------------------------------

// EventTrigger fires immediately when an event arrives.
type EventTrigger struct {
	name       string
	eventType  string
	factory    *engine.NotifyPolicyHandlerFactory
	policyRepo PolicyRepository
	logger     Logger
}

// PolicyRepository loads a policy config by ID.
type PolicyRepository interface {
	GetPolicy(ctx context.Context, policyID string) (*engine.NotifyPolicyConfig, error)
}

// Logger is the minimal logging interface.
type Logger interface {
	Info(msg string, fields ...any)
	Warn(msg string, fields ...any)
	Error(msg string, fields ...any)
}

// NoopLogger discards all output.
type NoopLogger struct{}

func (NoopLogger) Info(_ string, _ ...any)   {}
func (NoopLogger) Warn(_ string, _ ...any)   {}
func (NoopLogger) Error(_ string, _ ...any)  {}

// EventTriggerConfig configures an EventTrigger.
type EventTriggerConfig struct {
	Name       string
	EventType  string
	PolicyRepo PolicyRepository
	Logger     Logger
	Factory    *engine.NotifyPolicyHandlerFactory
}

// NewEventTrigger creates a new event trigger.
func NewEventTrigger(cfg EventTriggerConfig) *EventTrigger {
	t := &EventTrigger{
		name:      cfg.Name,
		eventType: cfg.EventType,
		factory:   cfg.Factory,
		policyRepo: cfg.PolicyRepo,
		logger:    cfg.Logger,
	}
	if t.factory == nil {
		t.factory = engine.GlobalPolicyHandlerFactory
	}
	if t.logger == nil {
		t.logger = NoopLogger{}
	}
	return t
}

func (t *EventTrigger) Type() TriggerType { return TriggerEvent }
func (t *EventTrigger) Name() string      { return t.name }

func (t *EventTrigger) Fire(ctx context.Context) ([]*engine.NotifyMessage, error) {
	// Event triggers are stateless - they don't produce messages on their own.
	// They are invoked via the executor's Execute() method.
	t.logger.Info("event trigger fired", "eventType", t.eventType, "trigger", t.name)
	// For polling-based event triggers, return empty.
	// The real event flow goes through NotifyPolicyExecutor.Execute().
	return nil, nil
}

func (t *EventTrigger) Stop() error {
	return nil
}

// ---------------------------------------------------------------------------
// ScheduledTrigger - 定时触发器
//
// 基于 Cron 表达式的周期性触发。
// 支持一次性延迟触发和周期性触发。
// ---------------------------------------------------------------------------

// ScheduledTrigger fires at specified times based on a cron expression.
type ScheduledTrigger struct {
	name        string
	cronExpr    string
	msg         *engine.NotifyMessage
	interval    time.Duration
	oneShot     bool
	stopChan    chan struct{}
	stopOnce    sync.Once
	execFunc    func(ctx context.Context) ([]*engine.NotifyMessage, error)
	logger      Logger
}

// ScheduledTriggerConfig configures a ScheduledTrigger.
type ScheduledTriggerConfig struct {
	Name       string
	CronExpr   string
	Message    *engine.NotifyMessage
	OneShot    bool
	Interval   time.Duration // used when CronExpr is empty (simple interval)
	Logger     Logger
	ExecFunc   func(ctx context.Context) ([]*engine.NotifyMessage, error)
}

// NewScheduledTrigger creates a new scheduled trigger.
func NewScheduledTrigger(cfg ScheduledTriggerConfig) *ScheduledTrigger {
	t := &ScheduledTrigger{
		name:     cfg.Name,
		cronExpr: cfg.CronExpr,
		msg:      cfg.Message,
		interval: cfg.Interval,
		oneShot:  cfg.OneShot,
		stopChan: make(chan struct{}),
		execFunc: cfg.ExecFunc,
		logger:   cfg.Logger,
	}
	if t.logger == nil {
		t.logger = NoopLogger{}
	}
	if t.execFunc == nil {
		// Default: produce the configured message
		t.execFunc = func(ctx context.Context) ([]*engine.NotifyMessage, error) {
			if t.msg == nil {
				return nil, nil
			}
			return []*engine.NotifyMessage{t.msg}, nil
		}
	}
	// Start the scheduler goroutine
	go t.schedule()
	return t
}

func (t *ScheduledTrigger) Type() TriggerType { return TriggerScheduled }
func (t *ScheduledTrigger) Name() string      { return t.name }

func (t *ScheduledTrigger) Fire(ctx context.Context) ([]*engine.NotifyMessage, error) {
	t.logger.Info("scheduled trigger fired", "trigger", t.name)
	return t.execFunc(ctx)
}

func (t *ScheduledTrigger) Stop() error {
	t.stopOnce.Do(func() {
		close(t.stopChan)
	})
	return nil
}

// schedule runs the trigger loop based on cron expression or simple interval.
func (t *ScheduledTrigger) schedule() {
	if t.oneShot && t.interval > 0 {
		// One-shot delay
		timer := time.NewTimer(t.interval)
		select {
		case <-t.stopChan:
			timer.Stop()
		case <-timer.C:
			t.logger.Info("scheduled trigger one-shot fired", "trigger", t.name)
			// Fire the exec function in a background context
			go func() {
				_, err := t.execFunc(context.Background())
				if err != nil {
					t.logger.Error("scheduled trigger one-shot execution failed",
						"trigger", t.name, "error", err.Error())
				}
			}()
		}
		return
	}

	// For cron-based triggers, use a simple tick loop.
	// In production, use a real cron parser (e.g., github.com/robfig/cron).
	// Here we use interval-based fallback.
	interval := t.interval
	if interval <= 0 {
		interval = time.Minute // default fallback
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-t.stopChan:
			t.logger.Info("scheduled trigger stopped", "trigger", t.name)
			return
		case <-ticker.C:
			t.logger.Info("scheduled trigger tick", "trigger", t.name)
			go func() {
				_, err := t.execFunc(context.Background())
				if err != nil {
					t.logger.Error("scheduled trigger execution failed",
						"trigger", t.name, "error", err.Error())
				}
			}()
		}
	}
}

// ---------------------------------------------------------------------------
// ManualTrigger - 手动触发器
//
// 通过 API 调用或 CLI 手动触发通知。
// 每次调用 Fire() 会立即投递一条预定义的消息。
// ---------------------------------------------------------------------------

// ManualTrigger fires a pre-configured message on demand.
type ManualTrigger struct {
	name  string
	msg   *engine.NotifyMessage
	stopChan chan struct{}
	stopOnce sync.Once
	logger Logger
}

// ManualTriggerConfig configures a ManualTrigger.
type ManualTriggerConfig struct {
	Name    string
	Message *engine.NotifyMessage
	Logger  Logger
}

// NewManualTrigger creates a new manual trigger.
func NewManualTrigger(cfg ManualTriggerConfig) *ManualTrigger {
	t := &ManualTrigger{
		name:     cfg.Name,
		msg:      cfg.Message,
		stopChan: make(chan struct{}),
		logger:   cfg.Logger,
	}
	if t.logger == nil {
		t.logger = NoopLogger{}
	}
	return t
}

func (t *ManualTrigger) Type() TriggerType { return TriggerManual }
func (t *ManualTrigger) Name() string      { return t.name }

func (t *ManualTrigger) Fire(ctx context.Context) ([]*engine.NotifyMessage, error) {
	select {
	case <-t.stopChan:
		return nil, fmt.Errorf("manual trigger %s is stopped", t.name)
	default:
	}

	if t.msg == nil {
		return nil, fmt.Errorf("manual trigger %s has no message configured", t.name)
	}

	t.logger.Info("manual trigger fired", "trigger", t.name, "recipient", t.msg.Recipient)
	return []*engine.NotifyMessage{t.msg}, nil
}

func (t *ManualTrigger) Stop() error {
	t.stopOnce.Do(func() {
		close(t.stopChan)
	})
	return nil
}

// ---------------------------------------------------------------------------
// TriggerBuilder - 触发器构建器（链式 API）
// ---------------------------------------------------------------------------

// TriggerBuilder provides a fluent API for constructing triggers.
type TriggerBuilder struct {
	cfg       map[string]any
	triggerType TriggerType
}

// NewTriggerBuilder creates a new builder.
func NewTriggerBuilder() *TriggerBuilder {
	return &TriggerBuilder{
		cfg: make(map[string]any),
	}
}

// AsEvent configures the trigger as event-based.
func (b *TriggerBuilder) AsEvent(eventType string) *TriggerBuilder {
	b.triggerType = TriggerEvent
	b.cfg["eventType"] = eventType
	return b
}

// AsScheduled configures the trigger as scheduled.
func (b *TriggerBuilder) AsScheduled(interval time.Duration) *TriggerBuilder {
	b.triggerType = TriggerScheduled
	b.cfg["interval"] = interval
	return b
}

// AsManual configures the trigger as manual.
func (b *TriggerBuilder) AsManual() *TriggerBuilder {
	b.triggerType = TriggerManual
	return b
}

// WithName sets the trigger name.
func (b *TriggerBuilder) WithName(name string) *TriggerBuilder {
	b.cfg["name"] = name
	return b
}

// WithMessage sets the message to send.
func (b *TriggerBuilder) WithMessage(msg *engine.NotifyMessage) *TriggerBuilder {
	b.cfg["message"] = msg
	return b
}

// WithCronExpr sets the cron expression (for scheduled triggers).
func (b *TriggerBuilder) WithCronExpr(expr string) *TriggerBuilder {
	b.cfg["cronExpr"] = expr
	return b
}

// WithOneShot marks a scheduled trigger as one-shot.
func (b *TriggerBuilder) WithOneShot() *TriggerBuilder {
	b.cfg["oneShot"] = true
	return b
}

// WithLogger sets the logger.
func (b *TriggerBuilder) WithLogger(logger Logger) *TriggerBuilder {
	b.cfg["logger"] = logger
	return b
}

// Build constructs the trigger.
func (b *TriggerBuilder) Build() Trigger {
	name, ok := b.cfg["name"].(string)
	if !ok || name == "" {
		name = fmt.Sprintf("trigger-%d", time.Now().UnixNano())
	}
	logger, _ := b.cfg["logger"].(Logger)

	switch b.triggerType {
	case TriggerEvent:
		eventType := b.cfg["eventType"].(string)
		return NewEventTrigger(EventTriggerConfig{
			Name:      name,
			EventType: eventType,
			Logger:    logger,
		})
	case TriggerScheduled:
		interval, ok := b.cfg["interval"].(time.Duration)
		if !ok {
			interval = time.Minute
		}
		msg, _ := b.cfg["message"].(*engine.NotifyMessage)
		oneShot, _ := b.cfg["oneShot"].(bool)
		return NewScheduledTrigger(ScheduledTriggerConfig{
			Name:     name,
			Message:  msg,
			Interval: interval,
			OneShot:  oneShot,
			Logger:   logger,
		})
	case TriggerManual:
		msg, _ := b.cfg["message"].(*engine.NotifyMessage)
		return NewManualTrigger(ManualTriggerConfig{
			Name:    name,
			Message: msg,
			Logger:  logger,
		})
	default:
		return NewManualTrigger(ManualTriggerConfig{
			Name:    name,
			Message: b.cfg["message"].(*engine.NotifyMessage),
			Logger:  logger,
		})
	}
}

// MarshalConfig serializes TriggerConfig to JSON.
func MarshalConfig(cfg TriggerConfig) ([]byte, error) {
	return json.Marshal(cfg)
}

// UnmarshalConfig deserializes JSON to TriggerConfig.
func UnmarshalConfig(data []byte) (*TriggerConfig, error) {
	var cfg TriggerConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("invalid trigger config: %w", err)
	}
	return &cfg, nil
}
