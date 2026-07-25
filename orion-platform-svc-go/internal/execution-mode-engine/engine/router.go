package engine

import (
	"fmt"

	"go.uber.org/zap"
)

// routerImpl implements ModeRouter. It maintains a map of Mode -> ModeHandler
// and a configurable fallback chain.
type routerImpl struct {
	// handlers maps a Mode to the registered handler for that mode.
	handlers map[Mode]ModeHandler

	// fallbackOrder defines the default fallback chain tried when the primary
	// mode handler fails. Order matters: first entry is tried first.
	fallbackOrder []Mode

	// stats tracks per-handler counters.
	stats map[string]*HandlerStats

	logger *zap.Logger
}

// newRouterImpl creates a router with sensible defaults.
func newRouterImpl(logger *zap.Logger) *routerImpl {
	return &routerImpl{
		handlers: make(map[Mode]ModeHandler),
		fallbackOrder: []Mode{
			ModeImmediate,
			ModeQueued,
			ModeScheduled,
			ModeManual,
			ModeAPITriggered,
		},
		stats:  make(map[string]*HandlerStats),
		logger: logger,
	}
}

func (r *routerImpl) RegisterModeHandler(h ModeHandler) {
	for _, m := range allModes() {
		if h.Handles(m) {
			r.handlers[m] = h
			// Ensure stats entry exists.
			if _, ok := r.stats[h.Name()]; !ok {
				r.stats[h.Name()] = &HandlerStats{Name: h.Name()}
			}
		}
	}
}

// Route resolves a request's mode to a handler. If the exact mode has no
// handler, returns ErrModeNotImplemented.
func (r *routerImpl) Route(req *ExecutionRequest) (ModeHandler, error) {
	h, ok := r.handlers[req.Mode]
	if !ok {
		return nil, fmt.Errorf("%w: %q", ErrModeNotImplemented, req.Mode)
	}
	return h, nil
}

// FallbackModes returns fallback modes that differ from the request's current
// mode, in fallback order.
func (r *routerImpl) FallbackModes(req *ExecutionRequest) []Mode {
	var out []Mode
	for _, m := range r.fallbackOrder {
		if m != req.Mode && r.handlers[m] != nil {
			out = append(out, m)
		}
	}
	return out
}

// RegisteredModes returns all modes that have a registered handler.
func (r *routerImpl) RegisteredModes() []Mode {
	var out []Mode
	for m := range r.handlers {
		out = append(out, m)
	}
	return out
}

// Stats returns a copy of the current handler statistics.
func (r *routerImpl) Stats() map[string]*HandlerStats {
	snap := make(map[string]*HandlerStats, len(r.stats))
	for k, v := range r.stats {
		snap[k] = &HandlerStats{
			Name:         v.Name,
			TotalCalls:   v.TotalCalls,
			SuccessCalls: v.SuccessCalls,
			FailedCalls:  v.FailedCalls,
			LastExecuted: v.LastExecuted,
		}
	}
	return snap
}

// allModes returns the canonical list of execution modes.
func allModes() []Mode {
	return []Mode{
		ModeImmediate,
		ModeQueued,
		ModeScheduled,
		ModeManual,
		ModeAPITriggered,
	}
}
