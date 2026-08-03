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

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, item *models.Degradation) error
	Delete(ctx context.Context, tenantID, id string) (bool, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.Degradation, error)
	List(ctx context.Context, tenantID string) ([]models.Degradation, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Degradation, error)
}

var (
	ErrBadRequest    = errors.New("bad request")
	ErrAlreadyActive = errors.New("degradation already active")
	ErrNotActive     = errors.New("degradation not active")
	ErrConflict      = errors.New("conflict")
)

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
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

// TriggerDegradation executes a degradation action for a given policy.
func (s *Service) TriggerDegradation(ctx context.Context, tenantID string, req *models.TriggerRequest) (*models.DegradationStatus, error) {
	if req == nil || strings.TrimSpace(req.PolicyID) == "" || strings.TrimSpace(req.Reason) == "" {
		return nil, ErrBadRequest
	}

	// Check if there is already an active degradation for this policy
	// In a real implementation, this would query the trigger repository.
	// For now, we assume no active degradation.

	trigger := &models.DegradationTrigger{
		ID:          "", // would be set by repository
		TenantID:    tenantID,
		PolicyID:    req.PolicyID,
		Status:      "active",
		Reason:      req.Reason,
		ErrorRate:   req.ErrorRate,
		LatencyMs:   req.LatencyMs,
		TriggeredAt: time.Now().UTC(),
		CreatedAt:   time.Now().UTC(),
	}

	// Record the degradation action
	action := models.DegradationAction{
		Action:    "degrade_response",
		Detail:    req.Reason,
		Status:    "applied",
		CreatedAt: time.Now().UTC(),
	}

	status := &models.DegradationStatus{
		PolicyID:         req.PolicyID,
		PolicyName:       "", // would be populated from policy
		IsDegraded:       true,
		CurrentErrorRate: req.ErrorRate,
		CurrentLatencyMs: req.LatencyMs,
		ActiveTrigger:    trigger,
		Actions:          []models.DegradationAction{action},
		EvaluatedAt:      time.Now().UTC(),
	}

	_ = trigger
	_ = action

	return status, nil
}

// GetStatus returns the current degradation status for a given policy.
func (s *Service) GetStatus(ctx context.Context, tenantID, policyID string) (*models.DegradationStatus, error) {
	if strings.TrimSpace(policyID) == "" {
		return nil, ErrBadRequest
	}

	// In a real implementation, this would query the trigger repository for the
	// most recent active trigger for this policy.
	// For now, return a "not degraded" status.

	status := &models.DegradationStatus{
		PolicyID:    policyID,
		IsDegraded:  false,
		EvaluatedAt: time.Now().UTC(),
	}

	return status, nil
}

// Resolve resolves an active degradation for a given policy.
func (s *Service) Resolve(ctx context.Context, tenantID, policyID string, req *models.ResolveRequest) (*models.DegradationStatus, error) {
	if strings.TrimSpace(policyID) == "" {
		return nil, ErrBadRequest
	}
	if req == nil || strings.TrimSpace(req.ResolvedBy) == "" {
		return nil, ErrBadRequest
	}

	// In a real implementation, this would:
	// 1. Find the active trigger for this policy
	// 2. Update its status to "resolved" with resolved_at and resolved_by
	// 3. Update the action status to "reverted"
	// 4. Return the updated status

	now := time.Now().UTC()
	resolvedAt := now

	trigger := &models.DegradationTrigger{
		PolicyID:   policyID,
		Status:     "resolved",
		ResolvedAt: &resolvedAt,
		ResolvedBy: req.ResolvedBy,
	}

	status := &models.DegradationStatus{
		PolicyID:    policyID,
		IsDegraded:  false,
		ActiveTrigger: trigger,
		EvaluatedAt: now,
	}

	_ = trigger

	return status, nil
}

// Ensure compile-time check for unused imports
var _ = math.Max
