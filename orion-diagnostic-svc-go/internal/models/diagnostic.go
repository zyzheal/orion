package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// JSONB is a JSONB column type for PostgreSQL
type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(src interface{}) error {
	if src == nil {
		*j = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, j)
	case string:
		return json.Unmarshal([]byte(v), j)
	default:
		return fmt.Errorf("cannot scan %T into JSONB", src)
	}
}

// JSONText is a JSON array text column for PostgreSQL
type JSONText string

func (j JSONText) Value() (driver.Value, error) {
	if j == "" {
		return nil, nil
	}
	return string(j), nil
}

func (j *JSONText) Scan(src interface{}) error {
	if src == nil {
		*j = ""
		return nil
	}
	switch v := src.(type) {
	case []byte:
		*j = JSONText(v)
	case string:
		*j = JSONText(v)
	default:
		return fmt.Errorf("cannot scan %T into JSONText", src)
	}
	return nil
}

// --- Enums ---

// SymptomSeverity represents the severity level of a symptom.
type SymptomSeverity string

const (
	SeverityInfo     SymptomSeverity = "info"
	SeverityWarning  SymptomSeverity = "warning"
	SeverityError    SymptomSeverity = "error"
	SeverityCritical SymptomSeverity = "critical"
)

// DiagnosticCategory classifies the domain of a diagnostic.
type DiagnosticCategory string

const (
	CategoryInfrastructure DiagnosticCategory = "infrastructure"
	CategoryApplication    DiagnosticCategory = "application"
	CategoryNetwork        DiagnosticCategory = "network"
	CategoryDatabase       DiagnosticCategory = "database"
	CategoryDeployment     DiagnosticCategory = "deployment"
	CategoryPipeline       DiagnosticCategory = "pipeline"
	CategorySecurity       DiagnosticCategory = "security"
	CategoryPerformance    DiagnosticCategory = "performance"
	CategoryConfig         DiagnosticCategory = "configuration"
)

// TriggerType is the source that initiated a diagnostic.
type TriggerType string

const (
	TriggerIncident          TriggerType = "incident"
	TriggerDeploymentFailure TriggerType = "deployment_failure"
	TriggerPipelineFailure   TriggerType = "pipeline_failure"
	TriggerHealthCheck       TriggerType = "health_check_failure"
	TriggerManual            TriggerType = "manual"
	TriggerScheduled         TriggerType = "scheduled"
)

// --- DiagnosticSession ---

type DiagnosticSessionStatus string

const (
	SessionStatusPending    DiagnosticSessionStatus = "pending"
	SessionStatusRunning    DiagnosticSessionStatus = "running"
	SessionStatusCompleted  DiagnosticSessionStatus = "completed"
	SessionStatusFailed     DiagnosticSessionStatus = "failed"
	SessionStatusCancelled  DiagnosticSessionStatus = "cancelled"
)

