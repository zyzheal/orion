package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"orion/platform-svc-go/internal/progressive/models"
	"orion/platform-svc-go/internal/progressive/repository"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, d *models.ProgressiveDeployment) error
	CreateStage(ctx context.Context, tenantID, deploymentID string, s *models.RolloutStage) error
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.ProgressiveDeployment, error)
	GetStage(ctx context.Context, tenantID, deploymentID string, stageNumber int) (*models.RolloutStage, error)
	GetStages(ctx context.Context, tenantID, deploymentID string) ([]models.RolloutStage, error)
	IncrementStage(ctx context.Context, tenantID, id string) error
	List(ctx context.Context, tenantID string) ([]models.ProgressiveDeployment, int, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	UpdateStageStatus(ctx context.Context, tenantID, deploymentID string, stageNumber int,
		status models.StageStatus, metrics map[string]string, errStr string) error
	UpdateStatus(ctx context.Context, tenantID, id string, status models.DeploymentStatus) error
}

// Service provides business logic for the progressive deployment module.
type Service struct {
	repo RepositoryInterface
}

// NewService creates a new Service backed by the given Repository.
func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// ---------------------------------------------------------------------------
// Sentinel errors
// ---------------------------------------------------------------------------

var (

	ErrBadRequest        = errors.New("bad request")
	ErrInvalidStrategy   = errors.New("invalid strategy: must be canary, blue_green, or rolling")
	ErrInvalidState      = errors.New("invalid state transition")
	ErrStageFailed       = errors.New("stage failed, initiating rollback")
	ErrThresholdExceeded = errors.New("error rate exceeds rollback threshold")
)

// IsNotFound returns true if the error indicates a resource was not found.
func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound) || errors.Is(err, repository.ErrStageNotFound) || errors.Is(err, sentinel.NotFound)
}

// IsBadRequest returns true if the error indicates a bad request.
func IsBadRequest(err error) bool {
	return errors.Is(err, ErrBadRequest) || errors.Is(err, ErrInvalidStrategy) || errors.Is(err, ErrInvalidState)
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

// Create validates and creates a new progressive deployment.
func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateProgressiveDeploymentRequest) (*models.ProgressiveDeployment, error) {
	if req.Name == "" {
		return nil, ErrBadRequest
	}
	if req.ServiceName == "" {
		return nil, ErrBadRequest
	}
	if !isValidStrategy(req.Strategy) {
		return nil, ErrInvalidStrategy
	}
	if req.TotalStages <= 0 {
		return nil, ErrBadRequest
	}
	if req.RollbackThreshold < 0 || req.RollbackThreshold > 100 {
		return nil, ErrBadRequest
	}
	interval := req.HealthCheckIntervalSec
	if interval <= 0 {
		interval = 30 // default 30 seconds
	}
	threshold := req.RollbackThreshold
	if threshold == 0 {
		threshold = 5.0 // default 5% error rate
	}

	d := &models.ProgressiveDeployment{
		Name:                   req.Name,
		ServiceName:            req.ServiceName,
		Strategy:               req.Strategy,
		TotalStages:            req.TotalStages,
		CurrentStage:           0,
		Status:                 models.StatusPending,
		HealthCheckEndpoint:    req.HealthCheckEndpoint,
		HealthCheckIntervalSec: interval,
		RollbackThreshold:      threshold,
	}

	if err := s.repo.Create(ctx, tenantID, d); err != nil {
		return nil, err
	}
	return d, nil
}

// Get retrieves a single deployment by ID.
func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.ProgressiveDeployment, error) {
	d, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return d, nil
}

// List returns all deployments for a tenant.
func (s *Service) List(ctx context.Context, tenantID string) ([]models.ProgressiveDeployment, int, error) {
	items, total, err := s.repo.List(ctx, tenantID)
	return items, total, err
}

