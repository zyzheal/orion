package service

import (
	"context"
	"errors"

	"orion/platform-svc-go/internal/queue/models"
	"orion/platform-svc-go/internal/queue/repository"
)

// Business methods for job enqueue/dequeue/complete operations.
// These operate on the queue_jobs table via JobRepository.

// EnqueueJob inserts a new job into the given queue for the tenant.
func (s *Service) EnqueueJob(ctx context.Context, tenantID, queueName string, req *models.EnqueueJobRequest) (*models.Job, error) {
	if req.Type == "" {
		return nil, errors.New("job type is required")
	}

	job := &models.Job{
		TenantID:  tenantID,
		QueueName: queueName,
		Type:      req.Type,
		Payload:   req.Payload,
		Priority:  req.Priority,
	}

	if err := s.jobs.EnqueueJob(ctx, job); err != nil {
		return nil, err
	}
	return job, nil
}

// DequeueJob picks the next pending job from the given queue, marks it executing, and returns it.
func (s *Service) DequeueJob(ctx context.Context, tenantID, queueName string, req *models.DequeueRequest) (*models.Job, error) {
	if queueName == "" {
		return nil, errors.New("queue name is required")
	}

	job, err := s.jobs.DequeueJob(ctx, tenantID, queueName)
	if err != nil {
		if errors.Is(err, repository.ErrJobNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return job, nil
}

// CompleteJob marks a job as completed, optionally storing a result payload.
func (s *Service) CompleteJob(ctx context.Context, tenantID, jobID string, req *models.CompleteJobRequest) (*models.Job, error) {
	if jobID == "" {
		return nil, errors.New("job ID is required")
	}

	job, err := s.jobs.CompleteJob(ctx, tenantID, jobID, req.Result)
	if err != nil {
		if errors.Is(err, repository.ErrJobNotFound) {
			return nil, errors.New("job not found")
		}
		return nil, err
	}
	return job, nil
}
