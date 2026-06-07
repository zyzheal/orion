package models

import (
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

type JSONArray []interface{}

func (j JSONArray) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONArray) Scan(src interface{}) error {
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
		return fmt.Errorf("cannot scan %T into JSONArray", src)
	}
}

// ==================== Policy Definition ====================

type Policy struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	Description *string   `db:"description" json:"description,omitempty"`
	Category    string    `db:"category" json:"category"`
	RegoPath    string    `db:"rego_path" json:"rego_path"`
	GateID      *string   `db:"gate_id" json:"gate_id,omitempty"`
	Severity    string    `db:"severity" json:"severity"`
	Enabled     bool      `db:"enabled" json:"enabled"`
	Metadata    JSONB     `db:"metadata" json:"metadata"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type CreatePolicyRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Category    string `json:"category" binding:"required,oneof=security cost quality governance"`
	RegoPath    string `json:"rego_path" binding:"required"`
	GateID      string `json:"gate_id"`
	Severity    string `json:"severity" binding:"omitempty,oneof=block warning info"`
	Metadata    JSONB  `json:"metadata"`
}

type UpdatePolicyRequest struct {
	Description *string `json:"description"`
	Category    *string `json:"category" binding:"omitempty,oneof=security cost quality governance"`
	RegoPath    *string `json:"rego_path"`
	GateID      *string `json:"gate_id"`
	Severity    *string `json:"severity" binding:"omitempty,oneof=block warning info"`
	Enabled     *bool   `json:"enabled"`
	Metadata    JSONB   `json:"metadata"`
}

// ==================== Policy Bundle ====================

type PolicyBundle struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	Name      string    `db:"name" json:"name"`
	Version   string    `db:"version" json:"version"`
	Policies  JSONArray `db:"policies" json:"policies"`
	Active    bool      `db:"active" json:"active"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// ==================== Policy Evaluation ====================

type PolicyEvaluation struct {
	ID            string    `db:"id" json:"id"`
	PolicyID      *string   `db:"policy_id" json:"policy_id,omitempty"`
	RunID         string    `db:"run_id" json:"run_id"`
	InputContext  JSONB     `db:"input_context" json:"input_context"`
	Result        JSONB     `db:"result" json:"result"`
	EvaluatedAt   time.Time `db:"evaluated_at" json:"evaluated_at"`
	EvaluationMs  *int      `db:"evaluation_ms" json:"evaluation_ms,omitempty"`
}

type EvaluatePolicyRequest struct {
	PolicyID     *string                `json:"policy_id"`
	RunID        string                 `json:"run_id" binding:"required"`
	ResourceType string                 `json:"resource_type"`
	ResourceID   string                 `json:"resource_id"`
	Action       string                 `json:"action"`
	Context      map[string]interface{} `json:"context"`
}

type EvaluationResult struct {
	ID           string                 `json:"id"`
	Allowed      bool                   `json:"allowed"`
	PolicyID     *string                `json:"policy_id,omitempty"`
	RunID        string                 `json:"run_id"`
	Result       map[string]interface{} `json:"result"`
	EvaluatedAt  time.Time              `json:"evaluated_at"`
	EvaluationMs *int                   `json:"evaluation_ms,omitempty"`
}

// ==================== Policy Violation ====================

