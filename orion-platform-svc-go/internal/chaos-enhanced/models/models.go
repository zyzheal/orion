package models

import "time"

// Experiment represents a chaos experiment.
type Experiment struct {
	ID            string     `db:"id" json:"id"`
	TenantID      string     `db:"tenant_id" json:"tenantId"`
	Name          string     `db:"name" json:"name"`
	Description   string     `db:"description" json:"description"`
	EnvironmentID string     `db:"environment_id" json:"environmentId"`
	Status        string     `db:"status" json:"status"`
	FaultSpec     string     `db:"fault_spec" json:"faultSpec"`
	TargetID      string     `db:"target_id" json:"targetId"`
	StartTime     *time.Time `db:"start_time" json:"startTime"`
	EndTime       *time.Time `db:"end_time" json:"endTime"`
	RecoveryInfo  *string    `db:"recovery_info" json:"recoveryInfo"`
	CreatedBy     string     `db:"created_by" json:"createdBy"`
	CreatedAt     time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt     time.Time  `db:"updated_at" json:"updatedAt"`
}

// CreateExperimentRequest is the request body for creating an experiment.
type CreateExperimentRequest struct {
	Name          string `json:"name" binding:"required"`
	Description   string `json:"description"`
	EnvironmentID string `json:"environment_id" binding:"required"`
	FaultType     string `json:"fault_type" binding:"required"`
	FaultConfig   string `json:"fault_config"`
	TargetID      string `json:"target_id"`
	CreatedBy     string `json:"created_by"`
}

// FaultInjection represents a single fault injection event.
type FaultInjection struct {
	ID         string     `db:"id" json:"id"`
	ExperimentID string   `db:"experiment_id" json:"experimentId"`
	TenantID   string     `db:"tenant_id" json:"tenantId"`
	FaultType  string     `db:"fault_type" json:"faultType"`
	FaultConfig string    `db:"fault_config" json:"faultConfig"`
	Status     string     `db:"status" json:"status"`
	InjectedAt time.Time  `db:"injected_at" json:"injectedAt"`
	Result     *string    `db:"result" json:"result"`
}

// PaginatedResponse is a generic paginated response.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}
