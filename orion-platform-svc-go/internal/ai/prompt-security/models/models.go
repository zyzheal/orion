package models

import "time"

// PromptSecurityConfig defines prompt security settings.
type PromptSecurityConfig struct {
	ID               string    `json:"id"`
	TenantID         string    `json:"tenant_id"`
	IsEnabled        bool      `json:"is_enabled"`
	InjectionEnabled bool      `json:"injection_detection"`
	PiiDetection     bool      `json:"pii_detection"`
	MaxPromptLength  int       `json:"max_prompt_length"`
	BlockedPatterns  string    `json:"blocked_patterns"`
	CreatedAt        time.Time `json:"created_at"`
}

// SecurityScan represents a security scan result.
type SecurityScan struct {
	ID                string `json:"id"`
	TenantID          string `json:"tenant_id"`
	Prompt            string `json:"prompt"`
	Score             float64 `json:"score"`
	IsSafe            bool   `json:"is_safe"`
	InjectionDetected bool   `json:"injection_detected"`
	PiiDetected       bool   `json:"pii_detected"`
	Findings          []string `json:"findings"`
	ScanTimeMs        int    `json:"scan_time_ms"`
	ScannedAt         time.Time `json:"scanned_at"`
}

// SecurityCheck represents a persisted security check record (prompt-injection + output audit).
type SecurityCheck struct {
	ID              string    `db:"id" json:"id"`
	TenantID        string    `db:"tenant_id" json:"tenant_id"`
	Type            string    `db:"check_type" json:"type"`
	PromptHash      string    `db:"prompt_hash" json:"prompt_hash"`
	RiskScore       int       `db:"risk_score" json:"risk_score"`
	IsSafe          bool      `db:"is_safe" json:"is_safe"`
	Action          string    `db:"action" json:"action"`
	MatchedKeywords []string  `db:"matched_keywords" json:"matched_keywords"`
	Findings        []string  `db:"findings" json:"findings"`
	Timestamp       time.Time `db:"checked_at" json:"timestamp"`
	CreatedAt       time.Time `db:"created_at" json:"created_at"`
}

// SecurityCheckResult is the in-memory result returned by CheckPrompt.
type SecurityCheckResult struct {
	IsSafe          bool     `json:"is_safe"`
	RiskScore       int      `json:"risk_score"`
	MatchedKeywords []string `json:"matched_keywords"`
	Action          string   `json:"action"`
	Findings        []string `json:"findings"`
}

// ScanRequest for scanning a prompt.
type ScanRequest struct {
	Prompt  string `json:"prompt" binding:"required"`
	Context string `json:"context"`
}

// ScanResponse wraps scan results.
type ScanResponse struct {
	Scan *SecurityScan `json:"scan"`
}

// CheckRequest for the enhanced CheckPrompt endpoint.
type CheckRequest struct {
	Prompt string `json:"prompt" binding:"required"`
}

// CheckResponse wraps the security check result.
type CheckResponse struct {
	Result SecurityCheckResult `json:"result"`
}

// ConfigResponse wraps config.
type ConfigResponse struct {
	Config *PromptSecurityConfig `json:"config"`
}
