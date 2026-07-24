package models

import "time"

// Role represents an RBAC role with tenant isolation.
type Role struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

// CreateRoleRequest represents a role creation request.
type CreateRoleRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}

// UpdateRoleRequest represents a role update request.
type UpdateRoleRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}

// Permission represents an RBAC permission.
type Permission struct {
	ID          string    `db:"id" json:"id"`
	Resource    string    `db:"resource" json:"resource"`
	Action      string    `db:"action" json:"action"`
	Description string    `db:"description" json:"description"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

// RolePermission represents the many-to-many relationship between roles and permissions.
type RolePermission struct {
	ID           int64  `db:"id" json:"id"`
	RoleID       string `db:"role_id" json:"role_id"`
	PermissionID string `db:"permission_id" json:"permission_id"`
}

// RoleWithPermissions combines a role with its permissions.
type RoleWithPermissions struct {
	Role
	Permissions []Permission `json:"permissions,omitempty"`
}

// PermissionsMap is a map of role_id -> permissions for the frontend sync endpoint.
type PermissionsMap map[string][]Permission
