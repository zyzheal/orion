package service

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestCircuitBreaker_ClosedAllowsRequests(t *testing.T) {
	cb := newCircuitBreaker(3, 30*time.Second)
	if !cb.canRequest() {
		t.Error("CLOSED state should allow requests")
	}
}

func TestCircuitBreaker_OpenAfterThreshold(t *testing.T) {
	cb := newCircuitBreaker(3, 30*time.Second)
	for i := 0; i < 3; i++ {
		cb.recordFailure()
	}
	if cb.getState() != CircuitOpen {
		t.Errorf("expected OPEN, got %s", cb.getState())
	}
	if cb.canRequest() {
		t.Error("OPEN state should reject requests")
	}
}

func TestCircuitBreaker_HalfOpenAfterTimeout(t *testing.T) {
	cb := newCircuitBreaker(3, 100*time.Millisecond)
	for i := 0; i < 3; i++ {
		cb.recordFailure()
	}
	time.Sleep(150 * time.Millisecond)
	if !cb.canRequest() {
		t.Error("HALF_OPEN should allow probe requests")
	}
	if cb.getState() != CircuitHalfOpen {
		t.Errorf("expected HALF_OPEN, got %s", cb.getState())
	}
}

func TestCircuitBreaker_ClosedAfterSuccess(t *testing.T) {
	cb := newCircuitBreaker(3, 100*time.Millisecond)
	for i := 0; i < 3; i++ {
		cb.recordFailure()
	}
	time.Sleep(150 * time.Millisecond)
	_ = cb.canRequest()
	cb.recordSuccess()
	if cb.getState() != CircuitClosed {
		t.Errorf("expected CLOSED after success, got %s", cb.getState())
	}
}

func TestCircuitBreaker_OpenAfterHalfOpenFailure(t *testing.T) {
	cb := newCircuitBreaker(3, 100*time.Millisecond)
	for i := 0; i < 3; i++ {
		cb.recordFailure()
	}
	time.Sleep(150 * time.Millisecond)
	_ = cb.canRequest()
	cb.recordFailure()
	if cb.getState() != CircuitOpen {
		t.Errorf("expected OPEN after HALF_OPEN failure, got %s", cb.getState())
	}
}

func TestCircuitBreaker_Reset(t *testing.T) {
	cb := newCircuitBreaker(3, 30*time.Second)
	for i := 0; i < 3; i++ {
		cb.recordFailure()
	}
	cb.reset()
	if cb.getState() != CircuitClosed {
		t.Errorf("expected CLOSED after reset, got %s", cb.getState())
	}
}

func TestCalculateBackoff(t *testing.T) {
	tests := []struct {
		attempt  int
		expected time.Duration
	}{
		{0, 1 * time.Second},
		{1, 2 * time.Second},
		{2, 4 * time.Second},
		{3, 8 * time.Second},
		{4, 16 * time.Second},
		{5, 30 * time.Second},
		{10, 30 * time.Second},
	}
	for _, tt := range tests {
		got := calculateBackoff(tt.attempt)
		if got != tt.expected {
			t.Errorf("attempt=%d: expected %v, got %v", tt.attempt, tt.expected, got)
		}
	}
}

func TestIsRetryableError(t *testing.T) {
	retryable := &CircuitClientError{Code: "TIMEOUT", StatusCode: 504}
	if !isRetryableError(retryable) {
		t.Error("TIMEOUT should be retryable")
	}
	notRetryable := &CircuitClientError{Code: "BAD_REQUEST", StatusCode: 400}
	if isRetryableError(notRetryable) {
		t.Error("BAD_REQUEST should not be retryable")
	}
	retryable503 := &CircuitClientError{Code: "SERVICE_UNAVAILABLE", StatusCode: 503}
	if !isRetryableError(retryable503) {
		t.Error("SERVICE_UNAVAILABLE should be retryable")
	}
	if isRetryableError(fmt.Errorf("plain error")) {
		t.Error("plain error should not be retryable")
	}
}

func TestMapStatusCodeToError(t *testing.T) {
	tests := map[int]string{
		400: "BAD_REQUEST", 401: "UNAUTHORIZED", 403: "FORBIDDEN",
		404: "NOT_FOUND", 500: "INTERNAL_ERROR", 502: "BAD_GATEWAY",
		503: "SERVICE_UNAVAILABLE", 504: "GATEWAY_TIMEOUT", 999: "HTTP_ERROR",
	}
	for status, expected := range tests {
		got := mapStatusCodeToError(status)
		if got != expected {
			t.Errorf("status %d: expected %s, got %s", status, expected, got)
		}
	}
}

func TestGenerateRequestID(t *testing.T) {
	id1 := generateRequestID()
	id2 := generateRequestID()
	if id1 == id2 {
		t.Error("request IDs should be unique")
	}
	if len(id1) < 10 {
		t.Errorf("request ID too short: %s", id1)
	}
}

