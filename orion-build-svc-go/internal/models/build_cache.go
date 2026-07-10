package models

// ==================== Build Cache (canonical types in models.go) ====================
// BuildCacheConfig, CacheEntry, CreateBuildCacheConfigInput,
// UpdateBuildCacheConfigInput are defined in models.go.
//
// Additional domain-only types below — these are NOT in models.go because
// they are only used by the build cache service.

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
