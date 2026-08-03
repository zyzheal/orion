package strategy

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"orion/platform-svc-go/internal/notification/notification-engine"
	"orion/platform-svc-go/internal/notification/notification/models"
)

// ---------------------------------------------------------------------------
// StrategyType - 投递策略类型
// ---------------------------------------------------------------------------

// StrategyType identifies the delivery strategy to use.
type StrategyType string

const (
	// StrategySingle sends each message through one channel, first success wins.
	StrategySingle StrategyType = "single"
	// StrategyBatch sends one message to all specified channels in parallel.
	StrategyBatch StrategyType = "batch"
	// StrategyPriority sends high-priority messages with retry + backoff,
	// normal messages go through single-channel.
	StrategyPriority StrategyType = "priority"
)

// ---------------------------------------------------------------------------
// DeliveryStrategy - 投递策略接口
// ---------------------------------------------------------------------------

// DeliveryStrategy defines how a notification message is routed and delivered.
type DeliveryStrategy interface {
	// Type returns the strategy type identifier.
	Type() StrategyType

	// Execute delivers the given message(s) using this strategy.
	// Returns a slice of SendResults (one per channel attempted).
	Execute(ctx context.Context, msg *engine.NotifyMessage, chain []models.ChannelType) ([]*engine.SendResult, error)
}

// ---------------------------------------------------------------------------
// StrategyFactory - 策略工厂
// ---------------------------------------------------------------------------

// StrategyFactory manages registered DeliveryStrategy implementations.
type StrategyFactory struct {
	strategies sync.Map // map[StrategyType]DeliveryStrategy
	metrics    StrategyFactoryMetrics
}

// StrategyFactoryMetrics tracks factory-level statistics.
type StrategyFactoryMetrics struct {
	RegisterCount int64 `json:"registerCount"`
	ExecuteCount  int64 `json:"executeCount"`
}

// GlobalStrategyFactory is the singleton strategy factory instance.
var GlobalStrategyFactory = NewStrategyFactory()

// NewStrategyFactory creates a new factory with built-in strategies registered.
func NewStrategyFactory() *StrategyFactory {
	f := &StrategyFactory{}
	// Register built-in strategies
	f.Register(NewSingleChannelStrategy())
	f.Register(NewBatchStrategy())
	f.Register(NewPriorityStrategy())
	return f
}

// Register adds a DeliveryStrategy.
func (f *StrategyFactory) Register(s DeliveryStrategy) {
	if s == nil {
		return
	}
	f.strategies.Store(string(s.Type()), s)
	atomic.AddInt64(&f.metrics.RegisterCount, 1)
}

// Get retrieves a DeliveryStrategy by type.
func (f *StrategyFactory) Get(strategyType StrategyType) (DeliveryStrategy, bool) {
	v, ok := f.strategies.Load(string(strategyType))
	if !ok {
		return nil, false
	}
	return v.(DeliveryStrategy), true
}

// All returns all registered strategy types.
func (f *StrategyFactory) All() []StrategyType {
	var result []StrategyType
	f.strategies.Range(func(key, value any) bool {
		result = append(result, StrategyType(key.(string)))
		return true
	})
	return result
}

// Metrics returns a snapshot of factory metrics.
func (f *StrategyFactory) Metrics() StrategyFactoryMetrics {
	return StrategyFactoryMetrics{
		RegisterCount: atomic.LoadInt64(&f.metrics.RegisterCount),
		ExecuteCount:  atomic.LoadInt64(&f.metrics.ExecuteCount),
	}
}

// ---------------------------------------------------------------------------
// SingleChannelStrategy - 单渠道策略
//
// 遍历渠道链，第一个成功的渠道即停止（first-success-wins）。
// 与现有 ChannelRouter 行为一致，提供独立策略接口。
// ---------------------------------------------------------------------------

// SingleChannelStrategy delivers via the first successful channel in the chain.
type SingleChannelStrategy struct {
	factory *engine.NotifyHandlerFactory
}

// NewSingleChannelStrategy creates a new single-channel strategy.
func NewSingleChannelStrategy() *SingleChannelStrategy {
	return &SingleChannelStrategy{
		factory: engine.GlobalHandlerFactory,
	}
}

// NewSingleChannelStrategyWithFactory creates a strategy with a custom factory (for testing).
func NewSingleChannelStrategyWithFactory(factory *engine.NotifyHandlerFactory) *SingleChannelStrategy {
	return &SingleChannelStrategy{
		factory: factory,
	}
}

func (s *SingleChannelStrategy) Type() StrategyType { return StrategySingle }

