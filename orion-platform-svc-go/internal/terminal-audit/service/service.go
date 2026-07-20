package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"

	"orion/platform-svc-go/internal/terminal-audit/models"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	DeleteBatch(ctx context.Context, tenantID string, ids []string) (int, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.TerminalAuditLog, error)
	GetStats(ctx context.Context, tenantID string) (*models.AuditStats, error)
	List(ctx context.Context, tenantID string, q models.AuditQuery) ([]models.TerminalAuditLog, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) ListAudits(ctx context.Context, tenantID string, q models.AuditQuery) ([]models.TerminalAuditLog, error) {
	items, err := s.repo.List(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	if items == nil {
		items = []models.TerminalAuditLog{}
	}
	return items, nil
}

func (s *Service) GetAudit(ctx context.Context, tenantID, id string) (*models.TerminalAuditLog, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) DeleteBatch(ctx context.Context, tenantID string, ids []string) (int, error) {
	return s.repo.DeleteBatch(ctx, tenantID, ids)
}

func (s *Service) SearchAudits(ctx context.Context, tenantID string, q models.AuditQuery) ([]models.TerminalAuditLog, error) {
	return s.ListAudits(ctx, tenantID, q)
}

func (s *Service) GetStats(ctx context.Context, tenantID string) (*models.AuditStats, error) {
	return s.repo.GetStats(ctx, tenantID)
}
