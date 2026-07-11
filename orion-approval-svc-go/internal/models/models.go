package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// HistoryEvent represents a single event in the approval timeline/history.
type HistoryEvent struct {
	EventType   string    `json:"event_type"` // "approved", "rejected", "canceled", "withdrawn", "created", "delegated", "reassigned"
	ActorID     string    `json:"actor_id"`
	Comment     string    `json:"comment"`
	Timestamp   time.Time `json:"timestamp"`
	StepIndex   *int      `json:"step_index"`
	LevelIndex  *int      `json:"level_index,omitempty"`
	FromUserID  *string   `json:"from_user_id"`
	ToUserID    *string   `json:"to_user_id"`
}

// ApprovalHistory holds the full history/timeline for an approval request.
type ApprovalHistory struct {
	RequestID   string         `json:"request_id"`
	Title       string         `json:"title"`
	Status      ApprovalStatus `json:"status"`
	TotalLevels int            `json:"total_levels"`
	History     []HistoryEvent `json:"history"`
}

// ApprovalTemplate represents a reusable approval workflow template.
type ApprovalTemplate struct {
	ID              string         `db:"id" json:"id"`
	TenantID        string         `db:"tenant_id" json:"tenant_id"`
	Name            string         `db:"name" json:"name"`
	Description     *string        `db:"description" json:"description"`
	ResourceType    string         `db:"resource_type" json:"resource_type"`
	Levels          LevelConfigs   `db:"levels" json:"levels"`
	Mode            ApprovalMode   `db:"mode" json:"mode"`
	IsDefault       bool           `db:"is_default" json:"is_default"`
	CreatedAt       time.Time      `db:"created_at" json:"created_at"`
}

// CreateTemplateRequest is the input for creating a template.
type CreateTemplateRequest struct {
	Name         string          `json:"name" binding:"required"`
	Description  *string         `json:"description"`
	ResourceType string          `json:"resource_type" binding:"required"`
	Levels       []ApprovalLevel `json:"levels" binding:"required,min=1"`
	Mode         ApprovalMode    `json:"mode"`
	IsDefault    bool            `json:"is_default"`
}

// EmergencyReason classifies why an emergency approval is needed.
type EmergencyReason string

const (
	EmergencyReasonOutage       EmergencyReason = "outage"
	EmergencyReasonSecurity     EmergencyReason = "security"
	EmergencyReasonCompliance   EmergencyReason = "compliance"
	EmergencyReasonPerformance  EmergencyReason = "performance"
	EmergencyReasonOther        EmergencyReason = "other"
)

// EmergencyApproval represents an emergency approval request.
type EmergencyApproval struct {
	ID                string         `db:"id" json:"id"`
	TenantID          string         `db:"tenant_id" json:"tenant_id"`
	Title             string         `db:"title" json:"title"`
	Description       string         `db:"description" json:"description"`
	RequestedBy       string         `db:"requested_by" json:"requested_by"`
	ResourceType      string         `db:"resource_type" json:"resource_type"`
	ResourceID        string         `db:"resource_id" json:"resource_id"`
	Reason            EmergencyReason `db:"reason" json:"reason"`
	ImpactDescription string         `db:"impact_description" json:"impact_description"`
	ApproverIDs       LevelConfigs   `db:"approver_ids" json:"approver_ids"` // stored as LevelConfigs for reuse of scanner/valuer
	Status            ApprovalStatus `db:"status" json:"status"`
	CreatedAt         time.Time      `db:"created_at" json:"created_at"`
}

// EmergencyApprovalRequest is the input for requesting emergency approval.
type EmergencyApprovalRequest struct {
	Title             string          `json:"title" binding:"required"`
	Description       string          `json:"description" binding:"required"`
	RequestedBy       string          `json:"requested_by" binding:"required"`
	ResourceType      string          `json:"resource_type" binding:"required"`
	ResourceID        string          `json:"resource_id" binding:"required"`
	Reason            EmergencyReason `json:"reason" binding:"required"`
	ImpactDescription string          `json:"impact_description" binding:"required"`
	ApproverIDs       []string        `json:"approver_ids" binding:"required,min=1"`
}

