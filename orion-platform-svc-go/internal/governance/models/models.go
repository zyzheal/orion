package models

import "time"

// ---------------------------------------------------------------------------
// Constants / enums (mirrors PolicyType, PolicyStatus, SeverityLevel,
// ComplianceStatus from TS source)
// ---------------------------------------------------------------------------

// PolicyType identifies the kind of governance policy.
const (
	PolicyTypeRateLimit  = "rate_limit"
	PolicyTypeQuota      = "quota"
	PolicyTypeSecurity   = "security"
	PolicyTypeRetention  = "retention"
	PolicyTypeVersioning = "versioning"
	PolicyTypeAccessCtrl = "access_control"
	PolicyTypeDataProtect = "data_protection"
	PolicyTypeAudit      = "audit"
	PolicyTypeCompliance = "compliance"
	PolicyTypeCustom     = "custom"
)

// PolicyStatus is the lifecycle state of a policy.
const (
	PolicyStatusDraft      = "draft"
	PolicyStatusActive     = "active"
	PolicyStatusPaused     = "paused"
	PolicyStatusDeprecated = "deprecated"
	PolicyStatusArchived   = "archived"
)

// SeverityLevel indicates the impact of a policy violation.
const (
	SeverityLow      = "low"
	SeverityMedium   = "medium"
	SeverityHigh     = "high"
	SeverityCritical = "critical"
)

// ComplianceStatus is the result of a compliance evaluation.
const (
	ComplianceCompliant     = "compliant"
	ComplianceNonCompliant  = "non_compliant"
	CompliancePartial       = "partial"
	ComplianceUnknown       = "unknown"
)

// EnforcementMode controls how a policy is applied.
const (
	EnforcementStrict    = "strict"
	EnforcementSoft      = "soft"
	EnforcementAuditOnly = "audit_only"
)

// ---------------------------------------------------------------------------
// Domain models
// ---------------------------------------------------------------------------

// GovernancePolicy is a governance strategy applied to resources.
type GovernancePolicy struct {
	ID             string    `json:"id" db:"id"`
	TenantID       string    `json:"tenantId" db:"tenant_id"`
	Name           string    `json:"name" db:"name"`
	Description    string    `json:"description" db:"description"`
	Type           string    `json:"type" db:"type"`
	Status         string    `json:"status" db:"status"`
	Severity       string    `json:"severity" db:"severity"`
	Rules          string    `json:"rules" db:"rules"`       // JSONB
	Scope          string    `json:"scope" db:"scope"`       // JSONB
	Enforcement    string    `json:"enforcement" db:"enforcement"`
	CreatedBy      string    `json:"createdBy" db:"created_by"`
	AppliedCount   int       `json:"appliedCount" db:"applied_count"`
	ViolationCount int       `json:"violationCount" db:"violation_count"`
	Metadata       string    `json:"metadata" db:"metadata"` // JSONB
	CreatedAt      time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt      time.Time `json:"updatedAt" db:"updated_at"`
}

// GovernanceAuditLog records every policy operation for auditing.
type GovernanceAuditLog struct {
	ID           string    `json:"id" db:"id"`
	PolicyID     string    `json:"policyId" db:"policy_id"`
	Timestamp    time.Time `json:"timestamp" db:"timestamp"`
	Action       string    `json:"action" db:"action"`
	ResourceType string    `json:"resourceType" db:"resource_type"`
	ResourceID   string    `json:"resourceId" db:"resource_id"`
	UserID       string    `json:"userId" db:"user_id"`
	Details      string    `json:"details" db:"details"` // JSONB
	Outcome      string    `json:"outcome" db:"outcome"`
	Severity     string    `json:"severity" db:"severity"`
}

// ComplianceCheckResult is the outcome of a single compliance check (stored).
type ComplianceCheckResult struct {
	ID              string    `json:"id" db:"id"`
	Timestamp       time.Time `json:"timestamp" db:"timestamp"`
	ResourceID      string    `json:"resourceId" db:"resource_id"`
	ResourceType    string    `json:"resourceType" db:"resource_type"`
	Status          string    `json:"status" db:"status"`
	Violations      string    `json:"violations" db:"violations"` // JSONB
	Score           int       `json:"score" db:"score"`
	Recommendations string    `json:"recommendations" db:"recommendations"` // JSONB
}

