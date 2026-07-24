package models

import "time"

// Pipeline represents a data pipeline definition (source → transformation → target).
type Pipeline struct {
	ID                   string    `json:"id" db:"id"`
	Name                 string    `json:"name" db:"name" binding:"required"`
	Description          string    `json:"description" db:"description"`
	SourceTable          string    `json:"sourceTable" db:"source_table"`
	TargetTable          string    `json:"targetTable" db:"target_table"`
	TransformationScript string    `json:"transformationScript" db:"transformation_script"`
	Schedule             string    `json:"schedule" db:"schedule"`
	Status               string    `json:"status" db:"status"`
	TenantID             string    `json:"tenantId" db:"tenant_id"`
	CreatedAt            time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt            time.Time `json:"updatedAt" db:"updated_at"`
}

// PipelineRun tracks a single execution of a data pipeline.
type PipelineRun struct {
	ID           string    `json:"id" db:"id"`
	PipelineID   string    `json:"pipelineId" db:"pipeline_id"`
	Status       string    `json:"status" db:"status"`
	StartedAt    time.Time `json:"startedAt" db:"started_at"`
	FinishedAt   time.Time `json:"finishedAt" db:"finished_at"`
	ErrorMessage string    `json:"errorMessage" db:"error_message"`
	Metrics      string    `json:"metrics" db:"metrics_json"`
	TenantID     string    `json:"tenantId" db:"tenant_id"`
	CreatedAt    time.Time `json:"createdAt" db:"created_at"`
}

// ListQuery is the query parameters for listing pipelines.
type ListQuery struct {
	Page   int    `json:"page" query:"page"`
	Limit  int    `json:"limit" query:"limit"`
	Status string `json:"status" query:"status"`
}

// CreateRequest is the request body for creating a new pipeline.
type CreateRequest struct {
	Name                 string `json:"name" binding:"required"`
	Description          string `json:"description"`
	SourceTable          string `json:"sourceTable"`
	TargetTable          string `json:"targetTable"`
	TransformationScript string `json:"transformationScript"`
	Schedule             string `json:"schedule"`
	Status               string `json:"status"`
}
