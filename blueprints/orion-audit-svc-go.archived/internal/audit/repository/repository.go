package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/audit-svc-go/internal/audit/models"
)

// AuditRepository interface
type AuditRepository interface {
	ListLogs(ctx context.Context, page, size int, tenantID, userID, action, resourceType string) ([]models.AuditLog, int64, error)
	CreateLog(ctx context.Context, action, resource, detail, userID, tenantID, ip string) (*models.AuditLog, error)
	GetLog(ctx context.Context, id string) (*models.AuditLog, error)
	SearchLogs(ctx context.Context, query string, tenantID string) ([]models.AuditLog, error)
	ListComplianceChecks(ctx context.Context, tenantID string) ([]models.ComplianceCheck, error)
	RunComplianceCheck(ctx context.Context, checkType, target, tenantID string) (*models.ComplianceCheck, error)
}

type auditRepositoryImpl struct {
	DB *sql.DB
}

func NewAuditRepository(db *sql.DB) AuditRepository {
	return &auditRepositoryImpl{DB: db}
}

func (r *auditRepositoryImpl) ListLogs(ctx context.Context, page, size int, tenantID, userID, action, resourceType string) ([]models.AuditLog, int64, error) {
	if page < 1 {
		page = 1
	}
	if size <= 0 || size > 100 {
		size = 20
	}
	offset := (page - 1) * size

	where := []string{}
	args := []interface{}{}
	argIdx := 1

	if tenantID != "" {
		where = append(where, fmt.Sprintf("tenant_id = $%d", argIdx))
		args = append(args, tenantID)
		argIdx++
	}
	if userID != "" {
		where = append(where, fmt.Sprintf("user_id = $%d", argIdx))
		args = append(args, userID)
		argIdx++
	}
	if action != "" {
		where = append(where, fmt.Sprintf("action = $%d", argIdx))
	args = append(args, action)
		argIdx++
	}
	if resourceType != "" {
		where = append(where, fmt.Sprintf("resource = $%d", argIdx))
		args = append(args, resourceType)
		argIdx++
	}

	whereClause := ""
	if len(where) > 0 {
		whereClause = "WHERE " + joinStrings(where, " AND ")
	}

	countArgs := make([]interface{}, len(args))
	copy(countArgs, args)
	var total int64
	err := r.DB.QueryRowContext(ctx,
		fmt.Sprintf(`SELECT COUNT(*) FROM audit_logs %s`, whereClause), countArgs...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count audit logs: %w", err)
	}

	queryArgs := append(args, size, offset)
	query := fmt.Sprintf(`
		SELECT id, action, resource, detail, user_id, tenant_id, ip, created_at
		FROM audit_logs %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d`,
		whereClause, argIdx, argIdx+1)

	rows, err := r.DB.QueryContext(ctx, query, queryArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("query audit logs: %w", err)
	}
	defer rows.Close()

	var logs []models.AuditLog
	for rows.Next() {
		var l models.AuditLog
		if err := rows.Scan(&l.ID, &l.Action, &l.Resource, &l.Detail, &l.UserID, &l.TenantID, &l.IP, &l.CreatedAt); err != nil {
			return nil, 0, fmt.Errorf("scan audit log: %w", err)
		}
		logs = append(logs, l)
	}
	return logs, total, nil
}

func (r *auditRepositoryImpl) CreateLog(ctx context.Context, action, resource, detail, userID, tenantID, ip string) (*models.AuditLog, error) {
	now := time.Now()
	var id int64
	err := r.DB.QueryRowContext(ctx, `
		INSERT INTO audit_logs (action, resource, detail, user_id, tenant_id, ip, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id`, action, resource, detail, userID, tenantID, ip, now).Scan(&id)
	if err != nil {
		return nil, fmt.Errorf("create audit log: %w", err)
	}
	return &models.AuditLog{
		ID:        id,
		Action:    action,
		Resource:  resource,
		Detail:    detail,
		UserID:    userID,
		TenantID:  tenantID,
		IP:        ip,
		CreatedAt: now,
	}, nil
}