// Update patches a deployment's mutable fields.
func (s *Service) Update(ctx context.Context, tenantID, id string, req models.UpdateProgressiveDeploymentRequest) (*models.ProgressiveDeployment, error) {
	// Verify the deployment exists first
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, sentinel.NotFound
	}

	updates := make(map[string]interface{})
	if req.Name != nil {
		if *req.Name == "" {
			return nil, ErrBadRequest
		}
		updates["name"] = *req.Name
	}
	if req.ServiceName != nil {
		if *req.ServiceName == "" {
			return nil, ErrBadRequest
		}
		updates["service_name"] = *req.ServiceName
	}
	if req.Strategy != nil {
		if !isValidStrategy(*req.Strategy) {
			return nil, ErrInvalidStrategy
		}
		updates["strategy"] = string(*req.Strategy)
	}
	if req.TotalStages != nil {
		if *req.TotalStages <= 0 {
			return nil, ErrBadRequest
		}
		updates["total_stages"] = *req.TotalStages
	}
	if req.HealthCheckEndpoint != nil {
		updates["health_check_endpoint"] = *req.HealthCheckEndpoint
	}
	if req.HealthCheckIntervalSec != nil {
		if *req.HealthCheckIntervalSec <= 0 {
			return nil, ErrBadRequest
		}
		updates["health_check_interval_seconds"] = *req.HealthCheckIntervalSec
	}
	if req.RollbackThreshold != nil {
		if *req.RollbackThreshold < 0 || *req.RollbackThreshold > 100 {
			return nil, ErrBadRequest
		}
		updates["rollback_threshold"] = *req.RollbackThreshold
	}

	if err := s.repo.Update(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}

	d, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return d, nil
}

// Delete removes a deployment by ID.
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	// Only allow deletion when not in an active rollout
	d, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return sentinel.NotFound
	}
	if d.Status == models.StatusRolloutInProgress || d.Status == models.StatusPaused {
		return ErrInvalidState
	}
	if err := s.repo.Delete(ctx, tenantID, id); err != nil {
		return sentinel.NotFound
	}
	return nil
}

// ---------------------------------------------------------------------------
// Rollout lifecycle
// ---------------------------------------------------------------------------

// StartRollout transitions a pending deployment to ROLLOUT_IN_PROGRESS
// and creates the first stage record.
func (s *Service) StartRollout(ctx context.Context, tenantID, deploymentID string) (*models.ProgressiveDeployment, error) {
	d, err := s.repo.GetByID(ctx, tenantID, deploymentID)
	if err != nil {
		return nil, sentinel.NotFound
	}

	if d.Status != models.StatusPending && d.Status != models.StatusRolledBack {
		return nil, ErrInvalidState
	}

	// Reset state for a fresh rollout
	d.CurrentStage = 0
	d.Status = models.StatusRolloutInProgress
	d.RollbackReason = ""
	d.RollbackAt = nil
	now := time.Now().UTC()
	d.UpdatedAt = now

	if err := s.repo.Update(ctx, tenantID, deploymentID, map[string]interface{}{
		"status":          string(models.StatusRolloutInProgress),
		"current_stage":   0,
		"rollback_reason": "",
		"rollback_at":     nil,
	}); err != nil {
		return nil, err
	}

	// Create the first stage
	if err := s.createStageRecord(ctx, tenantID, deploymentID, 1, trafficPercentForStage(1, d.TotalStages, d.Strategy)); err != nil {
		// Rollback the status on failure
		_ = s.repo.Update(ctx, tenantID, deploymentID, map[string]interface{}{"status": string(d.Status)})
		return nil, err
	}

	return s.repo.GetByID(ctx, tenantID, deploymentID)
}

