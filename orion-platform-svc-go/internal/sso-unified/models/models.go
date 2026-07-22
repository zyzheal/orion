package models

import "time"

type SSOConfig struct {
	ID        string            `db:"id" json:"id"`
	TenantID  string            `db:"tenant_id" json:"tenant_id"`
	Provider  string            `db:"provider" json:"provider"` // oidc|ldap|wechat|dinger
	Enabled   bool              `db:"enabled" json:"enabled"`
	Config    map[string]string `db:"config" json:"config"`
	CreatedAt time.Time         `db:"created_at" json:"createdAt"`
}

type CreateSSOConfigRequest struct {
	Provider string            `json:"provider" binding:"required"`
	Enabled  bool              `json:"enabled"`
	Config   map[string]string `json:"config"`
}

type UpdateSSOConfigRequest struct {
	Enabled *bool             `json:"enabled"`
	Config  map[string]string `json:"config"`
}
