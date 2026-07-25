package models

import "time"

// CacheConfig defines the method-level cache configuration.
type CacheConfig struct {
	ID         string    `json:"id" db:"id"`
	TenantID   string    `json:"tenant_id" db:"tenant_id"`
	Name       string    `json:"name" db:"name"`
	TTL        int       `json:"ttl" db:"ttl"`              // Time to live in seconds
	MaxSize    int       `json:"max_size" db:"max_size"`    // Max entries
	Eviction   string    `json:"eviction" db:"eviction"`    // "LRU", "LFU", "FIFO"
	Serializer string    `json:"serializer" db:"serializer"` // "json", "gob", "msgpack"
	Backend    string    `json:"backend" db:"backend"`      // "memory", "redis"
	Enabled    bool      `json:"enabled" db:"enabled"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}

// CacheStats holds per-key cache statistics.
type CacheStats struct {
	ID         string    `json:"id" db:"id"`
	ConfigID   string    `json:"config_id" db:"config_id"`
	Key        string    `json:"key" db:"key"`
	Hits       int64     `json:"hits" db:"hits"`
	Misses     int64     `json:"misses" db:"misses"`
	Evictions  int64     `json:"evictions" db:"evictions"`
	AvgTTL     int64     `json:"avg_ttl" db:"avg_ttl"`
	LastAccess time.Time `json:"last_access" db:"last_access"`
}

// CreateCacheConfigRequest is the request body for creating a cache config.
type CreateCacheConfigRequest struct {
	Name       string `json:"name" binding:"required"`
	TTL        int    `json:"ttl"`
	MaxSize    int    `json:"max_size"`
	Eviction   string `json:"eviction"`
	Serializer string `json:"serializer"`
	Backend    string `json:"backend"`
	Enabled    *bool  `json:"enabled"`
}

// UpdateCacheConfigRequest is the request body for updating a cache config.
type UpdateCacheConfigRequest struct {
	Name       *string `json:"name"`
	TTL        *int    `json:"ttl"`
	MaxSize    *int    `json:"max_size"`
	Eviction   *string `json:"eviction"`
	Serializer *string `json:"serializer"`
	Backend    *string `json:"backend"`
	Enabled    *bool   `json:"enabled"`
}

// CacheValueRequest is the body for GET/SET cache value operations.
type CacheValueRequest struct {
	Key   string      `json:"key" binding:"required"`
	Value interface{} `json:"value"`
	Method string    `json:"method"`
}

// EvictKeyRequest is the body for evicting a single cache key.
type EvictKeyRequest struct {
	Key string `json:"key" binding:"required"`
}

// CacheValueResponse wraps a cached value returned by the GET endpoint.
type CacheValueResponse struct {
	Key   string      `json:"key"`
	Value interface{} `json:"value"`
	Hit   bool        `json:"hit"`
}

// StatsList is the response body for listing cache stats.
type StatsList struct {
	Stats []CacheStats `json:"stats"`
}
