package mlops

import (
    "fmt"
    "strings"
    "sync"
    "time"
)

type MlopsStatus string

const (
    MlopsStatusActive   MlopsStatus = "active"
    MlopsStatusInactive MlopsStatus = "inactive"
    MlopsStatusPending  MlopsStatus = "pending"
    MlopsStatusFailed   MlopsStatus = "failed"
)

type MlopsConfig struct {
    Name        string
    Description string
    MaxRetries  int
    Timeout     time.Duration
    Enabled     bool
    Labels      map[string]string
}

type MlopsHelper struct {
    mu       sync.RWMutex
    configs  map[string]*MlopsConfig
    startedAt time.Time
}

func NewMlopsHelper() *MlopsHelper {
    return &MlopsHelper{
        configs:   make(map[string]*MlopsConfig),
        startedAt: time.Now(),
    }
}

func (h *MlopsHelper) RegisterConfig(name string, cfg *MlopsConfig) error {
    h.mu.Lock()
    defer h.mu.Unlock()
    if strings.TrimSpace(name) == "" {
        return fmt.Errorf("mlops: config name is required")
    }
    h.configs[name] = cfg
    return nil
}

func (h *MlopsHelper) GetConfig(name string) (*MlopsConfig, bool) {
    h.mu.RLock()
    defer h.mu.RUnlock()
    cfg, ok := h.configs[name]
    return cfg, ok
}

func (h *MlopsHelper) RemoveConfig(name string) {
    h.mu.Lock()
    defer h.mu.Unlock()
    delete(h.configs, name)
}

func (h *MlopsHelper) ListConfigs() []string {
    h.mu.RLock()
    defer h.mu.RUnlock()
    names := make([]string, 0, len(h.configs))
    for n := range h.configs {
        names = append(names, n)
    }
    return names
}

func (h *MlopsHelper) Uptime() time.Duration {
    return time.Since(h.startedAt)
}

func (h *MlopsHelper) String() string {
    return fmt.Sprintf("MlopsHelper(configs=%d, uptime=%s)", len(h.configs), h.Uptime())
}
