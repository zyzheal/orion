package models

import "time"

// PipelineTask represents an execution job that triggers a pipeline run.
// It extends the standard Job with pipeline-specific parameters such as
// pipelineID, pipelineName, and runtime inputs forwarded to the pipeline engine.
type PipelineTask struct {
	Job              // embedded base job

	// PipelineID is the unique identifier of the pipeline to execute.
	// This is the primary key used by the PipelineExecutor.
	PipelineID string `json:"pipeline_id" db:"pipeline_id"`

	// PipelineName is a human-readable name for display/audit purposes.
	PipelineName string `json:"pipeline_name" db:"pipeline_name"`

	// TenantID for multi-tenant isolation (overrides Job.TenantID if set).
	// The plugin reads this from the context or from params["tenant_id"].
	TenantID string `json:"tenant_id" db:"tenant_id"`

	// Inputs are runtime parameters forwarded to the pipeline's first step.
	// They are passed as map[string]interface{} to the PipelineExecutor.Execute call.
	Inputs map[string]interface{} `json:"inputs" db:"inputs"`

	// TimeoutSeconds is the maximum duration for the pipeline run.
	// When zero, the plugin uses the plugin's DefaultTimeout.
	TimeoutSeconds int `json:"timeout_seconds" db:"timeout_seconds"`

	// ScheduledAt is the planned execution time (nil means run immediately).
	ScheduledAt *time.Time `json:"scheduled_at,omitempty" db:"scheduled_at"`

	// TriggeredBy records the actor or system that initiated the task.
	TriggeredBy string `json:"triggered_by" db:"triggered_by"`
}

// NewPipelineTask creates a PipelineTask with sensible defaults.
func NewPipelineTask(pipelineID string, inputs map[string]interface{}) *PipelineTask {
	return &PipelineTask{
		PipelineID: pipelineID,
		Inputs:     inputs,
		Job: Job{
			Type:    "pipeline-trigger",
			TimeoutSec: 300,
		},
	}
}
