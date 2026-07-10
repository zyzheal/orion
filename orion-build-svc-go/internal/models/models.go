package models

import (
	"encoding/json"
	"time"
)

// ==================== Build ====================

// Build represents a build record, extended from the Node.js BuildRepository schema.
type Build struct {
	ID            string          `db:"id" json:"id"`
	TenantID      string          `db:"tenant_id" json:"tenant_id"`
	ProjectID     *string         `db:"project_id" json:"project_id,omitempty"`
	PipelineRunID *string         `db:"pipeline_run_id" json:"pipeline_run_id,omitempty"`
	RepoID        *string         `db:"repo_id" json:"repo_id,omitempty"`
	Branch        string          `db:"branch" json:"branch"`
	CommitSHA     string          `db:"commit_sha" json:"commit_sha"`
	Image         *string         `db:"image" json:"image,omitempty"`
	Tag           *string         `db:"tag" json:"tag,omitempty"`
	Status        string          `db:"status" json:"status"`
	SourceRef     *string         `db:"source_ref" json:"source_ref,omitempty"`
	BuildArgs     json.RawMessage `db:"build_args" json:"build_args,omitempty"`
	StartedAt     *time.Time      `db:"started_at" json:"started_at,omitempty"`
	CompletedAt   *time.Time      `db:"completed_at" json:"completed_at,omitempty"`
	DurationMs    *int64          `db:"duration_ms" json:"duration_ms,omitempty"`
	ErrorMessage  *string         `db:"error_message" json:"error_message,omitempty"`
	Logs          *string         `db:"logs" json:"logs,omitempty"`
	CreatedAt     time.Time       `db:"created_at" json:"created_at"`
}

// CreateBuildInput is the payload for creating a new build.
type CreateBuildInput struct {
	TenantID      string          `json:"tenant_id"`
	ProjectID     string          `json:"project_id,omitempty"`
	PipelineRunID string          `json:"pipeline_run_id,omitempty"`
	RepoID        string          `json:"repo_id,omitempty"`
	Branch        string          `json:"branch,omitempty"`
	CommitSHA     string          `json:"commit_sha,omitempty"`
	Image         string          `json:"image,omitempty"`
	Tag           string          `json:"tag,omitempty"`
	SourceRef     string          `json:"source_ref,omitempty"`
	BuildArgs     json.RawMessage `json:"build_args,omitempty"`
}

// ListBuildsFilter holds query parameters for listing builds.
type ListBuildsFilter struct {
	TenantID  string
	ProjectID string
	Status    string
}

// ==================== Build Environment ====================

// BuildEnvironment represents a build environment configuration.
type BuildEnvironment struct {
	ID          string          `db:"id" json:"id"`
	TenantID    string          `db:"tenant_id" json:"tenant_id"`
	Name        string          `db:"name" json:"name"`
	Type        string          `db:"type" json:"type"`
	Image       string          `db:"image" json:"image"`
	Description *string         `db:"description" json:"description,omitempty"`
	Config      json.RawMessage `db:"config" json:"config,omitempty"`
	Status      string          `db:"status" json:"status"`
	CreatedAt   time.Time       `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time       `db:"updated_at" json:"updated_at"`
}

// CreateEnvironmentInput is the payload for creating a build environment.
type CreateEnvironmentInput struct {
	TenantID    string          `json:"tenant_id"`
	Name        string          `json:"name" binding:"required"`
	Type        string          `json:"type" binding:"required"`
	Image       string          `json:"image" binding:"required"`
	Description string          `json:"description,omitempty"`
	Config      json.RawMessage `json:"config,omitempty"`
}

// ==================== Artifact ====================

// Artifact represents a build artifact.
type Artifact struct {
	ID              string          `db:"id" json:"id"`
	TenantID        string          `db:"tenant_id" json:"tenant_id"`
	Name            string          `db:"name" json:"name"`
	Type            string          `db:"type" json:"type"`
	StorageType     string          `db:"storage_type" json:"storage_type"`
	StoragePath     string          `db:"storage_path" json:"storage_path"`
	SizeBytes       int64           `db:"size_bytes" json:"size_bytes"`
	ChecksumSHA256  *string         `db:"checksum_sha256" json:"checksum_sha256,omitempty"`
	RunID           string          `db:"run_id" json:"run_id"`
	StageID         *string         `db:"stage_id" json:"stage_id,omitempty"`
	ExpiresAt       *time.Time      `db:"expires_at" json:"expires_at,omitempty"`
	DownloadedCount int             `db:"downloaded_count" json:"downloaded_count"`
	Metadata        json.RawMessage `db:"metadata" json:"metadata,omitempty"`
	CreatedAt       time.Time       `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time       `db:"updated_at" json:"updated_at"`
}

// CreateArtifactInput is the payload for creating an artifact.
type CreateArtifactInput struct {
	TenantID       string          `json:"tenant_id"`
	Name           string          `json:"name" binding:"required"`
	Type           string          `json:"type" binding:"required"`
	StorageType    string          `json:"storage_type,omitempty"`
	StoragePath    string          `json:"storage_path" binding:"required"`
	SizeBytes      int64           `json:"size_bytes,omitempty"`
	ChecksumSHA256 string          `json:"checksum_sha256,omitempty"`
	RunID          string          `json:"run_id" binding:"required"`
	StageID        string          `json:"stage_id,omitempty"`
	ExpiresAt      *time.Time      `json:"expires_at,omitempty"`
	Metadata       json.RawMessage `json:"metadata,omitempty"`
}

// ListArtifactFilter holds query parameters for listing artifacts.
type ListArtifactFilter struct {
	RunID   string
	StageID string
	Type    string
}

