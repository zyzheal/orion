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
	ID            string    `json:"id"`
	TenantID      string    `json:"tenant_id"`
	Prompt        string    `json:"prompt"`
	Score         float64   `json:"score"`
	IsSafe        bool      `json:"is_safe"`
	InjectionDetected bool   `json:"injection_detected"`
	PiiDetected   bool      `json:"pii_detected"`
	Findings      []string  `json:"findings"`
	ScanTimeMs    int       `json:"scan_time_ms"`
	ScannedAt     time.Time `json:"scanned_at"`
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

// ConfigResponse wraps config.
type ConfigResponse struct {
	Config *PromptSecurityConfig `json:"config"`
}
