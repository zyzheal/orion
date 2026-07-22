package service

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/ai/models"

	"github.com/google/uuid"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, m *models.AIModel) error
	GetByID(ctx context.Context, tenantID, id string) (*models.AIModel, error)
	List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.AIModel, error)
	Update(ctx context.Context, m *models.AIModel) error
	Delete(ctx context.Context, tenantID, id string) error
}

// Service coordinates business logic for AI model management.
type Service struct {
	repo RepositoryInterface
}

// NewService creates a new Service instance.
func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// Create creates a new AI model for the tenant.
func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateAIModelRequest) (*models.AIModel, error) {
	if req.Name == "" || req.Type == "" {
		return nil, fmt.Errorf("name and type are required")
	}
	now := time.Now()
	m := &models.AIModel{
		ID:        uuid.New().String(),
		Name:      req.Name,
		Type:      req.Type,
		TenantID:  tenantID,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.repo.Create(ctx, m); err != nil {
		return nil, fmt.Errorf("failed to create AI model: %w", err)
	}
	return m, nil
}

// GetByID retrieves an AI model by id (tenant-scoped).
func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.AIModel, error) {
	m, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get AI model: %w", err)
	}
	return m, nil
}

// List retrieves AI models for the tenant.
func (s *Service) List(ctx context.Context, tenantID string, filter *models.ListFilter) ([]models.AIModel, error) {
	items, err := s.repo.List(ctx, tenantID, filter, 0, 100)
	if err != nil {
		return nil, fmt.Errorf("failed to list AI models: %w", err)
	}
	return items, nil
}

// Delete removes an AI model by id (tenant-scoped).
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	if err := s.repo.Delete(ctx, tenantID, id); err != nil {
		return fmt.Errorf("failed to delete AI model: %w", err)
	}
	return nil
}
