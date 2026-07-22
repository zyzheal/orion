package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/iac/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateTableIfNotExists(ctx context.Context) error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS iac_workspaces (
			id UUID PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			name TEXT NOT NULL,
			description TEXT,
			backend_type TEXT NOT NULL,
			backend_config JSONB DEFAULT '{}',
			variables JSONB DEFAULT '{}',
			environment TEXT DEFAULT '',
			terraform_version TEXT DEFAULT '',
			status TEXT DEFAULT 'active',
			created_at TIMESTAMPTZ NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS iac_modules (
			id UUID PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			name TEXT NOT NULL,
			description TEXT,
			source TEXT NOT NULL,
			version TEXT DEFAULT '',
			inputs JSONB DEFAULT '{}',
			created_at TIMESTAMPTZ NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS iac_plans (
			id UUID PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			workspace_id UUID NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			added INT DEFAULT 0,
			changed INT DEFAULT 0,
			destroyed INT DEFAULT 0,
			plan_output TEXT,
			created_at TIMESTAMPTZ NOT NULL,
			finished_at TIMESTAMPTZ
		)`,
		`CREATE TABLE IF NOT EXISTS iac_state_versions (
			id UUID PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			workspace_id UUID NOT NULL,
			serial INT NOT NULL,
			state JSONB,
			created_at TIMESTAMPTZ NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS iac_resources (
			id UUID PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			workspace_id UUID NOT NULL,
			type TEXT NOT NULL,
			name TEXT NOT NULL,
			provider TEXT DEFAULT '',
			module_address TEXT DEFAULT '',
			status TEXT DEFAULT 'managed',
			tags JSONB DEFAULT '{}',
			created_at TIMESTAMPTZ NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL
		)`,
	}
	for _, q := range queries {
		if _, err := r.db.ExecContext(ctx, q); err != nil {
			return fmt.Errorf("failed to create iac tables: %w", err)
		}
	}
	return nil
}

// --- Workspace CRUD ---

func (r *Repository) CreateWorkspace(ctx context.Context, w *models.Workspace) error {
	w.ID = uuid.New().String()
	w.CreatedAt = time.Now().UTC()
	w.UpdatedAt = time.Now().UTC()
	backendConfig, _ := json.Marshal(w.BackendConfig)
	variables, _ := json.Marshal(w.Variables)
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO iac_workspaces (id, tenant_id, name, description, backend_type, backend_config, variables, environment, terraform_version, status, created_at, updated_at)
		 VALUES (:id, :tenant_id, :name, :description, :backend_type, :backend_config, :variables, :environment, :terraform_version, :status, :created_at, :updated_at)`,
		map[string]interface{}{
			"id":                w.ID,
			"tenant_id":         w.TenantID,
			"name":              w.Name,
			"description":       w.Description,
			"backend_type":      w.BackendType,
			"backend_config":    string(backendConfig),
			"variables":         string(variables),
			"environment":       w.Environment,
			"terraform_version": w.TerraformVersion,
			"status":            w.Status,
			"created_at":        w.CreatedAt,
			"updated_at":        w.UpdatedAt,
		})
	return err
}

func (r *Repository) GetWorkspace(ctx context.Context, tenantID, id string) (*models.Workspace, error) {
	w := &models.Workspace{}
	if err := r.db.GetContext(ctx, w,
		`SELECT * FROM iac_workspaces WHERE id=$1 AND tenant_id=$2`, id, tenantID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("workspace not found")
		}
		return nil, err
	}
	r.decodeJSON(w)
	return w, nil
}

func (r *Repository) ListWorkspaces(ctx context.Context, tenantID string, limit, offset int) ([]models.Workspace, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.Workspace
	if err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM iac_workspaces WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset); err != nil {
		return nil, err
	}
	for i := range items {
		r.decodeJSON(&items[i])
	}
	return items, nil
}

func (r *Repository) UpdateWorkspace(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE iac_workspaces SET :name = COALESCE(:name, name),
		 :description = COALESCE(:description, description),
		 backend_config = :backend_config,
		 variables = :variables,
		 environment = :environment,
		 terraform_version = :terraform_version,
		 status = :status,
		 updated_at = NOW()
		 WHERE id=$1 AND tenant_id=$2`,
		map[string]interface{}{
			"id":                id,
			"tenant_id":         tenantID,
			"backend_config":    updates["backend_config"],
			"variables":         updates["variables"],
			"environment":       updates["environment"],
			"terraform_version": updates["terraform_version"],
			"status":            updates["status"],
		})
	return err
}

func (r *Repository) DeleteWorkspace(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM iac_workspaces WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// --- Plan ---

func (r *Repository) CreatePlan(ctx context.Context, p *models.Plan) error {
	p.ID = uuid.New().String()
	p.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO iac_plans (id, tenant_id, workspace_id, status, added, changed, destroyed, plan_output, created_at, finished_at)
		 VALUES (:id, :tenant_id, :workspace_id, :status, :added, :changed, :destroyed, :plan_output, :created_at, :finished_at)`,
		p)
	return err
}

