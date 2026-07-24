package models

import "time"

// Permission represents a permission entity
type Permission struct {
	ID        string `json:"id" db:"id"`
	Name      string `json:"name" db:"name"`
	Code      string `json:"code" db:"code"`
	Resource  string `json:"resource" db:"resource"`
	Action    string `json:"action" db:"action"`
	Desc      string `json:"desc" db:"desc"`
	TenantID  string `json:"tenant_id" db:"tenant_id"`
	UserID    string `json:"user_id" db:"user_id"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// CreatePermissionRequest for creating a permission
type CreatePermissionRequest struct {
	Name     string `json:"name" binding:"required"`
	Code     string `json:"code" binding:"required"`
	Resource string `json:"resource" binding:"required"`
	Action   string `json:"action" binding:"required"`
	Desc     string `json:"desc"`
}

// UpdatePermissionRequest for updating a permission
type UpdatePermissionRequest struct {
	Name     *string `json:"name"`
	Code     *string `json:"code"`
	Resource *string `json:"resource"`
	Action   *string `json:"action"`
	Desc     *string `json:"desc"`
}

// ListFilter for filtering permissions
type ListFilter struct {
	Resource *string `json:"resource"`
	Action   *string `json:"action"`
}
