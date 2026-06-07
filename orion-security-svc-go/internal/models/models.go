package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// JSONB is a convenience type for PostgreSQL JSONB columns.
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

// JSONArray is a convenience type for PostgreSQL JSONB array columns.
type JSONArray []interface{}

func (a JSONArray) Value() (driver.Value, error) {
	if a == nil {
		return nil, nil
	}
	return json.Marshal(a)
}

func (a *JSONArray) Scan(src interface{}) error {
	if src == nil {
		*a = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, a)
	case string:
		return json.Unmarshal([]byte(v), a)
	default:
		return fmt.Errorf("cannot scan %T into JSONArray", src)
	}
}

// ==================== Security Scan ====================

// SecurityScan represents a vulnerability/security scan record.
type SecurityScan struct {
	ID             string     `db:"id" json:"id"`
	TenantID       string     `db:"tenant_id" json:"tenant_id"`
	ScanType       string     `db:"scan_type" json:"scan_type"`
	Target         string     `db:"target" json:"target"`
	Scanner        string     `db:"scanner" json:"scanner"`
	Status         string     `db:"status" json:"status"`
	CriticalCount  int        `db:"critical_count" json:"critical_count"`
	HighCount      int        `db:"high_count" json:"high_count"`
	MediumCount    int        `db:"medium_count" json:"medium_count"`
	LowCount       int        `db:"low_count" json:"low_count"`
	TotalCount     int        `db:"total_count" json:"total_count"`
	Passed         bool       `db:"passed" json:"passed"`
	GateFailed     bool       `db:"gate_failed" json:"gate_failed"`
	ScanStartTime  *time.Time `db:"scan_start_time" json:"scan_start_time,omitempty"`
	ScanEndTime    *time.Time `db:"scan_end_time" json:"scan_end_time,omitempty"`
	DurationMs     int        `db:"duration_ms" json:"duration_ms"`
	Result         JSONB      `db:"result" json:"result,omitempty"`
	CreatedAt      time.Time  `db:"created_at" json:"created_at"`
}

// CreateScanRequest is the input for creating a new scan.
type CreateScanRequest struct {
	ScanType string `json:"scan_type" binding:"required"`
	Target   string `json:"target" binding:"required"`
	Scanner  string `json:"scanner"`
}

// ==================== Security Finding ====================

// SecurityFinding represents a single finding from a scan or audit.
type SecurityFinding struct {
	ID           string     `db:"id" json:"id"`
	TenantID     string     `db:"tenant_id" json:"tenant_id"`
	ScanID       *string    `db:"scan_id" json:"scan_id,omitempty"`
	RuleID       string     `db:"rule_id" json:"rule_id"`
	Severity     string     `db:"severity" json:"severity"`
	Category     string     `db:"category" json:"category"`
	Title        string     `db:"title" json:"title"`
	Description  string     `db:"description" json:"description,omitempty"`
	FilePath     string     `db:"file_path" json:"file_path,omitempty"`
	LineStart    *int       `db:"line_start" json:"line_start,omitempty"`
	LineEnd      *int       `db:"line_end" json:"line_end,omitempty"`
	CodeSnippet  string     `db:"code_snippet" json:"code_snippet,omitempty"`
	MatchText    string     `db:"match_text" json:"match_text,omitempty"`
	Confidence   float32    `db:"confidence" json:"confidence"`
	Remediation  string     `db:"remediation" json:"remediation,omitempty"`
	Status       string     `db:"status" json:"status"`
	AssignedTo   *string    `db:"assigned_to" json:"assigned_to,omitempty"`
	ClosedAt     *time.Time `db:"closed_at" json:"closed_at,omitempty"`
	CreatedAt    time.Time  `db:"created_at" json:"created_at"`
}

// ==================== Audit Plan ====================