// ReviewRequest is the input for the unified review action.
type ReviewRequest struct {
	ReviewerID string  `json:"reviewer_id" binding:"required"`
	Action     string  `json:"action" binding:"required"`
	Comment    *string `json:"comment"`
}

// WithdrawRequest is the input for withdrawing an approval.
type WithdrawRequest struct {
	UserID string  `json:"user_id" binding:"required"`
	Reason *string `json:"reason"`
}

// DelegateRequest is the input for delegating an approval step.
type DelegateRequest struct {
	FromUserID string  `json:"from_user_id" binding:"required"`
	ToUserID   string  `json:"to_user_id" binding:"required"`
	Reason     *string `json:"reason"`
}

// ReassignRequest is the input for reassigning an approver.
type ReassignRequest struct {
	FromUserID string  `json:"from_user_id" binding:"required"`
	ToUserID   string  `json:"to_user_id" binding:"required"`
	Reason     *string `json:"reason"`
}

// ApprovalTrend holds daily trend data for approvals.
type ApprovalTrend struct {
	Date     string `json:"date"`
	Submitted int   `json:"submitted"`
	Approved  int   `json:"approved"`
	Rejected  int   `json:"rejected"`
	Canceled  int   `json:"canceled"`
}

// TrendResult holds the full trend response.
type TrendResult struct {
	TenantID   string         `json:"tenant_id"`
	StartDate  string         `json:"start_date"`
	EndDate    string         `json:"end_date"`
	Trend      []ApprovalTrend `json:"trend"`
}

// ApprovalStatistics holds aggregate approval statistics with period.
type ApprovalStatistics struct {
	TenantID        string `json:"tenant_id"`
	PeriodStart     string `json:"period_start"`
	PeriodEnd       string `json:"period_end"`
	TotalSubmitted  int    `json:"total_submitted"`
	TotalApproved   int    `json:"total_approved"`
	TotalRejected   int    `json:"total_rejected"`
	TotalCanceled   int    `json:"total_canceled"`
	ApprovalRate    float64 `json:"approval_rate"`
	AvgDurationHours float64 `json:"avg_duration_hours"`
}

// ApprovalStatus represents the lifecycle of an approval.
type ApprovalStatus string

const (
	ApprovalPending  ApprovalStatus = "pending"
	ApprovalApproved ApprovalStatus = "approved"
	ApprovalRejected ApprovalStatus = "rejected"
	ApprovalCanceled ApprovalStatus = "canceled"
)

// StepStatus represents the lifecycle of an approval step.
type StepStatus string

const (
	StepPending  StepStatus = "pending"
	StepApproved StepStatus = "approved"
	StepRejected StepStatus = "rejected"
	StepSkipped  StepStatus = "skipped"
	StepWaiting  StepStatus = "waiting"
)

// ApprovalMode controls how multi-level approvals are processed.
type ApprovalMode string

const (
	ModeSerial   ApprovalMode = "serial"
	ModeParallel ApprovalMode = "parallel"
)

// LevelConfig holds per-level required approvals configuration.
type LevelConfig struct {
	Level             int `json:"level"`
	RequiredApprovals int `json:"required_approvals"`
}

// LevelConfigs is a slice of LevelConfig that implements sql.Scanner and driver.Valuer
// for JSONB database columns.
type LevelConfigs []LevelConfig

// Scan implements the sql.Scanner interface for reading JSONB from PostgreSQL.
func (lc *LevelConfigs) Scan(src interface{}) error {
	if src == nil {
		*lc = nil
		return nil
	}
	var data []byte
	switch v := src.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		return fmt.Errorf("LevelConfigs.Scan: unsupported type %T", src)
	}
	return json.Unmarshal(data, lc)
}

// Value implements the driver.Valuer interface for writing JSONB to PostgreSQL.
func (lc LevelConfigs) Value() (driver.Value, error) {
	if lc == nil {
		return nil, nil
	}
	data, err := json.Marshal(lc)
	if err != nil {
		return nil, fmt.Errorf("LevelConfigs.Value: %w", err)
	}
	return data, nil
}

