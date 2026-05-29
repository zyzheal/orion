package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

type NotificationStatus string
const (
	StatusPending   NotificationStatus = "pending"
	StatusSent      NotificationStatus = "sent"
	StatusFailed    NotificationStatus = "failed"
	StatusRead      NotificationStatus = "read"
)

type ChannelType string
const (
	ChannelEmail   ChannelType = "email"
	ChannelSlack   ChannelType = "slack"
	ChannelWebhook ChannelType = "webhook"
)

type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil { return nil, nil }
	return json.Marshal(j)
}
func (j *JSONB) Scan(src interface{}) error {
	if src == nil { *j = nil; return nil }
	switch v := src.(type) {
	case []byte: return json.Unmarshal(v, j)
	case string: return json.Unmarshal([]byte(v), j)
	default: return fmt.Errorf("cannot scan %T into JSONB", src)
	}
}

type Notification struct {
	ID        string             `db:"id" json:"id"`
	TenantID  string             `db:"tenant_id" json:"tenant_id"`
	Channel   ChannelType        `db:"channel" json:"channel"`
	Recipient string             `db:"recipient" json:"recipient"`
	Subject   string             `db:"subject" json:"subject"`
	Body      string             `db:"body" json:"body"`
	Status    NotificationStatus `db:"status" json:"status"`
	Metadata  JSONB              `db:"metadata" json:"metadata"`
	CreatedAt time.Time          `db:"created_at" json:"created_at"`
}

type NotificationTemplate struct {
	ID        string      `db:"id" json:"id"`
	TenantID  string      `db:"tenant_id" json:"tenant_id"`
	Name      string      `db:"name" json:"name"`
	Channel   ChannelType `db:"channel" json:"channel"`
	Subject   string      `db:"subject" json:"subject"`
	Body      string      `db:"body" json:"body"`
	CreatedAt time.Time   `db:"created_at" json:"created_at"`
}

type NotificationChannel struct {
	ID        string      `db:"id" json:"id"`
	TenantID  string      `db:"tenant_id" json:"tenant_id"`
	Name      string      `db:"name" json:"name"`
	Type      ChannelType `db:"type" json:"type"`
	Config    JSONB       `db:"config" json:"config"`
	Enabled   bool        `db:"enabled" json:"enabled"`
	CreatedAt time.Time   `db:"created_at" json:"created_at"`
}

type CreateNotificationRequest struct {
	Channel   ChannelType       `json:"channel" binding:"required"`
	Recipient string            `json:"recipient" binding:"required"`
	Subject   string            `json:"subject"`
	Body      string            `json:"body" binding:"required"`
	Metadata  map[string]interface{} `json:"metadata"`
}

type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}
func (p *PaginatedRequest) Offset() int { if p.Page <= 0 { p.Page = 1 }; if p.PageSize <= 0 { p.PageSize = 20 }; return (p.Page - 1) * p.PageSize }
func (p *PaginatedRequest) Limit() int { if p.PageSize <= 0 { p.PageSize = 20 }; if p.PageSize > 100 { p.PageSize = 100 }; return p.PageSize }
