package models

import "time"

// SLAPolicy defines an SLA policy with response/resolution targets
type SLAPolicy struct {
	ID                       string    `json:"id" db:"id"`
	TenantID                 string    `json:"tenant_id" db:"tenant_id"`
	Name                     string    `json:"name" db:"name"`
	Description              string    `json:"description" db:"description"`
	Priority                 string    `json:"priority" db:"priority"`
	TargetResponseTimeMs     int64     `json:"target_response_time_ms" db:"target_response_time_ms"`
	TargetResolutionTimeMs   int64     `json:"target_resolution_time_ms" db:"target_resolution_time_ms"`
	Enabled                  bool      `json:"enabled" db:"enabled"`
	CreatedAt                time.Time `json:"created_at" db:"created_at"`
	UpdatedAt                time.Time `json:"updated_at" db:"updated_at"`
}

// CreateSLAPolicyRequest is input for creating an SLA policy
type CreateSLAPolicyRequest struct {
	ID                       string `json:"id"`
	Name                     string `json:"name" binding:"required"`
	Description              string `json:"description"`
	Priority                 string `json:"priority" binding:"required"`
	TargetResponseTimeMs     int64  `json:"target_response_time_ms"`
	TargetResolutionTimeMs   int64  `json:"target_resolution_time_ms" binding:"required"`
	Enabled                  *bool  `json:"enabled"`
}

// UpdateSLAPolicyRequest is input for updating an SLA policy
type UpdateSLAPolicyRequest struct {
	Name                     string `json:"name"`
	Description              string `json:"description"`
	Priority                 string `json:"priority"`
	TargetResponseTimeMs     *int64 `json:"target_response_time_ms"`
	TargetResolutionTimeMs   *int64 `json:"target_resolution_time_ms"`
	Enabled                  *bool  `json:"enabled"`
}

// TicketSLAStatus returns SLA tracking status for a ticket
type TicketSLAStatus struct {
	TicketID               string    `json:"ticket_id"`
	PolicyID               string    `json:"policy_id"`
	PolicyName             string    `json:"policy_name"`
	Priority               string    `json:"priority"`
	TargetResponseTimeMs   int64     `json:"target_response_time_ms"`
	TargetResolutionTimeMs int64     `json:"target_resolution_time_ms"`
	ResponseDeadlineAt     time.Time `json:"response_deadline_at"`
	ResolutionDeadlineAt   time.Time `json:"resolution_deadline_at"`
	RespondedAt            *time.Time `json:"responded_at"`
	ResolvedAt             *time.Time `json:"resolved_at"`
	Breached               bool      `json:"breached"`
	BreachType             string    `json:"breach_type,omitempty"`
	Status                 string    `json:"status"` // on_track, at_risk, breached
}

// SLAComplianceDetail is compliance report for a specific policy
type SLAComplianceDetail struct {
	PolicyID       string    `json:"policy_id"`
	PolicyName     string    `json:"policy_name"`
	PeriodStart    time.Time `json:"period_start"`
	PeriodEnd      time.Time `json:"period_end"`
	TotalTickets   int       `json:"total_tickets"`
	BreachedCount  int       `json:"breached_count"`
	ComplianceRate float64   `json:"compliance_rate"`
}
