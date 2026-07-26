package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"orion/finops-svc-go/internal/report-designer/models"

	"github.com/jmoiron/sqlx"
)

// ==================== ReportDefinitionRepository ====================

// ReportDefinitionRepository provides data access for report definitions.
type ReportDefinitionRepository struct {
	db *sqlx.DB
}

// NewReportDefinitionRepository creates a new ReportDefinitionRepository.
func NewReportDefinitionRepository(db *sqlx.DB) *ReportDefinitionRepository {
	return &ReportDefinitionRepository{db: db}
}

// Create inserts a new report definition.
func (r *ReportDefinitionRepository) Create(ctx context.Context, report *models.ReportDefinition) error {
	query := `
		INSERT INTO report_definition (id, tenant_id, name, description, category, layout, components, datasource_bindings, template_id, enabled, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, created_at, updated_at
	`
	layoutJSON, _ := json.Marshal(report.Layout)
	componentsJSON, _ := json.Marshal(report.Components)

	var dsBindingsJSON []byte
	if report.DatasourceBindings != nil {
		dsBindingsJSON, _ = json.Marshal(report.DatasourceBindings)
	}

	return r.db.QueryRowContext(ctx, query,
		report.ID, report.TenantID, report.Name,
		report.Description, report.Category,
		layoutJSON, componentsJSON, dsBindingsJSON,
		report.TemplateID, report.Enabled, report.CreatedBy,
	).Scan(&report.ID, &report.CreatedAt, &report.UpdatedAt)
}

// GetByID retrieves a report definition by ID.
func (r *ReportDefinitionRepository) GetByID(ctx context.Context, tenantID, id string) (*models.ReportDefinition, error) {
	var report models.ReportDefinition
	query := `SELECT * FROM report_definition WHERE id = $1 AND tenant_id = $2`
	err := r.db.GetContext(ctx, &report, query, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("report definition not found: %w", err)
	}
	return &report, nil
}

// GetByIDOnly retrieves a report definition by ID alone (no tenant filter).
func (r *ReportDefinitionRepository) GetByIDOnly(ctx context.Context, id string) (*models.ReportDefinition, error) {
	var report models.ReportDefinition
	query := `SELECT * FROM report_definition WHERE id = $1`
	err := r.db.GetContext(ctx, &report, query, id)
	if err != nil {
		return nil, fmt.Errorf("report definition not found: %w", err)
	}
	return &report, nil
}

// ListByTenant retrieves report definitions for a tenant with pagination.
func (r *ReportDefinitionRepository) ListByTenant(ctx context.Context, tenantID string, filters models.ReportDefinitionFilters) ([]models.ReportDefinition, int, error) {
	baseQuery := "SELECT * FROM report_definition WHERE tenant_id = $1"
	countQuery := "SELECT COUNT(*) FROM report_definition WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	paramIdx := 2

	if filters.Category != nil && *filters.Category != "" {
		baseQuery += fmt.Sprintf(" AND category = $%d", paramIdx)
		countQuery += fmt.Sprintf(" AND category = $%d", paramIdx)
		args = append(args, *filters.Category)
		paramIdx++
	}
	if filters.Enabled != nil {
		baseQuery += fmt.Sprintf(" AND enabled = $%d", paramIdx)
		countQuery += fmt.Sprintf(" AND enabled = $%d", paramIdx)
		args = append(args, *filters.Enabled)
		paramIdx++
	}
	if filters.Keyword != nil && *filters.Keyword != "" {
		baseQuery += fmt.Sprintf(" AND (name ILIKE $%d OR description ILIKE $%d)", paramIdx, paramIdx)
		countQuery += fmt.Sprintf(" AND (name ILIKE $%d OR description ILIKE $%d)", paramIdx, paramIdx)
		args = append(args, "%"+*filters.Keyword+"%")
		paramIdx++
	}

	var total int
	if err := r.db.GetContext(ctx, &total, countQuery, args...); err != nil {
		return nil, 0, fmt.Errorf("failed to count reports: %w", err)
	}

	baseQuery += fmt.Sprintf(" ORDER BY updated_at DESC LIMIT $%d OFFSET $%d", paramIdx, paramIdx+1)
	args = append(args, filters.Limit, filters.Offset)

	var reports []models.ReportDefinition
	if err := r.db.SelectContext(ctx, &reports, baseQuery, args...); err != nil {
		return nil, 0, fmt.Errorf("failed to list reports: %w", err)
	}
	return reports, total, nil
}

