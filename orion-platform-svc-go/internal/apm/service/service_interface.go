package service

import (
	"context"
	"orion/platform-svc-go/internal/apm/models"
)

type ServiceInterface interface {
	GetSlowTraces(ctx context.Context, tenantID string, q *models.SlowTracesQuery) (*models.SlowTracesResponse, error)
	GetServiceTopology(ctx context.Context, tenantID string, q *models.TopologyQuery) (*models.TopologyResponse, error)
	GetSlowQueries(ctx context.Context, tenantID string, q *models.SlowQueriesQuery) (*models.SlowQueriesResponse, error)
	Create(ctx context.Context, req *models.CreateRequest, tenantID string) (*models.ApmEntry, error)
	Get(ctx context.Context, id, tenantID string) (*models.ApmEntry, error)
	List(ctx context.Context, tenantID string) ([]models.ApmEntry, error)
	Update(ctx context.Context, id, tenantID string, req *models.UpdateRequest) (*models.ApmEntry, error)
	Delete(ctx context.Context, id, tenantID string) (bool, error)
}

var _ ServiceInterface = (*Service)(nil)

