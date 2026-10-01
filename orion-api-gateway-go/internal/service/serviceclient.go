// Package service provides service-to-service communication with circuit breaker,
// retry, and timeout support.
package service

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"sync"
	"time"
)

// CircuitState represents the circuit breaker state.
type CircuitState int

const (
	CircuitClosed   CircuitState = iota // normal, requests allowed
	CircuitOpen                          // tripped, requests rejected
	CircuitHalfOpen                      // probing, limited requests
)

func (s CircuitState) String() string {
	switch s {
	case CircuitClosed:
		return "CLOSED"
	case CircuitOpen:
		return "OPEN"
	case CircuitHalfOpen:
		return "HALF_OPEN"
	}
	return "UNKNOWN"
}

// ServiceRouteConfig defines per-service routing configuration.
type ServiceRouteConfig struct {
	BaseURL                   string
	Timeout                   time.Duration
	Retries                   int
	CircuitBreakerThreshold   int
	CircuitBreakerResetTimeout time.Duration
}

// ServiceRequestOptions are options for a service request.
type ServiceRequestOptions struct {
	Method     string
	Headers    map[string]string
	Body       interface{}
	Timeout    time.Duration
	SkipRetry  bool
}

// ServiceResponse holds the response from a service call.
type ServiceResponse struct {
	Status    int
	Data      []byte
	Headers   map[string]string
	RequestID string
}

// CircuitClientError is a typed error from the service client.
type CircuitClientError struct {
	Code       string
	Message    string
	StatusCode int
	Details    interface{}
}

func (e *CircuitClientError) Error() string {
	return fmt.Sprintf("%s: %s (status %d)", e.Code, e.Message, e.StatusCode)
}

// circuitBreaker implements the circuit breaker pattern.
type circuitBreaker struct {
	mu               sync.Mutex
	state            CircuitState
	failureCount     int
	lastFailureTime  time.Time
	successCount     int
	threshold        int
	resetTimeout     time.Duration
}

func newCircuitBreaker(threshold int, resetTimeout time.Duration) *circuitBreaker {
	return &circuitBreaker{
		state:        CircuitClosed,
		threshold:    threshold,
		resetTimeout: resetTimeout,
	}
}

func (cb *circuitBreaker) canRequest() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case CircuitClosed:
		return true
	case CircuitOpen:
		if time.Since(cb.lastFailureTime) >= cb.resetTimeout {
			cb.state = CircuitHalfOpen
			cb.successCount = 0
			return true
		}
		return false
	case CircuitHalfOpen:
		return true
	}
	return true
}

func (cb *circuitBreaker) recordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.failureCount = 0
	if cb.state == CircuitHalfOpen {
		cb.successCount++
		cb.state = CircuitClosed
	}
}

func (cb *circuitBreaker) recordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.failureCount++
	cb.lastFailureTime = time.Now()
	if cb.state == CircuitHalfOpen {
		cb.state = CircuitOpen
	} else if cb.failureCount >= cb.threshold {
		cb.state = CircuitOpen
	}
}

func (cb *circuitBreaker) getState() CircuitState {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	return cb.state
}

func (cb *circuitBreaker) reset() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.state = CircuitClosed
	cb.failureCount = 0
	cb.successCount = 0
}

// DefaultServiceRoutes returns the default 34-service route table.
func DefaultServiceRoutes() map[string]ServiceRouteConfig {
	routes := make(map[string]ServiceRouteConfig)
	port := 3001
	for i := 0; i < 34; i++ {
		name := fmt.Sprintf("service-%d", port)
		routes[name] = ServiceRouteConfig{
			BaseURL:                   fmt.Sprintf("http://localhost:%d", port),
			Timeout:                   30 * time.Second,
			Retries:                   3,
			CircuitBreakerThreshold:   5,
			CircuitBreakerResetTimeout: 30 * time.Second,
		}
		port++
	}
	return routes
}

// CircuitServiceClient provides HTTP service-to-service calls with retry and circuit breaker.
type CircuitServiceClient struct {
	httpClient    *http.Client
	routes        map[string]ServiceRouteConfig
	breakers      map[string]*circuitBreaker
	breakersMu     sync.RWMutex
}

