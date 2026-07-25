package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/finops/report-designer/models"
	"orion/platform-svc-go/internal/finops/report-designer/repository"

	"github.com/google/uuid"
)

var (
	ErrReportNotFound      = errors.New("report not found")
	ErrDatasourceNotFound  = errors.New("datasource not found")
	ErrScheduleNotFound    = errors.New("schedule not found")
)

// ReportDesignerService provides business logic for report designer operations.
type ReportDesignerService struct {
	definitionRepo  *repository.ReportDefinitionRepository
	datasourceRepo  *repository.ReportDatasourceRepository
	scheduleRepo    *repository.ReportScheduleRepository
	executionRepo   *repository.ReportExecutionRepository
}

// NewReportDesignerService creates a new ReportDesignerService.
func NewReportDesignerService(
	definitionRepo *repository.ReportDefinitionRepository,
	datasourceRepo *repository.ReportDatasourceRepository,
	scheduleRepo *repository.ReportScheduleRepository,
	executionRepo *repository.ReportExecutionRepository,
) *ReportDesignerService {
	return &ReportDesignerService{
		definitionRepo: definitionRepo,
		datasourceRepo: datasourceRepo,
		scheduleRepo:   scheduleRepo,
		executionRepo:  executionRepo,
	}
}

// ==================== Report Definitions ====================

// ListReports retrieves reports with optional filters.
func (s *ReportDesignerService) ListReports(ctx context.Context, tenantID string, filters models.ReportDefinitionFilters) ([]models.ReportDefinition, int, error) {
	return s.definitionRepo.ListByTenant(ctx, tenantID, filters)
}

// GetReport retrieves a single report by ID.
func (s *ReportDesignerService) GetReport(ctx context.Context, tenantID, id string) (*models.ReportDefinition, error) {
	report, err := s.definitionRepo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrReportNotFound
	}
	return report, nil
}

// CreateReport creates a new report definition.
func (s *ReportDesignerService) CreateReport(ctx context.Context, tenantID string, input *models.CreateReportInput) (*models.ReportDefinition, error) {
	if input.Name == "" {
		return nil, errors.New("report name is required")
	}

	enabled := true
	if input.Enabled != nil {
		enabled = *input.Enabled
	}

	report := &models.ReportDefinition{
		ID:                 models.GenerateReportID(),
		TenantID:           tenantID,
		Name:               input.Name,
		Description:        input.Description,
		Category:           input.Category,
		Layout:             input.Layout,
		Components:         input.Components,
		DatasourceBindings: input.DatasourceBindings,
		TemplateID:         input.TemplateID,
		Enabled:            enabled,
		CreatedBy:          input.CreatedBy,
	}

	if report.Layout == nil {
		report.Layout = models.JSONMap{}
	}
	if report.Components == nil {
		report.Components = models.JSONArray{}
	}

	if err := s.definitionRepo.Create(ctx, report); err != nil {
		return nil, fmt.Errorf("failed to create report: %w", err)
	}
	return report, nil
}

// UpdateReport updates an existing report definition.
func (s *ReportDesignerService) UpdateReport(ctx context.Context, tenantID, id string, input *models.UpdateReportInput) (*models.ReportDefinition, error) {
	if _, err := s.definitionRepo.GetByID(ctx, tenantID, id); err != nil {
		return nil, ErrReportNotFound
	}
	return s.definitionRepo.UpdateByID(ctx, tenantID, id, input)
}

// DeleteReport deletes a report definition.
func (s *ReportDesignerService) DeleteReport(ctx context.Context, tenantID, id string) error {
	deleted, err := s.definitionRepo.DeleteByID(ctx, tenantID, id)
	if err != nil {
		return fmt.Errorf("failed to delete report: %w", err)
	}
	if !deleted {
		return ErrReportNotFound
	}
	return nil
}

// PreviewReport previews a report with optional parameters.
func (s *ReportDesignerService) PreviewReport(ctx context.Context, tenantID, id string, params map[string]interface{}) (*models.PreviewResult, error) {
	report, err := s.definitionRepo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrReportNotFound
	}
	if params == nil {
		params = map[string]interface{}{}
	}
	return &models.PreviewResult{
		Report:       *report,
		PreviewParams: params,
	}, nil
}

// ExecuteReport triggers an execution record for the report.
func (s *ReportDesignerService) ExecuteReport(ctx context.Context, tenantID, id, exportFormat, triggeredBy string) (*models.ReportExecution, error) {
	report, err := s.definitionRepo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrReportNotFound
	}

	execution := &models.ReportExecution{
		ID:           fmt.Sprintf("rpex-%d-%s", time.Now().UnixNano(), uuid.New().String()[:7]),
		TenantID:     tenantID,
		ReportID:     report.ID,
		ExportFormat: exportFormat,
		Status:       "running",
		StartedAt:    &time.Time{},
		TriggeredBy:  &triggeredBy,
	}
	now := time.Now()
	execution.StartedAt = &now

	if err := s.executionRepo.Create(ctx, execution); err != nil {
		return nil, fmt.Errorf("failed to create execution: %w", err)
	}
	return execution, nil
}

