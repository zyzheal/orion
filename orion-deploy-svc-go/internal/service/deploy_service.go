package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"orion-deploy-svc-go/internal/models"
	"orion-deploy-svc-go/internal/repository"
	"orion/go-common/pkg/otel"
)

// DeployService implements deployment business logic: deploy, rollback,
// cancel, metrics, and status tracking.
type DeployService struct {
	deployRepo    *repository.DeploymentRepository
	auditRepo     *repository.AuditRepository
	rollbackRepo  *repository.RollbackRepository
	gitRepo       *repository.GitRepository
	releaseRepo   *repository.ReleaseNotesRepository
}

func NewDeployService(
	deployRepo *repository.DeploymentRepository,
	auditRepo *repository.AuditRepository,
	rollbackRepo *repository.RollbackRepository,
	gitRepo *repository.GitRepository,
	releaseRepo *repository.ReleaseNotesRepository,
) *DeployService {
	return &DeployService{
		deployRepo:  deployRepo,
		auditRepo:   auditRepo,
		rollbackRepo: rollbackRepo,
		gitRepo:     gitRepo,
		releaseRepo: releaseRepo,
	}
}

// Deploy creates a new deployment record and transitions it through
// the lifecycle (running -> success/failed). This maps to the Node.js
// SmartDeployService.deploy endpoint.
func (s *DeployService) Deploy(ctx context.Context, tenantID string, req *models.DeployRequest, actor string) (*models.Deployment, error) {
	_, span := otel.Tracer("orion-deploy-svc").Start(ctx, "DeployService.Deploy")
	defer span.End()

	if req.AppName == "" || req.Environment == "" {
		return nil, fmt.Errorf("app_name and environment are required")
	}

	// Determine status and version
	status := "running"
	version := req.Version
	if version == "" {
		version = fmt.Sprintf("v%s", uuid.New().String()[:8])
	}

	now := time.Now().UTC()
	metadata := models.JSONB{
		"description": req.Description,
		"strategy":    req.Strategy,
	}

	d := &models.Deployment{
		ID:         uuid.New().String(),
		AppName:    req.AppName,
		Environment: req.Environment,
		Status:     status,
		Version:    version,
		Commit:     req.Commit,
		CreatedBy:  actor,
		Strategy:   req.Strategy,
		RollbackTo: req.RollbackTo,
		Metadata:   metadata,
		StartedAt:  now,
	}

	if err := s.deployRepo.Create(ctx, tenantID, d); err != nil {
		return nil, fmt.Errorf("failed to create deployment: %w", err)
	}

	// Simulate deployment completion (in production this would be async via worker)
	completedAt := now.Add(2 * time.Second)
	if err := s.deployRepo.UpdateStatus(ctx, tenantID, d.ID, "success", &completedAt); err != nil {
		// Log warning but deployment was already created
		d.Status = "success"
		d.CompletedAt = &completedAt
		return d, nil
	}

	d.Status = "success"
	d.CompletedAt = &completedAt

	// Audit trail
	_ = s.auditRepo.Create(ctx, tenantID, &models.AuditEvent{
		ID:           uuid.New().String(),
		DeploymentID: d.ID,
		Action:       "deploy",
		Actor:        actor,
		Detail:       models.JSONB{"app_name": req.AppName, "environment": req.Environment, "version": version},
	})

	return d, nil
}

// GetStatus returns the current deployment status by ID.
func (s *DeployService) GetStatus(ctx context.Context, tenantID, id string) (*models.Deployment, error) {
	d, err := s.deployRepo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("deployment not found")
	}
	return d, nil
}

// GetHistory returns a paginated list of deployments (deployment history).
func (s *DeployService) GetHistory(ctx context.Context, tenantID string, q models.ListDeployQuery) ([]models.Deployment, int, error) {
	if q.PageSize <= 0 {
		q.PageSize = 20
	}
	items, total, err := s.deployRepo.ListByTenant(ctx, tenantID, q)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list deployments: %w", err)
	}
	return items, total, nil
}

// GetLatest returns the most recent deployment for an app/environment pair.
func (s *DeployService) GetLatest(ctx context.Context, tenantID, appName, environment string) (*models.Deployment, error) {
	d, err := s.deployRepo.GetLatestByAppEnv(ctx, tenantID, appName, environment)
	if err != nil {
		return nil, fmt.Errorf("no deployments found for %s in %s", appName, environment)
	}
	return d, nil
}

