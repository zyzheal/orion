package models

import "time"

// VulnerabilitySeverity represents the severity level of a vulnerability.
type VulnerabilitySeverity string

const (
	VulnerabilitySeverityCritical VulnerabilitySeverity = "critical"
	VulnerabilitySeverityHigh     VulnerabilitySeverity = "high"
	VulnerabilitySeverityMedium   VulnerabilitySeverity = "medium"
	VulnerabilitySeverityLow      VulnerabilitySeverity = "low"
	VulnerabilitySeverityInfo     VulnerabilitySeverity = "info"
)

// VulnerabilityStatus represents the remediation status of a vulnerability.
type VulnerabilityStatus string

const (
	VulnerabilityStatusOpen          VulnerabilityStatus = "open"
	VulnerabilityStatusRemediated    VulnerabilityStatus = "remediated"
	VulnerabilityStatusIgnored       VulnerabilityStatus = "ignored"
	VulnerabilityStatusFalsePositive VulnerabilityStatus = "false_positive"
)

// Vulnerability is a dependency vulnerability record.
type Vulnerability struct {
	ID             string                `json:"id" db:"id"`
	TenantID       string                `json:"tenantId" db:"tenant_id"`
	CVEID          string                `json:"cveId" db:"cve_id"`
	PackageName    string                `json:"packageName" db:"package_name"`
	PackageVersion string                `json:"packageVersion" db:"package_version"`
	Severity       VulnerabilitySeverity `json:"severity" db:"severity"`
	Description    string                `json:"description" db:"description"`
	FixVersion     string                `json:"fixVersion" db:"fix_version"`
	Status         VulnerabilityStatus   `json:"status" db:"status"`
	DetectedAt     time.Time             `json:"detectedAt" db:"detected_at"`
	CreatedAt      time.Time             `json:"createdAt" db:"created_at"`
	UpdatedAt      time.Time             `json:"updatedAt" db:"updated_at"`
}

// CreateVulnerabilityRequest is the body for creating a vulnerability record.
type CreateVulnerabilityRequest struct {
	CVEID          string                `json:"cveId"`
	PackageName    string                `json:"packageName" binding:"required"`
	PackageVersion string                `json:"packageVersion"`
	Severity       VulnerabilitySeverity `json:"severity"`
	Description    string                `json:"description"`
	FixVersion     string                `json:"fixVersion"`
}

// ScanVulnerabilitiesRequest is the body for triggering a dependency vulnerability scan.
type ScanVulnerabilitiesRequest struct {
	ProjectPath string `json:"projectPath"`
}

// RemediateVulnerabilityRequest is the body for remediating a vulnerability.
type RemediateVulnerabilityRequest struct {
	Action VulnerabilityStatus `json:"action" binding:"required"`
	Reason string              `json:"reason"`
}

// ListVulnerabilitiesOptions holds optional filters for listing vulnerabilities.
type ListVulnerabilitiesOptions struct {
	Severity VulnerabilitySeverity
	Limit    int
	Offset   int
	Page     int
}

// VulnerabilityReport is the response for listing vulnerabilities with aggregated metadata.
type VulnerabilityReport struct {
	Vulnerabilities        []Vulnerability `json:"data"`
	TotalVulnerabilities   int             `json:"total"`
	BySeverity             map[string]int  `json:"bySeverity"`
	ByStatus               map[string]int  `json:"byStatus"`
	OpenCritical           int             `json:"openCritical"`
	OpenHigh               int             `json:"openHigh"`
}

// ScanResult is the response for a dependency vulnerability scan.
type ScanResult struct {
	ScanID               string          `json:"scanId"`
	PackageManager       string          `json:"packageManager"`
	TotalDependencies    int             `json:"totalDependencies"`
	VulnerabilitiesFound int             `json:"vulnerabilitiesFound"`
	Vulnerabilities      []Vulnerability `json:"vulnerabilities"`
	ScannedAt            time.Time       `json:"scannedAt"`
	Tool                 string          `json:"tool"`
	Warning              string          `json:"warning,omitempty"`
}

// PaginatedResult is a generic paginated response.
type PaginatedResult struct {
	Data       []any `json:"data"`
	Total      int   `json:"total"`
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	TotalPages int   `json:"totalPages"`
}
