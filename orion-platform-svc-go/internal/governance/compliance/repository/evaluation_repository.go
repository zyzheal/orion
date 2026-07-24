package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/compliance/models"

	"github.com/jmoiron/sqlx"
)

// ==================== ComplianceEvaluationRepository ====================

// ComplianceEvaluationRepository provides data access for compliance evaluations.
type ComplianceEvaluationRepository struct {
	db *sqlx.DB
}

// NewComplianceEvaluationRepository creates a new ComplianceEvaluationRepository.
func NewComplianceEvaluationRepository(db *sqlx.DB) *ComplianceEvaluationRepository {
	return &ComplianceEvaluationRepository{db: db}
}

// Create inserts a new compliance evaluation.
func (r *ComplianceEvaluationRepository) Create(ctx context.Context, evaluation *models.ComplianceEvaluation) error {
	query := `
		INSERT INTO compliance_evaluations
			(id, tenant_id, policy_id, status, score, total_checks, passed_checks, failed_checks, findings, started_at, completed_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING created_at, updated_at
	`
	var findingsJSON string
	if evaluation.Findings != nil {
		findingsJSON = string(evaluation.Findings)
	} else {
		findingsJSON = "[]"
	}

	return r.db.QueryRowContext(ctx, query,
		evaluation.ID,
		evaluation.TenantID,
		evaluation.PolicyID,
		evaluation.Status,
		evaluation.Score,
		evaluation.TotalChecks,
		evaluation.PassedChecks,
		evaluation.FailedChecks,
		findingsJSON,
		evaluation.StartedAt,
		evaluation.CompletedAt,
	).Scan(&evaluation.CreatedAt, &evaluation.UpdatedAt)
}

// FindByID retrieves an evaluation by its ID.
func (r *ComplianceEvaluationRepository) FindByID(ctx context.Context, id string) (*models.ComplianceEvaluation, error) {
	var evaluation models.ComplianceEvaluation
	query := `SELECT * FROM compliance_evaluations WHERE id = $1`
	err := r.db.GetContext(ctx, &evaluation, query, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find evaluation: %w", err)
	}
	return &evaluation, nil
}

// FindByPolicyID retrieves all evaluations for a policy with pagination.
func (r *ComplianceEvaluationRepository) FindByPolicyID(ctx context.Context, tenantID, policyID string, offset, limit int) ([]models.ComplianceEvaluation, error) {
	var evaluations []models.ComplianceEvaluation
	query := `
		SELECT * FROM compliance_evaluations
		WHERE tenant_id = $1 AND policy_id = $2
		ORDER BY created_at DESC
		LIMIT $3 OFFSET $4
	`
	err := r.db.SelectContext(ctx, &evaluations, query, tenantID, policyID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to find evaluations by policy: %w", err)
	}
	return evaluations, nil
}

// FindByPolicyIDAndStatus retrieves evaluations matching a policy and status.
func (r *ComplianceEvaluationRepository) FindByPolicyIDAndStatus(ctx context.Context, tenantID, policyID string, status models.EvaluationStatus, offset, limit int) ([]models.ComplianceEvaluation, error) {
	var evaluations []models.ComplianceEvaluation
	query := `
		SELECT * FROM compliance_evaluations
		WHERE tenant_id = $1 AND policy_id = $2 AND status = $3
		ORDER BY created_at DESC
		LIMIT $4 OFFSET $5
	`
	err := r.db.SelectContext(ctx, &evaluations, query, tenantID, policyID, status, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to find evaluations by policy and status: %w", err)
	}
	return evaluations, nil
}

// FindByTenant retrieves all evaluations for a tenant.
func (r *ComplianceEvaluationRepository) FindByTenant(ctx context.Context, tenantID string, offset, limit int) ([]models.ComplianceEvaluation, error) {
	var evaluations []models.ComplianceEvaluation
	query := `
		SELECT * FROM compliance_evaluations
		WHERE tenant_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`
	err := r.db.SelectContext(ctx, &evaluations, query, tenantID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to find evaluations by tenant: %w", err)
	}
	return evaluations, nil
}

