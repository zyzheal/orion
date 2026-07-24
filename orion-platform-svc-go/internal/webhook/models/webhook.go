package models

import "time"

// Webhook is the core domain model persisted in PostgreSQL.
type Webhook struct {
	ID                 string     `db:"id" json:"id"`
	TenantID           string     `db:"tenant_id" json:"tenant_id"`
	UserID             string     `db:"user_id" json:"user_id"`
	Name               string     `db:"name" json:"name"`
	URL                string     `db:"url" json:"url"`
	Method             string     `db:"method" json:"method"`
	EventType          string     `db:"event_type" json:"event_type"`
	Secret             string     `db:"secret" json:"secret"`
	Headers            string     `db:"headers" json:"headers"`
	BodyTemplate       string     `db:"body_template" json:"body_template"`
	Enabled            bool       `db:"enabled" json:"enabled"`
	MaxRetries         int        `db:"max_retries" json:"max_retries"`
	RetryInterval      int        `db:"retry_interval" json:"retry_interval"`
	Timeout            int        `db:"timeout" json:"timeout"`
	LastTriggeredAt    *time.Time `db:"last_triggered_at" json:"last_triggered_at"`
	LastDeliveryStatus string     `db:"last_delivery_status" json:"last_delivery_status"`
	CreatedAt          time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt          time.Time  `db:"updated_at" json:"updated_at"`
}

// WebhookDelivery records a single delivery attempt for a webhook.
type WebhookDelivery struct {
	ID           string     `db:"id" json:"id"`
	WebhookID    string     `db:"webhook_id" json:"webhook_id"`
	URL          string     `db:"url" json:"url"`
	Status       string     `db:"status" json:"status"`
	HTTPStatus   int        `db:"http_status" json:"http_status"`
	ResponseBody string     `db:"response_body" json:"response_body"`
	ErrorMessage string     `db:"error_message" json:"error_message"`
	Attempt      int        `db:"attempt" json:"attempt"`
	RetryAfter   int        `db:"retry_after" json:"retry_after"`
	CreatedAt    time.Time  `db:"created_at" json:"created_at"`
	TriggeredAt  *time.Time `db:"triggered_at" json:"triggered_at"`
	CompletedAt  *time.Time `db:"completed_at" json:"completed_at"`
}

// CreateWebhookRequest is the input for creating a new webhook.
type CreateWebhookRequest struct {
	Name          string `json:"name" binding:"required"`
	URL           string `json:"url" binding:"required"`
	Method        string `json:"method"`
	EventType     string `json:"event_type" binding:"required"`
	Headers       string `json:"headers"`
	BodyTemplate  string `json:"body_template"`
	Enabled       bool   `json:"enabled"`
	MaxRetries    int    `json:"max_retries"`
	RetryInterval int    `json:"retry_interval"`
	Timeout       int    `json:"timeout"`
}

// UpdateWebhookRequest carries optional fields for partial webhook updates.
type UpdateWebhookRequest struct {
	Name          *string `json:"name"`
	URL           *string `json:"url"`
	Method        *string `json:"method"`
	EventType     *string `json:"event_type"`
	Headers       *string `json:"headers"`
	BodyTemplate  *string `json:"body_template"`
	Enabled       *bool   `json:"enabled"`
	MaxRetries    *int    `json:"max_retries"`
	RetryInterval *int    `json:"retry_interval"`
	Timeout       *int    `json:"timeout"`
}

// ListFilter carries optional filter criteria for listing webhooks.
type ListFilter struct {
	EventType *string `json:"event_type"`
	Enabled   *bool   `json:"enabled"`
}

// PaginatedResponse is a generic paginated response.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}
