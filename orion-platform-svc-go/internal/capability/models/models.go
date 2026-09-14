package models

import "time"

type Capability struct {
	ID       string `json:"id" db:"id"`
	TenantID string `json:"tenant_id" db:"tenant_id"`
	Name     string `json:"name" db:"name"`
	// ParentCapabilityID is nil for a root capability. It is a pointer because
	// the column is nullable: a plain string cannot hold NULL and scanning a
	// NULL into it is a hard error.
	ParentCapabilityID *string   `json:"parent_capability_id,omitempty" db:"parent_capability_id"`
	CreatedAt          time.Time `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time `json:"updated_at" db:"updated_at"`
}

type CreateCapabilityRequest struct {
	Name string `json:"name" binding:"required"`
}

type UpdateCapabilityRequest struct {
	Name *string `json:"name"`
}

// --- Permission check ---

type CheckPermissionRequest struct {
	UserID       string   `json:"user_id" binding:"required"`
	CapabilityID string   `json:"capability_id" binding:"required"`
	Environment  string   `json:"environment"`
	Command      string   `json:"command"`
	Action       string   `json:"action"`
	UserRoles    []string `json:"user_roles"`
}

type CheckPermissionResult struct {
	Allowed      bool       `json:"allowed"`
	CapabilityID string     `json:"capability_id,omitempty"`
	GrantedVia   string     `json:"granted_via,omitempty"` // role, direct, temporary
	ExpiresAt    *time.Time `json:"expires_at,omitempty"`
}

// --- Temporary permissions ---

type GrantTemporaryRequest struct {
	TenantID          string `json:"tenant_id"`
	UserID            string `json:"user_id" binding:"required"`
	CapabilityID      string `json:"capability_id" binding:"required"`
	EnvironmentSuffix string `json:"environment_suffix"`
	Reason            string `json:"reason" binding:"required"`
	GrantedBy         string `json:"granted_by"`
	ExpiresInHours    int    `json:"expires_in_hours" binding:"required"`
}

// TemporaryPermission maps one row of temporary_permissions.
//
// ID is a string because the column is UUID: with an int field a legitimate
// request fails in the driver with "invalid input syntax for type uuid"
// before any SQL is sent. TenantID is here because the table has tenant_id
// NOT NULL -- without the field a wildcard select dies in sqlx safe mode on
// "missing destination name tenant_id" before any row is returned.
type TemporaryPermission struct {
	ID                string     `json:"id" db:"id"`
	TenantID          string     `json:"tenant_id" db:"tenant_id"`
	UserID            string     `json:"user_id" db:"user_id"`
	CapabilityID      string     `json:"capability_id" db:"capability_id"`
	EnvironmentSuffix string     `json:"environment_suffix" db:"environment_suffix"`
	Reason            string     `json:"reason" db:"reason"`
	GrantedBy         string     `json:"granted_by" db:"granted_by"`
	ExpiresAt         time.Time  `json:"expires_at" db:"expires_at"`
	GrantedAt         time.Time  `json:"granted_at" db:"granted_at"`
	RevokedAt         *time.Time `json:"revoked_at,omitempty" db:"revoked_at"`
	CreatedAt         time.Time  `json:"created_at" db:"created_at"`
}

// --- Permission audit ---

// AuditLog maps one row of capability_audit_logs, the table that actually has
// target_type / target_id / details. permission_audit_logs does not have those
// three columns, so InsertAuditLog never wrote a row at all and this module's
// audit trail did not exist. ID is a string: the column is UUID.
type AuditLog struct {
	ID         string    `json:"id" db:"id"`
	TenantID   string    `json:"tenant_id" db:"tenant_id"`
	Action     string    `json:"action" db:"action"`
	UserID     string    `json:"user_id" db:"user_id"`
	TargetType string    `json:"target_type" db:"target_type"`
	TargetID   string    `json:"target_id" db:"target_id"`
	Details    string    `json:"details" db:"details"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

type AuditLogQuery struct {
	UserID       *string `json:"user_id"`
	CapabilityID *string `json:"capability_id"`
	TargetID     string  `json:"target_id"`
	Action       *string `json:"action"`
	From         string  `json:"from"`
	To           string  `json:"to"`
	Limit        *int    `json:"limit"`
	Offset       *int    `json:"offset"`
}

// --- Permission request ---

type CreatePermissionRequestBody struct {
	UserID        string `json:"user_id"`
	Reason        string `json:"reason" binding:"required"`
	CapabilityID  string `json:"capability_id"`
	DurationHours *int   `json:"duration_hours"`
}

// PermissionRequest maps one row of permission_requests.
//
// ID is a string because the column is UUID, and ApproverID / RejectedBy /
// RejectedReason are pointers because those columns are nullable: a request
// that has been neither approved nor rejected must be distinguishable from
// one that was explicitly approved by an empty string.
type PermissionRequest struct {
	ID                string    `json:"id" db:"id"`
	TenantID          string    `json:"tenant_id" db:"tenant_id"`
	UserID            string    `json:"user_id" db:"user_id"`
	CapabilityID      string    `json:"capability_id" db:"capability_id"`
	Status            string    `json:"status" db:"status"` // pending, approved, rejected, granted
	Reason            string    `json:"reason" db:"reason"`
	ApproverID        *string   `json:"approver_id,omitempty" db:"approver_id"`
	RejectedBy        *string   `json:"rejected_by,omitempty" db:"rejected_by"`
	RejectedReason    *string   `json:"rejected_reason,omitempty" db:"rejected_reason"`
	DurationHours     *int      `json:"duration_hours,omitempty" db:"duration_hours"`
	EnvironmentSuffix string    `json:"environment_suffix" db:"environment_suffix"`
	CreatedAt         time.Time `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time `json:"updated_at" db:"updated_at"`
}

type CleanupResult struct {
	Deleted int `json:"deleted"`
}

// --- Simplified permission request API ---

type RequestPermissionBody struct {
	UserID            string `json:"user_id"`
	CapabilityID      string `json:"capability_id" binding:"required"`
	Reason            string `json:"reason" binding:"required"`
	DurationHours     int    `json:"duration_hours"`
	EnvironmentSuffix string `json:"environment_suffix"`
}

type GrantSimplifiedRequest struct {
	TenantID          string `json:"tenant_id"`
	UserID            string `json:"user_id" binding:"required"`
	CapabilityID      string `json:"capability_id" binding:"required"`
	EnvironmentSuffix string `json:"environment_suffix"`
	Reason            string `json:"reason" binding:"required"`
	GrantorId         string `json:"grantor_id" binding:"required"`
	DurationHours     int    `json:"duration_hours" binding:"required"`
}

// --- Additional request/response models ---

type GrantToRoleRequest struct {
	RoleName string `json:"role_name" binding:"required"`
}

type GrantToUserRequest struct {
	UserID         string `json:"user_id" binding:"required"`
	ExpiresInHours *int   `json:"expires_in_hours"`
}

type MapCommandRequest struct {
	CapabilityID      string  `json:"capability_id" binding:"required"`
	CommandName       string  `json:"command_name" binding:"required"`
	CommandAction     string  `json:"command_action" binding:"required"`
	EnvironmentSuffix *string `json:"environment_suffix"`
}

type GetCapabilityForCommandResult struct {
	CapabilityID *string `json:"capability_id"`
}

type ApproveRequestBody struct {
	TenantID      string   `json:"tenant_id"`
	ApproverRoles []string `json:"approver_roles"`
}

type RejectRequestBody struct {
	Reason string `json:"reason"`
}

type UserEffectiveCapabilities struct {
	UserID       string   `json:"user_id"`
	Capabilities []string `json:"capabilities"`
}
