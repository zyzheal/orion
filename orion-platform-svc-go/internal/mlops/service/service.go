package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"

	"orion/platform-svc-go/internal/mlops/models"
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

// ==================== Core CRUD ====================

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

// ==================== Training / Evaluation / Deployment ====================

func (s *Service) Train(ctx context.Context, tenantID, id string) (map[string]interface{}, error) {
	return map[string]interface{}{"id": id, "status": "started"}, nil
}

func (s *Service) Evaluate(ctx context.Context, tenantID, id string) (map[string]interface{}, error) {
	return map[string]interface{}{"id": id, "status": "started"}, nil
}

func (s *Service) Deploy(ctx context.Context, tenantID, id string) (map[string]interface{}, error) {
	return map[string]interface{}{"id": id, "status": "deployed"}, nil
}

func (s *Service) Rollback(ctx context.Context, tenantID, id string) (map[string]interface{}, error) {
	return map[string]interface{}{"id": id, "status": "rolled_back"}, nil
}

func (s *Service) GetMetrics(ctx context.Context, tenantID, id string) (map[string]interface{}, error) {
	return map[string]interface{}{}, nil
}

// ==================== Experiments / Artifacts / Models ====================

func (s *Service) ListExperiments(ctx context.Context, tenantID, id string) ([]models.Record, error) {
	return []models.Record{}, nil
}

func (s *Service) ListArtifacts(ctx context.Context, tenantID, id string) ([]models.Record, error) {
	return []models.Record{}, nil
}

func (s *Service) ListModels(ctx context.Context, tenantID string) ([]models.Record, error) {
	return []models.Record{}, nil
}

func (s *Service) RegisterModel(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	return &models.Record{Name: req.Name, Status: "registered", TenantID: tenantID}, nil
}

func (s *Service) DeregisterModel(ctx context.Context, tenantID, id string) error {
	return nil
}

// ==================== Pipelines ====================

func (s *Service) ListPipelines(ctx context.Context, tenantID string) ([]models.Record, error) {
	return []models.Record{}, nil
}
