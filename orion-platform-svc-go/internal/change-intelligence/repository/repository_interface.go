package repository

import (
	"context"
	"orion/platform-svc-go/internal/change-intelligence/models"
)


// RepositoryInterface defines the data access contract for the change-intelligence module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateAnalysis(ctx context.Context, a *models.ChangeAnalysis) error
	GetAnalysisByID(ctx context.Context, id string, tenantID string) (*models.ChangeAnalysis, error)
	ListAnalyses(ctx context.Context, tenantID string) ([]models.ChangeAnalysis, error)
	SaveBlastRadius(ctx context.Context, analysisID string, items []models.BlastRadiusItem) error
	GetBlastRadiusByAnalysisID(ctx context.Context, analysisID string) ([]models.BlastRadiusItem, error)
	SaveRiskFactors(ctx context.Context, analysisID string, factors []models.RiskFactor) error
	GetRiskFactorsByAnalysisID(ctx context.Context, analysisID string) ([]models.RiskFactor, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
