package handler

import (
    "fmt"
    "strings"
    "sync"
    "time"
)

type TaskExecutorStatus string

const (
    TaskExecutorStatusActive   TaskExecutorStatus = "active"
    TaskExecutorStatusInactive TaskExecutorStatus = "inactive"
    TaskExecutorStatusPending  TaskExecutorStatus = "pending"
    TaskExecutorStatusFailed   TaskExecutorStatus = "failed"
)

type TaskExecutorConfig struct {
    Name        string
    Description string
    MaxRetries  int
    Timeout     time.Duration
    Enabled     bool
    Labels      map[string]string
}

type TaskExecutorHelper struct {
    mu       sync.RWMutex
    configs  map[string]*TaskExecutorConfig
    startedAt time.Time
}

func NewTaskExecutorHelper() *TaskExecutorHelper {
    return &TaskExecutorHelper{
        configs:   make(map[string]*TaskExecutorConfig),
        startedAt: time.Now(),
    }
}

func (h *TaskExecutorHelper) RegisterConfig(name string, cfg *TaskExecutorConfig) error {
    h.mu.Lock()
    defer h.mu.Unlock()
    if strings.TrimSpace(name) == "" {
        return fmt.Errorf("task-executor: config name is required")
    }
    h.configs[name] = cfg
    return nil
}

func (h *TaskExecutorHelper) GetConfig(name string) (*TaskExecutorConfig, bool) {
    h.mu.RLock()
    defer h.mu.RUnlock()
    cfg, ok := h.configs[name]
    return cfg, ok
}

func (h *TaskExecutorHelper) RemoveConfig(name string) {
    h.mu.Lock()
    defer h.mu.Unlock()
    delete(h.configs, name)
}

func (h *TaskExecutorHelper) ListConfigs() []string {
    h.mu.RLock()
    defer h.mu.RUnlock()
    names := make([]string, 0, len(h.configs))
    for n := range h.configs {
        names = append(names, n)
    }
    return names
}

func (h *TaskExecutorHelper) Uptime() time.Duration {
    return time.Since(h.startedAt)
}

func (h *TaskExecutorHelper) String() string {
    return fmt.Sprintf("TaskExecutorHelper(configs=%d, uptime=%s)", len(h.configs), h.Uptime())
}