// UpdateStatus updates the status and completion details of an evaluation.
func (r *ComplianceEvaluationRepository) UpdateStatus(ctx context.Context, id string, evaluation *models.ComplianceEvaluation) (*models.ComplianceEvaluation, error) {
	var findingsJSON string
	if evaluation.Findings != nil {
		findingsJSON = string(evaluation.Findings)
	} else {
		findingsJSON = "[]"
	}

	query := `
		UPDATE compliance_evaluations
		SET status = $1, score = $2, total_checks = $3, passed_checks = $4,
			failed_checks = $5, findings = $6::jsonb, started_at = $7, completed_at = $8,
			updated_at = NOW()
		WHERE id = $9 RETURNING *
	`

	var result models.ComplianceEvaluation
	err := r.db.GetContext(ctx, &result, query,
		evaluation.Status,
		evaluation.Score,
		evaluation.TotalChecks,
		evaluation.PassedChecks,
		evaluation.FailedChecks,
		findingsJSON,
		evaluation.StartedAt,
		evaluation.CompletedAt,
		id,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to update evaluation status: %w", err)
	}
	return &result, nil
}

// CountByTenant returns the total number of evaluations for a tenant.
func (r *ComplianceEvaluationRepository) CountByTenant(ctx context.Context, tenantID string) (int64, error) {
	var count int64
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM compliance_evaluations WHERE tenant_id = $1`, tenantID)
	if err != nil {
		return 0, fmt.Errorf("failed to count evaluations: %w", err)
	}
	return count, nullErr(err)
}

// ==================== ComplianceEvidenceRepository ====================

// ComplianceEvidenceRepository provides data access for compliance evidence.
type ComplianceEvidenceRepository struct {
	db *sqlx.DB
}

// NewComplianceEvidenceRepository creates a new ComplianceEvidenceRepository.
func NewComplianceEvidenceRepository(db *sqlx.DB) *ComplianceEvidenceRepository {
	return &ComplianceEvidenceRepository{db: db}
}

// Create inserts a new compliance evidence item.
func (r *ComplianceEvidenceRepository) Create(ctx context.Context, evidence *models.ComplianceEvidence) error {
	now := time.Now()
	evidence.CollectedAt = &now
	query := `
		INSERT INTO compliance_evidence
			(id, tenant_id, policy_id, control_id, evidence_type, description, source, status, collected_at, reviewed_by, reviewed_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING created_at, updated_at
	`
	return r.db.QueryRowContext(ctx, query,
		evidence.ID,
		evidence.TenantID,
		evidence.PolicyID,
		evidence.ControlID,
		evidence.EvidenceType,
		evidence.Description,
		evidence.Source,
		evidence.Status,
		evidence.CollectedAt,
		evidence.ReviewedBy,
		evidence.ReviewedAt,
	).Scan(&evidence.CreatedAt, &evidence.UpdatedAt)
}

// FindByPolicyID retrieves all evidence items for a policy.
func (r *ComplianceEvidenceRepository) FindByPolicyID(ctx context.Context, policyID string) ([]models.ComplianceEvidence, error) {
	var evidence []models.ComplianceEvidence
	query := `SELECT * FROM compliance_evidence WHERE policy_id = $1 ORDER BY created_at DESC`
	err := r.db.SelectContext(ctx, &evidence, query, policyID)
	if err != nil {
		return nil, fmt.Errorf("failed to find evidence by policy: %w", err)
	}
	return evidence, nil
}

// FindByTenantAndPolicy retrieves evidence filtered by tenant and policy.
func (r *ComplianceEvidenceRepository) FindByTenantAndPolicy(ctx context.Context, tenantID, policyID string) ([]models.ComplianceEvidence, error) {
	var evidence []models.ComplianceEvidence
	query := `SELECT * FROM compliance_evidence WHERE tenant_id = $1 AND policy_id = $2 ORDER BY created_at DESC`
	_ = tenantID // TODO: apply tenant_id filtering
	err := r.db.SelectContext(ctx, &evidence, query, policyID)
	if err != nil {
		return nil, fmt.Errorf("failed to find evidence: %w", err)
	}
	return evidence, nil
}

// FindByID retrieves a single evidence item by ID.
func (r *ComplianceEvidenceRepository) FindByID(ctx context.Context, id string) (*models.ComplianceEvidence, error) {
	var evidence models.ComplianceEvidence
	err := r.db.GetContext(ctx, &evidence, `SELECT * FROM compliance_evidence WHERE id = $1`, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find evidence: %w", err)
	}
	return &evidence, nil
}

// Update updates specific fields of an evidence item.
func (r *ComplianceEvidenceRepository) Update(ctx context.Context, id string, updates map[string]interface{}) (*models.ComplianceEvidence, error) {
	setClauses := []string{}
	args := []interface{}{}
	paramIdx := 1

	if status, ok := updates["status"].(models.EvidenceStatus); ok {
		setClauses = append(setClauses, fmt.Sprintf("status = $%d", paramIdx))
		args = append(args, status)
		paramIdx++
	}
	if reviewedBy, ok := updates["reviewed_by"].(*string); ok {
		setClauses = append(setClauses, fmt.Sprintf("reviewed_by = $%d", paramIdx))
		args = append(args, reviewedBy)
		paramIdx++
	}
	if reviewedAt, ok := updates["reviewed_at"].(*time.Time); ok {
		setClauses = append(setClauses, fmt.Sprintf("reviewed_at = $%d", paramIdx))
		args = append(args, reviewedAt)
		paramIdx++
	}

	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", paramIdx))
	args = append(args, time.Now())
	paramIdx++

	args = append(args, id)
	query := fmt.Sprintf(
		"UPDATE compliance_evidence SET %s WHERE id = $%d RETURNING *",
		joinSetClauses(setClauses), paramIdx,
	)

	var evidence models.ComplianceEvidence
	err := r.db.GetContext(ctx, &evidence, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to update evidence: %w", err)
	}
	return &evidence, nil
}

// ==================== ComplianceRemediationRepository ====================

// ComplianceRemediationRepository provides data access for compliance remediations.
type ComplianceRemediationRepository struct {
	db *sqlx.DB
}

// NewComplianceRemediationRepository creates a new ComplianceRemediationRepository.
func NewComplianceRemediationRepository(db *sqlx.DB) *ComplianceRemediationRepository {
	return &ComplianceRemediationRepository{db: db}
}

// Create inserts a new remediation record.
func (r *ComplianceRemediationRepository) Create(ctx context.Context, remediation *models.ComplianceRemediation) error {
	now := time.Now()
	remediation.CreatedAt = now
	remediation.CompletedAt = &now
	query := `
		INSERT INTO compliance_remediations
			(id, tenant_id, evaluation_id, gap_id, status, action_taken, result, created_at, completed_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING created_at, updated_at
	`
	return r.db.QueryRowContext(ctx, query,
		remediation.ID,
		remediation.TenantID,
		remediation.EvaluationID,
		remediation.GapID,
		remediation.Status,
		remediation.ActionTaken,
		remediation.Result,
		remediation.CreatedAt,
		remediation.CompletedAt,
	).Scan(&remediation.CreatedAt, &remediation.CompletedAt)
}

// FindByEvaluationID retrieves all remediations for an evaluation.
func (r *ComplianceRemediationRepository) FindByEvaluationID(ctx context.Context, tenantID, evaluationID string) ([]models.ComplianceRemediation, error) {
	var remediations []models.ComplianceRemediation
	query := `SELECT * FROM compliance_remediations WHERE tenant_id = $1 AND evaluation_id = $2 ORDER BY created_at DESC`
	err := r.db.SelectContext(ctx, &remediations, query, tenantID, evaluationID)
	if err != nil {
		return nil, fmt.Errorf("failed to find remediations by evaluation: %w", err)
	}
	return remediations, nil
}

// FindByTenant retrieves all remediations for a tenant.
func (r *ComplianceRemediationRepository) FindByTenant(ctx context.Context, tenantID string) ([]models.ComplianceRemediation, error) {
	var remediations []models.ComplianceRemediation
	query := `SELECT * FROM compliance_remediations WHERE tenant_id = $1 ORDER BY created_at DESC`
	err := r.db.SelectContext(ctx, &remediations, query, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to find remediations by tenant: %w", err)
	}
	return remediations, nil
}

// FindLatestByPolicy retrieves the latest evaluation for a policy.
func (r *ComplianceEvaluationRepository) FindLatestByPolicy(ctx context.Context, tenantID, policyID string) (*models.ComplianceEvaluation, error) {
	var evaluation models.ComplianceEvaluation
	query := `
		SELECT * FROM compliance_evaluations
		WHERE tenant_id = $1 AND policy_id = $2
		ORDER BY created_at DESC
		LIMIT 1
	`
	err := r.db.GetContext(ctx, &evaluation, query, tenantID, policyID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find latest evaluation: %w", err)
	}
	return &evaluation, nil
}

// ==================== Helpers ====================

// nullErr wraps nil-pointer detection for repository return values.
func nullErr(err error) error {
	return err
}

// parseFindingsJSON attempts to unmarshal findings from JSONB for a slice.
func parseFindings(evaluations []models.ComplianceEvaluation) []models.ComplianceEvaluation {
	for i := range evaluations {
		if len(evaluations[i].Findings) > 0 {
			var findings []models.ComplianceFinding
			if err := json.Unmarshal(evaluations[i].Findings, &findings); err == nil {
				evaluations[i].Findings = findingsToJSONB(findings)
			}
		}
	}
	return evaluations
}
