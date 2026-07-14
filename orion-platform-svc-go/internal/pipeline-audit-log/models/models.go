package models

import "time"

// AuditLog represents a single pipeline audit log entry.
type AuditLog struct {
	ID            string    `db:"id" json:"id"`
	TenantID      string    `db:"tenant_id" json:"tenantId"`
	RunID         string    `db:"run_id" json:"runId"`
	StageID       *string   `db:"stage_id" json:"stageId"`
	TaskID        *string   `db:"task_id" json:"taskId"`
	Action        string    `db:"action" json:"action"`
	Actor         string    `db:"actor" json:"actor"`
	Outcome       string    `db:"outcome" json:"outcome"`
	DurationMS    *int64    `db:"duration_ms" json:"durationMs"`
	InputSummary  *string   `db:"input_summary" json:"inputSummary"`
	OutputSummary *string   `db:"output_summary" json:"outputSummary"`
	ErrorMessage  *string   `db:"error_message" json:"errorMessage"`
	Metadata      string    `db:"metadata" json:"metadata"`
	CreatedAt     time.Time `db:"created_at" json:"createdAt"`
}

// AuditLogRequest is the request body for recording a single audit log event.
type AuditLogRequest struct {
	TenantID      *string `json:"tenantId"`
	RunID         string  `json:"runId" binding:"required"`
	StageID       *string `json:"stageId"`
	TaskID        *string `json:"taskId"`
	Action        string  `json:"action" binding:"required"`
	Actor         string  `json:"actor" binding:"required"`
	Outcome       string  `json:"outcome" binding:"required"`
	DurationMS    *int64  `json:"durationMs"`
	InputSummary  *string `json:"inputSummary"`
	OutputSummary *string `json:"outputSummary"`
	ErrorMessage  *string `json:"errorMessage"`
	Metadata      *string `json:"metadata"`
}

// AuditLogBatchRequest is the request body for batch recording audit events.
type AuditLogBatchRequest struct {
	Logs []AuditLogRequest `json:"logs" binding:"required"`
}

// AuditLogQuery holds filter parameters for querying audit logs.
type AuditLogQuery struct {
	TenantID  string    `json:"-"`
	RunID     *string   `json:"runId"`
	StageID   *string   `json:"stageId"`
	TaskID    *string   `json:"taskId"`
	Action    *string   `json:"action"`
	Actor     *string   `json:"actor"`
	Outcome   *string   `json:"outcome"`
	StartTime *time.Time `json:"startTime"`
	EndTime   *time.Time `json:"endTime"`
	Limit     int       `json:"limit"`
	Offset    int       `json:"offset"`
}

// AuditTrailResponse represents the full audit trail for a pipeline run.
type AuditTrailResponse struct {
	RunID     string       `json:"runId"`
	TenantID  string       `json:"tenantId"`
	TotalLogs int          `json:"totalLogs"`
	Logs      []AuditLog   `json:"logs"`
}

// CleanupRequest is the request body for the cleanup endpoint.
type CleanupRequest struct {
	RetentionDays *int `json:"retentionDays"`
}
