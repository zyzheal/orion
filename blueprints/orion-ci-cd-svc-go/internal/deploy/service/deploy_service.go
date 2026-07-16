package service

import (
	"context"
	"errors"
	"fmt"

	"orion/ci-cd-svc-go/internal/deploy/models"
	"orion/go-common/pkg/otel"
	"orion/ci-cd-svc-go/internal/deploy/repository"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.uber.org/zap"
)

var (
	ErrDeploymentNotFound = errors.New("deployment not found")
	ErrInvalidStatus      = errors.New("invalid status transition")
	ErrNoRollbackTarget   = errors.New("no previous deployment found for rollback")
)

type DeployService struct {
	repo   *repository.DeploymentRepository
	logger *zap.Logger
}

func NewDeployService(repo *repository.DeploymentRepository, logger *zap.Logger) *DeployService {
	return &DeployService{repo: repo, logger: logger}
}

// ==================== CRUD ====================

// Create creates a new deployment in pending state.
func (s *DeployService) Create(ctx context.Context, d *models.Deployment) error {
	ctx, span := otel.Tracer("orion-deploy-svc").Start(ctx, "DeployService.Create")
	defer span.End()

	if d.Status == "" {
		d.Status = "pending"
	}
	if d.Strategy == "" {
		d.Strategy = "rolling"
	}

	if err := s.repo.Create(ctx, d); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	// Log creation event
	_ = s.logEvent(ctx, d.ID, "created", "Deployment created", &d.DeployedBy)

	span.SetAttributes(attribute.String("deployment.id", d.ID))
	return nil
}

// GetByID retrieves a deployment by ID.
func (s *DeployService) GetByID(ctx context.Context, tenantID, id string) (*models.Deployment, error) {
	ctx, span := otel.Tracer("orion-deploy-svc").Start(ctx, "DeployService.GetByID")
	defer span.End()

	dep, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, ErrDeploymentNotFound
	}
	return dep, nil
}

// List returns paginated deployments.
func (s *DeployService) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Deployment, error) {
	ctx, span := otel.Tracer("orion-deploy-svc").Start(ctx, "DeployService.List")
	defer span.End()

	return s.repo.List(ctx, tenantID, offset, limit)
}

// ListByFilter returns filtered, paginated deployments.
func (s *DeployService) ListByFilter(ctx context.Context, tenantID, environment, status string, offset, limit int) ([]models.Deployment, error) {
	ctx, span := otel.Tracer("orion-deploy-svc").Start(ctx, "DeployService.ListByFilter")
	defer span.End()

	return s.repo.ListByFilter(ctx, tenantID, environment, status, offset, limit)
}

// Update persists changes to a deployment.
func (s *DeployService) Update(ctx context.Context, d *models.Deployment) error {
	ctx, span := otel.Tracer("orion-deploy-svc").Start(ctx, "DeployService.Update")
	defer span.End()

	return s.repo.Update(ctx, d)
}

// Delete removes a deployment.
func (s *DeployService) Delete(ctx context.Context, tenantID, id string) error {
	ctx, span := otel.Tracer("orion-deploy-svc").Start(ctx, "DeployService.Delete")
	defer span.End()

	return s.repo.Delete(ctx, tenantID, id)
}

// Count returns total deployments for a tenant.
func (s *DeployService) Count(ctx context.Context, tenantID string) (int, error) {
	ctx, span := otel.Tracer("orion-deploy-svc").Start(ctx, "DeployService.Count")
	defer span.End()

	return s.repo.Count(ctx, tenantID)
}

// ==================== Status Transitions ====================