// Approval represents an approval request.
type Approval struct {
	ID                string         `db:"id" json:"id"`
	TenantID          string         `db:"tenant_id" json:"tenant_id"`
	DefinitionID      *string        `db:"definition_id" json:"definition_id,omitempty"`
	ResourceType      string         `db:"resource_type" json:"resource_type"`
	ResourceID        string         `db:"resource_id" json:"resource_id"`
	Title             *string        `db:"title" json:"title,omitempty"`
	Status            ApprovalStatus `db:"status" json:"status"`
	RequestedBy       *string        `db:"requested_by" json:"requested_by,omitempty"`
	CurrentStep       int            `db:"current_step" json:"current_step"`
	TotalSteps        int            `db:"total_steps" json:"total_steps"`
	RequiredApprovals int            `db:"required_approvals" json:"required_approvals"`
	LevelConfigs      LevelConfigs   `db:"level_config" json:"level_config,omitempty"`
	Result            *string        `db:"result" json:"result,omitempty"`
	CompletedAt       *time.Time     `db:"completed_at" json:"completed_at,omitempty"`
	CreatedAt         time.Time      `db:"created_at" json:"created_at"`
}

// ApprovalStep represents a step in an approval workflow.
type ApprovalStep struct {
	ID         string     `db:"id" json:"id"`
	ApprovalID string     `db:"approval_id" json:"approval_id"`
	StepIndex  int        `db:"step_index" json:"step_index"`
	Level      int        `db:"level" json:"level"`
	ApproverID *string    `db:"approver_id" json:"approver_id,omitempty"`
	Status     StepStatus `db:"status" json:"status"`
	Comment    *string    `db:"comment" json:"comment,omitempty"`
	ActedAt    *time.Time `db:"acted_at" json:"acted_at,omitempty"`
}

// ApprovalLevel defines a single level in a multi-level approval workflow.
type ApprovalLevel struct {
	LevelIndex        int      `json:"level_index"`
	ApproverIDs       []string `json:"approver_ids"`
	RequiredApprovals int      `json:"required_approvals"`
}

// SubmitApprovalRequest is the input for submitting a multi-level approval.
type SubmitApprovalRequest struct {
	Title        string          `json:"title" binding:"required"`
	Description  *string         `json:"description"`
	ResourceType string          `json:"resource_type" binding:"required"`
	ResourceID   string          `json:"resource_id" binding:"required"`
	RequestedBy  string          `json:"requested_by" binding:"required"`
	Levels       []ApprovalLevel `json:"levels" binding:"required,min=1"`
	Mode         ApprovalMode    `json:"mode"`
}

// CreateApprovalRequest is the input for creating a simple approval.
type CreateApprovalRequest struct {
	ResourceType      string  `json:"resource_type" binding:"required"`
	ResourceID        string  `json:"resource_id" binding:"required"`
	Title             *string `json:"title"`
	RequestedBy       *string `json:"requested_by"`
	TotalSteps        int     `json:"total_steps"`
	RequiredApprovals int     `json:"required_approvals"`
}

// ApproveStepRequest is the input for approving a step.
type ApproveStepRequest struct {
	Comment *string `json:"comment"`
}

// RejectStepRequest is the input for rejecting a step.
type RejectStepRequest struct {
	Comment *string `json:"comment" binding:"required"`
}

// ApprovalWithSteps pairs an approval with its steps for API responses.
type ApprovalWithSteps struct {
	Approval *Approval      `json:"approval"`
	Steps    []ApprovalStep `json:"steps"`
}

// ApprovalStats holds aggregate approval statistics.
type ApprovalStats struct {
	Total    int `db:"total" json:"total"`
	Pending  int `db:"pending" json:"pending"`
	Approved int `db:"approved" json:"approved"`
	Rejected int `db:"rejected" json:"rejected"`
	Canceled int `db:"canceled" json:"canceled"`
}

// PaginatedRequest provides pagination parameters.
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

// ========== Approval Flow Config ==========

// FlowNodeType represents the type of a flow node.
type FlowNodeType string

