package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// JSONB is a convenience type for PostgreSQL JSONB columns.
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

// ComplianceFramework represents a supported compliance framework.
type ComplianceFramework struct {
	ID            string   `json:"id" db:"id"`
	Name          string   `json:"name" db:"name"`
	Description   string   `json:"description" db:"description"`
	Version       string   `json:"version" db:"version"`
	Categories    []string `json:"categories" db:"categories"`
	TotalControls int      `json:"total_controls" db:"total_controls"`
	URL           string   `json:"url" db:"url"`
	Enabled       bool     `json:"enabled" db:"enabled"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

// ComplianceRequirement represents a specific requirement within a framework.
type ComplianceRequirement struct {
	ID          string  `json:"id" db:"id"`
	FrameworkID string  `json:"framework_id" db:"framework_id"`
	Code        string  `json:"code" db:"code"`
	Title       string  `json:"title" db:"title"`
	Description string  `json:"description" db:"description"`
	Category    string  `json:"category" db:"category"`
	ControlType string  `json:"control_type" db:"control_type"`
	Enabled     bool    `json:"enabled" db:"enabled"`
}

// Evidence represents a piece of evidence collected for compliance.
type Evidence struct {
	ID          string                 `json:"id" db:"id"`
	TenantID    string                 `json:"tenant_id" db:"tenant_id"`
	FrameworkID string                 `json:"framework_id" db:"framework_id"`
	RequirementID string               `json:"requirement_id" db:"requirement_id"`
	Type        string                 `json:"type" db:"type"` // screenshot, document, config, log
	Title       string                 `json:"title" db:"title"`
	Description string                 `json:"description" db:"description"`
	Source      string                 `json:"source" db:"source"`
	Data        JSONB                  `json:"data" db:"data"`
	Status      string                 `json:"status" db:"status"` // submitted, verified, expired
	SubmittedAt *time.Time             `json:"submitted_at" db:"submitted_at"`
	VerifiedAt  *time.Time             `json:"verified_at" db:"verified_at"`
	CreatedAt   time.Time              `json:"created_at" db:"created_at"`
}

// CreateEvidenceRequest is the input for creating evidence.
type CreateEvidenceRequest struct {
	FrameworkID   string                 `json:"framework_id" binding:"required"`
	RequirementID string                 `json:"requirement_id" binding:"required"`
	Type          string                 `json:"type" binding:"required"`
	Title         string                 `json:"title"`
	Description   string                 `json:"description"`
	Source        string                 `json:"source"`
	Data          map[string]interface{} `json:"data"`
}

// GapAnalysis represents a gap analysis result.
type GapAnalysis struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	FrameworkID string    `json:"framework_id" db:"framework_id"`
	TotalControls int     `json:"total_controls" db:"total_controls"`
	MetControls   int     `json:"met_controls" db:"met_controls"`
	PartialControls int   `json:"partial_controls" db:"partial_controls"`
	UnmetControls int     `json:"unmet_controls" db:"unmet_controls"`
	GapItems    []GapItem `json:"gap_items" db:"gap_items"`
	AnalysisDate time.Time `json:"analysis_date" db:"analysis_date"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// GapItem represents a single gap identified in analysis.
type GapItem struct {
	RequirementID string  `json:"requirement_id"`
	Title         string  `json:"title"`
	Status        string  `json:"status"` // met, partial, unmet
	Reason        string  `json:"reason"`
}

// CreateGapAnalysisRequest is the input for running gap analysis.
type CreateGapAnalysisRequest struct {
	FrameworkID string `json:"framework_id" binding:"required"`
}

// RemediationPlan represents a compliance gap remediation.
type RemediationPlan struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	FrameworkID string    `json:"framework_id" db:"framework_id"`
	RequirementID string  `json:"requirement_id" db:"requirement_id"`
	Title       string    `json:"title" db:"title"`
	Description string    `json:"description" db:"description"`
	Action      string    `json:"action" db:"action"`
	Assignee    string    `json:"assignee" db:"assignee"`
	DueDate     *time.Time `json:"due_date" db:"due_date"`
	Status      string    `json:"status" db:"status"` // planned, in_progress, completed, closed
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// CreateRemediationRequest is the input for creating remediation.
type CreateRemediationRequest struct {
	FrameworkID   string     `json:"framework_id" binding:"required"`
	RequirementID string     `json:"requirement_id" binding:"required"`
	Title         string     `json:"title" binding:"required"`
	Description   string     `json:"description"`
	Action        string     `json:"action"`
	Assignee      string     `json:"assignee"`
	DueDate       *time.Time `json:"due_date"`
}

// FrameworkListRequest is used to filter frameworks.
type FrameworkListRequest struct {
	Category string `json:"category"`
	Enabled  *bool  `json:"enabled"`
}
