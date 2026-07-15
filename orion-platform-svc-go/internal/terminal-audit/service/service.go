package service

import (
	"context"
	"errors"

	"orion/platform-svc-go/internal/terminal-audit/models"
	"orion/platform-svc-go/internal/terminal-audit/repository"
)

var ErrNotFound = errors.New("terminal audit not found")

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
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
