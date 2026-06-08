package models

import (
	"database/sql"
	"errors"
	"time"
)

// Sentinel errors for tool operations.
var ErrToolNotFound = errors.New("tool not found")

// Tool represents a registered tool in the tool center.
type Tool struct {
	ID          string         `db:"id" json:"id"`
	TenantID    string         `db:"tenant_id" json:"tenant_id"`
	Name        string         `db:"name" json:"name"`
	DisplayName string         `db:"display_name" json:"display_name"`
	Description string         `db:"description" json:"description"`
	Category    string         `db:"category" json:"category"`
	Type        string         `db:"type" json:"type"` // cli, api, script, container
	Version     string         `db:"version" json:"version"`
	Config      string         `db:"config" json:"config"` // JSON
	Endpoint    string         `db:"endpoint" json:"endpoint"`
	AuthType    string         `db:"auth_type" json:"auth_type"` // none, api_key, oauth2, basic
	AuthConfig  string         `db:"auth_config" json:"auth_config"` // JSON
	Tags        string         `db:"tags" json:"tags"` // JSON array
	Status      string         `db:"status" json:"status"` // active, disabled, deprecated
	CreatedBy   string         `db:"created_by" json:"created_by"`
	CreatedAt   time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time      `db:"updated_at" json:"updated_at"`
	DeprecatedAt sql.NullTime  `db:"deprecated_at" json:"deprecated_at,omitempty"`
}

// ToolVersion represents a version history entry for a tool.
type ToolVersion struct {
	ID        string    `db:"id" json:"id"`
	ToolID    string    `db:"tool_id" json:"tool_id"`
	Version   string    `db:"version" json:"version"`
	Config    string    `db:"config" json:"config"` // JSON
	Changelog string    `db:"changelog" json:"changelog"`
	CreatedBy string    `db:"created_by" json:"created_by"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// ToolCategory represents a tool category.
type ToolCategory struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	DisplayName string    `db:"display_name" json:"display_name"`
	Description string    `db:"description" json:"description"`
	Icon        string    `db:"icon" json:"icon"`
	SortOrder   int       `db:"sort_order" json:"sort_order"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

// ToolInvocation represents a tool invocation record.
type ToolInvocation struct {
	ID        string         `db:"id" json:"id"`
	ToolID    string         `db:"tool_id" json:"tool_id"`
	TenantID  string         `db:"tenant_id" json:"tenant_id"`
	Input     string         `db:"input" json:"input"` // JSON
	Output    string         `db:"output" json:"output"` // JSON
	Status    string         `db:"status" json:"status"` // success, failed, timeout
	Error     sql.NullString `db:"error" json:"error,omitempty"`
	Duration  int64          `db:"duration" json:"duration"` // milliseconds
	CalledBy  string         `db:"called_by" json:"called_by"`
	CreatedAt time.Time      `db:"created_at" json:"created_at"`
}

// CreateToolRequest is the request body for creating a tool.
type CreateToolRequest struct {
	Name        string `json:"name" binding:"required"`
	DisplayName string `json:"display_name"`
	Description string `json:"description"`
	Category    string `json:"category" binding:"required"`
	Type        string `json:"type" binding:"required,oneof=cli api script container"`
	Version     string `json:"version" binding:"required"`
	Config      string `json:"config"`
	Endpoint    string `json:"endpoint"`
	AuthType    string `json:"auth_type" binding:"omitempty,oneof=none api_key oauth2 basic"`
	AuthConfig  string `json:"auth_config"`
	Tags        string `json:"tags"`
}

// UpdateToolRequest is the request body for updating a tool.
type UpdateToolRequest struct {
	DisplayName *string `json:"display_name"`
	Description *string `json:"description"`
	Category    *string `json:"category"`
	Version     *string `json:"version"`
	Config      *string `json:"config"`
	Endpoint    *string `json:"endpoint"`
	AuthType    *string `json:"auth_type"`
	AuthConfig  *string `json:"auth_config"`
	Tags        *string `json:"tags"`
	Status      *string `json:"status" binding:"omitempty,oneof=active disabled deprecated"`
}

// InvokeToolRequest is the request body for invoking a tool.
type InvokeToolRequest struct {
	Input string `json:"input" binding:"required"` // JSON input
}

// ToolListParams contains query parameters for listing tools.
type ToolListParams struct {
	Category string `form:"category"`
	Type     string `form:"type"`
	Status   string `form:"status"`
	Search   string `form:"search"`
	Page     int    `form:"page,default=1"`
	PageSize int    `form:"page_size,default=20"`
}
