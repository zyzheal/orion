package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"orion/governance-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ==================== Policy Definition ====================

func (r *Repository) CreatePolicy(ctx context.Context, p *models.Policy) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO policy_definitions (id, tenant_id, name, description, category, rego_path, gate_id, severity, enabled, metadata)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		p.ID, p.TenantID, p.Name, p.Description, p.Category, p.RegoPath, p.GateID, p.Severity, p.Enabled, p.Metadata,
	)
	return err
}

func (r *Repository) GetPolicyByID(ctx context.Context, tenantID, id string) (*models.Policy, error) {
	var p models.Policy
	err := r.db.GetContext(ctx, &p,
		`SELECT * FROM policy_definitions WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

func (r *Repository) GetPolicyByIDAny(ctx context.Context, id string) (*models.Policy, error) {
	var p models.Policy
	err := r.db.GetContext(ctx, &p,
		`SELECT * FROM policy_definitions WHERE id = $1`, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

func (r *Repository) ListPolicies(ctx context.Context, tenantID string, offset, limit int) ([]models.Policy, int, error) {
	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM policy_definitions WHERE tenant_id = $1`, tenantID)
	if err != nil {
		return nil, 0, err
	}

	var items []models.Policy
	err = r.db.SelectContext(ctx, &items,
		`SELECT * FROM policy_definitions WHERE tenant_id = $1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, total, err
}

func (r *Repository) ListPoliciesByCategory(ctx context.Context, tenantID, category string, offset, limit int) ([]models.Policy, int, error) {
	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM policy_definitions WHERE tenant_id = $1 AND category = $2`, tenantID, category)
	if err != nil {
		return nil, 0, err
	}

	var items []models.Policy
	err = r.db.SelectContext(ctx, &items,
		`SELECT * FROM policy_definitions WHERE tenant_id = $1 AND category = $2 ORDER BY created_at DESC OFFSET $3 LIMIT $4`,
		tenantID, category, offset, limit)
	return items, total, err
}

func (r *Repository) ListEnabledPolicies(ctx context.Context, tenantID string) ([]models.Policy, error) {
	var items []models.Policy
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM policy_definitions WHERE tenant_id = $1 AND enabled = true ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) UpdatePolicy(ctx context.Context, tenantID, id string, req *models.UpdatePolicyRequest) (*models.Policy, error) {
	sets := []string{}
	args := []interface{}{}
	idx := 1

	if req.Description != nil {
		sets = append(sets, fmt.Sprintf("description = $%d", idx))
		args = append(args, *req.Description)
		idx++
	}
	if req.Category != nil {
		sets = append(sets, fmt.Sprintf("category = $%d", idx))
		args = append(args, *req.Category)
		idx++
	}
	if req.RegoPath != nil {
		sets = append(sets, fmt.Sprintf("rego_path = $%d", idx))
		args = append(args, *req.RegoPath)
		idx++
	}
	if req.GateID != nil {
		sets = append(sets, fmt.Sprintf("gate_id = $%d", idx))
		args = append(args, *req.GateID)
		idx++
	}
	if req.Severity != nil {
		sets = append(sets, fmt.Sprintf("severity = $%d", idx))
		args = append(args, *req.Severity)
		idx++
	}
	if req.Enabled != nil {
		sets = append(sets, fmt.Sprintf("enabled = $%d", idx))
		args = append(args, *req.Enabled)
		idx++
	}
	if req.Metadata != nil {
		sets = append(sets, fmt.Sprintf("metadata = $%d", idx))
		args = append(args, req.Metadata)
		idx++
	}

	if len(sets) == 0 {
		return r.GetPolicyByID(ctx, tenantID, id)
	}

	sets = append(sets, "updated_at = NOW()")
	args = append(args, id, tenantID)

	query := fmt.Sprintf(
		`UPDATE policy_definitions SET %s WHERE id = $%d AND tenant_id = $%d RETURNING *`,
		strings.Join(sets, ", "), idx, idx+1,
	)

	var p models.Policy
	err := r.db.GetContext(ctx, &p, query, args...)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

func (r *Repository) DeletePolicy(ctx context.Context, tenantID, id string) (bool, error) {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM policy_definitions WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := res.RowsAffected()
	return rows > 0, nil
}

// ==================== Policy Bundle ====================

func (r *Repository) FindActiveBundle(ctx context.Context, tenantID string) (*models.PolicyBundle, error) {
	var b models.PolicyBundle
	err := r.db.GetContext(ctx, &b,
		`SELECT * FROM policy_bundles WHERE tenant_id = $1 AND active = true ORDER BY created_at DESC LIMIT 1`, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &b, nil
}

func (r *Repository) ListBundles(ctx context.Context, tenantID string) ([]models.PolicyBundle, error) {
	var items []models.PolicyBundle
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM policy_bundles WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) GetBundleByID(ctx context.Context, tenantID, id string) (*models.PolicyBundle, error) {
	var b models.PolicyBundle
	err := r.db.GetContext(ctx, &b,
		`SELECT * FROM policy_bundles WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &b, nil
}

func (r *Repository) FindPoliciesByGateID(ctx context.Context, tenantID, gateID string) ([]models.Policy, error) {
	var items []models.Policy
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM policy_definitions WHERE tenant_id = $1 AND gate_id = $2 AND enabled = true`, tenantID, gateID)
	return items, err
}

// ==================== Policy Evaluation ====================

func (r *Repository) CreateEvaluation(ctx context.Context, e *models.PolicyEvaluation) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO policy_evaluations (id, policy_id, run_id, input_context, result, evaluated_at, evaluation_ms)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		e.ID, e.PolicyID, e.RunID, e.InputContext, e.Result, e.EvaluatedAt, e.EvaluationMs,
	)
	return err
}

