package models

import "time"

// ScanRecord represents a code scan task.
type ScanRecord struct {
	ID         string    `json:"id"`
	Target     string    `json:"target"`
	Branch     string    `json:"branch"`
	Status     string    `json:"status"`
	TotalVulns int       `json:"totalVulns"`
	Critical   int       `json:"critical"`
	High       int       `json:"high"`
	Medium     int       `json:"medium"`
	Low        int       `json:"low"`
	Duration   int       `json:"duration"`
	StartedAt  time.Time `json:"startedAt"`
}

// VulnFinding represents a vulnerability finding.
type VulnFinding struct {
	ID          string `json:"id"`
	Category    string `json:"category"`
	Severity    string `json:"severity"`
	File        string `json:"file"`
	Line        int    `json:"line"`
	Description string `json:"description"`
	Fix         string `json:"fix,omitempty"`
	ScanID      string `json:"scanId"`
}

// CreateScanRequest is the request body for creating a new scan.
type CreateScanRequest struct {
	Target string `json:"target" binding:"required"`
	Branch string `json:"branch,omitempty"`
}