// UpdateByID updates specific fields of a report definition.
func (r *ReportDefinitionRepository) UpdateByID(ctx context.Context, tenantID, id string, data *models.UpdateReportInput) (*models.ReportDefinition, error) {
	setClauses := []string{}
	args := []interface{}{}
	paramIdx := 1

	if data.Name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", paramIdx))
		args = append(args, *data.Name)
		paramIdx++
	}
	if data.Description != nil {
		setClauses = append(setClauses, fmt.Sprintf("description = $%d", paramIdx))
		args = append(args, *data.Description)
		paramIdx++
	}
	if data.Category != nil {
		setClauses = append(setClauses, fmt.Sprintf("category = $%d", paramIdx))
		args = append(args, *data.Category)
		paramIdx++
	}
	if data.Layout != nil {
		layoutJSON, _ := json.Marshal(data.Layout)
		setClauses = append(setClauses, fmt.Sprintf("layout = $%d::jsonb", paramIdx))
		args = append(args, string(layoutJSON))
		paramIdx++
	}
	if data.Components != nil {
		componentsJSON, _ := json.Marshal(data.Components)
		setClauses = append(setClauses, fmt.Sprintf("components = $%d::jsonb", paramIdx))
		args = append(args, string(componentsJSON))
		paramIdx++
	}
	if data.DatasourceBindings != nil {
		dsJSON, _ := json.Marshal(data.DatasourceBindings)
		setClauses = append(setClauses, fmt.Sprintf("datasource_bindings = $%d::jsonb", paramIdx))
		args = append(args, string(dsJSON))
		paramIdx++
	}
	if data.TemplateID != nil {
		setClauses = append(setClauses, fmt.Sprintf("template_id = $%d", paramIdx))
		args = append(args, *data.TemplateID)
		paramIdx++
	}
	if data.Enabled != nil {
		setClauses = append(setClauses, fmt.Sprintf("enabled = $%d", paramIdx))
		args = append(args, *data.Enabled)
		paramIdx++
	}

	if len(setClauses) == 0 {
		return r.GetByID(ctx, tenantID, id)
	}

	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", paramIdx))
	args = append(args, time.Now())
	paramIdx++

	args = append(args, id, tenantID)
	query := fmt.Sprintf(
		"UPDATE report_definition SET %s WHERE id = $%d AND tenant_id = $%d RETURNING *",
		strings.Join(setClauses, ", "), paramIdx, paramIdx+1,
	)

	var report models.ReportDefinition
	err := r.db.GetContext(ctx, &report, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to update report definition: %w", err)
	}
	return &report, nil
}

// DeleteByID deletes a report definition.
func (r *ReportDefinitionRepository) DeleteByID(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		"DELETE FROM report_definition WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return false, fmt.Errorf("failed to delete report definition: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("failed to delete report definition: %w", err)
	}
	return affected > 0, nil
}

// GetByCategory retrieves report definitions by category.
func (r *ReportDefinitionRepository) GetByCategory(ctx context.Context, tenantID, category string) ([]models.ReportDefinition, error) {
	var reports []models.ReportDefinition
	query := `SELECT * FROM report_definition WHERE tenant_id = $1 AND category = $2 ORDER BY name`
	if err := r.db.SelectContext(ctx, &reports, query, tenantID, category); err != nil {
		return nil, fmt.Errorf("failed to get reports by category: %w", err)
	}
	return reports, nil
}

