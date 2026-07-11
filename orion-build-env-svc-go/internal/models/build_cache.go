package models

import "time"

// BuildCacheConfig represents a build cache configuration
type BuildCacheConfig struct {
	ID         string                 `db:"id" json:"id"`
	TenantID   string                 `db:"tenant_id" json:"tenant_id"`
	Name       string                 `db:"name" json:"name"`
	Level      string                 `db:"level" json:"level"`
	Status     string                 `db:"status" json:"status"`
	ConfigData map[string]interface{} `db:"config_data" json:"config_data"`
	CreatedAt  time.Time              `db:"created_at" json:"created_at"`
	UpdatedAt  time.Time              `db:"updated_at" json:"updated_at"`
}

// CreateBuildCacheRequest represents a request to create a build cache config
type CreateBuildCacheRequest struct {
	Name       string                 `db:"-" json:"name" binding:"required"`
	Level      string                 `db:"-" json:"level" binding:"required"`
	ConfigData map[string]interface{} `db:"-" json:"config_data"`
}

// UpdateBuildCacheRequest represents a request to update a build cache config
type UpdateBuildCacheRequest struct {
	Name       *string                `db:"-" json:"name"`
	Level      *string                `db:"-" json:"level"`
	Status     *string                `db:"-" json:"status"`
	ConfigData map[string]interface{} `db:"-" json:"config_data"`
}

// BuildCacheEntry represents a cache entry
type BuildCacheEntry struct {
	ID         string                 `db:"id" json:"id"`
	TenantID   string                 `db:"tenant_id" json:"tenant_id"`
	PipelineID string                 `db:"pipeline_id" json:"pipeline_id"`
	CacheKey   string                 `db:"cache_key" json:"cache_key"`
	Data       map[string]interface{} `db:"data" json:"data"`
	CreatedAt  time.Time              `db:"created_at" json:"created_at"`
}
