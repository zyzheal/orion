package models

import "time"

// ConfigMgmt represents a config-mgmt-enhanced record.
type ConfigMgmt struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenantId"`
	Name      string    `db:"name" json:"name"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`
}

// CreateRequest is the request body for creating a config-mgmt-enhanced entry.
type CreateRequest struct {
	Name string `json:"name" binding:"required"`
}

// UpdateRequest is the request body for updating a config-mgmt-enhanced entry.
type UpdateRequest struct {
	Name *string `json:"name"`
}

// PaginatedResponse is a generic paginated response.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}

// ==================== Change Request ====================

type ChangeRequestType string
type ChangeRequestStatus string
type RiskLevel string

const (
	ChangeTypeCreate   ChangeRequestType = "create"
	ChangeTypeModify   ChangeRequestType = "modify"
	ChangeTypeDelete   ChangeRequestType = "delete"

	StatusPending    ChangeRequestStatus = "pending"
	StatusApproved   ChangeRequestStatus = "approved"
	StatusRejected   ChangeRequestStatus = "rejected"
	StatusExecuting  ChangeRequestStatus = "executing"
	StatusExecuted   ChangeRequestStatus = "executed"
	StatusFailed     ChangeRequestStatus = "failed"
	StatusRolledBack ChangeRequestStatus = "rolled_back"

	RiskLow      RiskLevel = "low"
	RiskMedium   RiskLevel = "medium"
	RiskHigh     RiskLevel = "high"
	RiskCritical RiskLevel = "critical"
)

// ChangeRequest represents a configuration change request in the approval workflow.
type ChangeRequest struct {
	ID                string              `db:"id" json:"id"`
	TenantID          string              `db:"tenant_id" json:"tenantId"`
	ConfigKey         string              `db:"config_key" json:"configKey"`
	ConfigGroup       string              `db:"config_group" json:"configGroup"`
	Environment       string              `db:"environment" json:"environment"`
	ChangeType        ChangeRequestType   `db:"change_type" json:"changeType"`
	OldValue          string              `db:"old_value" json:"oldValue"`
	NewValue          string              `db:"new_value" json:"newValue"`
	Reason            string              `db:"reason" json:"reason"`
	RiskLevel         RiskLevel           `db:"risk_level" json:"riskLevel"`
	Requester         string              `db:"requester" json:"requester"`
	Status            ChangeRequestStatus `db:"status" json:"status"`
	ExecutionPlan     string              `db:"execution_plan" json:"executionPlan"`
	RollbackPlan      string              `db:"rollback_plan" json:"rollbackPlan"`
	Approvals         string              `db:"approvals" json:"-"`
	RequiredApprovals int                 `db:"required_approvals" json:"requiredApprovals"`
	ExecutedAt        *time.Time          `db:"executed_at" json:"executedAt"`
	ExecutedBy        *string             `db:"executed_by" json:"executedBy"`
	ApprovedAt        *time.Time          `db:"approved_at" json:"approvedAt"`
	ApprovedBy        *string             `db:"approved_by" json:"approvedBy"`
	RolledBackAt      *time.Time          `db:"rolled_back_at" json:"rolledBackAt"`
	RolledBackBy      *string             `db:"rolled_back_by" json:"rolledBackBy"`
	CreatedAt         time.Time           `db:"created_at" json:"createdAt"`
	UpdatedAt         time.Time           `db:"updated_at" json:"updatedAt"`

	// Populated fields (not from DB directly)
	ApprovalsList []ApprovalRecord `json:"approvals"`
}

// ApprovalRecord represents an individual approval/rejection vote on a change request.
type ApprovalRecord struct {
	ID         string    `db:"id" json:"id"`
	Approver   string    `db:"approver" json:"approver"`
	Action     string    `db:"action" json:"action"`
	Comment    string    `db:"comment" json:"comment"`
	ApprovedAt time.Time `db:"approved_at" json:"approvedAt"`
}

// SubmitChangeRequestInput is the request body for submitting a new change request.
type SubmitChangeRequestInput struct {
	ConfigKey         string              `json:"configKey" binding:"required"`
	ConfigGroup       string              `json:"configGroup"`
	Environment       string              `json:"environment"`
	ChangeType        ChangeRequestType   `json:"changeType"`
	OldValue          string              `json:"oldValue"`
	NewValue          string              `json:"newValue"`
	Reason            string              `json:"reason" binding:"required"`
	RiskLevel         RiskLevel           `json:"riskLevel"`
	ExecutionPlan     string              `json:"executionPlan"`
	RollbackPlan      string              `json:"rollbackPlan"`
	RequiredApprovals int                 `json:"requiredApprovals"`
}

// ApproveChangeInput is the request body for approving or rejecting a change request.
type ApproveChangeInput struct {
	ReviewerId string `json:"reviewerId" binding:"required"`
	Action     string `json:"action" binding:"required"`
	Comment    string `json:"comment"`
}

// ChangeHistoryFilter is query params for filtering change history.
type ChangeHistoryFilter struct {
	Status      ChangeRequestStatus `form:"status"`
	ConfigKey   string              `form:"configKey"`
	ConfigGroup string              `form:"configGroup"`
	Environment string              `form:"environment"`
	Requester   string              `form:"requester"`
	RiskLevel   RiskLevel           `form:"riskLevel"`
	Limit       int                 `form:"limit"`
	Offset      int                 `form:"offset"`
}

