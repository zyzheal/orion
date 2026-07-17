package service

import (
	"context"

	"orion/platform-svc-go/internal/audit/models"
)

// auditRepo is the repository interface used by the Service — enables
// dependency injection for unit testing without a real database.
type auditRepo interface {
	Create(ctx context.Context, tenantID string, req models.AuditLogCreateRequest) (*models.AuditLog, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.AuditLog, error)
	List(ctx context.Context, tenantID string, q models.AuditLogQuery) ([]models.AuditLog, int, error)
	VerifyChain(ctx context.Context, tenantID string) (int, bool, error)
	GetActions(ctx context.Context, tenantID string) ([]string, error)
	GetResourceTypes(ctx context.Context, tenantID string) ([]string, error)
	Export(ctx context.Context, tenantID string, q models.AuditLogQuery) ([]models.AuditLog, error)
}