// StartDeployment transitions from pending to deploying.
func (s *DeployService) StartDeployment(ctx context.Context, tenantID, id string) (*models.Deployment, error) {
	ctx, span := otel.Tracer("orion-deploy-svc").Start(ctx, "DeployService.StartDeployment")
	defer span.End()

	dep, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		span.RecordError(err)
		return nil, ErrDeploymentNotFound
	}

	if dep.Status != "pending" {
		err := fmt.Errorf("%w: current status is %s, expected pending", ErrInvalidStatus, dep.Status)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}

	updated, err := s.repo.StartDeployment(ctx, tenantID, id)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, fmt.Errorf("failed to start deployment: %w", err)
	}

	_ = s.logEvent(ctx, id, "started", "Deployment started", &tenantID)

	span.SetAttributes(attribute.String("deployment.id", id))
	return updated, nil
}

// CompleteDeployment transitions to a terminal state (success/failed).
func (s *DeployService) CompleteDeployment(ctx context.Context, tenantID, id, status string, errorMsg *string) (*models.Deployment, error) {
	ctx, span := otel.Tracer("orion-deploy-svc").Start(ctx, "DeployService.CompleteDeployment")
	defer span.End()

	span.SetAttributes(attribute.String("target_status", status))

	dep, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		span.RecordError(err)
		return nil, ErrDeploymentNotFound
	}

	if dep.Status != "deploying" {
		err := fmt.Errorf("%w: current status is %s, expected deploying", ErrInvalidStatus, dep.Status)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}

	if status != "success" && status != "failed" {
		err := fmt.Errorf("%w: target status must be success or failed, got %s", ErrInvalidStatus, status)
		span.RecordError(err)
		return nil, err
	}

	updated, err := s.repo.CompleteDeployment(ctx, tenantID, id, status, errorMsg)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, fmt.Errorf("failed to complete deployment: %w", err)
	}

	eventMsg := "Deployment completed successfully"
	if status == "failed" {
		eventMsg = fmt.Sprintf("Deployment failed: %s", safeStr(errorMsg))
	}
	_ = s.logEvent(ctx, id, status, eventMsg, &tenantID)

	span.SetAttributes(attribute.String("deployment.id", id))
	return updated, nil
}

// CancelDeployment cancels a pending or deploying deployment.
func (s *DeployService) CancelDeployment(ctx context.Context, tenantID, id string) (*models.Deployment, error) {
	ctx, span := otel.Tracer("orion-deploy-svc").Start(ctx, "DeployService.CancelDeployment")
	defer span.End()

	dep, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		span.RecordError(err)
		return nil, ErrDeploymentNotFound
	}

	if dep.Status != "pending" && dep.Status != "deploying" {
		err := fmt.Errorf("%w: cannot cancel deployment in %s state", ErrInvalidStatus, dep.Status)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}

	cancelMsg := "Cancelled by user"
	updated, err := s.repo.CompleteDeployment(ctx, tenantID, id, "cancelled", &cancelMsg)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, fmt.Errorf("failed to cancel deployment: %w", err)
	}

	_ = s.logEvent(ctx, id, "cancelled", "Deployment cancelled", &tenantID)

	span.SetAttributes(attribute.String("deployment.id", id))
	return updated, nil
}

// ==================== Rollback ====================

