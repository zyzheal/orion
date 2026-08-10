package inspection

import (
    "fmt"
    "strings"
    "sync"
    "time"
)

type InspectionStatus string

const (
    InspectionStatusActive   InspectionStatus = "active"
    InspectionStatusInactive InspectionStatus = "inactive"
    InspectionStatusPending  InspectionStatus = "pending"
    InspectionStatusFailed   InspectionStatus = "failed"
)

type InspectionConfig struct {
    Name        string
    Description string
    MaxRetries  int
    Timeout     time.Duration
    Enabled     bool
    Labels      map[string]string
}

type InspectionHelper struct {
    mu       sync.RWMutex
    configs  map[string]*InspectionConfig
    startedAt time.Time
}

func NewInspectionHelper() *InspectionHelper {
    return &InspectionHelper{
        configs:   make(map[string]*InspectionConfig),
        startedAt: time.Now(),
    }
}

func (h *InspectionHelper) RegisterConfig(name string, cfg *InspectionConfig) error {
    h.mu.Lock()
    defer h.mu.Unlock()
    if strings.TrimSpace(name) == "" {
        return fmt.Errorf("inspection: config name is required")
    }
    h.configs[name] = cfg
    return nil
}

func (h *InspectionHelper) GetConfig(name string) (*InspectionConfig, bool) {
    h.mu.RLock()
    defer h.mu.RUnlock()
    cfg, ok := h.configs[name]
    return cfg, ok
}

func (h *InspectionHelper) RemoveConfig(name string) {
    h.mu.Lock()
    defer h.mu.Unlock()
    delete(h.configs, name)
}

func (h *InspectionHelper) ListConfigs() []string {
    h.mu.RLock()
    defer h.mu.RUnlock()
    names := make([]string, 0, len(h.configs))
    for n := range h.configs {
        names = append(names, n)
    }
    return names
}

func (h *InspectionHelper) Uptime() time.Duration {
    return time.Since(h.startedAt)
}

func (h *InspectionHelper) String() string {
    return fmt.Sprintf("InspectionHelper(configs=%d, uptime=%s)", len(h.configs), h.Uptime())
}
