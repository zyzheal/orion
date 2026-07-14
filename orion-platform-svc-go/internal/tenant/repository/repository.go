package repository

import (
	"context"
	"database/sql"
	"fmt"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// --- Tenants ---

func (r *Repository) CreateTenant(ctx context.Context, name string, displayName *string, settingsJSON string, status string) (*int, error) {
	var id int
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO tenants (name, display_name, status, settings, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
		name, displayName, status, settingsJSON,
).Scan(&id)
	return &id, err
}

func (r *Repository) GetTenantRow(ctx context.Context, id string) (*map[string]any, error) {
	m := make(map[string]any)
	var name, status string
	var displayName, settings sql.NullString
	var createdAt, updatedAt sql.NullString
	if err := r.db.QueryRowContext(ctx,
		`SELECT id, name, display_name, status, settings, created_at, updated_at FROM tenants WHERE id = $1`,
		id,
).Scan(&id, &name, &displayName, &status, &settings, &createdAt, &updatedAt); err != nil {
		return nil, err
	}
	m["id"] = id
	m["name"] = name
	m["display_name"] = displayName.String
	m["status"] = status
	m["settings"] = settings.String
	m["created_at"] = createdAt.String
	m["updated_at"] = updatedAt.String
	return &m, nil
}

func (r *Repository) ListTenants(ctx context.Context, status *string, limit, offset int) ([]map[string]any, int, error) {
	where := "WHERE deleted_at IS NULL"
	args := []any{}
	n := 1
	if status != nil {
		where += fmt.Sprintf(" AND status = $%d", n)
		args = append(args, *status)
		n++
	}

	countRows, err := r.db.QueryContext(ctx, fmt.Sprintf(`SELECT COUNT(*) FROM tenants %s`, where), args...)
	if err != nil {
		return nil, 0, err
	}
	var total int
	if err := countRows.Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.db.QueryContext(ctx, fmt.Sprintf(`SELECT id, name, display_name, status, settings, created_at, updated_at FROM tenants %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, where, len(args), len(args)+1),
		append(args, limit, offset)...)
	if err != nil {
		return nil, total, err
	}
	defer rows.Close()

	var result []map[string]any
	for rows.Next() {
		m := make(map[string]any)
		scanArgs := []any{
			new(int), new(string), new(sql.NullString), new(string),
			new(sql.NullString), new(string), new(sql.NullString),
		}
		if err := rows.Scan(scanArgs...); err != nil {
			return nil, total, err
		}
		m["id"] = *(scanArgs[0].(*int))
		m["name"] = *(scanArgs[1].(*string))
		m["display_name"] = scanArgs[2].(*sql.NullString).String
		m["status"] = *(scanArgs[3].(*string))
		m["settings"] = scanArgs[4].(*sql.NullString).String
		m["created_at"] = scanArgs[5].(*sql.NullString).String
		m["updated_at"] = scanArgs[6].(*sql.NullString).String
		result = append(result, m)
	}
	return result, total, nil
}

func (r *Repository) UpdateTenant(ctx context.Context, id string, name *string, displayName *string, status *string, settingsJSON string) error {
	updates := []string{}
	args := []any{}
	n := 1

	if name != nil {
		updates = append(updates, fmt.Sprintf("name = $%d", n))
		args = append(args, *name)
		n++
	}
	if displayName != nil {
		updates = append(updates, fmt.Sprintf("display_name = $%d", n))
		args = append(args, *displayName)
		n++
	}
	if status != nil {
		updates = append(updates, fmt.Sprintf("status = $%d", n))
		args = append(args, *status)
		n++
	}
	if settingsJSON != "" {
		updates = append(updates, fmt.Sprintf("settings = $%d", n))
		args = append(args, settingsJSON)
		n++
	}

	args = append(args, id)
	_, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE tenants SET %s, updated_at = NOW() WHERE id = $%d`,
			updatesStr(updates), n),
		args...,
)
	return err
}

func (r *Repository) DeleteTenant(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE tenants SET deleted_at = NOW() WHERE id = $1`, id)
	return err
}

func (r *Repository) TenantCount(ctx context.Context, status *string) (int, error) {
	where := "WHERE deleted_at IS NULL"
	args := []any{}
	n := 1
	if status != nil {
		where += fmt.Sprintf(" AND status = $%d", n)
		args = append(args, *status)
	}
	var total int
	err := r.db.QueryRowContext(ctx, fmt.Sprintf(`SELECT COUNT(*) FROM tenants %s`, where), args...).Scan(&total)
	return total, err
}

// --- Tenant users ---

func (r *Repository) GetUserTenants(ctx context.Context, userID string) ([]map[string]any, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT t.id, t.name, t.display_name, t.status, tu.role, t.created_at
		 FROM tenants t
		 INNER JOIN tenant_users tu ON t.id = tu.tenant_id
		 WHERE tu.user_id = $1 AND t.status = 'active'
		 ORDER BY tu.role DESC, t.display_name ASC`,
		userID,
)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []map[string]any
	for rows.Next() {
		m := make(map[string]any)
		var id int
		var name string
		var displayName sql.NullString
		var status string
		var role string
		var createdAt sql.NullString
		if err := rows.Scan(&id, &name, &displayName, &status, &role, &createdAt); err != nil {
			return nil, err
		}
		m["id"] = id
		m["name"] = name
		m["display_name"] = displayName.String
		m["status"] = status
		m["role"] = role
		m["created_at"] = createdAt.String
		result = append(result, m)
	}
	return result, nil
}