func (r *Repository) GetEvaluationByID(ctx context.Context, id string) (*models.PolicyEvaluation, error) {
	var e models.PolicyEvaluation
	err := r.db.GetContext(ctx, &e,
		`SELECT * FROM policy_evaluations WHERE id = $1`, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &e, nil
}

func (r *Repository) FindEvaluationsByRunID(ctx context.Context, runID string) ([]models.PolicyEvaluation, error) {
	var items []models.PolicyEvaluation
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM policy_evaluations WHERE run_id = $1 ORDER BY evaluated_at DESC`, runID)
	return items, err
}

func (r *Repository) FindEvaluationsByPolicyID(ctx context.Context, policyID string, limit, offset int) ([]models.PolicyEvaluation, error) {
	var items []models.PolicyEvaluation
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM policy_evaluations WHERE policy_id = $1 ORDER BY evaluated_at DESC OFFSET $2 LIMIT $3`,
		policyID, offset, limit)
	return items, err
}

func (r *Repository) ListEvaluations(ctx context.Context, limit, offset int) ([]models.PolicyEvaluation, int, error) {
	var total int
	err := r.db.GetContext(ctx, &total, `SELECT COUNT(*) FROM policy_evaluations`)
	if err != nil {
		return nil, 0, err
	}

	var items []models.PolicyEvaluation
	err = r.db.SelectContext(ctx, &items,
		`SELECT * FROM policy_evaluations ORDER BY evaluated_at DESC OFFSET $1 LIMIT $2`, offset, limit)
	return items, total, err
}

func (r *Repository) ListEvaluationsByTenant(ctx context.Context, tenantID string, limit, offset int) ([]models.PolicyEvaluation, int, error) {
	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM policy_evaluations WHERE run_id IN (SELECT run_id FROM policy_evaluations WHERE input_context->>'tenantId' = $1)`,
		tenantID)
	if err != nil {
		return nil, 0, err
	}

	var items []models.PolicyEvaluation
	err = r.db.SelectContext(ctx, &items,
		`SELECT * FROM policy_evaluations ORDER BY evaluated_at DESC OFFSET $1 LIMIT $2`, offset, limit)
	return items, total, err
}

// ==================== Policy Violation ====================

func (r *Repository) CreateViolation(ctx context.Context, v *models.PolicyViolation) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO policy_violations (id, evaluation_id, policy_id, severity, message, resource_type, resource_id, status)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		v.ID, v.EvaluationID, v.PolicyID, v.Severity, v.Message, v.ResourceType, v.ResourceID, v.Status,
	)
	return err
}

func (r *Repository) GetViolationByID(ctx context.Context, id string) (*models.PolicyViolation, error) {
	var v models.PolicyViolation
	err := r.db.GetContext(ctx, &v,
		`SELECT * FROM policy_violations WHERE id = $1`, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &v, nil
}

func (r *Repository) ListViolations(ctx context.Context, filter ViolationFilter) ([]models.PolicyViolation, int, error) {
	conditions := []string{"1=1"}
	args := []interface{}{}
	idx := 1

	if filter.Status != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", idx))
		args = append(args, filter.Status)
		idx++
	}
	if filter.Severity != "" {
		conditions = append(conditions, fmt.Sprintf("severity = $%d", idx))
		args = append(args, filter.Severity)
		idx++
	}
	if filter.PolicyID != "" {
		conditions = append(conditions, fmt.Sprintf("policy_id = $%d", idx))
		args = append(args, filter.PolicyID)
		idx++
	}

	where := strings.Join(conditions, " AND ")

	var total int
	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM policy_violations WHERE %s`, where)
	err := r.db.GetContext(ctx, &total, countQuery, args...)
	if err != nil {
		return nil, 0, err
	}

	args = append(args, filter.Offset, filter.Limit)
	query := fmt.Sprintf(
		`SELECT * FROM policy_violations WHERE %s ORDER BY created_at DESC OFFSET $%d LIMIT $%d`,
		where, idx, idx+1,
	)

	var items []models.PolicyViolation
	err = r.db.SelectContext(ctx, &items, query, args...)
	return items, total, err
}