// CompleteStage marks a stage as complete (or failed) and handles transitions.
// If healthOK=false or errorRate>threshold, triggers rollback.
func (s *Service) CompleteStage(ctx context.Context, tenantID, deploymentID string, stageNumber int,
	healthOK bool, errorRate float64, metrics map[string]string) (*models.ProgressiveDeployment, error) {

	d, err := s.repo.GetByID(ctx, tenantID, deploymentID)
	if err != nil {
		return nil, sentinel.NotFound
	}

	if d.Status != models.StatusRolloutInProgress {
		return nil, ErrInvalidState
	}

	if stageNumber <= 0 || stageNumber != d.CurrentStage+1 {
		return nil, ErrBadRequest
	}

	// Check for rollback conditions
	var stageErr string
	var stageStatus models.StageStatus

	if !healthOK || errorRate > d.RollbackThreshold {
		stageStatus = models.StageStatusFailed
		if !healthOK {
			stageErr = fmt.Sprintf("health check failed; error_rate=%.2f%%", errorRate)
		} else {
			stageErr = fmt.Sprintf("error rate %.2f%% exceeds threshold %.2f%%", errorRate, d.RollbackThreshold)
		}
		// Update stage to failed
		if err := s.repo.UpdateStageStatus(ctx, tenantID, deploymentID, stageNumber, stageStatus, metrics, stageErr); err != nil {
			return nil, err
		}
		// Increment stage counter then roll back
		_ = s.repo.IncrementStage(ctx, tenantID, deploymentID)

		rollback := &models.RollbackRequest{Reason: stageErr}
		rollbackReason := rollback.Reason
		return s.rollbackDeployment(ctx, tenantID, deploymentID, rollbackReason)
	}

	// Success path
	now := time.Now().UTC()
	_ = now

	// Mark current stage as completed
	if err := s.repo.UpdateStageStatus(ctx, tenantID, deploymentID, stageNumber, models.StageStatusCompleted, metrics, ""); err != nil {
		return nil, err
	}

	// Increment current stage
	if err := s.repo.IncrementStage(ctx, tenantID, deploymentID); err != nil {
		return nil, err
	}

	// Check if deployment is fully completed
	d, err = s.repo.GetByID(ctx, tenantID, deploymentID)
	if err != nil {
		return nil, sentinel.NotFound
	}

	if d.CurrentStage >= d.TotalStages {
		// All stages done — mark as completed
		if err := s.repo.UpdateStatus(ctx, tenantID, deploymentID, models.StatusCompleted); err != nil {
			return nil, err
		}
		return s.repo.GetByID(ctx, tenantID, deploymentID)
	}

	// Create the next stage
	nextStage := d.CurrentStage + 1
	traffic := trafficPercentForStage(nextStage, d.TotalStages, d.Strategy)
	if err := s.createStageRecord(ctx, tenantID, deploymentID, nextStage, traffic); err != nil {
		return nil, err
	}

	return s.repo.GetByID(ctx, tenantID, deploymentID)
}

// Rollback sets the deployment status to ROLLED_BACK with the given reason.
func (s *Service) Rollback(ctx context.Context, tenantID, deploymentID string, reason string) (*models.ProgressiveDeployment, error) {
	d, err := s.repo.GetByID(ctx, tenantID, deploymentID)
	if err != nil {
		return nil, sentinel.NotFound
	}

	if d.Status != models.StatusRolloutInProgress && d.Status != models.StatusPaused {
		return nil, ErrInvalidState
	}

	return s.rollbackDeployment(ctx, tenantID, deploymentID, reason)
}

// Pause sets the deployment status to PAUSED.
func (s *Service) Pause(ctx context.Context, tenantID, deploymentID string) (*models.ProgressiveDeployment, error) {
	d, err := s.repo.GetByID(ctx, tenantID, deploymentID)
	if err != nil {
		return nil, sentinel.NotFound
	}

	if d.Status != models.StatusRolloutInProgress {
		return nil, ErrInvalidState
	}

	if err := s.repo.UpdateStatus(ctx, tenantID, deploymentID, models.StatusPaused); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, deploymentID)
}

