package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/governance/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("governance resource not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func getDefaultTenantID() string {
	return "00000000-0000-0000-0000-000000000000"
}

// ---- Governance Policies ----

func (r *Repository) CreatePolicy(ctx context.Context, req *models.CreatePolicyRequest, tenantID, createdBy string) (*models.GovernancePolicy, error) {
	now := time.Now().UTC()
	tenantID = getTenantID(tenantID)

	// Serialize nested structures
	rulesJSON, _ := json.Marshal(req.Rules)
	scope := models.PolicyScopeBody{Include: []string{}, Exclude: []string{}}
	if req.Scope != nil {
		scope = *req.Scope
	}
	scopeJSON, _ := json.Marshal(scope)
	metadata := map[string]any{}
	if req.Metadata != nil {
		metadata = req.Metadata
	}
	metadataJSON, _ := json.Marshal(metadata)
	severity := models.SeverityMedium
	if req.Severity != "" {
		severity = req.Severity
	}
	enforcement := models.EnforcementStrict
	if req.Enforcement != "" {
		enforcement = req.Enforcement
	}

	p := &models.GovernancePolicy{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		Name:         req.Name,
		Description:  req.Description,
		Type:         req.Type,
		Status:       models.PolicyStatusDraft,
		Severity:     severity,
		Rules:        string(rulesJSON),
		Scope:        string(scopeJSON),
		Enforcement:  enforcement,
		CreatedBy:    createdBy,
		AppliedCount: 0,
		Metadata:     string(metadataJSON),
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO governance_policies (id, tenant_id, name, description, type, status, severity, rules, scope, enforcement, created_by, applied_count, violation_count, metadata, created_at, updated_at)
		 VALUES (:id, :tenantId, :name, :description, :type, :status, :severity, :rules, :scope, :enforcement, :createdBy, :appliedCount, :violationCount, :metadata, :createdAt, :updatedAt)`,
		map[string]interface{}{
			"id":           p.ID,
			"tenantId":     p.TenantID,
			"name":         p.Name,
			"description":  p.Description,
			"type":         p.Type,
			"status":       p.Status,
			"severity":     p.Severity,
			"rules":        p.Rules,
			"scope":        p.Scope,
			"enforcement":  p.Enforcement,
			"createdBy":    p.CreatedBy,
			"appliedCount": p.AppliedCount,
			"violationCount": p.ViolationCount,
			"metadata":     p.Metadata,
			"createdAt":    p.CreatedAt,
			"updatedAt":    p.UpdatedAt,
		})
	return p, err
}

func (r *Repository) GetPolicy(ctx context.Context, id, tenantID string) (*models.GovernancePolicy, error) {
	p := &models.GovernancePolicy{}
	err := r.db.GetContext(ctx, p,
		`SELECT * FROM governance_policies WHERE id=$1 AND tenant_id=$2`, id, getTenantID(tenantID))
	if err != nil {
		return nil, err
	}
	return p, nil
}

func (r *Repository) ListPolicies(ctx context.Context, tenantID string, q *models.PolicyListQuery) ([]models.GovernancePolicy, int, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{getTenantID(tenantID)}
	idx := 2
	if q != nil {
		if q.Type != "" {
			where += fmt.Sprintf(" AND type = $%d", idx)
			args = append(args, q.Type)
			idx++
		}
		if q.Status != "" {
			where += fmt.Sprintf(" AND status = $%d", idx)
			args = append(args, q.Status)
			idx++
		}
		if q.Severity != "" {
			where += fmt.Sprintf(" AND severity = $%d", idx)
			args = append(args, q.Severity)
			idx++
		}
	}
	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM governance_policies %s`, where)
	var total int
	if err := r.db.GetContext(ctx, &total, countQuery, args...); err != nil {
		return nil, 0, err
	}

	offset := 0
	limit := 20
	sort := "created_at"
	order := "DESC"
	if q != nil {
		_ = q // filters already applied
	}
	offsetArgs := args
	query := fmt.Sprintf(`SELECT * FROM governance_policies %s ORDER BY %s %s LIMIT $%d OFFSET $%d`,
		where, sort, order, idx, idx+1)
	offsetArgs = append(args, limit, offset)
	var policies []models.GovernancePolicy
	if err := r.db.SelectContext(ctx, &policies, query, offsetArgs...); err != nil {
		return nil, 0, err
	}
	return policies, total, nil
}

