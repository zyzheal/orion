package handler

import (
    "fmt"
    "strings"
    "sync"
    "time"
)

type CacheMonitorStatus string

const (
    CacheMonitorStatusActive   CacheMonitorStatus = "active"
    CacheMonitorStatusInactive CacheMonitorStatus = "inactive"
    CacheMonitorStatusPending  CacheMonitorStatus = "pending"
    CacheMonitorStatusFailed   CacheMonitorStatus = "failed"
)

type CacheMonitorConfig struct {
    Name        string
    Description string
    MaxRetries  int
    Timeout     time.Duration
    Enabled     bool
    Labels      map[string]string
}

type CacheMonitorHelper struct {
    mu       sync.RWMutex
    configs  map[string]*CacheMonitorConfig
    startedAt time.Time
}

func NewCacheMonitorHelper() *CacheMonitorHelper {
    return &CacheMonitorHelper{
        configs:   make(map[string]*CacheMonitorConfig),
        startedAt: time.Now(),
    }
}

func (h *CacheMonitorHelper) RegisterConfig(name string, cfg *CacheMonitorConfig) error {
    h.mu.Lock()
    defer h.mu.Unlock()
    if strings.TrimSpace(name) == "" {
        return fmt.Errorf("cache-monitor: config name is required")
    }
    h.configs[name] = cfg
    return nil
}

func (h *CacheMonitorHelper) GetConfig(name string) (*CacheMonitorConfig, bool) {
    h.mu.RLock()
    defer h.mu.RUnlock()
    cfg, ok := h.configs[name]
    return cfg, ok
}

func (h *CacheMonitorHelper) RemoveConfig(name string) {
    h.mu.Lock()
    defer h.mu.Unlock()
    delete(h.configs, name)
}

func (h *CacheMonitorHelper) ListConfigs() []string {
    h.mu.RLock()
    defer h.mu.RUnlock()
    names := make([]string, 0, len(h.configs))
    for n := range h.configs {
        names = append(names, n)
    }
    return names
}

func (h *CacheMonitorHelper) Uptime() time.Duration {
    return time.Since(h.startedAt)
}

func (h *CacheMonitorHelper) String() string {
    return fmt.Sprintf("CacheMonitorHelper(configs=%d, uptime=%s)", len(h.configs), h.Uptime())
}
