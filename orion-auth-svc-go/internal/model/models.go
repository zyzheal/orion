package model

import (
	"database/sql"
	"time"
)

type User struct {
	ID           string         `db:"id" json:"id"`
	TenantID     string         `db:"tenant_id" json:"tenant_id"`
	Username     string         `db:"username" json:"username"`
	Email        string         `db:"email" json:"email"`
	PasswordHash string         `db:"password_hash" json:"-"`
	Status       string         `db:"status" json:"status"`
	LastLoginAt  *time.Time     `db:"last_login_at" json:"last_login_at,omitempty"`
	CreatedAt    time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time      `db:"updated_at" json:"updated_at"`
}

type RefreshToken struct {
	ID         string     `db:"id" json:"id"`
	UserID     string     `db:"user_id" json:"user_id"`
	TokenHash  string     `db:"token_hash" json:"-"`
	ExpiresAt  time.Time  `db:"expires_at" json:"expires_at"`
	RevokedAt  *time.Time `db:"revoked_at" json:"revoked_at,omitempty"`
	CreatedAt  time.Time  `db:"created_at" json:"created_at"`
}

type Permission struct {
	ID          string `db:"id" json:"id"`
	TenantID    string `db:"tenant_id" json:"tenant_id"`
	Resource    string `db:"resource" json:"resource"`
	Action      string `db:"action" json:"action"`
	Description string `db:"description" json:"description"`
}

type Role struct {
	ID          string `db:"id" json:"id"`
	TenantID    string `db:"tenant_id" json:"tenant_id"`
	Name        string `db:"name" json:"name"`
	Description string `db:"description" json:"description"`
}

type LoginAttempt struct {
	ID        string     `db:"id" json:"id"`
	TenantID  string     `db:"tenant_id" json:"tenant_id"`
	Username  string     `db:"username" json:"username"`
	Success   bool       `db:"success" json:"success"`
	IPAddress string     `db:"ip_address" json:"ip_address"`
	UserAgent string     `db:"user_agent" json:"user_agent"`
	CreatedAt time.Time  `db:"created_at" json:"created_at"`
}

type MfaConfig struct {
	ID        string     `db:"id" json:"id"`
	UserID    string     `db:"user_id" json:"user_id"`
	TenantID  string     `db:"tenant_id" json:"tenant_id"`
	Type      string     `db:"type" json:"type"`
	Secret    string     `db:"secret" json:"-"`
	Enabled   bool       `db:"enabled" json:"enabled"`
	CreatedAt time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt time.Time  `db:"updated_at" json:"updated_at"`
}

type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}

type AuditLog struct {
	ID         string         `db:"id" json:"id"`
	TenantID   string         `db:"tenant_id" json:"tenant_id"`
	ActorID    string         `db:"actor_id" json:"actor_id"`
	Action     string         `db:"action" json:"action"`
	Resource   string         `db:"resource" json:"resource"`
	ResourceID string         `db:"resource_id" json:"resource_id"`
	Details    sql.NullString `db:"details" json:"details,omitempty"`
	IPAddress  string         `db:"ip_address" json:"ip_address"`
	CreatedAt  time.Time      `db:"created_at" json:"created_at"`
}
