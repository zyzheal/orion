package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

// ============================================================
// JSON helpers for PostgreSQL JSONB columns
// ============================================================

// JSONB is a map type that serialises to/from PostgreSQL JSONB.
type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(src interface{}) error {
	if src == nil {
		*j = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, j)
	case string:
		return json.Unmarshal([]byte(v), j)
	default:
		return fmt.Errorf("cannot scan %T into JSONB", src)
	}
}

// WorkflowNodeList is a typed JSONB array for workflow nodes.
type WorkflowNodeList []WorkflowNode

func (n WorkflowNodeList) Value() (driver.Value, error) {
	if n == nil {
		return "[]", nil
	}
	return json.Marshal(n)
}

func (n *WorkflowNodeList) Scan(src interface{}) error {
	if src == nil {
		*n = nil
		return nil
	}
	data, err := toBytes(src)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, n)
}

// WorkflowEdgeList is a typed JSONB array for workflow edges.
type WorkflowEdgeList []WorkflowEdge

func (e WorkflowEdgeList) Value() (driver.Value, error) {
	if e == nil {
		return "[]", nil
	}
	return json.Marshal(e)
}

func (e *WorkflowEdgeList) Scan(src interface{}) error {
	if src == nil {
		*e = nil
		return nil
	}
	data, err := toBytes(src)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, e)
}

// HistoryList is a typed JSONB array for workflow history entries.
type HistoryList []WorkflowHistory

func (h HistoryList) Value() (driver.Value, error) {
	if h == nil {
		return "[]", nil
	}
	return json.Marshal(h)
}

func (h *HistoryList) Scan(src interface{}) error {
	if src == nil {
		*h = nil
		return nil
	}
	data, err := toBytes(src)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, h)
}

// StringList is a typed JSONB array for string slices.
type StringList []string

func (s StringList) Value() (driver.Value, error) {
	if s == nil {
		return nil, nil
	}
	return json.Marshal(s)
}

func (s *StringList) Scan(src interface{}) error {
	if src == nil {
		*s = nil
		return nil
	}
	data, err := toBytes(src)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, s)
}

func toBytes(src interface{}) ([]byte, error) {
	switch v := src.(type) {
	case []byte:
		return v, nil
	case string:
		return []byte(v), nil
	default:
		return nil, fmt.Errorf("cannot convert %T to bytes", src)
	}
}

// ============================================================
// LowCode App (component library — kept from skeleton)
// ============================================================

// LowCodeApp represents a reusable low-code component.
type LowCodeApp struct {
	ID            string    `db:"id" json:"id"`
	TenantID      string    `db:"tenant_id" json:"tenant_id"`
	Name          string    `db:"name" json:"name"`
	ComponentType string    `db:"component_type" json:"component_type"`
	Schema        JSONB     `db:"schema" json:"schema"`
	PreviewURL    string    `db:"preview_url" json:"preview_url,omitempty"`
	Version       int       `db:"version" json:"version"`
	CreatedAt     time.Time `db:"created_at" json:"created_at"`
}

// CreateLowCodeAppRequest is the request body for creating a LowCodeApp.
type CreateLowCodeAppRequest struct {
	Name          string `json:"name" binding:"required"`
	ComponentType string `json:"component_type" binding:"required"`
	Schema        JSONB  `json:"schema" binding:"required"`
}

