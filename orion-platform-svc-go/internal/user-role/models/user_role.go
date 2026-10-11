package models

import (
	"time"
)

// UserRole 表示一条用户-角色授权记录。
// 与 capability.user_roles (JSON 数组) 共存：本表支持过期、来源追踪、软删。
//
// 参见 Migration 699_create_user_role.sql。
type UserRole struct {
	ID         string     `db:"id" json:"id"`
	TenantID   string     `db:"tenant_id" json:"tenant_id"`
	UserID     string     `db:"user_id" json:"user_id"`
	Role       string     `db:"role" json:"role"`
	Source     string     `db:"source" json:"source"`
	GrantedBy  *string    `db:"granted_by" json:"granted_by,omitempty"`
	GrantedAt  time.Time  `db:"granted_at" json:"granted_at"`
	ExpiresAt  *time.Time `db:"expires_at" json:"expires_at,omitempty"`
	RevokedAt  *time.Time `db:"revoked_at" json:"revoked_at,omitempty"`
	Status     string     `db:"status" json:"status"`
	Reason     *string    `db:"reason" json:"reason,omitempty"`
	CreatedAt  time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt  time.Time  `db:"updated_at" json:"updated_at"`
}

// 状态枚举。
const (
	StatusActive  = "active"
	StatusRevoked = "revoked"
	StatusExpired = "expired"
)

// 来源枚举。
const (
	SourceManual          = "manual"
	SourceOncallScheduling = "oncall_scheduling"
	SourceAPI             = "api"
	SourceImport          = "import:capability"
)

// GrantRequest 是 POST /api/v1/user-roles 的请求体。
type GrantRequest struct {
	UserID    string     `json:"user_id" binding:"required"`
	Role      string     `json:"role" binding:"required"`
	TenantID  string     `json:"tenant_id"`
	GrantedBy *string    `json:"granted_by,omitempty"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	Reason    *string    `json:"reason,omitempty"`
	Source    string     `json:"source,omitempty"`
}

// BatchGrantRequest 是 POST /api/v1/users/{user_id}/roles 的请求体。
type BatchGrantRequest struct {
	Grants []BatchGrantItem `json:"grants" binding:"required,min=1"`
}

type BatchGrantItem struct {
	Role      string     `json:"role" binding:"required"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
}

// PatchRequest 是 PATCH /api/v1/user-roles/{id} 的请求体。
type PatchRequest struct {
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	Reason    *string    `json:"reason,omitempty"`
	Status    *string    `json:"status,omitempty"`
}

// ListFilter 用于查询参数。
type ListFilter struct {
	UserID *string
	Role   *string
	Status *string
}

// PageResult 通用分页响应包装。
type PageResult struct {
	Data       []UserRole `json:"data"`
	Page       int        `json:"page"`
	PageSize   int        `json:"page_size"`
	Total      int        `json:"total"`
	HasMore    bool       `json:"has_more"`
}
