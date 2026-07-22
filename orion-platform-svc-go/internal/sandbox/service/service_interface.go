// Package service provides the sandbox service interface.
package service

import (
	"context"
	"orion/platform-svc-go/internal/sandbox/models"
)

// ServiceInterface defines the sandbox service contract.
type ServiceInterface interface {
	CreateJob(ctx context.Context, tenantID string, req models.CreateSandboxJobRequest) (*models.SandboxJob, error)
	GetJob(ctx context.Context, tenantID, id string) (*models.SandboxJob, error)
	ListJobs(ctx context.Context, tenantID string, status string) ([]models.SandboxJob, error)
	DeleteJob(ctx context.Context, tenantID, id string) error
	Execute(ctx context.Context, tenantID, jobID string) (*models.SandboxJob, error)
}
