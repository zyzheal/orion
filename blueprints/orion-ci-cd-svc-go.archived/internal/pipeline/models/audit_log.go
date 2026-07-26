package models

import "time"

// AuditLog represents a single audit log entry.
type AuditLog struct {
	ID         string    `db:"id" json:"id"`
	TenantID   string    `db:"tenant_id" json:"tenant_id"`
	PipelineID *string   `db:"pipeline_id" json:"pipeline_id,omitempty"`
	RunID      *string   `db:"run_id" json:"run_id,omitempty"`
	Action     string    `db:"action" json:"action"`
	Actor      string    `db:"actor" json:"actor"`
	Target     *string   `db:"target" json:"target,omitempty"`
	TargetType *string   `db:"target_type" json:"target_type,omitempty"`
	Details    string    `db:"details" json:"details"`
	IPAddress  *string   `db:"ip_address" json:"ip_address,omitempty"`
	UserAgent  *string   `db:"user_agent" json:"user_agent,omitempty"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
}

// AuditTrailEntry represents an enriched audit trail entry with contextual info.
type AuditTrailEntry struct {
	AuditLog
	ActorName    string `json:"actor_name,omitempty"`
	PipelineName string `json:"pipeline_name,omitempty"`
}

// RecordAuditRequest is the input for recording an audit log entry.
type RecordAuditRequest struct {
	PipelineID *string           `json:"pipeline_id,omitempty"`
	RunID      *string           `json:"run_id,omitempty"`
	Action     string            `json:"action" binding:"required"`
	Actor      string            `json:"actor" binding:"required"`
	Target     *string           `json:"target,omitempty"`
	TargetType *string           `json:"target_type,omitempty"`
	Details    map[string]any    `json:"details,omitempty"`
	IPAddress  *string           `json:"ip_address,omitempty"`
	UserAgent  *string           `json:"user_agent,omitempty"`
}

// AuditLogFilter filters audit log queries.
type AuditLogFilter struct {
	TenantID   string
	PipelineID string
	RunID      string
	Actor      string
	Action     string
	StartTime  string
	EndTime    string
	Limit      int
	Offset     int
}