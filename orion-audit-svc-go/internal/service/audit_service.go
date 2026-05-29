package service

import (
	"context"
	"orion/audit-svc-go/internal/models"
	"orion/audit-svc-go/internal/repository"
	"github.com/google/uuid"
)

type Service struct { repo *repository.Repository }
func NewService(repo *repository.Repository) *Service { return &Service{repo: repo} }

func (s *Service) CreateLog(ctx context.Context, tenantID string, req *models.CreateAuditRequest) (*models.AuditLog, error) {
	a := &models.AuditLog{
		ID: uuid.New().String(), TenantID: tenantID, Action: req.Action,
		ResourceType: req.ResourceType, ResourceID: req.ResourceID,
		ActorID: req.ActorID, ActorName: req.ActorName,
		Details: models.JSONB(req.Details), IPAddress: req.IPAddress,
	}
	return a, s.repo.Create(ctx, a)
}

func (s *Service) ListLogs(ctx context.Context, tenantID string, offset, limit int) ([]models.AuditLog, error) {
	return s.repo.List(ctx, tenantID, offset, limit)
}
