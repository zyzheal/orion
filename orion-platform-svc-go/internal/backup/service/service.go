package service

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"orion/platform-svc-go/internal/backup/models"
	"orion/platform-svc-go/internal/backup/repository"

	"github.com/google/uuid"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// --- Backup Plans ---

func (s *Service) ListPlans(ctx context.Context, tenantID string) ([]models.BackupPlan, int, error) {
	plans, err := s.repo.ListPlans(ctx, tenantID)
	if err != nil {
		return nil, 0, err
	}
	if plans == nil {
		plans = []models.BackupPlan{}
	}
	return plans, len(plans), nil
}

func (s *Service) GetPlan(ctx context.Context, id string, tenantID string) (*models.BackupPlan, error) {
	plan, err := s.repo.GetPlanByID(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrPlanNotFound
		}
		return nil, err
	}
	return plan, nil
}

func (s *Service) CreatePlan(ctx context.Context, req *models.CreateBackupPlanRequest, tenantID string) (*models.BackupPlan, error) {
	plan := &models.BackupPlan{
		TenantID: tenantID,
		Name:     req.Name,
	}
	if req.Schedule != nil {
		plan.Schedule = req.Schedule
	}
	if req.RetentionDays != nil {
		plan.RetentionDays = *req.RetentionDays
	} else {
		plan.RetentionDays = 7
	}
	if req.Sources != nil {
		plan.Sources = *req.Sources
	} else {
		plan.Sources = "[]"
	}
	if err := s.repo.CreatePlan(ctx, plan); err != nil {
		return nil, err
	}
	return s.repo.GetPlanByID(ctx, plan.ID, tenantID)
}

func (s *Service) UpdatePlan(ctx context.Context, id string, req *models.UpdateBackupPlanRequest, tenantID string) (*models.BackupPlan, error) {
	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Schedule != nil {
		updates["schedule"] = *req.Schedule
	}
	if req.RetentionDays != nil {
		updates["retention_days"] = *req.RetentionDays
	}
	if req.Sources != nil {
		updates["sources"] = *req.Sources
	}
	if len(updates) == 0 {
		return nil, errors.New("no fields to update")
	}
	plan, err := s.repo.UpdatePlan(ctx, id, tenantID, updates)
	if err != nil {
		return nil, err
	}
	return plan, nil
}

func (s *Service) DeletePlan(ctx context.Context, id string, tenantID string) (bool, error) {
	return s.repo.DeletePlan(ctx, id, tenantID)
}

// --- Recovery Plans ---

func (s *Service) ListRecoveryPlans(ctx context.Context, tenantID string) ([]models.RecoveryPlan, int, error) {
	plans, err := s.repo.ListRecoveryPlans(ctx, tenantID)
	if err != nil {
		return nil, 0, err
	}
	if plans == nil {
		plans = []models.RecoveryPlan{}
	}
	return plans, len(plans), nil
}

func (s *Service) GetRecoveryPlan(ctx context.Context, id string, tenantID string) (*models.RecoveryPlan, error) {
	plan, err := s.repo.GetRecoveryPlanByID(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrRecoveryPlanNotFound
		}
		return nil, err
	}
	return plan, nil
}

func (s *Service) CreateRecoveryPlan(ctx context.Context, req *models.CreateRecoveryPlanRequest, tenantID string) (*models.RecoveryPlan, error) {
	plan := &models.RecoveryPlan{
		TenantID: tenantID,
		Name:     req.Name,
		Status:   "active",
	}
	if req.Status != nil {
		plan.Status = *req.Status
	}
	if err := s.repo.CreateRecoveryPlan(ctx, plan); err != nil {
		return nil, err
	}
	return s.repo.GetRecoveryPlanByID(ctx, plan.ID, tenantID)
}

func (s *Service) UpdateRecoveryPlan(ctx context.Context, id string, req *models.UpdateRecoveryPlanRequest, tenantID string) (*models.RecoveryPlan, error) {
	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	// Status is stored in memory; update only persists name to backup_policies
	plan, err := s.repo.UpdateRecoveryPlan(ctx, id, tenantID, updates)
	if err != nil {
		return nil, err
	}
	if req.Status != nil {
		plan.Status = *req.Status
	}
	return plan, nil
}

func (s *Service) DeleteRecoveryPlan(ctx context.Context, id string, tenantID string) (bool, error) {
	return s.repo.DeleteRecoveryPlan(ctx, id, tenantID)
}

// --- Verify Backup ---

func (s *Service) VerifyBackup(ctx context.Context, backupID string, tenantID string) (*models.BackupJob, error) {
	job, err := s.repo.VerifyBackup(ctx, backupID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrBackupNotFound
		}
		return nil, err
	}
	return job, nil
}

// --- Restore ---

func (s *Service) InitiateRestore(ctx context.Context, planID string, tenantID string) (*models.Restore, error) {
	// Validate that the plan exists
	_, err := s.repo.GetPlanByID(ctx, planID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrPlanNotFound
		}
		return nil, err
	}
	restore := &models.Restore{
		TenantID:    tenantID,
		BackupJobID: planID,
	}
	if err := s.repo.CreateRestore(ctx, restore); err != nil {
		return nil, err
	}
	return restore, nil
}

// --- Backups (Jobs) ---

func (s *Service) ListBackups(ctx context.Context, tenantID string, status *string) ([]models.BackupJob, int, error) {
	jobs, err := s.repo.ListJobs(ctx, tenantID, status)
	if err != nil {
		return nil, 0, err
	}
	if jobs == nil {
		jobs = []models.BackupJob{}
	}
	return jobs, len(jobs), nil
}

func (s *Service) GetBackup(ctx context.Context, id string, tenantID string) (*models.BackupJob, error) {
	job, err := s.repo.GetJobByID(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrBackupNotFound
		}
		return nil, err
	}
	return job, nil
}

func (s *Service) TriggerBackup(ctx context.Context, planID string, tenantID string) (*models.BackupJob, error) {
	// Validate the plan exists
	plan, err := s.repo.GetPlanByID(ctx, planID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrPlanNotFound
		}
		return nil, err
	}
	job := &models.BackupJob{
		TenantID: tenantID,
		Type:     "manual",
		Source:   &plan.Name,
	}
	if err := s.repo.CreateJob(ctx, job); err != nil {
		return nil, err
	}
	return s.repo.GetJobByID(ctx, job.ID, tenantID)
}

// --- Errors ---

var (
	ErrPlanNotFound         = errors.New("backup plan not found")
	ErrRecoveryPlanNotFound = errors.New("recovery plan not found")
	ErrBackupNotFound       = errors.New("backup not found")
)

func IsNotFound(err error) bool {
	return errors.Is(err, ErrPlanNotFound) || errors.Is(err, ErrRecoveryPlanNotFound) || errors.Is(err, ErrBackupNotFound)
}

// --- Helpers ---

func nowTimestamp() time.Time {
	return time.Now().UTC()
}

func newUUID() string {
	return uuid.New().String()
}
