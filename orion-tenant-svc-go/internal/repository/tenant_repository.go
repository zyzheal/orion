package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"orion/go-common/pkg/database"
	"orion/tenant-svc-go/internal/models"
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

// --- Tenant User CRUD ---

// ListTenantUsers returns users belonging to a tenant (LEFT JOIN with users table).
func (r *TenantRepository) ListTenantUsers(ctx context.Context, tenantID string) ([]models.TenantUser, error) {
	var users []models.TenantUser
	err := r.db.SelectContext(ctx, &users, `
		SELECT tu.id, tu.tenant_id, tu.user_id, tu.role, tu.created_at, tu.updated_at,
		       COALESCE(u.username, '') as username, COALESCE(u.email, '') as email,
		       u.display_name, u.status as user_status
		FROM tenant_users tu
		LEFT JOIN users u ON tu.user_id = u.id
		WHERE tu.tenant_id = $1
		ORDER BY tu.role DESC, tu.created_at ASC`, tenantID)
	return users, err
}

// InsertTenantUser adds a user to a tenant.
func (r *TenantRepository) InsertTenantUser(ctx context.Context, tenantID string, userID string, role string) error {
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO tenant_users (tenant_id, user_id, role, created_at, updated_at)
		VALUES (:tenant_id, :user_id, :role, now(), now())
		ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = :role, updated_at = now()`,
		map[string]any{
			"tenant_id": tenantID,
			"user_id":   userID,
			"role":      role,
		})
	return err
}

// DeleteTenantUser removes a user from a tenant.
func (r *TenantRepository) DeleteTenantUser(ctx context.Context, tenantID string, userID string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM tenant_users WHERE tenant_id = $1 AND user_id = $2", tenantID, userID)
	return err
}

// TenantUserExists checks if a user belongs to a tenant.
func (r *TenantRepository) TenantUserExists(ctx context.Context, tenantID string, userID string) (bool, error) {
	var exists bool
	err := r.db.GetContext(ctx, &exists, "SELECT EXISTS(SELECT 1 FROM tenant_users WHERE tenant_id = $1 AND user_id = $2)", tenantID, userID)
	return exists, err
}

// CountAdminsInTenant counts owners and admins in a tenant.
func (r *TenantRepository) CountAdminsInTenant(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		"SELECT COUNT(*) FROM tenant_users WHERE tenant_id = $1 AND (role = 'owner' OR role = 'admin')", tenantID)
	return count, err
}

// GetTenantUserRole returns the role of a user in a tenant.
func (r *TenantRepository) GetTenantUserRole(ctx context.Context, tenantID string, userID string) (*string, error) {
	var role string
	err := r.db.GetContext(ctx, &role, "SELECT role FROM tenant_users WHERE tenant_id = $1 AND user_id = $2", tenantID, userID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &role, err
}

// --- Tenant Invite CRUD ---

// CreateInvite inserts a new invitation record.
func (r *TenantRepository) CreateInvite(ctx context.Context, invite *models.TenantInvite) error {
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO tenant_invites (id, tenant_id, email, role, invite_code, status, invited_by, expires_at, created_at)
		VALUES (:id, :tenant_id, :email, :role, :invite_code, :status, :invited_by, :expires_at, now())
		RETURNING *`,
		map[string]any{
			"id":          invite.ID,
			"tenant_id":   invite.TenantID,
			"email":       invite.Email,
			"role":        invite.Role,
			"invite_code": invite.InviteCode,
			"status":      invite.Status,
			"invited_by":  invite.InvitedBy,
			"expires_at":  invite.ExpiresAt,
		})
	return err
}

// FindInviteByCode looks up an invite by its code (JOINs tenants for display name).
func (r *TenantRepository) FindInviteByCode(ctx context.Context, code string) (*models.TenantInvite, error) {
	var inv models.TenantInvite
	err := r.db.GetContext(ctx, &inv, `
		SELECT ti.id, ti.tenant_id, ti.email, ti.role, ti.invite_code, ti.status,
		       ti.invited_by, ti.accepted_by, ti.expires_at, ti.created_at, ti.accepted_at,
		       t.name as tenant_name, t.display_name as tenant_display_name
		FROM tenant_invites ti
		INNER JOIN tenants t ON ti.tenant_id = t.id
		WHERE ti.invite_code = $1`, code)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &inv, err
}

// UpdateInviteStatus changes the status of an invite.
func (r *TenantRepository) UpdateInviteStatus(ctx context.Context, id string, status string, acceptedBy *string) error {
	if acceptedBy != nil {
		_, err := r.db.ExecContext(ctx,
			"UPDATE tenant_invites SET status = $1, accepted_by = $2, accepted_at = now() WHERE id = $3", status, *acceptedBy, id)
		return err
	}
	_, err := r.db.ExecContext(ctx, "UPDATE tenant_invites SET status = $1 WHERE id = $2", status, id)
	return err
}

