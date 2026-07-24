package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

type JSONB map[string]interface{}
func (j JSONB) Value() (driver.Value, error) { if j == nil { return nil, nil }; return json.Marshal(j) }
func (j *JSONB) Scan(src interface{}) error { if src == nil { *j = nil; return nil }; switch v := src.(type) { case []byte: return json.Unmarshal(v, j); case string: return json.Unmarshal([]byte(v), j); default: return fmt.Errorf("cannot scan %T into JSONB", src) } }

type InspectionRule struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description,omitempty"`
	RuleType    string    `db:"rule_type" json:"rule_type"`
	Target      string    `db:"target" json:"target"`
	Condition   JSONB     `db:"condition" json:"condition"`
	Severity    string    `db:"severity" json:"severity"`
	Enabled     bool      `db:"enabled" json:"enabled"`
	Schedule    string    `db:"schedule" json:"schedule,omitempty"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type InspectionResult struct {
	ID         string    `db:"id" json:"id"`
	TenantID   string    `db:"tenant_id" json:"tenant_id"`
	RuleID     string    `db:"rule_id" json:"rule_id"`
	RuleName   string    `db:"rule_name" json:"rule_name"`
	Status     string    `db:"status" json:"status"`
	Target     string    `db:"target" json:"target"`
	Details    JSONB     `db:"details" json:"details,omitempty"`
	Remediation string   `db:"remediation" json:"remediation,omitempty"`
	ExecutedAt time.Time `db:"executed_at" json:"executed_at"`
}

type InspectionTask struct {
	ID          string      `db:"id" json:"id"`
	TenantID    string      `db:"tenant_id" json:"tenant_id"`
	RuleID      string      `db:"rule_id" json:"rule_id"`
	Status      string      `db:"status" json:"status"`
	ResultID    string      `db:"result_id" json:"result_id"`
	StartedAt   *time.Time  `db:"started_at" json:"started_at,omitempty"`
	CompletedAt *time.Time  `db:"completed_at" json:"completed_at,omitempty"`
	CreatedAt   time.Time   `db:"created_at" json:"created_at"`
}

type InspectionReport struct {
	ID          string     `db:"id" json:"id"`
	TenantID    string     `db:"tenant_id" json:"tenant_id"`
	Title       string     `db:"title" json:"title"`
	Summary     JSONB      `db:"summary" json:"summary"`
	GeneratedAt time.Time  `db:"generated_at" json:"generated_at"`
}

type ReportSummary struct {
	Total   int `json:"total"`
	Passed  int `json:"passed"`
	Failed  int `json:"failed"`
	Warning int `json:"warning"`
	Score   int `json:"score"`
}

// --- Request/Response types ---

type CreateRuleRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	RuleType    string `json:"rule_type" binding:"required"`
	Target      string `json:"target" binding:"required"`
	Condition   JSONB  `json:"condition" binding:"required"`
	Severity    string `json:"severity"`
	Schedule    string `json:"schedule"`
}

type CreateReportRequest struct {
	Title   string   `json:"title"`
	RuleIds []string `json:"rule_ids"`
}

type CreateTaskRequest struct {
	RuleId string `json:"rule_id" binding:"required"`
}

type PaginatedRequest struct { Page int `form:"page"`; PageSize int `form:"page_size"` }
func (p *PaginatedRequest) Offset() int { if p.Page <= 0 { p.Page = 1 }; if p.PageSize <= 0 { p.PageSize = 20 }; return (p.Page - 1) * p.PageSize }
func (p *PaginatedRequest) Limit() int { if p.PageSize <= 0 { p.PageSize = 20 }; if p.PageSize > 100 { p.PageSize = 100 }; return p.PageSize }

// HealthScore represents the aggregated health score for a tenant.
type HealthScore struct {
	Total  int                `json:"total"`
	Passed int                `json:"passed"`
	Failed int                `json:"failed"`
	Score  float64            `json:"score"`
	Issues []InspectionIssue  `json:"issues"`
}

// InspectionIssue represents a single issue contributing to the health score.
type InspectionIssue struct {
	RuleID string `json:"rule_id"`
	Title  string `json:"title"`
	Sev    string `json:"severity"`
}