func (r *Repository) UpdateViolationStatus(ctx context.Context, id, status string) (*models.PolicyViolation, error) {
	var v models.PolicyViolation
	err := r.db.GetContext(ctx, &v,
		`UPDATE policy_violations SET status = $1 WHERE id = $2 RETURNING *`, status, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &v, nil
}

func (r *Repository) FindViolationsByPolicyID(ctx context.Context, policyID string) ([]models.PolicyViolation, error) {
	var items []models.PolicyViolation
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM policy_violations WHERE policy_id = $1 ORDER BY created_at DESC`, policyID)
	return items, err
}

func (r *Repository) FindViolationsByStatus(ctx context.Context, status string) ([]models.PolicyViolation, error) {
	var items []models.PolicyViolation
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM policy_violations WHERE status = $1 ORDER BY created_at DESC`, status)
	return items, err
}

type ViolationFilter struct {
	Status    string
	Severity  string
	PolicyID  string
	Limit     int
	Offset    int
}

// ==================== Policy Override ====================

func (r *Repository) CreateOverride(ctx context.Context, o *models.PolicyOverride) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO policy_overrides (id, tenant_id, policy_id, pipeline_id, run_id, violation_id, reason, approved_by, approved_at, status, expires_at, scope, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
		o.ID, o.TenantID, o.PolicyID, o.PipelineID, o.RunID, o.ViolationID,
		o.Reason, o.ApprovedBy, o.ApprovedAt, o.Status, o.ExpiresAt, o.Scope,
		o.CreatedAt, o.UpdatedAt,
	)
	return err
}

