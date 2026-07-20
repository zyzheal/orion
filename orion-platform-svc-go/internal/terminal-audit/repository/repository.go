package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/terminal-audit/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/sentinel"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, m *models.TerminalAuditLog) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO terminal_audit_log (id, tenant_id, user_id, command, output, status, host, ip, duration_ms, created_at)
		VALUES (:id, :tenant_id, :user_id, :command, :output, :status, :host, :ip, :duration_ms, :created_at)`, m)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.TerminalAuditLog, error) {
	var m models.TerminalAuditLog
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM terminal_audit_log WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, q models.AuditQuery) ([]models.TerminalAuditLog, error) {
	if q.Limit <= 0 {
		q.Limit = 50
	}
	var sql string
	var args []interface{}
	idx := 1
	sql = fmt.Sprintf(`SELECT * FROM terminal_audit_log WHERE tenant_id=$%d`, idx)
	args = append(args, tenantID)
	idx++
	if q.UserID != "" {
		sql += fmt.Sprintf(" AND user_id=$%d", idx)
		args = append(args, q.UserID)
		idx++
	}
	if q.Status != "" {
		sql += fmt.Sprintf(" AND status=$%d", idx)
		args = append(args, q.Status)
		idx++
	}
	if q.From != "" {
		sql += fmt.Sprintf(" AND created_at >= $%d", idx)
		args = append(args, q.From)
		idx++
	}
	if q.To != "" {
		sql += fmt.Sprintf(" AND created_at <= $%d", idx)
		args = append(args, q.To)
		idx++
	}
	sql += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", idx, idx+1)
	args = append(args, q.Limit, q.Offset)
	var items []models.TerminalAuditLog
	err := r.db.SelectContext(ctx, &items, sql, args...)
	return items, err
}

func (r *Repository) Count(ctx context.Context, tenantID string, q models.AuditQuery) (int, error) {
	var sql string
	var args []interface{}
	idx := 1
	sql = fmt.Sprintf(`SELECT COUNT(*) FROM terminal_audit_log WHERE tenant_id=$%d`, idx)
	args = append(args, tenantID)
	idx++
	if q.UserID != "" {
		sql += fmt.Sprintf(" AND user_id=$%d", idx)
		args = append(args, q.UserID)
		idx++
	}
	if q.Status != "" {
		sql += fmt.Sprintf(" AND status=$%d", idx)
		args = append(args, q.Status)
		idx++
	}
	var count int
	err := r.db.GetContext(ctx, &count, sql, args...)
	return count, err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM terminal_audit_log WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) DeleteBatch(ctx context.Context, tenantID string, ids []string) (int, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	predicate := make([]string, len(ids))
	args := make([]interface{}, len(ids))
	for i, id := range ids {
		predicate[i] = fmt.Sprintf("$%d", i+1)
		args[i] = id
	}
	sql := fmt.Sprintf(`DELETE FROM terminal_audit_log WHERE tenant_id=$%d AND id IN (%s)`,
		len(ids)+1, joinStrings(predicate, ","))
	args = append(args, tenantID)
	result, err := r.db.ExecContext(ctx, sql, args...)
	if err != nil {
		return 0, err
	}
	ra, _ := result.RowsAffected()
	return int(ra), nil
}

func (r *Repository) GetStats(ctx context.Context, tenantID string) (*models.AuditStats, error) {
	stats := &models.AuditStats{
		ByStatus: make(map[string]int),
		ByUser:   make(map[string]int),
	}
	err := r.db.GetContext(ctx, stats,
		`SELECT COUNT(*) FROM terminal_audit_log WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	rows, err := r.db.QueryContext(ctx,
		`SELECT status, COUNT(*) FROM terminal_audit_log WHERE tenant_id=$1 GROUP BY status`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var s string
		var c int
		if err := rows.Scan(&s, &c); err != nil {
			continue
		}
		stats.ByStatus[s] = c
	}
	return stats, nil
}

func joinStrings(parts []string, sep string) string {
	if len(parts) == 0 {
		return ""
	}
	result := parts[0]
	for _, p := range parts[1:] {
		result += sep + p
	}
	return result
}
