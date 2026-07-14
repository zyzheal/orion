package models

import "time"

type SSOProvider struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	Name      string    `db:"name" json:"name"`
	Type      string    `db:"type" json:"type"` // oidc|ldap|wechat|dinger
	Enabled   bool      `db:"enabled" json:"enabled"`
	Config    map[string]string `db:"config" json:"config"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
}

type CreateSSOProviderRequest struct {
	Name    string            `json:"name" binding:"required"`
	Type    string            `json:"type" binding:"required"`
	Config  map[string]string `json:"config"`
	Enabled bool              `json:"enabled"`
}

type UpdateSSOProviderRequest struct {
	Name    *string           `json:"name"`
	Type    *string           `json:"type"`
	Config  map[string]string `json:"config"`
	Enabled *bool             `json:"enabled"`
}

type SSOProviderFilter struct {
	Type    *string `json:"type"`
	Enabled *bool   `json:"enabled"`
}
