package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/report-designer/models"
	"orion/platform-svc-go/internal/report-designer/repository"
	"orion/go-common/pkg/otel"
	"go.uber.org/zap"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateDatasource(ctx context.Context, ds *models.ReportDatasource) error
	CreateExecution(ctx context.Context, e *models.ReportExecution) error
	CreateReport(ctx context.Context, report *models.ReportDefinition) error
	CreateSchedule(ctx context.Context, s *models.ReportSchedule) error
	DeleteDatasource(ctx context.Context, id string, tenantID string) (bool, error)
	DeleteReport(ctx context.Context, id string, tenantID string) (bool, error)
	DeleteSchedule(ctx context.Context, id string, tenantID string) (bool, error)
	GetDatasourceByID(ctx context.Context, id string, tenantID string) (*models.ReportDatasource, error)
	GetReportByID(ctx context.Context, id string, tenantID string) (*models.ReportDefinition, error)
	GetScheduleByID(ctx context.Context, id string, tenantID string) (*models.ReportSchedule, error)
	ListDatasources(ctx context.Context, tenantID string) ([]models.ReportDatasource, error)
	ListExecutions(ctx context.Context, reportID string, tenantID string, limit int) ([]models.ReportExecution, error)
	ListReports(ctx context.Context, req *models.ListReportsRequest, tenantID string) ([]models.ReportDefinition, int, error)
	ListSchedules(ctx context.Context, reportID string, tenantID string) ([]models.ReportSchedule, error)
	UpdateDatasource(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.ReportDatasource, error)
	UpdateExecutionStatus(ctx context.Context, id string, tenantID string, status string, outputPath *string, errorMessage *string) error
	UpdateReport(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.ReportDefinition, error)
	UpdateSchedule(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.ReportSchedule, error)
}

type Service struct {
	repo   RepositoryInterface
	logger *zap.Logger
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{
		repo:   repo,
		logger: zap.NewNop(),
	}
}

// IsRepoNotFound returns true if the error indicates a repository not-found.
func IsRepoNotFound(err error) bool {
	return repository.IsNotFound(err) || err == sql.ErrNoRows
}

// --- ReportDefinition CRUD ---

func (s *Service) CreateReport(ctx context.Context, req *models.CreateReportRequest) (*models.ReportDefinition, error) {
	_, span := otel.Tracer("orion-report-designer").Start(ctx, "Service.CreateReport")
	defer span.End()
	tenantID := "00000000-0000-0000-0000-000000000000"
	if req.TenantID != nil {
		tenantID = *req.TenantID
	}
	createdBy := req.CreatedBy
	if createdBy == "" {
		createdBy = "system"
	}
	report := &models.ReportDefinition{
		Name:               req.Name,
		Description:        req.Description,
		Category:           req.Category,
		Layout:             req.Layout,
		Components:         req.Components,
		DatasourceBindings: req.DatasourceBindings,
		TemplateID:         req.TemplateID,
		Status:             "draft",
		Enabled:            true,
		TenantID:           tenantID,
		CreatedBy:          createdBy,
	}
	if req.Enabled != nil {
		report.Enabled = *req.Enabled
	}
	s.logger.Info("creating report", zap.String("tenant_id", tenantID), zap.String("name", req.Name))
	if err := s.repo.CreateReport(ctx, report); err != nil {
		s.logger.Error("create report failed", zap.Error(err))
		return nil, err
	}
	s.logger.Info("report created", zap.String("id", report.ID))
	return s.repo.GetReportByID(ctx, report.ID, tenantID)
}

func (s *Service) GetReport(ctx context.Context, id string, tenantID string) (*models.ReportDefinition, error) {
	_, span := otel.Tracer("orion-report-designer").Start(ctx, "Service.GetReport")
	defer span.End()
	return s.repo.GetReportByID(ctx, id, tenantID)
}