// ==================== ReportDatasourceRepository ====================

// ReportDatasourceRepository provides data access for report datasources.
type ReportDatasourceRepository struct {
	db *sqlx.DB
}

// NewReportDatasourceRepository creates a new ReportDatasourceRepository.
func NewReportDatasourceRepository(db *sqlx.DB) *ReportDatasourceRepository {
	return &ReportDatasourceRepository{db: db}
}

// Create inserts a new report datasource.
func (r *ReportDatasourceRepository) Create(ctx context.Context, ds *models.ReportDatasource) error {
	query := `
		INSERT INTO report_datasource (id, tenant_id, name, datasource_type, config, refresh_interval)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at
	`
	configJSON, _ := json.Marshal(ds.Config)
	return r.db.QueryRowContext(ctx, query,
		ds.ID, ds.TenantID, ds.Name, ds.DatasourceType, configJSON, ds.RefreshInterval,
	).Scan(&ds.ID, &ds.CreatedAt, &ds.UpdatedAt)
}

// GetByID retrieves a datasource by ID.
func (r *ReportDatasourceRepository) GetByID(ctx context.Context, tenantID, id string) (*models.ReportDatasource, error) {
	var ds models.ReportDatasource
	query := `SELECT * FROM report_datasource WHERE id = $1 AND tenant_id = $2`
	err := r.db.GetContext(ctx, &ds, query, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("datasource not found: %w", err)
	}
	return &ds, nil
}

// List retrieves all datasources for a tenant.
func (r *ReportDatasourceRepository) List(ctx context.Context, tenantID string) ([]models.ReportDatasource, error) {
	var datasources []models.ReportDatasource
	query := `SELECT * FROM report_datasource WHERE tenant_id = $1 ORDER BY name`
	if err := r.db.SelectContext(ctx, &datasources, query, tenantID); err != nil {
		return nil, fmt.Errorf("failed to list datasources: %w", err)
	}
	return datasources, nil
}

// UpdateByID updates specific fields of a datasource.
func (r *ReportDatasourceRepository) UpdateByID(ctx context.Context, tenantID, id string, data *models.UpdateDatasourceInput) (*models.ReportDatasource, error) {
	setClauses := []string{}
	args := []interface{}{}
	paramIdx := 1

	if data.Name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", paramIdx))
		args = append(args, *data.Name)
		paramIdx++
	}
	if data.DatasourceType != nil {
		setClauses = append(setClauses, fmt.Sprintf("datasource_type = $%d", paramIdx))
		args = append(args, *data.DatasourceType)
		paramIdx++
	}
	if data.Config != nil {
		configJSON, _ := json.Marshal(data.Config)
		setClauses = append(setClauses, fmt.Sprintf("config = $%d::jsonb", paramIdx))
		args = append(args, string(configJSON))
		paramIdx++
	}
	if data.RefreshInterval != nil {
		setClauses = append(setClauses, fmt.Sprintf("refresh_interval = $%d", paramIdx))
		args = append(args, *data.RefreshInterval)
		paramIdx++
	}

	if len(setClauses) == 0 {
		return r.GetByID(ctx, tenantID, id)
	}

	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", paramIdx))
	args = append(args, time.Now())
	paramIdx++

	args = append(args, id, tenantID)
	query := fmt.Sprintf(
		"UPDATE report_datasource SET %s WHERE id = $%d AND tenant_id = $%d RETURNING *",
		strings.Join(setClauses, ", "), paramIdx, paramIdx+1,
	)

	var ds models.ReportDatasource
	err := r.db.GetContext(ctx, &ds, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to update datasource: %w", err)
	}
	return &ds, nil
}

// DeleteByID deletes a datasource.
func (r *ReportDatasourceRepository) DeleteByID(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		"DELETE FROM report_datasource WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return false, fmt.Errorf("failed to delete datasource: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("failed to delete report definition: %w", err)
	}
	return affected > 0, nil
}

