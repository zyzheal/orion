package models

import (
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// ==================== JSONB Helper ====================

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

// JSONBSlice is a JSONB array type for storing action lists.
type JSONBSlice []map[string]interface{}

func (j JSONBSlice) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONBSlice) Scan(src interface{}) error {
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
		return fmt.Errorf("cannot scan %T into JSONBSlice", src)
	}
}

// ==================== Enums ====================

// HealingActionType represents the type of healing action.
type HealingActionType string

const (
	ActionRestart  HealingActionType = "restart"
	ActionScale    HealingActionType = "scale"
	ActionFailover HealingActionType = "failover"
	ActionRollback HealingActionType = "rollback"
)

// IncidentType represents what kind of incident triggered self-healing.
type IncidentType string

const (
	IncidentHighCPU             IncidentType = "high_cpu"
	IncidentHighMemory          IncidentType = "high_memory"
	IncidentHighErrorRate       IncidentType = "high_error_rate"
	IncidentHighLatency         IncidentType = "high_latency"
	IncidentPodCrash            IncidentType = "pod_crash"
	IncidentNodeFailure         IncidentType = "node_failure"
	IncidentServiceDown         IncidentType = "service_down"
	IncidentDeploymentFailure   IncidentType = "deployment_failure"
	IncidentDiskFull            IncidentType = "disk_full"
	IncidentNetworkTimeout      IncidentType = "network_timeout"
	IncidentCustom              IncidentType = "custom"
)

// IncidentSeverity represents the severity level of an incident.
type IncidentSeverity string

const (
	SeverityCritical IncidentSeverity = "critical"
	SeverityWarning  IncidentSeverity = "warning"
	SeverityInfo     IncidentSeverity = "info"
)

// IncidentStatus represents the current status of a healing incident.
type IncidentStatus string

const (
	StatusNew            IncidentStatus = "new"
	StatusEvaluating     IncidentStatus = "evaluating"
	StatusHealing        IncidentStatus = "healing"
	StatusHealed         IncidentStatus = "healed"
	StatusFailed         IncidentStatus = "failed"
	StatusEscalated      IncidentStatus = "escalated"
	StatusPendingApproval IncidentStatus = "pending_approval"
	StatusCancelled      IncidentStatus = "cancelled"
)

// ApprovalStatus represents the status of an approval request.
type ApprovalStatus string

const (
	ApprovalNotRequired ApprovalStatus = "not_required"
	ApprovalPending     ApprovalStatus = "pending"
	ApprovalApproved    ApprovalStatus = "approved"
	ApprovalRejected    ApprovalStatus = "rejected"
	ApprovalExpired     ApprovalStatus = "expired"
)

// RiskLevel represents the risk level of a healing action.
type RiskLevel string

const (
	RiskLow     RiskLevel = "low"
	RiskMedium  RiskLevel = "medium"
	RiskHigh    RiskLevel = "high"
	RiskCritical RiskLevel = "critical"
)

// ExecutionStatus represents the status of a rule execution.
type ExecutionStatus string

const (
	ExecRunning   ExecutionStatus = "running"
	ExecSucceeded ExecutionStatus = "succeeded"
	ExecFailed    ExecutionStatus = "failed"
)

// ==================== Healing Rule (existing, enhanced) ====================

type HealingRule struct {
	ID            string     `db:"id" json:"id"`
	TenantID      string     `db:"tenant_id" json:"tenant_id"`
	Name          string     `db:"name" json:"name"`
	TriggerType   string     `db:"trigger_type" json:"trigger_type"`
	Action        string     `db:"action" json:"action"`
	Status        string     `db:"status" json:"status"`
	Config        JSONB      `db:"config" json:"config,omitempty"`
	Enabled       bool       `db:"enabled" json:"enabled"`
	ExecutionCount int       `db:"execution_count" json:"execution_count"`
	LastTriggered *time.Time `db:"last_triggered" json:"last_triggered,omitempty"`
	CreatedAt     time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time  `db:"updated_at" json:"updated_at"`
}

