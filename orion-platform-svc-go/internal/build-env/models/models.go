package models

import "time"

// --- Cache event types ---

// The event_type values cache_events accepts. The table enforces the same set
// with CHECK (event_type IN ('hit', 'miss', 'evict')) in migration 576, and the
// aggregates in the repository count only these three: an unknown type would
// insert fine and then be silently ignored by every COUNT(*) FILTER, so the
// request is validated here as well as at the table.
const (
	EventTypeHit   = "hit"
	EventTypeMiss  = "miss"
	EventTypeEvict = "evict"
)

// ValidEventType reports whether t is one of the three accepted event types.
func ValidEventType(t string) bool {
	switch t {
	case EventTypeHit, EventTypeMiss, EventTypeEvict:
		return true
	}
	return false
}

// Build represents a build record.
//
// Only the columns 016_create_build_env_tables.sql created in its original
// CREATE TABLE are mapped. Migration 016's own "补齐 builds" ALTER adds 14 more
// columns to this table and 572 adds updated_by, so a SELECT * scan of this
// struct fails with "missing destination name X" on every row. The repository
// selects the columns below by name instead.
type Build struct {
	ID            string    `json:"id" db:"id"`
	TenantID      string    `json:"tenant_id" db:"tenant_id"`
	Name          string    `json:"name" db:"name"`
	Status        string    `json:"status" db:"status"` // queued, running, success, failed
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

// BuildImage represents a build image record. Same column discipline as Build:
// 571 adds deleted_at and 572 adds created_by / updated_by, none of which are
// mapped here.
type BuildImage struct {
	ID         string    `json:"id" db:"id"`
	TenantID   string    `json:"tenant_id" db:"tenant_id"`
	Name       string    `json:"name" db:"name"`
	ImageTag   string    `json:"image_tag" db:"image_tag"`
	BaseImage  string    `json:"base_image" db:"base_image"`
	Dockerfile string    `json:"dockerfile" db:"dockerfile"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
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
//
// ID is a string because build_cache_configs.id is UUID in migration 016. It
// used to be int: the service ran strconv.Atoi on the path parameter, so every
// real UUID-shaped id was rejected with 400 "invalid config id" before it ever
// reached the driver, and the repository bound an integer to WHERE id=$1, where
// Postgres has no uuid = integer operator. GET, PUT and DELETE
// /build-env/build-cache/:id were all dead. Build and BuildImage already used
// string ids; these two had drifted.
type BuildCacheConfig struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Level     string    `json:"level" db:"level"`   // local, remote
	Status    string    `json:"status" db:"status"` // active, inactive
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

// BuildCacheEntry represents a cache entry. Unread by any repository method.
// build_cache_entries.id is UUID and config_id is BIGINT while
// build_cache_configs.id is UUID, so this mapping does not describe the table:
// config_id cannot hold a cache config id at all. Left as-is and recorded as
// schema debt rather than "fixed" by guessing the intended relationship.
type BuildCacheEntry struct {
	ID        int        `json:"id" db:"id"`
	ConfigID  int        `json:"config_id" db:"config_id"`
	Key       string     `json:"key" db:"key"`
	Value     string     `json:"value" db:"value"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
	ExpiresAt *time.Time `json:"expires_at" db:"expires_at"`
}

// BuildLog represents a build log record. ID is a string for the same reason as
// BuildCacheConfig.ID above.
type BuildLog struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	BuildID   string    `json:"build_id" db:"build_id"`
	LogData   string    `json:"log_data" db:"log_data"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// --- Cache monitor ---

// CacheDashboard represents the cache monitoring dashboard.
//
// The two telemetry fields are pointers: with no cache events recorded there is
// no hit rate and no average latency, and reporting 0.0 for both invented a
// "healthy cache with no traffic" reading. null in JSON means no data. The
// config counts are plain ints because COUNT(*) is defined for an empty set.
type CacheDashboard struct {
	TotalConfigs  int      `json:"total_configs"`
	ActiveConfigs int      `json:"active_configs"`
	CacheHitRate  *float64 `json:"cache_hit_rate"`
	AvgLatencyMs  *float64 `json:"avg_latency_ms"`
}

// CacheMetrics represents metrics for a single cache. HitRate is the share of
// hit events among hit + miss events and is 0 when the cache has no probe
// traffic. AvgLatencyMs is the mean of latency_saved_ms over hit events and is
// null when there is no hit with a recorded latency.
type CacheMetrics struct {
	CacheID      string   `json:"cache_id"`
	Hits         int      `json:"hits"`
	Misses       int      `json:"misses"`
	HitRate      float64  `json:"hit_rate"`
	AvgLatencyMs *float64 `json:"avg_latency_ms"`
}

// CacheHealth represents health assessment for a cache. Healthy is false when
// the cache has no probe traffic at all (nothing to assess), when its hit rate
// falls below the threshold, or when its most recent probe is older than the
// freshness window. Reason states which condition decided, so a caller can tell
// "no data" apart from "bad data" — the old implementation returned Healthy:
// true unconditionally, so a cache that had never been probed reported as
// healthy.
type CacheHealth struct {
	CacheID   string    `json:"cache_id"`
	Healthy   bool      `json:"healthy"`
	Reason    string    `json:"reason,omitempty"`
	LastCheck time.Time `json:"last_check"`
}

// CachePerformanceImpact represents performance impact analysis for one
// pipeline. TotalBuilds is the number of distinct build ids seen in any event
// for the pipeline, BuildsWithCache is the number seen in a hit event, and
// TimeSavedMs is the sum of latency_saved_ms over hit events. All three are
// zero for a pipeline with no recorded events, which is the honest answer
// rather than the empty struct the previous implementation returned.
type CachePerformanceImpact struct {
	PipelineID      string  `json:"pipeline_id"`
	TimeSavedMs     float64 `json:"time_saved_ms"`
	BuildsWithCache int     `json:"builds_with_cache"`
	TotalBuilds     int     `json:"total_builds"`
}

// RecordCacheEventRequest represents the request body for recording a cache event.
//
// PipelineID and BuildID are optional and non-breaking: they were not in the
// request when the endpoint was written, and adding them is what makes
// /cache-monitor/impact/:pipelineId computable at all — the impact analysis
// groups cache_events by pipeline_id, so an event without one cannot be
// attributed to any pipeline.
type RecordCacheEventRequest struct {
	CacheID        string   `json:"cache_id" binding:"required"`
	EventType      string   `json:"event_type" binding:"required"` // hit, miss, evict
	LatencySavedMs *float64 `json:"latency_saved_ms"`
	PipelineID     *string  `json:"pipeline_id"`
	BuildID        *string  `json:"build_id"`
}