// TestConnection validates the datasource configuration.
func (r *ReportDatasourceRepository) TestConnection(ctx context.Context, id string) (map[string]interface{}, error) {
	ds, err := r.GetByID(ctx, "", id)
	if err != nil {
		return nil, fmt.Errorf("datasource not found: %w", err)
	}
	if ds.Config == nil || len(ds.Config) == 0 {
		return map[string]interface{}{"success": false, "message": "Datasource configuration is empty"}, nil
	}
	return map[string]interface{}{"success": true, "message": "Configuration is valid"}, nil
}

// ==================== ReportScheduleRepository ====================

// ReportScheduleRepository provides data access for report schedules.
type ReportScheduleRepository struct {
	db *sqlx.DB
}

// NewReportScheduleRepository creates a new ReportScheduleRepository.
func NewReportScheduleRepository(db *sqlx.DB) *ReportScheduleRepository {
	return &ReportScheduleRepository{db: db}
}

// Create inserts a new report schedule.
func (r *ReportScheduleRepository) Create(ctx context.Context, schedule *models.ReportSchedule) error {
	query := `
		INSERT INTO report_schedule (id, tenant_id, report_id, cron_expression, export_format, recipients, enabled)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at
	`
	recipientsJSON, _ := json.Marshal(schedule.Recipients)
	return r.db.QueryRowContext(ctx, query,
		schedule.ID, schedule.TenantID, schedule.ReportID,
		schedule.CronExpression, schedule.ExportFormat, recipientsJSON, schedule.Enabled,
	).Scan(&schedule.ID, &schedule.CreatedAt)
}

// GetByID retrieves a schedule by ID.
func (r *ReportScheduleRepository) GetByID(ctx context.Context, tenantID, id string) (*models.ReportSchedule, error) {
	var schedule models.ReportSchedule
	query := `SELECT * FROM report_schedule WHERE id = $1 AND tenant_id = $2`
	err := r.db.GetContext(ctx, &schedule, query, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("schedule not found: %w", err)
	}
	return &schedule, nil
}

// ListByReport retrieves schedules for a report.
func (r *ReportScheduleRepository) ListByReport(ctx context.Context, tenantID, reportID string) ([]models.ReportSchedule, error) {
	var schedules []models.ReportSchedule
	query := `SELECT * FROM report_schedule WHERE tenant_id = $1 AND report_id = $2 ORDER BY created_at DESC`
	if err := r.db.SelectContext(ctx, &schedules, query, tenantID, reportID); err != nil {
		return nil, fmt.Errorf("failed to list schedules: %w", err)
	}
	return schedules, nil
}

// UpdateByID updates specific fields of a schedule.
func (r *ReportScheduleRepository) UpdateByID(ctx context.Context, tenantID, id string, data *models.UpdateScheduleInput) (*models.ReportSchedule, error) {
	setClauses := []string{}
	args := []interface{}{}
	paramIdx := 1

	if data.CronExpression != nil {
		setClauses = append(setClauses, fmt.Sprintf("cron_expression = $%d", paramIdx))
		args = append(args, *data.CronExpression)
		paramIdx++
	}
	if data.ExportFormat != nil {
		setClauses = append(setClauses, fmt.Sprintf("export_format = $%d", paramIdx))
		args = append(args, *data.ExportFormat)
		paramIdx++
	}
	if data.Recipients != nil {
		recipientsJSON, _ := json.Marshal(data.Recipients)
		setClauses = append(setClauses, fmt.Sprintf("recipients = $%d::jsonb", paramIdx))
		args = append(args, string(recipientsJSON))
		paramIdx++
	}
	if data.Enabled != nil {
		setClauses = append(setClauses, fmt.Sprintf("enabled = $%d", paramIdx))
		args = append(args, *data.Enabled)
		paramIdx++
	}
	if data.LastRunAt != nil {
		setClauses = append(setClauses, fmt.Sprintf("last_run_at = $%d", paramIdx))
		args = append(args, *data.LastRunAt)
		paramIdx++
	}
	if data.NextRunAt != nil {
		setClauses = append(setClauses, fmt.Sprintf("next_run_at = $%d", paramIdx))
		args = append(args, *data.NextRunAt)
		paramIdx++
	}

	if len(setClauses) == 0 {
		return r.GetByID(ctx, tenantID, id)
	}

	args = append(args, id, tenantID)
	query := fmt.Sprintf(
		"UPDATE report_schedule SET %s WHERE id = $%d AND tenant_id = $%d RETURNING *",
		strings.Join(setClauses, ", "), paramIdx, paramIdx+1,
	)

	var schedule models.ReportSchedule
	err := r.db.GetContext(ctx, &schedule, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to update schedule: %w", err)
	}
	return &schedule, nil
}

