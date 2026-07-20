package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/report-designer/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- ReportDefinition CRUD ---

func (r *Repository) CreateReport(ctx context.Context, report *models.ReportDefinition) error {
	report.ID = uuid.New().String()
	report.CreatedAt = time.Now().UTC()
	report.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO report_definitions (id, tenant_id, name, description, category, layout, components, datasource_bindings, template_id, status, enabled, created_by, created_at, updated_at)
		 VALUES (:id, :tenantId, :name, :description, :category, :layout, :components, :datasourceBindings, :templateId, :status, :enabled, :createdBy, :createdAt, :updatedAt)`,
		report)
	return err
}

func (r *Repository) GetReportByID(ctx context.Context, id string, tenantID string) (*models.ReportDefinition, error) {
	var report models.ReportDefinition
	err := r.db.GetContext(ctx, &report,
		`SELECT * FROM report_definitions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &report, nil
}

func (r *Repository) UpdateReport(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.ReportDefinition, error) {
	updates["updated_at"] = time.Now().UTC()
	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf(`UPDATE report_definitions SET %s WHERE id=$%d AND tenant_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return r.GetReportByID(ctx, id, tenantID)
}

func (r *Repository) DeleteReport(ctx context.Context, id string, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM report_definitions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

func (r *Repository) ListReports(ctx context.Context, req *models.ListReportsRequest, tenantID string) ([]models.ReportDefinition, int, error) {
	limit := req.Limit
	if limit <= 0 {
		limit = 20
	}
	offset := req.Offset
	if offset < 0 {
		offset = 0
	}

	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if req.Category != nil && *req.Category != "" {
		where += fmt.Sprintf(" AND category = $%d", argIdx)
		args = append(args, *req.Category)
		argIdx++
	}
	if req.Enabled != nil {
		where += fmt.Sprintf(" AND enabled = $%d", argIdx)
		args = append(args, *req.Enabled)
		argIdx++
	}
	if req.Keyword != nil && *req.Keyword != "" {
		where += fmt.Sprintf(" AND (name ILIKE $%d OR description ILIKE $%d)", argIdx, argIdx+1)
		pattern := "%" + *req.Keyword + "%"
		args = append(args, pattern, pattern)
		argIdx += 2
	}

	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM report_definitions %s`, where)
	var total int
	err := r.db.GetContext(ctx, &total, countQuery, args...)
	if err != nil {
		return nil, 0, err
	}

	var items []models.ReportDefinition
	selectQuery := fmt.Sprintf(`SELECT * FROM report_definitions %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		where, argIdx, argIdx+1)
	args = append(args, limit, offset)
	err = r.db.SelectContext(ctx, &items, selectQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	if items == nil {
		items = []models.ReportDefinition{}
	}
	return items, total, nil
}

// --- ReportDatasource CRUD ---

func (r *Repository) CreateDatasource(ctx context.Context, ds *models.ReportDatasource) error {
	ds.ID = uuid.New().String()
	ds.CreatedAt = time.Now().UTC()
	ds.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO report_datasources (id, tenant_id, report_id, name, datasource_type, config, refresh_interval, status, created_at, updated_at)
		 VALUES (:id, :tenantId, :reportId, :name, :datasourceType, :config, :refreshInterval, :status, :createdAt, :updatedAt)`,
		ds)
	return err
}

func (r *Repository) GetDatasourceByID(ctx context.Context, id string, tenantID string) (*models.ReportDatasource, error) {
	var ds models.ReportDatasource
	err := r.db.GetContext(ctx, &ds,
		`SELECT * FROM report_datasources WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &ds, nil
}

func (r *Repository) UpdateDatasource(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.ReportDatasource, error) {
	updates["updated_at"] = time.Now().UTC()
	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf(`UPDATE report_datasources SET %s WHERE id=$%d AND tenant_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return r.GetDatasourceByID(ctx, id, tenantID)
}

func (r *Repository) DeleteDatasource(ctx context.Context, id string, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM report_datasources WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

func (r *Repository) ListDatasources(ctx context.Context, tenantID string) ([]models.ReportDatasource, error) {
	var items []models.ReportDatasource
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM report_datasources WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	if items == nil {
		items = []models.ReportDatasource{}
	}
	return items, nil
}

// --- ReportSchedule CRUD ---

func (r *Repository) CreateSchedule(ctx context.Context, s *models.ReportSchedule) error {
	s.ID = uuid.New().String()
	s.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO report_schedules (id, tenant_id, report_id, cron_expr, timezone, export_format, recipients, enabled, created_at)
		 VALUES (:id, :tenantId, :reportId, :cronExpr, :timezone, :exportFormat, :recipients, :enabled, :createdAt)`,
		s)
	return err
}

func (r *Repository) GetScheduleByID(ctx context.Context, id string, tenantID string) (*models.ReportSchedule, error) {
	var s models.ReportSchedule
	err := r.db.GetContext(ctx, &s,
		`SELECT * FROM report_schedules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Repository) UpdateSchedule(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.ReportSchedule, error) {
	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf(`UPDATE report_schedules SET %s WHERE id=$%d AND tenant_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return r.GetScheduleByID(ctx, id, tenantID)
}

func (r *Repository) DeleteSchedule(ctx context.Context, id string, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM report_schedules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

func (r *Repository) ListSchedules(ctx context.Context, reportID string, tenantID string) ([]models.ReportSchedule, error) {
	var items []models.ReportSchedule
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM report_schedules WHERE report_id=$1 AND tenant_id=$2 ORDER BY created_at DESC`, reportID, tenantID)
	if err != nil {
		return nil, err
	}
	if items == nil {
		items = []models.ReportSchedule{}
	}
	return items, nil
}

// --- ReportExecution CRUD ---

func (r *Repository) CreateExecution(ctx context.Context, e *models.ReportExecution) error {
	e.ID = uuid.New().String()
	e.CreatedAt = time.Now().UTC()
	e.StartedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO report_executions (id, tenant_id, report_id, schedule_id, status, output_path, error_message, started_at, finished_at, created_at, created_by)
		 VALUES (:id, :tenantId, :reportId, :scheduleId, :status, :outputPath, :errorMessage, :startedAt, :finishedAt, :createdAt, :createdBy)`,
		e)
	return err
}

func (r *Repository) UpdateExecutionStatus(ctx context.Context, id string, tenantID string, status string, outputPath *string, errorMessage *string) error {
	setClauses := []string{"status = $1"}
	args := []interface{}{status}
	i := 2
	if outputPath != nil {
		setClauses = append(setClauses, fmt.Sprintf("output_path = $%d", i))
		args = append(args, *outputPath)
		i++
	}
	if errorMessage != nil {
		setClauses = append(setClauses, fmt.Sprintf("error_message = $%d", i))
		args = append(args, *errorMessage)
		i++
	}
	setClauses = append(setClauses, fmt.Sprintf("finished_at = $%d", i))
	args = append(args, time.Now().UTC())
	i++
	args = append(args, id, tenantID)
	query := fmt.Sprintf(`UPDATE report_executions SET %s WHERE id=$%d AND tenant_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

func (r *Repository) ListExecutions(ctx context.Context, reportID string, tenantID string, limit int) ([]models.ReportExecution, error) {
	if limit <= 0 {
		limit = 20
	}
	var items []models.ReportExecution
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM report_executions WHERE report_id=$1 AND tenant_id=$2 ORDER BY started_at DESC LIMIT $3`,
		reportID, tenantID, limit)
	if err != nil {
		return nil, err
	}
	if items == nil {
		items = []models.ReportExecution{}
	}
	return items, nil
}

// --- Errors ---

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound)
}
