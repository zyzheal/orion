package models

import "time"

// ActionKind enumerates executable assistant actions (TR-09 tool-calling).
type ActionKind string

const (
	ActionCreateTicket    ActionKind = "create_ticket"
	ActionTriggerPipeline ActionKind = "trigger_pipeline"
	ActionCreateChange    ActionKind = "create_change"
	ActionSuggestCommand  ActionKind = "suggest_command"
	ActionGenerateFlow    ActionKind = "generate_flow"
)

// ActionRequest asks the assistant to EXECUTE a workflow action, not just recall.
type ActionRequest struct {
	Prompt      string                 `json:"prompt" binding:"required"`
	Kind        string                 `json:"kind,omitempty"`
	Title       string                 `json:"title,omitempty"`
	Description string                 `json:"description,omitempty"`
	Type        string                 `json:"type,omitempty"`
	Priority    string                 `json:"priority,omitempty"`
	ChangeType  string                 `json:"change_type,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// ActionResult is the outcome of executing an assistant action.
type ActionResult struct {
	Kind       ActionKind             `json:"kind"`
	Status     string                 `json:"status"`
	Summary    string                 `json:"summary"`
	EntityID   string                 `json:"entity_id,omitempty"`
	EntityName string                 `json:"entity_name,omitempty"`
	Steps      []string               `json:"steps,omitempty"`
	Error      string                 `json:"error,omitempty"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
	ExecutedAt time.Time              `json:"executed_at"`
}
