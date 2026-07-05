package models

import (
	"time"
)

// Incident represents an ITIL-aligned incident entity.
type Incident struct {
	ID                string     `db:"id" json:"id"`
	TenantID          string     `db:"tenant_id" json:"tenant_id"`
	DeploymentID      *string    `db:"deployment_id" json:"deployment_id,omitempty"`
	PipelineRunID     *string    `db:"pipeline_run_id" json:"pipeline_run_id,omitempty"`
	CommitSHA         *string    `db:"commit_sha" json:"commit_sha,omitempty"`
	Title             *string    `db:"title" json:"title,omitempty"`
	Description       *string    `db:"description" json:"description,omitempty"`
	Type              string     `db:"type" json:"type"`
	Severity          string     `db:"severity" json:"severity"`
	Status            string     `db:"status" json:"status"`
	Priority          *string    `db:"priority" json:"priority,omitempty"`
	Impact            *string    `db:"impact" json:"impact,omitempty"`
	Urgency           *string    `db:"urgency" json:"urgency,omitempty"`
	Service           *string    `db:"service" json:"service,omitempty"`
	Environment       *string    `db:"environment" json:"environment,omitempty"`
	ErrorMessage      *string    `db:"error_message" json:"error_message,omitempty"`
	DetectedBy        *string    `db:"detected_by" json:"detected_by,omitempty"`
	AffectedServices  []byte     `db:"affected_services" json:"affected_services,omitempty"`
	Tags              []byte     `db:"tags" json:"tags,omitempty"`
	AssignedTeam      *string    `db:"assigned_team" json:"assigned_team,omitempty"`
	CommanderID       *string    `db:"commander_id" json:"commander_id,omitempty"`
	RelatedProblemID  *string    `db:"related_problem_id" json:"related_problem_id,omitempty"`
	LinkedProblemID   *string    `db:"linked_problem_id" json:"linked_problem_id,omitempty"`
	LinkedChangeID    *string    `db:"linked_change_id" json:"linked_change_id,omitempty"`
	PostmortemURL     *string    `db:"postmortem_url" json:"postmortem_url,omitempty"`
	PostmortemSummary *string    `db:"postmortem_summary" json:"postmortem_summary,omitempty"`
	PostmortemRequired bool      `db:"postmortem_required" json:"postmortem_required"`
	EscalationLevel   int        `db:"escalation_level" json:"escalation_level"`
	SLABreach         bool       `db:"sla_breach" json:"sla_breach"`
	SLABreachAt       *time.Time `db:"sla_breach_at" json:"sla_breach_at,omitempty"`
	ResolvedBy        *string    `db:"resolved_by" json:"resolved_by,omitempty"`
	ClosedAt          *time.Time `db:"closed_at" json:"closed_at,omitempty"`
	ClosedBy          *string    `db:"closed_by" json:"closed_by,omitempty"`
	DetectedAt        time.Time  `db:"detected_at" json:"detected_at"`
	AcknowledgedAt    *time.Time `db:"acknowledged_at" json:"acknowledged_at,omitempty"`
	ResolvedAt        *time.Time `db:"resolved_at" json:"resolved_at,omitempty"`
	RecoveryTimeMs    *int64     `db:"recovery_time_ms" json:"recovery_time_ms,omitempty"`
	CreatedAt         time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt         time.Time  `db:"updated_at" json:"updated_at"`
}

// IncidentListFilters represents filter options for listing incidents.
type IncidentListFilters struct {
	Status   *string
	Severity *string
	Priority *string
	Type     *string
	Limit    int
	Offset   int
}

// CreateIncidentRequest represents the full request to create an incident.
type CreateIncidentRequest struct {
	Title             string   `json:"title"`
	Description       *string  `json:"description"`
	Type              string   `json:"type"`
	Severity          string   `json:"severity"`
	Impact            *string  `json:"impact"`
	Urgency           *string  `json:"urgency"`
	Service           *string  `json:"service"`
	Environment       *string  `json:"environment"`
	ErrorMessage      *string  `json:"error_message"`
	DetectedBy        *string  `json:"detected_by"`
	AffectedServices  []string `json:"affected_services"`
	Tags              []string `json:"tags"`
	DeploymentID      *string  `json:"deployment_id"`
	PipelineRunID     *string  `json:"pipeline_run_id"`
	CommitSHA         *string  `json:"commit_sha"`
	AssignedTeam      *string  `json:"assigned_team"`
	PostmortemRequired *bool   `json:"postmortem_required"`
}

// UpdateIncidentRequest represents the request to update an incident.
type UpdateIncidentRequest struct {
	Title             *string  `json:"title"`
	Description       *string  `json:"description"`
	Severity          *string  `json:"severity"`
	Impact            *string  `json:"impact"`
	Urgency           *string  `json:"urgency"`
	Service           *string  `json:"service"`
	Environment       *string  `json:"environment"`
	ErrorMessage      *string  `json:"error_message"`
	DetectedBy        *string  `json:"detected_by"`
	AffectedServices  []string `json:"affected_services"`
	Tags              []string `json:"tags"`
	AssignedTeam      *string  `json:"assigned_team"`
	RelatedProblemID  *string  `json:"related_problem_id"`
	LinkedProblemID   *string  `json:"linked_problem_id"`
	LinkedChangeID    *string  `json:"linked_change_id"`
	PostmortemURL     *string  `json:"postmortem_url"`
	PostmortemSummary *string  `json:"postmortem_summary"`
	PostmortemRequired *bool   `json:"postmortem_required"`
}

