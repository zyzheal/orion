package handler

import (
    "fmt"
    "math"
    "sort"
    "strings"
    "sync"
    "sync/atomic"
    "time"
)

type HandlerCounter struct { value int64 }

func NewHandlerCounter() *HandlerCounter { return &HandlerCounter{} }
func (c *HandlerCounter) Increment() int64 { return atomic.AddInt64(&c.value, 1) }
func (c *HandlerCounter) Decrement() int64 { return atomic.AddInt64(&c.value, -1) }
func (c *HandlerCounter) Value() int64 { return atomic.LoadInt64(&c.value) }
func (c *HandlerCounter) Reset() { atomic.StoreInt64(&c.value, 0) }

type HandlerRateLimiter struct {
    mu         sync.Mutex
    tokens     float64
    maxTokens  float64
    refillRate float64
    lastRefill time.Time
}

func NewHandlerRateLimiter(maxTokens, refillRate float64) *HandlerRateLimiter {
    rl := &HandlerRateLimiter{
        tokens:     maxTokens,
        maxTokens:  maxTokens,
        refillRate: refillRate,
        lastRefill: time.Now(),
    }
    return rl
}

func (rl *HandlerRateLimiter) Allow() bool {
    rl.mu.Lock()
    defer rl.mu.Unlock()
    rl.refill()
    if rl.tokens >= 1.0 {
        rl.tokens--
        return true
    }
    return false
}

func (rl *HandlerRateLimiter) refill() {
    now := time.Now()
    elapsed := now.Sub(rl.lastRefill).Seconds()
    rl.tokens = math.Min(rl.maxTokens, rl.tokens+elapsed*rl.refillRate)
    rl.lastRefill = now
}

func (rl *HandlerRateLimiter) Available() float64 {
    rl.mu.Lock()
    defer rl.mu.Unlock()
    return rl.tokens
}

type HandlerBuffer struct {
    mu     sync.Mutex
    items  []interface{}
    maxLen int
}

func NewHandlerBuffer(maxLen int) *HandlerBuffer {
    b := &HandlerBuffer{
        items:  make([]interface{}, 0, maxLen),
        maxLen: maxLen,
    }
    return b
}

func (b *HandlerBuffer) Push(item interface{}) bool {
    b.mu.Lock()
    defer b.mu.Unlock()
    if len(b.items) >= b.maxLen { return false }
    b.items = append(b.items, item)
    return true
}

func (b *HandlerBuffer) Pop() (interface{}, bool) {
    b.mu.Lock()
    defer b.mu.Unlock()
    if len(b.items) == 0 { return nil, false }
    item := b.items[0]
    b.items = b.items[1:]
    return item, true
}

func (b *HandlerBuffer) Len() int {
    b.mu.Lock()
    defer b.mu.Unlock()
    return len(b.items)
}

func (b *HandlerBuffer) Clear() {
    b.mu.Lock()
    defer b.mu.Unlock()
    b.items = make([]interface{}, 0, b.maxLen)
}

type HandlerConfigStore struct {
    mu      sync.RWMutex
    configs map[string]map[string]string
}

func NewHandlerConfigStore() *HandlerConfigStore {
    return &HandlerConfigStore{ configs: make(map[string]map[string]string) }
}

func (cs *HandlerConfigStore) Set(section, key, value string) {
    cs.mu.Lock()
    defer cs.mu.Unlock()
    if _, ok := cs.configs[section]; !ok {
        cs.configs[section] = make(map[string]string)
    }
    cs.configs[section][key] = value
}

func (cs *HandlerConfigStore) Get(section, key string) (string, bool) {
    cs.mu.RLock()
    defer cs.mu.RUnlock()
    if sec, ok := cs.configs[section]; ok {
        val, found := sec[key]
        return val, found
    }
    return "", false
}

func (cs *HandlerConfigStore) ListSections() []string {
    cs.mu.RLock()
    defer cs.mu.RUnlock()
    sections := make([]string, 0, len(cs.configs))
    for s := range cs.configs {
        sections = append(sections, s)
    }
    sort.Strings(sections)
    return sections
}

type HandlerTimeoutConfig struct {
    ConnectTimeout time.Duration
    ReadTimeout    time.Duration
    WriteTimeout   time.Duration
    TotalTimeout   time.Duration
}

func DefaultHandlerTimeoutConfig() HandlerTimeoutConfig {
    return HandlerTimeoutConfig{
        ConnectTimeout: 5 * time.Second,
        ReadTimeout:    30 * time.Second,
        WriteTimeout:   30 * time.Second,
        TotalTimeout:   60 * time.Second,
    }
}

func (tc HandlerTimeoutConfig) IsValid() bool {
    return tc.ConnectTimeout > 0 && tc.ReadTimeout > 0 && tc.WriteTimeout > 0
}

func (tc HandlerTimeoutConfig) String() string {
    return fmt.Sprintf("tc(connect=%s,read=%s,write=%s)", tc.ConnectTimeout, tc.ReadTimeout, tc.WriteTimeout)
}

func HandlerJoin(keys []string, sep string) string { return strings.Join(keys, sep) }
func HandlerSplit(s, sep string) []string { return strings.Split(s, sep) }

func HandlerContains(haystack []string, needle string) bool {
    for _, h := range haystack {
        if h == needle { return true }
    }
    return false
}

func HandlerUnique(items []string) []string {
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

func HandlerSort(items []string) []string {
    sorted := make([]string, len(items))
    copy(sorted, items)
    sort.Strings(sorted)
    return sorted
}

func HandlerReverse(items []string) []string {
    result := make([]string, len(items))
    for i, item := range items {
        result[len(items)-1-i] = item
    }
    return result
}
