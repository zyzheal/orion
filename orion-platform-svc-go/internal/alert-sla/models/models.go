package models

import "time"

// AlertSLA defines an alert-specific SLA policy.
type AlertSLA struct {
	ID             string `json:"id" db:"id"`
	TenantID       string `json:"tenantId" db:"tenant_id"`
	Name           string `json:"name" db:"name"`
	Severity       string `json:"severity" db:"severity"`
	ResponseTime   int    `json:"responseTime" db:"response_time"`
	ResolveTime    int    `json:"resolveTime" db:"resolve_time"`
	EscalationDelay int   `json:"escalationDelay" db:"escalation_delay"`
	Enabled        bool   `json:"enabled" db:"enabled"`
	CreatedAt      time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt      time.Time `json:"updatedAt" db:"updated_at"`
	Version        int       `json:"version" db:"version"`
}

// CreateSLARequest is the request body for creating an SLA.
type CreateSLARequest struct {
	Name            string `json:"name" binding:"required"`
	Severity        string `json:"severity"`
	ResponseTime    int    `json:"responseTime"`
	ResolveTime     int    `json:"resolveTime"`
	EscalationDelay int    `json:"escalationDelay"`
	Enabled         bool   `json:"enabled"`
	TenantID        *string `json:"tenantId"`
}

// UpdateSLARequest is the request body for updating an SLA.
type UpdateSLARequest struct {
	Name            *string `json:"name"`
	Severity        *string `json:"severity"`
	ResponseTime    *int    `json:"responseTime"`
	ResolveTime     *int    `json:"resolveTime"`
	EscalationDelay *int    `json:"escalationDelay"`
	Enabled         *bool   `json:"enabled"`
}
