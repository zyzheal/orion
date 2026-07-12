package models

import "time"

// Build represents a build record.
type Build struct {
	ID            string    `json:"id" db:"id"`
	TenantID      string    `json:"tenant_id" db:"tenant_id"`
	Name          string    `json:"name" db:"name"`
	Status        string    `json:"status" db:"status"`        // queued, running, success, failed
	PipelineID    string    `json:"pipeline_id" db:"pipeline_id"`
	ProductLineID string    `json:"product_line_id" db:"product_line_id"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

type CreateBuildRequest struct {
	Name          string `json:"name" binding:"required"`
	Status        string `json:"status"`
	PipelineID    string `json:"pipeline_id"`
	ProductLineID string `json:"product_line_id"`
}

type UpdateBuildRequest struct {
	Name          *string `json:"name"`
	Status        *string `json:"status"`
	PipelineID    *string `json:"pipeline_id"`
	ProductLineID *string `json:"product_line_id"`
}

// BuildImage represents a build image record.
type BuildImage struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	ImageTag    string    `json:"image_tag" db:"image_tag"`
	BaseImage   string    `json:"base_image" db:"base_image"`
	Dockerfile  string    `json:"dockerfile" db:"dockerfile"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type CreateBuildImageRequest struct {
	Name       string `json:"name" binding:"required"`
	ImageTag   string `json:"image_tag"`
	BaseImage  string `json:"base_image"`
	Dockerfile string `json:"dockerfile"`
}

type UpdateBuildImageRequest struct {
	Name       *string `json:"name"`
	ImageTag   *string `json:"image_tag"`
	BaseImage  *string `json:"base_image"`
	Dockerfile *string `json:"dockerfile"`
}

// BuildCacheConfig represents a build cache configuration.
type BuildCacheConfig struct {
	ID        int       `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Level     string    `json:"level" db:"level"`     // local, remote
	Status    string    `json:"status" db:"status"`   // active, inactive
	CacheDir  string    `json:"cache_dir" db:"cache_dir"`
	TTLHours  int       `json:"ttl_hours" db:"ttl_hours"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type CreateBuildCacheConfigRequest struct {
	Name     string `json:"name" binding:"required"`
	Level    string `json:"level"`
	Status   string `json:"status"`
	CacheDir string `json:"cache_dir"`
	TTLHours int    `json:"ttl_hours"`
}

type UpdateBuildCacheConfigRequest struct {
	Name     *string `json:"name"`
	Level    *string `json:"level"`
	Status   *string `json:"status"`
	CacheDir *string `json:"cache_dir"`
	TTLHours *int    `json:"ttl_hours"`
}

// BuildCacheEntry represents a cache entry.
type BuildCacheEntry struct {
	ID        int       `json:"id" db:"id"`
	ConfigID  int       `json:"config_id" db:"config_id"`
	Key       string    `json:"key" db:"key"`
	Value     string    `json:"value" db:"value"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	ExpiresAt *time.Time `json:"expires_at" db:"expires_at"`
}

// BuildLog represents a build log record.
type BuildLog struct {
	ID        int       `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	BuildID   string    `json:"build_id" db:"build_id"`
	LogData   string    `json:"log_data" db:"log_data"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// --- Cache monitor ---

// CacheDashboard represents the cache monitoring dashboard.
type CacheDashboard struct {
	TotalConfigs  int     `json:"total_configs"`
	ActiveConfigs int     `json:"active_configs"`
	CacheHitRate  float64 `json:"cache_hit_rate"`
	AvgLatencyMs  float64 `json:"avg_latency_ms"`
}

// CacheMetrics represents metrics for a single cache.
type CacheMetrics struct {
	CacheID      string  `json:"cache_id"`
	Hits         int     `json:"hits"`
	Misses       int     `json:"misses"`
	HitRate      float64 `json:"hit_rate"`
	AvgLatencyMs float64 `json:"avg_latency_ms"`
}

// CacheHealth represents health assessment for a cache.
type CacheHealth struct {
	CacheID   string `json:"cache_id"`
	Healthy   bool   `json:"healthy"`
	Reason    string `json:"reason,omitempty"`
	LastCheck time.Time `json:"last_check"`
}

// CachePerformanceImpact represents performance impact analysis.
type CachePerformanceImpact struct {
	PipelineID     string  `json:"pipeline_id"`
	TimeSavedMs    float64 `json:"time_saved_ms"`
	BuildsWithCache int    `json:"builds_with_cache"`
	TotalBuilds    int     `json:"total_builds"`
}

// RecordCacheEventRequest represents the request body for recording a cache event.
type RecordCacheEventRequest struct {
	CacheID       string  `json:"cache_id" binding:"required"`
	EventType     string  `json:"event_type" binding:"required"` // hit, miss, evict
	LatencySavedMs *float64 `json:"latency_saved_ms"`
}
