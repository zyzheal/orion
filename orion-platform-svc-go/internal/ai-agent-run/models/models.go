package models

import "database/sql"

// --- Enums ---

// AgentRunStatus represents the lifecycle state of an agent run.
type AgentRunStatus string

const (
	AgentRunStatusRunning      AgentRunStatus = "running"
	AgentRunStatusCompleted    AgentRunStatus = "completed"
	AgentRunStatusFailed       AgentRunStatus = "failed"
	AgentRunStatusCancelled    AgentRunStatus = "cancelled"
	AgentRunStatusWaitingAppro AgentRunStatus = "waiting_approval"
)

// AgentAction represents a discrete action an agent can perform in a step.
type AgentAction string

const (
	AgentActionReadFile       AgentAction = "read_file"
	AgentActionWriteCode      AgentAction = "write_code"
	AgentActionRunCommand     AgentAction = "run_command"
	AgentActionCreatePR       AgentAction = "create_pr"
	AgentActionRequestApprove AgentAction = "request_approval"
)

// --- Core entity: AgentRun ---

// AgentRun represents a single execution run of an agent.
type AgentRun struct {
	ID                string         `db:"id" json:"id"`
	TenantID          string         `db:"tenant_id" json:"tenantId"`
	AgentProfileID    string         `db:"agent_profile_id" json:"agentProfileId"`
	AgentProfileName  string         `db:"agent_profile_name" json:"agentProfileName"`
	TriggerPayload    string         `db:"trigger_payload" json:"triggerPayload"` // JSONB
	Status            AgentRunStatus `db:"status" json:"status"`
	CurrentStep       int            `db:"current_step" json:"currentStep"`
	TotalSteps        int            `db:"total_steps" json:"totalSteps"`
	Result            sql.NullString `db:"result" json:"result"`              // JSONB
	Error             sql.NullString `db:"error" json:"error"`
	StartedAt         int64          `db:"started_at" json:"startedAt"`       // unix seconds
	CompletedAt       sql.NullInt64  `db:"completed_at" json:"completedAt"`   // unix seconds
	TimeoutAt         int64          `db:"timeout_at" json:"timeoutAt"`       // unix seconds
	CreatedAt         int64          `db:"created_at" json:"createdAt"`       // unix seconds
	UpdatedAt         sql.NullInt64  `db:"updated_at" json:"updatedAt"`       // unix seconds
}

// --- Core entity: AgentDecision ---

// AgentDecision records a single step decision made during an agent run.
type AgentDecision struct {
	ID          string         `db:"id" json:"id"`
	RunID       string         `db:"run_id" json:"runId"`
	AgentID     string         `db:"agent_id" json:"agentId"`
	StepNumber  int            `db:"step_number" json:"stepNumber"`
	Action      AgentAction    `db:"action" json:"action"`
	ActionInput string         `db:"action_input" json:"actionInput"`     // JSONB
	ActionOutput sql.NullString `db:"action_output" json:"actionOutput"`   // JSONB
	Reasoning   string         `db:"reasoning" json:"reasoning"`
	ToolResult  sql.NullString `db:"tool_result" json:"toolResult"`       // JSONB
	Error       sql.NullString `db:"error" json:"error"`
	CreatedAt   int64          `db:"created_at" json:"createdAt"`          // unix seconds
}

// --- Core entity: AgentApproval ---

// AgentApproval represents a pending/processed approval request within a run.
type AgentApproval struct {
	ID              string         `db:"id" json:"id"`
	RunID           string         `db:"run_id" json:"runId"`
	AgentID         string         `db:"agent_id" json:"agentId"`
	Action          AgentAction    `db:"action" json:"action"`
	ActionInput     string         `db:"action_input" json:"actionInput"` // JSONB
	Reason          string         `db:"reason" json:"reason"`
	Status          string         `db:"status" json:"status"` // pending | approved | rejected
	ApprovedBy      sql.NullString `db:"approved_by" json:"approvedBy"`
	ApprovedAt      sql.NullInt64  `db:"approved_at" json:"approvedAt"` // unix seconds
	RejectionReason sql.NullString `db:"rejection_reason" json:"rejectionReason"`
	CreatedAt       int64          `db:"created_at" json:"createdAt"`   // unix seconds
}

// --- Request types ---

// TriggerRunRequest is the body for creating a new agent run.
type TriggerRunRequest struct {
	AgentProfileID  string                 `json:"agentProfileId" binding:"required"`
	TriggerPayload  map[string]interface{} `json:"triggerPayload"`
	TotalSteps      *int                   `json:"totalSteps"`
	TimeoutSec      *int64                 `json:"timeoutSec"`
}

// ExecuteStepRequest is the body for executing a step in a run.
type ExecuteStepRequest struct {
	Action      string                 `json:"action" binding:"required"`
	ActionInput map[string]interface{} `json:"actionInput"`
	AgentID     string                 `json:"agentId"`
}

// --- Response types ---

// AgentRunInfo is the API-facing representation of a run.
type AgentRunInfo struct {
	ID               string                 `json:"id"`
	TenantID         string                 `json:"tenantId"`
	AgentProfileID   string                 `json:"agentProfileId"`
	AgentProfileName string                 `json:"agentProfileName"`
	TriggerPayload   map[string]interface{} `json:"triggerPayload"`
	Status           AgentRunStatus         `json:"status"`
	CurrentStep      int                    `json:"currentStep"`
	TotalSteps       int                    `json:"totalSteps"`
	Result           map[string]interface{} `json:"result"`
	Error            string                 `json:"error"`
	StartedAt        int64                  `json:"startedAt"`
	CompletedAt      *int64                 `json:"completedAt"`
	TimeoutAt        int64                  `json:"timeoutAt"`
	CreatedAt        int64                  `json:"createdAt"`
}

// AgentDecisionResponse is the API-facing representation of a decision.
type AgentDecisionResponse struct {
	ID           string                 `json:"id"`
	RunID        string                 `json:"runId"`
	AgentID      string                 `json:"agentId"`
	StepNumber   int                    `json:"stepNumber"`
	Action       AgentAction            `json:"action"`
	ActionInput  map[string]interface{} `json:"actionInput"`
	ActionOutput map[string]interface{} `json:"actionOutput"`
	Reasoning    string                 `json:"reasoning"`
	ToolResult   map[string]interface{} `json:"toolResult"`
	Error        string                 `json:"error"`
	CreatedAt    int64                  `json:"createdAt"`
}

// AgentRunStats aggregates run statistics.
type AgentRunStats struct {
	Total           int64              `json:"total"`
	Running         int64              `json:"running"`
	Completed       int64              `json:"completed"`
	Failed          int64              `json:"failed"`
	Cancelled       int64              `json:"cancelled"`
	WaitingApproval int64              `json:"waitingApproval"`
	ByStatus        map[AgentRunStatus]int64 `json:"byStatus"`
}

// --- List filter ---

type ListFilter struct {
	AgentProfileID *string
	Status         *string
	Limit          *int
	Offset         *int
	Sort           *string
	Order          *string
}
