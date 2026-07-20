package service

import (
	"context"
	"sync"
	"time"

	"orion/platform-svc-go/internal/cron/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, m *models.CronJob) error
	CreateExecution(ctx context.Context, m *models.CronJobExecution) error
	Delete(ctx context.Context, tenantID, id string) error
	Disable(ctx context.Context, tenantID, id string) error
	Enable(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.CronJob, error)
	GetExecutionByID(ctx context.Context, tenantID, executionID string) (*models.CronJobExecution, error)
	List(ctx context.Context, tenantID string, limit, offset int) ([]models.CronJob, error)
	ListExecutions(ctx context.Context, tenantID, jobID string, limit, offset int) ([]models.CronJobExecution, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	UpdatePartial(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
}

type Service struct {
	repo RepositoryInterface
	// In-memory scheduler state for running status / execution tracking.
	mu          sync.RWMutex
	running     map[string]*models.CronJob // jobID -> running job
	execHistory []models.CronJobExecution
	enabled     bool
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{
		repo:        repo,
		running:     make(map[string]*models.CronJob),
		execHistory: make([]models.CronJobExecution, 0),
		enabled:     false,
	}
}

// CRUD methods (persistent)

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateCronJobRequest) (*models.CronJob, error) {
	m := &models.CronJob{
		TenantID:    tenantID,
		Name:        req.Name,
		Schedule:    req.Schedule,
		Task:        req.Task,
		Description: req.Description,
	}
	if req.Enabled != nil {
		m.Enabled = *req.Enabled
	}
	if err := s.repo.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.CronJob, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, limit, offset int) ([]models.CronJob, error) {
	return s.repo.List(ctx, tenantID, limit, offset)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.UpdateCronJobRequest) (*models.CronJob, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Schedule != nil {
		updates["schedule"] = *req.Schedule
	}
	if req.Task != nil {
		updates["task"] = *req.Task
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
		if *req.Enabled {
			updates["status"] = "active"
		} else {
			updates["status"] = "disabled"
		}
	}
	if err := s.repo.Update(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) UpdatePartial(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.CronJob, error) {
	updates["updated_at"] = time.Now().UTC()
	if err := s.repo.UpdatePartial(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// Scheduler lifecycle methods (in-memory state)

func (s *Service) AddJob(ctx context.Context, tenantID string, req models.CreateCronJobRequest) (*models.CronJob, error) {
	return s.Create(ctx, tenantID, req)
}

func (s *Service) GetJob(ctx context.Context, tenantID, id string) (*models.CronJob, error) {
	return s.Get(ctx, tenantID, id)
}

func (s *Service) GetJobs(ctx context.Context, tenantID string) ([]models.CronJob, error) {
	return s.List(ctx, tenantID, 100, 0)
}

func (s *Service) RemoveJob(ctx context.Context, tenantID, id string) error {
	s.mu.Lock()
	delete(s.running, id)
	s.mu.Unlock()
	return s.Delete(ctx, tenantID, id)
}

func (s *Service) EnableJob(ctx context.Context, tenantID, id string) error {
	return s.repo.Enable(ctx, tenantID, id)
}

func (s *Service) DisableJob(ctx context.Context, tenantID, id string) error {
	return s.repo.Disable(ctx, tenantID, id)
}

func (s *Service) ExecuteJob(ctx context.Context, tenantID, id string) (*models.CronJobExecution, error) {
	execution := &models.CronJobExecution{
		JobID:     id,
		TenantID:  tenantID,
		Status:    "completed",
		Output:    "Executed cron job: " + id,
		StartedAt: time.Now().UTC(),
	}
	s.mu.Lock()
	s.execHistory = append(s.execHistory, *execution)
	s.mu.Unlock()
	if err := s.repo.CreateExecution(ctx, execution); err != nil {
		return nil, err
	}
	return execution, nil
}

func (s *Service) GetExecutionHistory(ctx context.Context, tenantID, jobID string) ([]models.CronJobExecution, error) {
	return s.repo.ListExecutions(ctx, tenantID, jobID, 100, 0)
}

func (s *Service) GetExecutionByID(ctx context.Context, tenantID, executionID string) (*models.CronJobExecution, error) {
	return s.repo.GetExecutionByID(ctx, tenantID, executionID)
}

func (s *Service) GetRunningJobs() []models.CronJob {
	s.mu.RLock()
	defer s.mu.RUnlock()
	jobs := make([]models.CronJob, 0, len(s.running))
	for _, j := range s.running {
		jobs = append(jobs, *j)
	}
	return jobs
}

func (s *Service) GetStatus(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	jobs, _ := s.GetJobs(ctx, tenantID)
	s.mu.RLock()
	running := len(s.running)
	enabled := s.enabled
	s.mu.RUnlock()
	return map[string]interface{}{
		"totalJobs":   len(jobs),
		"runningJobs": running,
		"enabled":     enabled,
	}, nil
}

func (s *Service) Start() {
	s.mu.Lock()
	s.enabled = true
	s.mu.Unlock()
}

func (s *Service) Stop() {
	s.mu.Lock()
	s.enabled = false
	s.mu.Unlock()
}
