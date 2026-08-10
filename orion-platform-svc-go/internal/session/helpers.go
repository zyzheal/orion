package session

import (
    "fmt"
    "strings"
    "sync"
    "time"
)

type SessionStatus string

const (
    SessionStatusActive   SessionStatus = "active"
    SessionStatusInactive SessionStatus = "inactive"
    SessionStatusPending  SessionStatus = "pending"
    SessionStatusFailed   SessionStatus = "failed"
)

type SessionConfig struct {
    Name        string
    Description string
    MaxRetries  int
    Timeout     time.Duration
    Enabled     bool
    Labels      map[string]string
}

type SessionHelper struct {
    mu       sync.RWMutex
    configs  map[string]*SessionConfig
    startedAt time.Time
}

func NewSessionHelper() *SessionHelper {
    return &SessionHelper{
        configs:   make(map[string]*SessionConfig),
        startedAt: time.Now(),
    }
}

func (h *SessionHelper) RegisterConfig(name string, cfg *SessionConfig) error {
    h.mu.Lock()
    defer h.mu.Unlock()
    if strings.TrimSpace(name) == "" {
        return fmt.Errorf("session: config name is required")
    }
    h.configs[name] = cfg
    return nil
}

func (h *SessionHelper) GetConfig(name string) (*SessionConfig, bool) {
    h.mu.RLock()
    defer h.mu.RUnlock()
    cfg, ok := h.configs[name]
    return cfg, ok
}

func (h *SessionHelper) RemoveConfig(name string) {
    h.mu.Lock()
    defer h.mu.Unlock()
    delete(h.configs, name)
}

func (h *SessionHelper) ListConfigs() []string {
    h.mu.RLock()
    defer h.mu.RUnlock()
    names := make([]string, 0, len(h.configs))
    for n := range h.configs {
        names = append(names, n)
    }
    return names
}

func (h *SessionHelper) Uptime() time.Duration {
    return time.Since(h.startedAt)
}

func (h *SessionHelper) String() string {
    return fmt.Sprintf("SessionHelper(configs=%d, uptime=%s)", len(h.configs), h.Uptime())
}
