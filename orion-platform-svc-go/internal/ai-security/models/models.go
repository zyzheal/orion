package models

import "time"

// ---- Core AI Security record ----

type Record struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenantId" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Status    string    `json:"status" db:"status"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
}

type ListQuery struct {
	Page   int    `json:"page" query:"page"`
	Limit  int    `json:"limit" query:"limit"`
	Status string `json:"status" query:"status"`
}

type CreateRequest struct {
	Name   string                 `json:"name" binding:"required"`
	Status string                 `json:"status"`
	Config map[string]interface{} `json:"config"`
}

// ---- Vulnerability / CVE scanning ----

// Severity represents a Trivy-style severity level.
type Severity string

const (
	SeverityCritical Severity = "CRITICAL"
	SeverityHigh     Severity = "HIGH"
	SeverityMedium   Severity = "MEDIUM"
	SeverityLow      Severity = "LOW"
	SeverityUnknown  Severity = "UNKNOWN"
)

// VulnerabilityScanRequest is the input for Trivy-based vulnerability scanning.
type VulnerabilityScanRequest struct {
	Image string                 `json:"image" binding:"required"` // docker image reference
	Type  string                 `json:"type"`                     // image|fs|repo
	Extra map[string]interface{} `json:"extra"`
}

// ScanVulnerabilitiesResult is the aggregated output of a Trivy scan.
type ScanVulnerabilitiesResult struct {
	Image     string          `json:"image"`
	Timestamp string          `json:"timestamp"`
	Total     int             `json:"total"`
	Critical  int             `json:"critical"`
	High      int             `json:"high"`
	Medium    int             `json:"medium"`
	Low       int             `json:"low"`
	Vulns     []Vulnerability `json:"vulns"`
	Errors    []string        `json:"errors,omitempty"`
	Degraded  bool            `json:"degraded"`         // true when Trivy engine is unreachable
	Engine    string          `json:"engine,omitempty"` // "trivy" or "degraded"
}

// Vulnerability represents a single CVE finding.
type Vulnerability struct {
	ID          string   `json:"id"` // CVE identifier
	PkgName     string   `json:"pkgName"`
	Installed   string   `json:"installed"` // installed version
	Fixed       string   `json:"fixed"`     // fixed version (empty if none)
	Severity    Severity `json:"severity"`
	Description string   `json:"description"`
	Links       []string `json:"links"`
}

// CheckVulnerabilityRequest queries a single CVE (Trivy DB look-up).
type CheckVulnerabilityRequest struct {
	CVEID string `json:"cveId" binding:"required"`
}

// CheckVulnerabilityResult is the detail for one CVE.
type CheckVulnerabilityResult struct {
	CVEID       string   `json:"cveId"`
	Severity    Severity `json:"severity"`
	Description string   `json:"description"`
	Affected    []string `json:"affected"`
	Fixed       string   `json:"fixed"`
	Links       []string `json:"links"`
}

// FixVulnerabilityRequest requests remediation for one or more CVEs in an image.
type FixVulnerabilityRequest struct {
	Image  string   `json:"image" binding:"required"`
	CVEIDs []string `json:"cveIds"` // empty = fix all
}

// FixVulnerabilityResult reports remediation status.
type FixVulnerabilityResult struct {
	Image         string   `json:"image"`
	AppliedCVEIDs []string `json:"applied"`
	Unfixable     []string `json:"unfixable"` // CVEs with no upstream fix
	Status        string   `json:"status"`    // ok|partial|unavailable
	Message       string   `json:"message"`
}
