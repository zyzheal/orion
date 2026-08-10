package dr

import (
    "fmt"
    "strings"
    "sync"
    "time"
)

type DRStatus string

const (
    DRStatusPending   DRStatus = "pending"
    DRStatusActive    DRStatus = "active"
    DRStatusCompleted DRStatus = "completed"
    DRStatusFailed    DRStatus = "failed"
    DRStatusCancelled DRStatus = "cancelled"
)

type DRState struct {
    mu        sync.RWMutex
    items     map[string]*DREntry
    createdAt time.Time
}

type DREntry struct {
    ID        string
    Name      string
    Status    DRStatus
    CreatedAt time.Time
    UpdatedAt time.Time
    Metadata  map[string]string
}

type DROptions struct {
    Timeout     time.Duration
    MaxRetries  int
    BatchSize   int
    EnableCache bool
    Labels      map[string]string
}

type DRStats struct {
    Total     int64
    Active    int64
    Failed    int64
    Completed int64
}

func NewDRState() *DRState {
    return &DRState{
        items:     make(map[string]*DREntry),
        createdAt: time.Now(),
    }
}

func DefaultDROptions() *DROptions {
    return &DROptions{
        Timeout:     30 * time.Second,
        MaxRetries:  3,
        BatchSize:   100,
        EnableCache: true,
        Labels:      make(map[string]string),
    }
}

func (s *DRState) Add(id, name string, status DRStatus) *DREntry {
    s.mu.Lock()
    defer s.mu.Unlock()
    entry := &DREntry{
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

func (s *DRState) Get(id string) (*DREntry, bool) {
    s.mu.RLock()
    defer s.mu.RUnlock()
    entry, ok := s.items[id]
    return entry, ok
}

func (s *DRState) Remove(id string) bool {
    s.mu.Lock()
    defer s.mu.Unlock()
    _, ok := s.items[id]
    if ok {
        delete(s.items, id)
    }
    return ok
}

func (s *DRState) List() []*DREntry {
    s.mu.RLock()
    defer s.mu.RUnlock()
    entries := make([]*DREntry, 0, len(s.items))
    for _, e := range s.items {
        entries = append(entries, e)
    }
    return entries
}

func (s *DRState) Count() int {
    s.mu.RLock()
    defer s.mu.RUnlock()
    return len(s.items)
}

func (s *DRState) UpdateStatus(id string, status DRStatus) error {
    s.mu.Lock()
    defer s.mu.Unlock()
    entry, ok := s.items[id]
    if !ok {
        return fmt.Errorf("dr: item not found: %s", id)
    }
    entry.Status = status
    entry.UpdatedAt = time.Now()
    return nil
}

func (s *DRState) UpdateMetadata(id, key, value string) error {
    s.mu.Lock()
    defer s.mu.Unlock()
    entry, ok := s.items[id]
    if !ok {
        return fmt.Errorf("dr: item not found: %s", id)
    }
    entry.Metadata[key] = value
    return nil
}

func (s *DRState) GetStats() DRStats {
    s.mu.RLock()
    defer s.mu.RUnlock()
    var stats DRStats
    stats.Total = int64(len(s.items))
    for _, e := range s.items {
        switch e.Status {
        case DRStatusActive:
            stats.Active++
        case DRStatusFailed:
            stats.Failed++
        case DRStatusCompleted:
            stats.Completed++
        }
    }
    return stats
}

func (s *DRState) FilterByStatus(status DRStatus) []*DREntry {
    s.mu.RLock()
    defer s.mu.RUnlock()
    result := make([]*DREntry, 0)
    for _, e := range s.items {
        if e.Status == status {
            result = append(result, e)
        }
    }
    return result
}

func (s *DRState) FilterByNamePrefix(prefix string) []*DREntry {
    s.mu.RLock()
    defer s.mu.RUnlock()
    result := make([]*DREntry, 0)
    for _, e := range s.items {
        if strings.HasPrefix(e.Name, prefix) {
            result = append(result, e)
        }
    }
    return result
}

func (s *DRState) Clear() {
    s.mu.Lock()
    defer s.mu.Unlock()
    s.items = make(map[string]*DREntry)
}

func (s *DRState) Contains(id string) bool {
    s.mu.RLock()
    defer s.mu.RUnlock()
    _, ok := s.items[id]
    return ok
}

func (o *DROptions) Validate() error {
    if o.Timeout <= 0 {
        return fmt.Errorf("dr: timeout must be positive")
    }
    if o.MaxRetries < 0 {
        return fmt.Errorf("dr: max_retries cannot be negative")
    }
    if o.BatchSize <= 0 {
        return fmt.Errorf("dr: batch_size must be positive")
    }
    return nil
}

func (o *DROptions) Merge(other *DROptions) *DROptions {
    result := *o
    if other.Timeout > 0 { result.Timeout = other.Timeout }
    if other.MaxRetries > 0 { result.MaxRetries = other.MaxRetries }
    if other.BatchSize > 0 { result.BatchSize = other.BatchSize }
    if other.Labels != nil { result.Labels = other.Labels }
    return &result
}

func (e *DREntry) IsActive() bool {
    return e.Status == DRStatusActive
}

func (e *DREntry) IsTerminal() bool {
    return e.Status == DRStatusCompleted || e.Status == DRStatusFailed || e.Status == DRStatusCancelled
}

func (e *DREntry) Age() time.Duration {
    return time.Since(e.CreatedAt)
}

func FormatDRID(prefix string, index int) string {
    return fmt.Sprintf("%s-%04d", prefix, index)
}