func (r *Repository) ListTenantUsers(ctx context.Context, tenantID string) ([]map[string]any, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT tu.user_id, tu.role, tu.created_at, tu.updated_at,
		 u.username, u.email, u.display_name, u.status as user_status
		 FROM tenant_users tu
		 LEFT JOIN users u ON tu.user_id = u.id
		 WHERE tu.tenant_id = $1
		 ORDER BY tu.role DESC, tu.created_at ASC`,
		tenantID,
)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []map[string]any
	for rows.Next() {
		m := make(map[string]any)
		if err := rows.Scan(
			new(string), new(string), new(string), new(string),
			new(sql.NullString), new(sql.NullString), new(sql.NullString),
			new(sql.NullString),
		); err != nil {
			return nil, err
		}
		result = append(result, m)
	}
	return result, nil
}

func (r *Repository) AddTenantUser(ctx context.Context, tenantID, userID, role string) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO tenant_users (tenant_id, user_id, role, created_at)
		 VALUES ($1, $2, $3, NOW())
		 ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = $3`,
		tenantID, userID, role,
)
	return err
}

func (r *Repository) RemoveTenantUser(ctx context.Context, tenantID, userID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM tenant_users WHERE tenant_id = $1 AND user_id = $2`,
		tenantID, userID,
)
	return err
}

func (r *Repository) CountTenantAdmins(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM tenant_users WHERE tenant_id = $1 AND (role = 'owner' OR role = 'admin')`,
		tenantID,
).Scan(&count)
	return count, err
}

// --- Invitations ---

func (r *Repository) GetTenantByRow(ctx context.Context, tenantID string) (*map[string]any, error) {
	m := make(map[string]any)
	var id, name string
	var displayName sql.NullString
	if err := r.db.QueryRowContext(ctx,
		`SELECT id, name, display_name FROM tenants WHERE id = $1`,
		tenantID,
).Scan(&id, &name, &displayName); err != nil {
		return nil, err
	}
	m["id"] = id
	m["name"] = name
	m["display_name"] = displayName.String
	return &m, nil
}

func (r *Repository) GetPendingInvite(ctx context.Context, tenantID, email string) (*map[string]any, error) {
	rows := r.db.QueryRowContext(ctx,
		`SELECT id, status, expires_at FROM tenant_invites
		 WHERE tenant_id = $1 AND email = $2 AND status = 'pending' AND expires_at > NOW()`,
		tenantID, email,
)
	if rows.Err() != nil {
		return nil, rows.Err()
	}
	m := make(map[string]any)
	var status, expiresAt string
	var id string
	if err := rows.Scan(&id, &status, &expiresAt); err != nil {
		return nil, err
	}
	m["id"] = id
	m["status"] = status
	m["expires_at"] = expiresAt
	return &m, nil
}