func TestCircuitServiceClient_RequestSuccess(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ok":true}`))
	}))
	defer server.Close()

	client := NewCircuitServiceClient(map[string]ServiceRouteConfig{
		"test-svc": {BaseURL: server.URL, Timeout: 5 * time.Second, Retries: 0,
			CircuitBreakerThreshold: 5, CircuitBreakerResetTimeout: 30 * time.Second},
	})

	resp, err := client.Request(context.Background(), "test-svc", "/health", ServiceRequestOptions{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Status != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.Status)
	}
}

func TestCircuitServiceClient_ServiceNotFound(t *testing.T) {
	client := NewCircuitServiceClient(map[string]ServiceRouteConfig{})
	_, err := client.Request(context.Background(), "nonexistent", "/test", ServiceRequestOptions{})
	if err == nil {
		t.Fatal("expected error for nonexistent service")
	}
	if scErr, ok := err.(*CircuitClientError); ok {
		if scErr.Code != "SERVICE_NOT_FOUND" {
			t.Errorf("expected SERVICE_NOT_FOUND, got %s", scErr.Code)
		}
	}
}

func TestCircuitServiceClient_CircuitOpen(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := NewCircuitServiceClient(map[string]ServiceRouteConfig{
		"test-svc": {BaseURL: server.URL, Timeout: 5 * time.Second, Retries: 0,
			CircuitBreakerThreshold: 2, CircuitBreakerResetTimeout: 30 * time.Second},
	})

	for i := 0; i < 2; i++ {
		_, _ = client.Request(context.Background(), "test-svc", "/fail", ServiceRequestOptions{SkipRetry: true})
	}
	if client.GetCircuitState("test-svc") != CircuitOpen {
		t.Errorf("expected OPEN, got %s", client.GetCircuitState("test-svc"))
	}

	_, err := client.Request(context.Background(), "test-svc", "/test", ServiceRequestOptions{SkipRetry: true})
	if scErr, ok := err.(*CircuitClientError); ok {
		if scErr.Code != "CIRCUIT_OPEN" {
			t.Errorf("expected CIRCUIT_OPEN, got %s", scErr.Code)
		}
	} else {
		t.Fatalf("expected CircuitClientError, got %T: %v", err, err)
	}
}

func TestCircuitServiceClient_RetryOnFailure(t *testing.T) {
	var callCount int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := atomic.AddInt32(&callCount, 1)
		if n < 3 {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ok":true}`))
	}))
	defer server.Close()

	client := NewCircuitServiceClient(map[string]ServiceRouteConfig{
		"test-svc": {BaseURL: server.URL, Timeout: 5 * time.Second, Retries: 3,
			CircuitBreakerThreshold: 5, CircuitBreakerResetTimeout: 30 * time.Second},
	})

	resp, err := client.Request(context.Background(), "test-svc", "/test", ServiceRequestOptions{Timeout: 1 * time.Second})
	if err != nil {
		t.Fatalf("expected success after retry, got error: %v", err)
	}
	if resp.Status != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.Status)
	}
	if atomic.LoadInt32(&callCount) != 3 {
		t.Errorf("expected 3 calls, got %d", callCount)
	}
}

func TestCircuitServiceClient_ResetCircuit(t *testing.T) {
	client := NewCircuitServiceClient(map[string]ServiceRouteConfig{
		"test-svc": {BaseURL: "http://localhost:9999", Timeout: 5 * time.Second, Retries: 0,
			CircuitBreakerThreshold: 2, CircuitBreakerResetTimeout: 30 * time.Second},
	})

	for i := 0; i < 2; i++ {
		_, _ = client.Request(context.Background(), "test-svc", "/test", ServiceRequestOptions{SkipRetry: true})
	}
	if client.GetCircuitState("test-svc") != CircuitOpen {
		t.Fatalf("expected OPEN, got %s", client.GetCircuitState("test-svc"))
	}

	client.ResetCircuit("test-svc")
	if client.GetCircuitState("test-svc") != CircuitClosed {
		t.Errorf("expected CLOSED after reset, got %s", client.GetCircuitState("test-svc"))
	}
}

func TestServiceClient_ConcurrentSafety(t *testing.T) {
	var callCount int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&callCount, 1)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := NewCircuitServiceClient(map[string]ServiceRouteConfig{
		"test-svc": {BaseURL: server.URL, Timeout: 5 * time.Second, Retries: 0,
			CircuitBreakerThreshold: 10, CircuitBreakerResetTimeout: 30 * time.Second},
	})

	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _ = client.Request(context.Background(), "test-svc", "/test", ServiceRequestOptions{})
		}()
	}
	wg.Wait()

	if atomic.LoadInt32(&callCount) != 100 {
		t.Errorf("expected 100 calls, got %d", callCount)
	}
}

func TestCircuitBreaker_ConcurrentAccess(t *testing.T) {
	cb := newCircuitBreaker(10, 30*time.Second)
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			if n%2 == 0 {
				cb.recordSuccess()
			} else {
				cb.recordFailure()
			}
		}(i)
	}
	wg.Wait()
	_ = cb.getState()
}
