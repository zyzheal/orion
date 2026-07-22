package repository

import (
	"context"
	"orion/platform-svc-go/internal/compliance/models"
)


// RepositoryInterface defines the data access contract for the compliance module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateReport(ctx context.Context, report *models.ComplianceReport) error
	GetReportByID(ctx context.Context, id string, tenantID string) (*models.ComplianceReport, error)
	ListReports(ctx context.Context, tenantID string, framework *string) ([]models.ComplianceReport, error)
	UpdateReport(ctx context.Context, report *models.ComplianceReport, tenantID string) (*models.ComplianceReport, error)
	DeleteReport(ctx context.Context, id string, tenantID string) (bool, error)
	CreateSchedule(ctx context.Context, schedule *models.ComplianceSchedule) error
	GetScheduleByID(ctx context.Context, id string, tenantID string) (*models.ComplianceSchedule, error)
	ListSchedules(ctx context.Context, tenantID string) ([]models.ComplianceSchedule, error)
	DeleteSchedule(ctx context.Context, id string, tenantID string) (bool, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
