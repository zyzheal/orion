package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"orion/audit-svc-go/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// RetentionPolicyRepository provides database access for retention policies.
type RetentionPolicyRepository struct {
	db *sqlx.DB
}

func NewRetentionPolicyRepository(db *sqlx.DB) *RetentionPolicyRepository {
	return &RetentionPolicyRepository{db: db}
}

// UpsertPolicy creates or updates a retention policy for a tenant.
// Returns the full policy record after write.
func (r *RetentionPolicyRepository) UpsertPolicy(ctx context.Context, input *models.CreateRetentionPolicyInput) (*models.RetentionPolicy, error) {
	if input.RetentionDays < 30 {
		return nil, fmt.Errorf("retention days must be at least 30, got %d", input.RetentionDays)
	}
	if !input.ArchiveBeforeDel {
		input.ArchiveBeforeDel = true // default true
	}

	var row struct {
		ID               string    `db:"id"`
		TenantID         string    `db:"tenant_id"`
		RetentionDays    int       `db:"retention_days"`
		ArchiveBeforeDel bool      `db:"archive_before_delete"`
		Enabled          bool      `db:"enabled"`
		CreatedAt        time.Time `db:"created_at"`
		UpdatedAt        time.Time `db:"updated_at"`
	}

	err := r.db.QueryRowxContext(ctx,
		`INSERT INTO audit_retention_policies (id, tenant_id, retention_days, archive_before_delete, enabled, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, now(), now())
		 ON CONFLICT (tenant_id) DO UPDATE SET
		   retention_days = EXCLUDED.retention_days,
		   archive_before_delete = EXCLUDED.archive_before_delete,
		   enabled = EXCLUDED.enabled,
		   updated_at = now()
		 RETURNING *`,
		uuid.New().String(), input.TenantID, input.RetentionDays, input.ArchiveBeforeDel, input.Enabled,
	).Scan(&row.ID, &row.TenantID, &row.RetentionDays, &row.ArchiveBeforeDel, &row.Enabled, &row.CreatedAt, &row.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return &models.RetentionPolicy{
		ID:               row.ID,
		TenantID:         row.TenantID,
		RetentionDays:    row.RetentionDays,
		ArchiveBeforeDel: row.ArchiveBeforeDel,
		Enabled:          row.Enabled,
		CreatedAt:        row.CreatedAt,
		UpdatedAt:        row.UpdatedAt,
	}, nil
}

// GetPolicy returns the retention policy for a tenant, or nil if none exists.
func (r *RetentionPolicyRepository) GetPolicy(ctx context.Context, tenantID string) (*models.RetentionPolicy, error) {
	var row struct {
		ID               string    `db:"id"`
		TenantID         string    `db:"tenant_id"`
		RetentionDays    int       `db:"retention_days"`
		ArchiveBeforeDel bool      `db:"archive_before_delete"`
		Enabled          bool      `db:"enabled"`
		CreatedAt        time.Time `db:"created_at"`
		UpdatedAt        time.Time `db:"updated_at"`
	}

	err := r.db.QueryRowxContext(ctx,
		`SELECT id, tenant_id, retention_days, archive_before_delete, enabled, created_at, updated_at
		 FROM audit_retention_policies WHERE tenant_id = $1`, tenantID,
	).Scan(&row.ID, &row.TenantID, &row.RetentionDays, &row.ArchiveBeforeDel, &row.Enabled, &row.CreatedAt, &row.UpdatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &models.RetentionPolicy{
		ID:               row.ID,
		TenantID:         row.TenantID,
		RetentionDays:    row.RetentionDays,
		ArchiveBeforeDel: row.ArchiveBeforeDel,
		Enabled:          row.Enabled,
		CreatedAt:        row.CreatedAt,
		UpdatedAt:        row.UpdatedAt,
	}, nil
}

// ListPolicies returns all retention policies ordered by tenant_id.
func (r *RetentionPolicyRepository) ListPolicies(ctx context.Context) ([]models.RetentionPolicy, error) {
	rows, err := r.db.QueryxContext(ctx,
		`SELECT id, tenant_id, retention_days, archive_before_delete, enabled, created_at, updated_at
		 FROM audit_retention_policies ORDER BY tenant_id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var policies []models.RetentionPolicy
	for rows.Next() {
		var p models.RetentionPolicy
		if err := rows.StructScan(&p); err != nil {
			return nil, err
		}
		policies = append(policies, p)
	}
	return policies, nil
}

// DeletePolicy removes the retention policy for a tenant. Returns true if a row was deleted.
func (r *RetentionPolicyRepository) DeletePolicy(ctx context.Context, tenantID string) (bool, error) {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM audit_retention_policies WHERE tenant_id = $1`, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

// CountPolicies returns the total number of retention policies.
func (r *RetentionPolicyRepository) CountPolicies(ctx context.Context) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM audit_retention_policies`)
	return count, err
}

// CountEnabledPolicies returns the count of enabled retention policies.
func (r *RetentionPolicyRepository) CountEnabledPolicies(ctx context.Context) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM audit_retention_policies WHERE enabled = true`)
	return count, err
}

// ListEnabledPolicies returns only enabled policies.
func (r *RetentionPolicyRepository) ListEnabledPolicies(ctx context.Context) ([]models.RetentionPolicy, error) {
	rows, err := r.db.QueryxContext(ctx,
		`SELECT id, tenant_id, retention_days, archive_before_delete, enabled, created_at, updated_at
		 FROM audit_retention_policies WHERE enabled = true ORDER BY tenant_id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var policies []models.RetentionPolicy
	for rows.Next() {
		var p models.RetentionPolicy
		if err := rows.StructScan(&p); err != nil {
			return nil, err
		}
		policies = append(policies, p)
	}
	return policies, nil
}

// --- Audit log export helpers (on the main Repository for convenience) ---

// FindAllWithDateFilters retrieves audit logs with full filters including date range.
func (r *Repository) FindAllWithDateFilters(ctx context.Context, f models.ListAuditLogFilters) ([]models.AuditLog, error) {
	query := `SELECT id, tenant_id, user_id, action, resource_type, resource_id,
	                 request_method, request_path, request_body,
	                 response_code, response_body,
	                 ip_address, user_agent, prev_hash, hash, created_at
			  FROM audit_logs`
	args := []interface{}{}
	conds := []string{}

	addCond := func(col, val string) {
		if val != "" {
			args = append(args, val)
			conds = append(conds, fmt.Sprintf("%s = $%d", col, len(args)))
		}
	}

	addCond("tenant_id", f.TenantID)
	addCond("user_id", f.UserID)
	addCond("action", f.Action)
	addCond("resource_type", f.ResourceType)
	addCond("resource_id", f.ResourceID)
	if f.DateFrom != "" {
		args = append(args, f.DateFrom)
		conds = append(conds, fmt.Sprintf("created_at >= $%d", len(args)))
	}
	if f.DateTo != "" {
		args = append(args, f.DateTo)
		conds = append(conds, fmt.Sprintf("created_at <= $%d", len(args)))
	}

	if len(conds) > 0 {
		query += " WHERE " + joinAnd(conds)
	}
	query += " ORDER BY created_at DESC"

	if f.Limit > 0 {
		args = append(args, f.Limit)
		query += fmt.Sprintf(" LIMIT $%d", len(args))
	}

	var items []models.AuditLog
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// ArchiveLogs copies audit logs to the archive table for a set of IDs.
func (r *Repository) ArchiveLogs(ctx context.Context, ids []string) (int, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	placeholders := strings.Repeat("?,", len(ids))
	placeholders = placeholders[:len(placeholders)-1]

	// Build the SQL using pgx-style positional args via sqlx.In
	query := `INSERT INTO audit_logs_archive
	    (id, tenant_id, user_id, action, resource_type, resource_id,
	     request_method, request_path, request_body, response_code,
	     response_body, ip_address, user_agent, prev_hash, hash, created_at)
	    SELECT id, tenant_id, user_id, action, resource_type, resource_id,
	           request_method, request_path, request_body, response_code,
	           response_body, ip_address, user_agent, prev_hash, hash, created_at
	    FROM audit_logs WHERE id = ANY($1::uuid[])`

	res, err := r.db.ExecContext(ctx, query, pqArray(ids))
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	return int(n), nil
}

// DeleteLogsByIDs removes audit logs by their IDs.
func (r *Repository) DeleteLogsByIDs(ctx context.Context, ids []string) (int, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM audit_logs WHERE id = ANY($1::uuid[])`, pqArray(ids))
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	return int(n), nil
}

// FindExpiredLogs returns expired audit log IDs for a tenant before a cutoff date.
func (r *Repository) FindExpiredLogs(ctx context.Context, tenantID string, cutoff time.Time) ([]string, error) {
	rows, err := r.db.QueryxContext(ctx,
		`SELECT id FROM audit_logs WHERE tenant_id = $1 AND created_at < $2 ORDER BY created_at ASC LIMIT 10000`,
		tenantID, cutoff)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, nil
}

// CountByTenant returns log counts per tenant.
func (r *Repository) CountByTenant(ctx context.Context) ([]models.TenantLogStat, error) {
	rows, err := r.db.QueryxContext(ctx,
		`SELECT al.tenant_id, COUNT(*) as cnt, arp.retention_days
		 FROM audit_logs al
		 LEFT JOIN audit_retention_policies arp ON al.tenant_id = arp.tenant_id
		 GROUP BY al.tenant_id, arp.retention_days
		 ORDER BY cnt DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []models.TenantLogStat
	for rows.Next() {
		var s models.TenantLogStat
		if err := rows.StructScan(&s); err != nil {
			return nil, err
		}
		stats = append(stats, s)
	}
	return stats, nil
}

// TotalAuditLogs returns total audit log count.
func (r *Repository) TotalAuditLogs(ctx context.Context) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM audit_logs`)
	return count, err
}

// DateRange returns oldest and newest created_at from audit_logs.
func (r *Repository) DateRange(ctx context.Context) (*time.Time, *time.Time, error) {
	var oldest, newest sql.NullTime
	err := r.db.QueryRowContext(ctx,
		`SELECT MIN(created_at), MAX(created_at) FROM audit_logs`).Scan(&oldest, &newest)
	if err != nil {
		return nil, nil, err
	}
	var o, n *time.Time
	if oldest.Valid {
		o = &oldest.Time
	}
	if newest.Valid {
		n = &newest.Time
	}
	return o, n, nil
}

// TenantTotalLogs returns log count for a specific tenant.
func (r *Repository) TenantTotalLogs(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx,
		`SELECT COUNT(*) FROM audit_logs WHERE tenant_id = $1`, tenantID, &count)
	return count, err
}

// TenantDateRange returns oldest and newest log dates for a tenant.
func (r *Repository) TenantDateRange(ctx context.Context, tenantID string) (*time.Time, *time.Time, error) {
	var oldest, newest sql.NullTime
	err := r.db.QueryRowContext(ctx,
		`SELECT MIN(created_at), MAX(created_at) FROM audit_logs WHERE tenant_id = $1`, tenantID).Scan(&oldest, &newest)
	if err != nil {
		return nil, nil, err
	}
	var o, n *time.Time
	if oldest.Valid {
		o = &oldest.Time
	}
	if newest.Valid {
		n = &newest.Time
	}
	return o, n, nil
}

// GetActionsCount returns the count of distinct action types for a tenant.
func (r *Repository) DistinctActionsCount(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx,
		`SELECT COUNT(DISTINCT action) FROM audit_logs WHERE tenant_id = $1`, tenantID, &count)
	return count, err
}