// DeleteByID deletes a schedule.
func (r *ReportScheduleRepository) DeleteByID(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		"DELETE FROM report_schedule WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return false, fmt.Errorf("failed to delete schedule: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("failed to delete report definition: %w", err)
	}
	return affected > 0, nil
}

// GetActiveSchedules retrieves all active schedules for a tenant.
func (r *ReportScheduleRepository) GetActiveSchedules(ctx context.Context, tenantID string) ([]models.ReportSchedule, error) {
	var schedules []models.ReportSchedule
	query := `SELECT * FROM report_schedule WHERE tenant_id = $1 AND enabled = true ORDER BY next_run_at ASC`
	if err := r.db.SelectContext(ctx, &schedules, query, tenantID); err != nil {
		return nil, fmt.Errorf("failed to get active schedules: %w", err)
	}
	return schedules, nil
}

// ==================== ReportExecutionRepository ====================

// ReportExecutionRepository provides data access for report execution history.
type ReportExecutionRepository struct {
	db *sqlx.DB
}

// NewReportExecutionRepository creates a new ReportExecutionRepository.
func NewReportExecutionRepository(db *sqlx.DB) *ReportExecutionRepository {
	return &ReportExecutionRepository{db: db}
}

// Create inserts a new execution record.
func (r *ReportExecutionRepository) Create(ctx context.Context, execution *models.ReportExecution) error {
	query := `
		INSERT INTO report_execution_history
			(id, tenant_id, report_id, schedule_id, export_format, status, file_url, error, started_at, triggered_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, created_at
	`
	return r.db.QueryRowContext(ctx, query,
		execution.ID, execution.TenantID, execution.ReportID,
		execution.ScheduleID, execution.ExportFormat, execution.Status,
		execution.FileURL, execution.Error, execution.StartedAt, execution.TriggeredBy,
	).Scan(&execution.ID, &execution.CreatedAt)
}

// GetByID retrieves an execution by ID.
func (r *ReportExecutionRepository) GetByID(ctx context.Context, tenantID, id string) (*models.ReportExecution, error) {
	var execution models.ReportExecution
	query := `SELECT * FROM report_execution_history WHERE id = $1 AND tenant_id = $2`
	err := r.db.GetContext(ctx, &execution, query, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("execution not found: %w", err)
	}
	return &execution, nil
}

// ListByReport retrieves executions for a report.
func (r *ReportExecutionRepository) ListByReport(ctx context.Context, tenantID, reportID string, limit int) ([]models.ReportExecution, error) {
	var executions []models.ReportExecution
	query := `
		SELECT * FROM report_execution_history
		WHERE tenant_id = $1 AND report_id = $2
		ORDER BY created_at DESC
		LIMIT $3
	`
	if err := r.db.SelectContext(ctx, &executions, query, tenantID, reportID, limit); err != nil {
		return nil, fmt.Errorf("failed to list executions: %w", err)
	}
	return executions, nil
}
