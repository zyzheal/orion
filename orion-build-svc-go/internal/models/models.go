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
