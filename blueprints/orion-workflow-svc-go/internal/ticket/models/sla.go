package models

import "time"

// SLATarget defines response/resolution time targets for a priority
type SLATarget struct {
	ID                    string `json:"id" db:"id"`
	Name                  string `json:"name" db:"name"`
	Priority              string `json:"priority" db:"priority"`
	TargetResponseTimeMs  int64  `json:"target_response_time_ms" db:"target_response_time_ms"`
	TargetResolutionTimeMs int64 `json:"target_resolution_time_ms" db:"target_resolution_time_ms"`
	Enabled               bool   `json:"enabled" db:"enabled"`
	CreatedAt             time.Time `json:"created_at" db:"created_at"`
}

// SLARecord tracks SLA status for a specific ticket
type SLARecord struct {
	ID                   string     `json:"id" db:"id"`
	TicketID             string     `json:"ticket_id" db:"ticket_id"`
	SLATargetID          string     `json:"sla_target_id" db:"sla_target_id"`
	Priority             string     `json:"priority" db:"priority"`
	ResponseDeadlineAt   time.Time  `json:"response_deadline_at" db:"response_deadline_at"`
	ResolutionDeadlineAt time.Time  `json:"resolution_deadline_at" db:"resolution_deadline_at"`
	RespondedAt          *time.Time `json:"responded_at,omitempty" db:"responded_at"`
	ResolvedAt           *time.Time `json:"resolved_at,omitempty" db:"resolved_at"`
	Breached             bool       `json:"breached" db:"breached"`
	BreachType           string     `json:"breach_type,omitempty" db:"breach_type"`
	Paused               bool       `json:"paused" db:"paused"`
	PausedAt             *time.Time `json:"paused_at,omitempty" db:"paused_at"`
	PausedReason         string     `json:"paused_reason,omitempty" db:"paused_reason"`
	CreatedAt            time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at" db:"updated_at"`
}

// CreateSLATargetRequest is input for creating an SLA target
type CreateSLATargetRequest struct {
	ID                    string `json:"id"`
	Name                  string `json:"name" binding:"required"`
	Priority              string `json:"priority" binding:"required"`
	TargetResponseTimeMs  int64  `json:"target_response_time_ms"`
	TargetResolutionTimeMs int64 `json:"target_resolution_time_ms" binding:"required"`
	Enabled               *bool  `json:"enabled"`
}

// SLAComplianceReport summarizes SLA compliance
type SLAComplianceReport struct {
	TotalTickets     int     `json:"total_tickets"`
	BreachedCount    int     `json:"breached_count"`
	ComplianceRate   float64 `json:"compliance_rate"`
	AvgResponseMs    float64 `json:"avg_response_ms"`
	AvgResolutionMs  float64 `json:"avg_resolution_ms"`
	ByPriority       map[string]SLAPriorityStats `json:"by_priority"`
}

// SLAPriorityStats is SLA stats for a specific priority
type SLAPriorityStats struct {
	Total          int     `json:"total"`
	Breached       int     `json:"breached"`
	ComplianceRate float64 `json:"compliance_rate"`
}
