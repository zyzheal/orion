package models

import "time"

// Contract represents an API contract.
type Contract struct {
	ID                string            `json:"id" db:"id"`
	APIName           string            `json:"apiName" db:"api_name"`
	Version           string            `json:"version" db:"version"`
	Method            string            `json:"method" db:"method"`
	Path              string            `json:"path" db:"path"`
	RequestSchema     string            `json:"requestSchema" db:"request_schema"`
	ResponseSchema    string            `json:"responseSchema" db:"response_schema"`
	Status            string            `json:"status" db:"status"`
	DeprecationDate   *time.Time        `json:"deprecationDate" db:"deprecation_date"`
	RetirementDate    *time.Time        `json:"retirementDate" db:"retirement_date"`
	ReplacementVersion *string          `json:"replacementVersion" db:"replacement_version"`
	CreatedAt         time.Time         `json:"createdAt" db:"created_at"`
	UpdatedAt         time.Time         `json:"updatedAt" db:"updated_at"`
}

// Version represents an API version.
type Version struct {
	ID                 string     `json:"id" db:"id"`
	TenantID           string     `json:"tenantId" db:"tenant_id"`
	ContractID         string     `json:"contractId" db:"contract_id"`
	APIName            string     `json:"apiName" db:"api_name"`
	Version            string     `json:"version" db:"version"`
	Status             string     `json:"status" db:"status"`
	DeprecationDate    *time.Time `json:"deprecationDate" db:"deprecation_date"`
	RetirementDate     *time.Time `json:"retirementDate" db:"retirement_date"`
	ReplacementVersion *string    `json:"replacementVersion" db:"replacement_version"`
	Changelog          *string    `json:"changelog" db:"changelog"`
	RegisteredAt       time.Time  `json:"registeredAt" db:"registered_at"`
	CreatedAt          time.Time  `json:"createdAt" db:"created_at"`
}

// Violation represents an API contract violation.
type Violation struct {
	ID            string    `json:"id" db:"id"`
	ContractID    string    `json:"contractId" db:"contract_id"`
	ViolationType string    `json:"violationType" db:"violation_type"`
	Description   string    `json:"description" db:"description"`
	Severity      string    `json:"severity" db:"severity"`
	DetectedAt    time.Time `json:"detectedAt" db:"detected_at"`
	CreatedAt     time.Time `json:"createdAt" db:"created_at"`
}

// Rule represents a governance rule.
type Rule struct {
	ID          string     `json:"id" db:"id"`
	Name        string     `json:"name" db:"name"`
	Description string     `json:"description" db:"description"`
	Enabled     bool       `json:"enabled" db:"enabled"`
	Config      string     `json:"config" db:"config"`
	CreatedAt   time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time  `json:"updatedAt" db:"updated_at"`
}

// VerificationHistory represents a verification attempt.
type VerificationHistory struct {
	ID         string    `json:"id" db:"id"`
	ContractID string    `json:"contractId" db:"contract_id"`
	Passed     bool      `json:"passed" db:"passed"`
	Violations string    `json:"violations" db:"violations"`
	Endpoint   string    `json:"endpoint" db:"endpoint"`
	Method     string    `json:"method" db:"method"`
	VerifiedAt time.Time `json:"verifiedAt" db:"verified_at"`
	CreatedAt  time.Time `json:"createdAt" db:"created_at"`
}

// ---- Request/Response DTOs ----

// CreateContractRequest is the body for creating a contract.
type CreateContractRequest struct {
	APIName       string                 `json:"apiName" binding:"required"`
	Version       string                 `json:"version" binding:"required"`
	Method        string                 `json:"method" binding:"required"`
	Path          string                 `json:"path" binding:"required"`
	RequestSchema map[string]interface{} `json:"requestSchema" binding:"required"`
	ResponseSchema map[string]interface{} `json:"responseSchema" binding:"required"`
}

// VerifyRequest is the body for verifying a contract.
type VerifyRequest struct {
	ActualResponse map[string]interface{} `json:"actualResponse"`
	Endpoint       *string                `json:"endpoint"`
	Method         *string                `json:"method"`
}

