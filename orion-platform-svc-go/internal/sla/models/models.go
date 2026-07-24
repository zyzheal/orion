package models

import "time"

// SLADefinition represents an SLA policy/definition.
type SLADefinition struct {
	ID               string    `json:"id" db:"id"`
	TenantID         string    `json:"tenant_id" db:"tenant_id"`
	Name             string    `json:"name" db:"name"`
	Description      string    `json:"description" db:"description"`
	Type             string    `json:"type" db:"type"`
	TargetValue      float64   `json:"target_value" db:"target_value"`
	TargetUnit       string    `json:"target_unit" db:"target_unit"`
	BusinessHoursOnly *bool    `json:"business_hours_only,omitempty" db:"business_hours_only"`
	Priority         string    `json:"priority" db:"priority"`
	Category         string    `json:"category" db:"category"`
	EscalationRules  string    `json:"escalation_rules,omitempty" db:"escalation_rules"` // JSON
	Metadata         string    `json:"metadata,omitempty" db:"metadata"`               // JSON
	Status           string    `json:"status" db:"status"`
	CreatedBy        string    `json:"created_by" db:"created_by"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time `json:"updated_at" db:"updated_at"`
}

// SLATracking represents an SLA tracking record for a specific entity.
type SLATracking struct {
	ID              string     `json:"id" db:"id"`
	TenantID        string     `json:"tenant_id" db:"tenant_id"`
	DefinitionID    string     `json:"sla_definition_id" db:"sla_definition_id"`
	EntityType      string     `json:"entity_type" db:"entity_type"`
	EntityID        string     `json:"entity_id" db:"entity_id"`
	Status          string     `json:"status" db:"status"` // tracking, met, breached, paused
	TargetTime      *time.Time `json:"target_time" db:"target_time"`
	ActualTime      *time.Time `json:"actual_time,omitempty" db:"actual_time"`
	Notes           string     `json:"notes" db:"notes"`
	PauseReason     string     `json:"pause_reason" db:"pause_reason"`
	StartedAt       time.Time  `json:"started_at" db:"started_at"`
	CreatedAt       time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at" db:"updated_at"`
}

// SLABreachEvent represents a recorded SLA breach event.
type SLABreachEvent struct {
	ID            string    `json:"id" db:"id"`
	TenantID      string    `json:"tenant_id" db:"tenant_id"`
	TrackingID    string    `json:"tracking_id" db:"tracking_id"`
	BreachTime    time.Time `json:"breach_time" db:"breach_time"`
	BreachDetails string    `json:"breach_details,omitempty" db:"breach_details"` // JSON
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

// --- Request models ---

type CreateDefinitionRequest struct {
	Name              string      `json:"name" binding:"required"`
	Description       string      `json:"description"`
	Type              string      `json:"type"`
	TargetValue       float64     `json:"target_value" binding:"required"`
	TargetUnit        string      `json:"target_unit"`
	BusinessHoursOnly *bool       `json:"business_hours_only"`
	Priority          string      `json:"priority"`
	Category          string      `json:"category"`
	EscalationRules   string      `json:"escalation_rules"` // JSON string
	Metadata          string      `json:"metadata"`         // JSON string
	Status            string      `json:"status"`
}

type UpdateDefinitionRequest struct {
	Name              *string  `json:"name"`
	Description       *string  `json:"description"`
	Type              *string  `json:"type"`
	TargetValue       *float64 `json:"target_value"`
	TargetUnit        *string  `json:"target_unit"`
	BusinessHoursOnly *bool    `json:"business_hours_only"`
	Priority          *string  `json:"priority"`
	Category          *string  `json:"category"`
	EscalationRules   *string  `json:"escalation_rules"`
	Metadata          *string  `json:"metadata"`
	Status            *string  `json:"status"`
}

type StartTrackingRequest struct {
	DefinitionID string     `json:"sla_definition_id" binding:"required"`
	EntityType   string     `json:"entity_type" binding:"required"`
	EntityID     string     `json:"entity_id" binding:"required"`
	TargetTime   *time.Time `json:"target_time" binding:"required"`
	Notes        string     `json:"notes"`
}

type PauseTrackingRequest struct {
	Reason string `json:"reason"`
}

type MarkBreachedRequest struct {
	Details map[string]interface{} `json:"details"`
}

type UpdateTrackingStatusRequest struct {
	Status string `json:"status" binding:"required"` // met, breached, paused, tracking
}

// UpdateTrackingRequest is used for partial (PATCH) updates to an SLA tracking record.
type UpdateTrackingRequest struct {
	Status       *string    `json:"status"`
	DefinitionID *string    `json:"sla_definition_id"`
	EntityType   *string    `json:"entity_type"`
	EntityID     *string    `json:"entity_id"`
	TargetTime   *time.Time `json:"target_time"`
	Notes        *string    `json:"notes"`
	PauseReason  *string    `json:"pause_reason"`
}

// --- Query models ---

type DefinitionListQuery struct {
	Type     string `form:"type"`
	Status   string `form:"status"`
	Category string `form:"category"`
	Limit    int    `form:"limit"`
	Offset   int    `form:"offset"`
}

type TrackingListQuery struct {
	Status     string `form:"status"`
	EntityType string `form:"entity_type"`
	EntityID   string `form:"entity_id"`
	Limit      int    `form:"limit"`
	Offset     int    `form:"offset"`
}

// --- Result models ---

type DefinitionListResult struct {
	Definitions []SLADefinition `json:"definitions"`
	Total       int             `json:"total"`
}

type TrackingListResult struct {
	Trackings []SLATracking `json:"trackings"`
	Total     int           `json:"total"`
}

type BreachListResult struct {
	Events []SLABreachEvent `json:"events"`
	Total  int              `json:"total"`
}

type DetectionResult struct {
	Detected int `json:"detected"`
	Updated  int `json:"updated"`
}

type StatsResult struct {
	TotalDefinitions int    `json:"total_definitions"`
	ActiveTrackings  int    `json:"active_trackings"`
	MetCount         int    `json:"met_count"`
	BreachedCount    int    `json:"breached_count"`
	ComplianceRate   float64 `json:"compliance_rate"`
}
