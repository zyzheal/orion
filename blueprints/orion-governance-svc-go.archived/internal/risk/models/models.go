package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// ============================================================
// JSONB helper (scans/serializes JSON columns for PostgreSQL)
// ============================================================

// JSONB is a map type that implements sql.Scanner and driver.Valuer for JSONB columns.
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

// JSONBSlice is a slice type for JSONB array columns (factors, recommendations, etc.).
type JSONBSlice []map[string]interface{}

func (s JSONBSlice) Value() (driver.Value, error) {
	if s == nil {
		return nil, nil
	}
	return json.Marshal(s)
}

func (s *JSONBSlice) Scan(src interface{}) error {
	if src == nil {
		*s = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, s)
	case string:
		return json.Unmarshal([]byte(v), s)
	default:
		return fmt.Errorf("cannot scan %T into JSONBSlice", src)
	}
}

// StringSlice is a string slice type for JSONB string arrays.
type StringSlice []string

func (s StringSlice) Value() (driver.Value, error) {
	if s == nil {
		return nil, nil
	}
	return json.Marshal(s)
}

func (s *StringSlice) Scan(src interface{}) error {
	if src == nil {
		*s = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, s)
	case string:
		return json.Unmarshal([]byte(v), s)
	default:
		return fmt.Errorf("cannot scan %T into StringSlice", src)
	}
}

// ============================================================
// Domain entities (mapped to PostgreSQL tables)
// ============================================================

