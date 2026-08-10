package handler

import (
    "fmt"
    "strings"
    "sync"
    "time"
)

type SemanticSearchStatus string

const (
    SemanticSearchStatusActive   SemanticSearchStatus = "active"
    SemanticSearchStatusInactive SemanticSearchStatus = "inactive"
    SemanticSearchStatusPending  SemanticSearchStatus = "pending"
    SemanticSearchStatusFailed   SemanticSearchStatus = "failed"
)

type SemanticSearchConfig struct {
    Name        string
    Description string
    MaxRetries  int
    Timeout     time.Duration
    Enabled     bool
    Labels      map[string]string
}

type SemanticSearchHelper struct {
    mu       sync.RWMutex
    configs  map[string]*SemanticSearchConfig
    startedAt time.Time
}

func NewSemanticSearchHelper() *SemanticSearchHelper {
    return &SemanticSearchHelper{
        configs:   make(map[string]*SemanticSearchConfig),
        startedAt: time.Now(),
    }
}

func (h *SemanticSearchHelper) RegisterConfig(name string, cfg *SemanticSearchConfig) error {
    h.mu.Lock()
    defer h.mu.Unlock()
    if strings.TrimSpace(name) == "" {
        return fmt.Errorf("semantic-search: config name is required")
    }
    h.configs[name] = cfg
    return nil
}

func (h *SemanticSearchHelper) GetConfig(name string) (*SemanticSearchConfig, bool) {
    h.mu.RLock()
    defer h.mu.RUnlock()
    cfg, ok := h.configs[name]
    return cfg, ok
}

func (h *SemanticSearchHelper) RemoveConfig(name string) {
    h.mu.Lock()
    defer h.mu.Unlock()
    delete(h.configs, name)
}

func (h *SemanticSearchHelper) ListConfigs() []string {
    h.mu.RLock()
    defer h.mu.RUnlock()
    names := make([]string, 0, len(h.configs))
    for n := range h.configs {
        names = append(names, n)
    }
    return names
}

func (h *SemanticSearchHelper) Uptime() time.Duration {
    return time.Since(h.startedAt)
}

func (h *SemanticSearchHelper) String() string {
    return fmt.Sprintf("SemanticSearchHelper(configs=%d, uptime=%s)", len(h.configs), h.Uptime())
}
