package service

import (
	"context"

	"orion/platform-svc-go/internal/eventbus/models"
)

type ServiceInterface interface {
	Connect(ctx context.Context, tenantID string, req *models.ConnectRequest) (*models.ConnectResult, error)
	GetStatus(ctx context.Context, tenantID string) (*models.BusStatus, error)
	ListSubscriptions(ctx context.Context, tenantID string) ([]models.Subscription, error)
	GetDLQ(ctx context.Context, tenantID string, q *models.DLQQuery) (*models.DLQResponse, error)
	GetStats(ctx context.Context, tenantID string) (*models.BusStats, error)
	Publish(ctx context.Context, tenantID string, userID string, req *models.PublishRequest) (*models.Event, error)
	List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.Event, error)
	Count(ctx context.Context, tenantID string) (int, error)
}

var _ ServiceInterface = (*Service)(nil)
