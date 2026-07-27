// Package router provides the CallRouter that dispatches crossover calls to
// the correct module handler based on registered operations.
//
// The router consults the CallOperationRegistry to resolve (module, operation)
// pairs to handler functions, then dispatches the call using the appropriate
// strategy (request/response, event, or async).
package router

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"orion/platform-svc-go/internal/crossover/models"
	"orion/platform-svc-go/internal/crossover/registry"
)

// ---------------------------------------------------------------------------
// Sentinel errors
// ---------------------------------------------------------------------------

var (
	ErrNoHandler       = errors.New("no handler for module.operation")
	ErrInvalidCallType = errors.New("invalid call type")
	ErrTimeout         = errors.New("crossover call timed out")
)

// ---------------------------------------------------------------------------
// HandlerFunc
// ---------------------------------------------------------------------------

// HandlerFunc is the function signature for a crossover call handler.
type HandlerFunc func(ctx context.Context, tenantID string, req *models.InvokeCrossoverRequest) (map[string]interface{}, error)

// ---------------------------------------------------------------------------
// HandlerRegistry — maps module.operation → handler
// ---------------------------------------------------------------------------

// HandlerRegistry holds the mapping from operation keys to handler functions.
type HandlerRegistry struct {
	mu       sync.RWMutex
	handlers map[string]HandlerFunc
}

// NewHandlerRegistry creates a new HandlerRegistry.
func NewHandlerRegistry() *HandlerRegistry {
	return &HandlerRegistry{
		handlers: make(map[string]HandlerFunc),
	}
}

// Register registers a handler for a module.operation pair.
func (r *HandlerRegistry) Register(module, operation string, fn HandlerFunc) {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := r.key(module, operation)
	r.handlers[key] = fn
}

// Unregister removes a handler.
func (r *HandlerRegistry) Unregister(module, operation string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.handlers, r.key(module, operation))
}

// Get returns the handler for a module.operation pair, or nil.
func (r *HandlerRegistry) Get(module, operation string) HandlerFunc {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.handlers[r.key(module, operation)]
}

// Has returns whether a handler is registered.
func (r *HandlerRegistry) Has(module, operation string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.handlers[r.key(module, operation)] != nil
}

// key creates a lookup key.
func (r *HandlerRegistry) key(module, operation string) string {
	return module + "." + operation
}

// ---------------------------------------------------------------------------
// CallRouter
// ---------------------------------------------------------------------------

// CallRouter dispatches crossover calls to the correct module handler.
type CallRouter struct {
	handlerRegistry *HandlerRegistry
	opRegistry      *registry.CallOperationRegistry

	// default timeout for synchronous calls
	defaultTimeout time.Duration
}

// RouterOption configures the router.
type RouterOption func(*CallRouter)

// WithTimeout sets the default timeout for synchronous calls.
func WithTimeout(d time.Duration) RouterOption {
	return func(r *CallRouter) {
		r.defaultTimeout = d
	}
}

// NewCallRouter creates a new router with optional configuration.
func NewCallRouter(handlerRegistry *HandlerRegistry, opRegistry *registry.CallOperationRegistry, opts ...RouterOption) *CallRouter {
	r := &CallRouter{
		handlerRegistry: handlerRegistry,
		opRegistry:      opRegistry,
		defaultTimeout:  10 * time.Second, // default
	}
	for _, opt := range opts {
		opt(r)
	}
	return r
}

// Route dispatches a crossover call synchronously and returns the result.
func (r *CallRouter) Route(ctx context.Context, tenantID string, call *models.CrossoverCall) (*models.CallResultObj, error) {
	if !models.ValidCallTypes[call.CallType] {
		return &models.CallResultObj{Error: ErrInvalidCallType.Error()}, ErrInvalidCallType
	}

	switch call.CallType {
	case models.CallTypeRequestResponse:
		return r.routeSync(ctx, tenantID, call)
	case models.CallTypeEvent:
		return r.routeEvent(ctx, tenantID, call)
	case models.CallTypeAsync:
		return r.routeAsync(ctx, tenantID, call)
	default:
		return &models.CallResultObj{Error: ErrInvalidCallType.Error()}, ErrInvalidCallType
	}
}

