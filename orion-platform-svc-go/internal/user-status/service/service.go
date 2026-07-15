package service

import (
	"context"

	"orion/platform-svc-go/internal/user-status/models"
	"orion/platform-svc-go/internal/user-status/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetStatus(ctx context.Context, tenantID, userID string) (*models.UserStatus, error) {
	return s.repo.GetByUserID(ctx, tenantID, userID)
}

func (s *Service) SetStatus(ctx context.Context, tenantID, userID string, req models.SetStatusRequest) (*models.UserStatus, error) {
	_, err := s.repo.GetByUserID(ctx, tenantID, userID)
	if err != nil {
		return s.repo.Create(ctx, tenantID, userID, req.Status, req.Message)
	}
	return s.repo.Update(ctx, tenantID, userID, req.Status, req.Message)
}

func (s *Service) ListByStatus(ctx context.Context, tenantID string, status string) ([]models.UserStatus, error) {
	return s.repo.ListByStatus(ctx, tenantID, status)
}