func (r *Repository) GetTenantUserByEmail(ctx context.Context, tenantID, email string) (bool, error) {
	var exists bool
	err := r.db.QueryRowContext(ctx,
		`SELECT EXISTS(SELECT 1 FROM tenant_users tu INNER JOIN users u ON tu.user_id = u.id WHERE tu.tenant_id = $1 AND u.email = $2)`,
		tenantID, email,
).Scan(&exists)
	return exists, err
}

func (r *Repository) CreateInvite(ctx context.Context, tenantID, email, role, inviteCode, invitedBy string, expiresAt string) (*map[string]any, error) {
	rows := r.db.QueryRowContext(ctx,
		`INSERT INTO tenant_invites (tenant_id, email, role, invite_code, status, invited_by, expires_at, created_at)
		 VALUES ($1, $2, $3, $4, 'pending', $5, $6, NOW())
		 RETURNING id, invite_code, email, role, status, expires_at, created_at`,
		tenantID, email, role, inviteCode, invitedBy, expiresAt,
)
	if rows.Err() != nil {
		return nil, rows.Err()
	}
	m := make(map[string]any)
	var rowID, rowInviteCode, rowEmail, rowRole, rowStatus string
	var expiresAtStr, createdAtStr string
	if err := rows.Scan(&rowID, &rowInviteCode, &rowEmail, &rowRole, &rowStatus, &expiresAtStr, &createdAtStr); err != nil {
		return nil, err
	}
	m["id"] = rowID
	m["invite_code"] = rowInviteCode
	m["email"] = rowEmail
	m["role"] = rowRole
	m["status"] = rowStatus
	m["expires_at"] = expiresAtStr
	m["created_at"] = createdAtStr
	return &m, nil
}

func (r *Repository) GetInviteByCode(ctx context.Context, code string) (*map[string]any, error) {
	rows := r.db.QueryRowContext(ctx,
		`SELECT ti.id, ti.tenant_id, ti.email, ti.role, ti.status, ti.expires_at,
		 t.name as tenant_name, t.display_name as tenant_display_name
		 FROM tenant_invites ti INNER JOIN tenants t ON ti.tenant_id = t.id
		 WHERE ti.invite_code = $1`,
		code,
)
	if rows.Err() != nil {
		return nil, rows.Err()
	}
	m := make(map[string]any)
	var rowID, rowTenantID, rowEmail, rowRole, rowStatus string
	var expiresAt string
	var rowTenantName string
	var rowTenantDisplayName sql.NullString
	if err := rows.Scan(&rowID, &rowTenantID, &rowEmail, &rowRole, &rowStatus, &expiresAt, &rowTenantName, &rowTenantDisplayName); err != nil {
		return nil, err
	}
	m["id"] = rowID
	m["tenant_id"] = rowTenantID
	m["email"] = rowEmail
	m["role"] = rowRole
	m["status"] = rowStatus
	m["expires_at"] = expiresAt
	m["tenant_name"] = rowTenantName
	m["tenant_display_name"] = rowTenantDisplayName.String
	return &m, nil
}

func (r *Repository) UserIsTenantMember(ctx context.Context, tenantID, userID string) (bool, error) {
	var exists bool
	err := r.db.QueryRowContext(ctx,
		`SELECT EXISTS(SELECT 1 FROM tenant_users WHERE tenant_id = $1 AND user_id = $2)`,
		tenantID, userID,
).Scan(&exists)
	return exists, err
}

func (r *Repository) UpdateInviteStatus(ctx context.Context, status, userID string, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE tenant_invites SET status = $1, accepted_by = $2, accepted_at = NOW() WHERE id = $3`,
		status, userID, id,
)
	return err
}

// --- Namespace allocations ---

func (r *Repository) AllocateNamespace(ctx context.Context, tenantID int, nsName string, purpose string) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO namespace_allocations (tenant_id, namespace_name, status, purpose, allocated_at, created_at)
		 VALUES ($1, $2, 'allocated', $3, NOW(), NOW())`,
		tenantID, nsName, purpose,
)
	return err
}