// Rollback creates a new deployment that reverts to the previous successful version.
func (s *DeployService) Rollback(ctx context.Context, tenantID, id string) (*models.Deployment, error) {
	ctx, span := otel.Tracer("orion-deploy-svc").Start(ctx, "DeployService.Rollback")
	defer span.End()

	current, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		span.RecordError(err)
		return nil, ErrDeploymentNotFound
	}

	if current.Status != "failed" && current.Status != "success" {
		err := fmt.Errorf("%w: can only rollback completed deployments, current status is %s", ErrInvalidStatus, current.Status)
		span.RecordError(err)
		return nil, err
	}

	// Find the previous successful deployment as rollback target
	target, err := s.repo.FindRollbackTarget(ctx, tenantID, current.Environment, current.ID)
	if err != nil {
		span.RecordError(err)
		return nil, ErrNoRollbackTarget
	}

	// Create new deployment for the rollback
	rollbackDep := &models.Deployment{
		TenantID:    tenantID,
		Environment: current.Environment,
		ServiceName: current.ServiceName,
		Version:     target.Version,
		ImageTag:    target.ImageTag,
		Status:      "pending",
		Strategy:    current.Strategy,
		DeployedBy:  current.DeployedBy,
	}

	if err := s.repo.Create(ctx, rollbackDep); err != nil {
		span.RecordError(err)
		return nil, err
	}

	// Update original deployment with rollback reference
	_ = s.repo.UpdateRollbackTo(ctx, tenantID, id, rollbackDep.ID)

	// Log events
	_ = s.logEvent(ctx, id, "rollback_started", fmt.Sprintf("Rolling back to deployment %s", target.ID), &tenantID)
	_ = s.logEvent(ctx, rollbackDep.ID, "rollback_target", fmt.Sprintf("Rollback from deployment %s", id), &tenantID)

	// Start the rollback deployment
	started, err := s.repo.StartDeployment(ctx, tenantID, rollbackDep.ID)
	if err != nil {
		s.logger.Warn("failed to auto-start rollback deployment", zap.Error(err))
	} else {
		rollbackDep = started
	}

	span.SetAttributes(
		attribute.String("deployment.id", id),
		attribute.String("rollback.id", rollbackDep.ID),
		attribute.String("rollback.target", target.ID),
	)
	return rollbackDep, nil
}

// ==================== Queries ====================

// GetLatestDeployment returns the latest deployment for a tenant+environment.
func (s *DeployService) GetLatestDeployment(ctx context.Context, tenantID, environment string) (*models.Deployment, error) {
	ctx, span := otel.Tracer("orion-deploy-svc").Start(ctx, "DeployService.GetLatestDeployment")
	defer span.End()

	dep, err := s.repo.FindLatestByEnvironment(ctx, tenantID, environment)
	if err != nil {
		return nil, err
	}
	return dep, nil
}

// GetDeploymentsByBuild returns all deployments for a build, scoped to tenant.
func (s *DeployService) GetDeploymentsByBuild(ctx context.Context, tenantID, buildID string) ([]models.Deployment, error) {
	ctx, span := otel.Tracer("orion-deploy-svc").Start(ctx, "DeployService.GetDeploymentsByBuild")
	defer span.End()

	return s.repo.FindByBuild(ctx, tenantID, buildID)
}

// GetEnvironments returns distinct environments for a tenant.
func (s *DeployService) GetEnvironments(ctx context.Context, tenantID string) ([]string, error) {
	ctx, span := otel.Tracer("orion-deploy-svc").Start(ctx, "DeployService.GetEnvironments")
	defer span.End()

	return s.repo.GetEnvironments(ctx, tenantID)
}

// GetDeployStats returns aggregate deployment statistics.
func (s *DeployService) GetDeployStats(ctx context.Context, tenantID string) (*models.DeployStats, error) {
	ctx, span := otel.Tracer("orion-deploy-svc").Start(ctx, "DeployService.GetDeployStats")
	defer span.End()

	return s.repo.GetDeployStats(ctx, tenantID)
}

// ==================== Events ====================

// GetDeploymentEvents returns all events for a deployment.
func (s *DeployService) GetDeploymentEvents(ctx context.Context, deploymentID string) ([]models.DeploymentEvent, error) {
	ctx, span := otel.Tracer("orion-deploy-svc").Start(ctx, "DeployService.GetDeploymentEvents")
	defer span.End()

	return s.repo.FindEvents(ctx, deploymentID)
}

// logEvent creates a deployment event. Errors are logged but not propagated.
func (s *DeployService) logEvent(ctx context.Context, deploymentID, eventType, message string, actorID *string) error {
	e := &models.DeploymentEvent{
		DeploymentID: deploymentID,
		EventType:    eventType,
		Message:      &message,
		ActorID:      actorID,
	}
	if err := s.repo.CreateEvent(ctx, e); err != nil {
		s.logger.Warn("failed to log deployment event",
			zap.String("deployment_id", deploymentID),
			zap.String("event_type", eventType),
			zap.Error(err),
		)
		return err
	}
	return nil
}

func safeStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
