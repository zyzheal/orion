// Package service provides shared service-layer components for the API Gateway.
package service

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// ServiceInfo describes a registered service.
type ServiceInfo struct {
	Name           string                 `json:"name"`
	URL            string                 `json:"url"`
	HealthURL      string                 `json:"healthUrl,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
	RegisteredAt   time.Time              `json:"registeredAt"`
	LastHeartbeat  time.Time              `json:"lastHeartbeat"`
	Status         string                 `json:"status"`
}

// ServiceRegistry tracks upstream services and their health.
type ServiceRegistry struct {
	mu                 sync.RWMutex
	services           map[string]*ServiceInfo
	heartbeatInterval  time.Duration
	healthCheckInterval time.Duration
	unhealthyThreshold  int
	stopChs            map[string]chan struct{}
}

// NewServiceRegistry creates a service registry.
func NewServiceRegistry() *ServiceRegistry {
	return &ServiceRegistry{
		services:            make(map[string]*ServiceInfo),
		heartbeatInterval:   30 * time.Second,
		healthCheckInterval: 60 * time.Second,
		unhealthyThreshold:  3,
		stopChs:            make(map[string]chan struct{}),
	}
}

// Register adds or updates a service.
func (r *ServiceRegistry) Register(name, url, healthURL string, metadata map[string]interface{}) *ServiceInfo {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	if existing, ok := r.services[name]; ok {
		existing.URL = url
		existing.HealthURL = healthURL
		existing.LastHeartbeat = now
		existing.Status = "healthy"
		if metadata != nil {
			existing.Metadata = metadata
		}
		return existing
	}

	svc := &ServiceInfo{
		Name:          name,
		URL:           url,
		HealthURL:     healthURL,
		Metadata:      metadata,
		RegisteredAt:  now,
		LastHeartbeat: now,
		Status:        "unknown",
	}
	r.services[name] = svc

	stopCh := make(chan struct{})
	r.stopChs[name] = stopCh
	go r.runHeartbeat(name, stopCh)
	go r.runHealthCheck(name, stopCh)

	return svc
}

// Unregister removes a service.
func (r *ServiceRegistry) Unregister(name string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if stopCh, ok := r.stopChs[name]; ok {
		close(stopCh)
		delete(r.stopChs, name)
	}
	delete(r.services, name)
}

// GetService returns a service by name.
func (r *ServiceRegistry) GetService(name string) *ServiceInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.services[name]
}

// GetAllServices returns all registered services.
func (r *ServiceRegistry) GetAllServices() []*ServiceInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]*ServiceInfo, 0, len(r.services))
	for _, s := range r.services {
		result = append(result, s)
	}
	return result
}

// GetHealthyServices returns services with healthy status.
func (r *ServiceRegistry) GetHealthyServices() []*ServiceInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []*ServiceInfo
	for _, s := range r.services {
		if s.Status == "healthy" {
			result = append(result, s)
		}
	}
	return result
}

// Heartbeat updates a service's heartbeat.
func (r *ServiceRegistry) Heartbeat(name string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if svc, ok := r.services[name]; ok {
		svc.LastHeartbeat = time.Now()
		svc.Status = "healthy"
	}
}

// Shutdown stops all background goroutines.
func (r *ServiceRegistry) Shutdown() {
	r.mu.Lock()
	defer r.mu.Unlock()
	for name, stopCh := range r.stopChs {
		close(stopCh)
		delete(r.stopChs, name)
	}
	r.services = make(map[string]*ServiceInfo)
}

func (r *ServiceRegistry) runHeartbeat(name string, stopCh <-chan struct{}) {
	ticker := time.NewTicker(r.heartbeatInterval)
	defer ticker.Stop()
	for {
		select {
		case <-stopCh:
			return
		case <-ticker.C:
			r.mu.RLock()
			svc, ok := r.services[name]
			r.mu.RUnlock()
			if !ok {
				return
			}
			since := time.Since(svc.LastHeartbeat)
			if since > r.heartbeatInterval*2 {
				svc.Status = "unhealthy"
			}
		}
	}
}

func (r *ServiceRegistry) runHealthCheck(name string, stopCh <-chan struct{}) {
	ticker := time.NewTicker(r.healthCheckInterval)
	defer ticker.Stop()
	client := &http.Client{Timeout: 5 * time.Second}
	for {
		select {
		case <-stopCh:
			return
		case <-ticker.C:
			r.mu.RLock()
			svc, ok := r.services[name]
			r.mu.RUnlock()
			if !ok || svc.HealthURL == "" {
				continue
			}
			resp, err := client.Get(svc.HealthURL)
			if err != nil {
				r.markUnhealthy(svc)
				continue
			}
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				svc.Status = "healthy"
				svc.LastHeartbeat = time.Now()
			} else {
				r.markUnhealthy(svc)
			}
		}
	}
}

func (r *ServiceRegistry) markUnhealthy(svc *ServiceInfo) {
	r.mu.Lock()
	defer r.mu.Unlock()
	fc := 0
	if svc.Metadata != nil {
		if v, ok := svc.Metadata["_failureCount"].(int); ok {
			fc = v
		}
	}
	fc++
	if svc.Metadata == nil {
		svc.Metadata = make(map[string]interface{})
	}
	svc.Metadata["_failureCount"] = fc
	if fc >= r.unhealthyThreshold {
		svc.Status = "unhealthy"
	}
}

// --- ServiceClient ---

// ServiceClient makes HTTP calls to upstream services with retries and timeouts.
type ServiceClient struct {
	httpClient *http.Client
	maxRetries int
}

// NewServiceClient creates a service client.
func NewServiceClient(timeout time.Duration, maxRetries int) *ServiceClient {
	if timeout == 0 {
		timeout = 10 * time.Second
	}
	if maxRetries < 0 {
		maxRetries = 0
	}
	return &ServiceClient{
		httpClient: &http.Client{Timeout: timeout},
		maxRetries: maxRetries,
	}
}

// Do executes an HTTP request with retry logic.
func (c *ServiceClient) Do(ctx context.Context, method, url string, headers map[string]string) (*http.Response, error) {
	var lastErr error
	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		req, err := http.NewRequestWithContext(ctx, method, url, nil)
		if err != nil {
			return nil, err
		}
		for k, v := range headers {
			req.Header.Set(k, v)
		}

		resp, err := c.httpClient.Do(req)
		if err == nil {
			return resp, nil
		}
		lastErr = err
		if attempt < c.maxRetries {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(time.Duration(attempt+1) * 500 * time.Millisecond):
			}
		}
	}
	return nil, fmt.Errorf("after %d retries: %w", c.maxRetries, lastErr)
}