// UpdateStatusRequest represents the request to update incident status.
type UpdateStatusRequest struct {
	Status  string `json:"status"`
	ActorID string `json:"actor_id"`
	Reason  string `json:"reason"`
}

// AssignCommanderRequest represents the request to assign an incident commander.
type AssignCommanderRequest struct {
	CommanderID string `json:"commander_id"`
}

// EscalateRequest represents the request to escalate an incident.
type EscalateRequest struct {
	ToLevel     int    `json:"to_level"`
	Reason      string `json:"reason"`
	EscalatedBy string `json:"escalated_by"`
}

// CreatePostmortemRequest represents the request to create a postmortem.
type CreatePostmortemRequest struct {
	Title               *string  `json:"title"`
	Summary             string   `json:"summary"`
	RootCause           string   `json:"root_cause"`
	ContributingFactors []string `json:"contributing_factors"`
	ImpactDescription   *string  `json:"impact_description"`
	Timeline            []byte   `json:"timeline,omitempty"`
	TimelineSummary     *string  `json:"timeline_summary"`
	ActionItems         []byte   `json:"action_items,omitempty"`
	LessonsLearned      *string  `json:"lessons_learned"`
	CreatedBy           *string  `json:"created_by"`
}

// TimelineEvent represents an event in the incident timeline.
type TimelineEvent struct {
	ID         string    `db:"id" json:"id"`
	IncidentID string    `db:"incident_id" json:"incident_id"`
	TenantID   string    `db:"tenant_id" json:"tenant_id"`
	EventType  string    `db:"event_type" json:"event_type"`
	ActorID    *string   `db:"actor_id" json:"actor_id,omitempty"`
	Content    string    `db:"content" json:"content"`
	Metadata   []byte    `db:"metadata" json:"metadata,omitempty"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
}

// PostmortemRecord represents an incident postmortem/RCA record.
type PostmortemRecord struct {
	ID                  string     `db:"id" json:"id"`
	IncidentID          string     `db:"incident_id" json:"incident_id"`
	TenantID            string     `db:"tenant_id" json:"tenant_id"`
	Title               *string    `db:"title" json:"title,omitempty"`
	Summary             string     `db:"summary" json:"summary"`
	RootCause           string     `db:"root_cause" json:"root_cause"`
	ContributingFactors []byte     `db:"contributing_factors" json:"contributing_factors,omitempty"`
	ImpactDescription   *string    `db:"impact_description" json:"impact_description,omitempty"`
	Timeline            []byte     `db:"timeline" json:"timeline,omitempty"`
	TimelineSummary     *string    `db:"timeline_summary" json:"timeline_summary,omitempty"`
	ActionItems         []byte     `db:"action_items" json:"action_items,omitempty"`
	LessonsLearned      *string    `db:"lessons_learned" json:"lessons_learned,omitempty"`
	Status              string     `db:"status" json:"status"`
	CreatedBy           *string    `db:"created_by" json:"created_by,omitempty"`
	PublishedAt         *time.Time `db:"published_at" json:"published_at,omitempty"`
	ReviewedBy          *string    `db:"reviewed_by" json:"reviewed_by,omitempty"`
	CreatedAt           time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt           time.Time  `db:"updated_at" json:"updated_at"`
}

// EscalationRecord represents an incident escalation record.
type EscalationRecord struct {
	ID           string     `db:"id" json:"id"`
	IncidentID   string     `db:"incident_id" json:"incident_id"`
	TenantID     string     `db:"tenant_id" json:"tenant_id"`
	FromLevel    int        `db:"from_level" json:"from_level"`
	ToLevel      int        `db:"to_level" json:"to_level"`
	Reason       *string    `db:"reason" json:"reason,omitempty"`
	EscalatedBy  string     `db:"escalated_by" json:"escalated_by"`
	EscalatedAt  time.Time  `db:"escalated_at" json:"escalated_at"`
}

// SLAStatus represents the current SLA status of an incident.
type SLAStatus struct {
	Breached         bool `json:"breached"`
	ThresholdMinutes int  `json:"threshold_minutes"`
	ElapsedMinutes   int  `json:"elapsed_minutes"`
}

// IncidentStats represents incident statistics for a tenant.
type IncidentStats struct {
	Total           int            `json:"total"`
	ByStatus        map[string]int `json:"by_status"`
	BySeverity      map[string]int `json:"by_severity"`
	ByPriority      map[string]int `json:"by_priority"`
	SLABreachCount  int            `json:"sla_breach_count"`
	EscalationCount int            `json:"escalation_count"`
	MTTR            MTTRStats      `json:"mttr"`
	Trends          []TrendPoint   `json:"trends"`
}

// MTTRStats represents MTTR (Mean Time To Recovery) statistics.
type MTTRStats struct {
	AvgMs    float64 `json:"avg_ms"`
	MedianMs float64 `json:"median_ms"`
	P90Ms    float64 `json:"p90_ms"`
	P99Ms    float64 `json:"p99_ms"`
}

// TrendPoint represents a daily trend data point.
type TrendPoint struct {
	Period  string `json:"period"`
	Opened  int    `json:"opened"`
	Resolved int   `json:"resolved"`
}