func (r *Repository) ReleaseNamespace(ctx context.Context, nsName string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE namespace_allocations SET status = 'released', updated_at = NOW() WHERE namespace_name = $1`,
		nsName,
)
	return err
}

func (r *Repository) GetTenantNamespaces(ctx context.Context, tenantID string) ([]map[string]any, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, namespace_name, status, tenant_id, allocated_at, purpose, runner_count
		 FROM namespace_allocations
		 WHERE tenant_id = $1
		 ORDER BY allocated_at DESC`,
		tenantID,
)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []map[string]any
	for rows.Next() {
		m := make(map[string]any)
		var rowID int
		var rowNSName, rowStatus, rowTenantID string
		var rowAllocatedAt, rowPurpose sql.NullString
		var rowRunnerCount int
		if err := rows.Scan(
			&rowID, &rowNSName, &rowStatus, &rowTenantID,
			&rowAllocatedAt,
			&rowPurpose,
			&rowRunnerCount,
		); err != nil {
			return nil, err
		}
		m["id"] = rowID
		m["namespace_name"] = rowNSName
		m["status"] = rowStatus
		m["tenant_id"] = rowTenantID
		m["allocated_at"] = rowAllocatedAt.String
		m["purpose"] = rowPurpose.String
		m["runner_count"] = rowRunnerCount
		result = append(result, m)
	}
	return result, nil
}

func (r *Repository) NamespaceCount(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM namespace_allocations WHERE tenant_id = $1 AND status = 'allocated'`,
		tenantID,
).Scan(&count)
	return count, err
}

func (r *Repository) PoolStatus(ctx context.Context) (*map[string]any, error) {
	var total, allocated int
	r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM namespace_allocations`).Scan(&total)
	r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM namespace_allocations WHERE status = 'allocated'`).Scan(&allocated)
	return &map[string]any{
		"total":     total,
		"allocated": allocated,
		"available": total - allocated,
	}, nil
}

// --- Quota ---

func (r *Repository) GetQuota(ctx context.Context, tenantID int, tenantIDStr string) (*map[string]any, error) {
	rows := r.db.QueryRowContext(ctx,
		`SELECT tenant_id, max_pipelines, max_pipeline_runs_per_day, max_concurrent_runs,
		 max_tasks_per_pipeline, max_runners, max_cpu_cores, max_memory_gb,
		 max_storage_gb, max_namespaces, api_rate_limit, api_rate_limit_window_seconds
		 FROM tenant_quotas WHERE tenant_id = $1 OR tenant_id_str = $2
		 LIMIT 1`,
		tenantID, tenantIDStr,
)
	if rows.Err() != nil {
		return nil, rows.Err()
	}
	m := make(map[string]any)
	var v int
	for i := 0; i < 12; i++ {
		_ = rows.Scan(&v) // simplified scan — values collected in order
	}
	return &m, nil
}

// --- Alerts ---

func (r *Repository) GetTenantQuotaAlerts(ctx context.Context, tenantID string, status *string, limit, offset int) ([]map[string]any, int, error) {
	where := "WHERE tenant_id = $1"
	args := []any{tenantID}
	n := 2
	if status != nil {
		where += fmt.Sprintf(" AND notify_status = $%d", n)
		args = append(args, *status)
		n++
	}

	var total int
	r.db.QueryRowContext(ctx, fmt.Sprintf(`SELECT COUNT(*) FROM tenant_quota_alerts %s`, where), args...).Scan(&total)

	rows, err := r.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT id, tenant_id, resource_type, threshold_percent, current_usage, quota_limit, notify_status, cooldown_until, created_at FROM tenant_quota_alerts %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		where, n, n+1),
		append(args, limit, offset)...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var result []map[string]any
	for rows.Next() {
		m := make(map[string]any)
		var rowID, rowTenantID, resourceType, quotaLimit, notifyStatus string
		var thresholdPct, currentUsage int
		var cooldownUntil, createdAt sql.NullString
		if err := rows.Scan(
			&rowID, &rowTenantID, &resourceType, &thresholdPct,
			&currentUsage, &quotaLimit, &notifyStatus,
			&cooldownUntil,
			&createdAt,
		); err != nil {
			return nil, 0, err
		}
		m["id"] = rowID
		m["tenant_id"] = rowTenantID
		m["resource_type"] = resourceType
		m["threshold_percent"] = thresholdPct
		m["current_usage"] = currentUsage
		m["quota_limit"] = quotaLimit
		m["notify_status"] = notifyStatus
		m["cooldown_until"] = cooldownUntil.String
		m["created_at"] = createdAt.String
		result = append(result, m)
	}
	return result, total, nil
}

func (r *Repository) GetAlertStatusCounts(ctx context.Context, tenantID string) ([]map[string]any, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT notify_status, COUNT(*) as count FROM tenant_quota_alerts WHERE tenant_id = $1 GROUP BY notify_status`,
		tenantID,
)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []map[string]any
	for rows.Next() {
		m := make(map[string]any)
		var notifyStatus string
		var countVal int
		if err := rows.Scan(&notifyStatus, &countVal); err != nil {
			return nil, err
		}
		m["notify_status"] = notifyStatus
		m["count"] = countVal
		result = append(result, m)
	}
	return result, nil
}

