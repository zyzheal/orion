package repository

import (
	"context"
	"orion/platform-svc-go/internal/diagnostic/models"
)


// RepositoryInterface defines the data access contract for the diagnostic module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateSession(ctx context.Context, session *models.Session) error
	GetSessionByID(ctx context.Context, id string) (*models.Session, error)
	ListSessions(ctx context.Context, tenantID string, status, triggerType, triggerID *string) ([]models.Session, error)
	UpdateSessionStatus(ctx context.Context, id string, status string) error
	CreateSymptom(ctx context.Context, symptom *models.Symptom) error
	ListSymptomsBySession(ctx context.Context, sessionID string) ([]models.Symptom, error)
	CreateReport(ctx context.Context, report *models.Report) error
	GetReportByID(ctx context.Context, id string) (*models.Report, error)
	GetReportBySession(ctx context.Context, sessionID string) (*models.Report, error)
	ListReports(ctx context.Context, tenantID, sessionID *string) ([]models.Report, error)
	CreatePattern(ctx context.Context, pattern *models.Pattern) error
	GetPatternByID(ctx context.Context, id string) (*models.Pattern, error)
	ListPatterns(ctx context.Context, tenantID, category, keyword *string) ([]models.Pattern, error)
	CountSessions(ctx context.Context, tenantID string) (int, error)
	CountReports(ctx context.Context, tenantID string) (int, error)
	CountPatterns(ctx context.Context, tenantID string) (int, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
