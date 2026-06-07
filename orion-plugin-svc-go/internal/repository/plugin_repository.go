package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"orion/plugin-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ===========================================================================
// Plugin CRUD
// ===========================================================================

// Create inserts a new plugin row.
func (r *Repository) Create(ctx context.Context, d *models.Plugin) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO plugins (id, tenant_id, name, description, version, author, enabled, config, entrypoint)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		d.ID, d.TenantID, d.Name, d.Description, d.Version, d.Author, d.Enabled, d.Config, d.Entrypoint)
	return err
}

// Update modifies an existing plugin. Only non-nil fields in req are applied.
func (r *Repository) Update(ctx context.Context, tenantID, id string, req *models.UpdatePluginRequest) (*models.Plugin, error) {
	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if req.Name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, *req.Name)
		argIdx++
	}
	if req.Version != nil {
		setClauses = append(setClauses, fmt.Sprintf("version = $%d", argIdx))
		args = append(args, *req.Version)
		argIdx++
	}
	if req.Author != nil {
		setClauses = append(setClauses, fmt.Sprintf("author = $%d", argIdx))
		args = append(args, *req.Author)
		argIdx++
	}
	if req.Description != nil {
		setClauses = append(setClauses, fmt.Sprintf("description = $%d", argIdx))
		args = append(args, *req.Description)
		argIdx++
	}
	if req.Entrypoint != nil {
		setClauses = append(setClauses, fmt.Sprintf("entrypoint = $%d", argIdx))
		args = append(args, *req.Entrypoint)
		argIdx++
	}
	if req.Config != nil {
		setClauses = append(setClauses, fmt.Sprintf("config = $%d", argIdx))
		args = append(args, req.Config)
		argIdx++
	}

	if len(setClauses) == 0 {
		return r.GetByID(ctx, tenantID, id)
	}

	setClauses = append(setClauses, "updated_at = NOW()")
	query := fmt.Sprintf(
		"UPDATE plugins SET %s WHERE id = $%d AND tenant_id = $%d",
		strings.Join(setClauses, ", "), argIdx, argIdx+1,
	)
	args = append(args, id, tenantID)

	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, tenantID, id)
}

// List returns a page of plugins for a tenant.
func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Plugin, error) {
	var items []models.Plugin
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM plugins WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

// GetByID returns a single plugin by id and tenant.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Plugin, error) {
	var d models.Plugin
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM plugins WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// Delete removes a plugin by id and tenant.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM plugins WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// Count returns total plugin count for a tenant.
func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM plugins WHERE tenant_id=$1`, tenantID)
	return count, err
}

// ToggleEnabled flips the enabled flag on a plugin.
func (r *Repository) ToggleEnabled(ctx context.Context, tenantID, id string, enabled bool) (*models.Plugin, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE plugins SET enabled=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
		enabled, id, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, tenantID, id)
}

// ===========================================================================
// Plugin Executions
// ===========================================================================

// CreateExecution inserts a new execution record.
func (r *Repository) CreateExecution(ctx context.Context, e *models.PluginExecution) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO plugin_executions
			(id, plugin_id, tenant_id, task_id, pipeline_run_id, stage_id, status, started_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		e.ID, e.PluginID, e.TenantID, e.TaskID, e.PipelineRunID, e.StageID, e.Status, e.StartedAt)
	return err
}

// CompleteExecution marks an execution as finished.
func (r *Repository) CompleteExecution(ctx context.Context, tenantID, executionID string, result *models.ExecutionResult) error {
	now := time.Now()
	_, err := r.db.ExecContext(ctx, `
		UPDATE plugin_executions
		SET status=$1, exit_code=$2, duration_ms=$3, error_message=$4,
		    killed=$5, kill_reason=$6, completed_at=$7
		WHERE id=$8 AND tenant_id=$9`,
		func() string {
			if result.Success {
				return "completed"
			}
			return "failed"
		}(),
		result.ExitCode, result.DurationMs, result.ErrorMessage,
		result.Killed, result.KillReason, now,
		executionID, tenantID)
	return err
}

// GetExecution returns a single execution by id.
func (r *Repository) GetExecution(ctx context.Context, tenantID, id string) (*models.PluginExecution, error) {
	var e models.PluginExecution
	err := r.db.GetContext(ctx, &e,
		`SELECT * FROM plugin_executions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &e, nil
}

