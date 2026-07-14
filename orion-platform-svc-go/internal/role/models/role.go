package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// PermissionKey is a string-based permission identifier (e.g. "pipeline:read", "user:write").
type PermissionKey string

// Permission is a granular permission entry: resource + action.
type Permission struct {
	Resource string `json:"resource"`
	Action   string `json:"action"`
}

// Permissions is a slice of Permission backed by a JSONB column.
type Permissions []Permission

// Value marshals a slice of Permission into a JSONB-compatible string.
func (p Permissions) Value() (driver.Value, error) {
	if p == nil {
		return "[]", nil
	}
	return json.Marshal(p)
}

// Scan unmarshals a JSONB column into Permissions.
func (p *Permissions) Scan(src interface{}) error {
	if src == nil {
		*p = Permissions{}
		return nil
	}
	var v []Permission
	switch s := src.(type) {
	case []byte:
		return json.Unmarshal(s, &v)
	case string:
		return json.Unmarshal([]byte(s), &v)
	default:
		return fmt.Errorf("cannot scan %T into Permissions", src)
	}
	*p = v
	return nil
}

// RoleStatus represents the lifecycle state of a role.
type RoleStatus string

const (
	RoleStatusActive   RoleStatus = "active"
	RoleStatusInactive RoleStatus = "inactive"
)

// Role is the core domain model persisted in PostgreSQL.
type Role struct {
	ID          string        `db:"id" json:"id"`
	Name        string        `db:"name" json:"name"`
	Description string        `db:"description" json:"description"`
	Permissions Permissions   `db:"permissions" json:"permissions"`
	TenantID    string        `db:"tenant_id" json:"tenant_id"`
	Status      RoleStatus    `db:"status" json:"status"`
	CreatedAt   time.Time     `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time     `db:"updated_at" json:"updated_at"`
}

// CreateRoleRequest is the input for creating a new role.
type CreateRoleRequest struct {
	Name            string       `json:"name" binding:"required"`
	Description     string       `json:"description"`
	Permissions     []Permission `json:"permissions"`
}

// UpdateRoleRequest is the input for updating an existing role (partial update).
type UpdateRoleRequest struct {
	Name        *string       `json:"name"`
	Description *string       `json:"description"`
	Status      *RoleStatus   `json:"status"`
}

// SetPermissionsRequest is the input for setting permissions on a role.
type SetPermissionsRequest struct {
	Permissions []Permission `json:"permissions" binding:"required"`
}

// ListFilter carries optional filter criteria for listing roles.
type ListFilter struct {
	Status *RoleStatus
}
