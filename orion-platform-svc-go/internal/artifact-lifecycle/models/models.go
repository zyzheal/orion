package models

import "time"

// ArtifactLifecycle tracks the lifecycle of an artifact through stages.
type ArtifactLifecycle struct {
	ID         string    `db:"id" json:"id"`
	TenantID   string    `db:"tenant_id" json:"tenant_id"`
	ArtifactID string    `db:"artifact_id" json:"artifact_id"`
	Stage      string    `db:"stage" json:"stage"`
	Status     string    `db:"stage_status" json:"stage_status"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
	UpdatedAt  time.Time `db:"updated_at" json:"updated_at"`
}

// CreateArtifactLifecycleRequest is the request body for creating a lifecycle record.
type CreateArtifactLifecycleRequest struct {
	ArtifactID string `json:"artifact_id"`
	Stage      string `json:"stage"`
	Status     string `json:"stage_status"`
}

// AdvanceStageRequest is the request body for advancing a lifecycle stage.
type AdvanceStageRequest struct {
	Stage string `json:"stage"`
}

// ListLifecycleResponse returns a paginated list.
type ListLifecycleResponse struct {
	Items []ArtifactLifecycle `json:"items"`
	Total int                 `json:"total"`
}