// AuditPlan represents a security audit plan.
type AuditPlan struct {
	ID             string    `db:"id" json:"id"`
	TenantID       string    `db:"tenant_id" json:"tenant_id"`
	Name           string    `db:"name" json:"name"`
	Description    string    `db:"description" json:"description,omitempty"`
	Scope          JSONB     `db:"scope" json:"scope"`
	AuditType      string    `db:"audit_type" json:"audit_type"`
	ScheduleType   string    `db:"schedule_type" json:"schedule_type"`
	CronExpression *string   `db:"cron_expression" json:"cron_expression,omitempty"`
	Reviewers      JSONArray `db:"reviewers" json:"reviewers"`
	Status         string    `db:"status" json:"status"`
	CreatedBy      *string   `db:"created_by" json:"created_by,omitempty"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time `db:"updated_at" json:"updated_at"`
}

// CreateAuditPlanRequest is the input for creating an audit plan.
type CreateAuditPlanRequest struct {
	Name           string                 `json:"name" binding:"required"`
	Description    string                 `json:"description"`
	Scope          map[string]interface{} `json:"scope"`
	AuditType      string                 `json:"audit_type" binding:"required"`
	ScheduleType   string                 `json:"schedule_type"`
	CronExpression string                 `json:"cron_expression"`
	Reviewers      []interface{}          `json:"reviewers"`
	CreatedBy      string                 `json:"created_by"`
}

// UpdateAuditPlanRequest is the input for updating an audit plan.
type UpdateAuditPlanRequest struct {
	Name           *string                `json:"name"`
	Description    *string                `json:"description"`
	Scope          map[string]interface{} `json:"scope"`
	AuditType      *string                `json:"audit_type"`
	ScheduleType   *string                `json:"schedule_type"`
	CronExpression *string                `json:"cron_expression"`
	Reviewers      []interface{}          `json:"reviewers"`
}

// ==================== Audit Execution ====================

// AuditExecution represents a single execution of an audit plan.
type AuditExecution struct {
	ID            string     `db:"id" json:"id"`
	PlanID        string     `db:"plan_id" json:"plan_id"`
	TenantID      string     `db:"tenant_id" json:"tenant_id"`
	Status        string     `db:"status" json:"status"`
	StartedAt     time.Time  `db:"started_at" json:"started_at"`
	CompletedAt   *time.Time `db:"completed_at" json:"completed_at,omitempty"`
	FindingsCount int        `db:"findings_count" json:"findings_count"`
	CreatedAt     time.Time  `db:"created_at" json:"created_at"`
}

// ==================== Audit Finding ====================

// AuditFinding represents a finding from an audit execution.
type AuditFinding struct {
	ID             string     `db:"id" json:"id"`
	ExecutionID    string     `db:"execution_id" json:"execution_id"`
	TenantID       string     `db:"tenant_id" json:"tenant_id"`
	Title          string     `db:"title" json:"title"`
	Description    string     `db:"description" json:"description,omitempty"`
	Severity       string     `db:"severity" json:"severity"`
	Category       string     `db:"category" json:"category,omitempty"`
	Evidence       JSONB      `db:"evidence" json:"evidence,omitempty"`
	Recommendation string     `db:"recommendation" json:"recommendation,omitempty"`
	Status         string     `db:"status" json:"status"`
	AssignedTo     *string    `db:"assigned_to" json:"assigned_to,omitempty"`
	ClosedAt       *time.Time `db:"closed_at" json:"closed_at,omitempty"`
	CreatedAt      time.Time  `db:"created_at" json:"created_at"`
}

// UpdateFindingRequest is the input for updating a finding.
type UpdateFindingRequest struct {
	Status         *string `json:"status"`
	AssignedTo     *string `json:"assigned_to"`
	Recommendation *string `json:"recommendation"`
}

// ==================== Compliance Policy ====================

// CompliancePolicy represents a compliance policy definition.
type CompliancePolicy struct {
	ID                string    `db:"id" json:"id"`
	TenantID          string    `db:"tenant_id" json:"tenant_id"`
	Name              string    `db:"name" json:"name"`
	Description       string    `db:"description" json:"description,omitempty"`
	FrameworkType     string    `db:"framework_type" json:"framework_type"`
	Requirements      JSONB     `db:"requirements" json:"requirements"`
	Rules             JSONArray `db:"rules" json:"rules"`
	SeverityThreshold string    `db:"severity_threshold" json:"severity_threshold"`
	Enabled           bool      `db:"enabled" json:"enabled"`
	CreatedBy         *string   `db:"created_by" json:"created_by,omitempty"`
	CreatedAt         time.Time `db:"created_at" json:"created_at"`
	UpdatedAt         time.Time `db:"updated_at" json:"updated_at"`
}

// CreateCompliancePolicyRequest is the input for creating a compliance policy.
type CreateCompliancePolicyRequest struct {
	Name              string                 `json:"name" binding:"required"`
	Description       string                 `json:"description"`
	FrameworkType     string                 `json:"framework_type" binding:"required"`
	Requirements      map[string]interface{} `json:"requirements"`
	Rules             []interface{}          `json:"rules"`
	SeverityThreshold string                 `json:"severity_threshold"`
	CreatedBy         string                 `json:"created_by"`
}

// ==================== Compliance Evaluation ====================

// ComplianceEvaluation represents an evaluation run against a compliance policy.
type ComplianceEvaluation struct {
	ID            string     `db:"id" json:"id"`
	TenantID      string     `db:"tenant_id" json:"tenant_id"`
	PolicyID      string     `db:"policy_id" json:"policy_id"`
	Status        string     `db:"status" json:"status"`
	Score         float32    `db:"score" json:"score"`
	TotalChecks   int        `db:"total_checks" json:"total_checks"`
	PassedChecks  int        `db:"passed_checks" json:"passed_checks"`
	FailedChecks  int        `db:"failed_checks" json:"failed_checks"`
	Gaps          JSONArray  `db:"gaps" json:"gaps"`
	StartedAt     time.Time  `db:"started_at" json:"started_at"`
	CompletedAt   *time.Time `db:"completed_at" json:"completed_at,omitempty"`
	CreatedAt     time.Time  `db:"created_at" json:"created_at"`
}

// ComplianceGap represents a gap identified during compliance evaluation.
type ComplianceGap struct {
	ID          string `json:"id"`
	Rule        string `json:"rule"`
	Description string `json:"description"`
	Severity    string `json:"severity"`
	Remediation string `json:"remediation"`
}

// ComplianceReport is the aggregated compliance report.
type ComplianceReport struct {
	Policy     CompliancePolicy     `json:"policy"`
	Evaluation ComplianceEvaluation `json:"evaluation"`
	Gaps       []ComplianceGap      `json:"gaps"`
	Score      float32              `json:"score"`
	Status     string               `json:"status"`
}

// ComplianceScoreSummary is the aggregated compliance score for a tenant.
type ComplianceScoreSummary struct {
	TenantID            string             `json:"tenant_id"`
	OverallScore        float32            `json:"overall_score"`
	PoliciesEvaluated   int                `json:"policies_evaluated"`
	PoliciesByFramework map[string]float32 `json:"policies_by_framework"`
	OpenGaps            int                `json:"open_gaps"`
	CriticalGaps        int                `json:"critical_gaps"`
}

// ==================== Supply Chain SBOM ====================

// SupplyChainSBOM represents a Software Bill of Materials record.
type SupplyChainSBOM struct {
	ID             string    `db:"id" json:"id"`
	TenantID       string    `db:"tenant_id" json:"tenant_id"`
	ArtifactID     string    `db:"artifact_id" json:"artifact_id"`
	PipelineID     *string   `db:"pipeline_id" json:"pipeline_id,omitempty"`
	SBOMFormat     string    `db:"sbom_format" json:"sbom_format"`
	SBOMVersion    string    `db:"sbom_version" json:"sbom_version"`
	Components     JSONArray `db:"components" json:"components"`
	Dependencies   JSONArray `db:"dependencies" json:"dependencies"`
	Vulnerabilities JSONArray `db:"vulnerabilities" json:"vulnerabilities"`
	Metadata       JSONB     `db:"metadata" json:"metadata"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
}

