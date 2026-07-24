package repository

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/jackc/pgx/v5"
	"github.com/google/uuid"
	"orion/platform-svc-go/internal/compliance/models"
	"time"
)

type Repository struct {
	db *pgx.Conn
}

func NewRepository(db *pgx.Conn) *Repository {
	return &Repository{db: db}
}

// CreateFramework inserts a compliance framework.
func (r *Repository) CreateFramework(ctx context.Context, fw *models.ComplianceFramework) error {
	fw.ID = uuid.New().String()
	fw.CreatedAt = time.Now()
	fw.Enabled = true
	categories, _ := json.Marshal(fw.Categories)
	_, err := r.db.Exec(ctx, `
		INSERT INTO compliance_frameworks (id, name, description, version, categories,
			total_controls, url, enabled, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, fw.ID, fw.Name, fw.Description, fw.Version, categories,
		fw.TotalControls, fw.URL, fw.Enabled, fw.CreatedAt)
	return err
}

// ListFrameworks lists frameworks with optional filters.
func (r *Repository) ListFrameworks(ctx context.Context, category string, enabled *bool) ([]models.ComplianceFramework, error) {
	var items []models.ComplianceFramework
	where := "WHERE 1=1"
	args := []interface{}{}
	argIdx := 1

	if category != "" {
		argIdx++
		where += " AND category = $" + string(rune('0'+argIdx))
		args = append(args, category)
	}
	if enabled != nil {
		argIdx++
		where += " AND enabled = $" + string(rune('0'+argIdx))
		args = append(args, *enabled)
	}

	query := `SELECT id, name, description, version, categories, total_controls, url, enabled, created_at FROM compliance_frameworks ` + where + ` ORDER BY name`
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var fw models.ComplianceFramework
		var cats json.RawMessage
		err := rows.Scan(&fw.ID, &fw.Name, &fw.Description, &fw.Version,
			&cats, &fw.TotalControls, &fw.URL, &fw.Enabled, &fw.CreatedAt)
		if err != nil {
			return nil, err
		}
		_ = json.Unmarshal(cats, &fw.Categories)
		// Parse categories string to slice if stored as comma-separated
		if len(fw.Categories) == 0 && fw.Description != "" {
			fw.Categories = []string{fw.Name}
		}
		items = append(items, fw)
	}
	return items, nil
}

// GetFramework returns a framework by ID.
func (r *Repository) GetFramework(ctx context.Context, id string) (*models.ComplianceFramework, error) {
	var fw models.ComplianceFramework
	var cats json.RawMessage
	err := r.db.QueryRow(ctx, `
		SELECT id, name, description, version, categories, total_controls, url, enabled, created_at
		FROM compliance_frameworks WHERE id = $1
	`, id).Scan(&fw.ID, &fw.Name, &fw.Description, &fw.Version,
		&cats, &fw.TotalControls, &fw.URL, &fw.Enabled, &fw.CreatedAt)
	if err == pgx.ErrNoRows {
		return nil, sql.ErrNoRows
	}
	if err != nil {
		return nil, err
	}
	_ = json.Unmarshal(cats, &fw.Categories)
	return &fw, nil
}

// CreateRequirement inserts a requirement for a framework.
func (r *Repository) CreateRequirement(ctx context.Context, req *models.ComplianceRequirement) error {
	req.ID = uuid.New().String()
	_, err := r.db.Exec(ctx, `
		INSERT INTO compliance_requirements (id, framework_id, code, title, description,
			category, control_type, enabled)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, req.ID, req.FrameworkID, req.Code, req.Title, req.Description,
		req.Category, req.ControlType, req.Enabled)
	return err
}

// ListRequirements lists requirements for a framework.
func (r *Repository) ListRequirements(ctx context.Context, frameworkID string) ([]models.ComplianceRequirement, error) {
	var items []models.ComplianceRequirement
	rows, err := r.db.Query(ctx, `
		SELECT id, framework_id, code, title, description, category, control_type, enabled
		FROM compliance_requirements WHERE framework_id = $1 ORDER BY code
	`, frameworkID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var r models.ComplianceRequirement
		err := rows.Scan(&r.ID, &r.FrameworkID, &r.Code, &r.Title, &r.Description,
			&r.Category, &r.ControlType, &r.Enabled)
		if err != nil {
			return nil, err
		}
		items = append(items, r)
	}
	return items, nil
}

// CreateEvidence inserts an evidence record.
func (r *Repository) CreateEvidence(ctx context.Context, e *models.Evidence) error {
	e.ID = uuid.New().String()
	e.CreatedAt = time.Now()
	e.Status = "submitted"
	data, _ := json.Marshal(e.Data)
	_, err := r.db.Exec(ctx, `
		INSERT INTO compliance_evidence (id, tenant_id, framework_id, requirement_id, type,
			title, description, source, data, status, submitted_at, verified_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`, e.ID, e.TenantID, e.FrameworkID, e.RequirementID, e.Type,
		e.Title, e.Description, e.Source, data, e.Status, e.SubmittedAt,
		e.VerifiedAt, e.CreatedAt)
	return err
}