type PolicyViolation struct {
	ID           string    `db:"id" json:"id"`
	EvaluationID *string   `db:"evaluation_id" json:"evaluation_id,omitempty"`
	PolicyID     *string   `db:"policy_id" json:"policy_id,omitempty"`
	Severity     string    `db:"severity" json:"severity"`
	Message      string    `db:"message" json:"message"`
	ResourceType *string   `db:"resource_type" json:"resource_type,omitempty"`
	ResourceID   *string   `db:"resource_id" json:"resource_id,omitempty"`
	Status       string    `db:"status" json:"status"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

type RecordViolationRequest struct {
	EvaluationID string `json:"evaluation_id"`
	PolicyID     string `json:"policy_id"`
	Severity     string `json:"severity" binding:"required,oneof=critical high medium low info"`
	Message      string `json:"message" binding:"required"`
	ResourceType string `json:"resource_type"`
	ResourceID   string `json:"resource_id"`
}

type UpdateViolationRequest struct {
	Status string `json:"status" binding:"omitempty,oneof=open acknowledged resolved waived"`
}

type ViolationStats struct {
	Total        int                `json:"total"`
	BySeverity   map[string]int     `json:"by_severity"`
	ByStatus     map[string]int     `json:"by_status"`
	ByPolicy     map[string]int     `json:"by_policy"`
	RecentTrend  []TrendPoint       `json:"recent_trend"`
}

type TrendPoint struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

// ==================== Policy Override ====================

type PolicyOverride struct {
	ID          string     `db:"id" json:"id"`
	TenantID    string     `db:"tenant_id" json:"tenant_id"`
	PolicyID    string     `db:"policy_id" json:"policy_id"`
	PipelineID  *string    `db:"pipeline_id" json:"pipeline_id,omitempty"`
	RunID       *string    `db:"run_id" json:"run_id,omitempty"`
	ViolationID *string    `db:"violation_id" json:"violation_id,omitempty"`
	Reason      string     `db:"reason" json:"reason"`
	ApprovedBy  string     `db:"approved_by" json:"approved_by"`
	ApprovedAt  time.Time  `db:"approved_at" json:"approved_at"`
	Status      string     `db:"status" json:"status"`
	ExpiresAt   *time.Time `db:"expires_at" json:"expires_at,omitempty"`
	RevokedAt   *time.Time `db:"revoked_at" json:"revoked_at,omitempty"`
	RevokedBy   *string    `db:"revoked_by" json:"revoked_by,omitempty"`
	Scope       *string    `db:"scope" json:"scope,omitempty"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time  `db:"updated_at" json:"updated_at"`
}

type CreateOverrideRequest struct {
	PolicyID    string     `json:"policy_id" binding:"required"`
	PipelineID  string     `json:"pipeline_id"`
	RunID       string     `json:"run_id"`
	ViolationID string     `json:"violation_id"`
	Reason      string     `json:"reason" binding:"required"`
	ApprovedBy  string     `json:"approved_by" binding:"required"`
	ExpiresAt   *time.Time `json:"expires_at"`
	Scope       string     `json:"scope"`
}

type UpdateOverrideRequest struct {
	Reason    *string    `json:"reason"`
	ExpiresAt *time.Time `json:"expires_at"`
	Status    *string    `json:"status" binding:"omitempty,oneof=active revoked expired"`
}

// ==================== Exemption ====================

type Exemption struct {
	ID            string         `db:"id" json:"id"`
	ViolationID   string         `db:"violation_id" json:"violation_id"`
	PolicyID      string         `db:"policy_id" json:"policy_id"`
	RunID         string         `db:"run_id" json:"run_id"`
	Reason        string         `db:"reason" json:"reason"`
	Category      string         `db:"category" json:"category"`
	RequestedBy   string         `db:"requested_by" json:"requested_by"`
	Status        string         `db:"status" json:"status"`
	ExpiresAt     time.Time      `db:"expires_at" json:"expires_at"`
	ApprovalChain JSONArray      `db:"approval_chain" json:"approval_chain"`
	CreatedAt     time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time      `db:"updated_at" json:"updated_at"`
}

type CreateExemptionRequest struct {
	ViolationID string     `json:"violation_id" binding:"required"`
	PolicyID    string     `json:"policy_id" binding:"required"`
	RunID       string     `json:"run_id" binding:"required"`
	Reason      string     `json:"reason" binding:"required"`
	Category    string     `json:"category" binding:"required,oneof=business-urgency tech-debt false-positive temporary"`
	RequestedBy string     `json:"requested_by" binding:"required"`
	ExpiresAt   *time.Time `json:"expires_at"`
}

type ReviewExemptionRequest struct {
	Action   string `json:"action" binding:"required,oneof=approve reject"`
	Comment  string `json:"comment"`
	Reviewer string `json:"reviewer" binding:"required"`
}

type ApprovalChainEntry struct {
	Approver   string    `json:"approver"`
	Action     string    `json:"action"`
	Comment    string    `json:"comment,omitempty"`
	ReviewedAt time.Time `json:"reviewed_at"`
}

// ==================== API Contract ====================

