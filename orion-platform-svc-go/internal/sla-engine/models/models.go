package models

import "time"

// SLAProfile represents a configurable SLA service-level agreement policy.
type SLAProfile struct {
	ID                 string    `json:"id" db:"id"`
	TenantID           string    `json:"tenant_id" db:"tenant_id"`
	Name               string    `json:"name" db:"name"`
	Type               string    `json:"type" db:"type"`             // "response", "resolution", "both"
	Priority           string    `json:"priority" db:"priority"`     // "P1", "P2", "P3", "P4"
	ResponseSLA        string    `json:"response_sla" db:"response_sla"`        // e.g. "1h", "4h", "8h"
	ResolutionSLA      string    `json:"resolution_sla" db:"resolution_sla"`    // e.g. "4h", "24h", "72h"
	BusinessHours      bool      `json:"business_hours" db:"business_hours"`          // Consider only business hours
	WeekendsIncluded   bool      `json:"weekends_included" db:"weekends_included"`
	HolidaysExcluded   bool      `json:"holidays_excluded" db:"holidays_excluded"`
	WorkingDays        string    `json:"working_days" db:"working_days"`            // "Mon-Fri"
	WorkingHours       string    `json:"working_hours" db:"working_hours"`          // "09:00-18:00"
	Description        string    `json:"description" db:"description"`
	Status             string    `json:"status" db:"status"`                         // "active", "disabled"
	CreatedAt          time.Time `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time `json:"updated_at" db:"updated_at"`
}

// SLATracker represents an SLA tracking record tied to a ticket/incident/change.
type SLATracker struct {
	ID                 string        `json:"id" db:"id"`
	TenantID           string        `json:"tenant_id" db:"tenant_id"`
	SLAProfileID       string        `json:"sla_profile_id" db:"sla_profile_id"`
	TargetID           string        `json:"target_id" db:"target_id"`        // ticket/incident ID
	TargetType         string        `json:"target_type" db:"target_type"`    // "ticket", "incident", "change"
	OpenedAt           time.Time     `json:"opened_at" db:"opened_at"`
	ResponseDeadline   time.Time     `json:"response_deadline" db:"response_deadline"`
	ResolutionDeadline time.Time     `json:"resolution_deadline" db:"resolution_deadline"`
	ResponseTime       *int64        `json:"response_time_ms,omitempty" db:"response_time"`       // milliseconds
	ResolutionTime     *int64        `json:"resolution_time_ms,omitempty" db:"resolution_time"` // milliseconds
	PausedAt           *time.Time    `json:"paused_at,omitempty" db:"paused_at"`
	PausedReason       string        `json:"paused_reason" db:"paused_reason"`
	ResumedAt          *time.Time    `json:"resumed_at,omitempty" db:"resumed_at"`
	Status             string        `json:"status" db:"status"`         // "active", "responded", "resolved", "breached", "paused"
	BreachReason       string        `json:"breach_reason" db:"breach_reason"`
	CreatedAt          time.Time     `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time     `json:"updated_at" db:"updated_at"`
}

// SLAHoliday represents a date excluded from SLA counting.
type SLAHoliday struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Date      time.Time `json:"date" db:"date"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// --- Request bodies ---

// CreateProfileRequest is the request body for creating an SLA profile.
type CreateProfileRequest struct {
	Name             string `json:"name" binding:"required"`
	Type             string `json:"type" binding:"required"`  // "response", "resolution", "both"
	Priority         string `json:"priority" binding:"required"`
	ResponseSLA      string `json:"response_sla" binding:"required"`
	ResolutionSLA    string `json:"resolution_sla" binding:"required"`
	Description      string `json:"description"`
	BusinessHours    *bool  `json:"business_hours"`
	WeekendsIncluded *bool  `json:"weekends_included"`
	HolidaysExcluded *bool  `json:"holidays_excluded"`
	WorkingDays      string `json:"working_days"`
	WorkingHours     string `json:"working_hours"`
}

// UpdateProfileRequest is the request body for updating an SLA profile (all fields optional).
type UpdateProfileRequest struct {
	Name             *string `json:"name"`
	Type             *string `json:"type"`
	Priority         *string `json:"priority"`
	ResponseSLA      *string `json:"response_sla"`
	ResolutionSLA    *string `json:"resolution_sla"`
	Description      *string `json:"description"`
	BusinessHours    *bool   `json:"business_hours"`
	WeekendsIncluded *bool   `json:"weekends_included"`
	HolidaysExcluded *bool   `json:"holidays_excluded"`
	WorkingDays      *string `json:"working_days"`
	WorkingHours     *string `json:"working_hours"`
	Status           *string `json:"status"`
}

// CreateTrackerRequest is the request body for creating an SLA tracker.
type CreateTrackerRequest struct {
	SLAProfileID string `json:"sla_profile_id" binding:"required"`
	TargetID     string `json:"target_id" binding:"required"`
	TargetType   string `json:"target_type" binding:"required"` // "ticket", "incident", "change"
	OpenedAt     string `json:"opened_at"`                       // RFC3339, defaults to now
}

// PauseTrackerRequest is the request body for pausing an SLA tracker.
type PauseTrackerRequest struct {
	Reason string `json:"reason" binding:"required"`
}

// CalculateRequest is the request body for calculating SLA deadlines.
type CalculateRequest struct {
	OpenedAt string `json:"opened_at"` // RFC3339, defaults to now
}

// --- Query models ---

type ProfileListQuery struct {
	Priority string `form:"priority"`
	Type     string `form:"type"`
	Status   string `form:"status"`
	Limit    int    `form:"limit"`
	Offset   int    `form:"offset"`
}

type TrackerListQuery struct {
	TargetType string `form:"target_type"`
	Status     string `form:"status"`
	Limit      int    `form:"limit"`
	Offset     int    `form:"offset"`
}

// --- Response helpers ---

type DeadlinesResult struct {
	ResponseDeadline   time.Time `json:"response_deadline"`
	ResolutionDeadline time.Time `json:"resolution_deadline"`
}

type TrackerStatistics struct {
	Total      int     `json:"total"`
	Active     int     `json:"active"`
	Responded  int     `json:"responded"`
	Resolved   int     `json:"resolved"`
	Breached   int     `json:"breached"`
	Paused     int     `json:"paused"`
	BreachRate float64 `json:"breach_rate"`
}
