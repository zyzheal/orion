// ============================================================
// Plan 31 — Circuit Breaker 中间件
// ============================================================
// 优先级: P0
// 来源: 全量代码扫描发现 — circuit-breaker service 已有 CRUD (251行) 但无中间件集成
// 本地证据:
//   - internal/circuit-breaker/service/service.go (251行): Create/Get/List/RecordFailure/RecordSuccess/Evaluate
//   - grep -l "circuit\|breaker" internal/middleware/*.go → 空 (无熔断中间件)
//   - router.go 中间件链: RateLimit + Timeout + SecurityHeaders + Prometheus — 无 CircuitBreaker
//   - orion-go-common/pkg/sentinel/sentinel.go (37行): 仅错误哨兵值, 非熔断器
// 技术约束: Go (module orion/platform-svc-go), Gin, go 1.25.0
// ============================================================

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

// --- Types ---

// CircuitState 表示熔断器当前状态
type CircuitState int32

const (
	StateClosed   CircuitState = 0 // 正常放行
	StateOpen     CircuitState = 1 // 拒绝请求
	StateHalfOpen CircuitState = 2 // 放行有限请求
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

// CircuitBreakerConfig 熔断器配置
type CircuitBreakerConfig struct {
	// FailureThreshold: 连续失败次数达到此值后打开熔断器
	// 默认: 5
	FailureThreshold int

	// SuccessThreshold: half-open 状态下连续成功次数达到此值后关闭熔断器
	// 默认: 3
	SuccessThreshold int

	// Timeout: 熔断器打开后等待多长时间转为 half-open
	// 默认: 30s
	Timeout time.Duration

	// MaxHalfOpenRequests: half-open 状态下允许通过的最大请求数
	// 默认: 5
	MaxHalfOpenRequests int

	// OnStateChange: 状态变更回调 (用于通知、告警)
	OnStateChange func(name string, from, to CircuitState)

	// Name: 熔断器名称 (用于多实例区分)
	Name string
}

// DefaultCircuitBreakerConfig 返回默认配置
func DefaultCircuitBreakerConfig() CircuitBreakerConfig {
	return CircuitBreakerConfig{
		FailureThreshold:    5,
		SuccessThreshold:    3,
		Timeout:            30 * time.Second,
		MaxHalfOpenRequests: 5,
		Name:              "default",
	}
}

// circuitBreaker 熔断器内部状态
type circuitBreaker struct {
	config CircuitBreakerConfig

	// 使用 atomic 保证并发安全
	state        atomic.Int32 // CircuitState
	failureCount atomic.Int64
	successCount atomic.Int64
	openedAt     atomic.Int64 // unix nano

	// half-open 请求计数
	halfOpenReqs atomic.Int64
}

// NewCircuitBreaker 创建熔断器实例
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

// getState 获取当前状态 (并处理 open → half-open 转换)
func (cb *circuitBreaker) getState() CircuitState {
	state := CircuitState(cb.state.Load())

	if state == StateOpen {
		openedAt := time.Unix(0, cb.openedAt.Load())
		if time.Since(openedAt) > cb.config.Timeout {
			// 尝试转换为 half-open
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

// allowRequest 判断是否允许请求通过
func (cb *circuitBreaker) allowRequest() bool {
	state := cb.getState()

	switch state {
	case StateClosed:
		return true
	case StateOpen:
		return false
	case StateHalfOpen:
		// 限制 half-open 请求数量
		if cb.halfOpenReqs.Inc() <= int64(cb.config.MaxHalfOpenRequests) {
			return true
		}
		cb.halfOpenReqs.Dec()
		return false
	default:
		return true
	}
}

// recordSuccess 记录成功
func (cb *circuitBreaker) recordSuccess() {
	state := CircuitState(cb.state.Load())

	if state == StateHalfOpen {
		successes := cb.successCount.Inc()
		if successes >= int64(cb.config.SuccessThreshold) {
			if cb.state.CompareAndSwap(int32(StateHalfOpen), int32(StateClosed)) {
				cb.failureCount.Store(0)
				if cb.config.OnStateChange != nil {
					cb.config.OnStateChange(cb.config.Name, StateHalfOpen, StateClosed)
				}
			}
		}
	} else if state == StateClosed {
		// 重置失败计数
		cb.failureCount.Store(0)
	}
}

// recordFailure 记录失败
func (cb *circuitBreaker) recordFailure() {
	state := cb.getState()

	if state == StateHalfOpen {
		// half-open 下任何失败都重新打开熔断器
		if cb.state.CompareAndSwap(int32(StateHalfOpen), int32(StateOpen)) {
			cb.openedAt.Store(time.Now().UnixNano())
			if cb.config.OnStateChange != nil {
				cb.config.OnStateChange(cb.config.Name, StateHalfOpen, StateOpen)
			}
		}
	} else if state == StateClosed {
		failures := cb.failureCount.Inc()
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

// CircuitBreaker 返回 Gin 熔断器中间件
//
// 使用方式:
//
//	r := gin.New()
//	r.Use(middleware.RateLimit(...))
//	r.Use(middleware.CircuitBreaker(middleware.DefaultCircuitBreakerConfig()))
//	r.Use(middleware.Timeout(...))
//
// 或针对特定路由组:
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
						"breaker":    cb.config.Name,
						"retry_after": retryAfter,
					},
				},
			})
			return
		}

		c.Header("X-Circuit-Breaker-State", CircuitState(cb.state.Load()).String())

		c.Next()

		status := c.Writer.Status()

		// 5xx 和超时视为失败
		if status >= http.StatusInternalServerError {
			cb.recordFailure()
		} else if status < http.StatusBadRequest {
			// 2xx/3xx 视为成功
			cb.recordSuccess()
		}
		// 4xx 不计入成功也不计入失败 (客户端错误不影响熔断器)
	}
}