// GetResourceTypesCount returns the count of distinct resource types for a tenant.
func (r *Repository) DistinctResourceTypesCount(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx,
		`SELECT COUNT(DISTINCT resource_type) FROM audit_logs WHERE tenant_id = $1`, tenantID, &count)
	return count, err
}

// MissingFieldCounts returns counts of logs missing key fields for a tenant.
func (r *Repository) MissingFieldCounts(ctx context.Context, tenantID string) (map[string]int, error) {
	var result struct {
		MissingUserID    int `db:"missing_user_id"`
		MissingIP        int `db:"missing_ip"`
		MissingUserAgent int `db:"missing_user_agent"`
		MissingResult    int `db:"missing_result"`
	}
	err := r.db.QueryRowxContext(ctx,
		`SELECT
		     COUNT(*) FILTER (WHERE user_id IS NULL OR user_id = '') as missing_user_id,
		     COUNT(*) FILTER (WHERE ip_address IS NULL OR ip_address = '') as missing_ip,
		     COUNT(*) FILTER (WHERE user_agent IS NULL OR user_agent = '') as missing_user_agent,
		     COUNT(*) FILTER (WHERE response_code IS NULL) as missing_result
		  FROM audit_logs WHERE tenant_id = $1`,
		tenantID).StructScan(&result)
	if err != nil {
		return nil, err
	}
	return map[string]int{
		"missing_user_id":    result.MissingUserID,
		"missing_ip":         result.MissingIP,
		"missing_user_agent": result.MissingUserAgent,
		"missing_result":     result.MissingResult,
	}, nil
}

