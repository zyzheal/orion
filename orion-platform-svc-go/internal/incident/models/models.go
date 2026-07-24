package models

import "time"

// Incident represents the core incident entity.
type Incident struct {
	ID                 string            `json:"id" db:"id"`
	TenantID           string            `json:"tenant_id" db:"tenant_id"`
	Title              string            `json:"title" db:"title"`
	Description        string            `json:"description" db:"description"`
	Type               string            `json:"type" db:"type"`
	Severity           string            `json:"severity" db:"severity"`
	Priority           string            `json:"priority" db:"priority"`
	Status             string            `json:"status" db:"status"`
	Impact             string            `json:"impact" db:"impact"`
	Urgency            string            `json:"urgency" db:"urgency"`
	CommanderID        *string           `json:"commander_id,omitempty" db:"commander_id"`
	AssignedTeam       *string           `json:"assigned_team,omitempty" db:"assigned_team"`
	AffectedServices   string            `json:"affected_services" db:"affected_services"`
	AffectedServicesRaw map[string]any   `json:"affected_services_raw,omitempty"`
	EscalationLevel    int               `json:"escalation_level" db:"escalation_level"`
	Environment        string            `json:"environment" db:"environment"`
	Service            string            `json:"service" db:"service"`
	DetectedBy         *string           `json:"detected_by,omitempty" db:"detected_by"`
	ErrorMessage       *string           `json:"error_message,omitempty" db:"error_message"`
	Tags               string            `json:"tags" db:"tags"`
	TagsRaw            []string          `json:"tags_raw,omitempty"`
	ResolvedBy         *string           `json:"resolved_by,omitempty" db:"resolved_by"`
	ClosedAt           *time.Time        `json:"closed_at,omitempty" db:"closed_at"`
	ClosedBy           *string           `json:"closed_by,omitempty" db:"closed_by"`
	RelatedProblemID   *string           `json:"related_problem_id,omitempty" db:"related_problem_id"`
	LinkedProblemID    *string           `json:"linked_problem_id,omitempty" db:"linked_problem_id"`
	LinkedChangeID     *string           `json:"linked_change_id,omitempty" db:"linked_change_id"`
	SlaBreach          bool              `json:"sla_breach" db:"sla_breach"`
	SlaBreachAt        *time.Time        `json:"sla_breach_at,omitempty" db:"sla_breach_at"`
	PostmortemRequired bool              `json:"postmortem_required" db:"postmortem_required"`
	CreatedAt          time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time         `json:"updated_at" db:"updated_at"`
}

// --- Request models ---

// CreateIncidentRequest maps to TS CreateIncidentEnhancedInput.
type CreateIncidentRequest struct {
	Title             string   `json:"title" binding:"required"`
	Description       string   `json:"description"`
	Type              string   `json:"type" binding:"required"`
	Severity          string   `json:"severity" binding:"required"`
	Impact            string   `json:"impact"`
	Urgency           string   `json:"urgency"`
	Service           string   `json:"service"`
	Environment       string   `json:"environment"`
	ErrorMessage      string   `json:"error_message"`
	DetectedBy        string   `json:"detected_by"`
	AffectedServices  []string `json:"affected_services"`
	Tags              []string `json:"tags"`
	DeploymentID      string   `json:"deployment_id"`
	PipelineRunID     string   `json:"pipeline_run_id"`
	CommitSha         string   `json:"commit_sha"`
	AssignedTeam      string   `json:"assigned_team"`
	PostmortemRequired *bool   `json:"postmortem_required"`
}

// UpdateIncidentRequest allows partial updates.
type UpdateIncidentRequest struct {
	Title             *string `json:"title"`
	Description       *string `json:"description"`
	Type              *string `json:"type"`
	Severity          *string `json:"severity"`
	Status            *string `json:"status"`
	Impact            *string `json:"impact"`
	Urgency           *string `json:"urgency"`
	AffectedServices  *string `json:"affected_services"`
	Environment       *string `json:"environment"`
	Service           *string `json:"service"`
	AssignedTeam      *string `json:"assigned_team"`
	RelatedProblemID  *string `json:"related_problem_id"`
	LinkedProblemID   *string `json:"linked_problem_id"`
	LinkedChangeID    *string `json:"linked_change_id"`
	PostmortemRequired *bool  `json:"postmortem_required"`
}

// IncidentListQuery holds optional list filters.
type IncidentListQuery struct {
	Status   string `json:"status"`
	Severity string `json:"severity"`
	Priority string `json:"priority"`
	Limit    int    `json:"limit"`
	Offset   int    `json:"offset"`
}

// IncidentListResult wraps incidents with a total count.
type IncidentListResult struct {
	Incidents []Incident `json:"incidents"`
	Total     int        `json:"total"`
}

// --- Status update ---

type UpdateStatusRequest struct {
	Status string `json:"status" binding:"required"`
	Reason string `json:"reason"`
}

// --- Assignment ---

type AssignCommanderRequest struct {
	CommanderID string `json:"commander_id" binding:"required"`
}

// --- Escalation ---