// ==================== Build Stats ====================

// BuildStats holds aggregated build statistics.
type BuildStats struct {
	Total       int     `db:"total" json:"total"`
	Success     int     `db:"success" json:"success"`
	Failed      int     `db:"failed" json:"failed"`
	Running     int     `db:"running" json:"running"`
	Pending     int     `db:"pending" json:"pending"`
	AvgDuration float64 `db:"avg_duration" json:"avg_duration"`
}

// ==================== Pagination ====================

// PaginatedRequest is a generic pagination helper.
type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}

// PaginatedResult wraps a paginated response.
type PaginatedResult struct {
	Data       interface{} `json:"data"`
	Total      int         `json:"total"`
	Page       int         `json:"page"`
	Limit      int         `json:"limit"`
	TotalPages int         `json:"total_pages"`
}

// ==================== Builder Image ====================

// BuilderImage represents a builder image (Node.js BuilderImageService).
type BuilderImage struct {
	ID          string          `db:"id" json:"id"`
	TenantID    string          `db:"tenant_id" json:"tenant_id"`
	Name        string          `db:"name" json:"name"`
	DisplayName string          `db:"display_name" json:"display_name"`
	Image       string          `db:"image" json:"image"`
	Type        string          `db:"type" json:"type"` // node, python, go, java, dotnet, rust
	Version     string          `db:"version" json:"version"`
	Description string          `db:"description" json:"description"`
	PullPolicy  string          `db:"pull_policy" json:"pull_policy"` // if_not_present, always, never
	Status      string          `db:"status" json:"status"` // active, deprecated, disabled
	IsPreset    bool            `db:"is_preset" json:"is_preset"`
	Env         json.RawMessage `db:"env" json:"env,omitempty"`
	Labels      json.RawMessage `db:"labels" json:"labels,omitempty"`
	CreatedBy   *string         `db:"created_by" json:"created_by,omitempty"`
	CreatedAt   time.Time       `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time       `db:"updated_at" json:"updated_at"`
}

// CreateBuilderImageInput is the payload for creating a builder image.
type CreateBuilderImageInput struct {
	TenantID    string          `json:"tenant_id"`
	Name        string          `json:"name" binding:"required"`
	DisplayName string          `json:"display_name"`
	Image       string          `json:"image" binding:"required"`
	Type        string          `json:"type" binding:"required"`
	Version     string          `json:"version"`
	Description string          `json:"description"`
	PullPolicy  string          `json:"pull_policy"`
	Env         json.RawMessage `json:"env,omitempty"`
	Labels      json.RawMessage `json:"labels,omitempty"`
}

// ListBuilderImageFilter holds query parameters for listing builder images.
type ListBuilderImageFilter struct {
	Type     string
	Status   string
	IsPreset *bool // nil = not specified, true/false = filter by preset
}

// ==================== Build Cache Config ====================

// BuildCacheConfig represents a build cache configuration (Node.js BuildCacheService).
type BuildCacheConfig struct {
	ID             string          `db:"id" json:"id"`
	TenantID       string          `db:"tenant_id" json:"tenant_id"`
	Level          string          `db:"level" json:"level"` // global, pipeline, task
	TargetID       *string         `db:"target_id" json:"target_id,omitempty"`
	Status         string          `db:"status" json:"status"` // enabled, disabled
	StorageType    string          `db:"storage_type" json:"storage_type"` // local, s3, redis
	StoragePath    string          `db:"storage_path" json:"storage_path"`
	MaxTotalSize   int64           `db:"max_total_size" json:"max_total_size"`
	MaxAgeDays     int             `db:"max_age_days" json:"max_age_days"`
	CleanupPolicy  string          `db:"cleanup_policy" json:"cleanup_policy"` // lru, expired, none
	CacheKeyPattern string         `db:"cache_key_pattern" json:"cache_key_pattern"`
	CachePaths     json.RawMessage `db:"cache_paths" json:"cache_paths,omitempty"`
	Description    *string         `db:"description" json:"description,omitempty"`
	CreatedAt      time.Time       `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time       `db:"updated_at" json:"updated_at"`
}

// CreateBuildCacheConfigInput is the payload for creating a cache config.
type CreateBuildCacheConfigInput struct {
	TenantID        string          `json:"tenant_id"`
	Level           string          `json:"level" binding:"required"`
	TargetID        string          `json:"target_id"`
	Status          string          `json:"status"`
	StorageType     string          `json:"storage_type"`
	StoragePath     string          `json:"storage_path"`
	MaxTotalSize    int64           `json:"max_total_size"`
	MaxAgeDays      int             `json:"max_age_days"`
	CleanupPolicy   string          `json:"cleanup_policy"`
	CacheKeyPattern string          `json:"cache_key_pattern"`
	CachePaths      json.RawMessage `json:"cache_paths,omitempty"`
	Description     string          `json:"description"`
}

// UpdateBuildCacheConfigInput is the payload for updating a cache config.
type UpdateBuildCacheConfigInput struct {
	Status        string          `json:"status"`
	StorageType   string          `json:"storage_type"`
	StoragePath   string          `json:"storage_path"`
	MaxTotalSize  int64           `json:"max_total_size"`
	MaxAgeDays    int             `json:"max_age_days"`
	CleanupPolicy string          `json:"cleanup_policy"`
	CacheKeyPattern string        `json:"cache_key_pattern"`
	CachePaths    json.RawMessage `json:"cache_paths,omitempty"`
	Description   string          `json:"description"`
}

// ListCacheConfigFilter holds query parameters for listing cache configs.
type ListCacheConfigFilter struct {
	Level  string
	Status string
}