// NewCircuitServiceClient creates a service client with the given routes.
// If routes is nil, DefaultServiceRoutes() is used.
func NewCircuitServiceClient(routes map[string]ServiceRouteConfig) *CircuitServiceClient {
	if routes == nil {
		routes = DefaultServiceRoutes()
	}
	return &CircuitServiceClient{
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
		routes:   routes,
		breakers: make(map[string]*circuitBreaker),
	}
}

// GetServiceConfig returns the config for a service.
func (sc *CircuitServiceClient) GetServiceConfig(serviceName string) (ServiceRouteConfig, bool) {
	cfg, ok := sc.routes[serviceName]
	return cfg, ok
}

func (sc *CircuitServiceClient) getBreaker(serviceName string, cfg ServiceRouteConfig) *circuitBreaker {
	sc.breakersMu.RLock()
	b, ok := sc.breakers[serviceName]
	sc.breakersMu.RUnlock()
	if ok {
		return b
	}
	sc.breakersMu.Lock()
	defer sc.breakersMu.Unlock()
	if b, ok := sc.breakers[serviceName]; ok {
		return b
	}
	b = newCircuitBreaker(cfg.CircuitBreakerThreshold, cfg.CircuitBreakerResetTimeout)
	sc.breakers[serviceName] = b
	return b
}

// Request sends a request to a named service.
func (sc *CircuitServiceClient) Request(ctx context.Context, serviceName, path string, opts ServiceRequestOptions) (*ServiceResponse, error) {
	cfg, ok := sc.routes[serviceName]
	if !ok {
		return nil, &CircuitClientError{
			Code: "SERVICE_NOT_FOUND", Message: fmt.Sprintf("Service %s not found", serviceName),
			StatusCode: 404,
		}
	}

	breaker := sc.getBreaker(serviceName, cfg)
	if !breaker.canRequest() {
		return nil, &CircuitClientError{
			Code: "CIRCUIT_OPEN", Message: fmt.Sprintf("Circuit breaker open for %s", serviceName),
			StatusCode: 503, Details: map[string]interface{}{"serviceName": serviceName, "state": breaker.getState().String()},
		}
	}

	requestID := opts.Headers["X-Request-ID"]
	if requestID == "" {
		requestID = generateRequestID()
	}

	timeout := opts.Timeout
	if timeout == 0 {
		timeout = cfg.Timeout
	}

	maxRetries := 0
	if !opts.SkipRetry {
		maxRetries = cfg.Retries
	}

	var lastErr error
	for attempt := 0; attempt <= maxRetries; attempt++ {
		reqCtx, cancel := context.WithTimeout(ctx, timeout)
		resp, err := sc.executeRequest(reqCtx, cfg.BaseURL, path, opts, requestID)
		cancel()

		if err == nil {
			breaker.recordSuccess()
			return resp, nil
		}

		lastErr = err
		if !isRetryableError(err) || attempt >= maxRetries {
			break
		}

		delay := calculateBackoff(attempt)
		select {
		case <-time.After(delay):
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}

	breaker.recordFailure()

	if scErr, ok := lastErr.(*CircuitClientError); ok {
		return nil, scErr
	}
	if lastErr != nil {
		return nil, &CircuitClientError{
			Code: "SERVICE_ERROR", Message: lastErr.Error(),
			StatusCode: 500,
			Details: map[string]interface{}{"serviceName": serviceName, "path": path},
		}
	}
	return nil, &CircuitClientError{Code: "UNKNOWN_ERROR", Message: "unknown error", StatusCode: 500}
}

func (sc *CircuitServiceClient) executeRequest(ctx context.Context, baseURL, path string, opts ServiceRequestOptions, requestID string) (*ServiceResponse, error) {
	url := baseURL + path

	method := opts.Method
	if method == "" {
		method = "GET"
	}

	var bodyReader io.Reader
	if opts.Body != nil {
		bodyBytes, err := json.Marshal(opts.Body)
		if err != nil {
			return nil, &CircuitClientError{Code: "SERIALIZE_ERROR", Message: err.Error(), StatusCode: 500}
		}
		bodyReader = bytes.NewReader(bodyBytes)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return nil, &CircuitClientError{Code: "REQUEST_FAILED", Message: err.Error(), StatusCode: 502}
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Request-ID", requestID)
	for k, v := range opts.Headers {
		if k != "Content-Type" && k != "X-Request-ID" {
			req.Header.Set(k, v)
		}
	}

	resp, err := sc.httpClient.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return nil, &CircuitClientError{Code: "TIMEOUT", Message: "request timeout", StatusCode: 504}
		}
		return nil, &CircuitClientError{Code: "REQUEST_FAILED", Message: err.Error(), StatusCode: 502}
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, &CircuitClientError{Code: "READ_ERROR", Message: err.Error(), StatusCode: 502}
	}

	respHeaders := make(map[string]string)
	for k, v := range resp.Header {
		if len(v) > 0 {
			respHeaders[k] = v[0]
		}
	}

	if resp.StatusCode >= 400 {
		return nil, &CircuitClientError{
			Code:       mapStatusCodeToError(resp.StatusCode),
			Message:    fmt.Sprintf("service returned status %d", resp.StatusCode),
			StatusCode: resp.StatusCode,
			Details:    data,
		}
	}

	return &ServiceResponse{
		Status:    resp.StatusCode,
		Data:      data,
		Headers:   respHeaders,
		RequestID: requestID,
	}, nil
}