// FindPendingInvite checks for an existing pending invite.
func (r *TenantRepository) FindPendingInvite(ctx context.Context, tenantID string, email string) (*models.TenantInvite, error) {
	var inv models.TenantInvite
	err := r.db.GetContext(ctx, &inv, `
		SELECT id, tenant_id, email, role, invite_code, status, expires_at
		FROM tenant_invites
		WHERE tenant_id = $1 AND email = $2 AND status = 'pending' AND expires_at > now()`, tenantID, email)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &inv, err
}

// UserByEmail looks up a user by email.
func (r *TenantRepository) UserByEmail(ctx context.Context, email string) (*struct {
	ID string
}, error) {
	var id string
	err := r.db.GetContext(ctx, &id, "SELECT id FROM users WHERE email = $1", email)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &struct{ ID string }{ID: id}, nil
}

// UserIsTenantMember checks if a user (by email) is already a member.
func (r *TenantRepository) UserIsTenantMember(ctx context.Context, tenantID string, email string) (bool, error) {
	var exists bool
	err := r.db.GetContext(ctx, &exists, `
		SELECT EXISTS(SELECT 1 FROM tenant_users tu
		             INNER JOIN users u ON tu.user_id = u.id
		             WHERE tu.tenant_id = $1 AND u.email = $2)`, tenantID, email)
	return exists, err
}

// --- Quota Alert CRUD ---

// ListQuotaAlerts returns paginated quota alerts for a tenant.
func (r *TenantRepository) ListQuotaAlerts(ctx context.Context, tenantID string, resourceType, notifyStatus *string, limit, offset int) ([]models.QuotaAlert, error) {
	var clauses []string
	var args []any
	idx := 1
	args = append(args, tenantID)
	idx++

	clauses = append(clauses, fmt.Sprintf("tenant_id = $%d", idx-1))

	if resourceType != nil && *resourceType != "" {
		clauses = append(clauses, fmt.Sprintf("resource_type = $%d", idx))
		args = append(args, *resourceType)
		idx++
	}
	if notifyStatus != nil && *notifyStatus != "" {
		clauses = append(clauses, fmt.Sprintf("notify_status = $%d", idx))
		args = append(args, *notifyStatus)
		idx++
	}

	where := "WHERE " + combine(clauses, " AND ")
	placeholders := fmt.Sprintf("$%d", idx)
	limitPlace := fmt.Sprintf("$%d", idx+1)
	query := fmt.Sprintf(`
		SELECT id, tenant_id, resource_type, threshold_percent, current_usage,
		       quota_limit, notify_status, cooldown_until, created_at
		FROM tenant_quota_alerts %s
		ORDER BY created_at DESC
		LIMIT %s OFFSET %s`, where, placeholders, limitPlace)
	args = append(args, limit, offset)

	var alerts []models.QuotaAlert
	err := r.db.SelectContext(ctx, &alerts, query, args...)
	return alerts, err
}

// CountQuotaAlerts returns the alert count for a tenant.
func (r *TenantRepository) CountQuotaAlerts(ctx context.Context, tenantID string, resourceType, notifyStatus *string) (int, error) {
	var clauses []string
	var args []any
	args = append(args, tenantID)
	clauses = append(clauses, "tenant_id = $1")
	idx := 2

	if resourceType != nil && *resourceType != "" {
		clauses = append(clauses, fmt.Sprintf("resource_type = $%d", idx))
		args = append(args, *resourceType)
		idx++
	}
	if notifyStatus != nil && *notifyStatus != "" {
		clauses = append(clauses, fmt.Sprintf("notify_status = $%d", idx))
		args = append(args, *notifyStatus)
		idx++
	}

	where := "WHERE " + combine(clauses, " AND ")
	var count int
	err := r.db.GetContext(ctx, &count, "SELECT COUNT(*) FROM tenant_quota_alerts "+where, args...)
	return count, err
}

// ActiveAlertCount returns the count of alerts not in cooldown.
func (r *TenantRepository) ActiveAlertCount(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `
		SELECT COUNT(*) FROM tenant_quota_alerts
		WHERE tenant_id = $1 AND notify_status = 'sent'
		AND (cooldown_until IS NULL OR cooldown_until < now())`, tenantID)
	return count, err
}

