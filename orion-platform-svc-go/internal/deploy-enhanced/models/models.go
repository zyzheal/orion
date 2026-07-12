package models

import "time"

// DeployWindow represents a scheduled deploy window with environment locking.
type DeployWindow struct {
	ID             string     `db:"id" json:"id"`
	TenantID       string     `db:"tenant_id" json:"tenantId"`
	Name           string     `db:"name" json:"name"`
	EnvironmentID  *string    `db:"environment_id" json:"environmentId"`
	Type           string     `db:"type" json:"type"`
	CronExpression *string    `db:"cron_expression" json:"cronExpression"`
	StartTime      *time.Time `db:"start_time" json:"startTime"`
	EndTime        *time.Time `db:"end_time" json:"endTime"`
	DurationMinutes int       `db:"duration_minutes" json:"durationMinutes"`
	Timezone       string     `db:"timezone" json:"timezone"`
	Status         string     `db:"status" json:"status"`
	CreatedBy      string     `db:"created_by" json:"createdBy"`
	CreatedAt      time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt      time.Time  `db:"updated_at" json:"updatedAt"`
}

// CreateDeployWindowRequest is the request body for creating a deploy window.
type CreateDeployWindowRequest struct {
	Name            string  `json:"name" binding:"required"`
	CronExpression  string  `json:"cron_expression" binding:"required"`
	EnvironmentID   string  `json:"environment_id" binding:"required"`
	DurationMinutes *int    `json:"duration_minutes"`
	Timezone        *string `json:"timezone"`
}

// UpdateDeployWindowRequest is the request body for updating a deploy window.
type UpdateDeployWindowRequest struct {
	Name            *string `json:"name"`
	CronExpression  *string `json:"cron_expression"`
	DurationMinutes *int    `json:"duration_minutes"`
	Timezone        *string `json:"timezone"`
	Status          *string `json:"status"`
}

// WindowCheckResult is the result of checking whether a window is active.
type WindowCheckResult struct {
	IsActive    bool            `json:"isActive"`
	Window      *DeployWindow   `json:"window"`
	Reason      string          `json:"reason"`
}

// ProgressiveDeploy represents a stage-based progressive deployment.
type ProgressiveDeploy struct {
	ID             string     `db:"id" json:"id"`
	TenantID       string     `db:"tenant_id" json:"tenantId"`
	DeploymentID   string     `db:"deployment_id" json:"deploymentId"`
	Strategy       string     `db:"strategy" json:"strategy"`
	Stages         string     `db:"stages" json:"stages"`
	CurrentStage   int        `db:"current_stage" json:"currentStage"`
	Status         string     `db:"status" json:"status"`
	RollbackEnabled bool      `db:"rollback_enabled" json:"rollbackEnabled"`
	RollbackStage  *string    `db:"rollback_stage" json:"rollbackStage"`
	RollbackReason *string    `db:"rollback_reason" json:"rollbackReason"`
	CreatedAt      time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt      time.Time  `db:"updated_at" json:"updatedAt"`
}

// CreateProgressiveDeployRequest is the request body for creating a progressive deploy.
type CreateProgressiveDeployRequest struct {
	Stages []Stage `json:"stages" binding:"required"`
}

// Stage represents a single stage in a progressive deployment.
type Stage struct {
	Name         string   `json:"name"`
	TrafficPct   int      `json:"trafficPct"`
	DurationSec  int      `json:"durationSec"`
	Status       string   `json:"status"`
	StartedAt    *string  `json:"startedAt"`
	CompletedAt  *string  `json:"completedAt"`
	ValidationResult *string `json:"validationResult"`
}

// AdvanceStageRequest is the request body for advancing a progressive deploy.
type AdvanceStageRequest struct {
	StageID         string  `json:"stage_id" binding:"required"`
	ValidationResult *string `json:"validationResult"`
}

// RollbackStageRequest is the request body for rolling back a progressive deploy.
type RollbackStageRequest struct {
	StageID string `json:"stage_id" binding:"required"`
	Reason  string `json:"reason" binding:"required"`
}

// EmergencyDeploy represents an emergency deployment request.
type EmergencyDeploy struct {
	ID           string     `db:"id" json:"id"`
	TenantID     string     `db:"tenant_id" json:"tenantId"`
	DeploymentID string     `db:"deployment_id" json:"deploymentId"`
	Reason       string     `db:"reason" json:"reason"`
	RequestedBy  string     `db:"requested_by" json:"requestedBy"`
	ApprovedBy   *string    `db:"approved_by" json:"approvedBy"`
	Urgency      string     `db:"urgency" json:"urgency"`
	Status       string     `db:"status" json:"status"`
	PostMortem   *string    `db:"post_mortem" json:"postMortem"`
	ExecutedAt   *time.Time `db:"executed_at" json:"executedAt"`
	CreatedAt    time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt    time.Time  `db:"updated_at" json:"updatedAt"`
}

// CreateEmergencyDeployRequest is the request body for requesting an emergency deploy.
type CreateEmergencyDeployRequest struct {
	DeploymentID string `json:"deployment_id" binding:"required"`
	Reason       string `json:"reason" binding:"required"`
	RequestedBy  string `json:"requested_by" binding:"required"`
}

// ApproveEmergencyDeployRequest is the request body for approving an emergency deploy.
type ApproveEmergencyDeployRequest struct {
	ApprovedBy string `json:"approved_by" binding:"required"`
}

// CompleteEmergencyDeployRequest is the request body for completing an emergency deploy.
type CompleteEmergencyDeployRequest struct {
	PostMortem *string `json:"post_mortem"`
}

// PaginatedResponse is a generic paginated response.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}
