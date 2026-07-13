package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/api-governance/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// getDefaultTenantID returns the default zero UUID tenant.
func getDefaultTenantID() string {
	return "00000000-0000-0000-0000-000000000000"
}

// ---- Contracts ----

func (r *Repository) CreateContract(ctx context.Context, req *models.CreateContractRequest, tenantID string) (*models.Contract, error) {
	now := time.Now().UTC()
	schemaRequest, _ := json.Marshal(req.RequestSchema)
	schemaResponse, _ := json.Marshal(req.ResponseSchema)
	c := &models.Contract{
		ID:             uuid.New().String(),
		APIName:        req.APIName,
		Version:        req.Version,
		Method:         req.Method,
		Path:           req.Path,
		RequestSchema:  string(schemaRequest),
		ResponseSchema: string(schemaResponse),
		Status:         "active",
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO api_governance_contracts (id, tenant_id, api_name, version, method, path, request_schema, response_schema, status, created_at, updated_at)
		 VALUES (:id, :tenantId, :apiName, :version, :method, :path, :requestSchema, :responseSchema, :status, :createdAt, :updatedAt)`,
		map[string]interface{}{
			"id":             c.ID,
			"tenantId":       tenantID,
			"apiName":        c.APIName,
			"version":        c.Version,
			"method":         c.Method,
			"path":           c.Path,
			"requestSchema":  c.RequestSchema,
			"responseSchema": c.ResponseSchema,
			"status":         c.Status,
			"createdAt":      c.CreatedAt,
			"updatedAt":      c.UpdatedAt,
		})
	return c, err
}

func (r *Repository) GetContract(ctx context.Context, id string, tenantID string) (*models.Contract, error) {
	c := &models.Contract{}
	err := r.db.GetContext(ctx, c,
		`SELECT * FROM api_governance_contracts WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return c, err
}

func (r *Repository) ListContracts(ctx context.Context, tenantID string, apiName *string, status *string) ([]models.Contract, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	idx := 2
	if apiName != nil && *apiName != "" {
		where += fmt.Sprintf(" AND api_name = $%d", idx)
		args = append(args, *apiName)
		idx++
	}
	if status != nil && *status != "" {
		where += fmt.Sprintf(" AND status = $%d", idx)
		args = append(args, *status)
		idx++
	}
	query := fmt.Sprintf(`SELECT * FROM api_governance_contracts %s ORDER BY created_at DESC`, where)
	var contracts []models.Contract
	err := r.db.SelectContext(ctx, &contracts, query, args...)
	if err != nil {
		return nil, err
	}
	return contracts, nil
}

// ---- Verification History ----

func (r *Repository) CreateVerification(ctx context.Context, req *models.VerifyRequest, contractID string, passed bool, violations []string, tenantID string) error {
	now := time.Now().UTC()
	violationsJSON, _ := json.Marshal(violations)
	endpoint := ""
	method := ""
	if req.Endpoint != nil {
		endpoint = *req.Endpoint
	}
	if req.Method != nil {
		method = *req.Method
	}
	if endpoint == "" {
		endpoint = "unknown"
	}
	if method == "" {
		method = "GET"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO api_governance_verification_history (id, contract_id, passed, violations, endpoint, method, verified_at, created_at)
		 VALUES (:id, :contractId, :passed, :violations, :endpoint, :method, :verifiedAt, :createdAt)`,
		map[string]interface{}{
			"id":         uuid.New().String(),
			"contractId": contractID,
			"passed":     passed,
			"violations": string(violationsJSON),
			"endpoint":   endpoint,
			"method":     method,
			"verifiedAt": now,
			"createdAt":  now,
		})
	return err
}

func (r *Repository) GetVerificationHistory(ctx context.Context, contractID string, tenantID string) ([]models.VerificationHistory, error) {
	var history []models.VerificationHistory
	err := r.db.SelectContext(ctx, &history,
		`SELECT * FROM api_governance_verification_history WHERE contract_id=$1 AND tenant_id=$2 ORDER BY verified_at DESC`,
		contractID, tenantID)
	return history, err
}

// ---- Violations ----

func (r *Repository) ListViolations(ctx context.Context, tenantID string, contractID *string, severity *string) ([]models.Violation, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	idx := 2
	if contractID != nil && *contractID != "" {
		where += fmt.Sprintf(" AND contract_id = $%d", idx)
		args = append(args, *contractID)
		idx++
	}
	if severity != nil && *severity != "" {
		where += fmt.Sprintf(" AND severity = $%d", idx)
		args = append(args, *severity)
		idx++
	}
	query := fmt.Sprintf(`SELECT * FROM api_governance_violations %s ORDER BY detected_at DESC`, where)
	var violations []models.Violation
	err := r.db.SelectContext(ctx, &violations, query, args...)
	if err != nil {
		return nil, err
	}
	return violations, nil
}

// ---- API Versions ----

func (r *Repository) CreateVersion(ctx context.Context, req *models.CreateVersionRequest, tenantID string) (*models.Version, error) {
	now := time.Now().UTC()
	status := "active"
	if req.Status != "" {
		status = req.Status
	}
	v := &models.Version{
		ID:                 uuid.New().String(),
		TenantID:           tenantID,
		ContractID:         "",
		APIName:            req.APIName,
		Version:            req.Version,
		Status:             status,
		ReplacementVersion: req.ReplacementVersion,
		Changelog:          req.Changelog,
		RegisteredAt:       now,
		CreatedAt:          now,
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO api_governance_versions (id, tenant_id, contract_id, api_name, version, status, deprecation_date, retirement_date, replacement_version, changelog, registered_at, created_at)
		 VALUES (:id, :tenantId, :contractId, :apiName, :version, :status, :deprecationDate, :retirementDate, :replacementVersion, :changelog, :registeredAt, :createdAt)`,
		map[string]interface{}{
			"id":                 v.ID,
			"tenantId":           v.TenantID,
			"contractId":         v.ContractID,
			"apiName":            v.APIName,
			"version":            v.Version,
			"status":             v.Status,
			"deprecationDate":    nil,
			"retirementDate":     nil,
			"replacementVersion": v.ReplacementVersion,
			"changelog":          v.Changelog,
			"registeredAt":       v.RegisteredAt,
			"createdAt":          v.CreatedAt,
		})
	return v, err
}

func (r *Repository) GetVersion(ctx context.Context, id string, tenantID string) (*models.Version, error) {
	v := &models.Version{}
	err := r.db.GetContext(ctx, v,
		`SELECT * FROM api_governance_versions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return v, err
}

func (r *Repository) ListVersions(ctx context.Context, tenantID string, apiName *string, status *string) ([]models.Version, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	idx := 2
	if apiName != nil && *apiName != "" {
		where += fmt.Sprintf(" AND api_name = $%d", idx)
		args = append(args, *apiName)
		idx++
	}
	if status != nil && *status != "" {
		where += fmt.Sprintf(" AND status = $%d", idx)
		args = append(args, *status)
		idx++
	}
	query := fmt.Sprintf(`SELECT * FROM api_governance_versions %s ORDER BY registered_at DESC`, where)
	var versions []models.Version
	err := r.db.SelectContext(ctx, &versions, query, args...)
	if err != nil {
		return nil, err
	}
	return versions, nil
}

func (r *Repository) UpdateVersion(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.Version, error) {
	setClauses := []string{}
	args := []interface{}{}
	idx := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, idx))
		args = append(args, val)
		idx++
	}
	if len(setClauses) == 0 {
		return r.GetVersion(ctx, id, tenantID)
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf(`UPDATE api_governance_versions SET %s WHERE id=$%d AND tenant_id=$%d RETURNING *`,
		strings.Join(setClauses, ", "), idx, idx+1)
	v := &models.Version{}
	err := r.db.GetContext(ctx, v, query, args...)
	return v, err
}

func (r *Repository) ListDeprecatedVersions(ctx context.Context, tenantID string) ([]models.Version, error) {
	var versions []models.Version
	err := r.db.SelectContext(ctx, &versions,
		`SELECT * FROM api_governance_versions WHERE tenant_id=$1 AND status='deprecated' ORDER BY deprecation_date DESC`, tenantID)
	return versions, err
}

// ---- Governance Rules ----

func (r *Repository) CreateRule(ctx context.Context, req *models.CreateRuleRequest, tenantID string) (*models.Rule, error) {
	now := time.Now().UTC()
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	rule := &models.Rule{
		ID:          uuid.New().String(),
		Name:        req.Name,
		Description: req.Description,
		Enabled:     enabled,
		Config:      "{}",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO api_governance_rules (id, tenant_id, name, description, enabled, config, created_at, updated_at)
		 VALUES (:id, :tenantId, :name, :description, :enabled, :config, :createdAt, :updatedAt)`,
		map[string]interface{}{
			"id":          rule.ID,
			"tenantId":    tenantID,
			"name":        rule.Name,
			"description": rule.Description,
			"enabled":     rule.Enabled,
			"config":      rule.Config,
			"createdAt":   rule.CreatedAt,
			"updatedAt":   rule.UpdatedAt,
		})
	return rule, err
}

// ---- Governance Stats ----

func (r *Repository) GetGovernanceStats(ctx context.Context, tenantID string) (models.GovernanceStats, error) {
	var stats models.GovernanceStats
	var err error

	var totalContracts, totalVersions, totalRules, activeRules, totalViolations, deprecatedVersions int
	err = r.db.GetContext(ctx, &totalContracts,
		`SELECT COUNT(*) FROM api_governance_contracts WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return stats, err
	}
	err = r.db.GetContext(ctx, &totalVersions,
		`SELECT COUNT(*) FROM api_governance_versions WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return stats, err
	}
	err = r.db.GetContext(ctx, &totalRules,
		`SELECT COUNT(*) FROM api_governance_rules WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return stats, err
	}
	err = r.db.GetContext(ctx, &activeRules,
		`SELECT COUNT(*) FROM api_governance_rules WHERE tenant_id=$1 AND enabled=true`, tenantID)
	if err != nil {
		return stats, err
	}
	err = r.db.GetContext(ctx, &totalViolations,
		`SELECT COUNT(*) FROM api_governance_violations WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return stats, err
	}
	err = r.db.GetContext(ctx, &deprecatedVersions,
		`SELECT COUNT(*) FROM api_governance_versions WHERE tenant_id=$1 AND status='deprecated'`, tenantID)
	if err != nil {
		return stats, err
	}

	stats = models.GovernanceStats{
		TotalContracts:     totalContracts,
		TotalVersions:      totalVersions,
		TotalRules:         totalRules,
		ActiveRules:        activeRules,
		TotalViolations:    totalViolations,
		DeprecatedVersions: deprecatedVersions,
		ComplianceScore:    100,
		GeneratedAt:        time.Now().UTC().Format(time.RFC3339),
	}
	if totalContracts > 0 {
		stats.ComplianceScore = 95
	}
	return stats, nil
}