// ==================== Datasources ====================

// ListDatasources retrieves all datasources for a tenant.
func (s *ReportDesignerService) ListDatasources(ctx context.Context, tenantID string) ([]models.ReportDatasource, error) {
	return s.datasourceRepo.List(ctx, tenantID)
}

// CreateDatasource creates a new datasource.
func (s *ReportDesignerService) CreateDatasource(ctx context.Context, tenantID string, input *models.CreateDatasourceInput) (*models.ReportDatasource, error) {
	if input.Name == "" || input.DatasourceType == "" || input.Config == nil {
		return nil, errors.New("name, datasourceType, and config are required")
	}

	ds := &models.ReportDatasource{
		ID:             fmt.Sprintf("rptds-%d-%s", time.Now().UnixNano(), uuid.New().String()[:7]),
		TenantID:       tenantID,
		Name:           input.Name,
		DatasourceType: input.DatasourceType,
		Config:         input.Config,
		RefreshInterval: input.RefreshInterval,
	}

	if err := s.datasourceRepo.Create(ctx, ds); err != nil {
		return nil, fmt.Errorf("failed to create datasource: %w", err)
	}
	return ds, nil
}

// UpdateDatasource updates an existing datasource.
func (s *ReportDesignerService) UpdateDatasource(ctx context.Context, tenantID, id string, input *models.UpdateDatasourceInput) (*models.ReportDatasource, error) {
	if _, err := s.datasourceRepo.GetByID(ctx, tenantID, id); err != nil {
		return nil, ErrDatasourceNotFound
	}
	return s.datasourceRepo.UpdateByID(ctx, tenantID, id, input)
}

// DeleteDatasource deletes a datasource.
func (s *ReportDesignerService) DeleteDatasource(ctx context.Context, tenantID, id string) error {
	deleted, err := s.datasourceRepo.DeleteByID(ctx, tenantID, id)
	if err != nil {
		return fmt.Errorf("failed to delete datasource: %w", err)
	}
	if !deleted {
		return ErrDatasourceNotFound
	}
	return nil
}

// ==================== Schedules ====================

// ListSchedules retrieves schedules for a report.
func (s *ReportDesignerService) ListSchedules(ctx context.Context, tenantID, reportID string) ([]models.ReportSchedule, error) {
	return s.scheduleRepo.ListByReport(ctx, tenantID, reportID)
}

// CreateSchedule creates a new schedule for a report.
func (s *ReportDesignerService) CreateSchedule(ctx context.Context, tenantID string, input *models.CreateScheduleInput) (*models.ReportSchedule, error) {
	if input.ReportID == "" || input.CronExpression == "" || input.ExportFormat == "" {
		return nil, errors.New("reportId, cronExpression, and exportFormat are required")
	}

	if _, err := s.definitionRepo.GetByID(ctx, tenantID, input.ReportID); err != nil {
		return nil, ErrReportNotFound
	}

	enabled := true
	if input.Enabled != nil {
		enabled = *input.Enabled
	}

	schedule := &models.ReportSchedule{
		ID:             fmt.Sprintf("rptsch-%d-%s", time.Now().UnixNano(), uuid.New().String()[:7]),
		TenantID:       tenantID,
		ReportID:       input.ReportID,
		CronExpression: input.CronExpression,
		ExportFormat:   input.ExportFormat,
		Recipients:     input.Recipients,
		Enabled:        enabled,
	}

	if schedule.Recipients == nil {
		schedule.Recipients = models.JSONArray{}
	}

	if err := s.scheduleRepo.Create(ctx, schedule); err != nil {
		return nil, fmt.Errorf("failed to create schedule: %w", err)
	}
	return schedule, nil
}

// UpdateSchedule updates an existing schedule.
func (s *ReportDesignerService) UpdateSchedule(ctx context.Context, tenantID, id string, input *models.UpdateScheduleInput) (*models.ReportSchedule, error) {
	if _, err := s.scheduleRepo.GetByID(ctx, tenantID, id); err != nil {
		return nil, ErrScheduleNotFound
	}
	return s.scheduleRepo.UpdateByID(ctx, tenantID, id, input)
}

// DeleteSchedule deletes a schedule.
func (s *ReportDesignerService) DeleteSchedule(ctx context.Context, tenantID, id string) error {
	deleted, err := s.scheduleRepo.DeleteByID(ctx, tenantID, id)
	if err != nil {
		return fmt.Errorf("failed to delete schedule: %w", err)
	}
	if !deleted {
		return ErrScheduleNotFound
	}
	return nil
}

// ==================== Execution History ====================

// GetExecutionHistory retrieves execution history for a report.
func (s *ReportDesignerService) GetExecutionHistory(ctx context.Context, tenantID, reportID string, limit int) ([]models.ReportExecution, error) {
	return s.executionRepo.ListByReport(ctx, tenantID, reportID, limit)
}
