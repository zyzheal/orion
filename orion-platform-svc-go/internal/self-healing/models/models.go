package models

import "time"

// IncidentType defines the type of self-healing incident.
type IncidentType string

const (
	IncidentTypeHighCPU       IncidentType = "high_cpu"
	IncidentTypeHighMemory    IncidentType = "high_memory"
	IncidentTypeHighErrorRate IncidentType = "high_error_rate"
	IncidentTypeHighLatency   IncidentType = "high_latency"
	IncidentTypePodCrash      IncidentType = "pod_crash"
	IncidentTypeNodeFailure   IncidentType = "node_failure"
	IncidentTypeServiceDown   IncidentType = "service_down"
	IncidentTypeDeployFailure IncidentType = "deployment_failure"
	IncidentTypeDiskFull      IncidentType = "disk_full"
	IncidentTypeNetworkTimeout IncidentType = "network_timeout"
	IncidentTypeCustom        IncidentType = "custom"
)

// IncidentSeverity defines the severity level of an incident.
type IncidentSeverity string

const (
	IncidentSeverityCritical IncidentSeverity = "critical"
	IncidentSeverityWarning  IncidentSeverity = "warning"
	IncidentSeverityInfo     IncidentSeverity = "info"
)

// IncidentStatus defines the lifecycle status of an incident.
type IncidentStatus string

const (
	IncidentStatusNew           IncidentStatus = "new"
	IncidentStatusEvaluating    IncidentStatus = "evaluating"
	IncidentStatusHealing       IncidentStatus = "healing"
	IncidentStatusHealed        IncidentStatus = "healed"
	IncidentStatusFailed        IncidentStatus = "failed"
	IncidentStatusEscalated     IncidentStatus = "escalated"
	IncidentStatusPendingApproval IncidentStatus = "pending_approval"
	IncidentStatusCancelled     IncidentStatus = "cancelled"
)

// RiskLevel defines the risk level of an approval request.
type RiskLevel string

const (
	RiskLevelLow     RiskLevel = "low"
	RiskLevelMedium  RiskLevel = "medium"
	RiskLevelHigh    RiskLevel = "high"
	RiskLevelCritical RiskLevel = "critical"
)

// HealingActionType defines the type of healing action.
type HealingActionType string

const (
	HealingActionTypeRestart  HealingActionType = "restart"
	HealingActionTypeScale    HealingActionType = "scale"
	HealingActionTypeFailover HealingActionType = "failover"
	HealingActionTypeRollback HealingActionType = "rollback"
)

// HealingStrategy is a configured healing strategy.
type HealingStrategy struct {
	ID              string        `json:"id" db:"id"`
	Name            string        `json:"name" db:"name"`
	TriggerType     string        `json:"triggerType" db:"trigger_type"`
	Actions         string        `json:"actions" db:"actions"`       // JSONB
	Conditions      string        `json:"conditions" db:"conditions"` // JSONB
	Confidence      int64         `json:"confidence" db:"confidence"`
	Enabled         bool          `json:"enabled" db:"enabled"`
	Description     string        `json:"description" db:"description"`
	Environments    string        `json:"environments" db:"environments"` // JSONB
	MaxRetries      int64         `json:"maxRetries" db:"max_retries"`
	RetryCooldownMs int64         `json:"retryCooldownMs" db:"retry_cooldown_ms"`
	CreatedAt       time.Time     `json:"createdAt" db:"created_at"`
	UpdatedAt       time.Time     `json:"updatedAt" db:"updated_at"`
}

// HealingAction is a single action within a strategy.
type HealingAction struct {
	Type        HealingActionType `json:"type"`
	Params      map[string]any    `json:"params"`
	Timeout     *int64            `json:"timeout,omitempty"`
	Rollback    *bool             `json:"rollback,omitempty"`
	Description string            `json:"description,omitempty"`
}

// HealingIncident is a healing incident record.
type HealingIncident struct {
	ID                string         `json:"id" db:"id"`
	TenantID          string         `json:"tenantId" db:"tenant_id"`
	AlertID           string         `json:"alertId" db:"alert_id"`
	Type              IncidentType   `json:"type" db:"type"`
	Severity          IncidentSeverity `json:"severity" db:"severity"`
	AppName           string         `json:"appName" db:"app_name"`
	Environment       string         `json:"environment" db:"environment"`
	StrategyID        string         `json:"strategyId" db:"strategy_id"`
	StrategyName      string         `json:"strategyName" db:"strategy_name"`
	Actions           string         `json:"actions" db:"actions"`       // JSONB
	Status            IncidentStatus `json:"status" db:"status"`
	Attempts          int64          `json:"attempts" db:"attempts"`
	ApprovalStatus    string         `json:"approvalStatus" db:"approval_status"`
	ApprovalRequestID string         `json:"approvalRequestId" db:"approval_request_id"`
	Result            string         `json:"result" db:"result"`         // JSONB
	Error             string         `json:"error" db:"error"`
	Tags              string         `json:"tags" db:"tags"`             // JSONB
	CreatedAt         time.Time      `json:"createdAt" db:"created_at"`
	StartedAt         time.Time      `json:"startedAt" db:"started_at"`
	CompletedAt       *time.Time     `json:"completedAt" db:"completed_at"`
}

