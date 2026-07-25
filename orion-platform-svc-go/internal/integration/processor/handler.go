package processor

import (
	"context"
	"sync"
	"go.uber.org/zap"
)

// ---------------------------------------------------------------------------
// Handler — pluggable integration executor
// ---------------------------------------------------------------------------

// Handler abstracts the execution of an operation against a specific
// integration type. Each type (REST, gRPC, Kafka, ...) registers one
// concrete handler implementation.
type Handler interface {
	// Name returns the IntegrationType this handler serves.
	Name() IntegrationType

	// Handle executes an operation against the integration and returns the
	// raw response payload.
	Handle(ctx context.Context, integration *Integration, op *Operation, input map[string]interface{}) (map[string]interface{}, error)

	// Validate checks that the integration configuration is sane for this
	// handler type.
	Validate(integration *Integration) error

	// Type returns the category of this handler for routing and discovery.
	Type() HandlerType
}

// HandlerType classifies a handler by its operation mode.
type HandlerType string

const (
	HandlerTypeRequestResponse HandlerType = "request_response" // REST, GraphQL, gRPC
	HandlerTypeStreaming       HandlerType = "streaming"        // WebSocket
	HandlerTypeMessageQueue    HandlerType = "message_queue"    // Kafka, RabbitMQ
	HandlerTypeDatabase        HandlerType = "database"         // MongoDB, PostgreSQL
)

// ValidateHandler is an optional extra check a handler can perform on input.
type ValidateHandler func(map[string]interface{}) error

// ---------------------------------------------------------------------------
// Registry — discovers and stores integration handlers
// ---------------------------------------------------------------------------

// Registry stores and retrieves Handler implementations by IntegrationType.
// It is safe for concurrent read/write.
type Registry struct {
	mu       sync.RWMutex
	handlers map[IntegrationType]Handler
	logger   *zap.Logger
}

// NewRegistry creates an empty handler registry.
func NewRegistry(opts ...RegistryOption) *Registry {
	r := &Registry{
		handlers: make(map[IntegrationType]Handler),
		logger:   zap.NewNop(),
	}
	for _, o := range opts {
		o(r)
	}
	return r
}

// RegistryOption configures a Registry.
type RegistryOption func(*Registry)

// WithRegistryLogger sets a custom logger.
func WithRegistryLogger(logger *zap.Logger) RegistryOption {
	return func(r *Registry) {
		if logger != nil {
			r.logger = logger
		}
	}
}

// Register stores a handler, replacing any handler previously registered for
// the same IntegrationType.
func (r *Registry) Register(h Handler) {
	r.mu.Lock()
	defer r.mu.Unlock()

	name := h.Name()
	r.handlers[name] = h
	r.logger.Info("integration: handler registered",
		zap.String("type", string(name)),
		zap.String("handlerType", string(h.Type())))
}

// Get returns the handler for the given type, or ErrHandlerNotFound.
func (r *Registry) Get(t IntegrationType) (Handler, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if h, ok := r.handlers[t]; ok {
		return h, nil
	}
	return nil, ErrHandlerNotFound
}

// Has reports whether a handler is registered for the given type.
func (r *Registry) Has(t IntegrationType) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, ok := r.handlers[t]
	return ok
}

// Types returns a sorted list of all registered types.
func (r *Registry) Types() []IntegrationType {
	r.mu.RLock()
	defer r.mu.RUnlock()

	types := make([]IntegrationType, 0, len(r.handlers))
	for t := range r.handlers {
		types = append(types, t)
	}
	return types
}

// GetByHandlerType returns all handlers of a given HandlerType (e.g. all
// message-queue handlers).
func (r *Registry) GetByHandlerType(ht HandlerType) []Handler {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var out []Handler
	for _, h := range r.handlers {
		if h.Type() == ht {
			out = append(out, h)
		}
	}
	return out
}

// Count returns the number of registered handlers.
func (r *Registry) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.handlers)
}

// ---------------------------------------------------------------------------
// Default built-in handlers (stubs) — one per supported type
// ---------------------------------------------------------------------------

// defaultHandler is a no-op implementation used as a placeholder for every
// supported type so the registry starts with full coverage. Real services wire
// concrete implementations via Registry.Register.
type defaultHandler struct {
	it  IntegrationType
	ht  HandlerType
	err error
}

func (h *defaultHandler) Name() IntegrationType       { return h.it }
func (h *defaultHandler) Type() HandlerType           { return h.ht }
func (h *defaultHandler) Validate(*Integration) error { return nil }
func (h *defaultHandler) Handle(ctx context.Context, integration *Integration, op *Operation, input map[string]interface{}) (map[string]interface{}, error) {
	if h.err != nil {
		return nil, h.err
	}
	if op != nil && op.Timeout > 0 {
		_, cancel := context.WithTimeout(ctx, op.Timeout)
		defer cancel()
	}
	return map[string]interface{}{"status": "ok", "type": string(h.it)}, nil
}

// registerBuiltins adds a defaultHandler for every supported IntegrationType.
func registerBuiltins(r *Registry) {
	builtins := []struct {
		it IntegrationType
		ht HandlerType
	}{
		{IntegrationTypeRESTAPI, HandlerTypeRequestResponse},
		{IntegrationTypeGraphQL, HandlerTypeRequestResponse},
		{IntegrationTypeWebSocket, HandlerTypeStreaming},
		{IntegrationTypeGRPC, HandlerTypeRequestResponse},
		{IntegrationTypeKafka, HandlerTypeMessageQueue},
		{IntegrationTypeRabbitMQ, HandlerTypeMessageQueue},
		{IntegrationTypeMongoDB, HandlerTypeDatabase},
		{IntegrationTypePostgreSQL, HandlerTypeDatabase},
	}
	for _, b := range builtins {
		r.Register(&defaultHandler{it: b.it, ht: b.ht})
	}
}

// NewDefaultRegistry creates a registry pre-populated with the built-in
// handlers for every supported type.
func NewDefaultRegistry(opts ...RegistryOption) *Registry {
	r := NewRegistry(opts...)
	registerBuiltins(r)
	return r
}
