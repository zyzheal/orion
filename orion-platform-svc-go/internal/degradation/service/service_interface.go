package service

import (
	"context"
	"orion/platform-svc-go/internal/degradation/models"
)

type ServiceInterface interface {
	Create(ctx context.Context, tenantID string, req *models.CreateDegradationRequest) (*models.Degradation, error)
	Get(ctx context.Context, tenantID, id string) (*models.Degradation, error)
	List(ctx context.Context, tenantID string) ([]models.Degradation, error)
	Update(ctx context.Context, tenantID, id string, req *models.UpdateDegradationRequest) (*models.Degradation, error)
	Delete(ctx context.Context, tenantID, id string) error
	Evaluate(ctx context.Context, tenantID string, req *models.EvaluateRequest) (*models.EvaluateResponse, error)
	TriggerDegradation(ctx context.Context, tenantID string, req *models.TriggerRequest) (*models.DegradationStatus, error)
	GetStatus(ctx context.Context, tenantID, policyID string) (*models.DegradationStatus, error)
	Resolve(ctx context.Context, tenantID, policyID string, req *models.ResolveRequest) (*models.DegradationStatus, error)
}

var _ ServiceInterface = (*Service)(nil)
