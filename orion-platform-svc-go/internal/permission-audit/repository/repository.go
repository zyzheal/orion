package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/permission-audit/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("audit log not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, log *models.PermissionAuditLog) error {
	log.ID = uuid.New().String()
	log.CreatedAt = time.Now().UTC()
	if log.Result == "" {
		log.Result = "allowed"
	}

	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO permission_audit_logs (id, tenant_id, user_id, action, resource, permission, result, ip_address, user_agent, context, created_at)
		VALUES (:id, :tenantId, :userId, :action, :resource, :permission, :result, :ipAddress, :userAgent, :context, :createdAt)
	`, log)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.PermissionAuditLog, error) {
	var log models.PermissionAuditLog
	err := r.db.GetContext(ctx, &log, `SELECT * FROM permission_audit_logs WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, ErrNotFound
	}
	return &log, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, filter *models.AuditLogFilter) ([]models.PermissionAuditLog, int, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.UserID != nil {
			where += fmt.Sprintf(" AND user_id = $%d", argIdx)
			args = append(args, *filter.UserID)
			argIdx++
		}
		if filter.Action != nil {
			where += fmt.Sprintf(" AND action = $%d", argIdx)
			args = append(args, *filter.Action)
			argIdx++
		}
		if filter.Resource != nil {
			where += fmt.Sprintf(" AND resource = $%d", argIdx)
			args = append(args, *filter.Resource)
			argIdx++
		}
		if filter.Result != nil {
			where += fmt.Sprintf(" AND result = $%d", argIdx)
			args = append(args, *filter.Result)
			argIdx++
		}
		if filter.Limit > 0 {
			where += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
			args = append(args, filter.Limit, filter.Offset)
		}
	}

	var logs []models.PermissionAuditLog
	err := r.db.SelectContext(ctx, &logs, fmt.Sprintf(`SELECT * FROM permission_audit_logs %s ORDER BY created_at DESC`, where), args...)
	if err != nil {
		return nil, 0, err
	}

	var total int
	err = r.db.GetContext(ctx, &total, `SELECT COUNT(*) FROM permission_audit_logs WHERE tenant_id = $1`, tenantID)
	return logs, total, err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx, `DELETE FROM permission_audit_logs WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}
