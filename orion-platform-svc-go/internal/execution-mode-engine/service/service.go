package service

import (
	"context"
	"orion/platform-svc-go/internal/execution-mode-engine/models"
	"orion/platform-svc-go/internal/execution-mode-engine/repository"
	"orion/go-common/pkg/otel"
	"go.uber.org/zap"
)

type Service struct {
	repo   repository.ExecutionModeRepository
	logger *zap.Logger
}

func NewService(repo repository.ExecutionModeRepository) *Service {
	return &Service{repo: repo, logger: zap.NewNop()}
}

func (s *Service) Create(ctx context.Context, config *models.ExecutionModeConfig) error {
	_, span := otel.Tracer("orion-execution-mode-engine").Start(ctx, "Service.Create")
	defer span.End()
	s.logger.Info("creating execution mode", zap.String("name", config.Name), zap.String("mode", string(config.Mode)))
	return s.repo.Create(ctx, config)
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.ExecutionModeConfig, error) {
	_, span := otel.Tracer("orion-execution-mode-engine").Start(ctx, "Service.Get")
	defer span.End()
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.ExecutionModeConfig, error) {
	_, span := otel.Tracer("orion-execution-mode-engine").Start(ctx, "Service.List")
	defer span.End()
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Update(ctx context.Context, config *models.ExecutionModeConfig) error {
	_, span := otel.Tracer("orion-execution-mode-engine").Start(ctx, "Service.Update")
	defer span.End()
	s.logger.Info("updating execution mode", zap.String("id", config.ID))
	return s.repo.Update(ctx, config)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	_, span := otel.Tracer("orion-execution-mode-engine").Start(ctx, "Service.Delete")
	defer span.End()
	s.logger.Info("deleting execution mode", zap.String("id", id))
	return s.repo.Delete(ctx, tenantID, id)
}
