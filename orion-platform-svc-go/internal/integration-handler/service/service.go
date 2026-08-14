package service

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/integration-handler/models"
	"orion/platform-svc-go/internal/integration-handler/repository"

	"github.com/jmoiron/sqlx"
)

// RepositoryInterface defines the repository methods used by the Service.
type RepositoryInterface interface {
	CreateIntegration(ctx context.Context, tenantID, name, intType, handlerType string, config map[string]string) (*models.Integration, error)
	GetIntegrationByTenant(ctx context.Context, tenantID, id string) (*models.Integration, error)
	ListIntegrations(ctx context.Context, tenantID, intType string, offset, limit int) ([]models.Integration, error)
	UpdateIntegration(ctx context.Context, tenantID, id string, name, intType, handlerType *string, config map[string]string, status *string, enabled *bool) (*models.Integration, error)
	DeleteIntegration(ctx context.Context, tenantID, id string) error
	CountIntegrations(ctx context.Context, tenantID string) (int, error)
	CreateTask(ctx context.Context, tenantID, integrationID, direction string, data map[string]interface{}) (*models.IntegrationTask, error)
	GetTaskByTenant(ctx context.Context, tenantID, id string) (*models.IntegrationTask, error)
	ListTasksByIntegration(ctx context.Context, tenantID, integrationID, status string, offset, limit int) ([]models.IntegrationTask, error)
	UpdateTaskStatus(ctx context.Context, tenantID, id string, status, errMsg, response string, durationMs int64, finishedAt *time.Time) (*models.IntegrationTask, error)
	DeleteTask(ctx context.Context, tenantID, id string) error
	ListLogsByTask(ctx context.Context, taskID string, offset, limit int) ([]models.IntegrationLog, error)
	CreateLog(ctx context.Context, taskID, level, message, details string) (*models.IntegrationLog, error)
}

// ensure compile-time check
var _ RepositoryInterface = (*repository.Repository)(nil)

type Service struct {
	repo RepositoryInterface
}

// NewService creates a new Service backed by the real PostgreSQL repository.
func NewService(db *sqlx.DB) *Service {
	return &Service{repo: repository.NewRepository(db)}
}

// NewServiceWithRepo creates a new Service with an injectable repository.
func NewServiceWithRepo(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
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
