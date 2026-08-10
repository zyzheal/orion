package migration

import (
    "fmt"
    "math"
    "sort"
    "strings"
    "sync"
    "sync/atomic"
    "time"
)

type MigrationCounter struct { value int64 }

func NewMigrationCounter() *MigrationCounter { return &MigrationCounter{} }
func (c *MigrationCounter) Increment() int64 { return atomic.AddInt64(&c.value, 1) }
func (c *MigrationCounter) Decrement() int64 { return atomic.AddInt64(&c.value, -1) }
func (c *MigrationCounter) Value() int64 { return atomic.LoadInt64(&c.value) }
func (c *MigrationCounter) Reset() { atomic.StoreInt64(&c.value, 0) }

type MigrationRateLimiter struct {
    mu         sync.Mutex
    tokens     float64
    maxTokens  float64
    refillRate float64
    lastRefill time.Time
}

func NewMigrationRateLimiter(maxTokens, refillRate float64) *MigrationRateLimiter {
    rl := &MigrationRateLimiter{
        tokens:     maxTokens,
        maxTokens:  maxTokens,
        refillRate: refillRate,
        lastRefill: time.Now(),
    }
    return rl
}

func (rl *MigrationRateLimiter) Allow() bool {
    rl.mu.Lock()
    defer rl.mu.Unlock()
    rl.refill()
    if rl.tokens >= 1.0 {
        rl.tokens--
        return true
    }
    return false
}

func (rl *MigrationRateLimiter) refill() {
    now := time.Now()
    elapsed := now.Sub(rl.lastRefill).Seconds()
    rl.tokens = math.Min(rl.maxTokens, rl.tokens+elapsed*rl.refillRate)
    rl.lastRefill = now
}

func (rl *MigrationRateLimiter) Available() float64 {
    rl.mu.Lock()
    defer rl.mu.Unlock()
    return rl.tokens
}

type MigrationBuffer struct {
    mu     sync.Mutex
    items  []interface{}
    maxLen int
}

func NewMigrationBuffer(maxLen int) *MigrationBuffer {
    b := &MigrationBuffer{
        items:  make([]interface{}, 0, maxLen),
        maxLen: maxLen,
    }
    return b
}

func (b *MigrationBuffer) Push(item interface{}) bool {
    b.mu.Lock()
    defer b.mu.Unlock()
    if len(b.items) >= b.maxLen { return false }
    b.items = append(b.items, item)
    return true
}

func (b *MigrationBuffer) Pop() (interface{}, bool) {
    b.mu.Lock()
    defer b.mu.Unlock()
    if len(b.items) == 0 { return nil, false }
    item := b.items[0]
    b.items = b.items[1:]
    return item, true
}

func (b *MigrationBuffer) Len() int {
    b.mu.Lock()
    defer b.mu.Unlock()
    return len(b.items)
}

func (b *MigrationBuffer) Clear() {
    b.mu.Lock()
    defer b.mu.Unlock()
    b.items = make([]interface{}, 0, b.maxLen)
}

type MigrationConfigStore struct {
    mu      sync.RWMutex
    configs map[string]map[string]string
}

func NewMigrationConfigStore() *MigrationConfigStore {
    return &MigrationConfigStore{ configs: make(map[string]map[string]string) }
}

func (cs *MigrationConfigStore) Set(section, key, value string) {
    cs.mu.Lock()
    defer cs.mu.Unlock()
    if _, ok := cs.configs[section]; !ok {
        cs.configs[section] = make(map[string]string)
    }
    cs.configs[section][key] = value
}

func (cs *MigrationConfigStore) Get(section, key string) (string, bool) {
    cs.mu.RLock()
    defer cs.mu.RUnlock()
    if sec, ok := cs.configs[section]; ok {
        val, found := sec[key]
        return val, found
    }
    return "", false
}

func (cs *MigrationConfigStore) ListSections() []string {
    cs.mu.RLock()
    defer cs.mu.RUnlock()
    sections := make([]string, 0, len(cs.configs))
    for s := range cs.configs {
        sections = append(sections, s)
    }
    sort.Strings(sections)
    return sections
}

type MigrationTimeoutConfig struct {
    ConnectTimeout time.Duration
    ReadTimeout    time.Duration
    WriteTimeout   time.Duration
    TotalTimeout   time.Duration
}

func DefaultMigrationTimeoutConfig() MigrationTimeoutConfig {
    return MigrationTimeoutConfig{
        ConnectTimeout: 5 * time.Second,
        ReadTimeout:    30 * time.Second,
        WriteTimeout:   30 * time.Second,
        TotalTimeout:   60 * time.Second,
    }
}

func (tc MigrationTimeoutConfig) IsValid() bool {
    return tc.ConnectTimeout > 0 && tc.ReadTimeout > 0 && tc.WriteTimeout > 0
}

func (tc MigrationTimeoutConfig) String() string {
    return fmt.Sprintf("tc(connect=%s,read=%s,write=%s)", tc.ConnectTimeout, tc.ReadTimeout, tc.WriteTimeout)
}

func MigrationJoin(keys []string, sep string) string { return strings.Join(keys, sep) }
func MigrationSplit(s, sep string) []string { return strings.Split(s, sep) }

func MigrationContains(haystack []string, needle string) bool {
    for _, h := range haystack {
        if h == needle { return true }
    }
    return false
}

func MigrationUnique(items []string) []string {
    seen := make(map[string]bool, len(items))
    result := make([]string, 0, len(items))
    for _, item := range items {
        if !seen[item] {
            seen[item] = true
            result = append(result, item)
        }
    }
    return result
}

func MigrationSort(items []string) []string {
    sorted := make([]string, len(items))
    copy(sorted, items)
    sort.Strings(sorted)
    return sorted
}

func MigrationReverse(items []string) []string {
    result := make([]string, len(items))
    for i, item := range items {
        result[len(items)-1-i] = item
    }
    return result
}
