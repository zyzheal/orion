package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

type JSONB map[string]interface{}
func (j JSONB) Value() (driver.Value, error) { if j == nil { return nil, nil }; return json.Marshal(j) }
func (j *JSONB) Scan(src interface{}) error {
	if src == nil { *j = nil; return nil }
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, j)
	case string:
		return json.Unmarshal([]byte(v), j)
	default:
		return fmt.Errorf("cannot scan %T into JSONB", src)
	}
}

// ====== Workflow (legacy) ======

type WorkflowStatus string
const (
	WfActive   WorkflowStatus = "active"
	WfDisabled WorkflowStatus = "disabled"
)

type RunStatus string
const (
	RunPending   RunStatus = "pending"
	RunRunning   RunStatus = "running"
	RunCompleted RunStatus = "completed"
	RunFailed    RunStatus = "failed"
)

type Workflow struct {
	ID          string         `db:"id" json:"id"`
	TenantID    string         `db:"tenant_id" json:"tenant_id"`
	Name        string         `db:"name" json:"name"`
	Description string         `db:"description" json:"description"`
	Steps       JSONB          `db:"steps" json:"steps"`
	Status      WorkflowStatus `db:"status" json:"status"`
	CreatedAt   time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time      `db:"updated_at" json:"updated_at"`
}

type WorkflowRun struct {
	ID          string     `db:"id" json:"id"`
	WorkflowID  string     `db:"workflow_id" json:"workflow_id"`
	TenantID    string     `db:"tenant_id" json:"tenant_id"`
	Status      RunStatus  `db:"status" json:"status"`
	Input       JSONB      `db:"input" json:"input"`
	Output      JSONB      `db:"output" json:"output"`
	StartedAt   time.Time  `db:"started_at" json:"started_at"`
	CompletedAt *time.Time `db:"completed_at" json:"completed_at,omitempty"`
}

type CreateWorkflowRequest struct {
	Name        string                 `json:"name" binding:"required"`
	Description string                 `json:"description"`
	Steps       map[string]interface{} `json:"steps"`
}

// ====== Workflow Definition (lowcode_workflow_definition) ======

type WorkflowDefinition struct {
	ID          string `db:"id" json:"id"`
	TenantID    string `db:"tenant_id" json:"tenant_id"`
	Name        string `db:"name" json:"name"`
	Description string `db:"description" json:"description"`
	Nodes       JSONB  `db:"nodes" json:"nodes"`
	Edges       JSONB  `db:"edges" json:"edges"`
	Enabled     bool   `db:"enabled" json:"enabled"`
	CreatedBy   string `db:"created_by" json:"created_by"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type CreateDefinitionRequest struct {
	Name        string                 `json:"name" binding:"required"`
	Description string                 `json:"description"`
	Steps       []StepRequest          `json:"steps"`
	Triggers    []string               `json:"triggers"`
}

type StepRequest struct {
	ID     string                 `json:"id"`
	Type   string                 `json:"type"`
	Name   string                 `json:"name"`
	Config map[string]interface{} `json:"config"`
}

type UpdateDefinitionRequest struct {
	Name        *string                `json:"name"`
	Description *string                `json:"description"`
	Nodes       *JSONB                 `json:"nodes"`
	Edges       *JSONB                 `json:"edges"`
	Enabled     *bool                  `json:"enabled"`
}

// ====== Workflow Instance (lowcode_workflow_instance) ======

type InstanceStatus string
const (
	InstanceRunning   InstanceStatus = "running"
	InstancePaused    InstanceStatus = "paused"
	InstanceCompleted InstanceStatus = "completed"
	InstanceFailed    InstanceStatus = "failed"
	InstanceCancelled InstanceStatus = "cancelled"
)

type WorkflowInstance struct {
	ID                   string         `db:"id" json:"id"`
	WorkflowID           string         `db:"workflow_id" json:"workflow_id"`
	WorkflowDefinitionID string         `db:"workflow_definition_id" json:"workflow_definition_id"`
	TenantID             string         `db:"tenant_id" json:"tenant_id"`
	Status               InstanceStatus `db:"status" json:"status"`
	Input                JSONB          `db:"input" json:"input"`
	Output               JSONB          `db:"output" json:"output"`
	CurrentNodeID        *string        `db:"current_node_id" json:"current_node_id,omitempty"`
	TriggeredBy          string         `db:"triggered_by" json:"triggered_by"`
	CreatedAt            time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt            time.Time      `db:"updated_at" json:"updated_at"`
}

type CreateInstanceRequest struct {
	TriggeredBy  string                 `json:"triggered_by"`
	InitialInput map[string]interface{} `json:"initialInput"`
}

// ====== Workflow Trigger ======

type TriggerType string
const (
	TriggerEvent    TriggerType = "event"
	TriggerCron     TriggerType = "cron"
	TriggerManual   TriggerType = "manual"
	TriggerWebhook  TriggerType = "webhook"
)

type WorkflowTrigger struct {
	ID           string      `db:"id" json:"id"`
	TenantID     string      `db:"tenant_id" json:"tenant_id"`
	WorkflowID   string      `db:"workflow_id" json:"workflow_id"`
	Name         string      `db:"name" json:"name"`
	Type         TriggerType `db:"type" json:"type"`
	Config       JSONB       `db:"config" json:"config"`
	WebhookSecret *string     `db:"webhook_secret" json:"webhook_secret,omitempty"`
	WebhookPath  *string     `db:"webhook_path" json:"webhook_path,omitempty"`
	Enabled      bool        `db:"enabled" json:"enabled"`
	CreatedBy    string      `db:"created_by" json:"created_by"`
	CreatedAt    time.Time   `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time   `db:"updated_at" json:"updated_at"`
}

