package ticketautomation

import (
    "fmt"
    "strings"
    "sync"
    "time"
)

type TicketAutomationStatus string

const (
    TicketAutomationStatusActive   TicketAutomationStatus = "active"
    TicketAutomationStatusInactive TicketAutomationStatus = "inactive"
    TicketAutomationStatusPending  TicketAutomationStatus = "pending"
    TicketAutomationStatusFailed   TicketAutomationStatus = "failed"
)

type TicketAutomationConfig struct {
    Name        string
    Description string
    MaxRetries  int
    Timeout     time.Duration
    Enabled     bool
    Labels      map[string]string
}

type TicketAutomationHelper struct {
    mu       sync.RWMutex
    configs  map[string]*TicketAutomationConfig
    startedAt time.Time
}

func NewTicketAutomationHelper() *TicketAutomationHelper {
    return &TicketAutomationHelper{
        configs:   make(map[string]*TicketAutomationConfig),
        startedAt: time.Now(),
    }
}

func (h *TicketAutomationHelper) RegisterConfig(name string, cfg *TicketAutomationConfig) error {
    h.mu.Lock()
    defer h.mu.Unlock()
    if strings.TrimSpace(name) == "" {
        return fmt.Errorf("ticket-automation: config name is required")
    }
    h.configs[name] = cfg
    return nil
}

func (h *TicketAutomationHelper) GetConfig(name string) (*TicketAutomationConfig, bool) {
    h.mu.RLock()
    defer h.mu.RUnlock()
    cfg, ok := h.configs[name]
    return cfg, ok
}

func (h *TicketAutomationHelper) RemoveConfig(name string) {
    h.mu.Lock()
    defer h.mu.Unlock()
    delete(h.configs, name)
}

func (h *TicketAutomationHelper) ListConfigs() []string {
    h.mu.RLock()
    defer h.mu.RUnlock()
    names := make([]string, 0, len(h.configs))
    for n := range h.configs {
        names = append(names, n)
    }
    return names
}

func (h *TicketAutomationHelper) Uptime() time.Duration {
    return time.Since(h.startedAt)
}

func (h *TicketAutomationHelper) String() string {
    return fmt.Sprintf("TicketAutomationHelper(configs=%d, uptime=%s)", len(h.configs), h.Uptime())
}
