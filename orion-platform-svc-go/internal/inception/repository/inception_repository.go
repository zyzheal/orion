package repository

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/inception/models"

	"github.com/jmoiron/sqlx"
)

// Repository provides data access for all inception entities.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ---------------------------------------------------------------------------
// SQL Audit History
// ---------------------------------------------------------------------------

// CreateAudit inserts a new SQL audit history record.
func (r *Repository) CreateAudit(ctx context.Context, a *models.SQLAuditHistory) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO sql_audit_history
			(id, tenant_id, db_name, sql_statement, operation_type, dry_run, status,
			 errors, warnings, affected_rows, exec_time_ms, audited_by, request_id)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
		a.ID, a.TenantID, a.DBName, a.SQLStatement, a.OperationType,
		a.DryRun, a.Status, a.Errors, a.Warnings,
		a.AffectedRows, a.ExecTimeMs, a.AuditedBy, a.RequestID,
	)
	return err
}

// ListAudits returns paginated audit history for a tenant.
func (r *Repository) ListAudits(ctx context.Context, tenantID string, offset, limit int) ([]models.SQLAuditHistory, error) {
	var items []models.SQLAuditHistory
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, db_name, sql_statement, operation_type, dry_run,
		        status, errors, warnings, affected_rows, exec_time_ms,
		        audited_by, request_id, created_at
		 FROM sql_audit_history
		 WHERE tenant_id = $1
		 ORDER BY created_at DESC
		 OFFSET $2 LIMIT $3`,
		tenantID, offset, limit,
	)
	return items, err
}

// ListAuditsByStatus returns paginated audit history filtered by status.
func (r *Repository) ListAuditsByStatus(ctx context.Context, tenantID, status string, offset, limit int) ([]models.SQLAuditHistory, error) {
	var items []models.SQLAuditHistory
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, db_name, sql_statement, operation_type, dry_run,
		        status, errors, warnings, affected_rows, exec_time_ms,
		        audited_by, request_id, created_at
		 FROM sql_audit_history
		 WHERE tenant_id = $1 AND status = $2
		 ORDER BY created_at DESC
		 OFFSET $3 LIMIT $4`,
		tenantID, status, offset, limit,
	)
	return items, err
}

// GetAuditByID returns a single audit record by id and tenant.
func (r *Repository) GetAuditByID(ctx context.Context, tenantID, id string) (*models.SQLAuditHistory, error) {
	var a models.SQLAuditHistory
	err := r.db.GetContext(ctx, &a,
		`SELECT id, tenant_id, db_name, sql_statement, operation_type, dry_run,
		        status, errors, warnings, affected_rows, exec_time_ms,
		        audited_by, request_id, created_at
		 FROM sql_audit_history
		 WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// CountAudits returns total audit count for a tenant.
func (r *Repository) CountAudits(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM sql_audit_history WHERE tenant_id = $1`,
		tenantID,
	)
	return count, err
}

// UpdateAuditStatus updates the status, errors, warnings, affected_rows and exec_time_ms of an audit record.
func (r *Repository) UpdateAuditStatus(ctx context.Context, tenantID, id, status string, errors, warnings models.JSONArray, affectedRows, execTimeMs *int) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE sql_audit_history
		 SET status = $1, errors = $2, warnings = $3, affected_rows = $4, exec_time_ms = $5
		 WHERE id = $6 AND tenant_id = $7`,
		status, errors, warnings, affectedRows, execTimeMs, id, tenantID,
	)
	return err
}

// DeleteAudit removes an audit record.
func (r *Repository) DeleteAudit(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM sql_audit_history WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	return err
}

// ---------------------------------------------------------------------------
// SQL Blacklist
// ---------------------------------------------------------------------------

// CreateBlacklist inserts a new blacklist entry.
func (r *Repository) CreateBlacklist(ctx context.Context, b *models.SQLBlacklist) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO sql_blacklist
			(id, tenant_id, pattern, description, severity, enabled, created_by)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		b.ID, b.TenantID, b.Pattern, b.Description, b.Severity, b.Enabled, b.CreatedBy,
	)
	return err
}

// ListBlacklists returns paginated blacklist entries for a tenant.
func (r *Repository) ListBlacklists(ctx context.Context, tenantID string, offset, limit int) ([]models.SQLBlacklist, error) {
	var items []models.SQLBlacklist
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, pattern, description, severity, enabled,
		        created_by, created_at, updated_at
		 FROM sql_blacklist
		 WHERE tenant_id = $1
		 ORDER BY created_at DESC
		 OFFSET $2 LIMIT $3`,
		tenantID, offset, limit,
	)
	return items, err
}

