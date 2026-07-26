package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"orion/go-common/pkg/database"
	"orion/identity-svc-go/internal/tenant/models"
)

type TenantRepository struct {
	db *database.DB
}

func NewTenantRepository(db *database.DB) *TenantRepository {
	return &TenantRepository{db: db}
}

func (r *TenantRepository) DB() *database.DB { return r.db }

// --- Tenant CRUD ---

func (r *TenantRepository) FindByID(ctx context.Context, id string) (*models.Tenant, error) {
	var t models.Tenant
	err := r.db.GetContext(ctx, &t, "SELECT * FROM tenants WHERE id = $1", id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &t, err
}

func (r *TenantRepository) FindByName(ctx context.Context, name string) (*models.Tenant, error) {
	var t models.Tenant
	err := r.db.GetContext(ctx, &t, "SELECT * FROM tenants WHERE name = $1 AND status != 'deleted'", name)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &t, err
}

func (r *TenantRepository) List(ctx context.Context, status *string, limit, offset int) ([]models.Tenant, error) {
	var where string
	var args []any
	if status != nil && *status != "" {
		where = "WHERE status = $1"
		args = append(args, *status)
	} else {
		where = "WHERE status != 'deleted'"
	}
	placeholders := "$" + fmt.Sprintf("%d", len(args)+1)
	where += fmt.Sprintf(" ORDER BY created_at DESC LIMIT %s OFFSET $%d",
		placeholders, len(args)+2)
	args = append(args, limit, offset)
	var tenants []models.Tenant
	err := r.db.SelectContext(ctx, &tenants, where, args...)
	return tenants, err
}

func (r *TenantRepository) Count(ctx context.Context, status *string) (int, error) {
	var where string
	var args []any
	if status != nil && *status != "" {
		where = "WHERE status = $1"
		args = append(args, *status)
	}
	var count int
	err := r.db.GetContext(ctx, &count, "SELECT COUNT(*) FROM tenants "+where, args...)
	return count, err
}

func (r *TenantRepository) ExistsByName(ctx context.Context, name string) (bool, error) {
	var exists bool
	err := r.db.GetContext(ctx, &exists, "SELECT EXISTS(SELECT 1 FROM tenants WHERE name = $1 AND status != 'deleted')", name)
	return exists, err
}

func (r *TenantRepository) Create(ctx context.Context, t *models.Tenant) error {
	bytes, err := json.Marshal(t.Settings)
	if err != nil {
		return fmt.Errorf("failed to marshal settings: %w", err)
	}
	_, err = r.db.NamedExecContext(ctx, `
		INSERT INTO tenants (id, name, display_name, status, settings, created_at, updated_at)
		VALUES (:id, :name, :display_name, :status, :settings, now(), now())`,
		map[string]any{
			"id":           t.ID,
			"name":         t.Name,
			"display_name": t.DisplayName,
			"status":       t.Status,
			"settings":     string(bytes),
		})
	return err
}

func (r *TenantRepository) Update(ctx context.Context, id string, input map[string]any) (*models.Tenant, error) {
	updates := []string{}
	args := []any{id}
	idx := 2

	if val, ok := input["name"]; ok {
		args = append(args, val)
		updates = append(updates, fmt.Sprintf("name = $%d", idx))
		idx++
	}
	if val, ok := input["display_name"]; ok {
		args = append(args, val)
		updates = append(updates, fmt.Sprintf("display_name = $%d", idx))
		idx++
	}
	if val, ok := input["status"]; ok {
		args = append(args, val)
		updates = append(updates, fmt.Sprintf("status = $%d", idx))
		idx++
	}
	if val, ok := input["settings"]; ok {
		bytes, err := json.Marshal(val)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal settings: %w", err)
		}
		args = append(args, string(bytes))
		updates = append(updates, fmt.Sprintf("settings = $%d", idx))
		idx++
	}

	if len(updates) == 0 {
		return r.FindByID(ctx, id)
	}
	whereClause := fmt.Sprintf("WHERE id = $%d", idx)
	query := fmt.Sprintf("UPDATE tenants SET %s, updated_at = now() %s RETURNING *",
		combine(updates, ", "), whereClause)
	var t models.Tenant
	err := r.db.GetContext(ctx, &t, query, args...)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &t, err
}

