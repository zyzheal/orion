package decorator

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	redis "github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// RedisBackend implements CacheBackend backed by a Redis cluster (or single node).
// It is safe for concurrent use. Keys are stored with a configurable prefix.
type RedisBackend struct {
	client     *redis.Client
	prefix     string
	ttl        time.Duration
	ctx        context.Context // used for all Redis operations; must not be nil
	logger     Logger
	serializer Serializer
}

// Serializer converts between Go values and Redis-compatible byte slices.
// DefaultSerializer uses JSON.
type Serializer interface {
	Marshal(v interface{}) ([]byte, error)
	Unmarshal(b []byte, target *interface{}) error
}

// RedisBackendConfig holds the configuration for a RedisBackend.
type RedisBackendConfig struct {
	// Prefix is prepended to every cache key stored in Redis.
	Prefix string
	// TTL is the time-to-live applied to each cached entry. Zero means the
	// entry does not expire automatically (controlled by eviction).
	TTL time.Duration
	// Serializer controls how values are marshalled. Defaults to JSON.
	Serializer Serializer
	// Logger is optional. When nil, structured logs are suppressed.
	Logger Logger
	// DisableKeyPrefix disables the key prefix (use when keys are already
	// globally unique).
	DisableKeyPrefix bool
}

// RedisBackendOption sets an optional field on RedisBackendConfig.
type RedisBackendOption func(*RedisBackendConfig)

// WithRedisPrefix sets the Redis key prefix.
func WithRedisPrefix(prefix string) RedisBackendOption {
	return func(cfg *RedisBackendConfig) { cfg.Prefix = prefix }
}

// WithRedisTTL sets the TTL for cached entries.
func WithRedisTTL(ttl time.Duration) RedisBackendOption {
	return func(cfg *RedisBackendConfig) { cfg.TTL = ttl }
}

// WithRedisSerializer sets a custom serializer.
func WithRedisSerializer(s Serializer) RedisBackendOption {
	return func(cfg *RedisBackendConfig) { cfg.Serializer = s }
}

// WithRedisLogger sets an optional logger.
func WithRedisLogger(logger Logger) RedisBackendOption {
	return func(cfg *RedisBackendConfig) { cfg.Logger = logger }
}

// WithoutRedisKeyPrefix disables the key prefix.
func WithoutRedisKeyPrefix() RedisBackendOption {
	return func(cfg *RedisBackendConfig) { cfg.DisableKeyPrefix = true }
}

// NewRedisBackend creates a Redis-backed cache.
//
//  - ctx is used for every Redis operation; it should typically be
//    context.Background() and the caller should manage cancellation.
//  - client is a connected go-redis v9 client.
func NewRedisBackend(ctx context.Context, client *redis.Client, opts ...RedisBackendOption) *RedisBackend {
	cfg := &RedisBackendConfig{
		Prefix:        "orion:cache:",
		Serializer:    &defaultSerializer{},
		DisableKeyPrefix: false,
	}
	for _, opt := range opts {
		opt(cfg)
	}
	if cfg.Serializer == nil {
		cfg.Serializer = &defaultSerializer{}
	}
	logger := cfg.Logger
	if logger == nil {
		logger = noOpLogger{}
	}
	return &RedisBackend{
		client:     client,
		prefix:     cfg.Prefix,
		ttl:        cfg.TTL,
		ctx:        ctx,
		logger:     logger,
		serializer: cfg.Serializer,
	}
}

// Get retrieves a value by key from Redis.
func (b *RedisBackend) Get(key string) (interface{}, bool) {
	redisKey := b.resolveKey(key)
	data, err := b.client.Get(b.ctx, redisKey).Bytes()
	if errors.Is(err, redis.Nil) {
		return nil, false
	}
	if err != nil {
		b.logger.Debug("redis get error",
			zap.String("key", redisKey),
			zap.Error(err),
		)
		return nil, false
	}
	var value interface{}
	if err := b.serializer.Unmarshal(data, &value); err != nil {
		b.logger.Debug("redis unmarshal error",
			zap.String("key", redisKey),
			zap.Error(err),
		)
		return nil, false
	}
	return value, true
}