// GetBlacklistByID returns a single blacklist entry by id.
func (r *Repository) GetBlacklistByID(ctx context.Context, id string) (*models.SQLBlacklist, error) {
	var b models.SQLBlacklist
	err := r.db.GetContext(ctx, &b,
		`SELECT id, tenant_id, pattern, description, severity, enabled,
		        created_by, created_at, updated_at
		 FROM sql_blacklist
		 WHERE id = $1`,
		id,
	)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

// UpdateBlacklist updates a blacklist entry's mutable fields.
func (r *Repository) UpdateBlacklist(ctx context.Context, id string, pattern, description, severity *string, enabled *bool) error {
	// Build dynamic SET clause
	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if pattern != nil {
		setClauses = append(setClauses, fmt.Sprintf("pattern = $%d", argIdx))
		args = append(args, *pattern)
		argIdx++
	}
	if description != nil {
		setClauses = append(setClauses, fmt.Sprintf("description = $%d", argIdx))
		args = append(args, *description)
		argIdx++
	}
	if severity != nil {
		setClauses = append(setClauses, fmt.Sprintf("severity = $%d", argIdx))
		args = append(args, *severity)
		argIdx++
	}
	if enabled != nil {
		setClauses = append(setClauses, fmt.Sprintf("enabled = $%d", argIdx))
		args = append(args, *enabled)
		argIdx++
	}

	if len(setClauses) == 0 {
		return nil
	}

	setClauses = append(setClauses, "updated_at = now()")
	query := fmt.Sprintf("UPDATE sql_blacklist SET %s WHERE id = $%d",
		joinStrings(setClauses, ", "), argIdx)
	args = append(args, id)

	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

// DeleteBlacklist removes a blacklist entry.
func (r *Repository) DeleteBlacklist(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM sql_blacklist WHERE id = $1`,
		id,
	)
	return err
}

// IsBlacklisted checks if a SQL statement matches any enabled blacklist pattern for the tenant.
func (r *Repository) IsBlacklisted(ctx context.Context, tenantID, sqlStmt string) (bool, string, error) {
	var match struct {
		Pattern  string `db:"pattern"`
		Severity string `db:"severity"`
	}
	err := r.db.GetContext(ctx, &match,
		`SELECT pattern, severity
		 FROM sql_blacklist
		 WHERE enabled = true
		   AND (tenant_id = $1 OR tenant_id IS NULL)
		   AND $2 ILIKE '%' || pattern || '%'
		 LIMIT 1`,
		tenantID, sqlStmt,
	)
	if err != nil {
		// sql.ErrNoRows means no blacklist match
		return false, "", nil
	}
	return true, fmt.Sprintf("blocked by pattern %q (severity: %s)", match.Pattern, match.Severity), nil
}

// CountBlacklists returns total blacklist count for a tenant.
func (r *Repository) CountBlacklists(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM sql_blacklist WHERE tenant_id = $1`,
		tenantID,
	)
	return count, err
}

// ---------------------------------------------------------------------------
// Inception Config
// ---------------------------------------------------------------------------

// UpsertConfig creates or updates an inception config for a tenant.
func (r *Repository) UpsertConfig(ctx context.Context, c *models.InceptionConfig) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO inception_configs
			(id, tenant_id, host, port, "user", encrypted_password, default_db, timeout_ms, enabled)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		 ON CONFLICT (tenant_id) DO UPDATE SET
			host = EXCLUDED.host,
			port = EXCLUDED.port,
			"user" = EXCLUDED."user",
			encrypted_password = EXCLUDED.encrypted_password,
			default_db = EXCLUDED.default_db,
			timeout_ms = EXCLUDED.timeout_ms,
			enabled = EXCLUDED.enabled,
			updated_at = now()`,
		c.ID, c.TenantID, c.Host, c.Port, c.User,
		c.EncryptedPassword, c.DefaultDB, c.TimeoutMs, c.Enabled,
	)
	return err
}

// GetConfigByTenant returns the inception config for a tenant.
func (r *Repository) GetConfigByTenant(ctx context.Context, tenantID string) (*models.InceptionConfig, error) {
	var c models.InceptionConfig
	err := r.db.GetContext(ctx, &c,
		`SELECT id, tenant_id, host, port, "user", encrypted_password,
		        default_db, timeout_ms, enabled, created_at, updated_at
		 FROM inception_configs
		 WHERE tenant_id = $1`,
		tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// ListConfigs returns paginated inception configs.
func (r *Repository) ListConfigs(ctx context.Context, offset, limit int) ([]models.InceptionConfig, error) {
	var items []models.InceptionConfig
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, host, port, "user", encrypted_password,
		        default_db, timeout_ms, enabled, created_at, updated_at
		 FROM inception_configs
		 ORDER BY created_at DESC
		 OFFSET $1 LIMIT $2`,
		offset, limit,
	)
	return items, err
}

