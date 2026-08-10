package module

import (
    "fmt"
    "strings"
    "sync"
    "time"
)

type ModuleStatus string

const (
    ModuleStatusActive   ModuleStatus = "active"
    ModuleStatusInactive ModuleStatus = "inactive"
    ModuleStatusPending  ModuleStatus = "pending"
    ModuleStatusFailed   ModuleStatus = "failed"
)

type ModuleConfig struct {
    Name        string
    Description string
    MaxRetries  int
    Timeout     time.Duration
    Enabled     bool
    Labels      map[string]string
}

type ModuleHelper struct {
    mu       sync.RWMutex
    configs  map[string]*ModuleConfig
    startedAt time.Time
}

func NewModuleHelper() *ModuleHelper {
    return &ModuleHelper{
        configs:   make(map[string]*ModuleConfig),
        startedAt: time.Now(),
    }
}

func (h *ModuleHelper) RegisterConfig(name string, cfg *ModuleConfig) error {
    h.mu.Lock()
    defer h.mu.Unlock()
    if strings.TrimSpace(name) == "" {
        return fmt.Errorf("module: config name is required")
    }
    h.configs[name] = cfg
    return nil
}

func (h *ModuleHelper) GetConfig(name string) (*ModuleConfig, bool) {
    h.mu.RLock()
    defer h.mu.RUnlock()
    cfg, ok := h.configs[name]
    return cfg, ok
}

func (h *ModuleHelper) RemoveConfig(name string) {
    h.mu.Lock()
    defer h.mu.Unlock()
    delete(h.configs, name)
}

func (h *ModuleHelper) ListConfigs() []string {
    h.mu.RLock()
    defer h.mu.RUnlock()
    names := make([]string, 0, len(h.configs))
    for n := range h.configs {
        names = append(names, n)
    }
    return names
}

func (h *ModuleHelper) Uptime() time.Duration {
    return time.Since(h.startedAt)
}

func (h *ModuleHelper) String() string {
    return fmt.Sprintf("ModuleHelper(configs=%d, uptime=%s)", len(h.configs), h.Uptime())
}