func (r *TenantRepository) SoftDelete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "UPDATE tenants SET status = 'deleted', updated_at = now() WHERE id = $1", id)
	return err
}

func (r *TenantRepository) HardDelete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM tenants WHERE id = $1", id)
	return err
}

// --- Namespace CRUD ---

func (r *TenantRepository) FindNamespaceByName(ctx context.Context, namespaceName string) (*models.TenantNamespace, error) {
	var ns models.TenantNamespace
	err := r.db.GetContext(ctx, &ns, "SELECT * FROM namespace_allocations WHERE namespace_name = $1 AND status != 'deleted'", namespaceName)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &ns, err
}

func (r *TenantRepository) ListNamespacesByTenant(ctx context.Context, tenantID int64) ([]models.TenantNamespace, error) {
	var ns []models.TenantNamespace
	err := r.db.SelectContext(ctx, &ns, "SELECT * FROM namespace_allocations WHERE tenant_id = $1", tenantID)
	return ns, err
}

func (r *TenantRepository) FindAvailableNamespace(ctx context.Context) (*models.TenantNamespace, error) {
	var ns models.TenantNamespace
	err := r.db.GetContext(ctx, &ns, "SELECT * FROM namespace_allocations WHERE status = 'available' ORDER BY created_at LIMIT 1")
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &ns, err
}

func (r *TenantRepository) AllocateNamespace(ctx context.Context, id string, tenantID int64, purpose string, labels map[string]string) (*models.TenantNamespace, error) {
	bytes, err := json.Marshal(labels)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal labels: %w", err)
	}
	_, err = r.db.NamedExecContext(ctx, `
		UPDATE namespace_allocations
		SET tenant_id = :tenant_id, status = 'allocated', purpose = :purpose, labels = :labels, allocated_at = now(), updated_at = now()
		WHERE id = :id
		RETURNING *`,
		map[string]any{
			"id":        id,
			"tenant_id": tenantID,
			"purpose":   purpose,
			"labels":    string(bytes),
		})
	if err != nil {
		return nil, err
	}
	return r.FindNamespaceByID(ctx, id)
}

func (r *TenantRepository) ReleaseNamespace(ctx context.Context, id string) (*models.TenantNamespace, error) {
	_, err := r.db.ExecContext(ctx, "UPDATE namespace_allocations SET tenant_id = NULL, status = 'available', purpose = NULL, allocated_at = NULL, updated_at = now() WHERE id = $1", id)
	if err != nil {
		return nil, err
	}
	return r.FindNamespaceByID(ctx, id)
}

func (r *TenantRepository) FindNamespaceByID(ctx context.Context, id string) (*models.TenantNamespace, error) {
	var ns models.TenantNamespace
	err := r.db.GetContext(ctx, &ns, "SELECT * FROM namespace_allocations WHERE id = $1", id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &ns, err
}

func (r *TenantRepository) CountNamespacesByTenant(ctx context.Context, tenantID int64) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, "SELECT COUNT(*) FROM namespace_allocations WHERE tenant_id = $1", tenantID)
	return count, err
}

func (r *TenantRepository) CountNamespacesByStatus(ctx context.Context, status string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, "SELECT COUNT(*) FROM namespace_allocations WHERE status = $1", status)
	return count, err
}

// --- Quota CRUD ---

