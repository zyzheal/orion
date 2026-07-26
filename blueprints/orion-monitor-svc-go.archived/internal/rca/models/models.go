package models

import (
	"time"

	"github.com/google/uuid"
)

// RCAAnalysis represents a root cause analysis session.
type RCAAnalysis struct {
	ID          uuid.UUID `json:"id"`
	TenantID    uuid.UUID `json:"tenant_id"`
	IncidentID  string    `json:"incident_id"`
	Status      string    `json:"status"`
	RootCauses  []RootCause `json:"root_causes"`
	Confidence  float64   `json:"confidence"`
	TriggeredBy string    `json:"triggered_by"`
	StartedAt   time.Time `json:"started_at"`
	CompletedAt *time.Time `json:"completed_at"`
}

// RootCause represents an identified root cause.
type RootCause struct {
	ID          uuid.UUID `json:"id"`
	AnalysisID  uuid.UUID `json:"analysis_id"`
	Component   string    `json:"component"`
	Category    string    `json:"category"`
	Description string    `json:"description"`
	Evidence    []string  `json:"evidence"`
	Impact      string    `json:"impact"`
	Priority    int       `json:"priority"`
	Fixes       []Fix     `json:"fixes"`
	CreatedAt   time.Time `json:"created_at"`
}

// Fix represents a suggested fix for a root cause.
type Fix struct {
	ID          uuid.UUID `json:"id"`
	RootCauseID uuid.UUID `json:"root_cause_id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Priority    int       `json:"priority"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
}

// TimelineEvent represents an event in the incident timeline.
type TimelineEvent struct {
	ID        uuid.UUID `json:"id"`
	Timestamp time.Time `json:"timestamp"`
	Type      string    `json:"type"`
	Source    string    `json:"source"`
	Message   string    `json:"message"`
	Severity  string    `json:"severity"`
}

// AnalyzeRequest for starting an RCA analysis.
type AnalyzeRequest struct {
	IncidentID    string   `json:"incident_id" binding:"required"`
	TimeRange     TimeRange `json:"time_range" binding:"required"`
	IncludePatterns []string `json:"include_patterns"`
	ExcludePatterns []string `json:"exclude_patterns"`
}

// TimeRange defines the time window for analysis.
type TimeRange struct {
	Start time.Time `json:"start" binding:"required"`
	End   time.Time `json:"end" binding:"required"`
}

// RCAAnalysisResponse wraps analysis results.
type RCAAnalysisResponse struct {
	Total int64       `json:"total"`
	Data  []RCAAnalysis `json:"data"`
}

// RootCauseResponse wraps root cause results.
type RootCauseResponse struct {
	Total int64       `json:"total"`
	Data  []RootCause `json:"data"`
}
