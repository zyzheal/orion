package models

import "time"

// --- Compliance Policy ---

type CompliancePolicy struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Framework string    `json:"framework" db:"framework"`
	Rules     string    `json:"rules" db:"rules"` // JSON string of rule definitions
	Status    string    `json:"status" db:"status"` // active, inactive
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type CreatePolicyRequest struct {
	Name      string `json:"name" binding:"required"`
	Framework string `json:"framework" binding:"required"`
	Rules     string `json:"rules"` // JSON string
}

// --- Compliance Evaluation ---

type EvaluateComplianceRequest struct {
	PolicyID  string   `json:"policy_id" binding:"required"`
	Targets   []string `json:"targets"`
	Framework string   `json:"framework"`
}

type ComplianceEvaluationResult struct {
	PolicyID   string                 `json:"policy_id"`
	Status     string                 `json:"status"` // compliant, non_compliant, partial
	Score      float64                `json:"score"`
	Failures   []string               `json:"failures"`
	Warnings   []string               `json:"warnings"`
	EvaluatedAt time.Time             `json:"evaluated_at"`
}

// --- Compliance Report ---

type ComplianceReport struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	PolicyID    string    `json:"policy_id" db:"policy_id"`
	Status      string    `json:"status" db:"status"`
	Score       float64   `json:"score" db:"score"`
	Failures    string    `json:"failures" db:"failures"` // JSON
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// --- Compliance Score ---

type ComplianceScore struct {
	OverallScore  float64 `json:"overall_score"`
	CategoryScores map[string]float64 `json:"category_scores"`
	Trend         string  `json:"trend"` // improving, stable, declining
	LastUpdated   time.Time `json:"last_updated"`
}

// --- Remediation ---

type RemediationRequest struct {
	PolicyID string `json:"policy_id" binding:"required"`
	Actions  []string `json:"actions"`
}

type RemediationResult struct {
	Applied   []string `json:"applied"`
	Skipped   []string `json:"skipped"`
	Failures  []string `json:"failures"`
}

// --- Audit Plan ---

type AuditPlan struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	Schedule    string    `json:"schedule" db:"schedule"` // cron expression or interval
	Status      string    `json:"status" db:"status"` // scheduled, in_progress, completed
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type CreateAuditPlanRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Schedule    string `json:"schedule"`
}

// --- Audit Execution ---

type AuditExecution struct {
	ID        string    `json:"id" db:"id"`
	PlanID    string    `json:"plan_id" db:"plan_id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Status    string    `json:"status" db:"status"` // running, completed, failed
	Result    string    `json:"result" db:"result"` // JSON
	StartedAt time.Time `json:"started_at" db:"started_at"`
	EndedAt   *time.Time `json:"ended_at,omitempty" db:"ended_at"`
}

// --- Audit Report ---

type AuditReport struct {
	ID           string    `json:"id" db:"id"`
	ExecutionID  string    `json:"execution_id" db:"execution_id"`
	TenantID     string    `json:"tenant_id" db:"tenant_id"`
	Summary      string    `json:"summary" db:"summary"` // JSON
	FindingsCount int      `json:"findings_count" db:"findings_count"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

// --- Audit Finding ---

type AuditFinding struct {
	ID        string `json:"id" db:"id"`
	ReportID  string `json:"report_id" db:"report_id"`
	TenantID  string `json:"tenant_id" db:"tenant_id"`
	Severity  string `json:"severity" db:"severity"` // low, medium, high, critical
	Title     string `json:"title" db:"title"`
	Description string `json:"description" db:"description"`
	Status    string `json:"status" db:"status"` // open, in_progress, closed
	ClosedAt  *time.Time `json:"closed_at,omitempty" db:"closed_at"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type CloseFindingRequest struct {
	Reason string `json:"reason" binding:"required"`
}

// --- Compliance Framework ---

type ComplianceFramework struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	Version     string    `json:"version" db:"version"`
	Controls    string    `json:"controls" db:"controls"` // JSON
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// --- Evidence ---

type Evidence struct {
	ID         string    `json:"id" db:"id"`
	TenantID   string    `json:"tenant_id" db:"tenant_id"`
	PolicyID   string    `json:"policy_id" db:"policy_id"`
	Source     string    `json:"source" db:"source"`
	Data       string    `json:"data" db:"data"` // JSON
	Status     string    `json:"status" db:"status"` // collected, verified, expired
	CollectedAt time.Time `json:"collected_at" db:"collected_at"`
}

type CollectEvidenceRequest struct {
	PolicyID string   `json:"policy_id" binding:"required"`
	Sources  []string `json:"sources"`
}

type EvidenceCollection struct {
	Evidence []Evidence `json:"evidence"`
	Count    int        `json:"count"`
}

// --- Gap Analysis ---

type GapAnalysisRequest struct {
	Framework string   `json:"framework" binding:"required"`
	Targets   []string `json:"targets"`
}

type GapAnalysisResult struct {
	Framework      string           `json:"framework"`
	TotalControls  int              `json:"total_controls"`
	Implemented    int              `json:"implemented"`
	Partial        int              `json:"partial"`
	NotImplemented int              `json:"not_implemented"`
	Gaps           []GapAnalysisItem `json:"gaps"`
}

type GapAnalysisItem struct {
	ControlID     string `json:"control_id"`
	ControlName   string `json:"control_name"`
	Compliance    string `json:"compliance"` // implemented, partial, not_implemented
	Recommendation string `json:"recommendation"`
}

// --- Frameworks (built-in supported list) ---

type FrameworkList struct {
	Frameworks []ComplianceFramework `json:"frameworks"`
}
