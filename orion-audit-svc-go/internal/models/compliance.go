package models

import "time"

// ComplianceReport represents a compliance report record.
type ComplianceReport struct {
	ID          string  `json:"id" db:"id"`
	TenantID    string  `json:"tenant_id" db:"tenant_id"`
	Title       string  `json:"title" db:"title"`
	Status      string  `json:"status" db:"status"`
	Summary     JSONB   `json:"summary" db:"summary"`
	GeneratedBy string  `json:"generated_by" db:"generated_by"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// ComplianceCheckResult represents a single compliance check result.
type ComplianceCheckResult struct {
	CheckID       string                 `json:"checkId"`
	Framework     string                 `json:"framework"`
	ControlID     string                 `json:"controlId"`
	ControlName   string                 `json:"controlName"`
	Status        string                 `json:"status"`
	Severity      string                 `json:"severity"`
	Description   string                 `json:"description"`
	Evidence      map[string]interface{} `json:"evidence,omitempty"`
	Remediation   *string                `json:"remediation,omitempty"`
}

// AuditComplianceReport represents a compliance report.
type AuditComplianceReport struct {
	TenantID     string               `json:"tenantId"`
	Framework    string               `json:"framework"`
	GeneratedAt  time.Time            `json:"generatedAt"`
	OverallScore int                  `json:"overallScore"`
	Checks       []ComplianceCheckResult `json:"checks"`
	Summary      ComplianceSummary    `json:"summary"`
}

// ComplianceSummary represents the summary of a compliance report.
type ComplianceSummary struct {
	TotalChecks    int `json:"totalChecks"`
	PassedChecks   int `json:"passedChecks"`
	FailedChecks   int `json:"failedChecks"`
	WarningChecks  int `json:"warningChecks"`
	CriticalIssues int `json:"criticalIssues"`
}

// AuditCoverageStats represents audit coverage statistics.
type AuditCoverageStats struct {
	TotalActions             int     `json:"totalActions"`
	TotalResources           int     `json:"totalResources"`
	ActionsWithMissingUserId int     `json:"actionsWithMissingUserId"`
	ActionsWithMissingIp     int     `json:"actionsWithMissingIp"`
	ActionsWithMissingUserAgent int  `json:"actionsWithMissingUserAgent"`
	ActionsWithMissingResult int     `json:"actionsWithMissingResult"`
	CoveragePercent          int     `json:"coveragePercent"`
}

// ComplianceCheckRequest represents a request to run compliance checks.
type ComplianceCheckRequest struct {
	Framework *string `json:"framework"`
	TenantID  *string `json:"tenantId"`
}