func (r *Repository) ListPlansByWorkspace(ctx context.Context, tenantID, workspaceID string) ([]models.Plan, error) {
	var items []models.Plan
	if err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM iac_plans WHERE workspace_id=$1 AND tenant_id=$2 ORDER BY created_at DESC`, workspaceID, tenantID); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) GetPlan(ctx context.Context, tenantID, planID string) (*models.Plan, error) {
	p := &models.Plan{}
	if err := r.db.GetContext(ctx, p,
		`SELECT * FROM iac_plans WHERE id=$1 AND tenant_id=$2`, planID, tenantID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("plan not found")
		}
		return nil, err
	}
	return p, nil
}

func (r *Repository) UpdatePlan(ctx context.Context, tenantID, planID string, status string, added, changed, destroyed int) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE iac_plans SET status=$1, added=$2, changed=$3, destroyed=$4, finished_at=NOW() WHERE id=$5 AND tenant_id=$6`,
		status, added, changed, destroyed, planID, tenantID)
	return err
}

// --- State Versions ---

func (r *Repository) ListStateVersions(ctx context.Context, tenantID, workspaceID string) ([]models.StateVersion, error) {
	var items []models.StateVersion
	if err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM iac_state_versions WHERE workspace_id=$1 AND tenant_id=$2 ORDER BY serial DESC`, workspaceID, tenantID); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) CreateStateVersion(ctx context.Context, sv *models.StateVersion) error {
	sv.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO iac_state_versions (id, tenant_id, workspace_id, serial, state, created_at)
		 VALUES (:id, :tenant_id, :workspace_id, :serial, :state, :created_at)`,
		sv)
	return err
}

func (r *Repository) GetStateVersion(ctx context.Context, tenantID, workspaceID, versionID string) (*models.StateVersion, error) {
	sv := &models.StateVersion{}
	if err := r.db.GetContext(ctx, sv,
		`SELECT * FROM iac_state_versions WHERE id=$1 AND workspace_id=$2 AND tenant_id=$3`, versionID, workspaceID, tenantID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("state version not found")
		}
		return nil, err
	}
	return sv, nil
}

// --- Resources ---

func (r *Repository) ListResources(ctx context.Context, tenantID, workspaceID string) ([]models.Resource, error) {
	var items []models.Resource
	if err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM iac_resources WHERE workspace_id=$1 AND tenant_id=$2 ORDER BY created_at`, workspaceID, tenantID); err != nil {
		return nil, err
	}
	for i := range items {
		r.decodeResourceJSON(&items[i])
	}
	return items, nil
}

func (r *Repository) ImportResource(ctx context.Context, rsrc *models.Resource) error {
	rsrc.ID = uuid.New().String()
	rsrc.CreatedAt = time.Now().UTC()
	rsrc.UpdatedAt = time.Now().UTC()
	tags, _ := json.Marshal(rsrc.Tags)
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO iac_resources (id, tenant_id, workspace_id, type, name, provider, module_address, status, tags, created_at, updated_at)
		 VALUES (:id, :tenant_id, :workspace_id, :type, :name, :provider, :module_address, :status, :tags, :created_at, :updated_at)`,
		map[string]interface{}{
			"id":             rsrc.ID,
			"tenant_id":      rsrc.TenantID,
			"workspace_id":   rsrc.WorkspaceID,
			"type":           rsrc.Type,
			"name":           rsrc.Name,
			"provider":       rsrc.Provider,
			"module_address": rsrc.ModuleAddress,
			"status":         rsrc.Status,
			"tags":           string(tags),
			"created_at":     rsrc.CreatedAt,
			"updated_at":     rsrc.UpdatedAt,
		})
	return err
}

// --- Modules ---

func (r *Repository) ListModules(ctx context.Context, tenantID string) ([]models.WorkspaceModule, error) {
	var items []models.WorkspaceModule
	if err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM iac_modules WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID); err != nil {
		return nil, err
	}
	for i := range items {
		r.decodeModuleJSON(&items[i])
	}
	return items, nil
}

func (r *Repository) CreateModule(ctx context.Context, m *models.WorkspaceModule) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	inputs, _ := json.Marshal(m.Inputs)
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO iac_modules (id, tenant_id, name, description, source, version, inputs, created_at, updated_at)
		 VALUES (:id, :tenant_id, :name, :description, :source, :version, :inputs, :created_at, :updated_at)`,
		map[string]interface{}{
			"id":          m.ID,
			"tenant_id":   m.TenantID,
			"name":        m.Name,
			"description": m.Description,
			"source":      m.Source,
			"version":     m.Version,
			"inputs":      string(inputs),
			"created_at":  m.CreatedAt,
			"updated_at":  m.UpdatedAt,
		})
	return err
}

func (r *Repository) GetModuleByID(ctx context.Context, tenantID, id string) (*models.WorkspaceModule, error) {
	m := &models.WorkspaceModule{}
	if err := r.db.GetContext(ctx, m,
		`SELECT * FROM iac_modules WHERE id=$1 AND tenant_id=$2`, id, tenantID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("module not found")
		}
		return nil, err
	}
	r.decodeModuleJSON(m)
	return m, nil
}

func (r *Repository) DeleteModule(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM iac_modules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// --- Helpers ---

func (r *Repository) decodeJSON(w *models.Workspace) {
	// BackendConfig and Variables are already decoded by sqlx when target is *[]byte or string with json.RawMessage
}

func (r *Repository) decodeResourceJSON(res *models.Resource) {
	// Tags decoded by sqlx
}

func (r *Repository) decodeModuleJSON(m *models.WorkspaceModule) {
	// Inputs decoded by sqlx
}
