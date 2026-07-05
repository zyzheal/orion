package model

import (
	"database/sql"
	"time"
)

type Event struct {
	ID          string         `db:"id" json:"id"`
	TenantID    string         `db:"tenant_id" json:"tenant_id"`
	Type        string         `db:"type" json:"type"`
	Source      string         `db:"source" json:"source"`
	Payload     sql.NullString `db:"payload" json:"payload,omitempty"`
	Priority    int            `db:"priority" json:"priority"`
	PublishedAt *time.Time     `db:"published_at" json:"published_at,omitempty"`
	CreatedAt   time.Time      `db:"created_at" json:"created_at"`
}

type Subscription struct {
	ID          string     `db:"id" json:"id"`
	TenantID    string     `db:"tenant_id" json:"tenant_id"`
	Name        string     `db:"name" json:"name"`
	EventTypes  []string   `db:"-" json:"event_types"`
	CallbackURL string     `db:"callback_url" json:"callback_url"`
	Secret      string     `db:"secret" json:"-"`
	Enabled     bool       `db:"enabled" json:"enabled"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time  `db:"updated_at" json:"updated_at"`
}

type EventDelivery struct {
	ID            string     `db:"id" json:"id"`
	EventID       string     `db:"event_id" json:"event_id"`
	SubscriptionID string    `db:"subscription_id" json:"subscription_id"`
	Status        string     `db:"status" json:"status"`
	ResponseCode  *int       `db:"response_code" json:"response_code,omitempty"`
	ResponseBody  sql.NullString `db:"response_body" json:"response_body,omitempty"`
	DeliveredAt   *time.Time `db:"delivered_at" json:"delivered_at,omitempty"`
	CreatedAt     time.Time  `db:"created_at" json:"created_at"`
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