const (
	FlowNodeTypeHuman          FlowNodeType = "human"
	FlowNodeTypeCondition      FlowNodeType = "condition"
	FlowNodeTypeAgent          FlowNodeType = "agent"
	FlowNodeTypeParallelGroup  FlowNodeType = "parallel-group"
	FlowNodeTypeFallbackChain  FlowNodeType = "fallback-chain"
)

// FlowNode represents a node in the approval flow.
type FlowNode struct {
	ID              string     `json:"id"`
	Name            string     `json:"name"`
	NodeType        FlowNodeType `json:"node_type"`
	ApproverType    string     `json:"approver_type"`    // "role", "user", "oncall", "department", "reporting-line"
	ApproverValue   string     `json:"approver_value"`
	BackupApprovers []string   `json:"backup_approvers"`
	TimeoutMinutes  int        `json:"timeout_minutes"`
	TimeoutAction   string     `json:"timeout_action"` // "remind", "escalate", "reject", "approve"
	OnApprove       string     `json:"on_approve"`      // "next", "complete"
	OnReject        string     `json:"on_reject"`       // "reject"
}

// FlowConfig represents an approval flow configuration.
type FlowConfig struct {
	ID              string      `db:"id" json:"id"`
	TenantID        string      `db:"tenant_id" json:"tenant_id"`
	FlowID          string      `db:"flow_id" json:"flow_id"`
	Name            string      `db:"name" json:"name"`
	Description     *string     `db:"description" json:"description"`
	Enabled         bool        `db:"enabled" json:"enabled"`
	CapabilityIDs   JSONBArray  `db:"capability_ids" json:"capability_ids"`
	Environments    JSONBArray  `db:"environments" json:"environments"`
	MinRiskLevel    int         `db:"min_risk_level" json:"min_risk_level"`
	MaxRiskLevel    int         `db:"max_risk_level" json:"max_risk_level"`
	Priority        int         `db:"priority" json:"priority"`
	Nodes           FlowNodes   `db:"nodes" json:"nodes"`
	Version         int         `db:"version" json:"version"`
	CreatedAt       time.Time   `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time   `db:"updated_at" json:"updated_at"`
}

// FlowNodes is a slice of FlowNode that implements sql.Scanner and driver.Valuer.
type FlowNodes []FlowNode

// Scan implements sql.Scanner for FlowNodes.
func (fn *FlowNodes) Scan(src interface{}) error {
	if src == nil {
		*fn = nil
		return nil
	}
	var data []byte
	switch v := src.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		return fmt.Errorf("FlowNodes.Scan: unsupported type %T", src)
	}
	return json.Unmarshal(data, fn)
}

// Value implements driver.Valuer for FlowNodes.
func (fn FlowNodes) Value() (driver.Value, error) {
	if fn == nil {
		return nil, nil
	}
	return json.Marshal(fn)
}

// JSONBArray is a string slice that implements sql.Scanner and driver.Valuer for JSONB.
type JSONBArray []string

// Scan implements sql.Scanner for JSONBArray.
func (a *JSONBArray) Scan(src interface{}) error {
	if src == nil {
		*a = nil
		return nil
	}
	var data []byte
	switch v := src.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		return fmt.Errorf("JSONBArray.Scan: unsupported type %T", src)
	}
	return json.Unmarshal(data, a)
}

// Value implements driver.Valuer for JSONBArray.
func (a JSONBArray) Value() (driver.Value, error) {
	if a == nil {
		return nil, nil
	}
	return json.Marshal(a)
}

// ========== Agent Analysis Models ==========

// AgentEvaluationRequest represents a request for AI agent evaluation.
type AgentEvaluationRequest struct {
	Operation       string                 `json:"operation"`
	Resource        string                 `json:"resource"`
	Requester       string                 `json:"requester"`
	Environment     string                 `json:"environment"`
	RiskLevel       int                    `json:"risk_level"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
}

// AgentEvaluationResult represents the result of AI agent evaluation.
type AgentEvaluationResult struct {
	Action           string   `json:"action"`
	Confidence       float64  `json:"confidence"`
	Reason           string   `json:"reason"`
	RiskScore        int      `json:"risk_score"`
	RiskFactors      []string `json:"risk_factors"`
	SuggestedApprover string  `json:"suggested_approver,omitempty"`
}
