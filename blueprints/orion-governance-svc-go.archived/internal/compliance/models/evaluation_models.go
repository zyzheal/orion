package models

import "time"

// ==================== Evaluation ====================

// EvaluationStatus represents the status of a compliance evaluation.
type EvaluationStatus string

const (
	EvaluationStatusPending   EvaluationStatus = "pending"
	EvaluationStatusRunning   EvaluationStatus = "running"
	EvaluationStatusCompleted EvaluationStatus = "completed"
	EvaluationStatusFailed    EvaluationStatus = "failed"
)

// ComplianceEvaluation represents a policy compliance evaluation run.
type ComplianceEvaluation struct {
	ID            string             `db:"id" json:"id"`
	TenantID      string             `db:"tenant_id" json:"tenant_id"`
	PolicyID      string             `db:"policy_id" json:"policy_id"`
	Status        EvaluationStatus   `db:"status" json:"status"`
	Score         float64            `db:"score" json:"score"`
	TotalChecks   int                `db:"total_checks" json:"total_checks"`
	PassedChecks  int                `db:"passed_checks" json:"passed_checks"`
	FailedChecks  int                `db:"failed_checks" json:"failed_checks"`
	Findings      JSONB              `db:"findings" json:"findings,omitempty"`
	StartedAt     *time.Time         `db:"started_at" json:"started_at"`
	CompletedAt   *time.Time         `db:"completed_at" json:"completed_at"`
	CreatedAt     time.Time          `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time          `db:"updated_at" json:"updated_at"`
}

// CreateEvaluationInput is the input for evaluating a compliance policy.
type CreateEvaluationInput struct {
	PolicyID string `json:"policy_id" binding:"required"`
}

// ==================== Evidence ====================

// EvidenceStatus represents the status of a compliance evidence item.
type EvidenceStatus string

const (
	EvidenceStatusPending   EvidenceStatus = "pending"
	EvidenceStatusCollected EvidenceStatus = "collected"
	EvidenceStatusReviewed  EvidenceStatus = "reviewed"
	EvidenceStatusRejected  EvidenceStatus = "rejected"
)

// ComplianceEvidence represents a compliance evidence artifact.
type ComplianceEvidence struct {
	ID            string         `db:"id" json:"id"`
	TenantID      string         `db:"tenant_id" json:"tenant_id"`
	PolicyID      string         `db:"policy_id" json:"policy_id"`
	ControlID     string         `db:"control_id" json:"control_id"`
	EvidenceType  string         `db:"evidence_type" json:"evidence_type"`
	Description   string         `db:"description" json:"description"`
	Source        string         `db:"source" json:"source"`
	Status        EvidenceStatus `db:"status" json:"status"`
	CollectedAt   *time.Time     `db:"collected_at" json:"collected_at"`
	ReviewedBy    *string        `db:"reviewed_by" json:"reviewed_by"`
	ReviewedAt    *time.Time     `db:"reviewed_at" json:"reviewed_at"`
	CreatedAt     time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time      `db:"updated_at" json:"updated_at"`
}

// CreateEvidenceInput is the input for collecting compliance evidence.
type CreateEvidenceInput struct {
	PolicyID     string `json:"policy_id" binding:"required"`
	ControlID    string `json:"control_id" binding:"required"`
	EvidenceType string `json:"evidence_type" binding:"required"`
	Description  string `json:"description" binding:"required"`
	Source       string `json:"source"`
}

// ==================== Remediation ====================

// RemediationStatus represents the status of a remediation action.
type RemediationStatus string

const (
	RemediationStatusPending    RemediationStatus = "pending"
	RemediationStatusInProgress RemediationStatus = "in_progress"
	RemediationStatusCompleted  RemediationStatus = "completed"
	RemediationStatusFailed     RemediationStatus = "failed"
)

// ComplianceRemediation represents an auto-remediation action for a compliance gap.
type ComplianceRemediation struct {
	ID          string            `db:"id" json:"id"`
	TenantID    string            `db:"tenant_id" json:"tenant_id"`
	EvaluationID string           `db:"evaluation_id" json:"evaluation_id"`
	GapID       string            `db:"gap_id" json:"gap_id"`
	Status      RemediationStatus `db:"status" json:"status"`
	ActionTaken string            `db:"action_taken" json:"action_taken"`
	Result      *string           `db:"result" json:"result,omitempty"`
	CreatedAt   time.Time         `db:"created_at" json:"created_at"`
	CompletedAt *time.Time        `db:"completed_at" json:"completed_at"`
}

// RemediationGapInput describes a single gap to remediate.
type RemediationGapInput struct {
	GapID        string `json:"gap_id"`
	EvaluationID string `json:"evaluation_id"`
}

// ==================== Gap Analysis ====================

// GapAnalysisResult represents the result of a gap analysis.
type GapAnalysisResult struct {
	FrameworkID      string                     `json:"framework_id"`
	OverallScore     float64                    `json:"overall_score"`
	TotalGaps        int                        `json:"total_gaps"`
	CriticalGaps     int                        `json:"critical_gaps"`
	HighGaps         int                        `json:"high_gaps"`
	MediumGaps       int                        `json:"medium_gaps"`
	LowGaps          int                        `json:"low_gaps"`
	Gaps             []GapAnalysisGap           `json:"gaps"`
	Recommendations  []string                   `json:"recommendations"`
	AnalyzedAt       time.Time                  `json:"analyzed_at"`
}

// GapAnalysisGap represents a single gap in the analysis.
type GapAnalysisGap struct {
	ID            string          `json:"id"`
	ControlID     string          `json:"control_id"`
	ControlName   string          `json:"control_name"`
	Severity      FindingSeverity `json:"severity"`
	Description   string          `json:"description"`
	Status        string          `json:"status"`
	Category      string          `json:"category"`
	Recommendation string         `json:"recommendation"`
}

// ==================== Score ====================

// ComplianceScore represents an overall compliance score for a tenant.
type ComplianceScore struct {
	TenantID          string                   `json:"tenant_id"`
	OverallScore      float64                  `json:"overall_score"`
	PoliciesEvaluated int                      `json:"policies_evaluated"`
	PoliciesByFramework map[string]float64    `json:"policies_by_framework"`
	OpenGaps          int                      `json:"open_gaps"`
	CriticalGaps      int                      `json:"critical_gaps"`
}

// ==================== Evidence Generation ====================

// EvidenceGenerationResult represents the result of a generated evidence collection.
type EvidenceGenerationResult struct {
	FrameworkID  string                  `json:"framework_id"`
	TotalItems   int                     `json:"total_items"`
	Items        []EvidenceGenerationItem `json:"items"`
	GeneratedAt  time.Time               `json:"generated_at"`
}

// EvidenceGenerationItem represents a single generated evidence item.
type EvidenceGenerationItem struct {
	ControlID     string `json:"control_id"`
	ControlName   string `json:"control_name"`
	EvidenceType  string `json:"evidence_type"`
	Description   string `json:"description"`
	CollectionHint string `json:"collection_hint"`
}
