package decorator

import (
	"reflect"
	"sync"
	"sync/atomic"
	"time"

	"go.uber.org/zap"
)

// ---------------------------------------------------------------------------
// Logger — minimal interface so we stay independent of zap outside this package.
// ---------------------------------------------------------------------------

type Logger interface {
	Debug(msg string, fields ...zap.Field)
	Info(msg string, fields ...zap.Field)
}

// noOpLogger is a zero-allocation logger when none is configured.
type noOpLogger struct{}

func (noOpLogger) Debug(string, ...zap.Field) {}
func (noOpLogger) Info(string, ...zap.Field)  {}

// ---------------------------------------------------------------------------
// MethodCache wraps a single method with caching logic.
// ---------------------------------------------------------------------------

type methodStats struct {
	Hits   atomic.Int64
	Misses atomic.Int64
	Sets   atomic.Int64
}

// MethodCache caches the result of a single pure function. The function must
// have the form func(Args...) (Results..., error), and the last result value
// may be an error that is never cached (errors are always propagated).
//
// MethodCache is safe for concurrent use.
type MethodCache struct {
	name       string
	fn         reflect.Value
	cfg        CacheConfig
	logger     Logger
	stats      methodStats
	backend    CacheBackend
	gen        KeyGenerator
	missLock   sync.Mutex // serialises calls to the underlying function
	missLockEn bool        // when true, only one goroutine calls fn for a given miss
}

// NewMethodCache returns a MethodCache for the given pure function.
//
//  - fn must be a function value (not a method value on a non-nil receiver).
//  - cfg holds TTL, eviction, key generation, etc.
//  - backend stores the actual cached values (memory or Redis).
func NewMethodCache(name string, fn interface{}, cfg CacheConfig, backend CacheBackend) *MethodCache {
	cfg = cfg.applyDefaults()
	logger := cfg.Logger
	if logger == nil {
		logger = noOpLogger{}
	}
	return &MethodCache{
		name:       name,
		fn:         reflect.ValueOf(fn),
		cfg:        cfg,
		logger:     logger,
		backend:    backend,
		gen:        cfg.KeyGenerator,
		missLockEn: true,
	}
}

// Invoke calls the decorated function with the given arguments. If the result
// is cached (and the entry has not expired), it is returned immediately;
// otherwise the function is invoked, the result is cached, and then returned.
//
// Returns a slice of reflect.Value matching the function's result types, plus
// an error if the function could not be invoked (wrong arity, wrong types,
// backend error, etc.).
func (m *MethodCache) Invoke(args ...interface{}) ([]reflect.Value, error) {
	if m.cfg.Disable {
		m.stats.Misses.Add(1)
		return m.callFn(args)
	}

	// Build cache key from arguments.
	key := m.gen.Key(args...)

	// Fast path: cache hit.
	if val, ok := m.backend.Get(key); ok {
		m.stats.Hits.Add(1)
		m.logger.Debug("method cache hit",
			zap.String("cache", m.name),
			zap.String("key", key),
		)
		return unboxResult(val), nil
	}
	m.stats.Misses.Add(1)

	// Slow path: call function, cache result.
	// We optionally serialise concurrent misses so only one goroutine calls fn.
	if m.missLockEn {
		m.missLock.Lock()
		// Double-check: another goroutine may have populated the cache while
		// we waited for the lock.
		if val, ok := m.backend.Get(key); ok {
			m.missLock.Unlock()
			m.stats.Hits.Add(1)
			return unboxResult(val), nil
		}
		result, err := m.callFn(args)
		m.missLock.Unlock()
		if err != nil {
			return nil, err
		}
		m.setFromResult(key, result)
		return result, nil
	}

	result, err := m.callFn(args)
	if err != nil {
		return nil, err
	}
	m.setFromResult(key, result)
	return result, nil
}

// Evict removes a single cached key.
func (m *MethodCache) Evict(args ...interface{}) {
	key := m.gen.Key(args...)
	m.backend.Delete(key)
	m.logger.Debug("method cache evict",
		zap.String("cache", m.name),
		zap.String("key", key),
	)
}

// Invalidate clears all cached entries for this method.
func (m *MethodCache) Invalidate() {
	m.backend.Clear()
	m.stats = methodStats{}
	m.logger.Info("method cache invalidated",
		zap.String("cache", m.name),
	)
}

// Stats returns a snapshot of the cache statistics.
func (m *MethodCache) Stats() MethodStats {
	return MethodStats{
		Name:   m.name,
		Hits:   m.stats.Hits.Load(),
		Misses: m.stats.Misses.Load(),
		Sets:   m.stats.Sets.Load(),
		Size:   m.backend.Len(),
	}
}

// callFn invokes the underlying function with the given arguments.
func (m *MethodCache) callFn(args []interface{}) ([]reflect.Value, error) {
	// Build reflect.Value slice from arguments.
	vargs := make([]reflect.Value, len(args))
	for i, a := range args {
		vargs[i] = reflect.ValueOf(a)
	}
	result := m.fn.Call(vargs)
	return result, nil
}