func (r *Repository) GetOverrideByID(ctx context.Context, id string) (*models.PolicyOverride, error) {
	var o models.PolicyOverride
	err := r.db.GetContext(ctx, &o,
		`SELECT * FROM policy_overrides WHERE id = $1`, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &o, nil
}

func (r *Repository) FindActiveOverrideByTenantAndPolicy(ctx context.Context, tenantID, policyID string) (*models.PolicyOverride, error) {
	var o models.PolicyOverride
	err := r.db.GetContext(ctx, &o,
		`SELECT * FROM policy_overrides WHERE tenant_id = $1 AND policy_id = $2 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
		tenantID, policyID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &o, nil
}

func (r *Repository) ListOverridesByTenant(ctx context.Context, tenantID string, filter OverrideFilter) ([]models.PolicyOverride, int, error) {
	conditions := []string{"tenant_id = $1"}
	args := []interface{}{tenantID}
	idx := 2

	if filter.Status != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", idx))
		args = append(args, filter.Status)
		idx++
	}
	if filter.PolicyID != "" {
		conditions = append(conditions, fmt.Sprintf("policy_id = $%d", idx))
		args = append(args, filter.PolicyID)
		idx++
	}

	where := strings.Join(conditions, " AND ")

	var total int
	err := r.db.GetContext(ctx, &total,
		fmt.Sprintf(`SELECT COUNT(*) FROM policy_overrides WHERE %s`, where), args...)
	if err != nil {
		return nil, 0, err
	}

	args = append(args, filter.Offset, filter.Limit)
	query := fmt.Sprintf(
		`SELECT * FROM policy_overrides WHERE %s ORDER BY created_at DESC OFFSET $%d LIMIT $%d`,
		where, idx, idx+1,
	)

	var items []models.PolicyOverride
	err = r.db.SelectContext(ctx, &items, query, args...)
	return items, total, err
}

func (r *Repository) FindActiveOverridesByTenant(ctx context.Context, tenantID string) ([]models.PolicyOverride, error) {
	var items []models.PolicyOverride
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM policy_overrides WHERE tenant_id = $1 AND status = 'active' ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) UpdateOverride(ctx context.Context, id string, updates map[string]interface{}) (*models.PolicyOverride, error) {
	sets := []string{}
	args := []interface{}{}
	idx := 1

	if v, ok := updates["reason"]; ok {
		sets = append(sets, fmt.Sprintf("reason = $%d", idx))
		args = append(args, v)
		idx++
	}
	if v, ok := updates["expires_at"]; ok {
		sets = append(sets, fmt.Sprintf("expires_at = $%d", idx))
		args = append(args, v)
		idx++
	}
	if v, ok := updates["status"]; ok {
		sets = append(sets, fmt.Sprintf("status = $%d", idx))
		args = append(args, v)
		idx++
	}
	if v, ok := updates["revoked_at"]; ok {
		sets = append(sets, fmt.Sprintf("revoked_at = $%d", idx))
		args = append(args, v)
		idx++
	}
	if v, ok := updates["revoked_by"]; ok {
		sets = append(sets, fmt.Sprintf("revoked_by = $%d", idx))
		args = append(args, v)
		idx++
	}

	if len(sets) == 0 {
		return r.GetOverrideByID(ctx, id)
	}

	sets = append(sets, "updated_at = NOW()")
	args = append(args, id)

	query := fmt.Sprintf(
		`UPDATE policy_overrides SET %s WHERE id = $%d RETURNING *`,
		strings.Join(sets, ", "), idx,
	)

	var o models.PolicyOverride
	err := r.db.GetContext(ctx, &o, query, args...)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &o, nil
}

func (r *Repository) DeleteOverride(ctx context.Context, id string) (bool, error) {
	res, err := r.db.ExecContext(ctx, `DELETE FROM policy_overrides WHERE id = $1`, id)
	if err != nil {
		return false, err
	}
	rows, _ := res.RowsAffected()
	return rows > 0, nil
}

func (r *Repository) MarkExpiredOverrides(ctx context.Context, now time.Time) (int, error) {
	res, err := r.db.ExecContext(ctx,
		`UPDATE policy_overrides SET status = 'expired', updated_at = $1
		 WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at <= $1`, now)
	if err != nil {
		return 0, err
	}
	rows, _ := res.RowsAffected()
	return int(rows), nil
}

type OverrideFilter struct {
	Status   string
	PolicyID string
	Limit    int
	Offset   int
}

// ==================== Exemption ====================

func (r *Repository) CreateExemption(ctx context.Context, e *models.Exemption) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO policy_exemptions (id, violation_id, policy_id, run_id, reason, category, requested_by, status, expires_at, approval_chain, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		e.ID, e.ViolationID, e.PolicyID, e.RunID, e.Reason, e.Category,
		e.RequestedBy, e.Status, e.ExpiresAt, e.ApprovalChain,
		e.CreatedAt, e.UpdatedAt,
	)
	return err
}

func (r *Repository) GetExemptionByID(ctx context.Context, id string) (*models.Exemption, error) {
	var e models.Exemption
	err := r.db.GetContext(ctx, &e,
		`SELECT * FROM policy_exemptions WHERE id = $1`, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &e, nil
}

func (r *Repository) ListExemptions(ctx context.Context, filter ExemptionFilter) ([]models.Exemption, int, error) {
	conditions := []string{"1=1"}
	args := []interface{}{}
	idx := 1

	if filter.Status != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", idx))
		args = append(args, filter.Status)
		idx++
	}
	if filter.PolicyID != "" {
		conditions = append(conditions, fmt.Sprintf("policy_id = $%d", idx))
		args = append(args, filter.PolicyID)
		idx++
	}
	if filter.RequestedBy != "" {
		conditions = append(conditions, fmt.Sprintf("requested_by = $%d", idx))
		args = append(args, filter.RequestedBy)
		idx++
	}
	if filter.Category != "" {
		conditions = append(conditions, fmt.Sprintf("category = $%d", idx))
		args = append(args, filter.Category)
		idx++
	}

	where := strings.Join(conditions, " AND ")

	var total int
	err := r.db.GetContext(ctx, &total,
		fmt.Sprintf(`SELECT COUNT(*) FROM policy_exemptions WHERE %s`, where), args...)
	if err != nil {
		return nil, 0, err
	}

	args = append(args, filter.Offset, filter.Limit)
	query := fmt.Sprintf(
		`SELECT * FROM policy_exemptions WHERE %s ORDER BY created_at DESC OFFSET $%d LIMIT $%d`,
		where, idx, idx+1,
	)

	var items []models.Exemption
	err = r.db.SelectContext(ctx, &items, query, args...)
	return items, total, err
}

func (r *Repository) UpdateExemptionStatus(ctx context.Context, id, status string, approvalChainJSON interface{}) (*models.Exemption, error) {
	var e models.Exemption
	err := r.db.GetContext(ctx, &e,
		`UPDATE policy_exemptions SET status = $1, approval_chain = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
		status, approvalChainJSON, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &e, nil
}

func (r *Repository) ExpireExemptions(ctx context.Context) (int, error) {
	res, err := r.db.ExecContext(ctx,
		`UPDATE policy_exemptions SET status = 'expired', updated_at = NOW()
		 WHERE status = 'approved' AND expires_at <= NOW()`)
	if err != nil {
		return 0, err
	}
	rows, _ := res.RowsAffected()
	return int(rows), nil
}

func (r *Repository) HasActiveExemption(ctx context.Context, violationID string) (bool, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM policy_exemptions WHERE violation_id = $1 AND status = 'approved' AND expires_at > NOW()`,
		violationID)
	return count > 0, err
}

func (r *Repository) RevokeExemption(ctx context.Context, id string) (*models.Exemption, error) {
	var e models.Exemption
	err := r.db.GetContext(ctx, &e,
		`UPDATE policy_exemptions SET status = 'revoked', updated_at = NOW() WHERE id = $1 AND status = 'approved' RETURNING *`, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &e, nil
}

type ExemptionFilter struct {
	Status      string
	PolicyID    string
	RequestedBy string
	Category    string
	Limit       int
	Offset      int
}

// ==================== API Contract ====================

func (r *Repository) CreateContract(ctx context.Context, c *models.APIContract) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO api_contracts (id, tenant_id, service_name, name, description, endpoint, method, version, spec, schema, status)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		c.ID, c.TenantID, c.ServiceName, c.Name, c.Description, c.Endpoint, c.Method,
		c.Version, c.Spec, c.Schema, c.Status,
	)
	return err
}

func (r *Repository) GetContractByID(ctx context.Context, id string) (*models.APIContract, error) {
	var c models.APIContract
	err := r.db.GetContext(ctx, &c,
		`SELECT * FROM api_contracts WHERE id = $1`, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &c, nil
}

func (r *Repository) ListContracts(ctx context.Context, tenantID string, filter ContractFilter) ([]models.APIContract, error) {
	conditions := []string{"tenant_id = $1"}
	args := []interface{}{tenantID}
	idx := 2

	if filter.Service != "" {
		conditions = append(conditions, fmt.Sprintf("service_name = $%d", idx))
		args = append(args, filter.Service)
		idx++
	}
	if filter.Status != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", idx))
		args = append(args, filter.Status)
		idx++
	}

	query := fmt.Sprintf(
		`SELECT * FROM api_contracts WHERE %s ORDER BY created_at DESC`, strings.Join(conditions, " AND "),
	)

	var items []models.APIContract
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *Repository) UpdateContract(ctx context.Context, id string, req *models.UpdateContractRequest) (*models.APIContract, error) {
	sets := []string{}
	args := []interface{}{}
	idx := 1

	if req.Name != nil {
		sets = append(sets, fmt.Sprintf("name = $%d", idx))
		args = append(args, *req.Name)
		idx++
	}
	if req.Description != nil {
		sets = append(sets, fmt.Sprintf("description = $%d", idx))
		args = append(args, *req.Description)
		idx++
	}
	if req.Endpoint != nil {
		sets = append(sets, fmt.Sprintf("endpoint = $%d", idx))
		args = append(args, *req.Endpoint)
		idx++
	}
	if req.Method != nil {
		sets = append(sets, fmt.Sprintf("method = $%d", idx))
		args = append(args, *req.Method)
		idx++
	}
	if req.Version != nil {
		sets = append(sets, fmt.Sprintf("version = $%d", idx))
		args = append(args, *req.Version)
		idx++
	}
	if req.Spec != nil {
		sets = append(sets, fmt.Sprintf("spec = $%d", idx))
		args = append(args, req.Spec)
		idx++
	}
	if req.Schema != nil {
		sets = append(sets, fmt.Sprintf("schema = $%d", idx))
		args = append(args, req.Schema)
		idx++
	}
	if req.Status != nil {
		sets = append(sets, fmt.Sprintf("status = $%d", idx))
		args = append(args, *req.Status)
		idx++
	}

	if len(sets) == 0 {
		return r.GetContractByID(ctx, id)
	}

	sets = append(sets, "updated_at = NOW()")
	args = append(args, id)

	query := fmt.Sprintf(
		`UPDATE api_contracts SET %s WHERE id = $%d RETURNING *`,
		strings.Join(sets, ", "), idx,
	)

	var c models.APIContract
	err := r.db.GetContext(ctx, &c, query, args...)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &c, nil
}

func (r *Repository) DeleteContract(ctx context.Context, id string) (bool, error) {
	res, err := r.db.ExecContext(ctx, `DELETE FROM api_contracts WHERE id = $1`, id)
	if err != nil {
		return false, err
	}
	rows, _ := res.RowsAffected()
	return rows > 0, nil
}

func (r *Repository) UpdateContractLastVerified(ctx context.Context, id string, verifiedAt time.Time) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE api_contracts SET last_verified_at = $1, updated_at = NOW() WHERE id = $2`,
		verifiedAt, id)
	return err
}

type ContractFilter struct {
	Service string
	Status  string
}

// ==================== API Version ====================

func (r *Repository) CreateAPIVersion(ctx context.Context, v *models.APIVersion) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO api_versions (id, tenant_id, contract_id, api_id, version_tag, version, definition, status)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		v.ID, v.TenantID, v.ContractID, v.APIID, v.VersionTag, v.Version, v.Definition, v.Status,
	)
	return err
}

