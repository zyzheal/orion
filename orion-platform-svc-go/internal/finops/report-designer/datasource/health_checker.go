package datasource

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// DefaultHealthCheckInterval is the default interval between health checks.
const DefaultHealthCheckInterval = 30 * time.Second

// DefaultRetryAttempts is the default number of retry attempts before marking unhealthy.
const DefaultRetryAttempts = 3

// DefaultRetryDelay is the initial delay between retries.
const DefaultRetryDelay = 500 * time.Millisecond

// HealthStatus represents the health state of a data source.
type HealthStatus struct {
	Name      string    `json:"name"`
	Healthy   bool      `json:"healthy"`
	Latency   time.Duration `json:"latency"`
	Error     string    `json:"error,omitempty"`
	CheckedAt time.Time `json:"checked_at"`
}

// HealthChecker monitors data source health with automatic retry logic.
type HealthChecker struct {
	mu          sync.RWMutex
	manager     *Manager
	factory     *DataSourceFactory
	interval    time.Duration
	retryCount  int
	retryDelay  time.Duration
	logger      Logger
	stop        chan struct{}
	running     bool
	status      map[string]*HealthStatus
}

// NewHealthChecker creates a new HealthChecker.
func NewHealthChecker(manager *Manager, factory *DataSourceFactory, logger Logger) *HealthChecker {
	return &HealthChecker{
		manager:     manager,
		factory:     factory,
		interval:    DefaultHealthCheckInterval,
		retryCount:  DefaultRetryAttempts,
		retryDelay:  DefaultRetryDelay,
		logger:      logger,
		stop:        make(chan struct{}),
		status:      make(map[string]*HealthStatus),
	}
}

// Start begins periodic health checks.
func (hc *HealthChecker) Start() {
	hc.mu.Lock()
	defer hc.mu.Unlock()

	if hc.running {
		return
	}
	hc.running = true

	if hc.logger != nil {
		hc.logger.Info("health checker started", "interval", hc.interval.String())
	}

	go hc.run()
}

// Stop stops the health checker goroutine.
func (hc *HealthChecker) Stop() {
	hc.mu.Lock()
	defer hc.mu.Unlock()

	if !hc.running {
		return
	}
	close(hc.stop)
	hc.running = false

	if hc.logger != nil {
		hc.logger.Info("health checker stopped")
	}
}

// run executes health checks in a loop.
func (hc *HealthChecker) run() {
	ticker := time.NewTicker(hc.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			hc.checkAll()
		case <-hc.stop:
			return
		}
	}
}

// checkAll performs health checks on all registered data sources.
func (hc *HealthChecker) checkAll() {
	keys := hc.manager.ListKeys()
	for _, key := range keys {
		select {
		case <-hc.stop:
			return
		default:
			hc.check(key)
		}
	}
}

// check performs a health check on a single data source with retries.
func (hc *HealthChecker) check(key string) {
	conn, err := hc.manager.Get(key)
	if err != nil {
		hc.recordStatus(key, false, 0, fmt.Sprintf("failed to get connector: %s", err.Error()))
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	start := time.Now()
	healthy, err := hc.withRetry(ctx, func(ctx context.Context) (bool, error) {
		return conn.Health(ctx)
	})
	latency := time.Since(start)

	if err != nil {
		hc.recordStatus(key, false, latency, err.Error())
		return
	}

	hc.recordStatus(key, healthy, latency, "")
}

// withRetry executes a health check function with automatic retries.
func (hc *HealthChecker) withRetry(ctx context.Context, fn func(ctx context.Context) (bool, error)) (bool, error) {
	var lastErr error
	delay := hc.retryDelay

	for attempt := 1; attempt <= hc.retryCount; attempt++ {
		result, err := fn(ctx)
		if err == nil && result {
			return true, nil
		}
		if err != nil {
			lastErr = err
		}

		if attempt < hc.retryCount {
			select {
			case <-time.After(delay):
				delay *= 2 // Exponential backoff
			case <-ctx.Done():
				return false, ctx.Err()
			}
		}
	}

	if lastErr != nil {
		return false, fmt.Errorf("health check failed after %d attempts: %w", hc.retryCount, lastErr)
	}
	return false, fmt.Errorf("health check failed after %d attempts", hc.retryCount)
}

// recordStatus stores the health status for a data source.
func (hc *HealthChecker) recordStatus(key string, healthy bool, latency time.Duration, errMsg string) {
	status := &HealthStatus{
		Name:      key,
		Healthy:   healthy,
		Latency:   latency,
		CheckedAt: time.Now(),
	}
	if errMsg != "" {
		status.Error = errMsg
	}

	hc.mu.Lock()
	hc.status[key] = status
	hc.mu.Unlock()

	if !healthy && hc.logger != nil {
		hc.logger.Warn("datasource unhealthy", "name", key, "latency_ms", latency.Milliseconds(), "error", errMsg)
	}
}

// GetStatus returns the current health status for a data source.
func (hc *HealthChecker) GetStatus(name string) (*HealthStatus, bool) {
	hc.mu.RLock()
	defer hc.mu.RUnlock()

	status, ok := hc.status[name]
	return status, ok
}

// GetAllStatus returns health status for all data sources.
func (hc *HealthChecker) GetAllStatus() map[string]*HealthStatus {
	hc.mu.RLock()
	defer hc.mu.RUnlock()

	copyMap := make(map[string]*HealthStatus)
	for k, v := range hc.status {
		copyMap[k] = v
	}
	return copyMap
}

// CheckNow performs an immediate health check on all data sources.
func (hc *HealthChecker) CheckNow(ctx context.Context) map[string]*HealthStatus {
	hc.checkAll()
	return hc.GetAllStatus()
}
