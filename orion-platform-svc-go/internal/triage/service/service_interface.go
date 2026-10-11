package service

import (
	"context"

	"orion/platform-svc-go/internal/triage/models"
)

// ServiceInterface 定义 Triage 服务层契约。
type ServiceInterface interface {
	Overview(ctx context.Context, tenantID, userID string, req *models.OverviewRequest) (*models.MyOverview, error)
	ListAlerts(ctx context.Context, tenantID string, req *models.SubsetRequest) (*models.SubsetResponse, error)
	ListTickets(ctx context.Context, tenantID string, req *models.SubsetRequest) (*models.SubsetResponse, error)
	Acknowledge(ctx context.Context, req *models.AcknowledgeRequest) error
	Assign(ctx context.Context, req *models.AssignRequest) error
	Handoff(ctx context.Context, req *models.HandoffRequest) (*models.HandoffResponse, error)
}
