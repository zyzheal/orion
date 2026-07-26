package service

import (
	"context"

	"orion/platform-svc-go/internal/bi-dashboard/models"
	"orion/go-common/pkg/otel"
	"go.uber.org/zap"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, entity *models.BiDashboard) error
	Delete(ctx context.Context, id, tenantID string) (bool, error)
	GetByID(ctx context.Context, id, tenantID string) (*models.BiDashboard, error)
	List(ctx context.Context, tenantID string) ([]models.BiDashboard, error)
	Update(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.BiDashboard, error)
}

type Service struct {
	repo   RepositoryInterface
	logger *zap.Logger
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{
		repo:   repo,
		logger: zap.NewNop(),
	}
}

func (s *Service) Create(ctx context.Context, req *models.CreateRequest, tenantID string) (*models.BiDashboard, error) {
	_, span := otel.Tracer("orion-bi-dashboard").Start(ctx, "Service.Create")
	defer span.End()
	entity := &models.BiDashboard{TenantID: tenantID, Name: req.Name}
	s.logger.Info("creating bi-dashboard", zap.String("tenant_id", tenantID), zap.String("name", req.Name))
	if err := s.repo.Create(ctx, entity); err != nil {
		s.logger.Error("create bi-dashboard failed", zap.Error(err))
		return nil, err
	}
	s.logger.Info("bi-dashboard created", zap.String("id", entity.ID))
	return entity, nil
}

func (s *Service) Get(ctx context.Context, id, tenantID string) (*models.BiDashboard, error) {
	_, span := otel.Tracer("orion-bi-dashboard").Start(ctx, "Service.Get")
	defer span.End()
	s.logger.Info("getting bi-dashboard", zap.String("id", id), zap.String("tenant_id", tenantID))
	return s.repo.GetByID(ctx, id, tenantID)
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.BiDashboard, error) {
	_, span := otel.Tracer("orion-bi-dashboard").Start(ctx, "Service.List")
	defer span.End()
	entities, err := s.repo.List(ctx, tenantID)
	if err != nil {
		s.logger.Error("list bi-dashboard failed", zap.Error(err))
		return nil, err
	}
	if entities == nil {
		entities = []models.BiDashboard{}
	}
	return entities, nil
}

func (s *Service) Update(ctx context.Context, id, tenantID string, req *models.UpdateRequest) (*models.BiDashboard, error) {
	_, span := otel.Tracer("orion-bi-dashboard").Start(ctx, "Service.Update")
	defer span.End()
	attrs := make(map[string]interface{})
	if req.Name != nil {
		attrs["name"] = *req.Name
	}
	s.logger.Info("updating bi-dashboard", zap.String("id", id), zap.Any("attrs", attrs))
	return s.repo.Update(ctx, id, tenantID, attrs)
}

func (s *Service) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	_, span := otel.Tracer("orion-bi-dashboard").Start(ctx, "Service.Delete")
	defer span.End()
	s.logger.Info("deleting bi-dashboard", zap.String("id", id))
	deleted, err := s.repo.Delete(ctx, id, tenantID)
	if err != nil {
		s.logger.Error("delete bi-dashboard failed", zap.Error(err))
		return false, err
	}
	return deleted, nil
}
