package repository

import (
	"context"
	"errors"
	"time"

	"orion/platform-svc-go/internal/compliance/models"

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

// --- Compliance Reports ---

func (r *Repository) CreateReport(ctx context.Context, report *models.ComplianceReport) error {
	report.ID = uuid.New().String()
	report.Status = "created"
	report.CreatedAt = time.Now().UTC()
	report.UpdatedAt = time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO compliance_reports (id, tenant_id, name, description, framework, triggered_by, schedule_id, status, created_at, updated_at)
		 VALUES (:id, :tenantId, :name, :description, :framework, :triggeredBy, :scheduleId, :status, :createdAt, :updatedAt)`,
		report)
	return err
}

func (r *Repository) GetReportByID(ctx context.Context, id string, tenantID string) (*models.ComplianceReport, error) {
	var report models.ComplianceReport
	err := r.db.GetContext(ctx, &report,
		`SELECT * FROM compliance_reports WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &report, nil
}

func (r *Repository) ListReports(ctx context.Context, tenantID string, framework *string) ([]models.ComplianceReport, error) {
	query := `SELECT * FROM compliance_reports WHERE tenant_id=$1`
	args := []interface{}{tenantID}
	if framework != nil && *framework != "" {
	query += ` AND framework=$2`
		args = append(args, *framework)
	}
	query += ` ORDER BY created_at DESC`
	var reports []models.ComplianceReport
	err := r.db.SelectContext(ctx, &reports, query, args...)
	return reports, err
}

func (r *Repository) UpdateReport(ctx context.Context, report *models.ComplianceReport, tenantID string) (*models.ComplianceReport, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE compliance_reports SET name=$1, description=$2, framework=$3, triggered_by=$4, status=$5, updated_at=$6
		 WHERE id=$7 AND tenant_id=$8`,
		report.Name, report.Description, report.Framework, report.TriggeredBy, report.Status, time.Now().UTC(), report.ID, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetReportByID(ctx, report.ID, tenantID)
}

func (r *Repository) DeleteReport(ctx context.Context, id string, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM compliance_reports WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// --- Compliance Schedules ---

func (r *Repository) CreateSchedule(ctx context.Context, schedule *models.ComplianceSchedule) error {
	schedule.ID = uuid.New().String()
	schedule.Enabled = true
	schedule.CreatedAt = time.Now().UTC()
	schedule.UpdatedAt = time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO compliance_schedules (id, tenant_id, name, framework, cron_expression, enabled, last_run_at, created_at, updated_at)
		 VALUES (:id, :tenantId, :name, :framework, :cronExpression, :enabled, :lastRunAt, :createdAt, :updatedAt)`,
		schedule)
	return err
}

func (r *Repository) GetScheduleByID(ctx context.Context, id string, tenantID string) (*models.ComplianceSchedule, error) {
	var schedule models.ComplianceSchedule
	err := r.db.GetContext(ctx, &schedule,
		`SELECT * FROM compliance_schedules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &schedule, nil
}

func (r *Repository) ListSchedules(ctx context.Context, tenantID string) ([]models.ComplianceSchedule, error) {
	var schedules []models.ComplianceSchedule
	err := r.db.SelectContext(ctx, &schedules,
		`SELECT * FROM compliance_schedules WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return schedules, err
}

func (r *Repository) DeleteSchedule(ctx context.Context, id string, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM compliance_schedules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}