// ---------------------------------------------------------------------------
// Request DTOs
// ---------------------------------------------------------------------------

// CreatePolicyRequest is the body for creating a governance policy.
type CreatePolicyRequest struct {
	Name        string           `json:"name" binding:"required"`
	Description string           `json:"description" binding:"required"`
	Type        string           `json:"type" binding:"required"`
	Severity    string           `json:"severity"`
	Rules       []PolicyRuleBody `json:"rules" binding:"required"`
	Scope       *PolicyScopeBody `json:"scope"`
	Enforcement string           `json:"enforcement"`
	Metadata    map[string]any   `json:"metadata"`
}

// PolicyRuleBody is a policy rule without id (used in create/update).
type PolicyRuleBody struct {
	Name        string           `json:"name" binding:"required"`
	Description string           `json:"description"`
	Condition   PolicyCondition  `json:"condition" binding:"required"`
	Action      PolicyActionBody `json:"action" binding:"required"`
	Priority    int              `json:"priority"`
	Enabled     bool             `json:"enabled"`
}

// PolicyCondition holds the matching logic for a rule.
type PolicyCondition struct {
	Field    string `json:"field" binding:"required"`
	Operator string `json:"operator" binding:"required"`
	Value    any    `json:"value"`
}

// PolicyActionBody holds the action taken when a condition matches.
type PolicyActionBody struct {
	Type   string         `json:"type" binding:"required"`
	Config map[string]any `json:"config"`
}

// PolicyListQuery holds optional filters for listing policies.
type PolicyListQuery struct {
	Type     string `json:"type"`
	Status   string `json:"status"`
	Severity string `json:"severity"`
}

// PolicyRule is a flattened rule returned from the rules API.
type PolicyRule struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Condition   string `json:"condition"`
	Action      string `json:"action"`
	Priority    int    `json:"priority"`
	Enabled     bool   `json:"enabled"`
}

// PolicyScopeBody defines include/exclude scope for a policy.
type PolicyScopeBody struct {
	Include []string `json:"include"`
	Exclude []string `json:"exclude"`
}

// UpdatePolicyRequest is the body for updating a governance policy.
type UpdatePolicyRequest struct {
	Name        *string          `json:"name"`
	Description *string          `json:"description"`
	Severity    *string          `json:"severity"`
	Rules       *[]PolicyRuleBody `json:"rules"`
	Scope       *PolicyScopeBody `json:"scope"`
	Enforcement *string          `json:"enforcement"`
	Metadata    map[string]any   `json:"metadata"`
}

// ComplianceCheckRequest is the body for checking compliance.
type ComplianceCheckRequest struct {
	ResourceID    string   `json:"resourceId" binding:"required"`
	ResourceType  string   `json:"resourceType" binding:"required"`
	PolicyIDs     []string `json:"policyIds"`
	DeepAnalysis  bool     `json:"deepAnalysis"`
}

// ApplyPolicyRequest is the body for applying a policy to a resource.
type ApplyPolicyRequest struct {
	ResourceID   string `json:"resourceId" binding:"required"`
	ResourceType string `json:"resourceType" binding:"required"`
}

// ---------------------------------------------------------------------------
// Response DTOs (flat, JSON-safe, no raw time.Time)
// ---------------------------------------------------------------------------

// PolicyResponse is the API response for a governance policy.
type PolicyResponse struct {
	ID             string           `json:"id"`
	Name           string           `json:"name"`
	Description    string           `json:"description"`
	Type           string           `json:"type"`
	Status         string           `json:"status"`
	Severity       string           `json:"severity"`
	Rules          []PolicyRuleResp `json:"rules"`
	Scope          PolicyScopeResp  `json:"scope"`
	Enforcement    string           `json:"enforcement"`
	CreatedBy      string           `json:"createdBy"`
	AppliedCount   int              `json:"appliedCount"`
	ViolationCount int              `json:"violationCount"`
	Metadata       map[string]any   `json:"metadata"`
	CreatedAt      string           `json:"createdAt"`
	UpdatedAt      string           `json:"updatedAt"`
}

