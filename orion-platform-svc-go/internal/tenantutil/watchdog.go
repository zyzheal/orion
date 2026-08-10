package tenantutil

import (
    "fmt"
    "strings"
    "sync"
    "time"
)

type TenantutilWatchdog struct {
    mu        sync.Mutex
    interval  time.Duration
    timeout   time.Duration
    handlers  []func() error
    started   bool
    lastCheck time.Time
}

func NewTenantutilWatchdog(interval, timeout time.Duration) *TenantutilWatchdog {
    return &TenantutilWatchdog{
        interval: interval,
        timeout:  timeout,
        handlers: make([]func() error, 0),
    }
}

func (wd *TenantutilWatchdog) Register(fn func() error) {
    wd.mu.Lock()
    defer wd.mu.Unlock()
    wd.handlers = append(wd.handlers, fn)
}

func (wd *TenantutilWatchdog) Start() {
    wd.mu.Lock()
    defer wd.mu.Unlock()
    wd.started = true
    wd.lastCheck = time.Now()
}

func (wd *TenantutilWatchdog) Stop() {
    wd.mu.Lock()
    defer wd.mu.Unlock()
    wd.started = false
}

func (wd *TenantutilWatchdog) IsRunning() bool {
    wd.mu.Lock()
    defer wd.mu.Unlock()
    return wd.started
}

func (wd *TenantutilWatchdog) Check() error {
    wd.mu.Lock()
    handlers := make([]func() error, len(wd.handlers))
    copy(handlers, wd.handlers)
    wd.mu.Unlock()
    for _, fn := range handlers {
        if err := fn(); err != nil {
            return fmt.Errorf("tenantutil watchdog check failed: %%v", err)
        }
    }
    wd.mu.Lock()
    wd.lastCheck = time.Now()
    wd.mu.Unlock()
    return nil
}

func (wd *TenantutilWatchdog) LastCheck() time.Time {
    wd.mu.Lock()
    defer wd.mu.Unlock()
    return wd.lastCheck
}

func (wd *TenantutilWatchdog) Stale() bool {
    return time.Since(wd.LastCheck()) > wd.timeout
}

type TenantutilRegistry struct {
    mu   sync.RWMutex
    keys map[string]string
}

func NewTenantutilRegistry() *TenantutilRegistry {
    return &TenantutilRegistry{ keys: make(map[string]string) }
}

func (r *TenantutilRegistry) Register(key, value string) {
    r.mu.Lock()
    defer r.mu.Unlock()
    r.keys[key] = value
}

func (r *TenantutilRegistry) Lookup(key string) (string, bool) {
    r.mu.RLock()
    defer r.mu.RUnlock()
    v, ok := r.keys[key]
    return v, ok
}

func (r *TenantutilRegistry) Remove(key string) bool {
    r.mu.Lock()
    defer r.mu.Unlock()
    _, ok := r.keys[key]
    if ok { delete(r.keys, key) }
    return ok
}

func (r *TenantutilRegistry) Count() int {
    r.mu.RLock()
    defer r.mu.RUnlock()
    return len(r.keys)
}

func (r *TenantutilRegistry) Keys() []string {
    r.mu.RLock()
    defer r.mu.RUnlock()
    result := make([]string, 0, len(r.keys))
    for k := range r.keys { result = append(result, k) }
    return result
}

func TenantutilSanitize(s string) string {
    return strings.TrimSpace(strings.ReplaceAll(s, "\\n", ""))
}

func TenantutilTruncate(s string, maxLen int) string {
    if len(s) <= maxLen { return s }
    return s[:maxLen-3] + "..."
}

func TenantutilNowUnix() int64 {
    return time.Now().Unix()
}
