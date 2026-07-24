package models

import "time"

// --- Policy definitions ---

type Policy struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	Rego        string    `json:"rego" db:"rego"`
	Enabled     bool      `json:"enabled" db:"enabled"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type CreatePolicyRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Rego        string `json:"rego"`
	Enabled     bool   `json:"enabled"`
}

type UpdatePolicyRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Rego        *string `json:"rego"`
	Enabled     *bool   `json:"enabled"`
}

// --- Policy evaluations ---

type PolicyEvaluation struct {
	ID            string    `json:"id" db:"id"`
	TenantID      string    `json:"tenant_id" db:"tenant_id"`
	PolicyID      string    `json:"policy_id" db:"policy_id"`
	RunID         string    `json:"run_id" db:"run_id"`
	ResourceID    string    `json:"resource_id" db:"resource_id"`
	InputJSON     string    `json:"input_json" db:"input_json"`
	OutputJSON    string    `json:"output_json" db:"output_json"`
	Decision      string    `json:"decision" db:"decision"` // allow, deny, unknown
	ExecutedBy    string    `json:"executed_by" db:"executed_by"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

type EvaluatePolicyRequest struct {
	PolicyID   string                 `json:"policy_id" binding:"required"`
	ResourceID string                 `json:"resource_id"`
	Input      map[string]interface{} `json:"input" binding:"required"`
}

type EvaluatePolicyResponse struct {
	Decision string                 `json:"decision"`
	Rego     string                 `json:"rego"`
	Result   map[string]interface{} `json:"result"`
	Error    string                 `json:"error,omitempty"`
}

type EvaluateGateRequest struct {
	GateID   string                 `json:"gate_id" binding:"required"`
	Input    map[string]interface{} `json:"input" binding:"required"`
}

// --- Violations ---

type Violation struct {
	ID         string    `json:"id" db:"id"`
	TenantID   string    `json:"tenant_id" db:"tenant_id"`
	PolicyID   string    `json:"policy_id" db:"policy_id"`
	EvaluationID string   `json:"evaluation_id" db:"evaluation_id"`
	RunID      string    `json:"run_id" db:"run_id"`
	Severity   string    `json:"severity" db:"severity"` // critical, warning, info
	Message    string    `json:"message" db:"message"`
	Status     string    `json:"status" db:"status"` // open, waived, resolved, dismissed
	Details    string    `json:"details" db:"details"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}

type WaiveViolationRequest struct {
	Reason  string `json:"reason" binding:"required"`
	ReviewedBy string `json:"reviewed_by"`
}

type ResolveViolationRequest struct {
	Reason string `json:"reason" binding:"required"`
}

// --- Overrides ---

type PolicyOverride struct {
	ID         string    `json:"id" db:"id"`
	TenantID   string    `json:"tenant_id" db:"tenant_id"`
	PolicyID   string    `json:"policy_id" db:"policy_id"`
	ResourceID string    `json:"resource_id" db:"resource_id"`
	OverrideBy string    `json:"override_by" db:"override_by"`
	Reason     string    `json:"reason" db:"reason"`
	ExpiresAt  time.Time `json:"expires_at" db:"expires_at"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

type CreateOverrideRequest struct {
	PolicyID   string `json:"policy_id" binding:"required"`
	ResourceID string `json:"resource_id" binding:"required"`
	Reason     string `json:"reason" binding:"required"`
	ExpiresIn  string `json:"expires_in"` // duration string like "24h", "7d"
}

// --- Bundles ---

type PolicyBundle struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	SourceURL string    `json:"source_url" db:"source_url"`
	Version   string    `json:"version" db:"version"`
	Status    string    `json:"status" db:"status"` // synced, pending, failed
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type SyncBundlesRequest struct {
	SourceURL string `json:"source_url"`
}

type SyncBundlesResponse struct {
	Updated int `json:"updated"`
	Message string `json:"message"`
}

// --- Policy testing ---

type TestPolicyRequest struct {
	Rego       string                 `json:"rego" binding:"required"`
	TestCases  []map[string]interface{} `json:"test_cases" binding:"required"`
}

type TestCaseResult struct {
	Name      string                 `json:"name"`
	Passed    bool                   `json:"passed"`
	Output    map[string]interface{} `json:"output,omitempty"`
	Error     string                 `json:"error,omitempty"`
}

// --- Exemptions ---

type ExemptionCategory string

const (
	ExemptionCategoryTechnical  ExemptionCategory = "technical"
	ExemptionCategoryBusiness   ExemptionCategory = "business"
	ExemptionCategoryException  ExemptionCategory = "exception"
)

type ExemptionStatus string

const (
	ExemptionStatusPending   ExemptionStatus = "pending"
	ExemptionStatusApproved  ExemptionStatus = "approved"
	ExemptionStatusRejected  ExemptionStatus = "rejected"
	ExemptionStatusExpired   ExemptionStatus = "expired"
	ExemptionStatusRevoked   ExemptionStatus = "revoked"
)

type ExemptionAction string

const (
	ExemptionActionApprove ExemptionAction = "approve"
	ExemptionActionReject  ExemptionAction = "reject"
)

type Exemption struct {
	ID           string            `json:"id" db:"id"`
	TenantID     string            `json:"tenant_id" db:"tenant_id"`
	ViolationID  string            `json:"violation_id" db:"violation_id"`
	PolicyID     string            `json:"policy_id" db:"policy_id"`
	RunID        string            `json:"run_id" db:"run_id"`
	Reason       string            `json:"reason" db:"reason"`
	Category     ExemptionCategory `json:"category" db:"category"`
	Status       ExemptionStatus   `json:"status" db:"status"`
	RequestedBy  string            `json:"requested_by" db:"requested_by"`
	ReviewedBy   string            `json:"reviewed_by" db:"reviewed_by"`
	ReviewNote   string            `json:"review_note" db:"review_note"`
	ExpiresAt    *time.Time        `json:"expires_at" db:"expires_at"`
	CreatedAt    time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at" db:"updated_at"`
}

type CreateExemptionRequest struct {
	ViolationID string            `json:"violation_id" binding:"required"`
	PolicyID    string            `json:"policy_id"`
	RunID       string            `json:"run_id"`
	Reason      string            `json:"reason" binding:"required"`
	Category    ExemptionCategory `json:"category" binding:"required"`
	RequestedBy string            `json:"requested_by" binding:"required"`
	ExpiresAt   *time.Time        `json:"expires_at"`
}

type ReviewExemptionRequest struct {
	Action    ExemptionAction `json:"action" binding:"required"`
	Comment   string          `json:"comment"`
	Reviewer  string          `json:"reviewer" binding:"required"`
}

type ListExemptionsRequest struct {
	Status    ExemptionStatus `json:"status"`
	PolicyID  string          `json:"policy_id"`
	RequestedBy string        `json:"requested_by"`
	Category  ExemptionCategory `json:"category"`
	Limit     int             `json:"limit"`
	Offset    int             `json:"offset"`
}

type ListExemptionsResponse struct {
	Exemptions []Exemption `json:"exemptions"`
	Total      int         `json:"total"`
}

// --- Common query params ---

type PaginatedQuery struct {
	Limit  int `json:"limit" form:"limit"`
	Offset int `json:"offset" form:"offset"`
}
