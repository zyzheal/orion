package processor

import (
	"context"
	"fmt"
	"sync"
	"time"

	"go.uber.org/zap"
)

// ---------------------------------------------------------------------------
// Processor — orchestrates the integration execution lifecycle
// ---------------------------------------------------------------------------

// Processor coordinates the full integration workflow: validate → transform
// input → dispatch to handler → transform output → record result. It is safe
// for concurrent use.
type Processor struct {
	mu             sync.RWMutex
	registry       *Registry
	transformer    *Transformer
	logger         *zap.Logger
	metrics        *metrics
	defaultTimeout time.Duration
	defaultRetries int
	maxRetries     int
	taskStore      TaskStore
	listeners      []func(TaskEvent)
}

// TaskStore is an optional persistence layer for tasks and events.
type TaskStore interface {
	CreateTask(ctx context.Context, task *Task) error
	UpdateTask(ctx context.Context, task *Task) error
	EmitEvent(ctx context.Context, event *TaskEvent) error
}

// noopTaskStore satisfies TaskStore without persisting anything.
type noopTaskStore struct{}

func (noopTaskStore) CreateTask(context.Context, *Task) error     { return nil }
func (noopTaskStore) UpdateTask(context.Context, *Task) error     { return nil }
func (noopTaskStore) EmitEvent(context.Context, *TaskEvent) error { return nil }

// ProcessorOption configures a Processor.
type ProcessorOption func(*Processor)

// WithProcessorRegistry sets the handler registry.
func WithProcessorRegistry(registry *Registry) ProcessorOption {
	return func(p *Processor) { p.registry = registry }
}

// WithProcessorTransformer sets the transformation engine.
func WithProcessorTransformer(transformer *Transformer) ProcessorOption {
	return func(p *Processor) { p.transformer = transformer }
}

// WithProcessorLogger sets a structured logger.
func WithProcessorLogger(logger *zap.Logger) ProcessorOption {
	return func(p *Processor) {
		if logger != nil {
			p.logger = logger
		}
	}
}

// WithDefaultTimeout sets the per-operation timeout used when an operation
// does not specify its own timeout.
func WithDefaultTimeout(timeout time.Duration) ProcessorOption {
	return func(p *Processor) { p.defaultTimeout = timeout }
}

// WithDefaultRetries sets the number of retry attempts used when an operation
// does not specify its own retry count.
func WithDefaultRetries(retries int) ProcessorOption {
	return func(p *Processor) { p.defaultRetries = retries }
}

// WithMaxRetries sets the absolute upper bound on retries regardless of what
// an individual operation requests.
func WithMaxRetries(max int) ProcessorOption {
	return func(p *Processor) { p.maxRetries = max }
}

// WithTaskStore sets a persistence layer for tasks and lifecycle events.
func WithTaskStore(store TaskStore) ProcessorOption {
	return func(p *Processor) { p.taskStore = store }
}