// ==================== Change History ====================

// ChangeHistory represents an entry in the change request audit trail.
type ChangeHistory struct {
	ID              string    `db:"id" json:"id"`
	TenantID        string    `db:"tenant_id" json:"tenantId"`
	ChangeRequestID string    `db:"change_request_id" json:"changeRequestId"`
	ConfigKey       string    `db:"config_key" json:"configKey"`
	ConfigGroup     string    `db:"config_group" json:"configGroup"`
	Environment     string    `db:"environment" json:"environment"`
	Action          string    `db:"action" json:"action"`
	Actor           string    `db:"actor" json:"actor"`
	OldValue        string    `db:"old_value" json:"oldValue"`
	NewValue        string    `db:"new_value" json:"newValue"`
	Notes           string    `db:"notes" json:"notes"`
	CreatedAt       time.Time `db:"created_at" json:"createdAt"`
}

// ==================== Drift Detection ====================

type DriftStatus string

const (
	DriftInSync           DriftStatus = "in_sync"
	DriftDetected         DriftStatus = "drift_detected"
	DriftRemediating      DriftStatus = "remediating"
	DriftRemediated       DriftStatus = "remediated"
	DriftRemediationFailed DriftStatus = "remediation_failed"
)

type DriftSeverity string

const (
	DriftLow      DriftSeverity = "low"
	DriftMedium   DriftSeverity = "medium"
	DriftHigh     DriftSeverity = "high"
	DriftCritical DriftSeverity = "critical"
)

// DriftReport represents a configuration drift detection report.
type DriftReport struct {
	ID                     string            `db:"id" json:"id"`
	TenantID               string            `db:"tenant_id" json:"tenantId"`
	ConfigGroup            string            `db:"config_group" json:"configGroup"`
	DriftStatus            DriftStatus       `db:"drift_status" json:"driftStatus"`
	ExpectedConfig         string            `db:"expected_config" json:"-"`
	ActualConfig           string            `db:"actual_config" json:"-"`
	DriftItems             string            `db:"drift_items" json:"-"`
	TotalDrifts            int               `db:"total_drifts" json:"totalDrifts"`
	CriticalDrifts         int               `db:"critical_drifts" json:"criticalDrifts"`
	AutoRemediationEnabled bool              `db:"auto_remediation_enabled" json:"autoRemediationEnabled"`
	RemediationLog         string            `db:"remediation_log" json:"-"`
	DetectedAt             time.Time         `db:"detected_at" json:"detectedAt"`
	LastCheckedAt          time.Time         `db:"last_checked_at" json:"lastCheckedAt"`
	CreatedAt              time.Time         `db:"created_at" json:"createdAt"`

	// Populated fields (deserialized from JSON columns)
	DriftItemsList     []DriftItem          `json:"driftItems"`
	RemediationLogList []RemediationEntry   `json:"remediationLog"`
	ExpectedConfigData map[string]interface{} `json:"expectedConfig"`
	ActualConfigData   map[string]interface{} `json:"actualConfig"`
}

// DriftItem represents a single configuration drift entry.
type DriftItem struct {
	ConfigKey     string      `json:"configKey"`
	ConfigGroup   string      `json:"configGroup"`
	Path          string      `json:"path"`
	ExpectedValue interface{} `json:"expectedValue"`
	ActualValue   interface{} `json:"actualValue"`
	Severity      DriftSeverity `json:"severity"`
	Description   string      `json:"description"`
}

// RemediationEntry represents a single remediation action log entry.
type RemediationEntry struct {
	DriftID   string    `json:"driftId"`
	ConfigKey string    `json:"configKey"`
	Action    string    `json:"action"`
	Success   bool      `json:"success"`
	Error     string    `json:"error"`
	Timestamp time.Time `json:"timestamp"`
}

// DetectDriftInput is the request body for drift detection.
type DetectDriftInput struct {
	ConfigGroup string `json:"configGroup"`
}

// ==================== Business Endpoint Models ====================

// ApproveRequest is the request body for approving a change request.
type ApproveRequest struct {
	Comment string `json:"comment"`
}

// RollbackRequest is the request body for rolling back a change request.
type RollbackRequest struct {
	Reason string `json:"reason"`
}

// DriftDetectRequest is the request body for drift detection.
type DriftDetectRequest struct {
	Scope   string   `json:"scope"`
	Targets []string `json:"targets"`
}

// DriftDetectResult is the response from drift detection.
type DriftDetectResult struct {
	Status string      `json:"status"`
	Drifts []DriftEntry `json:"drifts"`
}

// DriftEntry represents a single detected drift.
type DriftEntry struct {
	Resource string `json:"resource"`
	Expected string `json:"expected"`
	Actual   string `json:"actual"`
}

// RemediateRequest is the request body for remediating a drift.
type RemediateRequest struct {
	Strategy string `json:"strategy"`
}

// ChangeHistoryEntry is a lightweight audit trail entry for change requests.
type ChangeHistoryEntry struct {
	Action      string `json:"action"`
	PerformedBy string `json:"performedBy"`
	At          int64  `json:"at"`
	Comment     string `json:"comment"`
}
