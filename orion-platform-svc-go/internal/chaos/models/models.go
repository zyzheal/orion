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

// InjectConfig parses the JSON config string sent by the caller.
type InjectConfig struct {
	Duration   string  `json:"duration"`     // e.g. "30s", "2m"
	Intensity  float64 `json:"intensity"`    // cpu: cores (0-1), network: ms latency
	Percentage float64 `json:"percentage"`   // traffic percentage 0-100
	Ports      []int   `json:"ports"`        // target ports for network/service faults
	NodeLabels string  `json:"node_labels"`  // k8s node selector labels
}

type InjectResult struct {
	InjectionID string `json:"injection_id"`
	Target      string `json:"target"`
	Status      string `json:"status"`
}

// InjectionRecord is persisted for every fault-injection event.
type InjectionRecord struct {
	ID           string    `json:"id" db:"id"`
	TenantID     string    `json:"tenant_id" db:"tenant_id"`
	ExperimentID string    `json:"experiment_id" db:"experiment_id"`
	InjectionID  string    `json:"injection_id" db:"injection_id"`
	FaultType    string    `json:"fault_type" db:"fault_type"` // cpu-spike|memory-leak|network-latency|service-down
	Target       string    `json:"target" db:"target"`
	ConfigJSON   string    `json:"config_json" db:"config_json"`
	Status       string    `json:"status" db:"status"` // pending|executing|completed|failed|rolled_back
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

// --- Recovery ---

// RecoveryRecord is persisted for every recovery event.
type RecoveryRecord struct {
	ID           string    `json:"id" db:"id"`
	TenantID     string    `json:"tenant_id" db:"tenant_id"`
	ExperimentID string    `json:"experiment_id" db:"experiment_id"`
	Status       string    `json:"status" db:"status"` // recovering|recovered|failed
	Message      string    `json:"message" db:"message"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

// RecoveryCheck represents one health check within ValidateRecovery.
type RecoveryCheck struct {
	Check   string `json:"check"`
	Passed  bool   `json:"passed"`
	Message string `json:"message"`
}

type RecoveryResult struct {
	ExperimentID string `json:"experiment_id"`
	Status       string `json:"status"`
	Message      string `json:"message"`
}

type RecoveryValidation struct {
	ExperimentID string          `json:"experiment_id"`
	Passed       bool            `json:"passed"`
	Details      string          `json:"details"`
	Checks       []RecoveryCheck `json:"checks"`
}

type RecoveryReport struct {
	ExperimentID string           `json:"experiment_id"`
	Report       string           `json:"report"`
	Checklist    []RecoveryCheck  `json:"checklist"`
	Duration     string           `json:"duration"`
	InjectionID  string           `json:"injection_id"`
}

// --- Pre-release Verify ---

// PreReleaseCheck represents one verification step.
type PreReleaseCheck struct {
	Check   string `json:"check"`
	Status  string `json:"status"` // pass|fail|skip
	Message string `json:"message"`
}

type PreReleaseVerifyRequest struct {
	ServiceID   string `json:"service_id" binding:"required"`
	Environment string `json:"environment" binding:"required"`
}

type PreReleaseVerifyResult struct {
	ServiceID   string             `json:"service_id"`
	Environment string             `json:"environment"`
	Status      string             `json:"status"` // passed|failed|skipped
	Details     string             `json:"details"`
	Checks      []PreReleaseCheck `json:"checks"`
}
