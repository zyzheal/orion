package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"

	"orion/platform-svc-go/internal/user-status/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID, userID string, status string, message string) (*models.UserStatus, error)
	GetByUserID(ctx context.Context, tenantID, userID string) (*models.UserStatus, error)
	ListByStatus(ctx context.Context, tenantID string, status string) ([]models.UserStatus, error)
	Update(ctx context.Context, tenantID, userID string, status string, message string) (*models.UserStatus, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
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