func (s *Service) UpdateReport(ctx context.Context, id string, tenantID string, req *models.UpdateReportRequest) (*models.ReportDefinition, error) {
	_, span := otel.Tracer("orion-report-designer").Start(ctx, "Service.UpdateReport")
	defer span.End()
	updates := map[string]interface{}{}
	if req.Name != nil { updates["name"] = *req.Name }
	if req.Description != nil { updates["description"] = *req.Description }
	if req.Category != nil { updates["category"] = *req.Category }
	if req.Layout != nil { updates["layout"] = *req.Layout }
	if req.Components != nil { updates["components"] = *req.Components }
	if req.DatasourceBindings != nil { updates["datasource_bindings"] = *req.DatasourceBindings }
	if req.TemplateID != nil { updates["template_id"] = *req.TemplateID }
	if req.Status != nil { updates["status"] = *req.Status }
	if req.Enabled != nil { updates["enabled"] = *req.Enabled }
	if len(updates) == 0 { return nil, errors.New("no fields to update") }
	s.logger.Info("updating report", zap.String("id", id), zap.Any("updates", updates))
	return s.repo.UpdateReport(ctx, id, tenantID, updates)
}

func (s *Service) DeleteReport(ctx context.Context, id string, tenantID string) (bool, error) {
	_, span := otel.Tracer("orion-report-designer").Start(ctx, "Service.DeleteReport")
	defer span.End()
	s.logger.Info("deleting report", zap.String("id", id))
	return s.repo.DeleteReport(ctx, id, tenantID)
}

func (s *Service) ListReports(ctx context.Context, tenantID string, req *models.ListReportsRequest) ([]models.ReportDefinition, int, error) {
	_, span := otel.Tracer("orion-report-designer").Start(ctx, "Service.ListReports")
	defer span.End()
	return s.repo.ListReports(ctx, req, tenantID)
}

// --- ReportDatasource CRUD ---

func (s *Service) CreateDatasource(ctx context.Context, req *models.CreateDatasourceRequest) (*models.ReportDatasource, error) {
	_, span := otel.Tracer("orion-report-designer").Start(ctx, "Service.CreateDatasource")
	defer span.End()
	tenantID := "00000000-0000-0000-0000-000000000000"
	if req.TenantID != nil { tenantID = *req.TenantID }
	ds := &models.ReportDatasource{
		Name:            req.Name,
		DatasourceType:  req.DatasourceType,
		Config:          req.Config,
		RefreshInterval: req.RefreshInterval,
		Status:          "active",
		ReportID:        req.ReportID,
		TenantID:        tenantID,
	}
	s.logger.Info("creating datasource", zap.String("name", req.Name))
	if err := s.repo.CreateDatasource(ctx, ds); err != nil {
		s.logger.Error("create datasource failed", zap.Error(err))
		return nil, err
	}
	return s.repo.GetDatasourceByID(ctx, ds.ID, tenantID)
}

func (s *Service) GetDatasource(ctx context.Context, id string, tenantID string) (*models.ReportDatasource, error) {
	return s.repo.GetDatasourceByID(ctx, id, tenantID)
}

func (s *Service) UpdateDatasource(ctx context.Context, id string, tenantID string, req *models.UpdateDatasourceRequest) (*models.ReportDatasource, error) {
	updates := map[string]interface{}{}
	if req.Name != nil { updates["name"] = *req.Name }
	if req.DatasourceType != nil { updates["datasource_type"] = *req.DatasourceType }
	if req.Config != nil { updates["config"] = *req.Config }
	if req.RefreshInterval != nil { updates["refresh_interval"] = *req.RefreshInterval }
	if req.ReportID != nil { updates["report_id"] = *req.ReportID }
	if req.Status != nil { updates["status"] = *req.Status }
	if len(updates) == 0 { return nil, errors.New("no fields to update") }
	s.logger.Info("updating datasource", zap.String("id", id), zap.Any("updates", updates))
	return s.repo.UpdateDatasource(ctx, id, tenantID, updates)
}

func (s *Service) DeleteDatasource(ctx context.Context, id string, tenantID string) (bool, error) {
	s.logger.Info("deleting datasource", zap.String("id", id))
	return s.repo.DeleteDatasource(ctx, id, tenantID)
}

func (s *Service) ListDatasources(ctx context.Context, tenantID string) ([]models.ReportDatasource, error) {
	return s.repo.ListDatasources(ctx, tenantID)
}

// --- ReportSchedule CRUD ---

