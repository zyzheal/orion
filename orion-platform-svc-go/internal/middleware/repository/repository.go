package repository

import (
	"context"
	"sync"
	"time"
)

// Repository persists middleware configuration (rate limits, timeouts, tracing
// settings) per tenant so that settings survive process restarts.
type Repository struct {
	mu          sync.RWMutex
	configs     map[string]*TenantConfig
}

func NewRepository() *Repository {
	return &Repository{configs: make(map[string]*TenantConfig)}
}

type TenantConfig struct {
	DefaultTimeout time.Duration
	TracingEnabled bool
	RateLimits     map[string]*RateLimit
}

type RateLimit struct {
	RequestsPerMin int
	Burst          int
	Path           string
}

func (r *Repository) SaveConfig(ctx context.Context, tenantID string, cfg *TenantConfig) error {
	r.mu.Lock()
	r.configs[tenantID] = cfg
	r.mu.Unlock()
	return nil
}

func (r *Repository) GetConfig(ctx context.Context, tenantID string) (*TenantConfig, error) {
	r.mu.RLock()
	cfg, ok := r.configs[tenantID]
	r.mu.RUnlock()
	if !ok {
		return nil, nil
	}
	return cfg, nil
}

func (r *Repository) ListConfigs(ctx context.Context) []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	names := make([]string, 0, len(r.configs))
	for k := range r.configs {
		names = append(names, k)
	}
	return names
}

func (r *Repository) DeleteConfig(ctx context.Context, tenantID string) error {
	r.mu.Lock()
	delete(r.configs, tenantID)
	r.mu.Unlock()
	return nil
}

func (r *Repository) UpdateTimeout(ctx context.Context, tenantID string, timeout time.Duration) error {
	r.mu.Lock()
	if cfg, ok := r.configs[tenantID]; ok {
		cfg.DefaultTimeout = timeout
	} else {
		r.configs[tenantID] = &TenantConfig{DefaultTimeout: timeout, TracingEnabled: true}
	}
	r.mu.Unlock()
	return nil
}
