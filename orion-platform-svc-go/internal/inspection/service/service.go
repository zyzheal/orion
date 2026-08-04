package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/inspection/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error)
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Record, error)
	List(ctx context.Context, tenantID string) ([]models.Record, error)
	Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Record, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	return s.repo.Create(ctx, tenantID, req)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	return s.repo.Update(ctx, tenantID, id, req)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) RunInspection(ctx context.Context, tenantID, id string) (map[string]interface{}, error) {
	return map[string]interface{}{"status": "ok", "inspectionId": id}, nil
}

func (s *Service) GetResults(ctx context.Context, tenantID, id string) ([]models.Record, error) {
	return []models.Record{}, nil
}

func (s *Service) UpdateStatus(ctx context.Context, tenantID, id string, status string) (map[string]interface{}, error) {
	return map[string]interface{}{"status": "ok", "newStatus": status}, nil
}

func (s *Service) ListTemplates(ctx context.Context, tenantID string) ([]models.Record, error) {
	return []models.Record{}, nil
}

func (s *Service) GetStats(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	return map[string]interface{}{"total": 0, "passed": 0, "failed": 0, "warnings": 0}, nil
}

func (s *Service) GetHistory(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (s *Service) BatchCreate(ctx context.Context, tenantID string, items []models.CreateRequest) (map[string]interface{}, error) {
	fmt.Printf("BatchCreate: tenant=%s, items=%d\n", tenantID, len(items))
	return map[string]interface{}{"status": "ok", "created": len(items)}, nil
}