// --- Per-Service Circuit Breaker Manager ---

// CircuitBreakerManager 多服务熔断器管理器
// 为不同服务/API 维护独立的熔断器实例
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

// Get 获取或创建指定名称的熔断器
func (m *CircuitBreakerManager) Get(name string) *circuitBreaker {
	m.mu.RLock()
	cb, ok := m.breakers[name]
	m.mu.RUnlock()
	if ok {
		return cb
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	// Double-check
	if cb, ok := m.breakers[name]; ok {
		return cb
	}
	cfg := m.defaults
	cfg.Name = name
	cb = NewCircuitBreaker(cfg)
	m.breakers[name] = cb
	return cb
}

// GetState 获取指定熔断器状态
func (m *CircuitBreakerManager) GetState(name string) CircuitState {
	return CircuitState(m.Get(name).state.Load())
}

// GetAllStates 获取所有熔断器状态
func (m *CircuitBreakerManager) GetAllStates() map[string]string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	result := make(map[string]string, len(m.breakers))
	for name, cb := range m.breakers {
		result[name] = CircuitState(cb.state.Load()).String()
	}
	return result
}

// Reset 重置指定熔断器到 closed 状态
func (m *CircuitBreakerManager) Reset(name string) {
	cb := m.Get(name)
	cb.state.Store(int32(StateClosed))
	cb.failureCount.Store(0)
	cb.successCount.Store(0)
}

// --- HTTP Handler for Status API ---

// CircuitBreakerStatusHandler 返回所有熔断器状态的 HTTP Handler
// 注册到: GET /api/v1/circuit-breakers/status
func CircuitBreakerStatusHandler(mgr *CircuitBreakerManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		states := mgr.GetAllStates()
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    states,
		})
	}
}

// --- Context Integration ---

// WithCircuitBreaker 将熔断器注入 context (用于 service 层调用外部 API)
func WithCircuitBreaker(ctx context.Context, cb *circuitBreaker) context.Context {
	return context.WithValue(ctx, circuitBreakerKey{}, cb)
}

type circuitBreakerKey struct{}

// FromContext 从 context 中获取熔断器
func FromContext(ctx context.Context) *circuitBreaker {
	cb, _ := ctx.Value(circuitBreakerKey{}).(*circuitBreaker)
	return cb
}

// Execute 在熔断器保护下执行函数 (用于 service 层调用外部 API)
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

// CircuitOpenError 熔断器打开错误
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
