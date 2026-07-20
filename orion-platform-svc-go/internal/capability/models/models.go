package models

import "time"

type Capability struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
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

type TemporaryPermission struct {
	ID                int        `json:"id" db:"id"`
	UserID            string     `json:"user_id" db:"user_id"`
	CapabilityID      string     `json:"capability_id" db:"capability_id"`
	EnvironmentSuffix string     `json:"environment_suffix" db:"environment_suffix"`
	Reason            string     `json:"reason" db:"reason"`
	GrantedBy         string     `json:"granted_by" db:"granted_by"`
	ExpiresAt         time.Time  `json:"expires_at" db:"expires_at"`
	GrantedAt         time.Time  `json:"granted_at" db:"granted_at"`
	RevokedAt         *time.Time `json:"revoked_at,omitempty" db:"revoked_at"`
}

// --- Permission audit ---

type AuditLog struct {
	ID         int       `json:"id" db:"id"`
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

type PermissionRequest struct {
	ID                int       `json:"id" db:"id"`
	TenantID          string    `json:"tenant_id" db:"tenant_id"`
	UserID            string    `json:"user_id" db:"user_id"`
	CapabilityID      string    `json:"capability_id" db:"capability_id"`
	Status            string    `json:"status" db:"status"` // pending, approved, rejected, granted
	Reason            string    `json:"reason" db:"reason"`
	ApproverID        string    `json:"approver_id" db:"approver_id"`
	DurationHours     int       `json:"duration_hours" db:"duration_hours"`
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
