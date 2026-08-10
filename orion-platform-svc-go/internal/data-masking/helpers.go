package datamasking

import (
    "fmt"
    "strings"
    "sync"
    "time"
)

type DataMaskingStatus string

const (
    DataMaskingStatusActive   DataMaskingStatus = "active"
    DataMaskingStatusInactive DataMaskingStatus = "inactive"
    DataMaskingStatusPending  DataMaskingStatus = "pending"
    DataMaskingStatusFailed   DataMaskingStatus = "failed"
)

type DataMaskingConfig struct {
    Name        string
    Description string
    MaxRetries  int
    Timeout     time.Duration
    Enabled     bool
    Labels      map[string]string
}

type DataMaskingHelper struct {
    mu       sync.RWMutex
    configs  map[string]*DataMaskingConfig
    startedAt time.Time
}

func NewDataMaskingHelper() *DataMaskingHelper {
    return &DataMaskingHelper{
        configs:   make(map[string]*DataMaskingConfig),
        startedAt: time.Now(),
    }
}

func (h *DataMaskingHelper) RegisterConfig(name string, cfg *DataMaskingConfig) error {
    h.mu.Lock()
    defer h.mu.Unlock()
    if strings.TrimSpace(name) == "" {
        return fmt.Errorf("data-masking: config name is required")
    }
    h.configs[name] = cfg
    return nil
}

func (h *DataMaskingHelper) GetConfig(name string) (*DataMaskingConfig, bool) {
    h.mu.RLock()
    defer h.mu.RUnlock()
    cfg, ok := h.configs[name]
    return cfg, ok
}

func (h *DataMaskingHelper) RemoveConfig(name string) {
    h.mu.Lock()
    defer h.mu.Unlock()
    delete(h.configs, name)
}

func (h *DataMaskingHelper) ListConfigs() []string {
    h.mu.RLock()
    defer h.mu.RUnlock()
    names := make([]string, 0, len(h.configs))
    for n := range h.configs {
        names = append(names, n)
    }
    return names
}

func (h *DataMaskingHelper) Uptime() time.Duration {
    return time.Since(h.startedAt)
}

func (h *DataMaskingHelper) String() string {
    return fmt.Sprintf("DataMaskingHelper(configs=%d, uptime=%s)", len(h.configs), h.Uptime())
}