// AlertStatsByStatus returns alert counts grouped by notify_status.
func (r *TenantRepository) AlertStatsByStatus(ctx context.Context, tenantID string) (map[string]int, error) {
	rows, err := r.db.QueryContext(ctx,
		"SELECT notify_status, COUNT(*) as cnt FROM tenant_quota_alerts WHERE tenant_id = $1 GROUP BY notify_status", tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make(map[string]int)
	for rows.Next() {
		var status string
		var cnt int
		if err := rows.Scan(&status, &cnt); err != nil {
			return nil, err
		}
		result[status] = cnt
	}
	return result, nil
}

// AlertStatsByResourceType returns alert counts grouped by resource_type (last 7 days).
func (r *TenantRepository) AlertStatsByResourceType(ctx context.Context, tenantID string) (map[string]int, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT resource_type, COUNT(*) as cnt
		FROM tenant_quota_alerts
		WHERE tenant_id = $1 AND created_at > now() - interval '7 days'
		GROUP BY resource_type`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make(map[string]int)
	for rows.Next() {
		var rtype string
		var cnt int
		if err := rows.Scan(&rtype, &cnt); err != nil {
			return nil, err
		}
		result[rtype] = cnt
	}
	return result, nil
}

// ActiveAlerts returns recent alerts not in cooldown (limited).
func (r *TenantRepository) ActiveAlerts(ctx context.Context, tenantID string, limit int) ([]models.QuotaAlert, error) {
	var alerts []models.QuotaAlert
	err := r.db.SelectContext(ctx, &alerts, `
		SELECT id, tenant_id, resource_type, threshold_percent, current_usage, quota_limit, notify_status, cooldown_until, created_at
		FROM tenant_quota_alerts
		WHERE tenant_id = $1 AND notify_status = 'sent'
		AND (cooldown_until IS NULL OR cooldown_until < now())
		ORDER BY created_at DESC LIMIT $2`, tenantID, limit)
	return alerts, err
}

// --- Namespace Usage ---

// NamespaceUsage returns detailed usage info per namespace for a tenant.
func (r *TenantRepository) NamespaceUsage(ctx context.Context, tenantID int64) ([]models.NamespaceUsage, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, namespace_name, status, tenant_id, allocated_at, purpose, runner_count
		FROM namespace_allocations
		WHERE tenant_id = $1
		ORDER BY allocated_at DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []models.NamespaceUsage
	for rows.Next() {
		var nu models.NamespaceUsage
		var allocatedAt *time.Time
		var purpose *string
		err := rows.Scan(&nu.ID, &nu.NamespaceName, &nu.Status, &nu.TenantID, &allocatedAt, &purpose, &nu.RunnerCount)
		if err != nil {
			return nil, err
		}
		nu.AllocatedAt = allocatedAt
		nu.Purpose = purpose
		// Fetch pipeline count and active runs
		var pipelineCount int
		err = r.db.GetContext(ctx, &pipelineCount, "SELECT COUNT(*) FROM pipelines WHERE namespace = $1", nu.NamespaceName)
		if err == nil {
			nu.PipelineCount = pipelineCount
		}
		var activeRuns int
		err = r.db.GetContext(ctx, &activeRuns,
			"SELECT COUNT(*) FROM pipeline_runs WHERE namespace = $1 AND status IN ('pending', 'running')", nu.NamespaceName)
		if err == nil {
			nu.ActiveRuns = activeRuns
		}
		result = append(result, nu)
	}
	return result, nil
}

// CountNamespacesForTenant returns the number of namespaces allocated to a tenant.
func (r *TenantRepository) CountNamespacesForTenant(ctx context.Context, tenantID int64) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, "SELECT COUNT(*) FROM namespace_allocations WHERE tenant_id = $1", tenantID)
	return count, err
}

// --- Tenant Membership ---

// TenantUserByUserID returns tenants a user belongs to.
func (r *TenantRepository) TenantUserByUserID(ctx context.Context, userID string) ([]models.TenantMembership, error) {
	var memberships []models.TenantMembership
	err := r.db.SelectContext(ctx, &memberships, `
		SELECT t.id, t.name, t.display_name, t.status, tu.role, t.created_at
		FROM tenants t
		INNER JOIN tenant_users tu ON t.id = tu.tenant_id
		WHERE tu.user_id = $1 AND t.status = 'active'
		ORDER BY tu.role DESC, t.display_name ASC`, userID)
	return memberships, err
}

// UserExists checks if a user exists.
func (r *TenantRepository) UserExists(ctx context.Context, userID string) (bool, error) {
	var exists bool
	err := r.db.GetContext(ctx, &exists, "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)", userID)
	return exists, err
}

// TenantExists checks if a tenant exists.
func (r *TenantRepository) TenantExists(ctx context.Context, id string) (bool, error) {
	var exists bool
	err := r.db.GetContext(ctx, &exists, "SELECT EXISTS(SELECT 1 FROM tenants WHERE id = $1 AND status != 'deleted')", id)
	return exists, err
}
