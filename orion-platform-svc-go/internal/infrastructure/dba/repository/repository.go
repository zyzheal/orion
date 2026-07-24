package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/infrastructure/dba/models"

	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ─── SQL Orders ────────────────────────────────────────────────────────────────

func (r *Repository) CreateOrder(ctx context.Context, o *models.SQLOrder) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO dba_orders (id, tenant_id, title, description, database, sql_content, status, created_by, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		o.ID, o.TenantID, o.Title, o.Description, o.Database, o.SQLContent,
		o.Status, o.CreatedBy, o.CreatedAt, o.UpdatedAt)
	return err
}

func (r *Repository) GetOrderByID(ctx context.Context, id string) (*models.SQLOrder, error) {
	var o models.SQLOrder
	err := r.db.GetContext(ctx, &o,
		`SELECT * FROM dba_orders WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &o, nil
}

func (r *Repository) ListOrders(ctx context.Context, tenantID, status string, offset, limit int) ([]models.SQLOrder, error) {
	var items []models.SQLOrder
	var err error
	if status != "" {
		err = r.db.SelectContext(ctx, &items,
			`SELECT * FROM dba_orders WHERE tenant_id=$1 AND status=$2 ORDER BY created_at DESC OFFSET $3 LIMIT $4`,
			tenantID, status, offset, limit)
	} else {
		err = r.db.SelectContext(ctx, &items,
			`SELECT * FROM dba_orders WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
			tenantID, offset, limit)
	}
	return items, err
}

func (r *Repository) UpdateOrderStatus(ctx context.Context, id, status, userID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE dba_orders SET status=$1, updated_at=$2 WHERE id=$3`,
		status, time.Now(), id)
	return err
}

func (r *Repository) ApproveOrder(ctx context.Context, id, approvedBy string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE dba_orders SET status='approved', approved_by=$1, updated_at=$2 WHERE id=$3`,
		approvedBy, time.Now(), id)
	return err
}

func (r *Repository) RejectOrder(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE dba_orders SET status='rejected', updated_at=$1 WHERE id=$2`,
		time.Now(), id)
	return err
}

func (r *Repository) ExecuteOrder(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE dba_orders SET status='executed', updated_at=$1 WHERE id=$2`,
		time.Now(), id)
	return err
}

// ─── Data Sources ──────────────────────────────────────────────────────────────

func (r *Repository) CreateDataSource(ctx context.Context, ds *models.DataSource) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO dba_data_sources (id, tenant_id, name, db_type, host, port, database, username, password_ref, ssl_mode, status, created_by, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
		ds.ID, ds.TenantID, ds.Name, ds.DBType, ds.Host, ds.Port, ds.Database,
		ds.Username, ds.PasswordRef, ds.SSLMode, ds.Status, ds.CreatedBy,
		ds.CreatedAt, ds.UpdatedAt)
	return err
}

func (r *Repository) GetDataSourceByID(ctx context.Context, id string) (*models.DataSource, error) {
	var ds models.DataSource
	err := r.db.GetContext(ctx, &ds,
		`SELECT * FROM dba_data_sources WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &ds, nil
}

func (r *Repository) ListDataSources(ctx context.Context, tenantID string) ([]models.DataSource, error) {
	var items []models.DataSource
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM dba_data_sources WHERE tenant_id=$1 ORDER BY created_at DESC`,
		tenantID)
	return items, err
}

func (r *Repository) UpdateDataSource(ctx context.Context, id string, req map[string]interface{}) (*models.DataSource, error) {
	setClauses := []string{}
	args := []interface{}{}
	idx := 1

	for k, v := range req {
		setClauses = append(setClauses, fmt.Sprintf("%s=$%d", k, idx))
		args = append(args, v)
		idx++
	}
	if len(setClauses) == 0 {
		return r.GetDataSourceByID(ctx, id)
	}
	setClauses = append(setClauses, fmt.Sprintf("updated_at=$%d", idx))
	args = append(args, time.Now())
	idx++

	query := fmt.Sprintf("UPDATE dba_data_sources SET %s WHERE id=$%d RETURNING *",
		strings.Join(setClauses, ", "), idx)
	args = append(args, id)

	var ds models.DataSource
	err := r.db.GetContext(ctx, &ds, query, args...)
	if err != nil {
		return nil, err
	}
	return &ds, nil
}

func (r *Repository) DeleteDataSource(ctx context.Context, id string) (bool, error) {
	res, err := r.db.ExecContext(ctx, `DELETE FROM dba_data_sources WHERE id=$1`, id)
	if err != nil {
		return false, err
	}
	rows, _ := res.RowsAffected()
	return rows > 0, nil
}

// ─── Audit Rules ───────────────────────────────────────────────────────────────

func (r *Repository) CreateAuditRule(ctx context.Context, rule *models.AuditRule) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO dba_audit_rules (id, tenant_id, name, description, category, pattern, severity, enabled, created_by, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		rule.ID, rule.TenantID, rule.Name, rule.Description, rule.Category,
		rule.Pattern, rule.Severity, rule.Enabled, rule.CreatedBy,
		rule.CreatedAt, rule.UpdatedAt)
	return err
}

func (r *Repository) ListAuditRules(ctx context.Context, tenantID string) ([]models.AuditRule, error) {
	var items []models.AuditRule
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM dba_audit_rules WHERE tenant_id=$1 ORDER BY created_at DESC`,
		tenantID)
	return items, err
}

func (r *Repository) UpdateAuditRule(ctx context.Context, id string, req map[string]interface{}) (*models.AuditRule, error) {
	setClauses := []string{}
	args := []interface{}{}
	idx := 1

	for k, v := range req {
		setClauses = append(setClauses, fmt.Sprintf("%s=$%d", k, idx))
		args = append(args, v)
		idx++
	}
	if len(setClauses) == 0 {
		return nil, nil
	}
	setClauses = append(setClauses, fmt.Sprintf("updated_at=$%d", idx))
	args = append(args, time.Now())
	idx++

	query := fmt.Sprintf("UPDATE dba_audit_rules SET %s WHERE id=$%d RETURNING *",
		strings.Join(setClauses, ", "), idx)
	args = append(args, id)

	var rule models.AuditRule
	err := r.db.GetContext(ctx, &rule, query, args...)
	if err != nil {
		return nil, err
	}
	return &rule, nil
}

// ─── Query Logs ────────────────────────────────────────────────────────────────

func (r *Repository) CreateQueryLog(ctx context.Context, log *models.QueryLog) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO dba_query_logs (id, tenant_id, data_source_id, sql_content, status, duration, row_count, error_message, created_by, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		log.ID, log.TenantID, log.DataSourceID, log.SQLContent, log.Status,
		log.Duration, log.RowCount, log.ErrorMessage, log.CreatedBy, log.CreatedAt)
	return err
}

func (r *Repository) ListQueryLogs(ctx context.Context, tenantID string, dataSourceID, status string, offset, limit int) ([]models.QueryLog, error) {
	var items []models.QueryLog
	where := []string{"tenant_id=$1"}
	args := []interface{}{tenantID}
	idx := 2

	if dataSourceID != "" {
		where = append(where, fmt.Sprintf("data_source_id=$%d", idx))
		args = append(args, dataSourceID)
		idx++
	}
	if status != "" {
		where = append(where, fmt.Sprintf("status=$%d", idx))
		args = append(args, status)
		idx++
	}

	query := fmt.Sprintf("SELECT * FROM dba_query_logs WHERE %s ORDER BY created_at DESC OFFSET $%d LIMIT $%d",
		strings.Join(where, " AND "), idx, idx+1)
	args = append(args, offset, limit)

	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}