// DistinctActionsForTimeRange returns distinct actions in the last N days for a tenant.
func (r *Repository) DistinctActionsForTimeRange(ctx context.Context, tenantID string, days int) ([]string, error) {
	var actions []string
	err := r.db.SelectContext(ctx, &actions,
		`SELECT DISTINCT action FROM audit_logs
		 WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '%d days' ORDER BY action`,
		days, tenantID)
	return actions, err
}

// pqArray converts a Go string slice to a PostgreSQL UUID array via placeholder expansion.
func pqArray(ids []string) pqArr {
	return pqArr(ids)
}

type pqArr []string

// Value implements driver.Valuer for PostgreSQL array serialization.
func (a pqArr) Value() (interface{}, error) {
	if len(a) == 0 {
		return "[]::uuid[]", nil
	}
	buf := strings.Builder{}
	buf.WriteString("{")
	for i, v := range a {
		if i > 0 {
			buf.WriteString(",")
		}
		buf.WriteString(v)
	}
	buf.WriteString("}")
	return buf.String(), nil
}

// --- CSV export helper on Repository ---

// ToCSV converts a slice of AuditLog to CSV format.
func ToCSV(logs []models.AuditLog) string {
	headers := []string{
		"id", "tenant_id", "user_id", "action", "resource_type", "resource_id",
		"request_method", "request_path", "request_body", "response_code", "response_body",
		"ip_address", "user_agent", "prev_hash", "hash", "created_at",
	}
	var lines []string
	for _, h := range headers {
		lines = append(lines, csvEscape(h))
	}

	for _, log := range logs {
		row := []string{
			log.ID,
			log.TenantID,
			nullVal(log.ActorID),
			log.Action,
			log.ResourceType,
			toString(log.ResourceID),
			toString(log.RequestMethod),
			toString(log.RequestPath),
			jsonVal(log.RequestBody),
			nullValInt(log.ResponseCode),
			jsonVal(log.ResponseBody),
			toString(log.IPAddress),
			toString(log.UserAgent),
			toString(log.PrevHash),
			log.Hash,
			log.CreatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
		}
		var rowLines []string
		for _, v := range row {
			if v == "" || strings.Contains(v, ",") || strings.Contains(v, "\"") || strings.Contains(v, "\n") {
				v = csvEscape(v)
			}
			rowLines = append(rowLines, v)
		}
		lines = append(lines, strings.Join(rowLines, ","))
	}
	return strings.Join(lines, "\n")
}

func csvEscape(s string) string {
	return "\"" + strings.ReplaceAll(s, "\"", "\"\"") + "\""
}

func nullVal(s string) string {
	return s
}

func nullValInt(i sql.NullInt32) string {
	if i.Valid {
		return fmt.Sprintf("%d", i.Int32)
	}
	return ""
}

func toString(ns sql.NullString) string {
	if ns.Valid {
		return ns.String
	}
	return ""
}

func jsonVal(j models.JSONB) string {
	if j == nil {
		return ""
	}
	b, _ := json.Marshal(j)
	return string(b)
}

// UpdatePolicyEnabled updates the enabled field of a retention policy.
func (r *RetentionPolicyRepository) UpdatePolicyEnabled(ctx context.Context, tenantID string, enabled bool) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE audit_retention_policies SET enabled = $1, updated_at = now() WHERE tenant_id = $2`,
		enabled, tenantID)
	return err
}

// UpdatePolicyRetentionDays updates retention days for a policy.
func (r *RetentionPolicyRepository) UpdatePolicyRetentionDays(ctx context.Context, tenantID string, days int) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE audit_retention_policies SET retention_days = $1, updated_at = now() WHERE tenant_id = $2`,
		days, tenantID)
	return err
}