// UpdateConfig updates an inception config's mutable fields.
func (r *Repository) UpdateConfig(ctx context.Context, tenantID string, host, user, password, defaultDB *string, port, timeoutMs *int, enabled *bool) error {
	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if host != nil {
		setClauses = append(setClauses, fmt.Sprintf("host = $%d", argIdx))
		args = append(args, *host)
		argIdx++
	}
	if port != nil {
		setClauses = append(setClauses, fmt.Sprintf("port = $%d", argIdx))
		args = append(args, *port)
		argIdx++
	}
	if user != nil {
		setClauses = append(setClauses, fmt.Sprintf("\"user\" = $%d", argIdx))
		args = append(args, *user)
		argIdx++
	}
	if password != nil {
		setClauses = append(setClauses, fmt.Sprintf("encrypted_password = $%d", argIdx))
		args = append(args, *password)
		argIdx++
	}
	if defaultDB != nil {
		setClauses = append(setClauses, fmt.Sprintf("default_db = $%d", argIdx))
		args = append(args, *defaultDB)
		argIdx++
	}
	if timeoutMs != nil {
		setClauses = append(setClauses, fmt.Sprintf("timeout_ms = $%d", argIdx))
		args = append(args, *timeoutMs)
		argIdx++
	}
	if enabled != nil {
		setClauses = append(setClauses, fmt.Sprintf("enabled = $%d", argIdx))
		args = append(args, *enabled)
		argIdx++
	}

	if len(setClauses) == 0 {
		return nil
	}

	setClauses = append(setClauses, "updated_at = now()")
	query := fmt.Sprintf("UPDATE inception_configs SET %s WHERE tenant_id = $%d",
		joinStrings(setClauses, ", "), argIdx)
	args = append(args, tenantID)

	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

// DeleteConfig removes an inception config.
func (r *Repository) DeleteConfig(ctx context.Context, tenantID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM inception_configs WHERE tenant_id = $1`,
		tenantID,
	)
	return err
}

// CountConfigs returns total inception config count.
func (r *Repository) CountConfigs(ctx context.Context) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM inception_configs`,
	)
	return count, err
}

// ---------------------------------------------------------------------------
// Audit Reports
// ---------------------------------------------------------------------------

// CreateReport inserts a new audit report record.
func (r *Repository) CreateReport(ctx context.Context, rpt *models.AuditReport) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO audit_reports
			(id, tenant_id, report_name, format, filters, file_path, status, generated_by, expires_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		rpt.ID, rpt.TenantID, rpt.ReportName, rpt.Format,
		rpt.Filters, rpt.FilePath, rpt.Status, rpt.GeneratedBy, rpt.ExpiresAt,
	)
	return err
}

// ListReports returns paginated audit reports for a tenant.
func (r *Repository) ListReports(ctx context.Context, tenantID string, offset, limit int) ([]models.AuditReport, error) {
	var items []models.AuditReport
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, report_name, format, filters, file_path,
		        status, generated_by, created_at, expires_at
		 FROM audit_reports
		 WHERE tenant_id = $1
		 ORDER BY created_at DESC
		 OFFSET $2 LIMIT $3`,
		tenantID, offset, limit,
	)
	return items, err
}

// GetReportByID returns a single report by id and tenant.
func (r *Repository) GetReportByID(ctx context.Context, tenantID, id string) (*models.AuditReport, error) {
	var rpt models.AuditReport
	err := r.db.GetContext(ctx, &rpt,
		`SELECT id, tenant_id, report_name, format, filters, file_path,
		        status, generated_by, created_at, expires_at
		 FROM audit_reports
		 WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &rpt, nil
}

// UpdateReportStatus updates the status and file_path of a report.
func (r *Repository) UpdateReportStatus(ctx context.Context, tenantID, id, status string, filePath *string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE audit_reports
		 SET status = $1, file_path = $2
		 WHERE id = $3 AND tenant_id = $4`,
		status, filePath, id, tenantID,
	)
	return err
}

// DeleteReport removes an audit report.
func (r *Repository) DeleteReport(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM audit_reports WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	return err
}

// CountReports returns total report count for a tenant.
func (r *Repository) CountReports(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM audit_reports WHERE tenant_id = $1`,
		tenantID,
	)
	return count, err
}

// PurgeExpiredReports deletes reports past their expiration date.
func (r *Repository) PurgeExpiredReports(ctx context.Context) (int64, error) {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM audit_reports WHERE expires_at IS NOT NULL AND expires_at < $1`,
		time.Now(),
	)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func joinStrings(strs []string, sep string) string {
	result := ""
	for i, s := range strs {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}
