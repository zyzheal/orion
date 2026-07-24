package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"orion/governance-svc-go/internal/compliance/models"

	"github.com/jmoiron/sqlx"
)

// ==================== ComplianceReportRepository ====================

// ComplianceReportRepository provides data access for compliance reports.
type ComplianceReportRepository struct {
	db *sqlx.DB
}

// NewComplianceReportRepository creates a new ComplianceReportRepository.
func NewComplianceReportRepository(db *sqlx.DB) *ComplianceReportRepository {
	return &ComplianceReportRepository{db: db}
}

// Create inserts a new compliance report.
func (r *ComplianceReportRepository) Create(ctx context.Context, report *models.ComplianceReport) error {
	query := `
		INSERT INTO compliance_reports
			(id, tenant_id, name, description, framework, status, score, findings, schedule_id, triggered_by, started_at, completed_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING created_at, updated_at
	`
	var findingsJSON []byte
	if report.Findings != nil {
		findingsJSON = []byte(report.Findings)
	} else {
		findingsJSON = []byte("[]")
	}

	return r.db.QueryRowContext(ctx, query,
		report.ID,
		report.TenantID,
		report.Name,
		report.Description,
		report.Framework,
		report.Status,
		report.Score,
		string(findingsJSON),
		report.ScheduleID,
		report.TriggeredBy,
		report.StartedAt,
		report.CompletedAt,
	).Scan(&report.CreatedAt, &report.UpdatedAt)
}

// FindByID retrieves a compliance report by its ID.
func (r *ComplianceReportRepository) FindByID(ctx context.Context, id string) (*models.ComplianceReport, error) {
	var report models.ComplianceReport
	query := `SELECT * FROM compliance_reports WHERE id = $1`
	err := r.db.GetContext(ctx, &report, query, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find report: %w", err)
	}
	return &report, nil
}

// FindByTenant retrieves all compliance reports for a given tenant with pagination.
func (r *ComplianceReportRepository) FindByTenant(ctx context.Context, tenantID string, offset, limit int) ([]models.ComplianceReport, error) {
	var reports []models.ComplianceReport
	query := `
		SELECT * FROM compliance_reports
		WHERE tenant_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`
	err := r.db.SelectContext(ctx, &reports, query, tenantID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to find reports by tenant: %w", err)
	}
	return reports, nil
}

// FindByFramework retrieves reports for a tenant filtered by framework.
func (r *ComplianceReportRepository) FindByFramework(ctx context.Context, tenantID, framework string) ([]models.ComplianceReport, error) {
	var reports []models.ComplianceReport
	query := `
		SELECT * FROM compliance_reports
		WHERE tenant_id = $1 AND framework = $2
		ORDER BY created_at DESC
	`
	err := r.db.SelectContext(ctx, &reports, query, tenantID, framework)
	if err != nil {
		return nil, fmt.Errorf("failed to find reports by framework: %w", err)
	}
	return reports, nil
}

// FindByScheduleID retrieves reports associated with a schedule.
func (r *ComplianceReportRepository) FindByScheduleID(ctx context.Context, scheduleID string) ([]models.ComplianceReport, error) {
	var reports []models.ComplianceReport
	query := `
		SELECT * FROM compliance_reports
		WHERE schedule_id = $1
		ORDER BY created_at DESC
	`
	err := r.db.SelectContext(ctx, &reports, query, scheduleID)
	if err != nil {
		return nil, fmt.Errorf("failed to find reports by schedule: %w", err)
	}
	return reports, nil
}

// Update updates specific fields of a compliance report.
func (r *ComplianceReportRepository) Update(ctx context.Context, id string, updates map[string]interface{}) (*models.ComplianceReport, error) {
	if len(updates) == 0 {
		return r.FindByID(ctx, id)
	}

	setClauses := []string{}
	args := []interface{}{}
	paramIdx := 1

	if name, ok := updates["name"].(string); ok {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", paramIdx))
		args = append(args, name)
		paramIdx++
	}
	if desc, ok := updates["description"].(*string); ok {
		setClauses = append(setClauses, fmt.Sprintf("description = $%d", paramIdx))
		if desc != nil {
			args = append(args, *desc)
		} else {
			args = append(args, nil)
		}
		paramIdx++
	}
	if status, ok := updates["status"].(models.ReportStatus); ok {
		setClauses = append(setClauses, fmt.Sprintf("status = $%d", paramIdx))
		args = append(args, status)
		paramIdx++
	}
	if score, ok := updates["score"].(*float64); ok {
		setClauses = append(setClauses, fmt.Sprintf("score = $%d", paramIdx))
		if score != nil {
			args = append(args, *score)
		} else {
			args = append(args, nil)
		}
		paramIdx++
	}
	if findings, ok := updates["findings"].([]byte); ok {
		setClauses = append(setClauses, fmt.Sprintf("findings = $%d::jsonb", paramIdx))
		args = append(args, string(findings))
		paramIdx++
	}
	if startedAt, ok := updates["started_at"].(*time.Time); ok {
		setClauses = append(setClauses, fmt.Sprintf("started_at = $%d", paramIdx))
		if startedAt != nil {
			args = append(args, *startedAt)
		} else {
			args = append(args, nil)
		}
		paramIdx++
	}
	if completedAt, ok := updates["completed_at"].(*time.Time); ok {
		setClauses = append(setClauses, fmt.Sprintf("completed_at = $%d", paramIdx))
		if completedAt != nil {
			args = append(args, *completedAt)
		} else {
			args = append(args, nil)
		}
		paramIdx++
	}

	if len(setClauses) == 0 {
		return r.FindByID(ctx, id)
	}

	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", paramIdx))
	args = append(args, time.Now())
	paramIdx++

	args = append(args, id)
	query := fmt.Sprintf(
		"UPDATE compliance_reports SET %s WHERE id = $%d RETURNING *",
		joinSetClauses(setClauses), paramIdx,
	)

	var report models.ComplianceReport
	err := r.db.GetContext(ctx, &report, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to update report: %w", err)
	}
	return &report, nil
}

