package models

import "time"

// --- Chaos Experiment ---

type Experiment struct {
	ID                    string    `json:"id" db:"id"`
	TenantID              string    `json:"tenant_id" db:"tenant_id"`
	Name                  string    `json:"name" db:"name"`
	Description           string    `json:"description" db:"description"`
	Scope                 string    `json:"scope" db:"scope"`
	Faults                string    `json:"faults" db:"faults"`
	SteadyStateHypothesis string    `json:"steady_state_hypothesis" db:"steady_state_hypothesis"`
	AutoRollback          bool      `json:"auto_rollback" db:"auto_rollback"`
	CreatedBy             string    `json:"created_by" db:"created_by"`
	Status                string    `json:"status" db:"status"`
	CreatedAt             time.Time `json:"created_at" db:"created_at"`
	UpdatedAt             time.Time `json:"updated_at" db:"updated_at"`
}

type CreateExperimentRequest struct {
	TenantID              string `json:"tenant_id"`
	Name                  string `json:"name" binding:"required"`
	Description           string `json:"description"`
	Scope                 string `json:"scope" binding:"required"`
	Faults                string `json:"faults" binding:"required"`
	SteadyStateHypothesis string `json:"steady_state_hypothesis"`
	AutoRollback          bool   `json:"auto_rollback"`
	CreatedBy             string `json:"created_by"`
}

type UpdateExperimentRequest struct {
	Name                  *string `json:"name"`
	Description           *string `json:"description"`
	Scope                 *string `json:"scope"`
	Faults                *string `json:"faults"`
	SteadyStateHypothesis *string `json:"steady_state_hypothesis"`
	AutoRollback          *bool   `json:"auto_rollback"`
	Status                *string `json:"status"`
}

// --- Experiment Run ---

type ExperimentRun struct {
	ID           string    `json:"id" db:"id"`
	TenantID     string    `json:"tenant_id" db:"tenant_id"`
	ExperimentID string    `json:"experiment_id" db:"experiment_id"`
	Status       string    `json:"status" db:"status"`
	Reason       string    `json:"reason" db:"reason"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

type RunExperimentRequest struct {
	Target      string `json:"target"`
	Environment string `json:"environment"`
	Reason      string `json:"reason"`
}

type RollbackRunRequest struct {
	Reason string `json:"reason"`
}

// --- Fault Injection ---

type InjectRequest struct {
	Target string `json:"target" binding:"required"`
	Config string `json:"config" binding:"required"`
}

type InjectResult struct {
	InjectionID string `json:"injection_id"`
	Target      string `json:"target"`
	Status      string `json:"status"`
}

// --- Recovery ---

type RecoveryResult struct {
	ExperimentID string `json:"experiment_id"`
	Status       string `json:"status"`
	Message      string `json:"message"`
}

type RecoveryValidation struct {
	ExperimentID string `json:"experiment_id"`
	Passed       bool   `json:"passed"`
	Details      string `json:"details"`
}

type RecoveryReport struct {
	ExperimentID string `json:"experiment_id"`
	Report       string `json:"report"`
}

// --- Pre-release Verify ---

type PreReleaseVerifyRequest struct {
	ServiceID   string `json:"service_id" binding:"required"`
	Environment string `json:"environment" binding:"required"`
}

type PreReleaseVerifyResult struct {
	ServiceID   string `json:"service_id"`
	Environment string `json:"environment"`
	Status      string `json:"status"`
	Details     string `json:"details"`
}
