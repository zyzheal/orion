package incidentaction

import (
    "fmt"
    "strings"
    "sync"
    "time"
)

type IncidentActionStatus string

const (
    IncidentActionStatusActive   IncidentActionStatus = "active"
    IncidentActionStatusInactive IncidentActionStatus = "inactive"
    IncidentActionStatusPending  IncidentActionStatus = "pending"
    IncidentActionStatusFailed   IncidentActionStatus = "failed"
)

type IncidentActionConfig struct {
    Name        string
    Description string
    MaxRetries  int
    Timeout     time.Duration
    Enabled     bool
    Labels      map[string]string
}

type IncidentActionHelper struct {
    mu       sync.RWMutex
    configs  map[string]*IncidentActionConfig
    startedAt time.Time
}

func NewIncidentActionHelper() *IncidentActionHelper {
    return &IncidentActionHelper{
        configs:   make(map[string]*IncidentActionConfig),
        startedAt: time.Now(),
    }
}

func (h *IncidentActionHelper) RegisterConfig(name string, cfg *IncidentActionConfig) error {
    h.mu.Lock()
    defer h.mu.Unlock()
    if strings.TrimSpace(name) == "" {
        return fmt.Errorf("incident-action: config name is required")
    }
    h.configs[name] = cfg
    return nil
}

func (h *IncidentActionHelper) GetConfig(name string) (*IncidentActionConfig, bool) {
    h.mu.RLock()
    defer h.mu.RUnlock()
    cfg, ok := h.configs[name]
    return cfg, ok
}

func (h *IncidentActionHelper) RemoveConfig(name string) {
    h.mu.Lock()
    defer h.mu.Unlock()
    delete(h.configs, name)
}

func (h *IncidentActionHelper) ListConfigs() []string {
    h.mu.RLock()
    defer h.mu.RUnlock()
    names := make([]string, 0, len(h.configs))
    for n := range h.configs {
        names = append(names, n)
    }
    return names
}

func (h *IncidentActionHelper) Uptime() time.Duration {
    return time.Since(h.startedAt)
}

func (h *IncidentActionHelper) String() string {
    return fmt.Sprintf("IncidentActionHelper(configs=%d, uptime=%s)", len(h.configs), h.Uptime())
}
