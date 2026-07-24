package models

import "time"

// ---------------------------------------------------------------------------
// Domain enums
// ---------------------------------------------------------------------------

// DeploymentStrategy represents the rollout strategy for a progressive deployment.
type DeploymentStrategy string

const (
	StrategyCanary    DeploymentStrategy = "canary"
	StrategyBlueGreen DeploymentStrategy = "blue_green"
	StrategyRolling   DeploymentStrategy = "rolling"
)

// ValidStrategies returns all allowed strategy values.
func ValidStrategies() []DeploymentStrategy {
	return []DeploymentStrategy{StrategyCanary, StrategyBlueGreen, StrategyRolling}
}

// DeploymentStatus represents the lifecycle status of a progressive deployment.
type DeploymentStatus string

const (
	StatusPending           DeploymentStatus = "PENDING"
	StatusRolloutInProgress DeploymentStatus = "ROLLOUT_IN_PROGRESS"
	StatusPaused            DeploymentStatus = "PAUSED"
	StatusCompleted         DeploymentStatus = "COMPLETED"
	StatusRolledBack        DeploymentStatus = "ROLLED_BACK"
)

// ValidDeploymentStatuses returns all allowed deployment status values.
func ValidDeploymentStatuses() []DeploymentStatus {
	return []DeploymentStatus{
		StatusPending, StatusRolloutInProgress, StatusPaused,
		StatusCompleted, StatusRolledBack,
	}
}

// StageStatus represents the status of an individual rollout stage.
type StageStatus string

const (
	StageStatusPending    StageStatus = "PENDING"
	StageStatusInProgress StageStatus = "IN_PROGRESS"
	StageStatusCompleted  StageStatus = "COMPLETED"
	StageStatusFailed     StageStatus = "FAILED"
)

// ValidStageStatuses returns all allowed stage status values.
func ValidStageStatuses() []StageStatus {
	return []StageStatus{
		StageStatusPending, StageStatusInProgress, StageStatusCompleted, StageStatusFailed,
	}
}

// ---------------------------------------------------------------------------
// Domain models
// ---------------------------------------------------------------------------

// ProgressiveDeployment represents a staged rollout configuration for a service.
type ProgressiveDeployment struct {
	ID                     string             `json:"id" db:"id"`
	TenantID               string             `json:"tenant_id" db:"tenant_id"`
	Name                   string             `json:"name" db:"name"`
	ServiceName            string             `json:"service_name" db:"service_name"`
	Strategy               DeploymentStrategy `json:"strategy" db:"strategy"`
	CurrentStage           int                `json:"current_stage" db:"current_stage"`
	TotalStages            int                `json:"total_stages" db:"total_stages"`
	Status                 DeploymentStatus   `json:"status" db:"status"`
	HealthCheckEndpoint    string             `json:"health_check_endpoint" db:"health_check_endpoint"`
	HealthCheckIntervalSec int                `json:"health_check_interval_seconds" db:"health_check_interval_seconds"`
	RollbackThreshold      float64            `json:"rollback_threshold" db:"rollback_threshold"`
	RollbackReason         string             `json:"rollback_reason,omitempty" db:"rollback_reason"`
	LastHealthCheckAt      *time.Time         `json:"last_health_check_at,omitempty" db:"last_health_check_at"`
	RollbackAt             *time.Time         `json:"rollback_at,omitempty" db:"rollback_at"`
	CreatedAt              time.Time          `json:"created_at" db:"created_at"`
	UpdatedAt              time.Time          `json:"updated_at" db:"updated_at"`
}

// RolloutStage represents a single stage within a progressive deployment rollout.
type RolloutStage struct {
	ID             string            `json:"id" db:"id"`
	DeploymentID   string            `json:"deployment_id" db:"deployment_id"`
	StageNumber    int               `json:"stage_number" db:"stage_number"`
	TrafficPercent int               `json:"traffic_percent" db:"traffic_percent"`
	Status         StageStatus       `json:"status" db:"status"`
	HealthMetrics  map[string]string `json:"health_metrics" db:"health_metrics"` // stored as JSON
	Error          string            `json:"error,omitempty" db:"error"`
	StartedAt      *time.Time        `json:"started_at,omitempty" db:"started_at"`
	CompletedAt    *time.Time        `json:"completed_at,omitempty" db:"completed_at"`
	CreatedAt      time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time         `json:"updated_at" db:"updated_at"`
}

// ---------------------------------------------------------------------------
// Request / response models
// ---------------------------------------------------------------------------

// CreateProgressiveDeploymentRequest is the request body for creating a deployment.
type CreateProgressiveDeploymentRequest struct {
	Name                   string             `json:"name" binding:"required"`
	ServiceName            string             `json:"service_name" binding:"required"`
	Strategy               DeploymentStrategy `json:"strategy" binding:"required"`
	TotalStages            int                `json:"total_stages" binding:"required,min=1,max=20"`
	HealthCheckEndpoint    string             `json:"health_check_endpoint"`
	HealthCheckIntervalSec int                `json:"health_check_interval_seconds"`
	RollbackThreshold      float64            `json:"rollback_threshold"`
}

// UpdateProgressiveDeploymentRequest is the request body for updating a deployment.
type UpdateProgressiveDeploymentRequest struct {
	Name                   *string             `json:"name"`
	ServiceName            *string             `json:"service_name"`
	Strategy               *DeploymentStrategy `json:"strategy"`
	TotalStages            *int                `json:"total_stages"`
	HealthCheckEndpoint    *string             `json:"health_check_endpoint"`
	HealthCheckIntervalSec *int                `json:"health_check_interval_seconds"`
	RollbackThreshold      *float64            `json:"rollback_threshold"`
}

// CompleteStageRequest is the request body for completing a rollout stage.
type CompleteStageRequest struct {
	HealthOK  bool              `json:"health_ok"`
	ErrorRate float64           `json:"error_rate"`
	Metrics   map[string]string `json:"metrics"`
}

// RollbackRequest is the request body for triggering a rollback.
type RollbackRequest struct {
	Reason string `json:"reason"`
}

// DeploymentProgress holds the current progress of a rollout.
type DeploymentProgress struct {
	CurrentStage       int              `json:"current_stage"`
	TotalStages        int              `json:"total_stages"`
	Percentage         float64          `json:"percentage"`
	Status             DeploymentStatus `json:"status"`
	CurrentStageDetail *RolloutStage    `json:"current_stage_detail,omitempty"`
}

// DeploymentListResult is the paginated result for listing deployments.
type DeploymentListResult struct {
	Items []ProgressiveDeployment `json:"items"`
	Total int                     `json:"total"`
}