type EscalateRequest struct {
	ToLevel     int    `json:"to_level" binding:"required"`
	Reason      string `json:"reason" binding:"required"`
	EscalatedBy string `json:"escalated_by" binding:"required"`
}

type EscalationRecord struct {
	ID            string    `json:"id" db:"id"`
	IncidentID    string    `json:"incident_id" db:"incident_id"`
	TenantID      string    `json:"tenant_id" db:"tenant_id"`
	FromLevel     int       `json:"from_level" db:"from_level"`
	ToLevel       int       `json:"to_level" db:"to_level"`
	Reason        string    `json:"reason" db:"reason"`
	EscalatedBy   string    `json:"escalated_by" db:"escalated_by"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

// --- Timeline ---

type AddTimelineEventRequest struct {
	EventType string                 `json:"event_type" binding:"required"`
	Content   string                 `json:"content" binding:"required"`
	ActorID   string                 `json:"actor_id"`
	Metadata  map[string]interface{} `json:"metadata"`
}

type TimelineEvent struct {
	ID         string                 `json:"id" db:"id"`
	IncidentID string                 `json:"incident_id" db:"incident_id"`
	TenantID   string                 `json:"tenant_id" db:"tenant_id"`
	EventType  string                 `json:"event_type" db:"event_type"`
	ActorID    string                 `json:"actor_id" db:"actor_id"`
	Content    string                 `json:"content" db:"content"`
	Metadata   map[string]interface{} `json:"metadata" db:"metadata"`
	CreatedAt  time.Time              `json:"created_at" db:"created_at"`
}

type TimelineQuery struct {
	Limit  *int `json:"limit"`
	Offset *int `json:"offset"`
}

// --- Postmortem ---

type CreatePostmortemRequest struct {
	Title              string   `json:"title"`
	Summary            string   `json:"summary" binding:"required"`
	RootCause          string   `json:"root_cause" binding:"required"`
	ContributingFactors []string `json:"contributing_factors"`
	ImpactDescription  string   `json:"impact_description"`
	TimelineSummary    string   `json:"timeline_summary"`
	Actions            string   `json:"action_items"`
	LessonsLearned     string   `json:"lessons_learned"`
	CreatedBy          string   `json:"created_by"`
}

type UpdatePostmortemRequest struct {
	Title              *string  `json:"title"`
	Summary            *string  `json:"summary"`
	RootCause          *string  `json:"root_cause"`
	ContributingFactors *string  `json:"contributing_factors"`
	ImpactDescription  *string  `json:"impact_description"`
	TimelineSummary    *string  `json:"timeline_summary"`
	Actions            *string  `json:"action_items"`
	LessonsLearned     *string  `json:"lessons_learned"`
}

type PostmortemRecord struct {
	ID                  string     `json:"id" db:"id"`
	IncidentID          string     `json:"incident_id" db:"incident_id"`
	TenantID            string     `json:"tenant_id" db:"tenant_id"`
	Title               *string    `json:"title,omitempty" db:"title"`
	Summary             string     `json:"summary" db:"summary"`
	RootCause           string     `json:"root_cause" db:"root_cause"`
	ContributingFactors string     `json:"contributing_factors" db:"contributing_factors"`
	ImpactDescription   *string    `json:"impact_description,omitempty" db:"impact_description"`
	TimelineSummary     *string    `json:"timeline_summary,omitempty" db:"timeline_summary"`
	Actions             *string    `json:"action_items,omitempty" db:"action_items"`
	LessonsLearned      *string    `json:"lessons_learned,omitempty" db:"lessons_learned"`
	Status              string     `json:"status" db:"status"` // draft, published, archived
	CreatedBy           *string    `json:"created_by,omitempty" db:"created_by"`
	ReviewedBy          *string    `json:"reviewed_by,omitempty" db:"reviewed_by"`
	PublishedAt         *time.Time `json:"published_at,omitempty" db:"published_at"`
	CreatedAt           time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at" db:"updated_at"`
}

// --- SLA ---

type SlaCheckResult struct {
	IncidentID    string   `json:"incident_id"`
	Status        string   `json:"status"`
	ResponseDue   *float64 `json:"response_due_minutes,omitempty"`
	ResolutionDue *float64 `json:"resolution_due_minutes,omitempty"`
	Breached      bool     `json:"breached"`
	Message       string   `json:"message,omitempty"`
}

// --- Statistics ---

type IncidentStats struct {
	Total          int                 `json:"total"`
	ByStatus       map[string]int      `json:"by_status"`
	BySeverity     map[string]int      `json:"by_severity"`
	ByPriority     map[string]int      `json:"by_priority"`
	SlaBreachCount int                 `json:"sla_breach_count"`
	EscalationCount int                 `json:"escalation_count"`
}

// --- Knowledge recommendations ---

type KnowledgeRecommendation struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Relevance   float64 `json:"relevance"`
}

type KnowledgeRecommendationResult struct {
	IncidentID     string                      `json:"incident_id"`
	Limit          int                         `json:"limit"`
	Recommendations []KnowledgeRecommendation `json:"recommendations"`
}
