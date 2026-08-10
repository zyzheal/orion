package handler

import (
    "fmt"
    "strings"
    "sync"
    "time"
)

type OrchestrationStatus string

const (
    OrchestrationStatusActive   OrchestrationStatus = "active"
    OrchestrationStatusInactive OrchestrationStatus = "inactive"
    OrchestrationStatusPending  OrchestrationStatus = "pending"
    OrchestrationStatusFailed   OrchestrationStatus = "failed"
)

type OrchestrationConfig struct {
    Name        string
    Description string
    MaxRetries  int
    Timeout     time.Duration
    Enabled     bool
    Labels      map[string]string
}

type OrchestrationHelper struct {
    mu       sync.RWMutex
    configs  map[string]*OrchestrationConfig
    startedAt time.Time
}

func NewOrchestrationHelper() *OrchestrationHelper {
    return &OrchestrationHelper{
        configs:   make(map[string]*OrchestrationConfig),
        startedAt: time.Now(),
    }
}

func (h *OrchestrationHelper) RegisterConfig(name string, cfg *OrchestrationConfig) error {
    h.mu.Lock()
    defer h.mu.Unlock()
    if strings.TrimSpace(name) == "" {
        return fmt.Errorf("orchestration: config name is required")
    }
    h.configs[name] = cfg
    return nil
}

func (h *OrchestrationHelper) GetConfig(name string) (*OrchestrationConfig, bool) {
    h.mu.RLock()
    defer h.mu.RUnlock()
    cfg, ok := h.configs[name]
    return cfg, ok
}

func (h *OrchestrationHelper) RemoveConfig(name string) {
    h.mu.Lock()
    defer h.mu.Unlock()
    delete(h.configs, name)
}

func (h *OrchestrationHelper) ListConfigs() []string {
    h.mu.RLock()
    defer h.mu.RUnlock()
    names := make([]string, 0, len(h.configs))
    for n := range h.configs {
        names = append(names, n)
    }
    return names
}

func (h *OrchestrationHelper) Uptime() time.Duration {
    return time.Since(h.startedAt)
}

func (h *OrchestrationHelper) String() string {
    return fmt.Sprintf("OrchestrationHelper(configs=%d, uptime=%s)", len(h.configs), h.Uptime())
}
