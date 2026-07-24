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

// ---- AI Security engine: policies, audit, blocks, risk ----

// SecurityPolicy represents an AI security policy enforced by the engine.
type SecurityPolicy struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenantId" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	Severity    string    `json:"severity" db:"severity"` // low|medium|high|critical
	Actions     []string  `json:"actions" db:"-"`         // JSONB list of action strings
	Enabled     bool      `json:"enabled" db:"enabled"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
}

// CreatePolicyRequest is the input for creating a new security policy.
type CreatePolicyRequest struct {
	Name        string                 `json:"name" binding:"required"`
	Description string                 `json:"description"`
	Severity    string                 `json:"severity" binding:"required"` // low|medium|high|critical
	Actions     []string               `json:"actions"`
	Config      map[string]interface{} `json:"config"`
}

// AuditLog represents a security audit event.
type AuditLog struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenantId" db:"tenant_id"`
	EventType string    `json:"eventType" db:"event_type"`
	Actor     string    `json:"actor" db:"actor"`
	Resource  string    `json:"resource" db:"resource"`
	Action    string    `json:"action" db:"action"`
	Timestamp time.Time `json:"timestamp" db:"timestamp"`
	Metadata  string    `json:"metadata" db:"metadata"` // JSONB serialized
}

// AuditLogFilter holds query filters for audit log retrieval.
type AuditLogFilter struct {
	EventType  string `json:"eventType" query:"event_type"`
	Actor      string `json:"actor" query:"actor"`
	From       string `json:"from" query:"from"`     // RFC3339 timestamp
	To         string `json:"to" query:"to"`         // RFC3339 timestamp
}

// BlockRecord represents an access block entry.
type BlockRecord struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenantId" db:"tenant_id"`
	Target    string    `json:"target" db:"target"`    // user / IP / agent identifier
	Reason    string    `json:"reason" db:"reason"`
	BlockedBy string    `json:"blockedBy" db:"blocked_by"`
	Active    bool      `json:"active" db:"active"`
	ExpiresAt *time.Time `json:"expiresAt" db:"expires_at"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
}

// BlockRequest is the input for creating a block.
type BlockRequest struct {
	Target    string     `json:"target" binding:"required"` // user / IP / agent
	Reason    string     `json:"reason" binding:"required"`
	BlockedBy string     `json:"blockedBy"`                // empty = system
	ExpiresAt *time.Time `json:"expiresAt"`                // nil = no expiry
}

// RiskScoreResult is the output of the risk scoring engine.
type RiskScoreResult struct {
	Target  string   `json:"target"`
	Score   int      `json:"score"`   // 0-100
	Level   string   `json:"level"`   // low|medium|high|critical
	Factors []string `json:"factors"` // risk factors contributing to the score
}

// isExpired reports whether a BlockRecord is past its optional expiry.
func (b *BlockRecord) isExpired() bool {
	if b.ExpiresAt == nil {
		return false
	}
	return time.Now().After(*b.ExpiresAt)
}
