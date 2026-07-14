package models

// BatchStartRequest is the request body for batch-starting pipelines.
type BatchStartRequest struct {
	PipelineIDs  []string             `json:"pipelineIds" binding:"required"`
	TriggeredBy  *string              `json:"triggeredBy"`
	Parameters   *map[string]any      `json:"parameters"`
	Branch       *string              `json:"branch"`
	Environment  *string              `json:"environment"`
}

// BatchStopRequest is the request body for batch-stopping pipeline runs.
type BatchStopRequest struct {
	ExecutionIDs []string `json:"executionIds" binding:"required"`
}

// BatchDeleteRequest is the request body for batch-deleting pipelines.
type BatchDeleteRequest struct {
	PipelineIDs []string `json:"pipelineIds" binding:"required"`
}

// BatchOperationResult represents the result of an individual batch operation.
type BatchOperationResult struct {
	ID      string `db:"id" json:"id"`
	Status  string `db:"status" json:"status"`
	Error   *string `db:"error" json:"error,omitempty"`
	Deleted *bool    `db:"deleted" json:"deleted,omitempty"`
}

// BatchOperationResponse is the envelope returned for all batch operations.
type BatchOperationResponse struct {
	Data      []BatchOperationResult `json:"data"`
	Total     int                    `json:"total"`
	Succeeded int                    `json:"succeeded"`
	Failed    int                    `json:"failed"`
	Skipped   *int                   `json:"skipped,omitempty"`
}