func (r *Repository) GetAPIVersionByID(ctx context.Context, id string) (*models.APIVersion, error) {
	var v models.APIVersion
	err := r.db.GetContext(ctx, &v,
		`SELECT * FROM api_versions WHERE id = $1`, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &v, nil
}

func (r *Repository) ListAPIVersionsByContract(ctx context.Context, contractID string) ([]models.APIVersion, error) {
	var items []models.APIVersion
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM api_versions WHERE contract_id = $1 ORDER BY created_at DESC`, contractID)
	return items, err
}

func (r *Repository) ListAPIVersionsByAPIID(ctx context.Context, apiID string) ([]models.APIVersion, error) {
	var items []models.APIVersion
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM api_versions WHERE api_id = $1 ORDER BY created_at DESC`, apiID)
	return items, err
}

func (r *Repository) ListAPIVersionsByTenant(ctx context.Context, tenantID string) ([]models.APIVersion, error) {
	var items []models.APIVersion
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM api_versions WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) UpdateAPIVersionStatus(ctx context.Context, id, status string, deprecationDate *time.Time) (*models.APIVersion, error) {
	var v models.APIVersion
	err := r.db.GetContext(ctx, &v,
		`UPDATE api_versions SET status = $1, deprecation_date = COALESCE($2, deprecation_date) WHERE id = $3 RETURNING *`,
		status, deprecationDate, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &v, nil
}

func (r *Repository) DeleteAPIVersion(ctx context.Context, id string) (bool, error) {
	res, err := r.db.ExecContext(ctx, `DELETE FROM api_versions WHERE id = $1`, id)
	if err != nil {
		return false, err
	}
	rows, _ := res.RowsAffected()
	return rows > 0, nil
}

// ==================== Governance Rule ====================

func (r *Repository) CreateGovernanceRule(ctx context.Context, rule *models.GovernanceRule) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO governance_rules (id, tenant_id, name, description, rule_type, config, enabled)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		rule.ID, rule.TenantID, rule.Name, rule.Description, rule.RuleType, rule.Config, rule.Enabled,
	)
	return err
}