func (r *auditRepositoryImpl) GetLog(ctx context.Context, id string) (*models.AuditLog, error) {
	var l models.AuditLog
	err := r.DB.QueryRowContext(ctx, `
		SELECT id, action, resource, detail, user_id, tenant_id, ip, created_at
		FROM audit_logs WHERE id = $1`, id).Scan(
		&l.ID, &l.Action, &l.Resource, &l.Detail, &l.UserID, &l.TenantID, &l.IP, &l.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("audit log not found: %s", id)
		}
		return nil, fmt.Errorf("get audit log: %w", err)
	}
	return &l, nil
}

func (r *auditRepositoryImpl) SearchLogs(ctx context.Context, query string, tenantID string) ([]models.AuditLog, error) {
	where := []string{}
	args := []interface{}{}
	argIdx := 1

	if tenantID != "" {
		where = append(where, fmt.Sprintf("tenant_id = $%d", argIdx))
		args = append(args, tenantID)
		argIdx++
	}
	where = append(where, fmt.Sprintf("(action ILIKE $%d OR resource ILIKE $%d OR detail ILIKE $%d)", argIdx, argIdx, argIdx))
	args = append(args, "%"+query+"%")

	whereClause := "WHERE " + joinStrings(where, " AND ")

	rows, err := r.DB.QueryContext(ctx, fmt.Sprintf(`
		SELECT id, action, resource, detail, user_id, tenant_id, ip, created_at
		FROM audit_logs %s
		ORDER BY created_at DESC
		LIMIT 50`, whereClause), args...)
	if err != nil {
		return nil, fmt.Errorf("search audit logs: %w", err)
	}
	defer rows.Close()

	var logs []models.AuditLog
	for rows.Next() {
		var l models.AuditLog
		if err := rows.Scan(&l.ID, &l.Action, &l.Resource, &l.Detail, &l.UserID, &l.TenantID, &l.IP, &l.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan audit log: %w", err)
		}
		logs = append(logs, l)
	}
	return logs, nil
}

func (r *auditRepositoryImpl) ListComplianceChecks(ctx context.Context, tenantID string) ([]models.ComplianceCheck, error) {
	where := ""
	args := []interface{}{}
	if tenantID != "" {
		where = "WHERE tenant_id = $1"
		args = append(args, tenantID)
	}
	rows, err := r.DB.QueryContext(ctx,
		fmt.Sprintf(`SELECT id, type, target, status, result, tenant_id, created_at
		FROM compliance_checks %s ORDER BY created_at DESC`, where), args...)
	if err != nil {
		return nil, fmt.Errorf("list compliance checks: %w", err)
	}
	defer rows.Close()

	var checks []models.ComplianceCheck
	for rows.Next() {
		var c models.ComplianceCheck
		if err := rows.Scan(&c.ID, &c.Type, &c.Target, &c.Status, &c.Result, &c.TenantID, &c.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan compliance check: %w", err)
		}
		checks = append(checks, c)
	}
	return checks, nil
}

func (r *auditRepositoryImpl) RunComplianceCheck(ctx context.Context, checkType, target, tenantID string) (*models.ComplianceCheck, error) {
	now := time.Now()
	var id int64
	err := r.DB.QueryRowContext(ctx, `
		INSERT INTO compliance_checks (type, target, status, result, tenant_id, created_at)
		VALUES ($1, $2, 'running', 'Initializing...', $3, $4)
		RETURNING id`, checkType, target, tenantID, now).Scan(&id)
	if err != nil {
		return nil, fmt.Errorf("run compliance check: %w", err)
	}
	return &models.ComplianceCheck{
		ID:        id,
		Type:      checkType,
		Target:    target,
		Status:    "running",
		Result:    "Initializing...",
		TenantID:  tenantID,
		CreatedAt: now,
	}, nil
}

func joinStrings(items []string, sep string) string {
	result := ""
	for i, item := range items {
		if i > 0 {
			result += sep
		}
		result += item
	}
	return result
}

// Ensure interface compliance
var _ AuditRepository = (*auditRepositoryImpl)(nil)