// Delete removes a compliance report by ID.
func (r *ComplianceReportRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM compliance_reports WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete report: %w", err)
	}
	return nil
}

// ==================== ComplianceScheduleRepository ====================

// ComplianceScheduleRepository provides data access for compliance schedules.
type ComplianceScheduleRepository struct {
	db *sqlx.DB
}

// NewComplianceScheduleRepository creates a new ComplianceScheduleRepository.
func NewComplianceScheduleRepository(db *sqlx.DB) *ComplianceScheduleRepository {
	return &ComplianceScheduleRepository{db: db}
}

// Create inserts a new compliance schedule.
func (r *ComplianceScheduleRepository) Create(ctx context.Context, schedule *models.ComplianceSchedule) error {
	query := `
		INSERT INTO compliance_schedules
			(id, tenant_id, name, framework, cron_expression, enabled, last_run_at, next_run_at, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING created_at, updated_at
	`
	return r.db.QueryRowContext(ctx, query,
		schedule.ID,
		schedule.TenantID,
		schedule.Name,
		schedule.Framework,
		schedule.CronExpression,
		schedule.Enabled,
		schedule.LastRunAt,
		schedule.NextRunAt,
		schedule.CreatedBy,
	).Scan(&schedule.CreatedAt, &schedule.UpdatedAt)
}

// FindByID retrieves a schedule by its ID.
func (r *ComplianceScheduleRepository) FindByID(ctx context.Context, id string) (*models.ComplianceSchedule, error) {
	var schedule models.ComplianceSchedule
	query := `SELECT * FROM compliance_schedules WHERE id = $1`
	err := r.db.GetContext(ctx, &schedule, query, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find schedule: %w", err)
	}
	return &schedule, nil
}

// FindByTenant retrieves all schedules for a tenant with pagination.
func (r *ComplianceScheduleRepository) FindByTenant(ctx context.Context, tenantID string, offset, limit int) ([]models.ComplianceSchedule, error) {
	var schedules []models.ComplianceSchedule
	query := `
		SELECT * FROM compliance_schedules
		WHERE tenant_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`
	err := r.db.SelectContext(ctx, &schedules, query, tenantID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to find schedules by tenant: %w", err)
	}
	return schedules, nil
}

// FindEnabled retrieves all enabled schedules for a tenant.
func (r *ComplianceScheduleRepository) FindEnabled(ctx context.Context, tenantID string) ([]models.ComplianceSchedule, error) {
	var schedules []models.ComplianceSchedule
	query := `
		SELECT * FROM compliance_schedules
		WHERE tenant_id = $1 AND enabled = true
		ORDER BY name
	`
	err := r.db.SelectContext(ctx, &schedules, query, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to find enabled schedules: %w", err)
	}
	return schedules, nil
}

// Update updates specific fields of a compliance schedule.
func (r *ComplianceScheduleRepository) Update(ctx context.Context, id string, updates map[string]interface{}) (*models.ComplianceSchedule, error) {
	if len(updates) == 0 {
		return r.FindByID(ctx, id)
	}

	setClauses := []string{}
	args := []interface{}{}
	paramIdx := 1

	if name, ok := updates["name"].(string); ok {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", paramIdx))
		args = append(args, name)
		paramIdx++
	}
	if framework, ok := updates["framework"].(string); ok {
		setClauses = append(setClauses, fmt.Sprintf("framework = $%d", paramIdx))
		args = append(args, framework)
		paramIdx++
	}
	if cronExpr, ok := updates["cron_expression"].(string); ok {
		setClauses = append(setClauses, fmt.Sprintf("cron_expression = $%d", paramIdx))
		args = append(args, cronExpr)
		paramIdx++
	}
	if enabled, ok := updates["enabled"].(bool); ok {
		setClauses = append(setClauses, fmt.Sprintf("enabled = $%d", paramIdx))
		args = append(args, enabled)
		paramIdx++
	}

	if len(setClauses) == 0 {
		return r.FindByID(ctx, id)
	}

	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", paramIdx))
	args = append(args, time.Now())
	paramIdx++

	args = append(args, id)
	query := fmt.Sprintf(
		"UPDATE compliance_schedules SET %s WHERE id = $%d RETURNING *",
		joinSetClauses(setClauses), paramIdx,
	)

	var schedule models.ComplianceSchedule
	err := r.db.GetContext(ctx, &schedule, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to update schedule: %w", err)
	}
	return &schedule, nil
}

// Delete removes a compliance schedule by ID.
func (r *ComplianceScheduleRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM compliance_schedules WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete schedule: %w", err)
	}
	return nil
}

// UpdateLastRun updates the last_run_at timestamp for a schedule.
func (r *ComplianceScheduleRepository) UpdateLastRun(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE compliance_schedules SET last_run_at = NOW() WHERE id = $1`,
		id,
	)
	if err != nil {
		return fmt.Errorf("failed to update last run: %w", err)
	}
	return nil
}

// ==================== Helpers ====================

// joinSetClauses joins SQL SET clauses with ", ".
func joinSetClauses(clauses []string) string {
	result := ""
	for i, clause := range clauses {
		if i > 0 {
			result += ", "
		}
		result += clause
	}
	return result
}
