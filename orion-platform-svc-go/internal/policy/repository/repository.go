package repository

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/policy/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Policy definitions ---

func (r *Repository) CreatePolicy(ctx context.Context, m *models.Policy) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	query := `INSERT INTO policy_definitions (id, tenant_id, name, description, rego, enabled, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :description, :rego, :enabled, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

func (r *Repository) GetPolicy(ctx context.Context, tenantID, id string) (*models.Policy, error) {
	var m models.Policy
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM policy_definitions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) ListPolicies(ctx context.Context, tenantID string, limit, offset int) ([]models.Policy, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.Policy
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM policy_definitions WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	return items, err
}

func (r *Repository) UpdatePolicy(ctx context.Context, tenantID, id string, m *models.Policy) error {
	m.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE policy_definitions SET name=:name, description=:description, rego=:rego, enabled=:enabled, updated_at=:updated_at
			WHERE id=$1 AND tenant_id=$2`, m)
	return err
}

func (r *Repository) DeletePolicy(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM policy_definitions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) TogglePolicy(ctx context.Context, tenantID, id string, enabled bool) (*models.Policy, error) {
	var m models.Policy
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM policy_definitions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	m.Enabled = enabled
	m.UpdatedAt = time.Now().UTC()
	_, err = r.db.NamedExecContext(ctx,
		`UPDATE policy_definitions SET enabled=:enabled, updated_at=:updated_at WHERE id=$1 AND tenant_id=$2`, m)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// --- Policy evaluations ---

func (r *Repository) CreateEvaluation(ctx context.Context, e *models.PolicyEvaluation) error {
	e.ID = uuid.New().String()
	e.CreatedAt = time.Now().UTC()
	query := `INSERT INTO policy_evaluations (id, tenant_id, policy_id, run_id, resource_id, input_json, output_json, decision, executed_by, created_at)
		VALUES (:id, :tenant_id, :policy_id, :run_id, :resource_id, :input_json, :output_json, :decision, :executed_by, :created_at)`
	_, err := r.db.NamedExecContext(ctx, query, e)
	return err
}

func (r *Repository) GetEvaluation(ctx context.Context, tenantID, id string) (*models.PolicyEvaluation, error) {
	var e models.PolicyEvaluation
	err := r.db.GetContext(ctx, &e,
		`SELECT * FROM policy_evaluations WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return &e, err
}

func (r *Repository) ListEvaluations(ctx context.Context, tenantID string, limit, offset int) ([]models.PolicyEvaluation, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.PolicyEvaluation
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM policy_evaluations WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	return items, err
}

func (r *Repository) ListEvaluationHistory(ctx context.Context, tenantID, policyID string, limit, offset int) ([]models.PolicyEvaluation, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.PolicyEvaluation
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM policy_evaluations WHERE tenant_id=$1 AND policy_id=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`, tenantID, policyID, limit, offset)
	return items, err
}

// --- Violations ---

func (r *Repository) CreateViolation(ctx context.Context, v *models.Violation) error {
	v.ID = uuid.New().String()
	v.CreatedAt = time.Now().UTC()
	v.UpdatedAt = time.Now().UTC()
	v.Status = "open"
	query := `INSERT INTO policy_violations (id, tenant_id, policy_id, evaluation_id, run_id, severity, message, status, details, created_at, updated_at)
		VALUES (:id, :tenant_id, :policy_id, :evaluation_id, :run_id, :severity, :message, :status, :details, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, v)
	return err
}

func (r *Repository) GetViolation(ctx context.Context, tenantID, id string) (*models.Violation, error) {
	var v models.Violation
	err := r.db.GetContext(ctx, &v,
		`SELECT * FROM policy_violations WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return &v, err
}

func (r *Repository) ListViolations(ctx context.Context, tenantID string, limit, offset int) ([]models.Violation, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.Violation
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM policy_violations WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	return items, err
}

func (r *Repository) UpdateViolationStatus(ctx context.Context, tenantID, id string, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE policy_violations SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`, status, id, tenantID)
	return err
}

// --- Overrides ---

func (r *Repository) CreateOverride(ctx context.Context, o *models.PolicyOverride) error {
	o.ID = uuid.New().String()
	o.CreatedAt = time.Now().UTC()
	query := `INSERT INTO policy_overrides (id, tenant_id, policy_id, resource_id, override_by, reason, expires_at, created_at)
		VALUES (:id, :tenant_id, :policy_id, :resource_id, :override_by, :reason, :expires_at, :created_at)`
	_, err := r.db.NamedExecContext(ctx, query, o)
	return err
}

func (r *Repository) ListOverrides(ctx context.Context, tenantID string, limit, offset int) ([]models.PolicyOverride, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.PolicyOverride
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM policy_overrides WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	return items, err
}

// --- Bundles ---

func (r *Repository) CreateBundle(ctx context.Context, b *models.PolicyBundle) error {
	b.ID = uuid.New().String()
	b.UpdatedAt = time.Now().UTC()
	query := `INSERT INTO policy_bundles (id, tenant_id, name, source_url, version, status, updated_at)
		VALUES (:id, :tenant_id, :name, :source_url, :version, :status, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, b)
	return err
}

func (r *Repository) GetBundle(ctx context.Context, tenantID, id string) (*models.PolicyBundle, error) {
	var b models.PolicyBundle
	err := r.db.GetContext(ctx, &b,
		`SELECT * FROM policy_bundles WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return &b, err
}

func (r *Repository) ListBundles(ctx context.Context, tenantID string) ([]models.PolicyBundle, error) {
	var items []models.PolicyBundle
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM policy_bundles WHERE tenant_id=$1 ORDER BY updated_at DESC`, tenantID)
	return items, err
}

func (r *Repository) UpdateBundle(ctx context.Context, tenantID, id string, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE policy_bundles SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`, status, id, tenantID)
	return err
}

// --- Exemptions ---

func (r *Repository) CreateExemption(ctx context.Context, e *models.Exemption) error {
	e.ID = uuid.New().String()
	e.CreatedAt = time.Now().UTC()
	e.UpdatedAt = time.Now().UTC()
	e.Status = "pending"
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO policy_exemptions (id, tenant_id, violation_id, policy_id, run_id, reason, category, status, requested_by, reviewed_by, review_note, expires_at, created_at, updated_at)
			VALUES (:id, :tenant_id, :violation_id, :policy_id, :run_id, :reason, :category, :status, :requested_by, :reviewed_by, :review_note, :expires_at, :created_at, :updated_at)`, e)
	return err
}

