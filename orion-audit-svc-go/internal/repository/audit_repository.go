package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion-audit-svc-go/internal/models"
)

type AuditRepository struct {
	db *sqlx.DB
}

func NewAuditRepository(db *sqlx.DB) *AuditRepository {
	return &AuditRepository{db: db}
}

// Create inserts a new audit log.
func (r *AuditRepository) Create(ctx context.Context, tenantID string, log *models.AuditLog) error {
	log.ID = uuid.New().String()
	log.TenantID = tenantID
	log.CreatedAt = time.Now().UTC()

	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO audit_logs (id, tenant_id, actor, action, target_type, target_id,
		                        detail, request_id, created_at)
		 VALUES (:id, :tenant_id, :actor, :action, :target_type, :target_id,
		                     :detail, :request_id, :created_at)`,
		log)
	return fmt.Errorf("failed to insert audit log: %w", err)
}

// GetByID returns an audit log by ID.
func (r *AuditRepository) GetByID(ctx context.Context, tenantID, id string) (*models.AuditLog, error) {
	var log models.AuditLog
	err := r.db.GetContext(ctx, &log,
		`SELECT * FROM audit_logs WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("audit log not found: %w", err)
	}
	return &log, nil
}

// ListByTenant returns paginated audit logs filtered by criteria.
func (r *AuditRepository) ListByTenant(ctx context.Context, tenantID string, page, pageSize int, actor, action, targetType, targetID string) ([]models.AuditLog, int, error) {
	var items []models.AuditLog
	var total int

	offset := (page - 1) * pageSize

	// Build WHERE clause
	where := "WHERE tenant_id = $1"
	args := []any{tenantID}
	idx := 2

	if actor != "" {
		where += fmt.Sprintf(" AND actor = $%d", idx)
		args = append(args, actor)
		idx++
	}
	if action != "" {
		where += fmt.Sprintf(" AND action = $%d", idx)
		args = append(args, action)
		idx++
	}
	if targetType != "" {
		where += fmt.Sprintf(" AND target_type = $%d", idx)
		args = append(args, targetType)
		idx++
	}
	if targetID != "" {
		where += fmt.Sprintf(" AND target_id = $%d", idx)
		args = append(args, targetID)
		idx++
	}

	// Count
	countArgs := append([]any{}, args...)
	err := r.db.GetContext(ctx, &total, "SELECT COUNT(*) FROM audit_logs "+where, countArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count audit logs: %w", err)
	}

	// List
	listArgs := append(args, offset, pageSize)
	err = r.db.SelectContext(ctx, &items,
		"SELECT * FROM audit_logs "+where+" ORDER BY created_at DESC LIMIT $"+fmt.Sprint(idx)+" OFFSET $"+fmt.Sprint(idx+1),
		listArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list audit logs: %w", err)
	}

	return items, total, nil
}

// GetByDeployment returns all audit logs for a deployment.
func (r *AuditRepository) GetByDeployment(ctx context.Context, tenantID, deploymentID string) ([]models.AuditLog, error) {
	var items []models.AuditLog
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM audit_logs
		 WHERE tenant_id = $1 AND target_id = $2 AND target_type = 'deployment'
		 ORDER BY created_at DESC`, tenantID, deploymentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get audit logs by deployment: %w", err)
	}
	return items, nil
}

// DeleteBatch deletes audit logs by IDs.
func (r *AuditRepository) DeleteBatch(ctx context.Context, tenantID string, ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	for i := range ids {
		_, err := r.db.ExecContext(ctx, `DELETE FROM audit_logs WHERE id = $1 AND tenant_id = $2`, ids[i], tenantID)
		if err != nil {
			return fmt.Errorf("failed to delete audit log: %w", err)
		}
	}
	return nil
}

// Count returns total audit log count for a tenant.
func (r *AuditRepository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM audit_logs WHERE tenant_id = $1`, tenantID)
	return count, err
}

// CountByAction returns audit log count by action type.
func (r *AuditRepository) CountByAction(ctx context.Context, tenantID string) (map[string]int, error) {
	var rows []struct {
		Action string `db:"action"`
		C      int    `db:"c"`
	}
	err := r.db.SelectContext(ctx, &rows,
		`SELECT action, COUNT(*) as c FROM audit_logs
		 WHERE tenant_id = $1 GROUP BY action`, tenantID)
	if err != nil {
		return nil, err
	}
	result := make(map[string]int)
	for _, row := range rows {
		result[row.Action] = row.C
	}
	return result, nil
}

// ComplianceReport creates a compliance report record.
func (r *AuditRepository) CreateComplianceReport(ctx context.Context, tenantID string, report *models.ComplianceReport) error {
	report.ID = uuid.New().String()
	report.TenantID = tenantID
	report.CreatedAt = time.Now().UTC()

	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO compliance_reports (id, tenant_id, title, status, summary, generated_by, created_at)
		 VALUES (:id, :tenant_id, :title, :status, :summary, :generated_by, :created_at)`,
		report)
	return fmt.Errorf("failed to insert compliance report: %w", err)
}

// GetComplianceReport returns a report by ID.
func (r *AuditRepository) GetComplianceReport(ctx context.Context, tenantID, id string) (*models.ComplianceReport, error) {
	var report models.ComplianceReport
	err := r.db.GetContext(ctx, &report,
		`SELECT * FROM compliance_reports WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("report not found: %w", err)
	}
	return &report, nil
}

// ListComplianceReports returns paginated reports.
func (r *AuditRepository) ListComplianceReports(ctx context.Context, tenantID string, page, pageSize int) ([]models.ComplianceReport, int, error) {
	var items []models.ComplianceReport
	var total int

	offset := (page - 1) * pageSize

	err := r.db.GetContext(ctx, &total, `SELECT COUNT(*) FROM compliance_reports WHERE tenant_id = $1`, tenantID)
	if err != nil {
		return nil, 0, err
	}

	err = r.db.SelectContext(ctx, &items,
		`SELECT * FROM compliance_reports
		 WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}

	return items, total, nil
}
