package models

import "time"

// BuildStatus represents the build execution status.
type BuildStatus string

const (
	BuildStatusPending   BuildStatus = "pending"
	BuildStatusRunning   BuildStatus = "running"
	BuildStatusSuccess   BuildStatus = "success"
	BuildStatusFailed    BuildStatus = "failed"
	BuildStatusCancelled BuildStatus = "cancelled"
)

// Build is a build record.
type Build struct {
	ID             string            `json:"id" db:"id"`
	TenantID       string            `json:"tenantId" db:"tenant_id"`
	ProjectID      string            `json:"projectId" db:"project_id"`
	PipelineRunID  string            `json:"pipelineRunId" db:"pipeline_run_id"`
	SourceRef      string            `json:"sourceRef" db:"source_ref"`
	Status         BuildStatus       `json:"status" db:"status"`
	Image          string            `json:"image" db:"image"`
	Tag            string            `json:"tag" db:"tag"`
	BuildArgs      string            `json:"buildArgs" db:"build_args"`     // JSONB
	Logs           string            `json:"logs" db:"logs"`               // JSONB
	Duration       int64             `json:"duration" db:"duration"`       // seconds
	Error          string            `json:"error" db:"error"`
	CreatedBy      string            `json:"createdBy" db:"created_by"`
	CreatedAt      time.Time         `json:"createdAt" db:"created_at"`
	UpdatedAt      time.Time         `json:"updatedAt" db:"updated_at"`
	StartedAt      *time.Time        `json:"startedAt" db:"started_at"`
	CompletedAt    *time.Time        `json:"completedAt" db:"completed_at"`
}

// BuildEnvironment is a build environment configuration.
type BuildEnvironment struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenantId" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	Image       string    `json:"image" db:"image"`
	Description string    `json:"description" db:"description"`
	Config      string    `json:"config" db:"config"`   // JSONB
	Enabled     bool      `json:"enabled" db:"enabled"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time `json:"updatedAt" db:"updated_at"`
}

// CreateBuildRequest is the body for creating a build.
type CreateBuildRequest struct {
	ProjectID     string            `json:"projectId"`
	PipelineRunID string            `json:"pipelineRunId"`
	SourceRef     string            `json:"sourceRef"`
	BuildArgs     map[string]any    `json:"buildArgs"`
}

// CreateEnvironmentRequest is the body for creating a build environment.
type CreateEnvironmentRequest struct {
	Name        string            `json:"name" binding:"required"`
	Image       string            `json:"image" binding:"required"`
	Description string            `json:"description"`
	Config      map[string]any    `json:"config"`
}

// UpdateEnvironmentRequest is the body for updating a build environment.
type UpdateEnvironmentRequest struct {
	Name        *string           `json:"name"`
	Image       *string           `json:"image"`
	Description *string           `json:"description"`
	Config      *map[string]any   `json:"config"`
	Enabled     *bool             `json:"enabled"`
}

// ListBuildsOptions holds optional filters for listing builds.
type ListBuildsOptions struct {
	ProjectID string `json:"projectId"`
	Status    string `json:"status"`
	Page      int    `json:"page"`
	Limit     int    `json:"limit"`
}

// BuildStats holds aggregated build statistics.
type BuildStats struct {
	Total       int   `json:"total"`
	Success     int   `json:"success"`
	Failed      int   `json:"failed"`
	Running     int   `json:"running"`
	Pending     int   `json:"pending"`
	AvgDuration int64 `json:"avgDuration"`
}

// PaginatedResult is a generic paginated response.
type PaginatedResult struct {
	Data       []any `json:"data"`
	Total      int   `json:"total"`
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	TotalPages int   `json:"totalPages"`
}