// GetMetrics returns aggregate deployment metrics for a tenant.
func (s *DeployService) GetMetrics(ctx context.Context, tenantID string) (*models.DeployMetrics, error) {
	m, err := s.deployRepo.Metrics(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to compute metrics: %w", err)
	}
	return m, nil
}

// Rollback initiates a rollback of a deployment to a previous version.
func (s *DeployService) Rollback(ctx context.Context, tenantID, id, reason, actor string) (*models.Deployment, error) {
	_, span := otel.Tracer("orion-deploy-svc").Start(ctx, "DeployService.Rollback")
	defer span.End()

	// Verify the original deployment exists
	orig, err := s.deployRepo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("deployment not found")
	}

	rollbackID := uuid.New().String()
	rb := &models.RollbackRecord{
		ID:             rollbackID,
		DeploymentID:   id,
		RollbackFromID: id,
		RollbackToID:   orig.RollbackTo,
		Reason:         reason,
		Status:         "running",
		CreatedBy:      actor,
	}

	if err := s.rollbackRepo.Create(ctx, tenantID, rb); err != nil {
		return nil, fmt.Errorf("failed to create rollback record: %w", err)
	}

	// Create a new deployment record for the rollback
	rollbackDeploy := &models.Deployment{
		ID:          uuid.New().String(),
		AppName:     orig.AppName,
		Environment: orig.Environment,
		Status:      "success",
		Version:     fmt.Sprintf("rollback-%s", orig.Version),
		Commit:      orig.Commit,
		CreatedBy:   actor,
		Strategy:    "rollback",
		RollbackTo:  orig.ID,
		Metadata:    models.JSONB{"rollback_of": id, "reason": reason},
		StartedAt:   time.Now().UTC(),
	}

	if err := s.deployRepo.Create(ctx, tenantID, rollbackDeploy); err != nil {
		return nil, fmt.Errorf("failed to create rollback deployment: %w", err)
	}

	completedAt := time.Now().UTC()
	_ = s.rollbackRepo.UpdateStatus(ctx, tenantID, rollbackID, "success", &completedAt)

	// Audit
	_ = s.auditRepo.Create(ctx, tenantID, &models.AuditEvent{
		ID:           uuid.New().String(),
		DeploymentID: id,
		Action:       "rollback",
		Actor:        actor,
		Detail:       models.JSONB{"rollback_id": rollbackID, "reason": reason},
	})

	return rollbackDeploy, nil
}

// GetRollbackHistory returns all rollback records for a deployment.
func (s *DeployService) GetRollbackHistory(ctx context.Context, tenantID, id string) ([]models.RollbackRecord, error) {
	records, err := s.rollbackRepo.GetByDeployment(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get rollback history: %w", err)
	}
	return records, nil
}

// Cancel cancels a running deployment.
func (s *DeployService) Cancel(ctx context.Context, tenantID, id, actor string) error {
	_, span := otel.Tracer("orion-deploy-svc").Start(ctx, "DeployService.Cancel")
	defer span.End()

	_, err := s.deployRepo.GetByID(ctx, tenantID, id)
	if err != nil {
		return fmt.Errorf("deployment not found")
	}

	completedAt := time.Now().UTC()
	if err := s.deployRepo.UpdateStatus(ctx, tenantID, id, "cancelled", &completedAt); err != nil {
		return fmt.Errorf("failed to cancel deployment: %w", err)
	}

	_ = s.auditRepo.Create(ctx, tenantID, &models.AuditEvent{
		ID:           uuid.New().String(),
		DeploymentID: id,
		Action:       "cancel",
		Actor:        actor,
	})

	return nil
}

// UpdateStatus updates a deployment's status.
func (s *DeployService) UpdateStatus(ctx context.Context, tenantID, id, status string, _ string) (*models.Deployment, error) {
	completedAt := time.Now().UTC()
	if err := s.deployRepo.UpdateStatus(ctx, tenantID, id, status, &completedAt); err != nil {
		return nil, fmt.Errorf("failed to update status: %w", err)
	}
	return s.GetStatus(ctx, tenantID, id)
}

// GetAuditTrail returns the audit trail for a deployment.
func (s *DeployService) GetAuditTrail(ctx context.Context, tenantID, id string) ([]models.AuditEvent, error) {
	events, err := s.auditRepo.GetByDeployment(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get audit trail: %w", err)
	}
	return events, nil
}
