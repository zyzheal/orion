package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/deploy/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CompleteDeployment(ctx context.Context, tenantID, id, status string) error
	Create(ctx context.Context, m *models.Deployment) error
	CreateAuditEntry(ctx context.Context, deploymentID, action, userID, details string) error
	CreateReleaseNote(ctx context.Context, tenantID, deploymentID, content string) (*models.ReleaseNote, error)
	CreateRollback(ctx context.Context, tenantID, deploymentID, fromVersion, toVersion, reason string) (*models.Rollback, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.Deployment, error)
	GetReleaseNotes(ctx context.Context, deploymentID string) (*models.ReleaseNote, error)
	LatestByApp(ctx context.Context, tenantID, appName, environment string) (*models.Deployment, error)
	LinkGitCommit(ctx context.Context, deploymentID, commitSHA, branch string) error
	List(ctx context.Context, tenantID string, limit, offset int) ([]models.Deployment, error)
	ListAuditEntries(ctx context.Context, deploymentID string) ([]models.AuditEntry, error)
	ListChangelog(ctx context.Context, deploymentID string) ([]models.GitChangelogEntry, error)
	ListReleaseNotesByTenant(ctx context.Context, tenantID string) ([]models.ReleaseNote, error)
	ListRollbacks(ctx context.Context, tenantID, deploymentID string) ([]models.Rollback, error)
	Metrics(ctx context.Context, tenantID string) (*models.DeploymentMetrics, error)
	UpdateStatus(ctx context.Context, tenantID, id, status string) error
}

// Errors
var (
	ErrNotFound       = fmt.Errorf("deployment not found")
	ErrAlreadyRunning = fmt.Errorf("deployment is already running")
	ErrInvalidStatus  = fmt.Errorf("invalid deployment status")
)

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- Core deployment ---

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateDeploymentRequest) (*models.Deployment, error) {
	deploy := &models.Deployment{
		TenantID:    tenantID,
		AppName:     req.AppName,
		Environment: req.Environment,
		Status:      "pending",
		Version:     req.Version,
		CommitSHA:   req.CommitSHA,
	}
	if err := s.repo.Create(ctx, deploy); err != nil {
		return nil, err
	}
	return deploy, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Deployment, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, limit, offset int) ([]models.Deployment, error) {
	return s.repo.List(ctx, tenantID, limit, offset)
}

func (s *Service) Start(ctx context.Context, tenantID, id string) error {
	return s.repo.UpdateStatus(ctx, tenantID, id, "running")
}

func (s *Service) Complete(ctx context.Context, tenantID, id string, status string) error {
	if status != "succeeded" && status != "failed" {
		return ErrInvalidStatus
	}
	return s.repo.CompleteDeployment(ctx, tenantID, id, status)
}

func (s *Service) Cancel(ctx context.Context, tenantID, id string) error {
	return s.repo.UpdateStatus(ctx, tenantID, id, "cancelled")
}

func (s *Service) Metrics(ctx context.Context, tenantID string) (*models.DeploymentMetrics, error) {
	return s.repo.Metrics(ctx, tenantID)
}

// --- Rollback ---

func (s *Service) Rollback(ctx context.Context, tenantID, id string, targetVersion, reason string) (*models.Rollback, error) {
	deploy, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	return s.repo.CreateRollback(ctx, tenantID, id, deploy.Version, targetVersion, reason)
}

func (s *Service) GetRollbackHistory(ctx context.Context, tenantID, id string) ([]models.Rollback, error) {
	return s.repo.ListRollbacks(ctx, tenantID, id)
}

// --- Audit trail ---

func (s *Service) LogAudit(ctx context.Context, deploymentID, action, userID, details string) error {
	return s.repo.CreateAuditEntry(ctx, deploymentID, action, userID, details)
}

func (s *Service) GetAuditTrail(ctx context.Context, deploymentID string) ([]models.AuditEntry, error) {
	return s.repo.ListAuditEntries(ctx, deploymentID)
}

// --- Release notes ---

func (s *Service) GenerateReleaseNotes(ctx context.Context, tenantID, deploymentID, content string) (*models.ReleaseNote, error) {
	return s.repo.CreateReleaseNote(ctx, tenantID, deploymentID, content)
}

func (s *Service) GetReleaseNotes(ctx context.Context, deploymentID string) (*models.ReleaseNote, error) {
	return s.repo.GetReleaseNotes(ctx, deploymentID)
}

func (s *Service) GetReleaseNotesByTenant(ctx context.Context, tenantID string) ([]models.ReleaseNote, error) {
	return s.repo.ListReleaseNotesByTenant(ctx, tenantID)
}

// --- Git integration ---

func (s *Service) LinkGitCommit(ctx context.Context, deploymentID, commitSHA, branch string) error {
	return s.repo.LinkGitCommit(ctx, deploymentID, commitSHA, branch)
}

func (s *Service) GetDeploymentChangelog(ctx context.Context, deploymentID string) ([]models.GitChangelogEntry, error) {
	return s.repo.ListChangelog(ctx, deploymentID)
}

// --- Helpers ---

func (s *Service) GetLatest(ctx context.Context, tenantID, appName, environment string) (*models.Deployment, error) {
	return s.repo.LatestByApp(ctx, tenantID, appName, environment)
}
