package models

import (
	"encoding/json"
	"time"
)

// RateLimit defines rate limiting policy for a gateway route.
type RateLimit struct {
	MaxRequests int `json:"max_requests"`
	WindowMs    int `json:"window_ms"`
}

// RetryPolicy defines retry behavior for a gateway route.
type RetryPolicy struct {
	MaxRetries int `json:"max_retries"`
	BackoffMs  int `json:"backoff_ms"`
}

// RouteMetadata carries optional metadata for a gateway route.
type RouteMetadata struct {
	Description    string           `json:"description,omitempty"`
	AuthRequired   bool             `json:"auth_required"`
	AllowedRoles   []string         `json:"allowed_roles,omitempty"`
	AllowedTenants []string         `json:"allowed_tenants,omitempty"`
	RateLimit      *RateLimit       `json:"rate_limit"`
	TimeoutMs      int              `json:"timeout_ms"`
	RetryPolicy    *RetryPolicy     `json:"retry_policy"`
	LastRequestAt  string           `json:"last_request_at,omitempty"`
	RequestCount   int64            `json:"request_count"`
	ErrorCount     int64            `json:"error_count"`
	ErrorRate      float64          `json:"error_rate"`
}

// GatewayRoute is a dynamic API gateway route configuration entry.
type GatewayRoute struct {
	ID           string            `json:"id" db:"id"`
	TenantID     string            `json:"tenant_id" db:"tenant_id"`
	Path         string            `json:"path" db:"path"`
	Methods      string            `json:"methods" db:"methods"` // JSON array string, e.g. ["GET","POST"]
	UpstreamURL  string            `json:"upstream_url" db:"upstream_url"`
	Enabled      bool              `json:"enabled" db:"enabled"`
	Priority     int               `json:"priority" db:"priority"`
	Metadata     json.RawMessage   `json:"metadata" db:"metadata"`       // Raw JSON stored in DB
	CreatedBy    string            `json:"created_by" db:"created_by"`
	UpdatedBy    string            `json:"updated_by" db:"updated_by"`
	CreatedAt    time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at" db:"updated_at"`
}

// CreateGatewayRouteRequest is the request body for creating a new gateway route.
// Maps to the TS "body" shape in POST /api/v1/gateway/routes.
type CreateGatewayRouteRequest struct {
	Path          string            `json:"path" binding:"required"`
	Methods       []string          `json:"methods"`
	TargetService string            `json:"target_service" binding:"required"`
	TargetURL     string            `json:"target_url"`
	Description   string            `json:"description"`
	Enabled       bool              `json:"enabled"`
	AuthRequired  bool              `json:"auth_required"`
	AllowedRoles  []string          `json:"allowed_roles"`
	AllowedTenants []string         `json:"allowed_tenants"`
	RateLimit     *RateLimit        `json:"rate_limit"`
	TimeoutMs     int               `json:"timeout_ms"`
	RetryPolicy   *RetryPolicy      `json:"retry_policy"`
}

// UpdateGatewayRouteRequest is the partial request body for updating a gateway route.
// Maps to the TS "body" shape in PUT /api/v1/gateway/routes/:id.
type UpdateGatewayRouteRequest struct {
	Name            *string           `json:"name"` // kept for backward compat
	Path            *string           `json:"path"`
	Methods         []string          `json:"methods"`
	TargetService   *string           `json:"target_service"`
	TargetURL       *string           `json:"target_url"`
	Description     *string           `json:"description"`
	Enabled         *bool             `json:"enabled"`
	AuthRequired    *bool             `json:"auth_required"`
	AllowedRoles    []string          `json:"allowed_roles"`
	AllowedTenants  []string          `json:"allowed_tenants"`
	RateLimit       *RateLimit        `json:"rate_limit"`
	TimeoutMs       *int              `json:"timeout_ms"`
	RetryPolicy     *RetryPolicy      `json:"retry_policy"`
	Priority        *int              `json:"priority"`
}

// ToggleRequest is the body for PATCH /api/v1/gateway/routes/:id/toggle.
type ToggleRequest struct {
	Enabled bool `json:"enabled" binding:"required"`
}

// RouteStats aggregates statistics across gateway routes for a tenant.
type RouteStats struct {
	TotalRoutes int               `json:"total_routes"`
	EnabledCount int              `json:"enabled_count"`
	DisabledCount int             `json:"disabled_count"`
	TotalRequests int64           `json:"total_requests"`
	TotalErrors int64             `json:"total_errors"`
	ErrorRate float64             `json:"error_rate"`
}