func (r *TenantRepository) FindQuotaByTenantID(ctx context.Context, tenantID string) (*models.QuotaConfig, error) {
	var q models.QuotaConfig
	err := r.db.GetContext(ctx, &q, "SELECT * FROM tenant_quotas WHERE tenant_id = $1", tenantID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &q, err
}

func (r *TenantRepository) CreateQuota(ctx context.Context, q *models.QuotaConfig) error {
	bytes, err := json.Marshal(q.Usage)
	if err != nil {
		return fmt.Errorf("failed to marshal usage: %w", err)
	}
	_, err = r.db.NamedExecContext(ctx, `
		INSERT INTO tenant_quotas (id, tenant_id, max_pipelines, max_pipeline_runs_per_day, max_concurrent_builds, max_tasks_per_pipeline, max_runners, max_cpu_cores, max_memory_gb, max_storage_mb, max_projects, max_users, api_rate_limit, api_rate_limit_window_seconds, usage, created_at, updated_at)
		VALUES (:id, :tenant_id, :max_pipelines, :max_pipeline_runs_per_day, :max_concurrent_builds, :max_tasks_per_pipeline, :max_runners, :max_cpu_cores, :max_memory_gb, :max_storage_mb, :max_projects, :max_users, :api_rate_limit, :api_rate_limit_window_seconds, :usage, now(), now())`,
		map[string]any{
			"id":                        q.ID,
			"tenant_id":                 q.TenantID,
			"max_pipelines":             q.MaxPipelines,
			"max_pipeline_runs_per_day": q.MaxPipelineRunsPerDay,
			"max_concurrent_builds":     q.MaxConcurrentBuilds,
			"max_tasks_per_pipeline":    q.MaxTasksPerPipeline,
			"max_runners":               q.MaxRunners,
			"max_cpu_cores":             q.MaxCpuCores,
			"max_memory_gb":             q.MaxMemoryGb,
			"max_storage_mb":            q.MaxStorageMb,
			"max_projects":              q.MaxProjects,
			"max_users":                 q.MaxUsers,
			"api_rate_limit":            q.ApiRateLimit,
			"api_rate_limit_window_seconds": q.ApiRateLimitWindowSeconds,
			"usage":                     string(bytes),
		})
	return err
}

func (r *TenantRepository) UpdateQuota(ctx context.Context, id string, updates map[string]any) error {
	args := []any{id}
	clauses := []string{}
	idx := 2

	for field, col := range map[string]string{
		"max_pipelines":                "max_pipelines",
		"max_pipeline_runs_per_day":    "max_pipeline_runs_per_day",
		"max_concurrent_builds":        "max_concurrent_builds",
		"max_tasks_per_pipeline":       "max_tasks_per_pipeline",
		"max_runners":                  "max_runners",
		"max_cpu_cores":                "max_cpu_cores",
		"max_memory_gb":                "max_memory_gb",
		"max_storage_mb":               "max_storage_mb",
		"max_projects":                 "max_projects",
		"max_users":                    "max_users",
		"api_rate_limit":               "api_rate_limit",
		"api_rate_limit_window_seconds":"api_rate_limit_window_seconds",
	} {
		if val, ok := updates[field]; ok {
			args = append(args, val)
			clauses = append(clauses, fmt.Sprintf("%s = $%d", col, idx))
			idx++
		}
	}
	if val, ok := updates["usage"]; ok {
		bytes, err := json.Marshal(val)
		if err != nil {
			return fmt.Errorf("failed to marshal usage: %w", err)
		}
		args = append(args, string(bytes))
		clauses = append(clauses, fmt.Sprintf("usage = $%d", idx))
		idx++
	}

	if len(clauses) == 0 {
		return nil
	}
	query := fmt.Sprintf("UPDATE tenant_quotas SET %s, updated_at = now() WHERE id = $%d",
		combine(clauses, ", "), len(args))
	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

// --- RLS Policy ---

func (r *TenantRepository) SetTenantSessionVariable(ctx context.Context, db *sql.DB, tenantID int64) error {
	_, err := db.ExecContext(ctx, "SELECT set_config('app.current_tenant_id', $1, false), set_config('app.tenant_isolation', 'true', false)", fmt.Sprintf("%d", tenantID))
	return err
}

func (r *TenantRepository) ClearTenantSessionVariable(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, "SELECT set_config('app.current_tenant_id', '', false), set_config('app.tenant_isolation', 'false', false)")
	return err
}

// combine joins strings with a separator.
func combine(parts []string, sep string) string {
	result := ""
	for i, p := range parts {
		if i > 0 {
			result += sep
		}
		result += p
	}
	return result
}