type CreateHealingRuleRequest struct {
	Name        string `json:"name" binding:"required"`
	TriggerType string `json:"trigger_type" binding:"required"`
	Action      string `json:"action" binding:"required"`
	Config      JSONB  `json:"config"`
}

type UpdateHealingRuleRequest struct {
	Name        *string `json:"name"`
	TriggerType *string `json:"trigger_type"`
	Action      *string `json:"action"`
	Config      JSONB   `json:"config"`
	Enabled     *bool   `json:"enabled"`
}

// ==================== Healing Strategy ====================

// HealingAction defines a single healing action.
type HealingAction struct {
	Type        HealingActionType    `json:"type"`
	Params      map[string]interface{} `json:"params"`
	Timeout     int                  `json:"timeout,omitempty"`
	Rollback    bool                 `json:"rollback,omitempty"`
	Description string               `json:"description,omitempty"`
}

// HealingCondition defines a condition for strategy matching.
type HealingCondition struct {
	Field    string      `json:"field"`
	Operator string      `json:"operator"`
	Value    interface{} `json:"value"`
}

// HealingStrategy defines a healing strategy configuration.
type HealingStrategy struct {
	ID             string             `json:"id"`
	Name           string             `json:"name"`
	TriggerType    IncidentType       `json:"trigger_type"`
	Actions        []HealingAction    `json:"actions"`
	Conditions     []HealingCondition `json:"conditions,omitempty"`
	Confidence     int                `json:"confidence"`
	Enabled        bool               `json:"enabled"`
	Description    string             `json:"description,omitempty"`
	Environments   []string           `json:"environments,omitempty"`
	MaxRetries     int                `json:"max_retries,omitempty"`
	RetryCooldownMs int              `json:"retry_cooldown_ms,omitempty"`
}

// ==================== Healing Incident ====================

// HealingActionResult represents the result of executing a single healing action.
type HealingActionResult struct {
	Type           HealingActionType `json:"type"`
	Success        bool              `json:"success"`
	DurationMs     int64             `json:"duration_ms"`
	Message        string            `json:"message,omitempty"`
	Error          string            `json:"error,omitempty"`
	RollbackNeeded bool              `json:"rollback_needed,omitempty"`
	RollbackSuccess bool             `json:"rollback_success,omitempty"`
	Verified       bool              `json:"verified,omitempty"`
	ExecutedAt     time.Time         `json:"executed_at"`
}

// HealingResult represents the overall result of a healing operation.
type HealingResult struct {
	Success        bool                  `json:"success"`
	Duration       int64                 `json:"duration"`
	ActionsExecuted []HealingActionResult `json:"actions_executed"`
	ErrorMessage   string                `json:"error_message,omitempty"`
	Effectiveness  int                   `json:"effectiveness,omitempty"`
	Recurred       bool                  `json:"recurred,omitempty"`
	VerifiedAt     *time.Time            `json:"verified_at,omitempty"`
}

// HealingIncident represents a self-healing incident.
type HealingIncident struct {
	ID                string            `db:"id" json:"id"`
	TenantID          string            `db:"tenant_id" json:"tenant_id"`
	AlertID           *string           `db:"alert_id" json:"alert_id,omitempty"`
	Type              IncidentType      `db:"type" json:"type"`
	Severity          IncidentSeverity  `db:"severity" json:"severity"`
	AppName           string            `db:"app_name" json:"app_name"`
	Environment       string            `db:"environment" json:"environment"`
	StrategyID        *string           `db:"strategy_id" json:"strategy_id,omitempty"`
	StrategyName      *string           `db:"strategy_name" json:"strategy_name,omitempty"`
	Actions           JSONBSlice        `db:"actions" json:"actions"`
	Status            IncidentStatus    `db:"status" json:"status"`
	Attempts          int               `db:"attempts" json:"attempts"`
	ApprovalStatus    *ApprovalStatus   `db:"approval_status" json:"approval_status,omitempty"`
	ApprovalRequestID *string           `db:"approval_request_id" json:"approval_request_id,omitempty"`
	Result            *HealingResult    `db:"-" json:"result,omitempty"`
	Error             *string           `db:"error" json:"error,omitempty"`
	Tags              JSONB             `db:"tags" json:"tags,omitempty"`
	StartedAt         time.Time         `db:"started_at" json:"started_at"`
	CompletedAt       *time.Time        `db:"completed_at" json:"completed_at,omitempty"`
}

