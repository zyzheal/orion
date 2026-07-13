package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/report-designer/models"
	"orion/platform-svc-go/internal/report-designer/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// IsRepoNotFound returns true if the error indicates a repository not-found.
func IsRepoNotFound(err error) bool {
	return repository.IsNotFound(err) || err == sql.ErrNoRows
}

// --- ReportDefinition CRUD ---

func (s *Service) CreateReport(ctx context.Context, req *models.CreateReportRequest) (*models.ReportDefinition, error) {
	tenantID := "00000000-0000-0000-0000-000000000000"
	if req.TenantID != nil {
		tenantID = *req.TenantID
	}
	createdBy := req.CreatedBy
	if createdBy == "" {
		createdBy = "system"
	}

	report := &models.ReportDefinition{
		Name:             req.Name,
		Description:      req.Description,
		Category:         req.Category,
		Layout:           req.Layout,
		Components:       req.Components,
		DatasourceBindings: req.DatasourceBindings,
		TemplateID:       req.TemplateID,
		Status:           "draft",
		Enabled:          true,
		TenantID:         tenantID,
		CreatedBy:        createdBy,
	}
	if req.Enabled != nil {
		report.Enabled = *req.Enabled
	}
	if err := s.repo.CreateReport(ctx, report); err != nil {
		return nil, err
	}
	return s.repo.GetReportByID(ctx, report.ID, tenantID)
}

func (s *Service) GetReport(ctx context.Context, id string, tenantID string) (*models.ReportDefinition, error) {
	return s.repo.GetReportByID(ctx, id, tenantID)
}