func (s *Service) CreateSchedule(ctx context.Context, req *models.CreateScheduleRequest) (*models.ReportSchedule, error) {
	_, span := otel.Tracer("orion-report-designer").Start(ctx, "Service.CreateSchedule")
	defer span.End()
	tenantID := "00000000-0000-0000-0000-000000000000"
	if req.TenantID != nil { tenantID = *req.TenantID }
	enabled := true
	if req.Enabled != nil { enabled = *req.Enabled }
	schedule := &models.ReportSchedule{
		ReportID:     req.ReportID,
		CronExpr:     req.CronExpr,
		ExportFormat: req.ExportFormat,
		Recipients:   req.Recipients,
		Enabled:      enabled,
		TenantID:     tenantID,
		Timezone:     "UTC",
	}
	if req.Timezone != nil { schedule.Timezone = *req.Timezone }
	_, err := s.repo.GetReportByID(ctx, req.ReportID, tenantID)
	if err != nil { return nil, fmt.Errorf("report not found: %w", err) }
	s.logger.Info("creating schedule", zap.String("report_id", req.ReportID))
	if err := s.repo.CreateSchedule(ctx, schedule); err != nil {
		s.logger.Error("create schedule failed", zap.Error(err))
		return nil, err
	}
	return s.repo.GetScheduleByID(ctx, schedule.ID, tenantID)
}

func (s *Service) GetSchedule(ctx context.Context, id string, tenantID string) (*models.ReportSchedule, error) {
	return s.repo.GetScheduleByID(ctx, id, tenantID)
}

func (s *Service) UpdateSchedule(ctx context.Context, id string, tenantID string, req *models.UpdateScheduleRequest) (*models.ReportSchedule, error) {
	updates := map[string]interface{}{}
	if req.CronExpr != nil { updates["cron_expr"] = *req.CronExpr }
	if req.ExportFormat != nil { updates["export_format"] = *req.ExportFormat }
	if req.Recipients != nil { updates["recipients"] = *req.Recipients }
	if req.Enabled != nil { updates["enabled"] = *req.Enabled }
	if req.Timezone != nil { updates["timezone"] = *req.Timezone }
	if len(updates) == 0 { return nil, errors.New("no fields to update") }
	return s.repo.UpdateSchedule(ctx, id, tenantID, updates)
}

func (s *Service) DeleteSchedule(ctx context.Context, id string, tenantID string) (bool, error) {
	s.logger.Info("deleting schedule", zap.String("id", id))
	return s.repo.DeleteSchedule(ctx, id, tenantID)
}

func (s *Service) ListSchedules(ctx context.Context, reportID string, tenantID string) ([]models.ReportSchedule, error) {
	return s.repo.ListSchedules(ctx, reportID, tenantID)
}

// --- ReportExecution ---

func (s *Service) ExecuteReport(ctx context.Context, reportID string, tenantID string, req *models.ExecuteReportRequest) (*models.ReportExecution, error) {
	_, span := otel.Tracer("orion-report-designer").Start(ctx, "Service.ExecuteReport")
	defer span.End()
	_, err := s.repo.GetReportByID(ctx, reportID, tenantID)
	if err != nil { return nil, fmt.Errorf("report not found: %w", err) }
	user := "system"
	if req.User != nil { user = *req.User }
	s.logger.Info("executing report", zap.String("report_id", reportID))
	execution := &models.ReportExecution{
		ReportID:  reportID,
		Status:    "running",
		TenantID:  tenantID,
		CreatedBy: &user,
	}
	if err := s.repo.CreateExecution(ctx, execution); err != nil {
		s.logger.Error("create execution failed", zap.Error(err))
		return nil, err
	}
	outputPath := "reports/" + reportID + "/" + execution.ID + ".pdf"
	if req.Format != nil { outputPath = "reports/" + reportID + "/" + execution.ID + "." + *req.Format }
	_ = s.repo.UpdateExecutionStatus(ctx, execution.ID, tenantID, "completed", &outputPath, nil)
	return execution, nil
}

func (s *Service) GetExecutionHistory(ctx context.Context, reportID string, tenantID string, limit int) ([]models.ReportExecution, error) {
	return s.repo.ListExecutions(ctx, reportID, tenantID, limit)
}

// --- Preview ---

func (s *Service) PreviewReport(ctx context.Context, reportID string, tenantID string, req *models.PreviewReportRequest) (*models.PreviewReportResult, error) {
	_, span := otel.Tracer("orion-report-designer").Start(ctx, "Service.PreviewReport")
	defer span.End()
	_, err := s.repo.GetReportByID(ctx, reportID, tenantID)
	if err != nil { return nil, fmt.Errorf("report not found: %w", err) }
	return &models.PreviewReportResult{
		ReportID:   reportID,
		Data:       req.Parameters,
		Components: map[string]interface{}{},
		Message:    "preview generated successfully",
	}, nil
}
