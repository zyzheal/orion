package handler

import (
    "fmt"
    "strings"
    "sync"
    "time"
)

type AutoRecoveryStatus string

const (
    AutoRecoveryStatusActive   AutoRecoveryStatus = "active"
    AutoRecoveryStatusInactive AutoRecoveryStatus = "inactive"
    AutoRecoveryStatusPending  AutoRecoveryStatus = "pending"
    AutoRecoveryStatusFailed   AutoRecoveryStatus = "failed"
)

type AutoRecoveryConfig struct {
    Name        string
    Description string
    MaxRetries  int
    Timeout     time.Duration
    Enabled     bool
    Labels      map[string]string
}

type AutoRecoveryHelper struct {
    mu       sync.RWMutex
    configs  map[string]*AutoRecoveryConfig
    startedAt time.Time
}

func NewAutoRecoveryHelper() *AutoRecoveryHelper {
    return &AutoRecoveryHelper{
        configs:   make(map[string]*AutoRecoveryConfig),
        startedAt: time.Now(),
    }
}

func (h *AutoRecoveryHelper) RegisterConfig(name string, cfg *AutoRecoveryConfig) error {
    h.mu.Lock()
    defer h.mu.Unlock()
    if strings.TrimSpace(name) == "" {
        return fmt.Errorf("auto-recovery: config name is required")
    }
    h.configs[name] = cfg
    return nil
}

func (h *AutoRecoveryHelper) GetConfig(name string) (*AutoRecoveryConfig, bool) {
    h.mu.RLock()
    defer h.mu.RUnlock()
    cfg, ok := h.configs[name]
    return cfg, ok
}

func (h *AutoRecoveryHelper) RemoveConfig(name string) {
    h.mu.Lock()
    defer h.mu.Unlock()
    delete(h.configs, name)
}

func (h *AutoRecoveryHelper) ListConfigs() []string {
    h.mu.RLock()
    defer h.mu.RUnlock()
    names := make([]string, 0, len(h.configs))
    for n := range h.configs {
        names = append(names, n)
    }
    return names
}

func (h *AutoRecoveryHelper) Uptime() time.Duration {
    return time.Since(h.startedAt)
}

func (h *AutoRecoveryHelper) String() string {
    return fmt.Sprintf("AutoRecoveryHelper(configs=%d, uptime=%s)", len(h.configs), h.Uptime())
}