// ListEvidence lists evidence for a tenant and framework.
func (r *Repository) ListEvidence(ctx context.Context, tenantID, frameworkID string) ([]models.Evidence, error) {
	var items []models.Evidence
	rows, err := r.db.Query(ctx, `
		SELECT id, tenant_id, framework_id, requirement_id, type, title, description,
		       source, data, status, submitted_at, verified_at, created_at
		FROM compliance_evidence WHERE tenant_id = $1 AND framework_id = $2
		ORDER BY created_at DESC
	`, tenantID, frameworkID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var e models.Evidence
		// Simplified scan using generic placeholders
		var data json.RawMessage
		err := rows.Scan(&e.ID, &e.TenantID, &e.FrameworkID, &e.RequirementID, &e.Type,
			&e.Title, &e.Description, &e.Source, &data, &e.Status,
			&e.SubmittedAt, &e.VerifiedAt, &e.CreatedAt)
		if err != nil {
			return nil, err
		}
		_ = json.Unmarshal(data, &e.Data)
		items = append(items, e)
	}
	return items, nil
}

// GetEvidence returns evidence by ID for a tenant.
func (r *Repository) GetEvidence(ctx context.Context, tenantID, evidenceID string) (*models.Evidence, error) {
	var e models.Evidence
	var data json.RawMessage
	err := r.db.QueryRow(ctx, `
		SELECT id, tenant_id, framework_id, requirement_id, type, title, description,
		       source, data, status, submitted_at, verified_at, created_at
		FROM compliance_evidence WHERE id = $1 AND tenant_id = $2
	`, evidenceID, tenantID).Scan(&e.ID, &e.TenantID, &e.FrameworkID, &e.RequirementID,
		&e.Type, &e.Title, &e.Description, &e.Source, &data, &e.Status,
		&e.SubmittedAt, &e.VerifiedAt, &e.CreatedAt)
	if err == pgx.ErrNoRows {
		return nil, sql.ErrNoRows
	}
	if err != nil {
		return nil, err
	}
	_ = json.Unmarshal(data, &e.Data)
	return &e, nil
}

// CreateGapAnalysis inserts a gap analysis record.
func (r *Repository) CreateGapAnalysis(ctx context.Context, ga *models.GapAnalysis) error {
	ga.ID = uuid.New().String()
	ga.AnalysisDate = time.Now()
	ga.CreatedAt = time.Now()
	gapItems, _ := json.Marshal(ga.GapItems)
	_, err := r.db.Exec(ctx, `
		INSERT INTO gap_analysis (id, tenant_id, framework_id, total_controls, met_controls,
			partial_controls, unmet_controls, gap_items, analysis_date, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, ga.ID, ga.TenantID, ga.FrameworkID, ga.TotalControls, ga.MetControls,
		ga.PartialControls, ga.UnmetControls, gapItems, ga.AnalysisDate, ga.CreatedAt)
	return err
}

// ListGapAnalysis lists gap analysis for a tenant.
func (r *Repository) ListGapAnalysis(ctx context.Context, tenantID string) ([]models.GapAnalysis, error) {
	var items []models.GapAnalysis
	rows, err := r.db.Query(ctx, `
		SELECT id, tenant_id, framework_id, total_controls, met_controls, partial_controls,
		       unmet_controls, gap_items, analysis_date, created_at
		FROM gap_analysis WHERE tenant_id = $1 ORDER BY created_at DESC
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var ga models.GapAnalysis
		var itemsData json.RawMessage
		err := rows.Scan(&ga.ID, &ga.TenantID, &ga.FrameworkID, &ga.TotalControls,
			&ga.MetControls, &ga.PartialControls, &ga.UnmetControls, &itemsData,
			&ga.AnalysisDate, &ga.CreatedAt)
		if err != nil {
			return nil, err
		}
		_ = json.Unmarshal(itemsData, &ga.GapItems)
		items = append(items, ga)
	}
	return items, nil
}

// CreateRemediationPlan inserts a remediation plan.
func (r *Repository) CreateRemediationPlan(ctx context.Context, rp *models.RemediationPlan) error {
	rp.ID = uuid.New().String()
	rp.CreatedAt = time.Now()
	rp.UpdatedAt = time.Now()
	rp.Status = "planned"
	_, err := r.db.Exec(ctx, `
		INSERT INTO remediation_plans (id, tenant_id, framework_id, requirement_id, title,
			description, action, assignee, due_date, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`, rp.ID, rp.TenantID, rp.FrameworkID, rp.RequirementID, rp.Title,
		rp.Description, rp.Action, rp.Assignee, rp.DueDate, rp.Status,
		rp.CreatedAt, rp.UpdatedAt)
	return err
}

// ListRemediationPlans lists remediation plans for a tenant.
func (r *Repository) ListRemediationPlans(ctx context.Context, tenantID string) ([]models.RemediationPlan, error) {
	var items []models.RemediationPlan
	rows, err := r.db.Query(ctx, `
		SELECT id, tenant_id, framework_id, requirement_id, title, description,
		       action, assignee, due_date, status, created_at, updated_at
		FROM remediation_plans WHERE tenant_id = $1 ORDER BY created_at DESC
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var rp models.RemediationPlan
		err := rows.Scan(&rp.ID, &rp.TenantID, &rp.FrameworkID, &rp.RequirementID,
			&rp.Title, &rp.Description, &rp.Action, &rp.Assignee, &rp.DueDate,
			&rp.Status, &rp.CreatedAt, &rp.UpdatedAt)
		if err != nil {
			return nil, err
		}
		// Convert DueDate if needed
		var dueDate *time.Time
		var rawDueDate interface{}
		// Simplified scan
		if err := rows.Scan(&rp.ID, &rp.TenantID, &rp.FrameworkID, &rp.RequirementID,
			&rp.Title, &rp.Description, &rp.Action, &rp.Assignee, &rawDueDate,
			&rp.Status, &rp.CreatedAt, &rp.UpdatedAt); err == nil {
			_ = dueDate
		}
		items = append(items, rp)
	}
	return items, nil
}
