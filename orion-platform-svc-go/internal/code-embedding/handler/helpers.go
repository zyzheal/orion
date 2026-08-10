package handler

import (
    "fmt"
    "strings"
    "sync"
    "time"
)

type CodeEmbeddingStatus string

const (
    CodeEmbeddingStatusActive   CodeEmbeddingStatus = "active"
    CodeEmbeddingStatusInactive CodeEmbeddingStatus = "inactive"
    CodeEmbeddingStatusPending  CodeEmbeddingStatus = "pending"
    CodeEmbeddingStatusFailed   CodeEmbeddingStatus = "failed"
)

type CodeEmbeddingConfig struct {
    Name        string
    Description string
    MaxRetries  int
    Timeout     time.Duration
    Enabled     bool
    Labels      map[string]string
}

type CodeEmbeddingHelper struct {
    mu       sync.RWMutex
    configs  map[string]*CodeEmbeddingConfig
    startedAt time.Time
}

func NewCodeEmbeddingHelper() *CodeEmbeddingHelper {
    return &CodeEmbeddingHelper{
        configs:   make(map[string]*CodeEmbeddingConfig),
        startedAt: time.Now(),
    }
}

func (h *CodeEmbeddingHelper) RegisterConfig(name string, cfg *CodeEmbeddingConfig) error {
    h.mu.Lock()
    defer h.mu.Unlock()
    if strings.TrimSpace(name) == "" {
        return fmt.Errorf("code-embedding: config name is required")
    }
    h.configs[name] = cfg
    return nil
}

func (h *CodeEmbeddingHelper) GetConfig(name string) (*CodeEmbeddingConfig, bool) {
    h.mu.RLock()
    defer h.mu.RUnlock()
    cfg, ok := h.configs[name]
    return cfg, ok
}

func (h *CodeEmbeddingHelper) RemoveConfig(name string) {
    h.mu.Lock()
    defer h.mu.Unlock()
    delete(h.configs, name)
}

func (h *CodeEmbeddingHelper) ListConfigs() []string {
    h.mu.RLock()
    defer h.mu.RUnlock()
    names := make([]string, 0, len(h.configs))
    for n := range h.configs {
        names = append(names, n)
    }
    return names
}

func (h *CodeEmbeddingHelper) Uptime() time.Duration {
    return time.Since(h.startedAt)
}

func (h *CodeEmbeddingHelper) String() string {
    return fmt.Sprintf("CodeEmbeddingHelper(configs=%d, uptime=%s)", len(h.configs), h.Uptime())
}