func (r *Repository) GetGovernanceRuleByID(ctx context.Context, id string) (*models.GovernanceRule, error) {
	var rule models.GovernanceRule
	err := r.db.GetContext(ctx, &rule,
		`SELECT * FROM governance_rules WHERE id = $1`, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &rule, nil
}

func (r *Repository) ListGovernanceRules(ctx context.Context, tenantID string) ([]models.GovernanceRule, error) {
	var items []models.GovernanceRule
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM governance_rules WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) ListEnabledGovernanceRules(ctx context.Context, tenantID string) ([]models.GovernanceRule, error) {
	var items []models.GovernanceRule
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM governance_rules WHERE tenant_id = $1 AND enabled = true ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) UpdateGovernanceRule(ctx context.Context, id string, req *models.UpdateGovernanceRuleRequest) (*models.GovernanceRule, error) {
	sets := []string{}
	args := []interface{}{}
	idx := 1

	if req.Name != nil {
		sets = append(sets, fmt.Sprintf("name = $%d", idx))
		args = append(args, *req.Name)
		idx++
	}
	if req.Description != nil {
		sets = append(sets, fmt.Sprintf("description = $%d", idx))
		args = append(args, *req.Description)
		idx++
	}
	if req.RuleType != nil {
		sets = append(sets, fmt.Sprintf("rule_type = $%d", idx))
		args = append(args, *req.RuleType)
		idx++
	}
	if req.Config != nil {
		sets = append(sets, fmt.Sprintf("config = $%d", idx))
		args = append(args, req.Config)
		idx++
	}
	if req.Enabled != nil {
		sets = append(sets, fmt.Sprintf("enabled = $%d", idx))
		args = append(args, *req.Enabled)
		idx++
	}

	if len(sets) == 0 {
		return r.GetGovernanceRuleByID(ctx, id)
	}

	sets = append(sets, "updated_at = NOW()")
	args = append(args, id)

	query := fmt.Sprintf(
		`UPDATE governance_rules SET %s WHERE id = $%d RETURNING *`,
		strings.Join(sets, ", "), idx,
	)

	var rule models.GovernanceRule
	err := r.db.GetContext(ctx, &rule, query, args...)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &rule, nil
}

func (r *Repository) DeleteGovernanceRule(ctx context.Context, id string) (bool, error) {
	res, err := r.db.ExecContext(ctx, `DELETE FROM governance_rules WHERE id = $1`, id)
	if err != nil {
		return false, err
	}
	rows, _ := res.RowsAffected()
	return rows > 0, nil
}

// ==================== API Inventory ====================

func (r *Repository) RegisterAPIInventory(ctx context.Context, entry *models.APIInventoryEntry) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO api_inventory (id, tenant_id, api_path, api_data) VALUES ($1, $2, $3, $4)`,
		entry.ID, entry.TenantID, entry.APIPath, entry.APIData,
	)
	return err
}

func (r *Repository) FindAPIInventoryByTenant(ctx context.Context, tenantID string) ([]models.APIInventoryEntry, error) {
	var items []models.APIInventoryEntry
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM api_inventory WHERE tenant_id = $1 ORDER BY api_path`, tenantID)
	return items, err
}