func (s *SingleChannelStrategy) Execute(ctx context.Context, msg *engine.NotifyMessage, chain []models.ChannelType) ([]*engine.SendResult, error) {
	if len(chain) == 0 {
		return nil, fmt.Errorf("empty channel chain for single strategy")
	}

	for _, chType := range chain {
		handler, ok := s.factory.Get(chType)
		if !ok {
			continue
		}
		if !handler.Healthy() {
			continue
		}

		result, err := handler.Execute(ctx, msg)
		if err != nil {
			continue
		}
		if result.Success {
			return []*engine.SendResult{result}, nil
		}
	}

	return nil, fmt.Errorf("all channels in chain failed for single strategy")
}

// ---------------------------------------------------------------------------
// BatchStrategy - 批量策略
//
// 将所有消息并行投递到渠道链中的所有渠道。
// 每个渠道独立发送，不依赖其他渠道的结果。
// 适用于"通知必须到达所有渠道"的场景。
// ---------------------------------------------------------------------------

// BatchStrategy delivers to all channels in the chain in parallel.
type BatchStrategy struct {
	factory     *engine.NotifyHandlerFactory
	maxWorkers  int           // max parallel workers
	timeout     time.Duration // per-message timeout
	backoff     time.Duration // base backoff for retry
	maxRetries  int           // max retry attempts
	logger      Logger
}

// Logger is the minimal logging interface used by strategies.
type Logger interface {
	Info(msg string, fields ...any)
	Warn(msg string, fields ...any)
	Error(msg string, fields ...any)
}

// NoopLogger is a logger that discards all output.
type NoopLogger struct{}

func (NoopLogger) Info(_ string, _ ...any)   {}
func (NoopLogger) Warn(_ string, _ ...any)   {}
func (NoopLogger) Error(_ string, _ ...any)  {}

// BatchOptions configures BatchStrategy.
type BatchOptions struct {
	MaxWorkers int           // default 10
	Timeout    time.Duration // default 30s
	Backoff    time.Duration // default 500ms
	MaxRetries int           // default 3
	Logger     Logger
	Factory    *engine.NotifyHandlerFactory
}

// NewBatchStrategy creates a new batch strategy with default options.
func NewBatchStrategy() *BatchStrategy {
	return &BatchStrategy{
		factory:    engine.GlobalHandlerFactory,
		maxWorkers: 10,
		timeout:    30 * time.Second,
		backoff:    500 * time.Millisecond,
		maxRetries: 3,
		logger:     NoopLogger{},
	}
}

// NewBatchStrategyWithOptions creates a batch strategy with custom options.
func NewBatchStrategyWithOptions(opts BatchOptions) *BatchStrategy {
	s := &BatchStrategy{
		maxWorkers: opts.MaxWorkers,
		timeout:    opts.Timeout,
		backoff:    opts.Backoff,
		maxRetries: opts.MaxRetries,
		logger:     opts.Logger,
		factory:    opts.Factory,
	}
	if s.maxWorkers <= 0 {
		s.maxWorkers = 10
	}
	if s.timeout <= 0 {
		s.timeout = 30 * time.Second
	}
	if s.backoff <= 0 {
		s.backoff = 500 * time.Millisecond
	}
	if s.maxRetries <= 0 {
		s.maxRetries = 3
	}
	if s.logger == nil {
		s.logger = NoopLogger{}
	}
	return s
}

func (s *BatchStrategy) Type() StrategyType { return StrategyBatch }

func (s *BatchStrategy) Execute(ctx context.Context, msg *engine.NotifyMessage, chain []models.ChannelType) ([]*engine.SendResult, error) {
	if len(chain) == 0 {
		return nil, fmt.Errorf("empty channel chain for batch strategy")
	}

	// Limit parallelism
	sem := make(chan struct{}, s.maxWorkers)

	var (
		wg      sync.WaitGroup
		mu      sync.Mutex
		results []*engine.SendResult
	)

	for _, chType := range chain {
		wg.Add(1)
		go func(ct models.ChannelType) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			handler, ok := s.factory.Get(ct)
			if !ok {
				s.logger.Warn("batch: channel not registered", "channel", ct)
				results = append(results, &engine.SendResult{
					Success: false,
					Error:   fmt.Sprintf("channel not registered: %s", ct),
				})
				return
			}
			if !handler.Healthy() {
				s.logger.Warn("batch: channel unhealthy, skipping", "channel", ct)
				results = append(results, &engine.SendResult{
					Success: false,
					Error:   fmt.Sprintf("channel unhealthy: %s", ct),
				})
				return
			}

			result, err := s.executeWithRetry(ctx, handler, msg)
			if err != nil {
				s.logger.Error("batch: delivery failed after retries", "channel", ct, "error", err.Error())
				results = append(results, &engine.SendResult{
					Success: false,
					Error:   err.Error(),
				})
				return
			}
			mu.Lock()
			results = append(results, result)
			mu.Unlock()
		}(chType)
	}

	wg.Wait()
	return results, nil
}

