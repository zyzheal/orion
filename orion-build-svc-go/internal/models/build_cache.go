package models

import "time"

// ==================== Build Cache ====================

// CacheLevel defines the scope of a cache configuration.
type CacheLevel string

const (
	CacheLevelGlobal   CacheLevel = "global"
	CacheLevelPipeline CacheLevel = "pipeline"
	CacheLevelTask     CacheLevel = "task"
)

// CacheStorageType defines where cache data is stored.
type CacheStorageType string

const (
	CacheStorageTypeLocalVolume CacheStorageType = "local-volume"
	CacheStorageTypeS3          CacheStorageType = "s3"
	CacheStorageTypeNFS         CacheStorageType = "nfs"
)

// CacheCleanupPolicy defines the eviction strategy for cache entries.
type CacheCleanupPolicy string

const (
	CacheCleanupPolicyLRU    CacheCleanupPolicy = "lru"
	CacheCleanupPolicyTTL    CacheCleanupPolicy = "ttl"
	CacheCleanupPolicyManual CacheCleanupPolicy = "manual"
	CacheCleanupPolicyNever  CacheCleanupPolicy = "never"
)

// CacheStatus defines whether caching is enabled or disabled.
type CacheStatus string

const (
	CacheStatusEnabled  CacheStatus = "enabled"
	CacheStatusDisabled CacheStatus = "disabled"
)

// BuildCacheConfig defines a cache configuration at a specific level.
type BuildCacheConfig struct {
	ID              string             `db:"id" json:"id"`
	Level           CacheLevel         `db:"level" json:"level"`
	TargetID        *string            `db:"target_id" json:"target_id,omitempty"`
	Status          CacheStatus        `db:"status" json:"status"`
	StorageType     CacheStorageType   `db:"storage_type" json:"storage_type"`
	StoragePath     *string            `db:"storage_path" json:"storage_path,omitempty"`
	MaxTotalSize    *string            `db:"max_total_size" json:"max_total_size,omitempty"`
	MaxAgeDays      *int               `db:"max_age_days" json:"max_age_days,omitempty"`
	CleanupPolicy   CacheCleanupPolicy `db:"cleanup_policy" json:"cleanup_policy"`
	CacheKeyPattern *string            `db:"cache_key_pattern" json:"cache_key_pattern,omitempty"`
	CachePaths      string             `db:"cache_paths" json:"cache_paths,omitempty"` // stored as JSON array text
	Description     *string            `db:"description" json:"description,omitempty"`
	CreatedAt       time.Time          `db:"created_at" json:"created_at"`
	UpdatedAt       *time.Time         `db:"updated_at" json:"updated_at,omitempty"`
}

// CacheEntry represents an actual cache entry produced by a build.
type CacheEntry struct {
	ID          string     `db:"id" json:"id"`
	ConfigID    string     `db:"config_id" json:"config_id"`
	CacheKey    string     `db:"cache_key" json:"cache_key"`
	Hash        string     `db:"hash" json:"hash"`
	Size        *int64     `db:"size" json:"size"`
	StoragePath string     `db:"storage_path" json:"storage_path"`
	HitCount    int        `db:"hit_count" json:"hit_count"`
	LastHitAt   *time.Time `db:"last_hit_at" json:"last_hit_at,omitempty"`
	ExpiresAt   *time.Time `db:"expires_at" json:"expires_at,omitempty"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt   *time.Time `db:"updated_at" json:"updated_at,omitempty"`
}

// CreateBuildCacheConfigInput is the payload for creating a cache config.
type CreateBuildCacheConfigInput struct {
	Level           string    `json:"level" binding:"required"`
	TargetID        string    `json:"target_id,omitempty"`
	Status          string    `json:"status,omitempty"`
	StorageType     string    `json:"storage_type,omitempty"`
	StoragePath     string    `json:"storage_path,omitempty"`
	MaxTotalSize    string    `json:"max_total_size,omitempty"`
	MaxAgeDays      *int      `json:"max_age_days,omitempty"`
	CleanupPolicy   string    `json:"cleanup_policy,omitempty"`
	CacheKeyPattern string    `json:"cache_key_pattern,omitempty"`
	CachePaths      []string  `json:"cache_paths" binding:"required"`
	Description     string    `json:"description,omitempty"`
}

// UpdateBuildCacheConfigInput is the payload for updating a cache config.
type UpdateBuildCacheConfigInput struct {
	Status        string    `json:"status,omitempty"`
	StorageType   string    `json:"storage_type,omitempty"`
	StoragePath   string    `json:"storage_path,omitempty"`
	MaxTotalSize  string    `json:"max_total_size,omitempty"`
	MaxAgeDays    *int      `json:"max_age_days,omitempty"`
	CleanupPolicy string    `json:"cleanup_policy,omitempty"`
	CacheKeyPattern string   `json:"cache_key_pattern,omitempty"`
	CachePaths    []string  `json:"cache_paths,omitempty"`
	Description   string    `json:"description,omitempty"`
}

// ListCacheConfigsOptions filters cache configs.
type ListCacheConfigsOptions struct {
	Level  CacheLevel
	Status CacheStatus
	Limit  int
	Offset int
}

// ListCacheEntriesOptions filters cache entries.
type ListCacheEntriesOptions struct {
	ConfigID string
	Limit    int
	Offset   int
}
