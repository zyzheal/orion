package service

import (
	"context"
	"errors"
	"orion/scheduler-svc-go/internal/models"
	"orion/scheduler-svc-go/internal/repository"
)

var (
	ErrJobNotFound   = errors.New("job not found")
	ErrInvalidStatus = errors.New("invalid status transition")
)

type SchedulerService struct {
	repo *repository.SchedulerRepository
}

func NewSchedulerService(repo *repository.SchedulerRepository) *SchedulerService {
	return &SchedulerService{repo: repo}
}

func (s *SchedulerService) CreateJob(ctx context.Context, j *models.Job) error {
	if j.Status == "" {
		j.Status = models.JobActive
	}
	return s.repo.CreateJob(ctx, j)
}

func (s *SchedulerService) GetJobByID(ctx context.Context, tenantID, id string) (*models.Job, error) {
	return s.repo.GetJobByID(ctx, tenantID, id)
}

func (s *SchedulerService) ListJobs(ctx context.Context, tenantID string, offset, limit int) ([]models.Job, error) {
	return s.repo.ListJobs(ctx, tenantID, offset, limit)
}

func (s *SchedulerService) PauseJob(ctx context.Context, tenantID, id string) error {
	job, err := s.repo.GetJobByID(ctx, tenantID, id)
	if err != nil {
		return ErrJobNotFound
	}
	if job.Status != models.JobActive {
		return ErrInvalidStatus
	}
	return s.repo.UpdateJobStatus(ctx, id, models.JobPaused)
}

func (s *SchedulerService) ResumeJob(ctx context.Context, tenantID, id string) error {
	job, err := s.repo.GetJobByID(ctx, tenantID, id)
	if err != nil {
		return ErrJobNotFound
	}
	if job.Status != models.JobPaused {
		return ErrInvalidStatus
	}
	return s.repo.UpdateJobStatus(ctx, id, models.JobActive)
}

func (s *SchedulerService) DisableJob(ctx context.Context, tenantID, id string) error {
	job, err := s.repo.GetJobByID(ctx, tenantID, id)
	if err != nil {
		return ErrJobNotFound
	}
	if job.Status == models.JobDisabled {
		return ErrInvalidStatus
	}
	return s.repo.UpdateJobStatus(ctx, id, models.JobDisabled)
}

func (s *SchedulerService) RecordRun(ctx context.Context, jobID, status string, errStr *string, durationMs int64) error {
	jr := &models.JobRun{
		JobID:  jobID,
		Status: status,
	}
	if err := s.repo.CreateJobRun(ctx, jr); err != nil {
		return err
	}
	if err := s.repo.UpdateJobRun(ctx, jr.ID, status, errStr, durationMs); err != nil {
		return err
	}
	return s.repo.UpdateJobRunInfo(ctx, jobID)
}

func (s *SchedulerService) GetJobRuns(ctx context.Context, jobID string, limit int) ([]models.JobRun, error) {
	return s.repo.GetJobRuns(ctx, jobID, limit)
}
