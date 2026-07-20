package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/ai-review/models"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Count(ctx context.Context, tenantID string, q models.ListReviewsQuery) (int, error)
	Create(ctx context.Context, m *models.ReviewRequest) error
	GetByID(ctx context.Context, tenantID, id string) (*models.ReviewRequest, error)
	List(ctx context.Context, tenantID string, q models.ListReviewsQuery) ([]models.ReviewRequest, error)
	UpdateStatus(ctx context.Context, tenantID, id string, status string) error
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateReviewRequest) (*models.ReviewRequest, error) {
	review := &models.ReviewRequest{
		TenantID:  tenantID,
		Content:   req.Content,
		Status:    "pending",
		CreatedBy: req.CreatedBy,
	}
	if err := s.repo.Create(ctx, review); err != nil {
		return nil, err
	}
	return review, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.ReviewRequest, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, q models.ListReviewsQuery) (*models.ReviewListResponse, error) {
	reviews, err := s.repo.List(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	total, err := s.repo.Count(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	return &models.ReviewListResponse{Reviews: reviews, Total: total}, nil
}

func (s *Service) Approve(ctx context.Context, tenantID, id string) (*models.ReviewRequest, error) {
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("review not found: %w", sentinel.NotFound)
	}
	if err := s.repo.UpdateStatus(ctx, tenantID, id, "approved"); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Reject(ctx context.Context, tenantID, id string) (*models.ReviewRequest, error) {
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("review not found: %w", sentinel.NotFound)
	}
	if err := s.repo.UpdateStatus(ctx, tenantID, id, "rejected"); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}