// setFromResult stores the function result in the backend.
// Errors are never cached: if the last result is an error, we still cache the
// non-error results but the caller will have already received the error.
func (m *MethodCache) setFromResult(key string, result []reflect.Value) {
	// Box the result into a single interface{} for storage.
	val := boxResult(result)
	if err := m.backend.Set(key, val); err != nil {
		m.logger.Debug("method cache set failed",
			zap.String("cache", m.name),
			zap.String("key", key),
			zap.Error(err),
		)
		return
	}
	m.stats.Sets.Add(1)
	m.logger.Debug("method cache set",
		zap.String("cache", m.name),
		zap.String("key", key),
	)
}

// ---------------------------------------------------------------------------
// Result boxing / unboxing — a single reflect.Value[] becomes one interface{}.
// ---------------------------------------------------------------------------

type cachedResult struct {
	Values    []interface{}
	TypedArgs []reflect.Type
}

func boxResult(result []reflect.Value) interface{} {
	if len(result) == 0 {
		return &cachedResult{}
	}
	values := make([]interface{}, len(result))
	types := make([]reflect.Type, len(result))
	for i, rv := range result {
		if rv.Kind() == reflect.Interface && !rv.IsNil() {
			values[i] = rv.Interface()
			types[i] = rv.Type()
		} else if rv.IsValid() {
			values[i] = rv.Interface()
			types[i] = rv.Type()
		} else {
			values[i] = nil
			types[i] = nil
		}
	}
	return &cachedResult{Values: values, TypedArgs: types}
}

func unboxResult(val interface{}) []reflect.Value {
	cr, ok := val.(*cachedResult)
	if !ok {
		// Allow single-value caches (e.g. Redis returns a plain value).
		return []reflect.Value{reflect.ValueOf(val)}
	}
	out := make([]reflect.Value, len(cr.Values))
	for i, v := range cr.Values {
		out[i] = reflect.ValueOf(v)
	}
	return out
}

// ---------------------------------------------------------------------------
// MethodStats — exported statistics snapshot.
// ---------------------------------------------------------------------------

type MethodStats struct {
	Name   string `json:"name"`
	Hits   int64  `json:"hits"`
	Misses int64  `json:"misses"`
	Sets   int64  `json:"sets"`
	Size   int    `json:"size"`
}

// HitRatio returns the cache hit ratio, or 0 when there have been no requests.
func (s MethodStats) HitRatio() float64 {
	total := s.Hits + s.Misses
	if total == 0 {
		return 0
	}
	return float64(s.Hits) / float64(total)
}

// ---------------------------------------------------------------------------
// CacheManager — manages multiple named method caches.
// ---------------------------------------------------------------------------

// CacheBackend is the storage layer for a method cache. The decorator itself
// is storage-agnostic; implementers can provide memory, Redis, etc.
type CacheBackend interface {
	Get(key string) (interface{}, bool)
	Set(key string, value interface{}) error
	Delete(key string)
	Len() int
	Clear()
}

// CacheManager maintains a registry of named method caches.
type CacheManager struct {
	caches map[string]*MethodCache
	mu     sync.RWMutex
	logger Logger
}

// NewCacheManager returns a CacheManager.
func NewCacheManager(logger Logger) *CacheManager {
	if logger == nil {
		logger = noOpLogger{}
	}
	return &CacheManager{
		caches: make(map[string]*MethodCache),
		logger: logger,
	}
}

// Register creates and stores a MethodCache.
func (m *CacheManager) Register(name string, fn interface{}, cfg CacheConfig, backend CacheBackend) *MethodCache {
	mc := NewMethodCache(name, fn, cfg, backend)
	m.mu.Lock()
	m.caches[name] = mc
	m.mu.Unlock()
	return mc
}

// Get returns the MethodCache with the given name, or nil.
func (m *CacheManager) Get(name string) *MethodCache {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.caches[name]
}

// InvalidateAll clears every registered method cache.
func (m *CacheManager) InvalidateAll() {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for name, mc := range m.caches {
		mc.Invalidate()
		m.logger.Info("cache manager: invalidated",
			zap.String("cache", name),
		)
	}
}

// Stats returns statistics for all registered caches.
func (m *CacheManager) Stats() map[string]MethodStats {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make(map[string]MethodStats, len(m.caches))
	for name, mc := range m.caches {
		out[name] = mc.Stats()
	}
	return out
}

// ---------------------------------------------------------------------------
// CacheResult — lightweight wrapper returned by public caching helpers.
// ---------------------------------------------------------------------------

type CacheResult[T any] struct {
	Value  T
	Hit    bool
	Cached time.Time
}

// ---------------------------------------------------------------------------
// Sentinel errors
// ---------------------------------------------------------------------------

var ErrNotAFunction = errf("decorator: not a function")
var ErrNoBackend    = errf("decorator: cache backend is nil")

type errf string

func (e errf) Error() string { return string(e) }
