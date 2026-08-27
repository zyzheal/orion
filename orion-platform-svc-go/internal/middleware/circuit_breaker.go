package middleware

import (
	"context"
	"net/http"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
)

// --- Circuit States ---

type CircuitState int32

const (
	StateClosed   CircuitState = 0
	StateOpen     CircuitState = 1
	StateHalfOpen CircuitState = 2
)

func (s CircuitState) String() string {
	switch s {
	case StateClosed:
		return "closed"
	case StateOpen:
		return "open"
	case StateHalfOpen:
		return "half-open"
	default:
		return "unknown"
	}
}

// --- Config ---

type CircuitBreakerConfig struct {
	FailureThreshold    int
	SuccessThreshold    int
	Timeout             time.Duration
	MaxHalfOpenRequests int
	OnStateChange       func(name string, from, to CircuitState)
	Name                string
}

func DefaultCircuitBreakerConfig() CircuitBreakerConfig {
	return CircuitBreakerConfig{
		FailureThreshold:    5,
		SuccessThreshold:    3,
		Timeout:             30 * time.Second,
		MaxHalfOpenRequests: 5,
		Name:                "default",
	}
}

// --- Internal breaker state ---

type circuitBreaker struct {
	config CircuitBreakerConfig

	state        atomic.Int32
	failureCount atomic.Int64
	successCount atomic.Int64
	openedAt     atomic.Int64
	halfOpenReqs atomic.Int64
}

func NewCircuitBreaker(cfg CircuitBreakerConfig) *circuitBreaker {
	if cfg.FailureThreshold <= 0 {
		cfg.FailureThreshold = 5
	}
	if cfg.SuccessThreshold <= 0 {
		cfg.SuccessThreshold = 3
	}
	if cfg.Timeout <= 0 {
		cfg.Timeout = 30 * time.Second
	}
	if cfg.MaxHalfOpenRequests <= 0 {
		cfg.MaxHalfOpenRequests = 5
	}
	if cfg.Name == "" {
		cfg.Name = "default"
	}

	cb := &circuitBreaker{config: cfg}
	cb.state.Store(int32(StateClosed))
	return cb
}

func (cb *circuitBreaker) getState() CircuitState {
	state := CircuitState(cb.state.Load())

	if state == StateOpen {
		openedAt := time.Unix(0, cb.openedAt.Load())
		if time.Since(openedAt) > cb.config.Timeout {
			if cb.state.CompareAndSwap(int32(StateOpen), int32(StateHalfOpen)) {
				cb.failureCount.Store(0)
				cb.successCount.Store(0)
				cb.halfOpenReqs.Store(0)
				if cb.config.OnStateChange != nil {
					cb.config.OnStateChange(cb.config.Name, StateOpen, StateHalfOpen)
				}
			}
			return CircuitState(cb.state.Load())
		}
	}

	return CircuitState(cb.state.Load())
}

func (cb *circuitBreaker) allowRequest() bool {
	state := cb.getState()

	switch state {
	case StateClosed:
		return true
	case StateOpen:
		return false
	case StateHalfOpen:
		if cb.halfOpenReqs.Add(1) <= int64(cb.config.MaxHalfOpenRequests) {
			return true
		}
		cb.halfOpenReqs.Add(-1)
		return false
	default:
		return true
	}
}

func (cb *circuitBreaker) recordSuccess() {
	state := CircuitState(cb.state.Load())

	if state == StateHalfOpen {
		successes := cb.successCount.Add(1)
		if successes >= int64(cb.config.SuccessThreshold) {
			if cb.state.CompareAndSwap(int32(StateHalfOpen), int32(StateClosed)) {
				cb.failureCount.Store(0)
				if cb.config.OnStateChange != nil {
					cb.config.OnStateChange(cb.config.Name, StateHalfOpen, StateClosed)
				}
			}
		}
	} else if state == StateClosed {
		cb.failureCount.Store(0)
	}
}

func (cb *circuitBreaker) recordFailure() {
	state := CircuitState(cb.state.Load())

	if state == StateHalfOpen {
		if cb.state.CompareAndSwap(int32(StateHalfOpen), int32(StateOpen)) {
			cb.openedAt.Store(time.Now().UnixNano())
			if cb.config.OnStateChange != nil {
				cb.config.OnStateChange(cb.config.Name, StateHalfOpen, StateOpen)
			}
		}
	} else if state == StateClosed {
		failures := cb.failureCount.Add(1)
		if failures >= int64(cb.config.FailureThreshold) {
			if cb.state.CompareAndSwap(int32(StateClosed), int32(StateOpen)) {
				cb.openedAt.Store(time.Now().UnixNano())
				if cb.config.OnStateChange != nil {
					cb.config.OnStateChange(cb.config.Name, StateClosed, StateOpen)
				}
			}
		}
	}
}