// PolicyRuleResp is the API response for a rule.
type PolicyRuleResp struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Condition   PolicyCondition `json:"condition"`
	Action      PolicyActionResp `json:"action"`
	Priority    int             `json:"priority"`
	Enabled     bool            `json:"enabled"`
}

// PolicyActionResp is the API response for an action.
type PolicyActionResp struct {
	Type   string         `json:"type"`
	Config map[string]any `json:"config"`
}

// PolicyScopeResp is the API response for scope.
type PolicyScopeResp struct {
	Include []string `json:"include"`
	Exclude []string `json:"exclude"`
}

// AuditLogResponse is the API response for an audit log entry.
type AuditLogResponse struct {
	ID           string `json:"id"`
	PolicyID     string `json:"policyId"`
	Timestamp    string `json:"timestamp"`
	Action       string `json:"action"`
	ResourceType string `json:"resourceType"`
	ResourceID   string `json:"resourceId"`
	UserID       string `json:"userId"`
	Details      any    `json:"details"`
	Outcome      string `json:"outcome"`
	Severity     string `json:"severity"`
}

// ComplianceCheckResponse is the API response for a compliance check.
type ComplianceCheckResponse struct {
	ID              string                    `json:"id"`
	Timestamp       string                    `json:"timestamp"`
	ResourceID      string                    `json:"resourceId"`
	ResourceType    string                    `json:"resourceType"`
	Status          string                    `json:"status"`
	Violations      []ComplianceViolationResp `json:"violations"`
	Score           int                       `json:"score"`
	Recommendations []string                  `json:"recommendations"`
}

// ComplianceViolationResp is a single violation inside a check result.
type ComplianceViolationResp struct {
	PolicyID      string `json:"policyId"`
	PolicyName    string `json:"policyName"`
	RuleID        string `json:"ruleId"`
	RuleName      string `json:"ruleName"`
	Severity      string `json:"severity"`
	Description   string `json:"description"`
	Remediation   string `json:"remediation"`
}

// ComplianceReport is the API response for a compliance report.
type ComplianceReport struct {
	ID              string              `json:"id"`
	Timestamp       string              `json:"timestamp"`
	Period          CompliancePeriod    `json:"period"`
	OverallScore    int                 `json:"overallScore"`
	OverallStatus   string              `json:"overallStatus"`
	Summary         ComplianceSummary   `json:"summary"`
	ByPolicyType    []PolicyTypeBreakdown `json:"byPolicyType"`
	TopViolations   []TopViolation       `json:"topViolations"`
	Recommendations []string             `json:"recommendations"`
}

// CompliancePeriod defines a date range.
type CompliancePeriod struct {
	Start string `json:"start"`
	End   string `json:"end"`
}

// ComplianceSummary aggregates overall compliance stats.
type ComplianceSummary struct {
	TotalPolicies      int `json:"totalPolicies"`
	ActivePolicies     int `json:"activePolicies"`
	TotalResources     int `json:"totalResources"`
	CompliantResources int `json:"compliantResources"`
	ViolationsCount    int `json:"violationsCount"`
}

// PolicyTypeBreakdown is per-type compliance stats.
type PolicyTypeBreakdown struct {
	Type           string `json:"type"`
	CompliantCount int    `json:"compliantCount"`
	ViolationCount int    `json:"violationCount"`
	Score          int    `json:"score"`
}

// TopViolation is an aggregated violation entry in a report.
type TopViolation struct {
	PolicyName string `json:"policyName"`
	Count      int    `json:"count"`
	Severity   string `json:"severity"`
}

// PolicyApplyResult is the API response from applying a policy.
type PolicyApplyResult struct {
	PolicyID     string           `json:"policyId"`
	ResourceID   string           `json:"resourceId"`
	ResourceType string           `json:"resourceType"`
	Applied      bool             `json:"applied"`
	Violations   []PolicyRuleResp `json:"violations"`
	Timestamp    string           `json:"timestamp"`
}