type CreateTriggerRequest struct {
	WorkflowID   string                 `json:"workflowId" binding:"required"`
	Name         string                 `json:"name" binding:"required"`
	Type         TriggerType            `json:"type" binding:"required"`
	Config       map[string]interface{} `json:"config"`
	WebhookSecret *string                `json:"webhookSecret"`
	WebhookPath  *string                `json:"webhookPath"`
	Enabled      bool                   `json:"enabled"`
}

type UpdateTriggerRequest struct {
	Name          *string                `json:"name"`
	Type          *TriggerType           `json:"type"`
	Config        *map[string]interface{} `json:"config"`
	WebhookSecret *string                `json:"webhookSecret"`
	WebhookPath   *string                `json:"webhookPath"`
	Enabled       *bool                  `json:"enabled"`
}

type TriggerLog struct {
	ID           string    `db:"id" json:"id"`
	TriggerID    string    `db:"trigger_id" json:"trigger_id"`
	EventType    string    `db:"event_type" json:"event_type"`
	EventPayload JSONB     `db:"event_payload" json:"event_payload"`
	Status       string    `db:"status" json:"status"`
	ErrorMessage *string   `db:"error_message" json:"error_message"`
	DurationMs   *int      `db:"duration_ms" json:"duration_ms"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

type CreateTriggerLogRequest struct {
	TriggerID    string                 `json:"trigger_id"`
	EventType    string                 `json:"event_type"`
	EventPayload map[string]interface{} `json:"event_payload"`
}

// ====== Workflow Task ======

type TaskStatus string
const (
	TaskPending   TaskStatus = "pending"
	TaskAssigned  TaskStatus = "assigned"
	TaskCompleted TaskStatus = "completed"
	TaskCancelled TaskStatus = "cancelled"
)

type WorkflowTask struct {
	ID                  string     `db:"id" json:"id"`
	TenantID            string     `db:"tenant_id" json:"tenant_id"`
	WorkflowID          string     `db:"workflow_id" json:"workflow_id"`
	WorkflowInstanceID  string     `db:"workflow_instance_id" json:"workflow_instance_id"`
	NodeID              string     `db:"node_id" json:"node_id"`
	AssigneeID          *string    `db:"assignee_id" json:"assignee_id"`
	Status              TaskStatus `db:"status" json:"status"`
	Comment             *string    `db:"comment" json:"comment"`
	FormData            JSONB      `db:"form_data" json:"form_data"`
	CreatedAt           time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt           time.Time  `db:"updated_at" json:"updated_at"`
}

type CreateTaskRequest struct {
	TenantID           string                 `json:"tenant_id"`
	WorkflowID         string                 `json:"workflow_id"`
	WorkflowInstanceID string                 `json:"workflow_instance_id"`
	NodeID             string                 `json:"node_id"`
	AssigneeID         *string                `json:"assignee_id"`
	Comment            *string                `json:"comment"`
	FormData           map[string]interface{} `json:"form_data"`
}

type ClaimTaskRequest struct {
	Comment *string `json:"comment"`
}

type CompleteTaskRequest struct {
	Comment  *string                `json:"comment"`
	FormData map[string]interface{} `json:"formData"`
}

// ====== Dependency Analysis ======

type DependencyEdge struct {
	Source string `json:"source"`
	Target string `json:"target"`
}

type CycleResult struct {
	Cycle  []string `json:"cycle"`
	Safe   bool     `json:"isSafe"`
}

type DependencyGraphResult struct {
	IsSafe            bool             `json:"isSafe"`
	TotalDefinitions  int              `json:"totalDefinitions"`
	TotalEdges        int              `json:"totalEdges"`
	Cycles            []CycleResult    `json:"cycles"`
}

type DefinitionCheckResult struct {
	DefinitionID string          `json:"definitionId"`
	IsSafe       bool            `json:"isSafe"`
	Dependencies []DependencyEdge `json:"dependencies"`
	Cycles       []CycleResult   `json:"cycles"`
}

type VisualizationData struct {
	Nodes []JSONB     `json:"nodes"`
	Edges []JSONB     `json:"edges"`
}

// ====== Pagination ======

type PaginatedRequest struct {
	Page    int `form:"page"`
	PageSize int `form:"page_size"`
}

func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}