// GetExecutionByTaskID returns a single execution by task id.
func (r *Repository) GetExecutionByTaskID(ctx context.Context, tenantID, taskID string) (*models.PluginExecution, error) {
	var e models.PluginExecution
	err := r.db.GetContext(ctx, &e,
		`SELECT * FROM plugin_executions WHERE task_id=$1 AND tenant_id=$2 ORDER BY started_at DESC LIMIT 1`,
		taskID, tenantID)
	if err != nil {
		return nil, err
	}
	return &e, nil
}

// ListExecutions returns executions for a plugin, newest first.
func (r *Repository) ListExecutions(ctx context.Context, tenantID, pluginID string, offset, limit int) ([]models.PluginExecution, error) {
	var items []models.PluginExecution
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM plugin_executions
		 WHERE tenant_id=$1 AND plugin_id=$2
		 ORDER BY started_at DESC OFFSET $3 LIMIT $4`,
		tenantID, pluginID, offset, limit)
	return items, err
}

// CountExecutions returns total execution count for a plugin.
func (r *Repository) CountExecutions(ctx context.Context, tenantID, pluginID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM plugin_executions WHERE tenant_id=$1 AND plugin_id=$2`,
		tenantID, pluginID)
	return count, err
}

// GetActiveExecutionCount returns how many executions are currently running for a tenant.
func (r *Repository) GetActiveExecutionCount(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM plugin_executions WHERE tenant_id=$1 AND status='running'`,
		tenantID)
	return count, err
}

// ===========================================================================
// Audit Entries
// ===========================================================================

// CreateAuditEntry inserts an audit log entry.
func (r *Repository) CreateAuditEntry(ctx context.Context, e *models.AuditEntry) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO plugin_audit_entries
			(id, tenant_id, plugin_id, task_id, level, action, message, input, output, duration_ms, metadata, entry_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		e.ID, e.TenantID, e.PluginID, e.TaskID, e.Level, e.Action,
		e.Message, e.Input, e.Output, e.DurationMs, e.Metadata, e.EntryAt)
	return err
}

// ListAuditEntries returns audit entries matching the filter.
func (r *Repository) ListAuditEntries(ctx context.Context, f *models.AuditLogFilter) ([]models.AuditEntry, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if f.TenantID != "" {
		where = append(where, fmt.Sprintf("tenant_id = $%d", argIdx))
		args = append(args, f.TenantID)
		argIdx++
	}
	if f.PluginID != "" {
		where = append(where, fmt.Sprintf("plugin_id = $%d", argIdx))
		args = append(args, f.PluginID)
		argIdx++
	}
	if f.TaskID != "" {
		where = append(where, fmt.Sprintf("task_id = $%d", argIdx))
		args = append(args, f.TaskID)
		argIdx++
	}
	if f.Level != "" {
		where = append(where, fmt.Sprintf("level = $%d", argIdx))
		args = append(args, f.Level)
		argIdx++
	}
	if f.Action != "" {
		where = append(where, fmt.Sprintf("action = $%d", argIdx))
		args = append(args, f.Action)
		argIdx++
	}

	query := fmt.Sprintf(
		`SELECT * FROM plugin_audit_entries WHERE %s ORDER BY entry_at DESC LIMIT $%d`,
		strings.Join(where, " AND "), argIdx,
	)
	args = append(args, f.GetLimit())

	var items []models.AuditEntry
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// CleanupAuditEntries deletes audit entries older than the given duration.
func (r *Repository) CleanupAuditEntries(ctx context.Context, retention time.Duration) (int, error) {
	cutoff := time.Now().Add(-retention)
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM plugin_audit_entries WHERE entry_at < $1`, cutoff)
	if err != nil {
		return 0, err
	}
	n, _ := result.RowsAffected()
	return int(n), nil
}

// ===========================================================================
// Security Events
// ===========================================================================

// CreateSecurityEvent inserts a security event.
func (r *Repository) CreateSecurityEvent(ctx context.Context, e *models.SecurityEvent) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO plugin_security_events
			(id, event_type, severity, task_id, plugin_id, tenant_id, message, details)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		e.ID, e.EventType, e.Severity, e.TaskID, e.PluginID, e.TenantID, e.Message, e.Details)
	return err
}