// ResultJSON is used for DB scan of the result column.
type ResultJSON HealingResult

func (r *HealingResult) Scan(src interface{}) error {
	if src == nil {
		return nil
	}
	var b []byte
	switch v := src.(type) {
	case []byte:
		b = v
	case string:
		b = []byte(v)
	default:
		return fmt.Errorf("cannot scan %T into HealingResult", src)
	}
	return json.Unmarshal(b, r)
}

// HealingIncidentDB is the DB representation with raw result bytes.
type HealingIncidentDB struct {
	ID                string           `db:"id"`
	TenantID          string           `db:"tenant_id"`
	AlertID           *string          `db:"alert_id"`
	Type              string           `db:"type"`
	Severity          string           `db:"severity"`
	AppName           string           `db:"app_name"`
	Environment       string           `db:"environment"`
	StrategyID        *string          `db:"strategy_id"`
	StrategyName      *string          `db:"strategy_name"`
	Actions           JSONBSlice       `db:"actions"`
	Status            string           `db:"status"`
	Attempts          int              `db:"attempts"`
	ApprovalStatus    *string          `db:"approval_status"`
	ApprovalRequestID *string          `db:"approval_request_id"`
	ResultRaw         []byte           `db:"result"`
	Error             *string          `db:"error"`
	Tags              JSONB            `db:"tags"`
	StartedAt         time.Time        `db:"started_at"`
	CompletedAt       *time.Time       `db:"completed_at"`
}

// ToIncident converts a DB row to a HealingIncident.
func (d *HealingIncidentDB) ToIncident() HealingIncident {
	inc := HealingIncident{
		ID:                d.ID,
		TenantID:          d.TenantID,
		AlertID:           d.AlertID,
		Type:              IncidentType(d.Type),
		Severity:          IncidentSeverity(d.Severity),
		AppName:           d.AppName,
		Environment:       d.Environment,
		StrategyID:        d.StrategyID,
		StrategyName:      d.StrategyName,
		Actions:           d.Actions,
		Status:            IncidentStatus(d.Status),
		Attempts:          d.Attempts,
		Error:             d.Error,
		Tags:              d.Tags,
		StartedAt:         d.StartedAt,
		CompletedAt:       d.CompletedAt,
	}
	if d.ApprovalStatus != nil {
		as := ApprovalStatus(*d.ApprovalStatus)
		inc.ApprovalStatus = &as
	}
	inc.ApprovalRequestID = d.ApprovalRequestID
	if d.ResultRaw != nil {
		var result HealingResult
		if json.Unmarshal(d.ResultRaw, &result) == nil {
			inc.Result = &result
		}
	}
	return inc
}

// ==================== Approval Request ====================

// ApprovalRequest represents a request for manual approval of a healing action.
type ApprovalRequest struct {
	ID                 string        `db:"id" json:"id"`
	TenantID           string        `db:"tenant_id" json:"tenant_id"`
	IncidentID         string        `db:"incident_id" json:"incident_id"`
	Title              string        `db:"title" json:"title"`
	Description        *string       `db:"description" json:"description,omitempty"`
	RiskLevel          RiskLevel     `db:"risk_level" json:"risk_level"`
	RecommendedActions JSONBSlice    `db:"recommended_actions" json:"recommended_actions"`
	Status             ApprovalStatus `db:"status" json:"status"`
	RequestedBy        string        `db:"requested_by" json:"requested_by"`
	ApprovedBy         *string       `db:"approved_by" json:"approved_by,omitempty"`
	ApprovalReason     *string       `db:"approval_reason" json:"approval_reason,omitempty"`
	RequestedAt        time.Time     `db:"requested_at" json:"requested_at"`
	RespondedAt        *time.Time    `db:"responded_at" json:"responded_at,omitempty"`
	ExpiresAt          *time.Time    `db:"expires_at" json:"expires_at,omitempty"`
}

