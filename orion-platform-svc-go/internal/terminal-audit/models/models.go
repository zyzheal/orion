package models

import (
	"time"
)

// Model and related types for terminal-audit

// TerminalAuditLog records a terminal command execution.
type TerminalAuditLog struct {
	ID         string    `db:"id" json:"id"`
	TenantID   string    `db:"tenant_id" json:"tenant_id"`
	UserID     string    `db:"user_id" json:"user_id"`
	Command    string    `db:"command" json:"command"`
	Output     string    `db:"output" json:"output"`
	Status     string    `db:"status" json:"status"`
	Host       string    `db:"host" json:"host"`
	IP         string    `db:"ip" json:"ip"`
	DurationMs int64     `db:"duration_ms" json:"duration_ms"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
}

// AuditQuery filters audit logs.
type AuditQuery struct {
	UserID string
	Status string
	From   string
	To     string
	Limit  int
	Offset int
}

// AuditStats holds aggregate audit statistics.
type AuditStats struct {
	Total       int            `json:"total"`
	ByStatus    map[string]int `json:"by_status"`
	ByUser      map[string]int `json:"by_user"`
	FailedCount int            `json:"failed_count"`
}

// DeleteBatchRequest is the payload for bulk deleting audit logs.
type DeleteBatchRequest struct {
	IDs    []string `json:"ids"`
	Before string   `json:"before"`
}