// NewProcessor creates a Processor with sensible defaults.
func NewProcessor(opts ...ProcessorOption) *Processor {
	p := &Processor{
		registry:       NewDefaultRegistry(),
		transformer:    NewTransformer(),
		logger:         zap.NewNop(),
		metrics:        &metrics{},
		defaultTimeout: 30 * time.Second,
		defaultRetries: 3,
		maxRetries:     10,
		taskStore:      &noopTaskStore{},
		listeners:      make([]func(TaskEvent), 0),
	}
	for _, o := range opts {
		o(p)
	}
	// Register standard inbound/outbound rules so the processor works
	// out of the box.
	StandardInboundRuleSet().LoadInto(p.transformer)
	StandardOutboundRuleSet().LoadInto(p.transformer)
	return p
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Execute performs a single integration operation. It validates the
// integration, applies inbound transformation, dispatches to the handler,
// applies outbound transformation, and persists the result.
func (p *Processor) Execute(ctx context.Context, integration *Integration, task *Task) error {
	started := time.Now().UTC()
	p.metrics.started()

	// 1. Validate integration state.
	if integration == nil {
		return fmt.Errorf("integration: nil integration passed to Execute")
	}
	if !integration.Enabled {
		return ErrIntegrationDisabled
	}
	if integration.Type == "" {
		return ErrInvalidType
	}

	// 2. Validate handler exists.
	handler, err := p.registry.Get(integration.Type)
	if err != nil {
		return fmt.Errorf("%w: %q", ErrHandlerNotFound, integration.Type)
	}

	// 3. Validate integration config for the handler.
	if err := handler.Validate(integration); err != nil {
		return fmt.Errorf("integration: config validation failed for %q: %w", integration.Name, err)
	}

	task = p.finalizeTask(integration, task, started)
	if err := p.taskStore.CreateTask(ctx, task); err != nil {
		return err
	}
	if task.Operation == nil || task.Operation.Name == "" {
		task.Operation = &Operation{Name: "default"}
	}

	// 4. Inbound transform (external format → canonical).
	input := task.InputData
	if len(input) > 0 {
		var err error
		input, err = p.transformer.Transform("json-flat-inbound", input)
		if err != nil {
			p.logger.Debug("integration: inbound transform skipped", zap.Error(err))
			// Non-fatal: continue with raw input.
		}
	}

	// 5. Dispatch to handler with retries.
	output, procErr := p.dispatchWithRetry(ctx, handler, integration, task.Operation, input)

	// 6. Outbound transform (canonical → external format).
	if output != nil {
		var err error
		output, err = p.transformer.Transform("json-flat-outbound", output)
		if err != nil {
			p.logger.Debug("integration: outbound transform skipped", zap.Error(err))
			// Non-fatal: continue with handler output.
		}
	}

	// 7. Finalize task.
	task.OutputData = output
	task.FinishedAt = func() *time.Time { t := time.Now().UTC(); return &t }()
	task.DurationMs = task.FinishedAt.Sub(started).Milliseconds()

	if procErr != nil {
		task.Status = TaskStatusFailed
		task.Error = procErr.Error()
		p.metrics.failed()
	} else {
		task.Status = TaskStatusCompleted
		p.metrics.completed()
	}

	if err := p.taskStore.UpdateTask(ctx, task); err != nil {
		p.logger.Error("integration: failed to persist task update", zap.Error(err))
	}

	msg := ""
	if procErr != nil {
		msg = procErr.Error()
	}
	p.notify(TaskEvent{
		TaskID:    task.ID,
		EventType: string(task.Status),
		Message:   msg,
		Timestamp: task.FinishedAt.UTC(),
	})

	return procErr
}

// ExecuteAsync runs Execute in a background goroutine.
func (p *Processor) ExecuteAsync(ctx context.Context, integration *Integration, task *Task) {
	go func() {
		_ = p.Execute(ctx, integration, task)
	}()
}

// ExecuteBatch processes multiple operations sequentially, returning results.
func (p *Processor) ExecuteBatch(ctx context.Context, integration *Integration, tasks []*Task) []*TaskResult {
	results := make([]*TaskResult, 0, len(tasks))
	for _, task := range tasks {
		select {
		case <-ctx.Done():
			results = append(results, &TaskResult{TaskID: task.ID, Err: ctx.Err()})
			continue
		default:
		}
		err := p.Execute(ctx, integration, task)
		results = append(results, &TaskResult{TaskID: task.ID, Err: err})
	}
	return results
}

// Handler returns the handler for the given integration type.
func (p *Processor) Handler(t IntegrationType) (Handler, error) {
	return p.registry.Get(t)
}

// Transformer returns the transformation engine.
func (p *Processor) Transformer() *Transformer {
	return p.transformer
}

// Registry returns the handler registry.
func (p *Processor) Registry() *Registry {
	return p.registry
}

// AddListener registers a callback that receives lifecycle events.
func (p *Processor) AddListener(fn func(TaskEvent)) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.listeners = append(p.listeners, fn)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

func (p *Processor) finalizeTask(integration *Integration, task *Task, started time.Time) *Task {
	if task == nil {
		task = &Task{}
	}
	task.TenantID = integration.TenantID
	task.IntegrationID = integration.ID
	task.Status = TaskStatusRunning
	task.StartedAt = &started
	task.CreatedAt = started
	return task
}

func (p *Processor) dispatchWithRetry(
	ctx context.Context,
	handler Handler,
	integration *Integration,
	op *Operation,
	input map[string]interface{},
) (map[string]interface{}, error) {
	retries := op.Retry
	if retries == 0 {
		retries = p.defaultRetries
	}
	if retries > p.maxRetries {
		retries = p.maxRetries
	}

	var lastErr error
	for attempt := 0; attempt <= retries; attempt++ {
		// Build the operation-scoped context with timeout.
		timeout := op.Timeout
		if timeout == 0 {
			if integration.Connection.Timeout > 0 {
				timeout = integration.Connection.Timeout
			} else {
				timeout = p.defaultTimeout
			}
		}
		callCtx, cancel := context.WithTimeout(ctx, timeout)

		result, err := handler.Handle(callCtx, integration, op, input)
		cancel()
		if err == nil {
			return result, nil
		}

		lastErr = err
		if !IsRetryable(err) && callCtx.Err() == context.DeadlineExceeded {
			return nil, fmt.Errorf("%w: %v", ErrOperationTimeout, err)
		}
		if !IsRetryable(err) {
			// Non-retryable error: fail immediately.
			return nil, err
		}

		p.logger.Debug("integration: handler attempt failed, retrying",
			zap.Int("attempt", attempt),
			zap.Error(err))
	}

	return nil, fmt.Errorf("%w: %v", ErrMaxRetriesExceeded, lastErr)
}

func (p *Processor) notify(event TaskEvent) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	for _, fn := range p.listeners {
		fn(event)
	}
}

// TaskResult holds the outcome of a batch execution.
type TaskResult struct {
	TaskID string
	Err    error
}
