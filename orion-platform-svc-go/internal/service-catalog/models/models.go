package models

import "time"

// ServiceCatalog represents a service-catalog record.
type ServiceCatalog struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Value     string    `json:"value" db:"value"`
	Enabled   bool      `json:"enabled" db:"enabled"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type CreateServiceCatalogRequest struct {
	Name    string `json:"name" binding:"required"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
}

type UpdateServiceCatalogRequest struct {
	Name    *string `json:"name"`
	Value   *string `json:"value"`
	Enabled *bool   `json:"enabled"`
}

// ServiceRequest represents a service request (ticket).
type ServiceRequest struct {
	ID          string `json:"id" db:"id"`
	TenantID    string `json:"tenant_id" db:"tenant_id"`
	ServiceID   string `json:"service_id" db:"service_id"`
	Title       string `json:"title" db:"title"`
	Description string `json:"description" db:"description"`
	Priority    string `json:"priority" db:"priority"`
	Status      string `json:"status" db:"status"`
	AssignedTo  string `json:"assignedTo" db:"assigned_to"`
	CreatedAt   int64  `json:"created_at" db:"created_at"`
	UpdatedAt   int64  `json:"updated_at" db:"updated_at"`
}

// StatusUpdateRequest is the payload for POST /requests/:id/status.
type StatusUpdateRequest struct {
	Status     string `json:"status" binding:"required"`
	Comment    string `json:"comment"`
	AssignedTo string `json:"assignedTo,omitempty"`
}

// TimelineEntry represents a single event in a request timeline.
type TimelineEntry struct {
	At      int64  `json:"at"`
	Action  string `json:"action"`
	By      string `json:"by"`
	Comment string `json:"comment"`
}

// SLABreachesQuery is the query params for GET /sla-breaches.
type SLABreachesQuery struct {
	Service string `json:"service"`
	From    int64  `json:"from"`
	Limit   int    `json:"limit"`
}

// SLABreachesResponse is the response for GET /sla-breaches.
type SLABreachesResponse struct {
	Total    int         `json:"total"`
	Breaches []SLABreach `json:"breaches"`
}

// SLABreach represents a single SLA breach.
type SLABreach struct {
	RequestID   string `json:"requestId"`
	Service     string `json:"service"`
	SLATargetMs int64  `json:"slaTargetMs"`
	ActualMs    int64  `json:"actualMs"`
	OverdueMs   int64  `json:"overdueMs"`
	Status      string `json:"status"`
}

// Request is the service-request entity returned by business endpoints.
type Request struct {
	ID         string `json:"id"`
	TenantID   string `json:"tenant_id"`
	ServiceID  string `json:"serviceId"`
	Title      string `json:"title"`
	Status     string `json:"status"`
	AssignedTo string `json:"assignedTo,omitempty"`
	CreatedAt  int64  `json:"created_at"`
	UpdatedAt  int64  `json:"updated_at"`
}