type APIContract struct {
	ID             string    `db:"id" json:"id"`
	TenantID       string    `db:"tenant_id" json:"tenant_id"`
	ServiceName    string    `db:"service_name" json:"service_name"`
	Name           string    `db:"name" json:"name"`
	Description    *string   `db:"description" json:"description,omitempty"`
	Endpoint       string    `db:"endpoint" json:"endpoint"`
	Method         string    `db:"method" json:"method"`
	Version        string    `db:"version" json:"version"`
	Spec           JSONB     `db:"spec" json:"spec"`
	Schema         JSONB     `db:"schema" json:"schema"`
	Status         string    `db:"status" json:"status"`
	LastVerifiedAt *time.Time `db:"last_verified_at" json:"last_verified_at,omitempty"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time `db:"updated_at" json:"updated_at"`
}

type CreateContractRequest struct {
	ServiceName string `json:"service_name"`
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Endpoint    string `json:"endpoint" binding:"required"`
	Method      string `json:"method" binding:"required"`
	Version     string `json:"version"`
	Spec        JSONB  `json:"spec"`
	Schema      JSONB  `json:"schema" binding:"required"`
}

type UpdateContractRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Endpoint    *string `json:"endpoint"`
	Method      *string `json:"method"`
	Version     *string `json:"version"`
	Spec        JSONB   `json:"spec"`
	Schema      JSONB   `json:"schema"`
	Status      *string `json:"status"`
}

type ContractViolation struct {
	ID            string                 `json:"id"`
	ContractID    string                 `json:"contract_id"`
	ViolationType string                 `json:"violation_type"`
	Description   string                 `json:"description"`
	Severity      string                 `json:"severity"`
	DetectedAt    time.Time              `json:"detected_at"`
	SampleData    map[string]interface{} `json:"sample_data,omitempty"`
}

type ContractEvaluationResult struct {
	Compliant  bool               `json:"compliant"`
	Violations []ContractViolation `json:"violations"`
	Score      int                `json:"score"`
	EvaluatedAt time.Time         `json:"evaluated_at"`
}

type ContractVerificationResult struct {
	ContractID  string   `json:"contract_id"`
	Scope       string   `json:"scope"`
	Passed      bool     `json:"passed"`
	Total       int      `json:"total"`
	PassedCount int      `json:"passed_count"`
	FailedCount int      `json:"failed_count"`
	Warnings    []string `json:"warnings"`
	VerifiedAt  time.Time `json:"verified_at"`
}

type BreakingChange struct {
	Endpoint    string `json:"endpoint"`
	Type        string `json:"type"`
	Description string `json:"description"`
	Severity    string `json:"severity"`
}

type CompatibilityCheckResult struct {
	Compatible         bool     `json:"compatible"`
	BreakingChanges    []BreakingChange `json:"breaking_changes"`
	NonBreakingChanges []string `json:"non_breaking_changes"`
}

type ImpactAnalysisResult struct {
	RiskLevel          string              `json:"risk_level"`
	ImpactedServices   []ImpactedService   `json:"impacted_services"`
	ImpactedClients    []ImpactedClient    `json:"impacted_clients"`
	MigrationSuggestions []MigrationSuggestion `json:"migration_suggestions"`
}

type ImpactedService struct {
	Name      string   `json:"name"`
	Endpoints []string `json:"endpoints"`
}

type ImpactedClient struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

type MigrationSuggestion struct {
	From string `json:"from"`
	To   string `json:"to"`
	Note string `json:"note"`
}

// ==================== API Version ====================

type APIVersion struct {
	ID               string     `db:"id" json:"id"`
	TenantID         string     `db:"tenant_id" json:"tenant_id"`
	ContractID       string     `db:"contract_id" json:"contract_id"`
	APIID            string     `db:"api_id" json:"api_id"`
	VersionTag       string     `db:"version_tag" json:"version_tag"`
	Version          string     `db:"version" json:"version"`
	Definition       JSONB      `db:"definition" json:"definition"`
	Status           string     `db:"status" json:"status"`
	DeprecationDate  *time.Time `db:"deprecation_date" json:"deprecation_date,omitempty"`
	RetirementDate   *time.Time `db:"retirement_date" json:"retirement_date,omitempty"`
	ReplacementVersion *string  `db:"replacement_version" json:"replacement_version,omitempty"`
	Changelog        *string    `db:"changelog" json:"changelog,omitempty"`
	CreatedAt        time.Time  `db:"created_at" json:"created_at"`
}

type CreateVersionRequest struct {
	ContractID string `json:"contract_id" binding:"required"`
	APIID      string `json:"api_id"`
	VersionTag string `json:"version_tag" binding:"required"`
	Definition JSONB  `json:"definition"`
}

type UpdateVersionStatusRequest struct {
	Status             string     `json:"status" binding:"required,oneof=draft active deprecated retired"`
	ReplacementVersion string     `json:"replacement_version"`
	Changelog          string     `json:"changelog"`
}

// ==================== Governance Rule ====================

type GovernanceRule struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	Description *string   `db:"description" json:"description,omitempty"`
	RuleType    string    `db:"rule_type" json:"rule_type"`
	Config      JSONB     `db:"config" json:"config"`
	Enabled     bool      `db:"enabled" json:"enabled"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type CreateGovernanceRuleRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	RuleType    string `json:"rule_type" binding:"required,oneof=rate_limit auth_required versioning documentation naming response_format"`
	Config      JSONB  `json:"config" binding:"required"`
}

type UpdateGovernanceRuleRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	RuleType    *string `json:"rule_type" binding:"omitempty,oneof=rate_limit auth_required versioning documentation naming response_format"`
	Config      JSONB   `json:"config"`
	Enabled     *bool   `json:"enabled"`
}

type GovernanceEvaluationResult struct {
	RuleID   string                 `json:"rule_id"`
	RuleName string                 `json:"rule_name"`
	RuleType string                 `json:"rule_type"`
	Passed   bool                   `json:"passed"`
	Message  string                 `json:"message"`
	Details  map[string]interface{} `json:"details,omitempty"`
}

type GovernanceReport struct {
	TenantID        string                      `json:"tenant_id"`
	EvaluatedAt     time.Time                   `json:"evaluated_at"`
	TotalRules      int                         `json:"total_rules"`
	PassedRules     int                         `json:"passed_rules"`
	FailedRules     int                         `json:"failed_rules"`
	ComplianceScore int                         `json:"compliance_score"`
	Results         []GovernanceEvaluationResult `json:"results"`
}

// ==================== API Inventory ====================

type APIInventoryEntry struct {
	ID       string `db:"id" json:"id"`
	TenantID string `db:"tenant_id" json:"tenant_id"`
	APIPath  string `db:"api_path" json:"api_path"`
	APIData  JSONB  `db:"api_data" json:"api_data"`
}

// ==================== Quality Gate Trend ====================

type PassRateTrendPoint struct {
	Date              string  `json:"date"`
	TotalEvaluations  int     `json:"total_evaluations"`
	PassedEvaluations int     `json:"passed_evaluations"`
	PassRate          float64 `json:"pass_rate"`
}

type ViolationDistributionItem struct {
	Key        string  `json:"key"`
	Count      int     `json:"count"`
	Percentage float64 `json:"percentage"`
}

type TopFailingPolicy struct {
	PolicyID        string  `json:"policy_id"`
	PolicyName      string  `json:"policy_name"`
	FailureCount    int     `json:"failure_count"`
	FailureRate     float64 `json:"failure_rate"`
	TotalEvaluations int   `json:"total_evaluations"`
}

type ExemptionStats struct {
	Active  int `json:"active"`
	Expired int `json:"expired"`
	Pending int `json:"pending"`
	Revoked int `json:"revoked"`
	Total   int `json:"total"`
}

type Recommendation struct {
	ID              string `json:"id"`
	PolicyID        string `json:"policy_id,omitempty"`
	Category        string `json:"category"`
	Priority        string `json:"priority"`
	Message         string `json:"message"`
	SuggestedAction string `json:"suggested_action"`
}

// ==================== Common ====================

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

type ComplianceStatus struct {
	TotalEvaluations int                `json:"total_evaluations"`
	AllowedCount     int                `json:"allowed_count"`
	DeniedCount      int                `json:"denied_count"`
	ComplianceRate   float64            `json:"compliance_rate"`
	ByPolicy         []PolicyCompliance `json:"by_policy"`
	Period           string             `json:"period"`
}

type PolicyCompliance struct {
	PolicyID       string  `json:"policy_id"`
	Allowed        int     `json:"allowed"`
	Denied         int     `json:"denied"`
	ComplianceRate float64 `json:"compliance_rate"`
}

type EnforcementSummary struct {
	ActiveViolations   int                    `json:"active_violations"`
	ResolvedViolations int                    `json:"resolved_violations"`
	Policies           []PolicyViolationCount `json:"policies"`
}

type PolicyViolationCount struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	ViolationCount int    `json:"violation_count"`
}
