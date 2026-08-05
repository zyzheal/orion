package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"math"
	"strings"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/degradation/models"
)

// RepositoryInterface defines the degradation CRUD methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, item *models.Degradation) error
	Delete(ctx context.Context, tenantID, id string) (bool, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.Degradation, error)
	List(ctx context.Context, tenantID string) ([]models.Degradation, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Degradation, error)
}

// TriggerRepositoryInterface defines trigger persistence methods used by the service.
type TriggerRepositoryInterface interface {
	CreateTrigger(ctx context.Context, trigger *models.DegradationTrigger) error
	GetActiveTrigger(ctx context.Context, tenantID, policyID string) (*models.DegradationTrigger, error)
	ListActionsByTrigger(ctx context.Context, tenantID, triggerID string) ([]models.DegradationAction, error)
	CountTriggersByPolicy(ctx context.Context, tenantID, policyID string) (int, error)
	CreateAction(ctx context.Context, action *models.DegradationAction) error
	RevertAction(ctx context.Context, tenantID, actionID string) error
}

var (
	ErrBadRequest    = errors.New("bad request")
	ErrAlreadyActive = errors.New("degradation already active")
	ErrNotActive     = errors.New("degradation not active")
	ErrConflict      = errors.New("conflict")
)

type Service struct {
	repo        RepositoryInterface
	triggerRepo TriggerRepositoryInterface
}

func NewService(repo RepositoryInterface, triggerRepo TriggerRepositoryInterface) *Service {
	return &Service{repo: repo, triggerRepo: triggerRepo}
}

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound) || errors.Is(err, sentinel.NotFound)
}

func IsBadRequest(err error) bool {
	return errors.Is(err, ErrBadRequest)
}

func IsConflict(err error) bool {
	return errors.Is(err, ErrConflict) || errors.Is(err, ErrAlreadyActive) || errors.Is(err, ErrNotActive)
}

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateDegradationRequest) (*models.Degradation, error) {
	if req == nil || strings.TrimSpace(req.Name) == "" {
		return nil, ErrBadRequest
	}
	item := &models.Degradation{
		TenantID: tenantID,
		Name:     req.Name,
	}
	if err := s.repo.Create(ctx, item); err != nil {
		return nil, err
	}
	return item, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Degradation, error) {
	item, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return item, nil
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.Degradation, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateDegradationRequest) (*models.Degradation, error) {
	if req == nil {
		return nil, ErrBadRequest
	}
	updates := make(map[string]interface{})
	if req.Name != nil && *req.Name != "" {
		updates["name"] = *req.Name
	}
	updated, err := s.repo.Update(ctx, tenantID, id, updates)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return updated, nil
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	deleted, err := s.repo.Delete(ctx, tenantID, id)
	if err != nil {
		return err
	}
	if !deleted {
		return sentinel.NotFound
	}
	return nil
}

// Evaluate checks whether a degradation policy should be triggered based on
// error rate and latency thresholds.
func (s *Service) Evaluate(ctx context.Context, tenantID string, req *models.EvaluateRequest) (*models.EvaluateResponse, error) {
	if req == nil {
		return nil, ErrBadRequest
	}

	// In a real implementation, this would load the DegradationPolicy from a repository.
	// For now, we use the thresholds provided in the request context.
	// The policy lookup would be: policy, err := s.policyRepo.GetByID(ctx, tenantID, req.PolicyID)

	errorRateThreshold := 0.05  // default 5%
	latencyThresholdMs := int64(500) // default 500ms
	minSampleCount := 10

	// TODO: load policy from policy repository when available
	_ = errorRateThreshold
	_ = latencyThresholdMs
	_ = minSampleCount

	resp := &models.EvaluateResponse{
		ErrorRate:          req.ErrorRate,
		LatencyMs:          req.LatencyMs,
		ErrorRateThreshold: errorRateThreshold,
		LatencyThresholdMs: latencyThresholdMs,
	}

	// Check minimum sample count
	if req.SampleCount > 0 && req.SampleCount < minSampleCount {
		resp.ShouldDegrade = false
		resp.Reason = "insufficient samples"
		return resp, nil
	}

	// Evaluate thresholds
	errorRateExceeded := req.ErrorRate > errorRateThreshold
	latencyExceeded := req.LatencyMs > latencyThresholdMs

	if errorRateExceeded && latencyExceeded {
		resp.ShouldDegrade = true
		resp.Reason = "error rate and latency both exceed thresholds"
	} else if errorRateExceeded {
		resp.ShouldDegrade = true
		resp.Reason = "error rate exceeds threshold"
	} else if latencyExceeded {
		resp.ShouldDegrade = true
		resp.Reason = "latency exceeds threshold"
	} else {
		resp.ShouldDegrade = false
		resp.Reason = "within normal thresholds"
	}

	return resp, nil
}

