package migration

import (
    "fmt"
    "strings"
    "sync"
    "time"
)

type MigrationStatus string

const (
    MigrationStatusPending   MigrationStatus = "pending"
    MigrationStatusActive    MigrationStatus = "active"
    MigrationStatusCompleted MigrationStatus = "completed"
    MigrationStatusFailed    MigrationStatus = "failed"
    MigrationStatusCancelled MigrationStatus = "cancelled"
)

type MigrationState struct {
    mu        sync.RWMutex
    items     map[string]*MigrationEntry
    createdAt time.Time
}

type MigrationEntry struct {
    ID        string
    Name      string
    Status    MigrationStatus
    CreatedAt time.Time
    UpdatedAt time.Time
    Metadata  map[string]string
}

type MigrationOptions struct {
    Timeout     time.Duration
    MaxRetries  int
    BatchSize   int
    EnableCache bool
    Labels      map[string]string
}

type MigrationStats struct {
    Total     int64
    Active    int64
    Failed    int64
    Completed int64
}

func NewMigrationState() *MigrationState {
    return &MigrationState{
        items:     make(map[string]*MigrationEntry),
        createdAt: time.Now(),
    }
}

func DefaultMigrationOptions() *MigrationOptions {
    return &MigrationOptions{
        Timeout:     30 * time.Second,
        MaxRetries:  3,
        BatchSize:   100,
        EnableCache: true,
        Labels:      make(map[string]string),
    }
}

func (s *MigrationState) Add(id, name string, status MigrationStatus) *MigrationEntry {
    s.mu.Lock()
    defer s.mu.Unlock()
    entry := &MigrationEntry{
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

func (s *MigrationState) Get(id string) (*MigrationEntry, bool) {
    s.mu.RLock()
    defer s.mu.RUnlock()
    entry, ok := s.items[id]
    return entry, ok
}

func (s *MigrationState) Remove(id string) bool {
    s.mu.Lock()
    defer s.mu.Unlock()
    _, ok := s.items[id]
    if ok {
        delete(s.items, id)
    }
    return ok
}

func (s *MigrationState) List() []*MigrationEntry {
    s.mu.RLock()
    defer s.mu.RUnlock()
    entries := make([]*MigrationEntry, 0, len(s.items))
    for _, e := range s.items {
        entries = append(entries, e)
    }
    return entries
}

func (s *MigrationState) Count() int {
    s.mu.RLock()
    defer s.mu.RUnlock()
    return len(s.items)
}

func (s *MigrationState) UpdateStatus(id string, status MigrationStatus) error {
    s.mu.Lock()
    defer s.mu.Unlock()
    entry, ok := s.items[id]
    if !ok {
        return fmt.Errorf("migration: item not found: %s", id)
    }
    entry.Status = status
    entry.UpdatedAt = time.Now()
    return nil
}

func (s *MigrationState) UpdateMetadata(id, key, value string) error {
    s.mu.Lock()
    defer s.mu.Unlock()
    entry, ok := s.items[id]
    if !ok {
        return fmt.Errorf("migration: item not found: %s", id)
    }
    entry.Metadata[key] = value
    return nil
}

func (s *MigrationState) GetStats() MigrationStats {
    s.mu.RLock()
    defer s.mu.RUnlock()
    var stats MigrationStats
    stats.Total = int64(len(s.items))
    for _, e := range s.items {
        switch e.Status {
        case MigrationStatusActive:
            stats.Active++
        case MigrationStatusFailed:
            stats.Failed++
        case MigrationStatusCompleted:
            stats.Completed++
        }
    }
    return stats
}

func (s *MigrationState) FilterByStatus(status MigrationStatus) []*MigrationEntry {
    s.mu.RLock()
    defer s.mu.RUnlock()
    result := make([]*MigrationEntry, 0)
    for _, e := range s.items {
        if e.Status == status {
            result = append(result, e)
        }
    }
    return result
}

func (s *MigrationState) FilterByNamePrefix(prefix string) []*MigrationEntry {
    s.mu.RLock()
    defer s.mu.RUnlock()
    result := make([]*MigrationEntry, 0)
    for _, e := range s.items {
        if strings.HasPrefix(e.Name, prefix) {
            result = append(result, e)
        }
    }
    return result
}

func (s *MigrationState) Clear() {
    s.mu.Lock()
    defer s.mu.Unlock()
    s.items = make(map[string]*MigrationEntry)
}

func (s *MigrationState) Contains(id string) bool {
    s.mu.RLock()
    defer s.mu.RUnlock()
    _, ok := s.items[id]
    return ok
}

func (o *MigrationOptions) Validate() error {
    if o.Timeout <= 0 {
        return fmt.Errorf("migration: timeout must be positive")
    }
    if o.MaxRetries < 0 {
        return fmt.Errorf("migration: max_retries cannot be negative")
    }
    if o.BatchSize <= 0 {
        return fmt.Errorf("migration: batch_size must be positive")
    }
    return nil
}

func (o *MigrationOptions) Merge(other *MigrationOptions) *MigrationOptions {
    result := *o
    if other.Timeout > 0 { result.Timeout = other.Timeout }
    if other.MaxRetries > 0 { result.MaxRetries = other.MaxRetries }
    if other.BatchSize > 0 { result.BatchSize = other.BatchSize }
    if other.Labels != nil { result.Labels = other.Labels }
    return &result
}

func (e *MigrationEntry) IsActive() bool {
    return e.Status == MigrationStatusActive
}

func (e *MigrationEntry) IsTerminal() bool {
    return e.Status == MigrationStatusCompleted || e.Status == MigrationStatusFailed || e.Status == MigrationStatusCancelled
}

func (e *MigrationEntry) Age() time.Duration {
    return time.Since(e.CreatedAt)
}

func FormatMigrationID(prefix string, index int) string {
    return fmt.Sprintf("%s-%04d", prefix, index)
}