// ApprovalRequest is an approval request record.
type ApprovalRequest struct {
	ID                 string     `json:"id" db:"id"`
	IncidentID         string     `json:"incidentId" db:"incident_id"`
	Title              string     `json:"title" db:"title"`
	Description        string     `json:"description" db:"description"`
	RiskLevel          RiskLevel  `json:"riskLevel" db:"risk_level"`
	RecommendedActions string     `json:"recommendedActions" db:"recommended_actions"` // JSONB
	Status             string     `json:"status" db:"status"`
	RequestedBy        string     `json:"requestedBy" db:"requested_by"`
	ApprovedBy         string     `json:"approvedBy" db:"approved_by"`
	ApprovalReason     string     `json:"approvalReason" db:"approval_reason"`
	RequestedAt        time.Time  `json:"requestedAt" db:"requested_at"`
	RespondedAt        *time.Time `json:"respondedAt" db:"responded_at"`
	ExpiresAt          *time.Time `json:"expiresAt" db:"expires_at"`
}

// CreateIncidentRequest is the body for manually creating an incident.
type CreateIncidentRequest struct {
	Type        IncidentType      `json:"type" binding:"required"`
	Severity    IncidentSeverity  `json:"severity" binding:"required"`
	AppName     string            `json:"appName" binding:"required"`
	Environment string            `json:"environment" binding:"required"`
	AlertID     string            `json:"alertId"`
	Tags        map[string]string `json:"tags"`
}

// RegisterStrategyRequest is the body for registering a custom strategy.
type RegisterStrategyRequest struct {
	ID            string           `json:"id" binding:"required"`
	Name          string           `json:"name" binding:"required"`
	TriggerType   string           `json:"triggerType" binding:"required"`
	Actions       []HealingAction  `json:"actions" binding:"required"`
	Confidence    int64            `json:"confidence"`
	Enabled       bool             `json:"enabled"`
	Description   string           `json:"description"`
	Conditions    string           `json:"conditions"`
	Environments  string           `json:"environments"`
	MaxRetries    int64            `json:"maxRetries"`
}

// ToggleStrategyRequest is the body for toggling a strategy.
type ToggleStrategyRequest struct {
	Enabled bool `json:"enabled" binding:"required"`
}

// RespondApprovalRequest is the body for responding to an approval.
type RespondApprovalRequest struct {
	Approved    bool   `json:"approved" binding:"required"`
	RespondedBy string `json:"respondedBy" binding:"required"`
	Reason      string `json:"reason"`
}

// HistoryQuery is the query parameters for listing history.
type HistoryQuery struct {
	AppName     string `json:"appName"`
	Environment string `json:"environment"`
	Type        string `json:"type"`
	Status      string `json:"status"`
	Severity    string `json:"severity"`
	Page        int    `json:"page"`
	Limit       int    `json:"limit"`
}

// EffectivenessQuery is the query parameters for effectiveness.
type EffectivenessQuery struct {
	AppName     string `json:"appName"`
	Environment string `json:"environment"`
}

// HealingEffectiveness holds effectiveness metrics.
type HealingEffectiveness struct {
	TotalIncidents       int             `json:"totalIncidents"`
	HealedIncidents      int             `json:"healedIncidents"`
	FailedIncidents      int             `json:"failedIncidents"`
	EscalatedIncidents   int             `json:"escalatedIncidents"`
	SuccessRate          float64         `json:"successRate"`
	AverageDurationMs    float64         `json:"averageDurationMs"`
	MedianDurationMs     float64         `json:"medianDurationMs"`
	AverageEffectiveness float64         `json:"averageEffectiveness"`
	RecurredIncidents    int             `json:"recurredIncidents"`
	RecurrenceRate       float64         `json:"recurrenceRate"`
	ByIncidentType       map[string]Stat `json:"byIncidentType"`
	ByStrategy           map[string]Stat `json:"byStrategy"`
	ByEnvironment        map[string]Stat `json:"byEnvironment"`
	ByActionType         map[string]Stat `json:"byActionType"`
}

// Stat is a breakdown statistic.
type Stat struct {
	Total   int     `json:"total"`
	Success int     `json:"success"`
	Rate    float64 `json:"rate"`
}