func (r *Repository) GetExemption(ctx context.Context, tenantID, id string) (*models.Exemption, error) {
	var e models.Exemption
	err := r.db.GetContext(ctx, &e,
		`SELECT * FROM policy_exemptions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return &e, err
}

func (r *Repository) ListExemptions(ctx context.Context, tenantID string, status models.ExemptionStatus, policyID string, limit, offset int) ([]models.Exemption, error) {
	if limit <= 0 {
		limit = 50
	}
	var sql string
	var args []interface{}

	if policyID != "" && status != "" {
		sql = `SELECT * FROM policy_exemptions WHERE tenant_id=$1 AND policy_id=$2 AND status=$3 ORDER BY created_at DESC LIMIT $4 OFFSET $5`
		args = []interface{}{tenantID, policyID, status, limit, offset}
	} else if policyID != "" {
		sql = `SELECT * FROM policy_exemptions WHERE tenant_id=$1 AND policy_id=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`
		args = []interface{}{tenantID, policyID, limit, offset}
	} else if status != "" {
		sql = `SELECT * FROM policy_exemptions WHERE tenant_id=$1 AND status=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`
		args = []interface{}{tenantID, status, limit, offset}
	} else {
		sql = `SELECT * FROM policy_exemptions WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
		args = []interface{}{tenantID, limit, offset}
	}

	var items []models.Exemption
	err := r.db.SelectContext(ctx, &items, sql, args...)
	return items, err
}

func (r *Repository) CountExemptions(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM policy_exemptions WHERE tenant_id=$1`, tenantID)
	return count, err
}

func (r *Repository) UpdateExemption(ctx context.Context, tenantID, id string, status models.ExemptionStatus, reviewer, note string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE policy_exemptions SET status=$1, reviewed_by=$2, review_note=$3, updated_at=NOW() WHERE id=$4 AND tenant_id=$5`, status, reviewer, note, id, tenantID)
	return err
}

// --- Test results (ephemeral - no DB persistence) ---
// Test results are ephemeral, so no repository methods needed.