// --- Gin Middleware ---

// CircuitBreaker returns a Gin middleware that enforces the circuit breaker pattern.
//
// Usage (global):
//
//	r := gin.New()
//	r.Use(middleware.CircuitBreaker(middleware.DefaultCircuitBreakerConfig()))
//
// Usage (per route group):
//
//	api := r.Group("/api/v1")
//	api.Use(middleware.CircuitBreaker(middleware.CircuitBreakerConfig{
//	    FailureThreshold: 10,
//	    Timeout:          60 * time.Second,
//	    Name:            "api-v1",
//	}))
func CircuitBreaker(cfg CircuitBreakerConfig) gin.HandlerFunc {
	cb := NewCircuitBreaker(cfg)

	return func(c *gin.Context) {
		if !cb.allowRequest() {
			retryAfter := int(cb.config.Timeout.Seconds())
			c.Header("Retry-After", strconv.Itoa(retryAfter))
			c.Header("X-Circuit-Breaker-State", "open")
			c.Header("X-Circuit-Breaker-Name", cb.config.Name)
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "CIRCUIT_OPEN",
					"message": "circuit breaker is open, please retry later",
					"details": gin.H{
						"breaker":     cb.config.Name,
						"retry_after": retryAfter,
					},
				},
			})
			return
		}

		c.Header("X-Circuit-Breaker-State", CircuitState(cb.state.Load()).String())
		c.Next()

		status := c.Writer.Status()
		if status >= http.StatusInternalServerError {
			cb.recordFailure()
		} else if status < http.StatusBadRequest {
			cb.recordSuccess()
		}
		// 4xx — neither success nor failure
	}
}

// --- CircuitBreakerManager ---

type CircuitBreakerManager struct {
	mu       sync.RWMutex
	breakers map[string]*circuitBreaker
	defaults CircuitBreakerConfig
}

func NewCircuitBreakerManager(defaults CircuitBreakerConfig) *CircuitBreakerManager {
	return &CircuitBreakerManager{
		breakers: make(map[string]*circuitBreaker),
		defaults: defaults,
	}
}

func (m *CircuitBreakerManager) Get(name string) *circuitBreaker {
	m.mu.RLock()
	cb, ok := m.breakers[name]
	m.mu.RUnlock()
	if ok {
		return cb
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	if cb, ok := m.breakers[name]; ok {
		return cb
	}
	cfg := m.defaults
	cfg.Name = name
	cb = NewCircuitBreaker(cfg)
	m.breakers[name] = cb
	return cb
}

func (m *CircuitBreakerManager) GetState(name string) CircuitState {
	return CircuitState(m.Get(name).state.Load())
}

func (m *CircuitBreakerManager) GetAllStates() map[string]string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	result := make(map[string]string, len(m.breakers))
	for name, cb := range m.breakers {
		result[name] = CircuitState(cb.state.Load()).String()
	}
	return result
}

func (m *CircuitBreakerManager) Reset(name string) {
	cb := m.Get(name)
	cb.state.Store(int32(StateClosed))
	cb.failureCount.Store(0)
	cb.successCount.Store(0)
}

// --- Status API ---

func CircuitBreakerStatusHandler(mgr *CircuitBreakerManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		states := mgr.GetAllStates()
		RespondSuccess(c, states)
	}
}

// --- Context Integration ---

func WithCircuitBreaker(ctx context.Context, cb *circuitBreaker) context.Context {
	return context.WithValue(ctx, circuitBreakerCtxKey{}, cb)
}

type circuitBreakerCtxKey struct{}

func FromContext(ctx context.Context) *circuitBreaker {
	cb, _ := ctx.Value(circuitBreakerCtxKey{}).(*circuitBreaker)
	return cb
}

func (cb *circuitBreaker) Execute(ctx context.Context, fn func(ctx context.Context) error) error {
	if !cb.allowRequest() {
		return &CircuitOpenError{
			BreakerName: cb.config.Name,
			Timeout:     cb.config.Timeout,
		}
	}

	err := fn(ctx)
	if err != nil {
		cb.recordFailure()
		return err
	}
	cb.recordSuccess()
	return nil
}

type CircuitOpenError struct {
	BreakerName string
	Timeout     time.Duration
}

func (e *CircuitOpenError) Error() string {
	return "circuit breaker '" + e.BreakerName + "' is open, retry after " + e.Timeout.String()
}

func (e *CircuitOpenError) Is(target error) bool {
	_, ok := target.(*CircuitOpenError)
	return ok
}

// --- Package-level manager singleton ---

var defaultManager = NewCircuitBreakerManager(DefaultCircuitBreakerConfig())

func DefaultManager() *CircuitBreakerManager {
	return defaultManager
}