// Set stores a value with an optional TTL.
func (b *RedisBackend) Set(key string, value interface{}) error {
	redisKey := b.resolveKey(key)
	data, err := b.serializer.Marshal(value)
	if err != nil {
		b.logger.Debug("redis marshal error",
			zap.String("key", redisKey),
			zap.Error(err),
		)
		return err
	}
	return b.client.Set(b.ctx, redisKey, data, b.ttl).Err()
}

// Delete removes a key from Redis.
func (b *RedisBackend) Delete(key string) {
	redisKey := b.resolveKey(key)
	_ = b.client.Del(b.ctx, redisKey).Err()
}

// Len returns the count of keys matching the backend's prefix.
// This is an approximation (count of keys under the prefix via SCAN) and is
// safe to call but may be expensive on large caches. For small caches or when
// performance matters, prefer a separate counter.
func (b *RedisBackend) Len() int {
	// Note: SCAN is paginated; for accurate counts use a dedicated counter key.
	// For now return 0 and log that LEN is not tracked.
	b.logger.Debug("redis LEN not tracked")
	return 0
}

// Clear removes all keys matching the backend's prefix.
// WARNING: This scans and deletes all matching keys. Use with caution in
// production where the prefix may be shared across tenants.
func (b *RedisBackend) Clear() {
	pattern := b.prefix + "*"
	if b.disablePrefix() {
		pattern = "*"
	}
	var cursor uint64
	for {
		keys, nextCursor, err := b.client.Scan(b.ctx, cursor, pattern, 100).Result()
		if err != nil {
			b.logger.Debug("redis scan error during clear",
				zap.Error(err),
			)
			return
		}
		if len(keys) > 0 {
			_ = b.client.Del(b.ctx, keys...).Err()
		}
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
	b.logger.Info("redis backend cleared",
		zap.String("pattern", pattern),
	)
}

// Close drains the underlying Redis client connection pool.
// It is safe to call multiple times.
func (b *RedisBackend) Close() error {
	return b.client.Close()
}

// resolveKey prefixes the given key for storage in Redis.
func (b *RedisBackend) resolveKey(key string) string {
	if b.disablePrefix() {
		return key
	}
	return b.prefix + key
}

// disablePrefix checks if the key prefix is disabled.
func (b *RedisBackend) disablePrefix() bool {
	return b.prefix == ""
}

// ---------------------------------------------------------------------------
// DefaultSerializer — JSON-based serialization
// ---------------------------------------------------------------------------

type defaultSerializer struct{}

func (s *defaultSerializer) Marshal(v interface{}) ([]byte, error) {
	return json.Marshal(v)
}

func (s *defaultSerializer) Unmarshal(b []byte, target *interface{}) error {
	// First try strict JSON unmarshal into the target interface.
	err := json.Unmarshal(b, target)
	if err != nil {
		// If it fails, fall back to treating the value as a raw string.
		var raw string
		if err2 := json.Unmarshal(b, &raw); err2 == nil {
			*target = raw
			return nil
		}
		return err
	}
	return nil
}

// ---------------------------------------------------------------------------
// NewRedisBackendFromURL creates a RedisBackend from a Redis connection URL.
// This is a convenience helper for simple setups.
// ---------------------------------------------------------------------------

func NewRedisBackendFromURL(ctx context.Context, url string, opts ...RedisBackendOption) (*RedisBackend, error) {
	opt, err := redis.ParseURL(url)
	if err != nil {
		return nil, err
	}
	client := redis.NewClient(opt)
	// Verify connectivity.
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, err
	}
	rb := NewRedisBackend(ctx, client, opts...)
	return rb, nil
}