// ==================== Contract Violation (evaluation-time) ====================

func (r *Repository) DeleteContractViolationsByContract(ctx context.Context, contractID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM api_contract_violations WHERE contract_id = $1`, contractID)
	return err
}

func (r *Repository) CreateContractViolation(ctx context.Context, v *models.ContractViolation) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO api_contract_violations (id, contract_id, violation_type, description, severity, detected_at, sample_data)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		v.ID, v.ContractID, v.ViolationType, v.Description, v.Severity, v.DetectedAt,
		mustJSON(v.SampleData),
	)
	return err
}

func (r *Repository) FindContractViolationsByContract(ctx context.Context, contractID string) ([]models.ContractViolation, error) {
	var items []models.ContractViolation
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM api_contract_violations WHERE contract_id = $1 ORDER BY detected_at DESC`, contractID)
	return items, err
}

// ==================== Quality Gate Trend Queries ====================

func (r *Repository) GetPassRateTrend(ctx context.Context, days int, policyID string) ([]models.PassRateTrendPoint, error) {
	var query string
	var args []interface{}

	if policyID != "" {
		query = `
			SELECT DATE(evaluated_at) AS date,
			       COUNT(*) AS total_evaluations,
			       COUNT(*) FILTER (WHERE NOT (result->>'allow' = 'false' OR result->>'allow' = 'f')) AS passed_evaluations
			FROM policy_evaluations
			WHERE evaluated_at >= NOW() - INTERVAL '1 day' * $1 AND policy_id = $2
			GROUP BY DATE(evaluated_at)
			ORDER BY date ASC`
		args = []interface{}{days, policyID}
	} else {
		query = `
			SELECT DATE(evaluated_at) AS date,
			       COUNT(*) AS total_evaluations,
			       COUNT(*) FILTER (WHERE NOT (result->>'allow' = 'false' OR result->>'allow' = 'f')) AS passed_evaluations
			FROM policy_evaluations
			WHERE evaluated_at >= NOW() - INTERVAL '1 day' * $1
			GROUP BY DATE(evaluated_at)
			ORDER BY date ASC`
		args = []interface{}{days}
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []models.PassRateTrendPoint
	for rows.Next() {
		var p models.PassRateTrendPoint
		var date interface{}
		var total, passed int
		if err := rows.Scan(&date, &total, &passed); err != nil {
			return nil, err
		}
		p.Date = fmt.Sprintf("%v", date)
		p.TotalEvaluations = total
		p.PassedEvaluations = passed
		if total > 0 {
			p.PassRate = float64(passed) / float64(total) * 100
		}
		result = append(result, p)
	}
	return result, nil
}

func (r *Repository) GetViolationDistribution(ctx context.Context, days int, groupBy string) ([]models.ViolationDistributionItem, error) {
	groupCol := "severity"
	if groupBy == "policy" {
		groupCol = "policy_id"
	}

	query := fmt.Sprintf(`
		SELECT %s AS key, COUNT(*) AS count
		FROM policy_violations
		WHERE created_at >= NOW() - INTERVAL '1 day' * $1 AND status = 'open'
		GROUP BY %s
		ORDER BY count DESC`, groupCol, groupCol)

	rows, err := r.db.QueryContext(ctx, query, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.ViolationDistributionItem
	var total int
	for rows.Next() {
		var item models.ViolationDistributionItem
		var key sql.NullString
		if err := rows.Scan(&key, &item.Count); err != nil {
			return nil, err
		}
		if key.Valid {
			item.Key = key.String
		} else {
			item.Key = "unknown"
		}
		total += item.Count
		items = append(items, item)
	}

	if total > 0 {
		for i := range items {
			items[i].Percentage = float64(items[i].Count) / float64(total) * 100
		}
	}
	return items, nil
}

func (r *Repository) GetTopFailingPolicies(ctx context.Context, limit, days int) ([]models.TopFailingPolicy, error) {
	query := `
		SELECT p.id AS policy_id, p.name AS policy_name,
		       COUNT(v.id) AS failure_count,
		       (SELECT COUNT(*) FROM policy_evaluations e2 WHERE e2.policy_id = p.id
		        AND e2.evaluated_at >= NOW() - INTERVAL '1 day' * $2) AS total_evaluations
		FROM policy_definitions p
		LEFT JOIN policy_violations v ON v.policy_id = p.id
		  AND v.created_at >= NOW() - INTERVAL '1 day' * $2
		  AND v.status = 'open'
		WHERE p.enabled = true
		GROUP BY p.id, p.name
		ORDER BY failure_count DESC
		LIMIT $1`

	rows, err := r.db.QueryContext(ctx, query, limit, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.TopFailingPolicy
	for rows.Next() {
		var p models.TopFailingPolicy
		if err := rows.Scan(&p.PolicyID, &p.PolicyName, &p.FailureCount, &p.TotalEvaluations); err != nil {
			return nil, err
		}
		if p.TotalEvaluations > 0 {
			p.FailureRate = float64(p.FailureCount) / float64(p.TotalEvaluations) * 100
		}
		items = append(items, p)
	}
	return items, nil
}

func (r *Repository) GetExemptionStats(ctx context.Context) (*models.ExemptionStats, error) {
	query := `
		SELECT
			COUNT(*) FILTER (WHERE status = 'approved' AND expires_at > NOW()) AS active,
			COUNT(*) FILTER (WHERE status = 'expired') AS expired,
			COUNT(*) FILTER (WHERE status = 'pending') AS pending,
			COUNT(*) FILTER (WHERE status = 'revoked') AS revoked,
			COUNT(*) AS total
		FROM policy_exemptions`

	var stats models.ExemptionStats
	err := r.db.QueryRowContext(ctx, query).Scan(
		&stats.Active, &stats.Expired, &stats.Pending, &stats.Revoked, &stats.Total,
	)
	if err != nil {
		return nil, err
	}
	return &stats, nil
}

func (r *Repository) GetExemptionsByCategory(ctx context.Context, days int) (total, falsePositive, businessUrgency, techDebt, temporary int, err error) {
	query := `
		SELECT
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE category = 'false-positive') AS false_positive,
			COUNT(*) FILTER (WHERE category = 'business-urgency') AS business_urgency,
			COUNT(*) FILTER (WHERE category = 'tech-debt') AS tech_debt,
			COUNT(*) FILTER (WHERE category = 'temporary') AS temporary
		FROM policy_exemptions
		WHERE created_at >= NOW() - INTERVAL '1 day' * $1`

	err = r.db.QueryRowContext(ctx, query, days).Scan(
		&total, &falsePositive, &businessUrgency, &techDebt, &temporary,
	)
	return
}

func (r *Repository) CountStaleOpenViolations(ctx context.Context, days int) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM policy_violations WHERE status = 'open' AND created_at < NOW() - INTERVAL '1 day' * $1`, days)
	return count, err
}

func mustJSON(v map[string]interface{}) []byte {
	if v == nil {
		return []byte("{}")
	}
	b, _ := json.Marshal(v)
	return b
}
