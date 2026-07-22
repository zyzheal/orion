package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"orion/infra-ops-svc-go/internal/iac/models"

	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ─── Workspaces ────────────────────────────────────────────────────────────────

func (r *Repository) CreateWorkspace(ctx context.Context, w *models.IaCWorkspace) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO iac_workspaces (id, tenant_id, name, description, provider, branch, vcs_repo, status, variables, created_by, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		w.ID, w.TenantID, w.Name, w.Description, w.Provider, w.Branch,
		w.VCSRepo, w.Status, w.Variables, w.CreatedBy, w.CreatedAt, w.UpdatedAt)
	return err
}

func (r *Repository) GetWorkspaceByID(ctx context.Context, tenantID, id string) (*models.IaCWorkspace, error) {
	var w models.IaCWorkspace
	err := r.db.GetContext(ctx, &w,
		`SELECT * FROM iac_workspaces WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &w, nil
}

func (r *Repository) ListWorkspaces(ctx context.Context, tenantID string, offset, limit int) ([]models.IaCWorkspace, error) {
	var items []models.IaCWorkspace
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM iac_workspaces WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

func (r *Repository) UpdateWorkspace(ctx context.Context, tenantID, id string, req *models.UpdateWorkspaceRequest) (*models.IaCWorkspace, error) {
	setClauses := []string{}
	args := []interface{}{}
	idx := 1

	if req.Name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name=$%d", idx)); args = append(args, *req.Name); idx++
	}
	if req.Description != nil {
		setClauses = append(setClauses, fmt.Sprintf("description=$%d", idx)); args = append(args, *req.Description); idx++
	}
	if req.Provider != nil {
		setClauses = append(setClauses, fmt.Sprintf("provider=$%d", idx)); args = append(args, *req.Provider); idx++
	}
	if req.Branch != nil {
		setClauses = append(setClauses, fmt.Sprintf("branch=$%d", idx)); args = append(args, *req.Branch); idx++
	}
	if req.VCSRepo != nil {
		setClauses = append(setClauses, fmt.Sprintf("vcs_repo=$%d", idx)); args = append(args, *req.VCSRepo); idx++
	}
	if req.Status != nil {
		setClauses = append(setClauses, fmt.Sprintf("status=$%d", idx)); args = append(args, *req.Status); idx++
	}
	if req.Variables != nil {
		setClauses = append(setClauses, fmt.Sprintf("variables=$%d", idx)); args = append(args, *req.Variables); idx++
	}

	if len(setClauses) == 0 {
		return r.GetWorkspaceByID(ctx, tenantID, id)
	}

	setClauses = append(setClauses, fmt.Sprintf("updated_at=$%d", idx))
	args = append(args, time.Now())
	idx++

	query := fmt.Sprintf("UPDATE iac_workspaces SET %s WHERE id=$%d AND tenant_id=$%d RETURNING *",
		strings.Join(setClauses, ", "), idx, idx+1)
	args = append(args, id, tenantID)

	var w models.IaCWorkspace
	err := r.db.GetContext(ctx, &w, query, args...)
	if err != nil {
		return nil, err
	}
	return &w, nil
}

func (r *Repository) DeleteWorkspace(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM iac_workspaces WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ─── Plans ─────────────────────────────────────────────────────────────────────

func (r *Repository) CreatePlan(ctx context.Context, p *models.IaCPlan) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO iac_plans (id, workspace_id, tenant_id, status, output, changes, created_by, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		p.ID, p.WorkspaceID, p.TenantID, p.Status, p.Output, p.Changes,
		p.CreatedBy, p.CreatedAt, p.UpdatedAt)
	return err
}

func (r *Repository) GetPlanByID(ctx context.Context, tenantID, id string) (*models.IaCPlan, error) {
	var p models.IaCPlan
	err := r.db.GetContext(ctx, &p,
		`SELECT * FROM iac_plans WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Repository) ListPlansByWorkspace(ctx context.Context, tenantID, workspaceID string) ([]models.IaCPlan, error) {
	var items []models.IaCPlan
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM iac_plans WHERE tenant_id=$1 AND workspace_id=$2 ORDER BY created_at DESC`,
		tenantID, workspaceID)
	return items, err
}

// ─── Resources ─────────────────────────────────────────────────────────────────

func (r *Repository) ListResources(ctx context.Context, tenantID, workspaceID string) ([]models.IaCResource, error) {
	var items []models.IaCResource
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM iac_resources WHERE tenant_id=$1 AND workspace_id=$2 ORDER BY type, name`,
		tenantID, workspaceID)
	return items, err
}

// ─── Modules ───────────────────────────────────────────────────────────────────

func (r *Repository) CreateModule(ctx context.Context, m *models.IaCModule) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO iac_modules (id, tenant_id, name, description, provider, source, version, variables, outputs, created_by, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		m.ID, m.TenantID, m.Name, m.Description, m.Provider, m.Source,
		m.Version, m.Variables, m.Outputs, m.CreatedBy, m.CreatedAt, m.UpdatedAt)
	return err
}

func (r *Repository) GetModuleByID(ctx context.Context, id string) (*models.IaCModule, error) {
	var m models.IaCModule
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM iac_modules WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) ListModules(ctx context.Context, offset, limit int) ([]models.IaCModule, error) {
	var items []models.IaCModule
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM iac_modules ORDER BY created_at DESC OFFSET $1 LIMIT $2`,
		offset, limit)
	return items, err
}

func (r *Repository) DeleteModule(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM iac_modules WHERE id=$1`, id)
	return err
}

// ─── State Versions ────────────────────────────────────────────────────────────

func (r *Repository) ListStateVersions(ctx context.Context, workspaceID string) ([]models.IaCStateVersion, error) {
	var items []models.IaCStateVersion
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM iac_state_versions WHERE workspace_id=$1 ORDER BY version DESC`,
		workspaceID)
	return items, err
}

func (r *Repository) GetStateVersion(ctx context.Context, workspaceID string, version int) (*models.IaCStateVersion, error) {
	var s models.IaCStateVersion
	err := r.db.GetContext(ctx, &s,
		`SELECT * FROM iac_state_versions WHERE workspace_id=$1 AND version=$2`,
		workspaceID, version)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Repository) CountWorkspaces(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM iac_workspaces WHERE tenant_id=$1`, tenantID)
	return count, err
}