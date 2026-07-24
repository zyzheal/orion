package models

import "time"

// PipelineStatus represents the lifecycle state of a pipeline.
type PipelineStatus string

const (
	PipelineStatusActive   PipelineStatus = "active"
	PipelineStatusInactive PipelineStatus = "inactive"
	PipelineStatusDraft    PipelineStatus = "draft"
)

// PipelineTriggerType is the trigger mechanism for a pipeline.
type PipelineTriggerType string

const (
	TriggerTypeManual   PipelineTriggerType = "manual"
	TriggerTypeWebhook  PipelineTriggerType = "webhook"
	TriggerTypeSchedule PipelineTriggerType = "schedule"
	TriggerTypeEvent    PipelineTriggerType = "event"
)

// Pipeline is the core pipeline entity.
type Pipeline struct {
	ID             string              `json:"id" db:"id"`
	TenantID       string              `json:"tenantId" db:"tenant_id"`
	ProjectID      string              `json:"projectId" db:"project_id"`
	Name           string              `json:"name" db:"name"`
	Description    string              `json:"description" db:"description"`
	TriggerType    PipelineTriggerType `json:"triggerType" db:"trigger_type"`
	Status         PipelineStatus      `json:"status" db:"status"`
	Version        int                 `json:"version" db:"version"`
	YamlDefinition string              `json:"yamlDefinition" db:"yaml_definition"`
	Spec           string              `json:"spec" db:"spec"`     // JSONB
	Config         string              `json:"config" db:"config"` // JSONB
	CreatedBy      string              `json:"createdBy" db:"created_by"`
	CreatedAt      time.Time           `json:"createdAt" db:"created_at"`
	UpdatedAt      time.Time           `json:"updatedAt" db:"updated_at"`
}

// CreatePipelineRequest is the body for creating a pipeline.
type CreatePipelineRequest struct {
	ProjectID      string `json:"projectId"`
	Name           string `json:"name" binding:"required"`
	Description    string `json:"description"`
	TriggerType    string `json:"triggerType"`
	YamlDefinition string `json:"yamlDefinition"`
	Version        int    `json:"version"`
}

// UpdatePipelineRequest is the body for updating a pipeline.
type UpdatePipelineRequest struct {
	Description    *string `json:"description"`
	YamlDefinition *string `json:"yamlDefinition"`
	Status         *string `json:"status"`
}

// ListPipelinesOptions holds optional filters for listing pipelines.
type ListPipelinesOptions struct {
	ProjectID string `json:"projectId"`
	Status    string `json:"status"`
	Name      string `json:"name"`
	Page      int    `json:"page"`
	Limit     int    `json:"limit"`
}

// PipelineVersion represents a version snapshot.
type PipelineVersion struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Version     int            `json:"version"`
	Description string         `json:"description"`
	Status      PipelineStatus `json:"status"`
	CreatedAt   time.Time      `json:"createdAt"`
}

// PipelineValidationResult is the validation outcome.
type PipelineValidationResult struct {
	Valid  bool     `json:"valid"`
	Errors []string `json:"errors"`
}

// PipelineRunResult is the result of triggering a run.
type PipelineRunResult struct {
	ID         string `json:"id"`
	PipelineID string `json:"pipelineId"`
	Status     string `json:"status"`
}

// PipelineStats holds aggregated pipeline statistics.
type PipelineStats struct {
	TotalRuns   int   `json:"totalRuns"`
	SuccessRuns int   `json:"successRuns"`
	FailedRuns  int   `json:"failedRuns"`
	RunningRuns int   `json:"runningRuns"`
	AvgDuration int64 `json:"avgDuration"`
}

// BatchStartResult is the per-pipeline result for batch start.
type BatchStartResult struct {
	PipelineID string `json:"pipelineId"`
	RunID      string `json:"runId"`
	Status     string `json:"status"`
	Error      string `json:"error,omitempty"`
}

// BatchStopResult is the per-run result for batch stop.
type BatchStopResult struct {
	ExecutionID string `json:"executionId"`
	Status      string `json:"status"`
	Error       string `json:"error,omitempty"`
}

// BatchDeleteResult is the per-pipeline result for batch delete.
type BatchDeleteResult struct {
	PipelineID string `json:"pipelineId"`
	Deleted    bool   `json:"deleted"`
	Error      string `json:"error,omitempty"`
}
