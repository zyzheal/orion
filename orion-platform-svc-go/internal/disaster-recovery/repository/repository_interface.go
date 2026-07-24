package repository

import (
	"time"
	"context"
	"orion/platform-svc-go/internal/disaster-recovery/models"
)


// RepositoryInterface defines the data access contract for the disaster-recovery module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreatePlan(ctx context.Context, p *models.DisasterPlan) error
	GetPlan(ctx context.Context, tenantID, id string) (*models.DisasterPlan, error)
	ListPlans(ctx context.Context, tenantID string, limit, offset int) ([]models.DisasterPlan, error)
	CountPlans(ctx context.Context, tenantID string) (int, error)
	UpdatePlan(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	UpdatePlanLastRun(ctx context.Context, tenantID, id string, lastRun time.Time) error
	CreateRun(ctx context.Context, run *models.RecoveryRun) error
	ListRuns(ctx context.Context, tenantID, planID string) ([]models.RecoveryRun, error)
	GetRun(ctx context.Context, tenantID, planID, runID string) (*models.RecoveryRun, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
