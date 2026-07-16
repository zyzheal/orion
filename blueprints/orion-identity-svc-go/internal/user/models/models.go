package models

import "time"

// User represents a user entity with tenant isolation.
type User struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Email       string    `db:"email" json:"email"`
	DisplayName string    `db:"display_name" json:"display_name"`
	Role        string    `db:"role" json:"role"`
	Status      string    `db:"status" json:"status"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

// UpdateUserRequest represents a user update request.
type UpdateUserRequest struct {
	DisplayName string `json:"display_name"`
	Role        string `json:"role"`
	Status      string `json:"status" binding:"oneof=active suspended deleted"`
}

// Role represents an RBAC role.
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

// CreatePermissionRequest represents a permission creation request.
type CreatePermissionRequest struct {
	Resource    string `json:"resource" binding:"required"`
	Action      string `json:"action" binding:"required"`
	Description string `json:"description"`
}

// UpdatePermissionRequest represents a permission update request.
type UpdatePermissionRequest struct {
	Resource    string `json:"resource" binding:"required"`
	Action      string `json:"action" binding:"required"`
	Description string `json:"description"`
}

// UserRole represents the many-to-many relationship between users and roles.
type UserRole struct {
	ID         int64     `db:"id" json:"id"`
	UserID     string    `db:"user_id" json:"user_id"`
	RoleID     string    `db:"role_id" json:"role_id"`
	Assignee   string    `db:"assigned_by" json:"assigned_by"`
	AssignedAt time.Time `db:"assigned_at" json:"assigned_at"`
}

// RolePermission represents the many-to-many relationship between roles and permissions.
type RolePermission struct {
	ID           int64     `db:"id" json:"id"`
	RoleID       string    `db:"role_id" json:"role_id"`
	PermissionID string    `db:"permission_id" json:"permission_id"`
}
