package service

import (
	"context"
	"orion/platform-svc-go/internal/queue/models"
)

type ServiceInterface interface {
	EnqueueJob(ctx context.Context, tenantID, queueName string, req *models.EnqueueJobRequest) (*models.Job, error)
	DequeueJob(ctx context.Context, tenantID, queueName string, req *models.DequeueRequest) (*models.Job, error)
	CompleteJob(ctx context.Context, tenantID, jobID string, req *models.CompleteJobRequest) (*models.Job, error)
	Create(ctx context.Context, tenantID string, req models.CreateQueueRequest) (*models.Queue, error)
	Get(ctx context.Context, tenantID, id string) (*models.Queue, error)
	List(ctx context.Context, tenantID string) ([]models.Queue, error)
	Update(ctx context.Context, tenantID, id string, req models.UpdateQueueRequest) (*models.Queue, error)
	Delete(ctx context.Context, tenantID, id string) error
}

var _ ServiceInterface = (*Service)(nil)