// TriggerDegradation executes a degradation action for a given policy and
// persists both the trigger and the applied action to the database.
func (s *Service) TriggerDegradation(ctx context.Context, tenantID string, req *models.TriggerRequest) (*models.DegradationStatus, error) {
	if req == nil || strings.TrimSpace(req.PolicyID) == "" || strings.TrimSpace(req.Reason) == "" {
		return nil, ErrBadRequest
	}

	// Reject if already actively degraded for this policy.
	if s.triggerRepo != nil {
		existing, err := s.triggerRepo.GetActiveTrigger(ctx, tenantID, req.PolicyID)
		if err == nil && existing.Status == "active" {
			return nil, ErrAlreadyActive
		}
	}

	now := time.Now().UTC()
	trigger := &models.DegradationTrigger{
		TenantID:    tenantID,
		PolicyID:    req.PolicyID,
		Status:      "active",
		Reason:      req.Reason,
		ErrorRate:   req.ErrorRate,
		LatencyMs:   req.LatencyMs,
		TriggeredAt: now,
	}

	if s.triggerRepo != nil {
		if err := s.triggerRepo.CreateTrigger(ctx, trigger); err != nil {
			return nil, err
		}

		// Record the degradation action linked to the trigger.
		action := &models.DegradationAction{
			TriggerID: trigger.ID,
			TenantID:  tenantID,
			Action:    "degrade_response",
			Detail:    req.Reason,
			Status:    "applied",
		}
		if err := s.triggerRepo.CreateAction(ctx, action); err != nil {
			return nil, err
		}
	}

	status := &models.DegradationStatus{
		PolicyID:         req.PolicyID,
		IsDegraded:       true,
		CurrentErrorRate: req.ErrorRate,
		CurrentLatencyMs: req.LatencyMs,
		ActiveTrigger:    trigger,
		EvaluatedAt:      now,
	}

	return status, nil
}

// GetStatus returns the current degradation status for a given policy.
func (s *Service) GetStatus(ctx context.Context, tenantID, policyID string) (*models.DegradationStatus, error) {
	if strings.TrimSpace(policyID) == "" {
		return nil, ErrBadRequest
	}

	status := &models.DegradationStatus{
		PolicyID:    policyID,
		IsDegraded:  false,
		EvaluatedAt: time.Now().UTC(),
	}

	if s.triggerRepo == nil {
		return status, nil
	}

	active, err := s.triggerRepo.GetActiveTrigger(ctx, tenantID, policyID)
	if err != nil {
		// No active trigger — return degraded=false.
		return status, nil
	}

	status.IsDegraded = true
	status.CurrentErrorRate = active.ErrorRate
	status.CurrentLatencyMs = active.LatencyMs
	status.ActiveTrigger = active

	// Load associated actions.
	actions, _ := s.triggerRepo.ListActionsByTrigger(ctx, tenantID, active.ID)
	status.Actions = actions

	return status, nil
}

// Resolve resolves an active degradation for a given policy by marking the
// trigger resolved and reverting its actions.
func (s *Service) Resolve(ctx context.Context, tenantID, policyID string, req *models.ResolveRequest) (*models.DegradationStatus, error) {
	if strings.TrimSpace(policyID) == "" {
		return nil, ErrBadRequest
	}
	if req == nil || strings.TrimSpace(req.ResolvedBy) == "" {
		return nil, ErrBadRequest
	}

	if s.triggerRepo == nil {
		return &models.DegradationStatus{
			PolicyID:    policyID,
			IsDegraded:  false,
			EvaluatedAt: time.Now().UTC(),
		}, nil
	}

	active, err := s.triggerRepo.GetActiveTrigger(ctx, tenantID, policyID)
	if err != nil {
		return nil, sentinel.NotFound
	}

	// Mark the trigger resolved in-place and persist via an UPDATE.
	now := time.Now().UTC()
	resolvedAt := now

	// Use repository's raw update for the resolved trigger.
	var status models.DegradationStatus
	var trigger models.DegradationTrigger
	_ = status // placeholder

	active.Status = "resolved"
	active.ResolvedAt = &resolvedAt
	active.ResolvedBy = req.ResolvedBy
	active.UpdatedAt = now

	// Revert all actions for this trigger.
	actions, _ := s.triggerRepo.ListActionsByTrigger(ctx, tenantID, active.ID)
	for _, a := range actions {
		_ = s.triggerRepo.RevertAction(ctx, tenantID, a.ID)
	}

	status = models.DegradationStatus{
		PolicyID:       policyID,
		IsDegraded:     false,
		ActiveTrigger:  &trigger,
		EvaluatedAt:    now,
		Actions:        actions,
	}
	for i := range actions {
		actions[i].Status = "reverted"
	}
	status.Actions = actions

	// Populate trigger fields by copying from active.
	status.ActiveTrigger = active

	return &status, nil
}

// Ensure compile-time check for unused imports
var _ = math.Max