// PaginatedRequest holds common pagination parameters.
type PaginatedRequest struct {
	Page     int `form:"page"`
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

// ============================================================
// Workflow Node Types
// ============================================================

// WorkflowNodeType enumerates all supported workflow node types.
type WorkflowNodeType string

const (
	NodeTypeStart        WorkflowNodeType = "start"
	NodeTypeApproval     WorkflowNodeType = "approval"
	NodeTypeCondition    WorkflowNodeType = "condition"
	NodeTypeNotification WorkflowNodeType = "notification"
	NodeTypeWebhook      WorkflowNodeType = "webhook"
	NodeTypeEnd          WorkflowNodeType = "end"
	NodeTypeTask         WorkflowNodeType = "task"
	NodeTypeSubWorkflow  WorkflowNodeType = "sub-workflow"
	NodeTypeDelay        WorkflowNodeType = "delay"
	NodeTypeTimer        WorkflowNodeType = "timer"
)

// ============================================================
// Workflow Node & Edge
// ============================================================

// Position stores the visual position of a node in the editor canvas.
type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// WorkflowNode is a single node in a workflow definition.
// Config is stored as raw JSON because its schema depends on Type.
type WorkflowNode struct {
	ID       string          `json:"id"`
	Type     WorkflowNodeType `json:"type"`
	Name     string          `json:"name"`
	Position Position        `json:"position"`
	Config   json.RawMessage `json:"config"`
}

// WorkflowEdge connects two nodes in a workflow definition.
type WorkflowEdge struct {
	ID           string  `json:"id"`
	Source       string  `json:"source"`
	Target       string  `json:"target"`
	SourceHandle *string `json:"sourceHandle,omitempty"`
	Condition    *string `json:"condition,omitempty"`
}

// ============================================================
// Workflow Definition
// ============================================================

// WorkflowDefinition is the persisted workflow template.
type WorkflowDefinition struct {
	ID          string           `db:"id" json:"id"`
	TenantID    string           `db:"tenant_id" json:"tenant_id"`
	Name        string           `db:"name" json:"name"`
	Description *string          `db:"description" json:"description,omitempty"`
	Version     int              `db:"version" json:"version"`
	Enabled     bool             `db:"enabled" json:"enabled"`
	Nodes       WorkflowNodeList `db:"nodes" json:"nodes"`
	Edges       WorkflowEdgeList `db:"edges" json:"edges"`
	CreatedBy   string           `db:"created_by" json:"created_by"`
	CreatedAt   time.Time        `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time        `db:"updated_at" json:"updated_at"`
}

// ============================================================
// Workflow Instance
// ============================================================

// WorkflowInstanceStatus enumerates the possible instance states.
type WorkflowInstanceStatus string

const (
	StatusPending    WorkflowInstanceStatus = "pending"
	StatusRunning    WorkflowInstanceStatus = "running"
	StatusSuspended  WorkflowInstanceStatus = "suspended"
	StatusCompleted  WorkflowInstanceStatus = "completed"
	StatusFailed     WorkflowInstanceStatus = "failed"
	StatusTerminated WorkflowInstanceStatus = "terminated"
)

// WorkflowHistory records a single event during workflow execution.
type WorkflowHistory struct {
	NodeID    string         `json:"node_id"`
	NodeName  string         `json:"node_name"`
	NodeType  WorkflowNodeType `json:"node_type"`
	Action    string         `json:"action"` // enter | execute | exit | error | skip
	Timestamp time.Time      `json:"timestamp"`
	Data      map[string]any `json:"data,omitempty"`
	Error     *string        `json:"error,omitempty"`
	Duration  *int64         `json:"duration,omitempty"` // milliseconds
}

// WorkflowInstance is a running (or completed) instance of a WorkflowDefinition.
type WorkflowInstance struct {
	ID                   string                `db:"id" json:"id"`
	WorkflowID           string                `db:"workflow_id" json:"workflow_id"`
	WorkflowDefinitionID string                `db:"workflow_definition_id" json:"workflow_definition_id"`
	TenantID             string                `db:"tenant_id" json:"tenant_id"`
	Status               WorkflowInstanceStatus `db:"status" json:"status"`
	CurrentNodeID        string                `db:"current_node_id" json:"current_node_id"`
	Variables            JSONB                 `db:"variables" json:"variables"`
	History              HistoryList           `db:"history" json:"history"`
	Input                JSONB                 `db:"input" json:"input"`
	Output               JSONB                 `db:"output" json:"output,omitempty"`
	Error                *string               `db:"error" json:"error,omitempty"`
	CreatedAt            time.Time             `db:"created_at" json:"created_at"`
	UpdatedAt            time.Time             `db:"updated_at" json:"updated_at"`
	CompletedAt          *time.Time            `db:"completed_at" json:"completed_at,omitempty"`
}

// WorkflowExecutionResult is the outcome of executing an instance.
type WorkflowExecutionResult struct {
	Success        bool              `json:"success"`
	InstanceID     string            `json:"instance_id"`
	Output         JSONB             `json:"output,omitempty"`
	Error          string            `json:"error,omitempty"`
	ExecutedNodes  []string          `json:"executed_nodes"`
	ExecutionTime  int64             `json:"execution_time"` // milliseconds
	Trace          []WorkflowHistory `json:"trace,omitempty"`
}

// WorkflowState is the lightweight status snapshot of an instance.
type WorkflowState struct {
	InstanceID    string                `json:"instance_id"`
	Status        WorkflowInstanceStatus `json:"status"`
	CurrentNodeID string                `json:"current_node_id"`
	Variables     JSONB                 `json:"variables"`
	History       HistoryList           `json:"history"`
}

// ============================================================
// Workflow Timer (delay / timer nodes)
// ============================================================

// WorkflowTimer is a persisted timer attached to a delay or timer node.
type WorkflowTimer struct {
	ID              string     `db:"id" json:"id"`
	InstanceID      string     `db:"instance_id" json:"instance_id"`
	NodeID          string     `db:"node_id" json:"node_id"`
	TimerType       string     `db:"timer_type" json:"timer_type"` // delay | timer
	DurationMs      *int64     `db:"duration_ms" json:"duration_ms,omitempty"`
	CronExpression  *string    `db:"cron_expression" json:"cron_expression,omitempty"`
	Timezone        string     `db:"timezone" json:"timezone"`
	MaxExecutions   *int       `db:"max_executions" json:"max_executions,omitempty"`
	ExecutionCount  int        `db:"execution_count" json:"execution_count"`
	ScheduledAt     time.Time  `db:"scheduled_at" json:"scheduled_at"`
	LastExecutedAt  *time.Time `db:"last_executed_at" json:"last_executed_at,omitempty"`
	ResumeEvent     *string    `db:"resume_event" json:"resume_event,omitempty"`
	Status          string     `db:"status" json:"status"` // pending | running | completed | cancelled
	OutputVariables JSONB      `db:"output_variables" json:"output_variables,omitempty"`
	Result          JSONB      `db:"result" json:"result,omitempty"`
	CreatedAt       time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time  `db:"updated_at" json:"updated_at"`
}

// ============================================================
// Workflow Task (manual / system tasks)
// ============================================================

// WorkflowTask is a human or system task created by a task node.
type WorkflowTask struct {
	ID             string     `db:"id" json:"id"`
	InstanceID     string     `db:"instance_id" json:"instance_id"`
	NodeID         string     `db:"node_id" json:"node_id"`
	TaskType       string     `db:"task_type" json:"task_type"`     // manual | system
	AssigneeType   string     `db:"assignee_type" json:"assignee_type"` // user | role
	AssigneeID     *string    `db:"assignee_id" json:"assignee_id,omitempty"`
	CandidateUsers StringList `db:"candidate_users" json:"candidate_users,omitempty"`
	CandidateRoles StringList `db:"candidate_roles" json:"candidate_roles,omitempty"`
	Title          *string    `db:"title" json:"title,omitempty"`
	Description    *string    `db:"description" json:"description,omitempty"`
	Status         string     `db:"status" json:"status"` // pending | assigned | completed | cancelled
	Priority       string     `db:"priority" json:"priority"`
	DueDate        *time.Time `db:"due_date" json:"due_date,omitempty"`
	CompletedBy    *string    `db:"completed_by" json:"completed_by,omitempty"`
	CompletedAt    *time.Time `db:"completed_at" json:"completed_at,omitempty"`
	Comment        *string    `db:"comment" json:"comment,omitempty"`
	Result         JSONB      `db:"result" json:"result,omitempty"`
	FormData       JSONB      `db:"form_data" json:"form_data,omitempty"`
	CreatedAt      time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time  `db:"updated_at" json:"updated_at"`
}

// ============================================================
// Workflow Trigger (event / cron)
// ============================================================

// WorkflowTrigger links an event or cron schedule to a workflow definition.
type WorkflowTrigger struct {
	ID               string     `db:"id" json:"id"`
	WorkflowID       string     `db:"workflow_id" json:"workflow_id"`
	TenantID         string     `db:"tenant_id" json:"tenant_id"`
	Name             string     `db:"name" json:"name"`
	Type             string     `db:"type" json:"type"` // event | cron
	Enabled          bool       `db:"enabled" json:"enabled"`
	EventType        *string    `db:"event_type" json:"event_type,omitempty"`
	EventFilter      JSONB      `db:"event_filter" json:"event_filter,omitempty"`
	CronExpression   *string    `db:"cron_expression" json:"cron_expression,omitempty"`
	Timezone         *string    `db:"timezone" json:"timezone,omitempty"`
	ConcurrencyLimit int        `db:"concurrency_limit" json:"concurrency_limit"`
	CreatedBy        *string    `db:"created_by" json:"created_by,omitempty"`
	CreatedAt        time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt        time.Time  `db:"updated_at" json:"updated_at"`
}

// ============================================================
// Dependency Analysis
// ============================================================

// CircularDependencyPath describes a cycle between workflow definitions.
type CircularDependencyPath struct {
	Cycle  []string `json:"cycle"`
	Names  []string `json:"names"`
	Length int      `json:"length"`
}

// DependencyAnalysisResult is the full output of a dependency analysis run.
type DependencyAnalysisResult struct {
	IsSafe            bool                     `json:"is_safe"`
	Cycles            []CircularDependencyPath `json:"cycles"`
	TotalDefinitions  int                      `json:"total_definitions"`
	TotalEdges        int                      `json:"total_edges"`
}

// VisualizationNode is a node in the dependency visualisation graph.
type VisualizationNode struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	InCycle bool   `json:"in_cycle"`
}

// VisualizationEdge is an edge in the dependency visualisation graph.
type VisualizationEdge struct {
	Source string `json:"source"`
	Target string `json:"target"`
}

// VisualizationData is the complete dependency visualisation payload.
type VisualizationData struct {
	Nodes  []VisualizationNode      `json:"nodes"`
	Edges  []VisualizationEdge      `json:"edges"`
	Cycles []CircularDependencyPath `json:"cycles"`
}

// ============================================================
// Node Config Types (unmarshalled from WorkflowNode.Config)
// ============================================================

// StartNodeConfig is the configuration for a start node.
type StartNodeConfig struct {
	Type            string         `json:"type"`
	OutputVariables map[string]any `json:"outputVariables,omitempty"`
}

// ApprovalNodeConfig is the configuration for an approval node.
type ApprovalNodeConfig struct {
	Type               string         `json:"type"`
	ApprovalFlowConfig map[string]any `json:"approvalFlowConfig,omitempty"`
	ApproverType       string         `json:"approverType"`   // user | role | dynamic
	ApproverIDs        []string       `json:"approverIds,omitempty"`
	ApprovalType       string         `json:"approvalType"`   // or | and
	Timeout            int            `json:"timeout"`         // hours
	TimeoutAction      string         `json:"timeoutAction"`  // approve | reject | escalate
	RejectAction       string         `json:"rejectAction"`   // to_initiator | to_previous
	ResultVariable     string         `json:"resultVariable,omitempty"`
}

// ConditionNodeConfig is the configuration for a condition branch node.
type ConditionNodeConfig struct {
	Type       string `json:"type"`
	Expression string `json:"expression"`
	Branches   []struct {
		Name      string `json:"name"`
		Condition string `json:"condition"`
	} `json:"branches"`
}

// NotificationNodeConfig is the configuration for a notification node.
type NotificationNodeConfig struct {
	Type             string   `json:"type"`
	Template         string   `json:"template"`
	Channels         []string `json:"channels"`   // dingtalk | wecom | feishu | email
	Receivers        []struct {
		Type  string `json:"type"`  // user | role | variable
		Value string `json:"value"`
	} `json:"receivers"`
	ContentVariables map[string]any `json:"contentVariables,omitempty"`
}

// WebhookNodeConfig is the configuration for a webhook node.
type WebhookNodeConfig struct {
	Type    string            `json:"type"`
	URL     string            `json:"url"`
	Method  string            `json:"method"` // GET | POST | PUT | DELETE
	Headers map[string]string `json:"headers,omitempty"`
	Body    string            `json:"body,omitempty"`
	Timeout int               `json:"timeout"` // milliseconds
	Retry   struct {
		Enabled    bool `json:"enabled"`
		MaxRetries int  `json:"maxRetries"`
		RetryDelay int  `json:"retryDelay"` // milliseconds
	} `json:"retry"`
}

// EndNodeConfig is the configuration for an end node.
type EndNodeConfig struct {
	Type            string         `json:"type"`
	OutputVariables map[string]any `json:"outputVariables,omitempty"`
}

// TaskNodeConfig is the configuration for a task node.
type TaskNodeConfig struct {
	Type           string         `json:"type"`
	TaskType       string         `json:"taskType"`       // manual | system
	AssigneeType   string         `json:"assigneeType"`   // user | role | variable
	AssigneeIDs    []string       `json:"assigneeIds,omitempty"`
	AssigneeVariable string       `json:"assigneeVariable,omitempty"`
	Title          string         `json:"title,omitempty"`
	Description    string         `json:"description,omitempty"`
	Timeout        int            `json:"timeout,omitempty"`         // seconds
	TimeoutAction  string         `json:"timeoutAction,omitempty"`   // auto_complete | notify | escalate
	FormSchema     map[string]any `json:"formSchema,omitempty"`
	ResultVariable string         `json:"resultVariable,omitempty"`
	Priority       string         `json:"priority,omitempty"`
}

// VariableMapping maps a source variable path to a target variable path.
type VariableMapping struct {
	Source string `json:"source"`
	Target string `json:"target"`
}

// SubWorkflowNodeConfig is the configuration for a sub-workflow node.
type SubWorkflowNodeConfig struct {
	Type             string           `json:"type"`
	SubWorkflowID    string           `json:"subWorkflowId"`
	SubWorkflowVersion *int           `json:"subWorkflowVersion,omitempty"`
	InputMappings    []VariableMapping `json:"inputMappings,omitempty"`
	OutputMappings   []VariableMapping `json:"outputMappings,omitempty"`
	WaitForCompletion bool             `json:"waitForCompletion"`
	ResultVariable   string           `json:"resultVariable,omitempty"`
}

// DelayNodeConfig is the configuration for a delay node.
type DelayNodeConfig struct {
	Type            string `json:"type"`
	Duration        int    `json:"duration"`           // seconds
	DurationVariable string `json:"durationVariable,omitempty"`
	ResumeEvent     string `json:"resumeEvent,omitempty"`
	TimeoutAction   string `json:"timeoutAction,omitempty"` // continue | terminate
	ResultVariable  string `json:"resultVariable,omitempty"`
}

// TimerNodeConfig is the configuration for a timer node.
type TimerNodeConfig struct {
	Type            string         `json:"type"`
	CronExpression  string         `json:"cronExpression"`
	Timezone        string         `json:"timezone,omitempty"`
	MaxExecutions   *int           `json:"maxExecutions,omitempty"`
	InputVariables  map[string]any `json:"inputVariables,omitempty"`
	ResultVariable  string         `json:"resultVariable,omitempty"`
}

// ============================================================
// Request / Response types
// ============================================================

// CreateWorkflowDefinitionRequest is the body for creating a workflow definition.
type CreateWorkflowDefinitionRequest struct {
	Name        string           `json:"name" binding:"required"`
	Description string           `json:"description"`
	Version     int              `json:"version"`
	Enabled     *bool            `json:"enabled"`
	Nodes       WorkflowNodeList `json:"nodes" binding:"required"`
	Edges       WorkflowEdgeList `json:"edges" binding:"required"`
	CreatedBy   string           `json:"created_by"`
}

// UpdateWorkflowDefinitionRequest is the body for updating a workflow definition.
type UpdateWorkflowDefinitionRequest struct {
	Name        *string          `json:"name"`
	Description *string          `json:"description"`
	Version     *int             `json:"version"`
	Enabled     *bool            `json:"enabled"`
	Nodes       WorkflowNodeList `json:"nodes"`
	Edges       WorkflowEdgeList `json:"edges"`
}

// CreateWorkflowInstanceRequest is the body for creating a workflow instance.
type CreateWorkflowInstanceRequest struct {
	Input     map[string]any `json:"input"`
	CreatedBy string         `json:"created_by"`
}

// CreateTriggerRequest is the body for creating a trigger.
type CreateTriggerRequest struct {
	WorkflowID       string `json:"workflow_id" binding:"required"`
	Name             string `json:"name" binding:"required"`
	Type             string `json:"type" binding:"required"` // event | cron
	Enabled          *bool  `json:"enabled"`
	EventType        string `json:"event_type"`
	EventFilter      JSONB  `json:"event_filter"`
	CronExpression   string `json:"cron_expression"`
	Timezone         string `json:"timezone"`
	ConcurrencyLimit *int   `json:"concurrency_limit"`
	CreatedBy        string `json:"created_by"`
}

// UpdateTriggerRequest is the body for updating a trigger.
type UpdateTriggerRequest struct {
	Name             *string `json:"name"`
	Enabled          *bool   `json:"enabled"`
	EventType        *string `json:"event_type"`
	EventFilter      JSONB   `json:"event_filter"`
	CronExpression   *string `json:"cron_expression"`
	Timezone         *string `json:"timezone"`
	ConcurrencyLimit *int    `json:"concurrency_limit"`
}

// ============================================================
// Sentinel errors
// ============================================================

var (
	ErrNotFound           = errors.New("not found")
	ErrNotEnabled         = errors.New("not enabled")
	ErrInvalidStatus      = errors.New("invalid status")
	ErrCircularDependency = errors.New("circular dependency")
	ErrNoStartNode        = errors.New("workflow must have a start node")
	ErrNoMatchingBranch   = errors.New("no matching condition branch")
	ErrNoOutgoingEdge     = errors.New("no outgoing edge for condition")
)
