package repository

import (
	"context"
	"orion/platform-svc-go/internal/backup/models"
)


// RepositoryInterface defines the data access contract for the backup module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreatePlan(ctx context.Context, plan *models.BackupPlan) error
	GetPlanByID(ctx context.Context, id string, tenantID string) (*models.BackupPlan, error)
	ListPlans(ctx context.Context, tenantID string) ([]models.BackupPlan, error)
	UpdatePlan(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.BackupPlan, error)
	DeletePlan(ctx context.Context, id string, tenantID string) (bool, error)
	CreateRecoveryPlan(ctx context.Context, plan *models.RecoveryPlan) error
	GetRecoveryPlanByID(ctx context.Context, id string, tenantID string) (*models.RecoveryPlan, error)
	ListRecoveryPlans(ctx context.Context, tenantID string) ([]models.RecoveryPlan, error)
	UpdateRecoveryPlan(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.RecoveryPlan, error)
	DeleteRecoveryPlan(ctx context.Context, id string, tenantID string) (bool, error)
	CreateJob(ctx context.Context, job *models.BackupJob) error
	GetJobByID(ctx context.Context, id string, tenantID string) (*models.BackupJob, error)
	ListJobs(ctx context.Context, tenantID string, status *string) ([]models.BackupJob, error)
	CreateRestore(ctx context.Context, restore *models.Restore) error
	VerifyBackup(ctx context.Context, jobID string, tenantID string) (*models.BackupJob, error)
	CountPlans(ctx context.Context, tenantID string) (int, error)
	CountRecoveryPlans(ctx context.Context, tenantID string) (int, error)
	CountBackups(ctx context.Context, tenantID string) (int, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