type Symptom struct {
	Type        string                 `json:"type"`
	Source      string                 `json:"source"`
	Description string                 `json:"description"`
	Severity    string                 `json:"severity"`
	Timestamp   time.Time              `json:"timestamp"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

type Finding struct {
	Description      string `json:"description"`
	Category         string `json:"category"`
	Evidence         []string `json:"evidence"`
	Severity         string   `json:"severity"`
	RelatedSymptoms  []string `json:"related_symptoms"`
}

type RecommendedAction struct {
	Description       string   `json:"description"`
	ActionType        string   `json:"action_type"`
	Priority          string   `json:"priority"`
	EstimatedTimeMs   int64    `json:"estimated_time_ms,omitempty"`
	AutomationLevel   string   `json:"automation_level"`
	Commands          []string `json:"commands,omitempty"`
}

type RootCause struct {
	Description         string               `json:"description"`
	Category            string               `json:"category"`
	Confidence          int                  `json:"confidence"`
	Evidence            []string             `json:"evidence"`
	RecommendedActions  []RecommendedAction  `json:"recommended_actions"`
}

// DiagnosticSession represents a single diagnostic procedure.
type DiagnosticSession struct {
	ID          string                    `db:"id" json:"id"`
	TenantID    string                    `db:"tenant_id" json:"tenant_id"`
	Title       string                    `db:"title" json:"title"`
	Status      string                    `db:"status" json:"status"`
	TriggeredBy string                    `db:"triggered_by" json:"triggered_by,omitempty"`
	TriggerType string                    `db:"trigger_type" json:"trigger_type"`
	TriggerID   string                    `db:"trigger_id" json:"trigger_id"`
	Symptoms    JSONText                  `db:"symptoms" json:"symptoms"`
	Findings    JSONText                  `db:"findings" json:"findings"`
	StartedAt   time.Time                 `db:"started_at" json:"started_at"`
	CompletedAt *time.Time                `db:"completed_at" json:"completed_at"`
	UpdatedAt   time.Time                 `db:"updated_at" json:"updated_at"`
	RootCause   *RootCause                `json:"root_cause,omitempty"`
	Confidence  *int                      `json:"confidence,omitempty"`
}

// --- DiagnosticReport ---

type TimelineEntry struct {
	Timestamp  time.Time `json:"timestamp"`
	Description string    `json:"description"`
	EventType  string    `json:"event_type"`
}

// DiagnosticReport is the structured output of a diagnostic session.
type DiagnosticReport struct {
	ID                string             `db:"id" json:"id"`
	TenantID          string             `db:"tenant_id" json:"tenant_id"`
	SessionID         string             `db:"session_id" json:"session_id"`
	Summary           string             `db:"summary" json:"summary"`
	Findings          JSONText           `db:"findings" json:"findings"`
	RootCause         JSONText           `db:"root_cause" json:"root_cause"`
	Recommendations   JSONText           `db:"recommendations" json:"recommendations"`
	Timeline          JSONText           `db:"timeline" json:"timeline"`
	EstimatedFixTimeMs int64             `db:"estimated_fix_time_ms" json:"estimated_fix_time_ms"`
	GeneratedAt       time.Time          `db:"generated_at" json:"generated_at"`
}

// --- KnowledgeEntry (Diagnostic Pattern) ---

type KnowledgeEntry struct {
	ID                string     `db:"id" json:"id"`
	TenantID          string     `db:"tenant_id" json:"tenant_id"`
	Name              string     `db:"name" json:"name"`
	Symptoms          JSONText   `db:"symptoms" json:"symptoms"`
	RootCause         string     `db:"root_cause" json:"root_cause"`
	Solution          string     `db:"solution" json:"solution"`
	Category          string     `db:"category" json:"category"`
	Frequency         int        `db:"frequency" json:"frequency"`
	AverageConfidence int        `db:"average_confidence" json:"average_confidence"`
	CreatedAt         time.Time  `db:"created_at" json:"created_at"`
}

// --- DecisionTreeNode (in-memory, persisted as JSON) ---

type DecisionCondition struct {
	Field    string `json:"field"`
	Operator string `json:"operator"`
	Value    string `json:"value"`
}

type DecisionBranch struct {
	ID                string              `json:"id"`
	Name              string              `json:"name"`
	Conditions        []DecisionCondition `json:"conditions"`
	RecommendedChecks []string            `json:"recommended_checks,omitempty"`
	Children          *DecisionTreeNode   `json:"children,omitempty"`
}

type DecisionTreeNode struct {
	ID             string           `json:"id"`
	Name           string           `json:"name"`
	Description    string           `json:"description"`
	IsLeaf         bool             `json:"is_leaf"`
	Branches       []DecisionBranch `json:"branches"`
	DefaultBranch  *DecisionBranch  `json:"default_branch,omitempty"`
	RootCause      *RootCause       `json:"root_cause,omitempty"`
}

// --- DiagnosticStep ---

type DiagnosticStep struct {
	ID             string    `db:"id" json:"id"`
	SessionID      string    `db:"session_id" json:"session_id"`
	StepType       string    `db:"step_type" json:"step_type"` // correlate, identify, report
	Status         string    `db:"status" json:"status"`
	Result         JSONText  `db:"result" json:"result"`
	ExecutedAt     time.Time `db:"executed_at" json:"executed_at"`
	Error          string    `db:"error" json:"error,omitempty"`
}

// --- Request/Response types ---

type CreateDiagnosticRequest struct {
	TriggerType string   `json:"trigger_type" binding:"required"`
	TriggerID   string   `json:"trigger_id" binding:"required"`
	Symptoms    []Symptom `json:"symptoms" binding:"required"`
	TenantID    string   `json:"tenant_id"`
}

type RunDiagnosticStepRequest struct {
	StepType string `json:"step_type" binding:"required"`
}

type CreateKnowledgeRequest struct {
	Name      string            `json:"name" binding:"required"`
	Symptoms  []SymptomPattern  `json:"symptoms" binding:"required"`
	RootCause string            `json:"root_cause" binding:"required"`
	Solution  string            `json:"solution" binding:"required"`
	Category  string            `json:"category" binding:"required"`
}

type SymptomPattern struct {
	Type       string   `json:"type"`
	SourcePattern string `json:"source_pattern"`
	Keywords   []string `json:"keywords,omitempty"`
	MinSeverity string  `json:"min_severity,omitempty"`
}

type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}
