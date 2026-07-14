package models

import (
	"time"
)

// VersionStatus represents the lifecycle state of a pipeline version.
type VersionStatus string

const (
	StatusDraft        VersionStatus = "draft"
	StatusPendingReview VersionStatus = "pending_review"
	StatusPublished    VersionStatus = "published"
	StatusDeprecated   VersionStatus = "deprecated"
	StatusArchived     VersionStatus = "archived"
)

// Version represents a pipeline version record.
type Version struct {
	ID              string        `json:"id" db:"id"`
	TenantID        string        `json:"tenantId" db:"tenant_id"`
	PipelineID      string        `json:"pipelineId" db:"pipeline_id"`
	VersionNum      string        `json:"version" db:"version"`
	Name            string        `json:"name" db:"name"`
	Description     *string       `json:"description" db:"description"`
	Config          string        `json:"config" db:"config"`       // JSONB
	Status          VersionStatus `json:"status" db:"status"`
	IsDefault       bool          `json:"isDefault" db:"is_default"`
	CreatedBy       string        `json:"createdBy" db:"created_by"`
	CreatedAt       time.Time     `json:"createdAt" db:"created_at"`
	UpdatedAt       time.Time     `json:"updatedAt" db:"updated_at"`
	PublishedAt     *time.Time    `json:"publishedAt,omitempty" db:"published_at"`
	DeprecatedAt    *time.Time    `json:"deprecatedAt,omitempty" db:"deprecated_at"`
	ChangeLog       *string       `json:"changeLog,omitempty" db:"change_log"`
	Tags            string        `json:"tags" db:"tags"`           // JSON array string
	ParentVersionID *string       `json:"parentVersionId,omitempty" db:"parent_version_id"`
}

// --- Request DTOs ---

// CreateVersionRequest is the request body for creating a new version.
type CreateVersionRequest struct {
	Name         string           `json:"name" binding:"required"`
	Description  *string          `json:"description"`
	Config       string           `json:"config" binding:"required"`
	BaseVersionID *string         `json:"baseVersionId"`
	ChangeLog    *string          `json:"changeLog"`
	Tags         *string          `json:"tags"` // JSON array string, e.g. "[\"tag1\",\"tag2\"]"
}

// UpdateVersionRequest is the request body for updating a version.
type UpdateVersionRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Config      *string `json:"config"`
	ChangeLog   *string `json:"changeLog"`
	Tags        *string `json:"tags"` // JSON array string
}

// CompareVersionsRequest is the request body for comparing two versions.
type CompareVersionsRequest struct {
	FromVersionID string `json:"fromVersionId" binding:"required"`
	ToVersionID   string `json:"toVersionId" binding:"required"`
	IncludeConfig *bool  `json:"includeConfig"`
}

// PublishVersionRequest is the request body for publishing a version.
type PublishVersionRequest struct {
	ReleaseNotes *string `json:"releaseNotes"`
	MakeDefault  *bool   `json:"makeDefault"`
}

// RollbackVersionRequest is the request body for rolling back a version.
type RollbackVersionRequest struct {
	Reason          string  `json:"reason" binding:"required"`
	TargetVersionID *string `json:"targetVersionId"`
}

// --- Query / Result ---

// ListQuery holds pagination and filter parameters for listing versions.
type ListQuery struct {
	Status *VersionStatus
	Tags   *string // Comma-separated or JSON array string
	Offset int
	Limit  int
	Sort   string
	Order  string
}

// VersionListResult is the paginated list response.
type VersionListResult struct {
	Data  []Version `json:"data"`
	Total int       `json:"total"`
}

// CompareResult is the result of a version comparison.
type CompareResult struct {
	From    Version            `json:"from"`
	To      Version            `json:"to"`
	Diff    map[string]any     `json:"diff"`
	Fields  []string           `json:"fields"`
}
