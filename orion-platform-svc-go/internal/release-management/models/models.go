package models

import "time"

type ReleaseStatus string

const (
	ReleaseStatusDraft    ReleaseStatus = "draft"
	ReleaseStatusApproved ReleaseStatus = "approved"
	ReleaseStatusInProgress ReleaseStatus = "in_progress"
	ReleaseStatusDeployed ReleaseStatus = "deployed"
	ReleaseStatusRolledBack ReleaseStatus = "rolled_back"
	ReleaseStatusFailed   ReleaseStatus = "failed"
)

type Release struct {
	ID          string        `json:"id" db:"id"`
	TenantID    string        `json:"tenantId" db:"tenant_id"`
	Name        string        `json:"name" db:"name"`
	Version     string        `json:"version" db:"version"`
	Description string        `json:"description" db:"description"`
	Status      ReleaseStatus `json:"status" db:"status"`
	ArtifactID  string        `json:"artifactId" db:"artifact_id"`
	PipelineID  string        `json:"pipelineId" db:"pipeline_id"`
	ApprovedBy  string        `json:"approvedBy" db:"approved_by"`
	DeployedBy  string        `json:"deployedBy" db:"deployed_by"`
	RollbackID  string        `json:"rollbackId" db:"rollback_id"`
	ReleaseNotes string       `json:"releaseNotes" db:"release_notes"`
	CreatedAt   time.Time     `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time     `json:"updatedAt" db:"updated_at"`
	DeployedAt  *time.Time    `json:"deployedAt" db:"deployed_at"`
}

type CreateReleaseRequest struct {
	Name        string `json:"name" binding:"required"`
	Version     string `json:"version" binding:"required"`
	Description string `json:"description"`
	ArtifactID  string `json:"artifactId"`
	PipelineID  string `json:"pipelineId"`
	ReleaseNotes string `json:"releaseNotes"`
}

type UpdateReleaseRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	ReleaseNotes *string `json:"releaseNotes"`
	Status      *ReleaseStatus `json:"status"`
}

type ListReleasesQuery struct {
	Page     int             `form:"page"`
	PageSize int             `form:"pageSize"`
	Status   *ReleaseStatus  `form:"status"`
	PipelineID string        `form:"pipelineId"`
}

type ReleaseListResponse struct {
	Items      []Release `json:"items"`
	Total      int       `json:"total"`
	Page       int       `json:"page"`
	PageSize   int       `json:"pageSize"`
}

type ReleaseApproval struct {
	ID        string    `json:"id" db:"id"`
	ReleaseID string    `json:"releaseId" db:"release_id"`
	ApprovedBy string   `json:"approvedBy" db:"approved_by"`
	Comment   string    `json:"comment" db:"comment"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
}

type RollbackRequest struct {
	ReleaseID   string `json:"releaseId" binding:"required"`
	Reason      string `json:"reason" binding:"required"`
	PerformedBy string `json:"performedBy"`
}