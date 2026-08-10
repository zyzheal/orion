package service

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/integration-handler/models"
	"orion/platform-svc-go/internal/integration-handler/repository"

	"github.com/jmoiron/sqlx"
)

type Service struct {
	repo *repository.Repository
}

func NewService(db *sqlx.DB) *Service {
	return &Service{repo: repository.NewRepository(db)}
}

func (s *Service) CreateIntegration(ctx context.Context, tenantID string, req *models.CreateIntegrationRequest) (*models.Integration, error) {
	return s.repo.CreateIntegration(ctx, tenantID, req.Name, req.Type, req.HandlerType, req.Config)
}

func (s *Service) GetIntegration(ctx context.Context, tenantID, id string) (*models.Integration, error) {
	return s.repo.GetIntegrationByTenant(ctx, tenantID, id)
}

func (s *Service) ListIntegrations(ctx context.Context, tenantID string, intType string, offset, limit int) ([]models.Integration, error) {
	return s.repo.ListIntegrations(ctx, tenantID, intType, offset, limit)
}

func (s *Service) UpdateIntegration(ctx context.Context, tenantID, id string, req *models.UpdateIntegrationRequest) (*models.Integration, error) {
	return s.repo.UpdateIntegration(ctx, tenantID, id, req.Name, req.Type, req.HandlerType, req.Config, req.Status, req.Enabled)
}

func (s *Service) DeleteIntegration(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteIntegration(ctx, tenantID, id)
}

func (s *Service) CountIntegrations(ctx context.Context, tenantID string) (int, error) {
	return s.repo.CountIntegrations(ctx, tenantID)
}

func (s *Service) CreateTask(ctx context.Context, tenantID string, req *models.CreateTaskRequest) (*models.IntegrationTask, error) {
	return s.repo.CreateTask(ctx, tenantID, req.IntegrationID, req.Direction, req.Data)
}

func (s *Service) GetTask(ctx context.Context, tenantID, id string) (*models.IntegrationTask, error) {
	return s.repo.GetTaskByTenant(ctx, tenantID, id)
}

func (s *Service) ListTasks(ctx context.Context, tenantID, integrationID, status string, offset, limit int) ([]models.IntegrationTask, error) {
	return s.repo.ListTasksByIntegration(ctx, tenantID, integrationID, status, offset, limit)
}

func (s *Service) UpdateTaskStatus(ctx context.Context, tenantID, id string, status, errMsg, response string, durationMs int64) (*models.IntegrationTask, error) {
	now := time.Now().UTC()
	return s.repo.UpdateTaskStatus(ctx, tenantID, id, status, errMsg, response, durationMs, &now)
}

func (s *Service) DeleteTask(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteTask(ctx, tenantID, id)
}

func (s *Service) GetLogs(ctx context.Context, taskID string, offset, limit int) ([]models.IntegrationLog, error) {
	return s.repo.ListLogsByTask(ctx, taskID, offset, limit)
}

func (s *Service) CreateLog(ctx context.Context, taskID, level, message, details string) (*models.IntegrationLog, error) {
	return s.repo.CreateLog(ctx, taskID, level, message, details)
}
