package models

import "time"

// PhaseGroup represents a Phase Group for batched pipeline execution.
type PhaseGroup struct {
	ID            string    `db:"id" json:"id"`
	TenantID      string    `db:"tenant_id" json:"tenantId"`
	PipelineID    string    `db:"pipeline_id" json:"pipelineId"`
	Name          string    `db:"name" json:"name"`
	BatchStrategy string    `db:"batch_strategy" json:"batchStrategy"`
	BatchConfig   string    `db:"batch_config" json:"batchConfig"`
	GateType      string    `db:"gate_type" json:"gateType"`
	Status        string    `db:"status" json:"status"`
	CreatedBy     string    `db:"created_by" json:"createdBy"`
	CreatedAt     time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt     time.Time `db:"updated_at" json:"updatedAt"`
}

// CreatePhaseGroupRequest is the request body for creating a phase group.
type CreatePhaseGroupRequest struct {
	PipelineID    string `json:"pipelineId" binding:"required"`
	Name          string `json:"name" binding:"required"`
	BatchStrategy string `json:"batchStrategy"`
	BatchConfig   string `json:"batchConfig"`
	GateType      string `json:"gateType"`
	CreatedBy     string `json:"createdBy"`
}

// UpdatePhaseGroupRequest is the request body for updating a phase group.
type UpdatePhaseGroupRequest struct {
	Name          *string `json:"name"`
	BatchStrategy *string `json:"batchStrategy"`
	BatchConfig   *string `json:"batchConfig"`
	GateType      *string `json:"gateType"`
	Status        *string `json:"status"`
}

// BatchRun represents a single batch execution within a phase group.
type BatchRun struct {
	ID           string     `db:"id" json:"id"`
	TenantID     string     `db:"tenant_id" json:"tenantId"`
	PhaseGroupID string     `db:"phase_group_id" json:"phaseGroupId"`
	BatchIndex   int        `db:"batch_index" json:"batchIndex"`
	Status       string     `db:"status" json:"status"`
	Result       string     `db:"result" json:"result"`
	StartedAt    *time.Time `db:"started_at" json:"startedAt"`
	CompletedAt  *time.Time `db:"completed_at" json:"completedAt"`
}

// PaginatedResponse is a generic paginated response.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}
