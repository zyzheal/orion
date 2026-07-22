package models

import "time"

// ArtifactOperation tracks a single operation performed on an artifact.
type ArtifactOperation struct {
	ID         string    `json:"id" db:"id"`
	TenantID   string    `json:"tenant_id" db:"tenant_id"`
	ArtifactID string    `json:"artifact_id" db:"artifact_id"`
	Action     string    `json:"action" db:"action"`
	ActorID    string    `json:"actor_id" db:"actor_id"`
	Details    string    `json:"details" db:"details"` // JSON blob
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

type TrackOperationRequest struct {
	ArtifactID string `json:"artifactId" binding:"required"`
	Action     string `json:"action" binding:"required"`
	Details    string `json:"details"`
}

// ArtifactStats holds aggregate counts for an artifact.
type ArtifactStats struct {
	ArtifactID  string `json:"artifact_id"`
	TotalOps    int    `json:"total_ops"`
	LastAction  string `json:"last_action"`
}

// ArtifactScan represents a scan initiated for an artifact.
type ArtifactScan struct {
	ID         string    `json:"id" db:"id"`
	TenantID   string    `json:"tenant_id" db:"tenant_id"`
	ArtifactID string    `json:"artifact_id" db:"artifact_id"`
	Status     string    `json:"status" db:"status"` // pending, running, completed, failed
	ReportID   string    `json:"report_id" db:"report_id"`
	Error      string    `json:"error" db:"error"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}

type ScanArtifactRequest struct {
	Type  string `json:"type"` // virus, license, dependency
}

// ScanReport is the result of a scan.
type ScanReport struct {
	ID         string    `json:"id" db:"id"`
	TenantID   string    `json:"tenant_id" db:"tenant_id"`
	ScanID     string    `json:"scan_id" db:"scan_id"`
	ArtifactID string    `json:"artifact_id" db:"artifact_id"`
	Status     string    `json:"status" db:"status"` // clean, warning, malicious
	Findings   string    `json:"findings" db:"findings"` // JSON blob
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

type DetectMaliciousRequest struct {
	ArtifactID string `json:"artifactId" binding:"required"`
	Hash       string `json:"hash"`
}

type DetectMaliciousResult struct {
	Malicious bool   `json:"malicious"`
	Reason    string `json:"reason"`
	ArtifactID string `json:"artifact_id"`
}

// RetentionPolicy defines retention rules for artifacts.
type RetentionPolicy struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Rule      string    `json:"rule" db:"rule"`       // JSON blob: maxAgeDays, maxCount, conditions
	Enabled   bool      `json:"enabled" db:"enabled"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type DefineRetentionPolicyRequest struct {
	Name    string `json:"name" binding:"required"`
	Rule    string `json:"rule" binding:"required"` // JSON blob
	Enabled *bool  `json:"enabled"`
}

type EvaluateRetentionRequest struct {
	PolicyID   string `json:"policyId" binding:"required"`
	ArtifactID string `json:"artifactId"`
}

type EvaluateRetentionResult struct {
	PolicyID   string `json:"policy_id"`
	ArtifactID string `json:"artifact_id"`
	Expired    bool   `json:"expired"`
	Reason     string `json:"reason"`
}

type RetentionReportRequest struct {
	PolicyID string `json:"policyId"`
}

type RetentionReport struct {
	PolicyID    string `json:"policy_id"`
	TotalChecked int   `json:"total_checked"`
	Expired      int   `json:"expired"`
	Active       int   `json:"active"`
}