func (r *Repository) ListPoliciesPaginated(ctx context.Context, tenantID string, q *models.PolicyListQuery, offset, limit int) ([]models.GovernancePolicy, int, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{getTenantID(tenantID)}
	idx := 2
	if q != nil {
		if q.Type != "" {
			where += fmt.Sprintf(" AND type = $%d", idx)
			args = append(args, q.Type)
			idx++
		}
		if q.Status != "" {
			where += fmt.Sprintf(" AND status = $%d", idx)
			args = append(args, q.Status)
			idx++
		}
		if q.Severity != "" {
			where += fmt.Sprintf(" AND severity = $%d", idx)
			args = append(args, q.Severity)
			idx++
		}
	}
	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM governance_policies %s`, where)
	var total int
	if err := r.db.GetContext(ctx, &total, countQuery, args...); err != nil {
		return nil, 0, err
	}
	if limit <= 0 {
		limit = 20
	}
	sort := "created_at"
	order := "DESC"
	offsetArgs := append(args, limit, offset)
	query := fmt.Sprintf(`SELECT * FROM governance_policies %s ORDER BY %s %s LIMIT $%d OFFSET $%d`,
		where, sort, order, idx, idx+1)
	var policies []models.GovernancePolicy
	if err := r.db.SelectContext(ctx, &policies, query, offsetArgs...); err != nil {
		return nil, 0, err
	}
	return policies, total, nil
}

func (r *Repository) UpdatePolicy(ctx context.Context, id, tenantID string, updates map[string]interface{}) (*models.GovernancePolicy, error) {
	setClauses := []string{}
	args := []interface{}{}
	idx := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, idx))
		args = append(args, val)
		idx++
	}
	if len(setClauses) == 0 {
		return r.GetPolicy(ctx, id, tenantID)
	}
	args = append(args, id, getTenantID(tenantID))
	query := fmt.Sprintf(`UPDATE governance_policies SET %s, updated_at = $%d WHERE id=$%d AND tenant_id=$%d RETURNING *`,
		strings.Join(setClauses, ", "), idx, idx+1, idx+2)
	args = append(args, time.Now().UTC())
	args = args[:len(args)-1] // remove duplicate, updated_at already set
	query = fmt.Sprintf(`UPDATE governance_policies SET %s WHERE id=$%d AND tenant_id=$%d RETURNING *`,
		strings.Join(setClauses, ", "), idx, idx+1)
	p := &models.GovernancePolicy{}
	err := r.db.GetContext(ctx, p, query, args...)
	return p, err
}

func (r *Repository) DeletePolicy(ctx context.Context, id, tenantID string) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM governance_policies WHERE id=$1 AND tenant_id=$2`, id, getTenantID(tenantID))
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) UpdatePolicyStatus(ctx context.Context, id, tenantID, status string) (*models.GovernancePolicy, error) {
	updates := map[string]interface{}{
		"status": status,
	}
	return r.UpdatePolicy(ctx, id, tenantID, updates)
}

func (r *Repository) IncrementApplyCount(ctx context.Context, id, tenantID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE governance_policies SET applied_count = applied_count + 1 WHERE id=$1 AND tenant_id=$2`,
		id, getTenantID(tenantID))
	return err
}

func (r *Repository) IncrementViolationCount(ctx context.Context, id, tenantID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE governance_policies SET violation_count = violation_count + 1 WHERE id=$1 AND tenant_id=$2`,
		id, getTenantID(tenantID))
	return err
}

// ---- Audit Logs ----