func (s *Service) UpdateReport(ctx context.Context, id string, tenantID string, req *models.UpdateReportRequest) (*models.ReportDefinition, error) {
	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Category != nil {
		updates["category"] = *req.Category
	}
	if req.Layout != nil {
		updates["layout"] = *req.Layout
	}
	if req.Components != nil {
		updates["components"] = *req.Components
	}
	if req.DatasourceBindings != nil {
		updates["datasource_bindings"] = *req.DatasourceBindings
	}
	if req.TemplateID != nil {
		updates["template_id"] = *req.TemplateID
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if len(updates) == 0 {
		return nil, errors.New("no fields to update")
	}
	return s.repo.UpdateReport(ctx, id, tenantID, updates)
}

func (s *Service) DeleteReport(ctx context.Context, id string, tenantID string) (bool, error) {
	return s.repo.DeleteReport(ctx, id, tenantID)
}

func (s *Service) ListReports(ctx context.Context, tenantID string, req *models.ListReportsRequest) ([]models.ReportDefinition, int, error) {
	return s.repo.ListReports(ctx, req, tenantID)
}

// --- ReportDatasource CRUD ---

func (s *Service) CreateDatasource(ctx context.Context, req *models.CreateDatasourceRequest) (*models.ReportDatasource, error) {
	tenantID := "00000000-0000-0000-0000-000000000000"
	if req.TenantID != nil {
		tenantID = *req.TenantID
	}
	ds := &models.ReportDatasource{
		Name:            req.Name,
		DatasourceType:  req.DatasourceType,
		Config:          req.Config,
		RefreshInterval: req.RefreshInterval,
		Status:          "active",
		ReportID:        req.ReportID,
		TenantID:        tenantID,
	}
	if err := s.repo.CreateDatasource(ctx, ds); err != nil {
		return nil, err
	}
	return s.repo.GetDatasourceByID(ctx, ds.ID, tenantID)
}

func (s *Service) GetDatasource(ctx context.Context, id string, tenantID string) (*models.ReportDatasource, error) {
	return s.repo.GetDatasourceByID(ctx, id, tenantID)
}

func (s *Service) UpdateDatasource(ctx context.Context, id string, tenantID string, req *models.UpdateDatasourceRequest) (*models.ReportDatasource, error) {
	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.DatasourceType != nil {
		updates["datasource_type"] = *req.DatasourceType
	}
	if req.Config != nil {
		updates["config"] = *req.Config
	}
	if req.RefreshInterval != nil {
		updates["refresh_interval"] = *req.RefreshInterval
	}
	if req.ReportID != nil {
		updates["report_id"] = *req.ReportID
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if len(updates) == 0 {
		return nil, errors.New("no fields to update")
	}
	return s.repo.UpdateDatasource(ctx, id, tenantID, updates)
}

func (s *Service) DeleteDatasource(ctx context.Context, id string, tenantID string) (bool, error) {
	return s.repo.DeleteDatasource(ctx, id, tenantID)
}

func (s *Service) ListDatasources(ctx context.Context, tenantID string) ([]models.ReportDatasource, error) {
	return s.repo.ListDatasources(ctx, tenantID)
}

// --- ReportSchedule CRUD ---

func (s *Service) CreateSchedule(ctx context.Context, req *models.CreateScheduleRequest) (*models.ReportSchedule, error) {
	tenantID := "00000000-0000-0000-0000-000000000000"
	if req.TenantID != nil {
		tenantID = *req.TenantID
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	schedule := &models.ReportSchedule{
		ReportID:     req.ReportID,
		CronExpr:     req.CronExpr,
		ExportFormat: req.ExportFormat,
		Recipients:   req.Recipients,
		Enabled:      enabled,
		TenantID:     tenantID,
		Timezone:     "UTC",
	}
	if req.Timezone != nil {
		schedule.Timezone = *req.Timezone
	}
	// Verify the report exists
	_, err := s.repo.GetReportByID(ctx, req.ReportID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("report not found: %w", err)
	}
	if err := s.repo.CreateSchedule(ctx, schedule); err != nil {
		return nil, err
	}
	return s.repo.GetScheduleByID(ctx, schedule.ID, tenantID)
}

func (s *Service) GetSchedule(ctx context.Context, id string, tenantID string) (*models.ReportSchedule, error) {
	return s.repo.GetScheduleByID(ctx, id, tenantID)
}

func (s *Service) UpdateSchedule(ctx context.Context, id string, tenantID string, req *models.UpdateScheduleRequest) (*models.ReportSchedule, error) {
	updates := map[string]interface{}{}
	if req.CronExpr != nil {
		updates["cron_expr"] = *req.CronExpr
	}
	if req.ExportFormat != nil {
		updates["export_format"] = *req.ExportFormat
	}
	if req.Recipients != nil {
		updates["recipients"] = *req.Recipients
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if req.Timezone != nil {
		updates["timezone"] = *req.Timezone
	}
	if len(updates) == 0 {
		return nil, errors.New("no fields to update")
	}
	return s.repo.UpdateSchedule(ctx, id, tenantID, updates)
}

func (s *Service) DeleteSchedule(ctx context.Context, id string, tenantID string) (bool, error) {
	return s.repo.DeleteSchedule(ctx, id, tenantID)
}

func (s *Service) ListSchedules(ctx context.Context, reportID string, tenantID string) ([]models.ReportSchedule, error) {
	return s.repo.ListSchedules(ctx, reportID, tenantID)
}

// --- ReportExecution ---

func (s *Service) ExecuteReport(ctx context.Context, reportID string, tenantID string, req *models.ExecuteReportRequest) (*models.ReportExecution, error) {
	// Verify report exists
	_, err := s.repo.GetReportByID(ctx, reportID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("report not found: %w", err)
	}

	user := "system"
	if req.User != nil {
		user = *req.User
	}

	execution := &models.ReportExecution{
		ReportID:   reportID,
		Status:     "running",
		TenantID:   tenantID,
		CreatedBy:  &user,
	}
	if err := s.repo.CreateExecution(ctx, execution); err != nil {
		return nil, err
	}

	// Scaffold: simulate report execution completion
	outputPath := "reports/" + reportID + "/" + execution.ID + ".pdf"
	if req.Format != nil {
		outputPath = "reports/" + reportID + "/" + execution.ID + "." + *req.Format
	}
	_ = s.repo.UpdateExecutionStatus(ctx, execution.ID, tenantID, "completed", &outputPath, nil)
	return execution, nil
}

func (s *Service) GetExecutionHistory(ctx context.Context, reportID string, tenantID string, limit int) ([]models.ReportExecution, error) {
	return s.repo.ListExecutions(ctx, reportID, tenantID, limit)
}

// --- Preview ---

func (s *Service) PreviewReport(ctx context.Context, reportID string, tenantID string, req *models.PreviewReportRequest) (*models.PreviewReportResult, error) {
	// Verify report exists
	_, err := s.repo.GetReportByID(ctx, reportID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("report not found: %w", err)
	}

	// Scaffold preview result
	return &models.PreviewReportResult{
		ReportID: reportID,
		Data:     req.Parameters,
		Components: map[string]interface{}{},
		Message:  "preview generated successfully",
	}, nil
}
