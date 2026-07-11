package models

import "time"

// CacheEvent represents a recorded cache event
type CacheEvent struct {
	ID           string    `db:"id" json:"id"`
	TenantID     string    `db:"tenant_id" json:"tenant_id"`
	CacheID      string    `db:"cache_id" json:"cache_id"`
	EventType    string    `db:"event_type" json:"event_type"`
	LatencySaved int64     `db:"latency_saved_ms" json:"latency_saved_ms"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

// RecordCacheEventRequest represents a request to record a cache event
type RecordCacheEventRequest struct {
	CacheID       string `db:"-" json:"cache_id" binding:"required"`
	EventType     string `db:"-" json:"event_type" binding:"required"`
	LatencySavedMs int64 `db:"-" json:"latency_saved_ms"`
}

// CacheMetrics represents cache performance metrics
type CacheMetrics struct {
	CacheID           string `json:"cache_id"`
	HitCount          int64  `json:"hit_count"`
	MissCount         int64  `json:"miss_count"`
	HitRate           float64 `json:"hit_rate"`
	AvgLatencySavedMs float64 `json:"avg_latency_saved_ms"`
}

// CacheHealth represents cache health assessment
type CacheHealth struct {
	CacheID  string  `json:"cache_id"`
	Healthy  bool    `json:"healthy"`
	HitRate  float64 `json:"hit_rate"`
	Score    int     `json:"score"`
	Message  string  `json:"message"`
}

// CacheDashboard represents the cache monitoring dashboard
type CacheDashboard struct {
	TenantID   string                `json:"tenant_id"`
	Configs    int                   `json:"configs"`
	TotalHits  int64                 `json:"total_hits"`
	TotalMisses int64                `json:"total_misses"`
	HitRate    float64               `json:"hit_rate"`
	TopCaches  []CacheMetrics        `json:"top_caches"`
}

// PerformanceImpact represents cache performance impact analysis
type PerformanceImpact struct {
	PipelineID        string  `json:"pipeline_id"`
	TenantID          string  `json:"tenant_id"`
	CacheHits         int64   `json:"cache_hits"`
	TimeSavedMs       int64   `json:"time_saved_ms"`
	CacheUtilization  float64 `json:"cache_utilization"`
}
