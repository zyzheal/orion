package models

import "time"

// NotificationChannel represents a notification channel (email, sms, webhook, etc.)
type NotificationChannel struct {
	ID        string            `db:"id" json:"id"`
	TenantID  string            `db:"tenant_id" json:"tenant_id"`
	Type      string            `db:"type" json:"type"` // email|sms|webhook|dingtalk|wechat|slack
	Name      string            `db:"name" json:"name"`
	Enabled   bool              `db:"enabled" json:"enabled"`
	Config    map[string]string `db:"config" json:"config"`
	Secret    string            `db:"secret" json:"secret"`
	Retry     int               `db:"retry" json:"retry"`
	CreatedAt time.Time         `db:"created_at" json:"createdAt"`
}

// CreateChannelRequest is the request body for creating a notification channel.
type CreateChannelRequest struct {
	Type    string            `json:"type" binding:"required"`
	Name    string            `json:"name" binding:"required"`
	Enabled bool              `json:"enabled"`
	Config  map[string]string `json:"config"`
	Secret  string            `json:"secret"`
	Retry   int               `json:"retry"`
}

// UpdateChannelRequest is the request body for updating a notification channel.
type UpdateChannelRequest struct {
	Type    *string           `json:"type"`
	Name    *string           `json:"name"`
	Enabled *bool             `json:"enabled"`
	Config  map[string]string `json:"config"`
	Secret  *string           `json:"secret"`
	Retry   *int              `json:"retry"`
}

// ChannelFilter is used for listing channels.
type ChannelFilter struct {
	Type    *string `json:"type"`
	Enabled *bool   `json:"enabled"`
	Limit   int     `json:"limit"`
	Offset  int     `json:"offset"`
}