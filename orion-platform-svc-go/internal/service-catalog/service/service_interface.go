package service

import (
	"context"
	"orion/platform-svc-go/internal/service-catalog/models"
)

type ServiceInterface interface {
	UpdateRequestStatus(ctx context.Context, tenantID, id string, req *models.StatusUpdateRequest) (*models.ServiceRequest, error)
	GetRequestTimeline(ctx context.Context, tenantID, id string) ([]models.TimelineEntry, error)
	GetSLABreaches(ctx context.Context, tenantID string, q *models.SLABreachesQuery) (*models.SLABreachesResponse, error)
	Create(ctx context.Context, tenantID string, req models.CreateServiceCatalogRequest) (*models.ServiceCatalog, error)
	Get(ctx context.Context, tenantID, id string) (*models.ServiceCatalog, error)
	List(ctx context.Context, tenantID string) ([]models.ServiceCatalog, error)
	Update(ctx context.Context, tenantID, id string, req models.UpdateServiceCatalogRequest) (*models.ServiceCatalog, error)
	Delete(ctx context.Context, tenantID, id string) error
}

var _ ServiceInterface = (*Service)(nil)
