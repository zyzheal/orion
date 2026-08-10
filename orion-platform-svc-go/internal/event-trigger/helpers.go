package eventtrigger

import (
    "fmt"
    "strings"
    "sync"
    "time"
)

type EventTriggerStatus string

const (
    EventTriggerStatusActive   EventTriggerStatus = "active"
    EventTriggerStatusInactive EventTriggerStatus = "inactive"
    EventTriggerStatusPending  EventTriggerStatus = "pending"
    EventTriggerStatusFailed   EventTriggerStatus = "failed"
)

type EventTriggerConfig struct {
    Name        string
    Description string
    MaxRetries  int
    Timeout     time.Duration
    Enabled     bool
    Labels      map[string]string
}

type EventTriggerHelper struct {
    mu       sync.RWMutex
    configs  map[string]*EventTriggerConfig
    startedAt time.Time
}

func NewEventTriggerHelper() *EventTriggerHelper {
    return &EventTriggerHelper{
        configs:   make(map[string]*EventTriggerConfig),
        startedAt: time.Now(),
    }
}

func (h *EventTriggerHelper) RegisterConfig(name string, cfg *EventTriggerConfig) error {
    h.mu.Lock()
    defer h.mu.Unlock()
    if strings.TrimSpace(name) == "" {
        return fmt.Errorf("event-trigger: config name is required")
    }
    h.configs[name] = cfg
    return nil
}

func (h *EventTriggerHelper) GetConfig(name string) (*EventTriggerConfig, bool) {
    h.mu.RLock()
    defer h.mu.RUnlock()
    cfg, ok := h.configs[name]
    return cfg, ok
}

func (h *EventTriggerHelper) RemoveConfig(name string) {
    h.mu.Lock()
    defer h.mu.Unlock()
    delete(h.configs, name)
}

func (h *EventTriggerHelper) ListConfigs() []string {
    h.mu.RLock()
    defer h.mu.RUnlock()
    names := make([]string, 0, len(h.configs))
    for n := range h.configs {
        names = append(names, n)
    }
    return names
}

func (h *EventTriggerHelper) Uptime() time.Duration {
    return time.Since(h.startedAt)
}

func (h *EventTriggerHelper) String() string {
    return fmt.Sprintf("EventTriggerHelper(configs=%d, uptime=%s)", len(h.configs), h.Uptime())
}
