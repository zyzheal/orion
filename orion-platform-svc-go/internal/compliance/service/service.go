package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/compliance/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateReport(ctx context.Context, report *models.ComplianceReport) error
	CreateSchedule(ctx context.Context, schedule *models.ComplianceSchedule) error
	DeleteReport(ctx context.Context, id string, tenantID string) (bool, error)
	DeleteSchedule(ctx context.Context, id string, tenantID string) (bool, error)
	GetReportByID(ctx context.Context, id string, tenantID string) (*models.ComplianceReport, error)
	GetScheduleByID(ctx context.Context, id string, tenantID string) (*models.ComplianceSchedule, error)
	ListReports(ctx context.Context, tenantID string, framework *string) ([]models.ComplianceReport, error)
	ListSchedules(ctx context.Context, tenantID string) ([]models.ComplianceSchedule, error)
	UpdateReport(ctx context.Context, report *models.ComplianceReport, tenantID string) (*models.ComplianceReport, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreateReport(ctx context.Context, tenantID string, req *models.CreateComplianceReportRequest) (*models.ComplianceReport, error) {
	report := &models.ComplianceReport{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Framework:   req.Framework,
		TriggeredBy: "",
		ScheduleID:  req.ScheduleID,
	}
	if req.TriggeredBy != nil {
		report.TriggeredBy = *req.TriggeredBy
	}
	err := s.repo.CreateReport(ctx, report)
	if err != nil {
		return nil, err
	}
	return report, nil
}

func (s *Service) GetReport(ctx context.Context, id, tenantID string) (*models.ComplianceReport, error) {
	return s.repo.GetReportByID(ctx, id, tenantID)
}

func (s *Service) ListReports(ctx context.Context, tenantID, framework string) ([]models.ComplianceReport, error) {
	var frameworkPtr *string
	if framework != "" {
		frameworkPtr = &framework
	}
	return s.repo.ListReports(ctx, tenantID, frameworkPtr)
}

func (s *Service) UpdateReport(ctx context.Context, id, tenantID string, req *models.UpdateComplianceReportRequest) (*models.ComplianceReport, error) {
	report, err := s.repo.GetReportByID(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}
	if req.Name != nil {
		report.Name = *req.Name
	}
	if req.Description != nil {
		report.Description = req.Description
	}
	if req.Framework != nil {
		D := *req.Framework
		report.Framework = D
	}
	if req.TriggeredBy != nil {
		report.TriggeredBy = *req.TriggeredBy
	}
	if req.Status != nil {
		report.Status = *req.Status
	}
	return s.repo.UpdateReport(ctx, report, tenantID)
}

func (s *Service) DeleteReport(ctx context.Context, id, tenantID string) (bool, error) {
	return s.repo.DeleteReport(ctx, id, tenantID)
}

func (s *Service) CreateSchedule(ctx context.Context, tenantID string, req *models.CreateComplianceScheduleRequest) (*models.ComplianceSchedule, error) {
	schedule := &models.ComplianceSchedule{
		TenantID:       tenantID,
		Name:           req.Name,
		Framework:      req.Framework,
		CronExpression: req.CronExpression,
	}
	err := s.repo.CreateSchedule(ctx, schedule)
	if err != nil {
		return nil, err
	}
	return s.repo.GetScheduleByID(ctx, schedule.ID, tenantID)
}

func (s *Service) ListSchedules(ctx context.Context, tenantID string) ([]models.ComplianceSchedule, error) {
	return s.repo.ListSchedules(ctx, tenantID)
}

func (s *Service) DeleteSchedule(ctx context.Context, id, tenantID string) (bool, error) {
	return s.repo.DeleteSchedule(ctx, id, tenantID)
}

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound)
}
