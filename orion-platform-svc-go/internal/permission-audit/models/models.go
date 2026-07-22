package models

import "time"

// PermissionAuditLog represents a permission audit log entry.
type PermissionAuditLog struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	UserID      string    `db:"user_id" json:"user_id"`
	Action      string    `db:"action" json:"action"` // grant|revoke|check|deny
	Resource    string    `db:"resource" json:"resource"`
	Permission  string    `db:"permission" json:"permission"`
	Result      string    `db:"result" json:"result"` // allowed|denied
	IPAddress   string    `db:"ip_address" json:"ip_address"`
	UserAgent   string    `db:"user_agent" json:"user_agent"`
	Context     map[string]string `db:"context" json:"context"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

// CreateAuditLogRequest is the request body for creating an audit log.
type CreateAuditLogRequest struct {
	UserID     string            `json:"userId" binding:"required"`
	Action     string            `json:"action" binding:"required"`
	Resource   string            `json:"resource" binding:"required"`
	Permission string            `json:"permission" binding:"required"`
	Result     string            `json:"result"`
	Context    map[string]string `json:"context"`
}

// AuditLogFilter is used for listing audit logs.
type AuditLogFilter struct {
	UserID   *string `json:"userId"`
	Action   *string `json:"action"`
	Resource *string `json:"resource"`
	Result   *string `json:"result"`
	Limit    int     `json:"limit"`
	Offset   int     `json:"offset"`
}
