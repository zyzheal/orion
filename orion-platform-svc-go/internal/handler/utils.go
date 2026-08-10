package handler

import (
    "fmt"
    "strings"
    "sync"
    "time"
)

type GenericHandlerStatus string

const (
    GenericHandlerStatusPending   GenericHandlerStatus = "pending"
    GenericHandlerStatusActive    GenericHandlerStatus = "active"
    GenericHandlerStatusCompleted GenericHandlerStatus = "completed"
    GenericHandlerStatusFailed    GenericHandlerStatus = "failed"
    GenericHandlerStatusCancelled GenericHandlerStatus = "cancelled"
)

type GenericHandlerState struct {
    mu        sync.RWMutex
    items     map[string]*GenericHandlerEntry
    createdAt time.Time
}

type GenericHandlerEntry struct {
    ID        string
    Name      string
    Status    GenericHandlerStatus
    CreatedAt time.Time
    UpdatedAt time.Time
    Metadata  map[string]string
}

type GenericHandlerOptions struct {
    Timeout     time.Duration
    MaxRetries  int
    BatchSize   int
    EnableCache bool
    Labels      map[string]string
}

type GenericHandlerStats struct {
    Total     int64
    Active    int64
    Failed    int64
    Completed int64
}

func NewGenericHandlerState() *GenericHandlerState {
    return &GenericHandlerState{
        items:     make(map[string]*GenericHandlerEntry),
        createdAt: time.Now(),
    }
}

func DefaultGenericHandlerOptions() *GenericHandlerOptions {
    return &GenericHandlerOptions{
        Timeout:     30 * time.Second,
        MaxRetries:  3,
        BatchSize:   100,
        EnableCache: true,
        Labels:      make(map[string]string),
    }
}

func (s *GenericHandlerState) Add(id, name string, status GenericHandlerStatus) *GenericHandlerEntry {
    s.mu.Lock()
    defer s.mu.Unlock()
    entry := &GenericHandlerEntry{
        ID:        id,
        Name:      name,
        Status:    status,
        CreatedAt: time.Now(),
        UpdatedAt: time.Now(),
        Metadata:  make(map[string]string),
    }
    s.items[id] = entry
    return entry
}

func (s *GenericHandlerState) Get(id string) (*GenericHandlerEntry, bool) {
    s.mu.RLock()
    defer s.mu.RUnlock()
    entry, ok := s.items[id]
    return entry, ok
}

func (s *GenericHandlerState) Remove(id string) bool {
    s.mu.Lock()
    defer s.mu.Unlock()
    _, ok := s.items[id]
    if ok {
        delete(s.items, id)
    }
    return ok
}

func (s *GenericHandlerState) List() []*GenericHandlerEntry {
    s.mu.RLock()
    defer s.mu.RUnlock()
    entries := make([]*GenericHandlerEntry, 0, len(s.items))
    for _, e := range s.items {
        entries = append(entries, e)
    }
    return entries
}

func (s *GenericHandlerState) Count() int {
    s.mu.RLock()
    defer s.mu.RUnlock()
    return len(s.items)
}

func (s *GenericHandlerState) UpdateStatus(id string, status GenericHandlerStatus) error {
    s.mu.Lock()
    defer s.mu.Unlock()
    entry, ok := s.items[id]
    if !ok {
        return fmt.Errorf("handler: item not found: %s", id)
    }
    entry.Status = status
    entry.UpdatedAt = time.Now()
    return nil
}

func (s *GenericHandlerState) UpdateMetadata(id, key, value string) error {
    s.mu.Lock()
    defer s.mu.Unlock()
    entry, ok := s.items[id]
    if !ok {
        return fmt.Errorf("handler: item not found: %s", id)
    }
    entry.Metadata[key] = value
    return nil
}

func (s *GenericHandlerState) GetStats() GenericHandlerStats {
    s.mu.RLock()
    defer s.mu.RUnlock()
    var stats GenericHandlerStats
    stats.Total = int64(len(s.items))
    for _, e := range s.items {
        switch e.Status {
        case GenericHandlerStatusActive:
            stats.Active++
        case GenericHandlerStatusFailed:
            stats.Failed++
        case GenericHandlerStatusCompleted:
            stats.Completed++
        }
    }
    return stats
}

func (s *GenericHandlerState) FilterByStatus(status GenericHandlerStatus) []*GenericHandlerEntry {
    s.mu.RLock()
    defer s.mu.RUnlock()
    result := make([]*GenericHandlerEntry, 0)
    for _, e := range s.items {
        if e.Status == status {
            result = append(result, e)
        }
    }
    return result
}

func (s *GenericHandlerState) FilterByNamePrefix(prefix string) []*GenericHandlerEntry {
    s.mu.RLock()
    defer s.mu.RUnlock()
    result := make([]*GenericHandlerEntry, 0)
    for _, e := range s.items {
        if strings.HasPrefix(e.Name, prefix) {
            result = append(result, e)
        }
    }
    return result
}

func (s *GenericHandlerState) Clear() {
    s.mu.Lock()
    defer s.mu.Unlock()
    s.items = make(map[string]*GenericHandlerEntry)
}

func (s *GenericHandlerState) Contains(id string) bool {
    s.mu.RLock()
    defer s.mu.RUnlock()
    _, ok := s.items[id]
    return ok
}

func (o *GenericHandlerOptions) Validate() error {
    if o.Timeout <= 0 {
        return fmt.Errorf("handler: timeout must be positive")
    }
    if o.MaxRetries < 0 {
        return fmt.Errorf("handler: max_retries cannot be negative")
    }
    if o.BatchSize <= 0 {
        return fmt.Errorf("handler: batch_size must be positive")
    }
    return nil
}

func (o *GenericHandlerOptions) Merge(other *GenericHandlerOptions) *GenericHandlerOptions {
    result := *o
    if other.Timeout > 0 { result.Timeout = other.Timeout }
    if other.MaxRetries > 0 { result.MaxRetries = other.MaxRetries }
    if other.BatchSize > 0 { result.BatchSize = other.BatchSize }
    if other.Labels != nil { result.Labels = other.Labels }
    return &result
}

func (e *GenericHandlerEntry) IsActive() bool {
    return e.Status == GenericHandlerStatusActive
}

func (e *GenericHandlerEntry) IsTerminal() bool {
    return e.Status == GenericHandlerStatusCompleted || e.Status == GenericHandlerStatusFailed || e.Status == GenericHandlerStatusCancelled
}

func (e *GenericHandlerEntry) Age() time.Duration {
    return time.Since(e.CreatedAt)
}

func FormatGenericHandlerID(prefix string, index int) string {
    return fmt.Sprintf("%s-%04d", prefix, index)
}