func (r *Repository) CreateAuditLog(ctx context.Context, policyID string, req *AuditLogCreateReq) (*models.GovernanceAuditLog, error) {
	now := time.Now().UTC()
	detailsJSON, _ := json.Marshal(req.Details)
	log := &models.GovernanceAuditLog{
		ID:           uuid.New().String(),
		PolicyID:     policyID,
		Timestamp:    now,
		Action:       req.Action,
		ResourceType: req.ResourceType,
		ResourceID:   req.ResourceID,
		UserID:       req.UserID,
		Details:      string(detailsJSON),
		Outcome:      req.Outcome,
		Severity:     req.Severity,
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO governance_audit_logs (id, policy_id, timestamp, action, resource_type, resource_id, user_id, details, outcome, severity)
		 VALUES (:id, :policyId, :timestamp, :action, :resourceType, :resourceId, :userId, :details, :outcome, :severity)`,
		map[string]interface{}{
			"id":           log.ID,
			"policyId":     log.PolicyID,
			"timestamp":    log.Timestamp,
			"action":       log.Action,
			"resourceType": log.ResourceType,
			"resourceId":   log.ResourceID,
			"userId":       log.UserID,
			"details":      log.Details,
			"outcome":      log.Outcome,
			"severity":     log.Severity,
		})
	return log, err
}

func (r *Repository) GetAuditLogs(ctx context.Context, policyID string, offset, limit int) ([]models.GovernanceAuditLog, int, error) {
	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM governance_audit_logs WHERE policy_id=$1`, policyID)
	if err != nil {
		return nil, 0, err
	}
	if limit <= 0 {
		limit = 50
	}
	var logs []models.GovernanceAuditLog
	err = r.db.SelectContext(ctx, &logs,
		`SELECT * FROM governance_audit_logs WHERE policy_id=$1 ORDER BY timestamp DESC LIMIT $2 OFFSET $3`,
		policyID, limit, offset)
	return logs, total, err
}

// AuditLogCreateReq is the internal request for creating an audit log.
type AuditLogCreateReq struct {
	Action       string
	ResourceType string
	ResourceID   string
	UserID       string
	Details      map[string]interface{}
	Outcome      string
	Severity     string
}

// ---- Compliance Checks ----

func (r *Repository) CreateComplianceCheck(ctx context.Context, policyID string, req *models.ComplianceCheckRequest) error {
	now := time.Now().UTC()
	// For now, persist a minimal record; detailed violations stored in the response.
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO governance_compliance_checks (id, timestamp, resource_id, resource_type, status, violations, score, recommendations)
		 VALUES (:id, :timestamp, :resourceId, :resourceType, :status, :violations, :score, :recommendations)`,
		map[string]interface{}{
			"id":             uuid.New().String(),
			"timestamp":      now,
			"resourceId":     req.ResourceID,
			"resourceType":   req.ResourceType,
			"status":         models.ComplianceCompliant,
			"violations":     "[]",
			"score":          100,
			"recommendations": `["keep compliant"]`,
		})
	_ = policyID
	return err
}

// ---- Rules (aggregated from policies) ----

func (r *Repository) ListRules(ctx context.Context, tenantID string, offset, limit int) ([]models.PolicyRule, int, error) {
	tenantID = getTenantID(tenantID)
	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM governance_policies WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, 0, err
	}
	// Return all rules from policies for this tenant.
	var rules []models.PolicyRule
	// We'll fetch the raw JSONB rules column from policies and parse.
	var rawRules []string
	err = r.db.SelectContext(ctx, &rawRules,
		`SELECT rules FROM governance_policies WHERE tenant_id=$1 LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	for _, r := range rawRules {
		var parsed []models.PolicyRuleBody
		if err := json.Unmarshal([]byte(r), &parsed); err == nil {
			for _, pr := range parsed {
				rules = append(rules, models.PolicyRule{
					Name:        pr.Name,
					Description: pr.Description,
					Condition:   string(mustMarshalJSON(pr.Condition)),
					Action:      string(mustMarshalJSON(pr.Action)),
					Priority:    pr.Priority,
					Enabled:     pr.Enabled,
				})
			}
		}
	}
	return rules, total, nil
}

func mustMarshalJSON(v interface{}) []byte {
	b, _ := json.Marshal(v)
	return b
}

// ---- Stats (for compliance report) ----

func (r *Repository) GetPolicyStats(ctx context.Context, tenantID string) (*PolicyStats, error) {
	tenantID = getTenantID(tenantID)
	var s PolicyStats
	var err error
	err = r.db.GetContext(ctx, &s.TotalPolicies,
		`SELECT COUNT(*) FROM governance_policies WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return &s, err
	}
	err = r.db.GetContext(ctx, &s.ActivePolicies,
		`SELECT COUNT(*) FROM governance_policies WHERE tenant_id=$1 AND status='active'`, tenantID)
	return &s, err
}

type PolicyStats struct {
	TotalPolicies int `json:"totalPolicies"`
	ActivePolicies int `json:"activePolicies"`
}

func getTenantID(tenantID string) string {
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}
