package decorator

import (
	"time"
)

// EvictionPolicy is the eviction strategy for a method-level cache.
type EvictionPolicy string

const (
	// EvictionLRU evicts the least recently used entry first.
	EvictionLRU EvictionPolicy = "LRU"
	// EvictionLFU evicts the least frequently used entry first.
	EvictionLFU EvictionPolicy = "LFU"
	// EvictionFIFO evicts entries in first-in, first-out order.
	EvictionFIFO EvictionPolicy = "FIFO"
	// EvictionTTL evicts entries that have exceeded their time-to-live.
	EvictionTTL EvictionPolicy = "TTL"
	// EvictionNone disables automatic eviction; entries persist until manual
	// invalidation or TTL expiry (if configured).
	EvictionNone EvictionPolicy = "None"
)

// Default values used when fields are left at zero-values.
const (
	DefaultTTL      = 5 * time.Minute
	DefaultMaxSize  = 100
	DefaultEviction = EvictionLRU
)

// CacheConfig holds the configuration for a single method-level cache.
// It is value-copyable and safe to share across goroutines.
type CacheConfig struct {
	// Name is a human-readable identifier for the cache (used in logs and metrics).
	Name string
	// TTL is the maximum time an entry is kept before being considered stale.
	// Zero means "no TTL expiry" (entries are kept until eviction or invalidation).
	TTL time.Duration
	// MaxSize is the maximum number of entries allowed in the cache.
	// Zero defaults to DefaultMaxSize.
	MaxSize int
	// Eviction selects the eviction policy.
	Eviction EvictionPolicy
	// KeyGenerator is used to produce a cache key from method arguments.
	// When nil, DefaultKeyGenerator() is used.
	KeyGenerator KeyGenerator
	// Logger is optional. When nil, structured logs are suppressed.
	Logger Logger
	// Disable disables caching for this config (used for A/B or feature flags).
	Disable bool
}

// applyDefaults returns a copy of cfg with zero-values filled in.
// The receiver is not mutated.
func (c CacheConfig) applyDefaults() CacheConfig {
	if c.MaxSize <= 0 {
		c.MaxSize = DefaultMaxSize
	}
	if c.TTL < 0 {
		c.TTL = 0
	}
	if c.Eviction == "" {
		c.Eviction = DefaultEviction
	}
	if c.KeyGenerator == nil {
		c.KeyGenerator = DefaultKeyGenerator()
	}
	return c
}
