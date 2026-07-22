package models

import "time"

// DeploymentStatus represents the overall deployment status.
type DeploymentStatus string

const (
	DeploymentStatusPending    DeploymentStatus = "pending"
	DeploymentStatusPreparing  DeploymentStatus = "preparing"
	DeploymentStatusDeploying  DeploymentStatus = "deploying"
	DeploymentStatusVerifying  DeploymentStatus = "verifying"
	DeploymentStatusCompleted  DeploymentStatus = "completed"
	DeploymentStatusFailed     DeploymentStatus = "failed"
	DeploymentStatusRolledBack DeploymentStatus = "rolled_back"
	DeploymentStatusCancelled  DeploymentStatus = "cancelled"
)

// DeploymentStrategyType represents the deployment strategy.
type DeploymentStrategyType string

const (
	StrategyBlueGreen DeploymentStrategyType = "blue-green"
	StrategyCanary    DeploymentStrategyType = "canary"
	StrategyRolling   DeploymentStrategyType = "rolling"
	StrategyRecreate  DeploymentStrategyType = "recreate"
)

// DeploymentStepStatus represents the status of a single step.
type DeploymentStepStatus string

const (
	StepStatusPending   DeploymentStepStatus = "pending"
	StepStatusRunning   DeploymentStepStatus = "running"
	StepStatusCompleted DeploymentStepStatus = "completed"
	StepStatusFailed    DeploymentStepStatus = "failed"
	StepStatusSkipped   DeploymentStepStatus = "skipped"
)

// DeploymentStageStatus represents the status of a stage.
type DeploymentStageStatus string

const (
	StageStatusPending   DeploymentStageStatus = "pending"
	StageStatusRunning   DeploymentStageStatus = "running"
	StageStatusCompleted DeploymentStageStatus = "completed"
	StageStatusFailed    DeploymentStageStatus = "failed"
	StageStatusSkipped   DeploymentStageStatus = "skipped"
)

// Deployment represents a single deployment record.
type Deployment struct {
	ID                 string                 `json:"id" db:"id"`
	TenantID           string                 `json:"tenantId" db:"tenant_id"`
	DeploymentID       string                 `json:"deploymentId" db:"deployment_id"` // public-facing deployment id
	AppName            string                 `json:"appName" db:"app_name"`
	Version            string                 `json:"version" db:"version"`
	Environment        string                 `json:"environment" db:"environment"`
	Strategy           DeploymentStrategyType `json:"strategy" db:"strategy"`
	Status             DeploymentStatus       `json:"status" db:"status"`
	Image              *string                `json:"image" db:"image"`
	InitiatedBy        string                 `json:"initiatedBy" db:"initiated_by"`
	Notes              *string                `json:"notes" db:"notes"`
	ChangeRequestID    *string                `json:"changeRequestId" db:"change_request_id"`
	CommitSHA          *string                `json:"commitSha" db:"commit_sha"`
	Stages             string                 `json:"stages" db:"stages"`               // JSONB
	Error              *string                `json:"error" db:"error"`
	CreatedAt          time.Time              `json:"createdAt" db:"created_at"`
	UpdatedAt          time.Time              `json:"updatedAt" db:"updated_at"`
	StartedAt          *time.Time             `json:"startedAt" db:"started_at"`
	CompletedAt        *time.Time             `json:"completedAt" db:"completed_at"`
}

// CreateDeploymentRequest is the body for creating a deployment.
type CreateDeploymentRequest struct {
	AppName         string                   `json:"appName" binding:"required"`
	Version         string                   `json:"version" binding:"required"`
	Environment     string                   `json:"environment" binding:"required"`
	Strategy        DeploymentStrategyType   `json:"strategy"`
	Image           *string                  `json:"image"`
	InitiatedBy     string                   `json:"initiatedBy" binding:"required"`
	Notes           *string                  `json:"notes"`
	ChangeRequestID *string                  `json:"changeRequestId"`
	CommitSHA       *string                  `json:"commitSha"`
	// JSON-encoded optional config blocks
	StrategyConfig *map[string]any `json:"strategyConfig"`
	HealthCheck    *map[string]any `json:"healthCheck"`
	RollbackPolicy *map[string]any `json:"rollbackPolicy"`
}

// Rollback represents a deployment rollback record.
type Rollback struct {
	ID             string     `json:"id" db:"id"`
	TenantID       string     `json:"tenantId" db:"tenant_id"`
	DeploymentID   string     `json:"deploymentId" db:"deployment_id"`
	TargetVersion  *string    `json:"targetVersion" db:"target_version"`
	Reason         string     `json:"reason" db:"reason"`
	TriggeredBy    string     `json:"triggeredBy" db:"triggered_by"`
	Status         string     `json:"status" db:"status"`
	StartedAt      *time.Time `json:"startedAt" db:"started_at"`
	CompletedAt    *time.Time `json:"completedAt" db:"completed_at"`
	Error          *string    `json:"error" db:"error"`
	CreatedAt      time.Time  `json:"createdAt" db:"created_at"`
}

// CreateRollbackRequest is the body for triggering a rollback.
type CreateRollbackRequest struct {
	TargetVersion *string `json:"targetVersion"`
	Reason        string  `json:"reason" binding:"required"`
	TriggeredBy   string  `json:"triggeredBy" binding:"required"`
}

// ListDeploymentsOptions holds optional filters for listing deployments.
type ListDeploymentsOptions struct {
	AppName     string             `json:"appName"`
	Version     string             `json:"version"`
	Environment string             `json:"environment"`
	Status      DeploymentStatus   `json:"status"`
	Strategy    DeploymentStrategyType `json:"strategy"`
	InitiatedBy string             `json:"initiatedBy"`
	Page        int                `json:"page"`
	Limit       int                `json:"limit"`
}

// DeploymentMetrics holds aggregated deployment metrics.
type DeploymentMetrics struct {
	TotalDeployments       int                `json:"totalDeployments"`
	SuccessfulDeployments  int                `json:"successfulDeployments"`
	FailedDeployments      int                `json:"failedDeployments"`
	RolledBackDeployments  int                `json:"rolledBackDeployments"`
	CancelledDeployments   int                `json:"cancelledDeployments"`
	SuccessRate            int                `json:"successRate"`
	AverageDurationMs      int64              `json:"averageDurationMs"`
	MedianDurationMs       int64              `json:"medianDurationMs"`
	RollbackRate           int                `json:"rollbackRate"`
	ByStrategy             map[string]int     `json:"byStrategy"`
	ByEnvironment          map[string]int     `json:"byEnvironment"`
	ByStatus               map[string]int     `json:"byStatus"`
}

// AuditEntry represents an audit trail entry.
type AuditEntry struct {
	ID           string                 `json:"id" db:"id"`
	TenantID     string                 `json:"tenantId" db:"tenant_id"`
	DeploymentID string                 `json:"deploymentId" db:"deployment_id"`
	Action       string                 `json:"action" db:"action"`
	PerformedBy  string                 `json:"performedBy" db:"performed_by"`
	Details      string                 `json:"details" db:"details"` // JSONB
	Timestamp    time.Time              `json:"timestamp" db:"timestamp"`
}

// PaginatedResult is a generic paginated response.
type PaginatedResult struct {
	Data  any   `json:"data"`
	Total int   `json:"total"`
	Page  int   `json:"page"`
	Limit int   `json:"limit"`
}
