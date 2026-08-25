// Plan 31 — Circuit Breaker Middleware
//
// 核心功能:
//   - 内存态 Circuit Breaker (CLOSED → OPEN → HALF_OPEN → CLOSED)
//   - 失败计数 + 成功计数双阈值
//   - 超时自动 HALF_OPEN 探测
//   - 熔断状态事件回调
//   - 可注入 Fallback 函数
package circuitbreaker

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

// State represents the circuit breaker state.
type State int32

const (
	StateClosed State = iota
	StateOpen
	StateHalfOpen
)

func (s State) String() string {
	switch s {
	case StateClosed:
		return "CLOSED"
	case StateOpen:
		return "OPEN"
	case StateHalfOpen:
		return "HALF_OPEN"
	default:
		return "UNKNOWN"
	}
}

// Event represents a state transition event.
type Event struct {
	From     State
	To       State
	Reason   string
	Time     time.Time
	Counter  int
}

// Config holds the circuit breaker configuration.
type Config struct {
	// FailureThreshold — number of failures before opening the circuit.
	FailureThreshold int

	// SuccessThreshold — number of successes in HALF_OPEN before closing.
	SuccessThreshold int

	// Timeout — duration before transitioning OPEN → HALF_OPEN.
	Timeout time.Duration

	// HalfOpenMaxRequests — max concurrent probe requests in HALF_OPEN.
	HalfOpenMaxRequests int

	// OnStateChange — optional callback on state transitions.
	OnStateChange func(Event)
}

// DefaultConfig returns a sensible default configuration.
func DefaultConfig() Config {
	return Config{
		FailureThreshold:  5,
		SuccessThreshold:  3,
		Timeout:           30 * time.Second,
		HalfOpenMaxRequests: 1,
	}
}

// Fallback is a function called when the circuit is OPEN.
type Fallback func(ctx context.Context, err error) error

// Result is returned by Execute.
type Result struct {
	Error   error
	Proceed bool // true if the request was allowed through
}

// CircuitBreaker is an in-memory circuit breaker implementation.
type CircuitBreaker struct {
	name  string
	cfg   Config

	state       atomic.Int32
	failures    atomic.Int32
	successes   atomic.Int32
	openedAt    atomic.Value // time.Time
	probeCount  atomic.Int32
	mu          sync.RWMutex

	// Event stream
	eventCh chan Event
}

// New creates a new CircuitBreaker with the given name and config.
func New(name string, cfg Config) *CircuitBreaker {
	if cfg.FailureThreshold <= 0 {
		cfg.FailureThreshold = 5
	}
	if cfg.SuccessThreshold <= 0 {
		cfg.SuccessThreshold = 3
	}
	if cfg.Timeout <= 0 {
		cfg.Timeout = 30 * time.Second
	}
	if cfg.HalfOpenMaxRequests <= 0 {
		cfg.HalfOpenMaxRequests = 1
	}

	cb := &CircuitBreaker{
		name:    name,
		cfg:     cfg,
		eventCh: make(chan Event, 64),
	}
	cb.state.Store(int32(StateClosed))
	cb.openedAt.Store(time.Time{})
	return cb
}

// State returns the current state.
func (cb *CircuitBreaker) State() State {
	return State(cb.state.Load())
}

// Name returns the circuit breaker name.
func (cb *CircuitBreaker) Name() string {
	return cb.name
}

// Failures returns the current failure count.
func (cb *CircuitBreaker) Failures() int {
	return int(cb.failures.Load())
}

// Successes returns the current success count.
func (cb *CircuitBreaker) Successes() int {
	return int(cb.successes.Load())
}

// Events returns the event channel for consuming state transitions.
func (cb *CircuitBreaker) Events() <-chan Event {
	return cb.eventCh
}

// emit sends a state transition event.
func (cb *CircuitBreaker) emit(from, to State, reason string) {
	if cb.cfg.OnStateChange != nil {
		cb.cfg.OnStateChange(Event{
			From:    from,
			To:      to,
			Reason:  reason,
			Time:    time.Now(),
			Counter: int(cb.failures.Load()),
		})
	}
}

// Execute wraps a function call with circuit breaker logic.
func (cb *CircuitBreaker) Execute(ctx context.Context, fn func(context.Context) error) error {
	// Check if we should allow the request
	if !cb.allowRequest() {
		// Circuit is OPEN and timeout hasn't elapsed
		return fmt.Errorf("circuit breaker [%s] is OPEN: rejected", cb.name)
	}

	err := fn(ctx)
	if err != nil {
		cb.recordFailure()
		return err
	}
	cb.recordSuccess()
	return nil
}