// ApprovalResponse is the input for responding to an approval request.
type ApprovalResponse struct {
	Approved    bool   `json:"approved" binding:"required"`
	Reason      string `json:"reason"`
	RespondedBy string `json:"responded_by" binding:"required"`
}

// ==================== Rule Execution ====================

// HealingExecution represents an execution of a healing rule.
type HealingExecution struct {
	ID           string          `db:"id" json:"id"`
	RuleID       string          `db:"rule_id" json:"rule_id"`
	TriggerEvent JSONB           `db:"trigger_event" json:"trigger_event"`
	Status       ExecutionStatus `db:"status" json:"status"`
	Result       JSONB           `db:"result" json:"result,omitempty"`
	ErrorMessage *string         `db:"error_message" json:"error_message,omitempty"`
	StartedAt    time.Time       `db:"started_at" json:"started_at"`
	CompletedAt  *time.Time      `db:"completed_at" json:"completed_at,omitempty"`
}

// ==================== Monitoring Alert (input from monitoring system) ====================

// MonitoringAlertEvent represents an incoming alert from the monitoring system.
type MonitoringAlertEvent struct {
	AlertID    string            `json:"alert_id" binding:"required"`
	Metric     string            `json:"metric" binding:"required"`
	Severity   IncidentSeverity  `json:"severity" binding:"required"`
	Value      float64           `json:"value"`
	Threshold  float64           `json:"threshold"`
	Message    string            `json:"message"`
	Tags       map[string]string `json:"tags"`
	TriggeredAt time.Time        `json:"triggered_at"`
}

// ==================== Effectiveness Stats ====================

// EffectivenessStats holds healing effectiveness metrics.
type EffectivenessStats struct {
	TotalIncidents      int                                  `json:"total_incidents"`
	HealedIncidents     int                                  `json:"healed_incidents"`
	FailedIncidents     int                                  `json:"failed_incidents"`
	EscalatedIncidents  int                                  `json:"escalated_incidents"`
	SuccessRate         float64                              `json:"success_rate"`
	AverageDurationMs   float64                              `json:"average_duration_ms"`
	MedianDurationMs    float64                              `json:"median_duration_ms"`
	AverageEffectiveness float64                             `json:"average_effectiveness"`
	RecurredIncidents   int                                  `json:"recurred_incidents"`
	RecurrenceRate      float64                              `json:"recurrence_rate"`
	ByIncidentType      map[string]CategoryStats             `json:"by_incident_type"`
	ByStrategy          map[string]CategoryStats             `json:"by_strategy"`
	ByEnvironment       map[string]CategoryStats             `json:"by_environment"`
	ByActionType        map[string]CategoryStats             `json:"by_action_type"`
}

// CategoryStats holds stats for a single category dimension.
type CategoryStats struct {
	Total   int     `json:"total"`
	Success int     `json:"success"`
	Rate    float64 `json:"rate"`
}

// ==================== Request/Response Helpers ====================

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

// HistoryQuery holds filters for querying healing history.
type HistoryQuery struct {
	PaginatedRequest
	AppName     *string `form:"app_name"`
	Environment *string `form:"environment"`
	Type        *string `form:"type"`
	Status      *string `form:"status"`
	Severity    *string `form:"severity"`
	StartDate   *string `form:"start_date"`
	EndDate     *string `form:"end_date"`
}

// EffectivenessQuery holds filters for querying effectiveness stats.
type EffectivenessQuery struct {
	AppName     *string `form:"app_name"`
	Environment *string `form:"environment"`
	StartDate   *string `form:"start_date"`
	EndDate     *string `form:"end_date"`
}

// sql.NullString helper
func nullStr(s *string) sql.NullString {
	if s == nil {
		return sql.NullString{}
	}
	return sql.NullString{String: *s, Valid: true}
}
