package models

import "time"

// Build represents a build record
type Build struct {
	ID         string                 `db:"id" json:"id"`
	TenantID   string                 `db:"tenant_id" json:"tenant_id"`
	PipelineID string                 `db:"pipeline_id" json:"pipeline_id"`
	Status     string                 `db:"status" json:"status"`
	StartedAt  time.Time              `db:"started_at" json:"started_at"`
	FinishedAt *time.Time             `db:"finished_at" json:"finished_at"`
	Metadata   map[string]interface{} `db:"metadata" json:"metadata"`
	CreatedAt  time.Time              `db:"created_at" json:"created_at"`
	UpdatedAt  time.Time              `db:"updated_at" json:"updated_at"`
}

// CreateBuildRequest represents a request to create a build
type CreateBuildRequest struct {
	PipelineID string                 `db:"-" json:"pipeline_id" binding:"required"`
	Status     string                 `db:"-" json:"status" binding:"required"`
	Metadata   map[string]interface{} `db:"-" json:"metadata"`
}

// UpdateBuildRequest represents a request to update a build
type UpdateBuildRequest struct {
	Status     string                 `db:"-" json:"status"`
	Metadata   map[string]interface{} `db:"-" json:"metadata"`
	FinishedAt *time.Time             `db:"-" json:"finished_at"`
}