// executeWithRetry sends a message with exponential backoff retry.
func (s *BatchStrategy) executeWithRetry(ctx context.Context, handler engine.NotifyChannel, msg *engine.NotifyMessage) (*engine.SendResult, error) {
	var lastErr error
	for attempt := 0; attempt <= s.maxRetries; attempt++ {
		if attempt > 0 {
			backoff := s.backoff * time.Duration(1<<uint(attempt-1)) // exponential
			timer := time.NewTimer(backoff)
			select {
			case <-ctx.Done():
				timer.Stop()
				return nil, ctx.Err()
			case <-timer.C:
			}
		}

		result, err := handler.Execute(ctx, msg)
		if err != nil {
			lastErr = err
			continue
		}
		if result.Success {
			return result, nil
		}

		lastErr = fmt.Errorf("%s", result.Error)
	}
	return nil, lastErr
}

// ---------------------------------------------------------------------------
// PriorityStrategy - 优先级策略
//
// 根据消息的 Priority 字段决定投递行为：
//   - Priority 2 (urgent): 所有渠道并行投递 + 立即重试
//   - Priority 1 (high):   渠道链顺序投递，失败后降级
//   - Priority 0 (normal): 单渠道投递
// ---------------------------------------------------------------------------

// PriorityStrategy routes messages based on their priority level.
type PriorityStrategy struct {
	single     DeliveryStrategy
	batch      DeliveryStrategy
	urgentChain []models.ChannelType // channels always notified for urgent messages
	logger     Logger
}

// PriorityStrategyOptions configures PriorityStrategy.
type PriorityStrategyOptions struct {
	UrgentChain []models.ChannelType // default: all channels
	Logger      Logger
}

// NewPriorityStrategy creates a new priority strategy with defaults.
func NewPriorityStrategy() *PriorityStrategy {
	return &PriorityStrategy{
		single: NewSingleChannelStrategy(),
		batch:  NewBatchStrategy(),
		urgentChain: []models.ChannelType{
			models.ChannelEmail,
			models.ChannelSlack,
			models.ChannelWebhook,
			models.ChannelInApp,
		},
		logger: NoopLogger{},
	}
}

// NewPriorityStrategyWithOptions creates a priority strategy with custom options.
func NewPriorityStrategyWithOptions(opts PriorityStrategyOptions) *PriorityStrategy {
	s := &PriorityStrategy{
		single:      NewSingleChannelStrategy(),
		batch:       NewBatchStrategy(),
		urgentChain: opts.UrgentChain,
		logger:      opts.Logger,
	}
	if s.logger == nil {
		s.logger = NoopLogger{}
	}
	if len(s.urgentChain) == 0 {
		s.urgentChain = []models.ChannelType{
			models.ChannelEmail,
			models.ChannelSlack,
			models.ChannelWebhook,
			ChannelInAppAlias,
		}
	}
	return s
}

// ChannelInAppAlias is a convenience alias for models.ChannelInApp in this package.
var ChannelInAppAlias = models.ChannelInApp

func (s *PriorityStrategy) Type() StrategyType { return StrategyPriority }

func (s *PriorityStrategy) Execute(ctx context.Context, msg *engine.NotifyMessage, chain []models.ChannelType) ([]*engine.SendResult, error) {
	switch msg.Priority {
	case 2: // urgent
		s.logger.Info("priority: urgent message, broadcasting to all channels",
			"messageId", msg.ID, "priority", msg.Priority)
		// Use the full chain, or fallback to urgent chain
		targetChain := chain
		if len(targetChain) == 0 {
			targetChain = s.urgentChain
		}
		return s.batch.Execute(ctx, msg, targetChain)

	case 1: // high
		s.logger.Info("priority: high message, sequential with fallback",
			"messageId", msg.ID, "priority", msg.Priority)
		return s.single.Execute(ctx, msg, chain)

	case 0: // normal
		fallthrough
	default:
		s.logger.Info("priority: normal message, single channel",
			"messageId", msg.ID, "priority", msg.Priority)
		return s.single.Execute(ctx, msg, chain)
	}
}
