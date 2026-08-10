package tenantutil

import (
    "fmt"
    "strings"
    "sync"
    "time"
)

type TenantutilStatus string

const (
    TenantutilStatusPending   TenantutilStatus = "pending"
    TenantutilStatusActive    TenantutilStatus = "active"
    TenantutilStatusCompleted TenantutilStatus = "completed"
    TenantutilStatusFailed    TenantutilStatus = "failed"
    TenantutilStatusCancelled TenantutilStatus = "cancelled"
)

type TenantutilState struct {
    mu        sync.RWMutex
    items     map[string]*TenantutilEntry
    createdAt time.Time
}

type TenantutilEntry struct {
    ID        string
    Name      string
    Status    TenantutilStatus
    CreatedAt time.Time
    UpdatedAt time.Time
    Metadata  map[string]string
}

type TenantutilOptions struct {
    Timeout     time.Duration
    MaxRetries  int
    BatchSize   int
    EnableCache bool
    Labels      map[string]string
}

type TenantutilStats struct {
    Total     int64
    Active    int64
    Failed    int64
    Completed int64
}

func NewTenantutilState() *TenantutilState {
    return &TenantutilState{
        items:     make(map[string]*TenantutilEntry),
        createdAt: time.Now(),
    }
}

func DefaultTenantutilOptions() *TenantutilOptions {
    return &TenantutilOptions{
        Timeout:     30 * time.Second,
        MaxRetries:  3,
        BatchSize:   100,
        EnableCache: true,
        Labels:      make(map[string]string),
    }
}

func (s *TenantutilState) Add(id, name string, status TenantutilStatus) *TenantutilEntry {
    s.mu.Lock()
    defer s.mu.Unlock()
    entry := &TenantutilEntry{
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

func (s *TenantutilState) Get(id string) (*TenantutilEntry, bool) {
    s.mu.RLock()
    defer s.mu.RUnlock()
    entry, ok := s.items[id]
    return entry, ok
}

func (s *TenantutilState) Remove(id string) bool {
    s.mu.Lock()
    defer s.mu.Unlock()
    _, ok := s.items[id]
    if ok {
        delete(s.items, id)
    }
    return ok
}

func (s *TenantutilState) List() []*TenantutilEntry {
    s.mu.RLock()
    defer s.mu.RUnlock()
    entries := make([]*TenantutilEntry, 0, len(s.items))
    for _, e := range s.items {
        entries = append(entries, e)
    }
    return entries
}

func (s *TenantutilState) Count() int {
    s.mu.RLock()
    defer s.mu.RUnlock()
    return len(s.items)
}

func (s *TenantutilState) UpdateStatus(id string, status TenantutilStatus) error {
    s.mu.Lock()
    defer s.mu.Unlock()
    entry, ok := s.items[id]
    if !ok {
        return fmt.Errorf("tenantutil: item not found: %s", id)
    }
    entry.Status = status
    entry.UpdatedAt = time.Now()
    return nil
}

func (s *TenantutilState) UpdateMetadata(id, key, value string) error {
    s.mu.Lock()
    defer s.mu.Unlock()
    entry, ok := s.items[id]
    if !ok {
        return fmt.Errorf("tenantutil: item not found: %s", id)
    }
    entry.Metadata[key] = value
    return nil
}

func (s *TenantutilState) GetStats() TenantutilStats {
    s.mu.RLock()
    defer s.mu.RUnlock()
    var stats TenantutilStats
    stats.Total = int64(len(s.items))
    for _, e := range s.items {
        switch e.Status {
        case TenantutilStatusActive:
            stats.Active++
        case TenantutilStatusFailed:
            stats.Failed++
        case TenantutilStatusCompleted:
            stats.Completed++
        }
    }
    return stats
}

func (s *TenantutilState) FilterByStatus(status TenantutilStatus) []*TenantutilEntry {
    s.mu.RLock()
    defer s.mu.RUnlock()
    result := make([]*TenantutilEntry, 0)
    for _, e := range s.items {
        if e.Status == status {
            result = append(result, e)
        }
    }
    return result
}

func (s *TenantutilState) FilterByNamePrefix(prefix string) []*TenantutilEntry {
    s.mu.RLock()
    defer s.mu.RUnlock()
    result := make([]*TenantutilEntry, 0)
    for _, e := range s.items {
        if strings.HasPrefix(e.Name, prefix) {
            result = append(result, e)
        }
    }
    return result
}

func (s *TenantutilState) Clear() {
    s.mu.Lock()
    defer s.mu.Unlock()
    s.items = make(map[string]*TenantutilEntry)
}

func (s *TenantutilState) Contains(id string) bool {
    s.mu.RLock()
    defer s.mu.RUnlock()
    _, ok := s.items[id]
    return ok
}

func (o *TenantutilOptions) Validate() error {
    if o.Timeout <= 0 {
        return fmt.Errorf("tenantutil: timeout must be positive")
    }
    if o.MaxRetries < 0 {
        return fmt.Errorf("tenantutil: max_retries cannot be negative")
    }
    if o.BatchSize <= 0 {
        return fmt.Errorf("tenantutil: batch_size must be positive")
    }
    return nil
}

func (o *TenantutilOptions) Merge(other *TenantutilOptions) *TenantutilOptions {
    result := *o
    if other.Timeout > 0 { result.Timeout = other.Timeout }
    if other.MaxRetries > 0 { result.MaxRetries = other.MaxRetries }
    if other.BatchSize > 0 { result.BatchSize = other.BatchSize }
    if other.Labels != nil { result.Labels = other.Labels }
    return &result
}

func (e *TenantutilEntry) IsActive() bool {
    return e.Status == TenantutilStatusActive
}

func (e *TenantutilEntry) IsTerminal() bool {
    return e.Status == TenantutilStatusCompleted || e.Status == TenantutilStatusFailed || e.Status == TenantutilStatusCancelled
}

func (e *TenantutilEntry) Age() time.Duration {
    return time.Since(e.CreatedAt)
}

func FormatTenantutilID(prefix string, index int) string {
    return fmt.Sprintf("%s-%04d", prefix, index)
}