// CreateSBOMRequest is the input for generating an SBOM.
type CreateSBOMRequest struct {
	ArtifactID   string        `json:"artifact_id" binding:"required"`
	PipelineID   string        `json:"pipeline_id"`
	Format       string        `json:"format"`
	Version      string        `json:"version"`
	Components   []interface{} `json:"components" binding:"required"`
	Dependencies []interface{} `json:"dependencies"`
}

// ==================== Dependency Graph ====================

// DependencyGraph represents a dependency analysis result.
type DependencyGraph struct {
	ID              string     `db:"id" json:"id"`
	TenantID        string     `db:"tenant_id" json:"tenant_id"`
	PackageName     string     `db:"package_name" json:"package_name"`
	PackageVersion  string     `db:"package_version" json:"package_version"`
	DirectDeps      JSONArray  `db:"direct_deps" json:"direct_deps"`
	TransitiveDeps  JSONArray  `db:"transitive_deps" json:"transitive_deps"`
	VulnerablePaths JSONArray  `db:"vulnerable_paths" json:"vulnerable_paths"`
	Depth           int        `db:"depth" json:"depth"`
	AnalyzedAt      time.Time  `db:"analyzed_at" json:"analyzed_at"`
}

// AnalyzeDependencyRequest is the input for dependency analysis.
type AnalyzeDependencyRequest struct {
	PackageName    string `json:"package_name" binding:"required"`
	PackageVersion string `json:"package_version" binding:"required"`
	Depth          int    `json:"depth"`
}

// ==================== Dependency Poisoning Scan ====================

// DependencyPoisoningScan represents a dependency poisoning scan result.
type DependencyPoisoningScan struct {
	ID                string    `db:"id" json:"id"`
	TenantID          string    `db:"tenant_id" json:"tenant_id"`
	PackagesScanned   int       `db:"packages_scanned" json:"packages_scanned"`
	MaliciousFound    int       `db:"malicious_found" json:"malicious_found"`
	TyposquattingFound int      `db:"typosquatting_found" json:"typosquatting_found"`
	RiskScore         int       `db:"risk_score" json:"risk_score"`
	RiskLevel         string    `db:"risk_level" json:"risk_level"`
	ScanData          JSONB     `db:"scan_data" json:"scan_data"`
	CreatedAt         time.Time `db:"created_at" json:"created_at"`
}

// ScanDependencyPoisoningRequest is the input for dependency poisoning scan.
type ScanDependencyPoisoningRequest struct {
	Packages []PackageEntry `json:"packages" binding:"required"`
}

// PackageEntry represents a package for scanning.
type PackageEntry struct {
	Name    string `json:"name" binding:"required"`
	Version string `json:"version"`
}

// ==================== Pagination ====================

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

// ==================== Compliance Framework (static data) ====================

// ComplianceFramework represents a supported compliance framework.
type ComplianceFramework struct {
	ID            string   `json:"id"`
	Name          string   `json:"name"`
	Description   string   `json:"description"`
	Version       string   `json:"version"`
	Categories    []string `json:"categories"`
	TotalControls int      `json:"total_controls"`
	URL           string   `json:"url,omitempty"`
}