// ExecuteWithFallback wraps a function call with circuit breaker + fallback.
func (cb *CircuitBreaker) ExecuteWithFallback(ctx context.Context, fn func(context.Context) error, fallback Fallback) error {
	if !cb.allowRequest() {
		return fallback(ctx, fmt.Errorf("circuit breaker [%s] is OPEN", cb.name))
	}

	err := fn(ctx)
	if err != nil {
		cb.recordFailure()
		return err
	}
	cb.recordSuccess()
	return nil
}

// allowRequest checks if the request should proceed.
// Returns true for CLOSED and HALF_OPEN (with probe limit).
// Returns false for OPEN unless timeout has elapsed (auto-transitions).
func (cb *CircuitBreaker) allowRequest() bool {
	state := cb.State()

	if state == StateClosed {
		return true
	}

	if state == StateOpen {
		// Check if timeout has elapsed → auto-transition to HALF_OPEN
		cb.mu.Lock()
		openedAtVal := cb.openedAt.Load()
		if openedAtVal != nil {
			openedAt := openedAtVal.(time.Time)
			if time.Since(openedAt) >= cb.cfg.Timeout {
				cb.mu.Unlock()
				cb.transitionTo(StateHalfOpen, "timeout elapsed")
				return cb.tryHalfOpen()
			}
		}
		cb.mu.Unlock()
		return false
	}

	// HALF_OPEN
	if state == StateHalfOpen {
		return cb.tryHalfOpen()
	}

	return false
}

// tryHalfOpen allows up to HalfOpenMaxRequests concurrent probes.
func (cb *CircuitBreaker) tryHalfOpen() bool {
	probes := int(cb.probeCount.Add(1))
	if probes > cb.cfg.HalfOpenMaxRequests {
		cb.probeCount.Add(-1)
		return false
	}
	return true
}

// recordSuccess records a successful call.
func (cb *CircuitBreaker) recordSuccess() {
	state := cb.State()

	if state == StateHalfOpen {
		successes := cb.successes.Add(1)
		if int(successes) >= cb.cfg.SuccessThreshold {
			cb.transitionTo(StateClosed, fmt.Sprintf("success threshold reached: %d", successes))
			cb.successes.Store(0)
			cb.failures.Store(0)
			cb.probeCount.Store(0)
		}
		return
	}

	if state == StateClosed {
		// Reset failures on success
		cb.failures.Store(0)
	}
}

// recordFailure records a failed call.
func (cb *CircuitBreaker) recordFailure() {
	state := cb.State()

	if state == StateHalfOpen {
		cb.transitionTo(StateOpen, "failure during half-open probe")
		cb.probeCount.Store(0)
		return
	}

	if state == StateClosed {
		failures := cb.failures.Add(1)
		if int(failures) >= cb.cfg.FailureThreshold {
			cb.transitionTo(StateOpen, fmt.Sprintf("failure threshold reached: %d", failures))
		}
	}
}

// transitionTo changes the circuit breaker state.
func (cb *CircuitBreaker) transitionTo(newState State, reason string) {
	cb.mu.Lock()
	oldState := cb.State()
	cb.mu.Unlock()

	cb.state.Store(int32(newState))
	cb.openedAt.Store(time.Now())

	cb.emit(oldState, newState, reason)
}

// ForceOpen manually opens the circuit (for admin intervention).
func (cb *CircuitBreaker) ForceOpen(reason string) {
	cb.transitionTo(StateOpen, "forced: "+reason)
}

// ForceClose manually closes the circuit (for admin intervention).
func (cb *CircuitBreaker) ForceClose(reason string) {
	cb.transitionTo(StateClosed, "forced: "+reason)
	cb.failures.Store(0)
	cb.successes.Store(0)
}

// Reset restores the circuit to CLOSED with zero counters.
func (cb *CircuitBreaker) Reset() {
	cb.transitionTo(StateClosed, "reset")
	cb.failures.Store(0)
	cb.successes.Store(0)
	cb.probeCount.Store(0)
}

// NewWithFallback creates a CircuitBreaker with a pre-configured fallback.
func NewWithFallback(name string, cfg Config, fallback Fallback) *CircuitBreaker {
	return &CircuitBreaker{
		name:    name,
		cfg:     cfg,
		eventCh: make(chan Event, 64),
	}
}

var ErrCircuitOpen = errors.New("circuit breaker is open")
