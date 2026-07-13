package models

import "time"

// Session represents a diagnostic session.
type Session struct {
	ID         string     `db:"id" json:"id"`
	TenantID   string     `db:"tenant_id" json:"tenantId"`
	PipelineID *string    `db:"pipeline_id" json:"pipelineId"`
	TriggerType string    `db:"trigger_type" json:"triggerType"`
	TriggerID  string     `db:"trigger_id" json:"triggerId"`
	TriggeredBy *string   `db:"triggered_by" json:"triggeredBy"`
	Status     string     `db:"status" json:"status"`
	StartedAt  time.Time  `db:"started_at" json:"startedAt"`
	CompletedAt *time.Time `db:"completed_at" json:"completedAt"`
	CreatedAt  time.Time  `db:"created_at" json:"createdAt"`
}

// Symptom represents a symptom within a diagnostic session.
type Symptom struct {
	ID          string     `db:"id" json:"id"`
	SessionID   string     `db:"session_id" json:"sessionId"`
	Name        string     `db:"name" json:"name"`
	Description *string    `db:"description" json:"description"`
	Type        string     `db:"type" json:"type"`
	Source      string     `db:"source" json:"source"`
	Severity    string     `db:"severity" json:"severity"`
	Metadata    string     `db:"metadata" json:"metadata"`
	CreatedAt   time.Time  `db:"created_at" json:"createdAt"`
}

// Report represents a diagnostic report.
type Report struct {
	ID        string    `db:"id" json:"id"`
	SessionID string    `db:"session_id" json:"sessionId"`
	Content   string    `db:"content" json:"content"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
}

// Pattern represents a diagnostic knowledge pattern.
type Pattern struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenantId"`
	Name      string    `db:"name" json:"name"`
	Category  *string   `db:"category" json:"category"`
	Symptoms  string    `db:"symptoms" json:"symptoms"`
	RootCause *string   `db:"root_cause" json:"rootCause"`
	Solutions string    `db:"solutions" json:"solutions"`
	Frequency int       `db:"frequency" json:"frequency"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
}

// Outcome represents a recorded diagnostic outcome.
type Outcome struct {
	ID             string     `db:"id" json:"id"`
	SessionID      string     `db:"session_id" json:"sessionId"`
	PatternID      string     `db:"pattern_id" json:"patternId"`
	Confirmed      bool       `db:"confirmed" json:"confirmed"`
	ActualRootCause *string   `db:"actual_root_cause" json:"actualRootCause"`
	FixTimeMs      *int64     `db:"fix_time_ms" json:"fixTimeMs"`
	CreatedAt      time.Time  `db:"created_at" json:"createdAt"`
}

// CreateSessionRequest is the request body for triggering a diagnostic.
type CreateSessionRequest struct {
	TriggerType string   `json:"triggerType" binding:"required"`
	TriggerID   string   `json:"triggerId" binding:"required"`
	Symptoms    []string `json:"symptoms" binding:"required"`
	TenantID    string   `json:"tenantId"`
}

// AddSymptomRequest is the request body for adding a symptom to a session.
type AddSymptomRequest struct {
	Type        string  `json:"type" binding:"required"`
	Source      string  `json:"source" binding:"required"`
	Description string  `json:"description" binding:"required"`
	Severity    string  `json:"severity" binding:"required"`
	Metadata    *string `json:"metadata"`
}

// CreatePatternRequest is the request body for adding a diagnostic pattern.
type CreatePatternRequest struct {
	Name       string  `json:"name" binding:"required"`
	Symptoms   string  `json:"symptoms" binding:"required"`
	RootCause  string  `json:"rootCause" binding:"required"`
	Solution   string  `json:"solution" binding:"required"`
	Category   string  `json:"category" binding:"required"`
}

// RecordOutcomeRequest is the request body for recording an outcome.
type RecordOutcomeRequest struct {
	SessionID       string  `json:"sessionId" binding:"required"`
	PatternID       string  `json:"patternId" binding:"required"`
	Confirmed       bool    `json:"confirmed"`
	ActualRootCause *string `json:"actualRootCause"`
	FixTimeMs       *int64  `json:"fixTimeMs"`
}

// TriggerResult groups session + report returned by trigger.
type TriggerResult struct {
	Session Session `json:"session"`
	Report  Report  `json:"report"`
}

// SessionWithReport includes an optional embedded report.
type SessionWithReport struct {
	Session  Session `json:"session"`
	Report   *Report `json:"report"`
}

// ComplexityEstimate holds fix complexity information.
type ComplexityEstimate struct {
	Level   string  `json:"level"`
	Reason  string  `json:"reason"`
	Effort  *int    `json:"effort"`
}

// KnowledgeBaseStats holds aggregate stats.
type KnowledgeBaseStats struct {
	Patterns    int `json:"patterns"`
	Sessions    int `json:"sessions"`
	Reports     int `json:"reports"`
}

// PaginatedResponse is a generic paginated response.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}