// ListSecurityEvents returns security events matching the filter.
func (r *Repository) ListSecurityEvents(ctx context.Context, f *models.SecurityEventFilter) ([]models.SecurityEvent, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if f.TenantID != "" {
		where = append(where, fmt.Sprintf("tenant_id = $%d", argIdx))
		args = append(args, f.TenantID)
		argIdx++
	}
	if f.PluginID != "" {
		where = append(where, fmt.Sprintf("plugin_id = $%d", argIdx))
		args = append(args, f.PluginID)
		argIdx++
	}
	if f.TaskID != "" {
		where = append(where, fmt.Sprintf("task_id = $%d", argIdx))
		args = append(args, f.TaskID)
		argIdx++
	}
	if f.Type != "" {
		where = append(where, fmt.Sprintf("event_type = $%d", argIdx))
		args = append(args, f.Type)
		argIdx++
	}
	if f.Severity != "" {
		where = append(where, fmt.Sprintf("severity = $%d", argIdx))
		args = append(args, f.Severity)
		argIdx++
	}

	query := fmt.Sprintf(
		`SELECT * FROM plugin_security_events WHERE %s ORDER BY created_at DESC LIMIT $%d`,
		strings.Join(where, " AND "), argIdx,
	)
	args = append(args, f.GetLimit())

	var items []models.SecurityEvent
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// CleanupSecurityEvents deletes security events older than the given duration.
func (r *Repository) CleanupSecurityEvents(ctx context.Context, retention time.Duration) (int, error) {
	cutoff := time.Now().Add(-retention)
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM plugin_security_events WHERE created_at < $1`, cutoff)
	if err != nil {
		return 0, err
	}
	n, _ := result.RowsAffected()
	return int(n), nil
}

// ===========================================================================
// Plugin Resource Quotas
// ===========================================================================

// UpsertPluginQuota creates or updates the resource quota for a plugin.
func (r *Repository) UpsertPluginQuota(ctx context.Context, pluginID string, q *models.ResourceQuota) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO plugin_resource_quotas (plugin_id, cpu_cores, memory_bytes, timeout_ms, max_concurrent, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (plugin_id) DO UPDATE
		SET cpu_cores = EXCLUDED.cpu_cores,
		    memory_bytes = EXCLUDED.memory_bytes,
		    timeout_ms = EXCLUDED.timeout_ms,
		    max_concurrent = EXCLUDED.max_concurrent,
		    updated_at = NOW()`,
		pluginID, q.CPUCores, q.MemoryBytes, q.TimeoutMs, q.MaxConcurrent)
	return err
}

// GetPluginQuota returns the resource quota for a plugin, or nil if none exists.
func (r *Repository) GetPluginQuota(ctx context.Context, pluginID string) (*models.PluginResourceQuota, error) {
	var q models.PluginResourceQuota
	err := r.db.GetContext(ctx, &q,
		`SELECT * FROM plugin_resource_quotas WHERE plugin_id=$1`, pluginID)
	if err != nil {
		return nil, err
	}
	return &q, nil
}

// DeletePluginQuota removes the resource quota for a plugin.
func (r *Repository) DeletePluginQuota(ctx context.Context, pluginID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM plugin_resource_quotas WHERE plugin_id=$1`, pluginID)
	return err
}

// ===========================================================================
// Tenant Quotas
// ===========================================================================

// UpsertTenantQuota creates or updates the resource quota for a tenant.
func (r *Repository) UpsertTenantQuota(ctx context.Context, tenantID string, q *models.ResourceQuota) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO plugin_tenant_quotas (tenant_id, cpu_cores, memory_bytes, timeout_ms, max_concurrent, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (tenant_id) DO UPDATE
		SET cpu_cores = EXCLUDED.cpu_cores,
		    memory_bytes = EXCLUDED.memory_bytes,
		    timeout_ms = EXCLUDED.timeout_ms,
		    max_concurrent = EXCLUDED.max_concurrent,
		    updated_at = NOW()`,
		tenantID, q.CPUCores, q.MemoryBytes, q.TimeoutMs, q.MaxConcurrent)
	return err
}

// GetTenantQuota returns the resource quota for a tenant, or nil if none exists.
func (r *Repository) GetTenantQuota(ctx context.Context, tenantID string) (*models.TenantQuota, error) {
	var q models.TenantQuota
	err := r.db.GetContext(ctx, &q,
		`SELECT * FROM plugin_tenant_quotas WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	return &q, nil
}

// DeleteTenantQuota removes the resource quota for a tenant.
func (r *Repository) DeleteTenantQuota(ctx context.Context, tenantID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM plugin_tenant_quotas WHERE tenant_id=$1`, tenantID)
	return err
}
