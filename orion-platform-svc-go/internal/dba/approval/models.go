// Package approval implements a DAG-based multi-stage approval workflow
// for DBA SQL orders. It replaces the legacy single-step SqlOrder approve
// with an arbitrary-length chain of approval steps that can require
// unanimous, any-of, or N-of-M signatures per step.
//
// The module is intentionally built from scratch: the closest reference
// implementation (Yearning) is AGPL-3.0 and cannot be imported.
package approval

import "time"

// ---- Status / Action / Mode constants ----
//
// Status applies to both ApprovalInstance and ApprovalStep.

const (
	StatusPending    = "pending"
	StatusInProgress = "in_progress"
	StatusApproved   = "approved"
	StatusRejected   = "rejected"
	StatusTimedOut   = "timed_out"

	ActionApprove  = "approve"
	ActionReject   = "reject"
	ActionComment  = "comment"
	ActionEscalate = "escalate"

	ModeUnanimous = "unanimous"
	ModeAny       = "any"
	ModeMajority  = "majority"

	TimeoutActionReject   = "reject"
	TimeoutActionEscalate = "escalate"
	TimeoutActionApprove  = "approve"
)

// ---- Workflow definitions ----

// ApprovalWorkflow is a named, reusable definition of an approval chain.
// It is looked up by ID at submit time and copied into the resulting
// instance so subsequent edits to the workflow do not affect running
// instances.
type ApprovalWorkflow struct {
	ID        string            `json:"id" db:"id"`
	TenantID  string            `json:"tenant_id" db:"tenant_id"`
	Name      string            `json:"name" db:"name"`
	Steps     []ApprovalStepDef `json:"steps" db:"steps"`
	Enabled   bool              `json:"enabled" db:"enabled"`
	CreatedAt time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt time.Time         `json:"updated_at" db:"updated_at"`
}

// ApprovalStepDef describes one stage of a workflow.
//
// Mode semantics:
//   - "unanimous": every listed approver must approve
//   - "any":       any single approver suffices
//   - "majority":  more than half of approvers must approve
//
// When Required is > 0 it overrides the mode-based default, allowing
// arbitrary N-of-M thresholds.
type ApprovalStepDef struct {
	ID            string   `json:"id" db:"step_id"`
	Role          string   `json:"role" db:"role"`
	Mode          string   `json:"mode" db:"mode"`
	Required      int      `json:"required"`
	TimeoutHours  int      `json:"timeout_hours"`
	TimeoutAction string   `json:"timeout_action" db:"timeout_action"`
	Approvers     []string `json:"approvers" db:"approvers"`
}

// ---- Workflow config ----

// Config holds tunable defaults for the approval engine. Zero values
// fall back to Defaults() when LoadConfig is used.
type Config struct {
	DefaultTimeoutHours  int
	DefaultTimeoutAction string
	MaxSteps             int
	MaxApprovers         int
}

// Defaults returns a Config with production-sane defaults.
func Defaults() Config {
	return Config{
		DefaultTimeoutHours:  24,
		DefaultTimeoutAction: TimeoutActionReject,
		MaxSteps:             10,
		MaxApprovers:         50,
	}
}

// ---- Instance runtime ----

// ApprovalInstance is the live state of an order's approval chain.
type ApprovalInstance struct {
	ID           string         `json:"id" db:"id"`
	TenantID     string         `json:"tenant_id" db:"tenant_id"`
	OrderID      string         `json:"order_id" db:"order_id"`
	WorkflowID   string         `json:"workflow_id" db:"workflow_id"`
	WorkflowName string         `json:"workflow_name" db:"workflow_name"`
	CurrentStep  int            `json:"current_step" db:"current_step"`
	Status       string         `json:"status" db:"status"`
	Steps        []ApprovalStep `json:"steps"`
	CreatedAt    time.Time      `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at" db:"updated_at"`
	FinishedAt   *time.Time     `json:"finished_at,omitempty" db:"finished_at"`
}

// ApprovalStep is the runtime state of one stage.
type ApprovalStep struct {
	StepIndex   int              `json:"step_index"`
	Def         ApprovalStepDef  `json:"def"`
	Status      string           `json:"status"`
	StartedAt   *time.Time       `json:"started_at,omitempty"`
	FinishedAt  *time.Time       `json:"finished_at,omitempty"`
	EscalatedTo string           `json:"escalated_to,omitempty"`
	Approvals   []ApprovalRecord `json:"approvals"`
}

// ApprovalRecord is a single user action on a step.
type ApprovalRecord struct {
	ID         string    `json:"id" db:"id"`
	InstanceID string    `json:"instance_id" db:"instance_id"`
	StepIndex  int       `json:"step_index" db:"step_index"`
	UserID     string    `json:"user_id" db:"user_id"`
	Action     string    `json:"action" db:"action"`
	Comment    string    `json:"comment" db:"comment"`
	ActionedAt time.Time `json:"actioned_at" db:"actioned_at"`
}

// ---- Request / Response ----

// CreateWorkflowRequest is the payload for POST /workflows.
type CreateWorkflowRequest struct {
	Name  string            `json:"name" binding:"required"`
	Steps []ApprovalStepDef `json:"steps" binding:"required"`
}

// SubmitForApprovalRequest is the payload for POST /instances.
type SubmitForApprovalRequest struct {
	OrderID    string `json:"order_id" binding:"required"`
	WorkflowID string `json:"workflow_id" binding:"required"`
}

// StepActionRequest is the payload for approve/reject/comment/escalate.
type StepActionRequest struct {
	Comment string `json:"comment"`
}