// Get sends a GET request to a service.
func (sc *CircuitServiceClient) Get(ctx context.Context, serviceName, path string, opts ServiceRequestOptions) (*ServiceResponse, error) {
	opts.Method = "GET"
	return sc.Request(ctx, serviceName, path, opts)
}

// Post sends a POST request to a service.
func (sc *CircuitServiceClient) Post(ctx context.Context, serviceName, path string, body interface{}, opts ServiceRequestOptions) (*ServiceResponse, error) {
	opts.Method = "POST"
	opts.Body = body
	return sc.Request(ctx, serviceName, path, opts)
}

// Put sends a PUT request to a service.
func (sc *CircuitServiceClient) Put(ctx context.Context, serviceName, path string, body interface{}, opts ServiceRequestOptions) (*ServiceResponse, error) {
	opts.Method = "PUT"
	opts.Body = body
	return sc.Request(ctx, serviceName, path, opts)
}

// Delete sends a DELETE request to a service.
func (sc *CircuitServiceClient) Delete(ctx context.Context, serviceName, path string, opts ServiceRequestOptions) (*ServiceResponse, error) {
	opts.Method = "DELETE"
	return sc.Request(ctx, serviceName, path, opts)
}

// GetCircuitState returns the circuit breaker state for a service.
func (sc *CircuitServiceClient) GetCircuitState(serviceName string) CircuitState {
	sc.breakersMu.RLock()
	b, ok := sc.breakers[serviceName]
	sc.breakersMu.RUnlock()
	if !ok {
		return CircuitClosed
	}
	return b.getState()
}

// ResetCircuit manually resets a service's circuit breaker.
func (sc *CircuitServiceClient) ResetCircuit(serviceName string) {
	sc.breakersMu.Lock()
	defer sc.breakersMu.Unlock()
	if b, ok := sc.breakers[serviceName]; ok {
		b.reset()
	}
}

// --- helpers ---

func isRetryableError(err error) bool {
	scErr, ok := err.(*CircuitClientError)
	if !ok {
		return false
	}
	retryableCodes := map[string]bool{"TIMEOUT": true, "REQUEST_FAILED": true}
	retryableStatus := map[int]bool{502: true, 503: true, 504: true}
	return retryableCodes[scErr.Code] || retryableStatus[scErr.StatusCode]
}

func mapStatusCodeToError(status int) string {
	statusMap := map[int]string{
		400: "BAD_REQUEST",
		401: "UNAUTHORIZED",
		403: "FORBIDDEN",
		404: "NOT_FOUND",
		408: "REQUEST_TIMEOUT",
		429: "RATE_LIMITED",
		500: "INTERNAL_ERROR",
		502: "BAD_GATEWAY",
		503: "SERVICE_UNAVAILABLE",
		504: "GATEWAY_TIMEOUT",
	}
	if code, ok := statusMap[status]; ok {
		return code
	}
	return "HTTP_ERROR"
}

func calculateBackoff(attempt int) time.Duration {
	baseDelay := 1 * time.Second
	maxDelay := 30 * time.Second
	delay := baseDelay * time.Duration(1<<uint(attempt))
	if delay > maxDelay {
		return maxDelay
	}
	return delay
}

func generateRequestID() string {
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	return "req_" + strconv.FormatInt(time.Now().Unix(), 10) + "_" + hex.EncodeToString(b)
}