// Resume transitions a paused deployment back to ROLLOUT_IN_PROGRESS.
func (s *Service) Resume(ctx context.Context, tenantID, deploymentID string) (*models.ProgressiveDeployment, error) {
	d, err := s.repo.GetByID(ctx, tenantID, deploymentID)
	if err != nil {
		return nil, sentinel.NotFound
	}

	if d.Status != models.StatusPaused {
		return nil, ErrInvalidState
	}

	if err := s.repo.UpdateStatus(ctx, tenantID, deploymentID, models.StatusRolloutInProgress); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, deploymentID)
}

// GetProgress returns the current stage and completion percentage for a deployment.
func (s *Service) GetProgress(ctx context.Context, tenantID, deploymentID string) (*models.DeploymentProgress, error) {
	d, err := s.repo.GetByID(ctx, tenantID, deploymentID)
	if err != nil {
		return nil, sentinel.NotFound
	}

	percentage := 0.0
	if d.TotalStages > 0 {
		percentage = math.Round(float64(d.CurrentStage) / float64(d.TotalStages) * 100.0)
	}

	progress := &models.DeploymentProgress{
		CurrentStage: d.CurrentStage,
		TotalStages:  d.TotalStages,
		Percentage:   percentage,
		Status:       d.Status,
	}

	// Attach current stage detail if a rollout is in progress or paused
	if d.Status == models.StatusRolloutInProgress || d.Status == models.StatusPaused {
		nextStage := d.CurrentStage + 1
		if nextStage <= d.TotalStages {
			stage, err := s.repo.GetStage(ctx, tenantID, deploymentID, nextStage)
			if err == nil {
				progress.CurrentStageDetail = stage
			}
		}
	}

	return progress, nil
}

// GetStages returns all stages for a deployment.
func (s *Service) GetStages(ctx context.Context, tenantID, deploymentID string) ([]models.RolloutStage, error) {
	_, err := s.repo.GetByID(ctx, tenantID, deploymentID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return s.repo.GetStages(ctx, tenantID, deploymentID)
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

func (s *Service) rollbackDeployment(ctx context.Context, tenantID, deploymentID string, reason string) (*models.ProgressiveDeployment, error) {
	now := time.Now().UTC()
	if err := s.repo.Update(ctx, tenantID, deploymentID, map[string]interface{}{
		"status":          string(models.StatusRolledBack),
		"rollback_reason": reason,
		"rollback_at":     &now,
	}); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, deploymentID)
}

func (s *Service) createStageRecord(ctx context.Context, tenantID, deploymentID string, stageNumber, trafficPercent int) error {
	stage := &models.RolloutStage{
		StageNumber:    stageNumber,
		TrafficPercent: trafficPercent,
		Status:         models.StageStatusPending,
	}
	return s.repo.CreateStage(ctx, tenantID, deploymentID, stage)
}

// trafficPercentForStage computes the traffic percentage for a given stage
// based on the chosen strategy.
func trafficPercentForStage(stageNumber, totalStages int, strategy models.DeploymentStrategy) int {
	switch strategy {
	case models.StrategyCanary:
		// Canary: 10%, 25%, 50%, 75%, 100% (or linear interpolation)
		return int(math.Round(float64(stageNumber) / float64(totalStages) * 100.0))
	case models.StrategyBlueGreen:
		// Blue-green: 0% then 100% on final stage
		if stageNumber >= totalStages {
			return 100
		}
		return 0
	case models.StrategyRolling:
		// Rolling: even increments (e.g., 33%, 67%, 100% for 3 stages)
		return int(math.Round(float64(stageNumber) / float64(totalStages) * 100.0))
	default:
		// Fallback to canary behavior
		return int(math.Round(float64(stageNumber) / float64(totalStages) * 100.0))
	}
}

func isValidStrategy(s models.DeploymentStrategy) bool {
	switch s {
	case models.StrategyCanary, models.StrategyBlueGreen, models.StrategyRolling:
		return true
	}
	return false
}