// RouteWithTimeout dispatches with an explicit timeout.
func (r *CallRouter) RouteWithTimeout(ctx context.Context, tenantID string, call *models.CrossoverCall, timeout time.Duration) (*models.CallResultObj, error) {
	newCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	return r.Route(newCtx, tenantID, call)
}

// Dispatch is the low-level dispatch that invokes a handler function.
func (r *CallRouter) Dispatch(ctx context.Context, tenantID string, module, operation string, params models.CallParameters) (map[string]interface{}, error) {
	fn := r.handlerRegistry.Get(module, operation)
	if fn == nil {
		return nil, ErrNoHandler
	}
	req := &models.InvokeCrossoverRequest{
		TargetModule: module,
		Operation:    operation,
		Parameters:   params,
	}
	return fn(ctx, tenantID, req)
}

// routeSync handles request/response pattern.
func (r *CallRouter) routeSync(ctx context.Context, tenantID string, call *models.CrossoverCall) (*models.CallResultObj, error) {
	// Apply timeout
	timeoutCtx, cancel := context.WithTimeout(ctx, r.defaultTimeout)
	defer cancel()

	result, err := r.Dispatch(timeoutCtx, tenantID, call.TargetModule, call.Operation, call.Parameters)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			return &models.CallResultObj{
				Error:  ErrTimeout.Error(),
				DoneAt: time.Now().UTC(),
			}, ErrTimeout
		}
		return &models.CallResultObj{
			Error:  err.Error(),
			DoneAt: time.Now().UTC(),
		}, err
	}

	return &models.CallResultObj{
		Value:  result,
		DoneAt: time.Now().UTC(),
	}, nil
}

// routeEvent handles fire-and-forget event pattern.
func (r *CallRouter) routeEvent(ctx context.Context, tenantID string, call *models.CrossoverCall) (*models.CallResultObj, error) {
	// Fire-and-forget: dispatch in background goroutine
	go func() {
		gctx, cancel := context.WithTimeout(context.Background(), r.defaultTimeout)
		defer cancel()
		_, _ = r.Dispatch(gctx, tenantID, call.TargetModule, call.Operation, call.Parameters)
	}()

	return &models.CallResultObj{
		Value:  map[string]interface{}{"status": "dispatched"},
		DoneAt: time.Now().UTC(),
	}, nil
}

// routeAsync handles async processing pattern.
// This would typically create an async job and return a job ID.
// For now, it returns a placeholder indicating async processing started.
func (r *CallRouter) routeAsync(ctx context.Context, tenantID string, call *models.CrossoverCall) (*models.CallResultObj, error) {
	// In a full implementation, this would create an async job via the dispatcher.
	// For now, return a job reference.
	jobID := fmt.Sprintf("async-%s-%s-%s", call.TargetModule, call.Operation, call.ID)

	return &models.CallResultObj{
		Value: map[string]interface{}{
			"jobId":      jobID,
			"status":     "created",
			"targetModule": call.TargetModule,
			"operation":    call.Operation,
		},
		DoneAt: time.Now().UTC(),
	}, nil
}

// Resolve validates that a module.operation pair is routable.
func (r *CallRouter) Resolve(ctx context.Context, tenantID, module, operation string) (bool, error) {
	if r.handlerRegistry.Has(module, operation) {
		return true, nil
	}
	// Fall back to registry lookup
	if r.opRegistry != nil {
		op, err := r.opRegistry.Get(ctx, tenantID, module, operation)
		if err != nil {
			return false, nil
		}
		if op.Status == models.OperationStatusActive {
			return true, nil
		}
	}
	return false, nil
}

// ListHandlers returns all registered handler keys.
func (r *CallRouter) ListHandlers() []string {
	r.handlerRegistry.mu.RLock()
	defer r.handlerRegistry.mu.RUnlock()
	keys := make([]string, 0, len(r.handlerRegistry.handlers))
	for key := range r.handlerRegistry.handlers {
		keys = append(keys, key)
	}
	return keys
}

// RegisterHandler registers a handler for a module.operation pair.
func (r *CallRouter) RegisterHandler(module, operation string, fn HandlerFunc) {
	r.handlerRegistry.Register(module, operation, fn)
}

// UnregisterHandler removes a handler for a module.operation pair.
func (r *CallRouter) UnregisterHandler(module, operation string) {
	r.handlerRegistry.Unregister(module, operation)
}
