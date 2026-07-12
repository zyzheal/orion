package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/dba/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ErrNotFound is returned when a resource is not found.
var ErrNotFound = errors.New("dba resource not found")

// ---- SQL Orders ----

func (r *Repository) CreateOrder(ctx context.Context, o *models.SqlOrder) error {
	o.ID = uuid.New().String()
	o.Status = "pending"
	o.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO dba_sql_orders (id, tenant_id, user_id, database_name, sql_text, comment, order_type, status, created_at)
		 VALUES (:id, :tenant_id, :user_id, :database_name, :sql_text, :comment, :order_type, :status, :created_at)`,
		o)
	return err
}

func (r *Repository) GetOrder(ctx context.Context, id string) (*models.SqlOrder, error) {
	var o models.SqlOrder
	err := r.db.GetContext(ctx, &o,
		`SELECT * FROM dba_sql_orders WHERE id=$1`, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &o, nil
}

func (r *Repository) ListOrders(ctx context.Context, tenantID, status string, page, limit int) ([]models.SqlOrder, int, error) {
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit

	where := "WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	idx := 2

	if status != "" {
		where += fmt.Sprintf(" AND status=$%d", idx)
		args = append(args, status)
		idx++
	}

	var count int
	err := r.db.GetContext(ctx, &count,
		fmt.Sprintf(`SELECT COUNT(*) FROM dba_sql_orders %s`, where), args...)
	if err != nil {
		return nil, 0, err
	}

	query := fmt.Sprintf(`SELECT * FROM dba_sql_orders %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		where, idx, idx+1)
	args = append(args, limit, offset)

	var orders []models.SqlOrder
	err = r.db.SelectContext(ctx, &orders, query, args...)
	if err != nil {
		return nil, 0, err
	}
	return orders, count, nil
}

func (r *Repository) UpdateOrderStatus(ctx context.Context, id, status string, approvedBy *string, result *string) (*models.SqlOrder, error) {
	now := time.Now().UTC()
	set := fmt.Sprintf("status=$1, updated_at=$2")
	args := []interface{}{status, now}
	idx := 3

	if approvedBy != nil && *approvedBy != "" {
		set += fmt.Sprintf(", approved_by=$%d, approved_at=$%d", idx, idx+1)
		args = append(args, approvedBy, now)
		idx += 2
	}
	if result != nil && *result != "" {
		set += fmt.Sprintf(", result=$%d", idx)
		args = append(args, result)
		idx++
	}

	args = append(args, id)
	query := fmt.Sprintf(`UPDATE dba_sql_orders SET %s WHERE id=$%d RETURNING *`, set, idx)

	var o models.SqlOrder
	err := r.db.GetContext(ctx, &o, query, args...)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &o, nil
}

// ---- Data Sources ----

func (r *Repository) CreateDataSource(ctx context.Context, ds *models.DataSource) error {
	ds.ID = uuid.New().String()
	ds.CreatedAt = time.Now().UTC()
	ds.UpdatedAt = time.Now().UTC()
	ds.Status = "offline"
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO dba_data_sources (id, tenant_id, name, source_type, host, port, database_name, username, status, created_at, updated_at)
		 VALUES (:id, :tenant_id, :name, :source_type, :host, :port, :database_name, :username, :status, :created_at, :updated_at)`,
		ds)
	return err
}

func (r *Repository) GetDataSource(ctx context.Context, id string) (*models.DataSource, error) {
	var ds models.DataSource
	err := r.db.GetContext(ctx, &ds,
		`SELECT * FROM dba_data_sources WHERE id=$1`, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &ds, nil
}

func (r *Repository) ListDataSources(ctx context.Context, tenantID string) ([]models.DataSource, error) {
	var ds []models.DataSource
	err := r.db.SelectContext(ctx, &ds,
		`SELECT * FROM dba_data_sources WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return ds, err
}

func (r *Repository) UpdateDataSource(ctx context.Context, id string, updates map[string]interface{}) (*models.DataSource, error) {
	updates["updated_at"] = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE dba_data_sources SET :updates WHERE id=$1`,
		map[string]interface{}{
			"updates": updates,
			"id":      id,
		})
	if err != nil {
		return nil, err
	}
	return r.GetDataSource(ctx, id)
}

func (r *Repository) DeleteDataSource(ctx context.Context, id string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM dba_data_sources WHERE id=$1`, id)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) UpdateDataSourceStatus(ctx context.Context, id, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE dba_data_sources SET status=$1, last_checked=NOW() WHERE id=$2`, status, id)
	return err
}

// ---- Audit Rules ----

func (r *Repository) CreateAuditRule(ctx context.Context, rule *models.AuditRule) error {
	rule.ID = uuid.New().String()
	rule.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO dba_audit_rules (id, tenant_id, name, pattern, severity, enabled, created_at)
		 VALUES (:id, :tenant_id, :name, :pattern, :severity, :enabled, :created_at)`,
		rule)
	return err
}

func (r *Repository) GetAuditRule(ctx context.Context, id string) (*models.AuditRule, error) {
	var rule models.AuditRule
	err := r.db.GetContext(ctx, &rule,
		`SELECT * FROM dba_audit_rules WHERE id=$1`, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &rule, nil
}

func (r *Repository) ListAuditRules(ctx context.Context, tenantID string) ([]models.AuditRule, error) {
	var rules []models.AuditRule
	err := r.db.SelectContext(ctx, &rules,
		`SELECT * FROM dba_audit_rules WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return rules, err
}

func (r *Repository) UpdateAuditRule(ctx context.Context, id string, updates map[string]interface{}) (*models.AuditRule, error) {
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE dba_audit_rules SET :updates WHERE id=$1`,
		map[string]interface{}{
			"updates": updates,
			"id":      id,
		})
	if err != nil {
		return nil, err
	}
	return r.GetAuditRule(ctx, id)
}

// ---- Query Execution Audit Log ----

func (r *Repository) InsertQueryExecutionLog(ctx context.Context, rec *models.QueryExecutionRecord) error {
	rec.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO dba_query_audit_log (id, tenant_id, user_id, data_source_id, data_source_name, sql_text, status, row_count, latency_ms, error_message, created_at)
		 VALUES (:id, :tenant_id, :user_id, :data_source_id, :data_source_name, :sql_text, :status, :row_count, :latency_ms, :error_message, :created_at)`,
		rec)
	return err
}

func (r *Repository) ListQueryLogs(ctx context.Context, tenantID string, q models.QueryLogQuery) ([]models.QueryExecutionRecord, int, error) {
	if q.Limit <= 0 {
		q.Limit = 20
	}
	if q.Page <= 0 {
		q.Page = 1
	}
	offset := (q.Page - 1) * q.Limit

	where := "WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	idx := 2

	if q.DataSourceID != "" {
		where += fmt.Sprintf(" AND data_source_id=$%d", idx)
		args = append(args, q.DataSourceID)
		idx++
	}
	if q.Status != "" {
		where += fmt.Sprintf(" AND status=$%d", idx)
		args = append(args, q.Status)
		idx++
	}

	var count int
	err := r.db.GetContext(ctx, &count,
		fmt.Sprintf(`SELECT COUNT(*) FROM dba_query_audit_log %s`, where), args...)
	if err != nil {
		return nil, 0, err
	}

	query := fmt.Sprintf(`SELECT * FROM dba_query_audit_log %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		where, idx, idx+1)
	args = append(args, q.Limit, offset)

	var logs []models.QueryExecutionRecord
	err = r.db.SelectContext(ctx, &logs, query, args...)
	return logs, count, err
}