// RiskItem is a basic risk tracking record.
type RiskItem struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	RiskType    string    `db:"risk_type" json:"risk_type"`
	Level       string    `db:"level" json:"level"`
	Description string    `db:"description" json:"description,omitempty"`
	Mitigation  string    `db:"mitigation" json:"mitigation,omitempty"`
	Status      string    `db:"status" json:"status"`
	Assignee    string    `db:"assignee" json:"assignee,omitempty"`
	Metadata    JSONB     `db:"metadata" json:"metadata"`
	Tags        StringSlice `db:"tags" json:"tags"`
	DueDate     *time.Time `db:"due_date" json:"due_date,omitempty"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

// RiskAssessment stores a risk scoring engine evaluation result.
type RiskAssessment struct {
	ID              string      `db:"id" json:"id"`
	TenantID        string      `db:"tenant_id" json:"tenant_id"`
	Name            string      `db:"name" json:"name"`
	TargetType      string      `db:"target_type" json:"target_type"`
	TargetID        string      `db:"target_id" json:"target_id"`
	RiskScore       float64     `db:"risk_score" json:"risk_score"`
	RiskLevel       string      `db:"risk_level" json:"risk_level"`
	Factors         JSONBSlice  `db:"factors" json:"factors"`
	Recommendations JSONBSlice  `db:"recommendations" json:"recommendations"`
	Status          string      `db:"status" json:"status"`
	Metadata        JSONB       `db:"metadata" json:"metadata"`
	UpdatedAt       time.Time   `db:"updated_at" json:"updated_at"`
	CreatedAt       time.Time   `db:"created_at" json:"created_at"`
}

// RiskReport stores a generated report from a risk assessment.
type RiskReport struct {
	ID                 string      `db:"id" json:"id"`
	TenantID           string      `db:"tenant_id" json:"tenant_id"`
	AssessmentID       string      `db:"assessment_id" json:"assessment_id"`
	RiskScore          float64     `db:"risk_score" json:"risk_score"`
	RiskLevel          string      `db:"risk_level" json:"risk_level"`
	CanDeploy          bool        `db:"can_deploy" json:"can_deploy"`
	CriticalRiskCount  int         `db:"critical_risk_count" json:"critical_risk_count"`
	Summary            JSONB       `db:"summary" json:"summary"`
	Details            JSONB       `db:"details" json:"details"`
	Recommendations    JSONBSlice  `db:"recommendations" json:"recommendations"`
	GeneratedAt        time.Time   `db:"generated_at" json:"generated_at"`
	CreatedAt          time.Time   `db:"created_at" json:"created_at"`
}

// RiskPrediction caches an ML-based risk prediction result.
type RiskPrediction struct {
	ID             string      `db:"id" json:"id"`
	TenantID       *string     `db:"tenant_id" json:"tenant_id,omitempty"`
	TargetType     *string     `db:"target_type" json:"target_type,omitempty"`
	TargetID       *string     `db:"target_id" json:"target_id,omitempty"`
	RiskScore      float64     `db:"risk_score" json:"risk_score"`
	RiskLevel      string      `db:"risk_level" json:"risk_level"`
	Confidence     *float64    `db:"confidence" json:"confidence,omitempty"`
	ModelVersion   string      `db:"model_version" json:"model_version"`
	Features       JSONB       `db:"features" json:"features"`
	ShapValues     JSONBSlice  `db:"shap_values" json:"shap_values,omitempty"`
	TopRiskFactors StringSlice `db:"top_risk_factors" json:"top_risk_factors,omitempty"`
	Metadata       JSONB       `db:"metadata" json:"metadata"`
	ExpiresAt      *time.Time  `db:"expires_at" json:"expires_at,omitempty"`
	CreatedAt      time.Time   `db:"created_at" json:"created_at"`
}

// ============================================================
// Risk scoring domain types (ported from RiskScoringEngine)
// ============================================================

// RiskFactorCategory classifies a risk factor.
type RiskFactorCategory string

const (
	FactorCategoryTechnical      RiskFactorCategory = "technical"
	FactorCategoryHistorical     RiskFactorCategory = "historical"
	FactorCategoryOrganizational RiskFactorCategory = "organizational"
)

// RiskFactor is a single weighted factor contributing to the overall risk score.
type RiskFactor struct {
	Name        string             `json:"name"`
	Weight      float64            `json:"weight"`
	Score       float64            `json:"score"`
	Description string             `json:"description"`
	Category    RiskFactorCategory `json:"category"`
}

// DeploymentRisk holds all input data for risk scoring.
type DeploymentRisk struct {
	ChangeScope   []string           `json:"changeScope"`
	ChangeSize    ChangeSize         `json:"changeSize"`
	TimeRisk      TimeRisk           `json:"timeRisk"`
	DependencyRisk DependencyRisk     `json:"dependencyRisk"`
	HistoricalRisk HistoricalRisk     `json:"historicalRisk"`
}

type ChangeSize struct {
	FilesChanged int `json:"filesChanged"`
	LinesChanged int `json:"linesChanged"`
}

type TimeRisk struct {
	IsWeekend   bool `json:"isWeekend"`
	IsAfterHours bool `json:"isAfterHours"`
	IsHoliday   bool `json:"isHoliday"`
	IsFriday    bool `json:"isFriday"`
}

type DependencyRisk struct {
	TotalDependencies     int      `json:"totalDependencies"`
	UnhealthyDependencies int      `json:"unhealthyDependencies"`
	CriticalDependencies  []string `json:"criticalDependencies"`
}

type HistoricalRisk struct {
	RecentFailureRate float64 `json:"recentFailureRate"`
	RecentIncidents   int     `json:"recentIncidents"`
	AverageMTTR       float64 `json:"averageMTTR"` // milliseconds
}

// RiskRecommendation is a recommendation generated by the scoring engine.
type RiskRecommendation struct {
	ID            string `json:"id"`
	Type          string `json:"type"` // block, warn, info, suggestion
	Title         string `json:"title"`
	Description   string `json:"description"`
	RelatedFactor string `json:"relatedFactor,omitempty"`
	Priority      string `json:"priority"` // critical, high, medium, low
}

// ============================================================
// Health check domain types (ported from HealthCheckService)
// ============================================================

type HealthCheckStatus string

const (
	HealthCheckPass HealthCheckStatus = "pass"
	HealthCheckFail HealthCheckStatus = "fail"
	HealthCheckWarn HealthCheckStatus = "warn"
	HealthCheckSkip HealthCheckStatus = "skip"
)

type HealthCheck struct {
	ID        string            `json:"id"`
	CheckName string            `json:"checkName"`
	Status    HealthCheckStatus `json:"status"`
	Details   string            `json:"details"`
	Duration  int64             `json:"duration"` // ms
	Timestamp time.Time         `json:"timestamp"`
	TargetID  string            `json:"targetId,omitempty"`
}

type HealthCheckResult struct {
	TotalChecks int           `json:"totalChecks"`
	Passed      int           `json:"passed"`
	Failed      int           `json:"failed"`
	Warnings    int           `json:"warnings"`
	Skipped     int           `json:"skipped"`
	CanProceed  bool          `json:"canProceed"`
	Checks      []HealthCheck `json:"checks"`
	ExecutedAt  time.Time     `json:"executedAt"`
}

// TestResults holds test execution results for a health check.
type TestResults struct {
	Total  int `json:"total"`
	Passed int `json:"passed"`
	Failed int `json:"failed"`
}

// ============================================================
// Request / response DTOs
// ============================================================

type CreateRiskItemRequest struct {
	Name        string   `json:"name" binding:"required"`
	RiskType    string   `json:"risk_type" binding:"required"`
	Level       string   `json:"level" binding:"required"`
	Description string   `json:"description"`
	Mitigation  string   `json:"mitigation"`
	Assignee    string   `json:"assignee"`
	Tags        []string `json:"tags"`
	DueDate     *time.Time `json:"due_date"`
}

type UpdateRiskItemRequest struct {
	Name        *string   `json:"name"`
	RiskType    *string   `json:"risk_type"`
	Level       *string   `json:"level"`
	Description *string   `json:"description"`
	Mitigation  *string   `json:"mitigation"`
	Status      *string   `json:"status"`
	Assignee    *string   `json:"assignee"`
	Tags        []string  `json:"tags"`
}

// AssessDeploymentRequest is the HTTP body for POST /risks/assessments/deployment.
type AssessDeploymentRequest struct {
	DeploymentID      string         `json:"deployment_id" binding:"required"`
	DeploymentRisk    DeploymentRisk `json:"deployment_risk" binding:"required"`
	RunHealthChecks   bool           `json:"run_health_checks"`
	PipelineStatus    string         `json:"pipeline_status"`
	TestResults       *TestResults   `json:"test_results"`
	CodeReviewStatus  string         `json:"code_review_status"`
	Dependencies      []string       `json:"dependencies"`
}

// AssessChangeRequest is the HTTP body for POST /risks/assessments/change.
type AssessChangeRequest struct {
	ChangeID       string         `json:"change_id" binding:"required"`
	DeploymentRisk DeploymentRisk `json:"deployment_risk" binding:"required"`
}

// CreateAssessmentRequest is the HTTP body for POST /api/risk/assessments.
type CreateAssessmentRequest struct {
	Name            string        `json:"name" binding:"required"`
	TargetType      string        `json:"target_type" binding:"required"`
	TargetID        string        `json:"target_id" binding:"required"`
	RiskScore       float64       `json:"risk_score"`
	RiskLevel       string        `json:"risk_level"`
	Status          string        `json:"status"`
	Factors         JSONBSlice    `json:"factors"`
	Recommendations JSONBSlice    `json:"recommendations"`
	Metadata        JSONB         `json:"metadata"`
}

// UpdateAssessmentRequest is the HTTP body for PUT /api/risk/assessments/:id.
type UpdateAssessmentRequest struct {
	Name            *string       `json:"name"`
	TargetType      *string       `json:"target_type"`
	TargetID        *string       `json:"target_id"`
	RiskScore       *float64      `json:"risk_score"`
	RiskLevel       *string       `json:"risk_level"`
	Status          *string       `json:"status"`
	Factors         *JSONBSlice   `json:"factors"`
	Recommendations *JSONBSlice   `json:"recommendations"`
}

// GenerateReportRequest is the HTTP body for POST /risks/reports.
type GenerateReportRequest struct {
	AssessmentID string `json:"assessment_id" binding:"required"`
}

// PreDeploymentCheckRequest is the HTTP body for POST /risks/health-checks/pre-deployment.
type PreDeploymentCheckRequest struct {
	TargetID        string       `json:"target_id" binding:"required"`
	PipelineStatus  string       `json:"pipeline_status"`
	TestResults     *TestResults `json:"test_results"`
	CodeReviewStatus string      `json:"code_review_status"`
	Dependencies    []string     `json:"dependencies"`
}

// PaginatedRequest holds pagination parameters.
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

// ============================================================
// Assessment-specific request wrapper for POST (combines scoring + direct)
// ============================================================

// PostAssessmentRequest is the HTTP body for POST /api/risk/assessments.
type PostAssessmentRequest struct {
	Name            string           `json:"name"`
	TargetType      string           `json:"target_type" binding:"required"`
	TargetID        string           `json:"target_id" binding:"required"`
	DeploymentRisk  *DeploymentRisk  `json:"deployment_risk"` // if provided, score is computed
	RiskScore       *float64         `json:"risk_score"`      // if provided, used directly
	RiskLevel       string           `json:"risk_level"`
	Status          string           `json:"status"`
	Factors         JSONBSlice       `json:"factors"`
	Recommendations JSONBSlice       `json:"recommendations"`
}
