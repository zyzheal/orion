package lock

import (
    "fmt"
    "strings"
    "sync"
    "time"
)

type LockStatus string

const (
    LockStatusPending   LockStatus = "pending"
    LockStatusActive    LockStatus = "active"
    LockStatusCompleted LockStatus = "completed"
    LockStatusFailed    LockStatus = "failed"
    LockStatusCancelled LockStatus = "cancelled"
)

type LockState struct {
    mu        sync.RWMutex
    items     map[string]*LockEntry
    createdAt time.Time
}

type LockEntry struct {
    ID        string
    Name      string
    Status    LockStatus
    CreatedAt time.Time
    UpdatedAt time.Time
    Metadata  map[string]string
}

type LockOptions struct {
    Timeout     time.Duration
    MaxRetries  int
    BatchSize   int
    EnableCache bool
    Labels      map[string]string
}

type LockStats struct {
    Total     int64
    Active    int64
    Failed    int64
    Completed int64
}

func NewLockState() *LockState {
    return &LockState{
        items:     make(map[string]*LockEntry),
        createdAt: time.Now(),
    }
}

func DefaultLockOptions() *LockOptions {
    return &LockOptions{
        Timeout:     30 * time.Second,
        MaxRetries:  3,
        BatchSize:   100,
        EnableCache: true,
        Labels:      make(map[string]string),
    }
}

func (s *LockState) Add(id, name string, status LockStatus) *LockEntry {
    s.mu.Lock()
    defer s.mu.Unlock()
    entry := &LockEntry{
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

func (s *LockState) Get(id string) (*LockEntry, bool) {
    s.mu.RLock()
    defer s.mu.RUnlock()
    entry, ok := s.items[id]
    return entry, ok
}

func (s *LockState) Remove(id string) bool {
    s.mu.Lock()
    defer s.mu.Unlock()
    _, ok := s.items[id]
    if ok {
        delete(s.items, id)
    }
    return ok
}

func (s *LockState) List() []*LockEntry {
    s.mu.RLock()
    defer s.mu.RUnlock()
    entries := make([]*LockEntry, 0, len(s.items))
    for _, e := range s.items {
        entries = append(entries, e)
    }
    return entries
}

func (s *LockState) Count() int {
    s.mu.RLock()
    defer s.mu.RUnlock()
    return len(s.items)
}

func (s *LockState) UpdateStatus(id string, status LockStatus) error {
    s.mu.Lock()
    defer s.mu.Unlock()
    entry, ok := s.items[id]
    if !ok {
        return fmt.Errorf("lock: item not found: %s", id)
    }
    entry.Status = status
    entry.UpdatedAt = time.Now()
    return nil
}

func (s *LockState) UpdateMetadata(id, key, value string) error {
    s.mu.Lock()
    defer s.mu.Unlock()
    entry, ok := s.items[id]
    if !ok {
        return fmt.Errorf("lock: item not found: %s", id)
    }
    entry.Metadata[key] = value
    return nil
}

func (s *LockState) GetStats() LockStats {
    s.mu.RLock()
    defer s.mu.RUnlock()
    var stats LockStats
    stats.Total = int64(len(s.items))
    for _, e := range s.items {
        switch e.Status {
        case LockStatusActive:
            stats.Active++
        case LockStatusFailed:
            stats.Failed++
        case LockStatusCompleted:
            stats.Completed++
        }
    }
    return stats
}

func (s *LockState) FilterByStatus(status LockStatus) []*LockEntry {
    s.mu.RLock()
    defer s.mu.RUnlock()
    result := make([]*LockEntry, 0)
    for _, e := range s.items {
        if e.Status == status {
            result = append(result, e)
        }
    }
    return result
}

func (s *LockState) FilterByNamePrefix(prefix string) []*LockEntry {
    s.mu.RLock()
    defer s.mu.RUnlock()
    result := make([]*LockEntry, 0)
    for _, e := range s.items {
        if strings.HasPrefix(e.Name, prefix) {
            result = append(result, e)
        }
    }
    return result
}

func (s *LockState) Clear() {
    s.mu.Lock()
    defer s.mu.Unlock()
    s.items = make(map[string]*LockEntry)
}

func (s *LockState) Contains(id string) bool {
    s.mu.RLock()
    defer s.mu.RUnlock()
    _, ok := s.items[id]
    return ok
}

func (o *LockOptions) Validate() error {
    if o.Timeout <= 0 {
        return fmt.Errorf("lock: timeout must be positive")
    }
    if o.MaxRetries < 0 {
        return fmt.Errorf("lock: max_retries cannot be negative")
    }
    if o.BatchSize <= 0 {
        return fmt.Errorf("lock: batch_size must be positive")
    }
    return nil
}

func (o *LockOptions) Merge(other *LockOptions) *LockOptions {
    result := *o
    if other.Timeout > 0 { result.Timeout = other.Timeout }
    if other.MaxRetries > 0 { result.MaxRetries = other.MaxRetries }
    if other.BatchSize > 0 { result.BatchSize = other.BatchSize }
    if other.Labels != nil { result.Labels = other.Labels }
    return &result
}

func (e *LockEntry) IsActive() bool {
    return e.Status == LockStatusActive
}

func (e *LockEntry) IsTerminal() bool {
    return e.Status == LockStatusCompleted || e.Status == LockStatusFailed || e.Status == LockStatusCancelled
}

func (e *LockEntry) Age() time.Duration {
    return time.Since(e.CreatedAt)
}

func FormatLockID(prefix string, index int) string {
    return fmt.Sprintf("%s-%04d", prefix, index)
}