// CreateVersionRequest is the body for creating an API version.
type CreateVersionRequest struct {
	APIName            string  `json:"apiName" binding:"required"`
	Version            string  `json:"version" binding:"required"`
	Status             string  `json:"status"`
	ReplacementVersion *string `json:"replacementVersion"`
	Changelog          *string `json:"changelog"`
}

// DeprecateVersionRequest is the body for deprecating a version.
type DeprecateVersionRequest struct {
	ReplacementVersion *string `json:"replacementVersion"`
	RetirementDate     *string `json:"retirementDate"`
}

// CreateRuleRequest is the body for creating a governance rule.
type CreateRuleRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description" binding:"required"`
	Enabled     *bool  `json:"enabled"`
}

// CompatibilityRequest is the body for compatibility check.
type CompatibilityRequest struct {
	SourceVersion string `json:"sourceVersion" binding:"required"`
	TargetVersion string `json:"targetVersion" binding:"required"`
}

// GovernanceStats is the response for governance report.
type GovernanceStats struct {
	TotalContracts     int    `json:"totalContracts"`
	TotalVersions      int    `json:"totalVersions"`
	TotalRules         int    `json:"totalRules"`
	ActiveRules        int    `json:"activeRules"`
	TotalViolations    int    `json:"totalViolations"`
	DeprecatedVersions int    `json:"deprecatedVersions"`
	ComplianceScore    int    `json:"complianceScore"`
	GeneratedAt        string `json:"generatedAt"`
}

// ---- Response DTOs ----

// ContractResponse is the API response for a contract.
type ContractResponse struct {
	ID                string `json:"id"`
	APIName           string `json:"apiName"`
	Version           string `json:"version"`
	Method            string `json:"method"`
	Path              string `json:"path"`
	RequestSchema     string `json:"requestSchema"`
	ResponseSchema    string `json:"responseSchema"`
	Status            string `json:"status"`
	DeprecationDate   string `json:"deprecationDate,omitempty"`
	RetirementDate    string `json:"retirementDate,omitempty"`
	ReplacementVersion string `json:"replacementVersion,omitempty"`
	CreatedAt         string `json:"createdAt"`
}

// VersionResponse is the API response for a version.
type VersionResponse struct {
	ID                 string `json:"id"`
	APIName            string `json:"apiName"`
	Version            string `json:"version"`
	Status             string `json:"status"`
	RegisteredAt       string `json:"registeredAt"`
	DeprecationDate    string `json:"deprecationDate,omitempty"`
	RetirementDate     string `json:"retirementDate,omitempty"`
	ReplacementVersion string `json:"replacementVersion,omitempty"`
	Changelog          string `json:"changelog,omitempty"`
}

// ViolationResponse is the API response for a violation.
type ViolationResponse struct {
	ID            string `json:"id"`
	ContractID    string `json:"contractId"`
	ViolationType string `json:"violationType"`
	Description   string `json:"description"`
	Severity      string `json:"severity"`
	DetectedAt    string `json:"detectedAt"`
}

// RuleResponse is the API response for a rule.
type RuleResponse struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Enabled     bool   `json:"enabled"`
	CreatedAt   string `json:"createdAt"`
}

// VerificationHistoryResponse is the API response for a verification history item.
type VerificationHistoryResponse struct {
	ContractID string   `json:"contractId"`
	Passed     bool     `json:"passed"`
	Violations string   `json:"violations"`
	Endpoint   string   `json:"endpoint"`
	Method     string   `json:"method"`
	VerifiedAt string   `json:"verifiedAt"`
}

// VerifyResult is the API response from verifying a contract.
type VerifyResult struct {
	ContractID string   `json:"contractId"`
	Passed     bool     `json:"passed"`
	Violations []string `json:"violations"`
	Endpoint   string   `json:"endpoint"`
	Method     string   `json:"method"`
	VerifiedAt string   `json:"verifiedAt"`
}

// CompatibilityResult is the API response from checking compatibility.
type CompatibilityResult struct {
	SourceVersion   string   `json:"sourceVersion"`
	TargetVersion   string   `json:"targetVersion"`
	Compatible      bool     `json:"compatible"`
	BreakingChanges []string `json:"breakingChanges"`
	Recommendations []string `json:"recommendations"`
}