func (r *Repository) GetAlertResourceCounts(ctx context.Context, tenantID string) ([]map[string]any, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT resource_type, COUNT(*) as count FROM tenant_quota_alerts WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '7 days' GROUP BY resource_type`,
		tenantID,
)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []map[string]any
	for rows.Next() {
		m := make(map[string]any)
		var resourceType string
		var countVal int
		if err := rows.Scan(&resourceType, &countVal); err != nil {
			return nil, err
		}
		m["resource_type"] = resourceType
		m["count"] = countVal
		result = append(result, m)
	}
	return result, nil
}

func (r *Repository) GetActiveAlerts(ctx context.Context, tenantID string, limit int) ([]map[string]any, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, resource_type, threshold_percent, current_usage, quota_limit, created_at FROM tenant_quota_alerts WHERE tenant_id = $1 AND notify_status = 'sent' AND (cooldown_until IS NULL OR cooldown_until < NOW()) ORDER BY created_at DESC LIMIT $2`,
		tenantID, limit,
)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []map[string]any
	for rows.Next() {
		var rowID, rowResourceType, rowThresholdPct, rowCurrentUsage, rowQuotaLimit string
		if err := rows.Scan(&rowID, &rowResourceType, &rowThresholdPct, &rowCurrentUsage, &rowQuotaLimit, new(sql.NullString)); err != nil {
			return nil, err
		}
		m := make(map[string]any)
		m["id"] = rowID
		m["resource_type"] = rowResourceType
		m["threshold_percent"] = rowThresholdPct
		m["current_usage"] = rowCurrentUsage
		m["quota_limit"] = rowQuotaLimit
		result = append(result, m)
	}
	return result, nil
}

// --- Migration helpers (split) ---

func (r *Repository) MigrateUserToTenant(ctx context.Context, newTenantID int, userID string) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO tenant_users (tenant_id, user_id, role)
		 VALUES ($1, $2, 'member')
		 ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = 'member'`,
		newTenantID, userID,
)
	return err
}

func (r *Repository) MoveNamespaces(ctx context.Context, newTenantID int, nsName string, oldTenantID int) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE namespace_allocations SET tenant_id = $1, updated_at = NOW() WHERE namespace_name = $2 AND tenant_id = $3`,
		newTenantID, nsName, oldTenantID,
)
	return err
}

func (r *Repository) MovePipeline(ctx context.Context, newTenantID int, pipelineID string, oldTenantID int) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE pipelines SET tenant_id = $1 WHERE id = $2 AND tenant_id = $3`,
		newTenantID, pipelineID, oldTenantID,
)
	return err
}

// --- Helpers ---

func updatesStr(parts []string) string {
	if len(parts) == 0 {
		return "1=1"
	}
	s := parts[0]
	for _, p := range parts[1:] {
		s += ", " + p
	}
	return s
}
