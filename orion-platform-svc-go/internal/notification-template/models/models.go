package models

import "time"

// NotificationTemplate represents a notification template.
type NotificationTemplate struct {
	ID            string    `db:"id" json:"id"`
	TenantID      string    `db:"tenant_id" json:"tenantId"`
	UserID        string    `db:"user_id" json:"userId"`
	Name          string    `db:"name" json:"name"`
	Description   string    `db:"description" json:"description"`
	Channel       string    `db:"channel" json:"channel"`
	TitleTemplate string    `db:"title_template" json:"titleTemplate"`
	BodyTemplate  string    `db:"body_template" json:"bodyTemplate"`
	Variables     string    `db:"variables" json:"variables"`
	Enabled       bool      `db:"enabled" json:"enabled"`
	CreatedAt     time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt     time.Time `db:"updated_at" json:"updatedAt"`
}

// CreateTemplateRequest is the request body for creating a notification template.
type CreateTemplateRequest struct {
	Name          string `json:"name" binding:"required"`
	Description   string `json:"description"`
	Channel       string `json:"channel"`
	TitleTemplate string `json:"titleTemplate"`
	BodyTemplate  string `json:"bodyTemplate"`
	Variables     string `json:"variables"`
	Enabled       bool   `json:"enabled"`
}

// UpdateTemplateRequest is the request body for updating a notification template.
type UpdateTemplateRequest struct {
	Name          *string `json:"name"`
	Description   *string `json:"description"`
	Channel       *string `json:"channel"`
	TitleTemplate *string `json:"titleTemplate"`
	BodyTemplate  *string `json:"bodyTemplate"`
	Variables     *string `json:"variables"`
	Enabled       *bool   `json:"enabled"`
}

// ListFilter represents optional filters for listing templates.
type ListFilter struct {
	Channel *string
	Enabled *bool
}

// RenderRequest is the request body for rendering a template.
type RenderRequest struct {
	TemplateID string            `json:"template_id"`
	Variables  map[string]string `json:"variables"`
}

// RenderResult is the result of rendering a template.
type RenderResult struct {
	Title string `json:"title"`
	Body  string `json:"body"`
}

// PaginatedResponse is a generic paginated response.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}
