package service

import (
	"context"
	"errors"
	"time"

	"orion/platform-svc-go/internal/circuit-breaker/models"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, cb *models.CircuitBreaker) error
	Delete(ctx context.Context, id, tenantID string) (bool, error)
	GetByID(ctx context.Context, id, tenantID string) (*models.CircuitBreaker, error)
	GetRecentEvents(ctx context.Context, cbID, tenantID string, limit int) ([]models.CircuitEvent, error)
	IncrementFailures(ctx context.Context, cbID, tenantID string) (int, error)
	List(ctx context.Context, tenantID string) ([]models.CircuitBreaker, error)
	ListOpen(ctx context.Context, tenantID string) ([]models.CircuitBreaker, error)
	ResetFailures(ctx context.Context, cbID, tenantID string) error
	Update(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.CircuitBreaker, error)
	UpdateState(ctx context.Context, cbID, tenantID, newState, reason string) error
}

var (

	ErrDisabled = errors.New("circuit breaker is disabled")
)

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// Create creates a circuit breaker with sensible defaults.
func (s *Service) Create(ctx context.Context, req *models.CreateRequest, tenantID string) (*models.CircuitBreaker, error) {
	entity := &models.CircuitBreaker{
		TenantID:         tenantID,
		Name:             req.Name,
		ServiceName:      req.ServiceName,
		FailureThreshold: 5,
		SuccessThreshold: 3,
		TimeoutSeconds:   30,
		State:            models.StateClosed,
		Enabled:          true,
	}
	if req.FailureThreshold > 0 {
		entity.FailureThreshold = req.FailureThreshold
	}
	if req.SuccessThreshold > 0 {
		entity.SuccessThreshold = req.SuccessThreshold
	}
	if req.TimeoutSeconds > 0 {
		entity.TimeoutSeconds = req.TimeoutSeconds
	}
	entity.Metadata = req.Metadata
	if err := s.repo.Create(ctx, entity); err != nil {
		return nil, err
	}
	return entity, nil
}

// Get retrieves a circuit breaker by ID.
func (s *Service) Get(ctx context.Context, id, tenantID string) (*models.CircuitBreaker, error) {
	cb, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return cb, nil
}

// List returns all circuit breakers for a tenant.
func (s *Service) List(ctx context.Context, tenantID string) ([]models.CircuitBreaker, error) {
	entities, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if entities == nil {
		entities = []models.CircuitBreaker{}
	}
	return entities, nil
}

// Update updates mutable fields of a circuit breaker.
func (s *Service) Update(ctx context.Context, id, tenantID string, req *models.UpdateRequest) (*models.CircuitBreaker, error) {
	// Verify existence first
	_, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	attrs := make(map[string]interface{})
	if req.Name != nil {
		attrs["name"] = *req.Name
	}
	if req.ServiceName != nil {
		attrs["service_name"] = *req.ServiceName
	}
	if req.FailureThreshold != nil && *req.FailureThreshold > 0 {
		attrs["failure_threshold"] = *req.FailureThreshold
	}
	if req.SuccessThreshold != nil && *req.SuccessThreshold > 0 {
		attrs["success_threshold"] = *req.SuccessThreshold
	}
	if req.TimeoutSeconds != nil && *req.TimeoutSeconds > 0 {
		attrs["timeout_seconds"] = *req.TimeoutSeconds
	}
	if req.Enabled != nil {
		attrs["enabled"] = *req.Enabled
	}
	if req.Metadata != nil {
		attrs["metadata"] = *req.Metadata
	}
	return s.repo.Update(ctx, id, tenantID, attrs)
}

// Delete removes a circuit breaker.
func (s *Service) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	return s.repo.Delete(ctx, id, tenantID)
}

// RecordSuccess records a successful call.
func (s *Service) RecordSuccess(ctx context.Context, id, tenantID string, responseTimeMs int) (*models.CircuitBreaker, error) {
	cb, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	if !cb.Enabled {
		return cb, ErrDisabled
	}

	switch cb.State {
	case models.StateClosed:
		if cb.FailureCount > 0 {
			_ = s.repo.ResetFailures(ctx, id, tenantID)
		}
	case models.StateHalfOpen:
		_ = s.repo.ResetFailures(ctx, id, tenantID)
		_ = s.repo.UpdateState(ctx, id, tenantID, string(models.StateClosed), "success threshold reached")
	case models.StateOpen:
		return cb, errors.New("circuit is OPEN, requests are rejected")
	}
	return s.repo.GetByID(ctx, id, tenantID)
}

// RecordFailure records a failed call. May transition CLOSED->OPEN.
func (s *Service) RecordFailure(ctx context.Context, id, tenantID string, errMsg string) (*models.CircuitBreaker, error) {
	cb, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	if !cb.Enabled {
		return cb, ErrDisabled
	}

	if cb.State == models.StateOpen {
		return cb, errors.New("circuit is OPEN, requests are rejected")
	}

	count, err := s.repo.IncrementFailures(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}
	if cb.State == models.StateClosed && count >= cb.FailureThreshold {
		_ = s.repo.UpdateState(ctx, id, tenantID, string(models.StateOpen), "failure threshold reached: "+errMsg)
	} else if cb.State == models.StateHalfOpen {
		_ = s.repo.UpdateState(ctx, id, tenantID, string(models.StateOpen), "failure during half-open: "+errMsg)
		_ = s.repo.ResetFailures(ctx, id, tenantID)
	}
	return s.repo.GetByID(ctx, id, tenantID)
}

// Evaluate checks whether a request should proceed and auto-transitions OPEN->HALF_OPEN.
func (s *Service) Evaluate(ctx context.Context, id, tenantID string) (*models.StateResponse, error) {
	cb, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}

	if !cb.Enabled {
		return &models.StateResponse{
			State:   cb.State,
			Proceed: true,
			Enabled: false,
			Message: "circuit breaker disabled",
		}, nil
	}

	// Auto-transition OPEN -> HALF_OPEN if timeout elapsed
	if cb.State == models.StateOpen {
		if !cb.LastStateChangeAt.IsZero() &&
			ctime(cb.LastStateChangeAt, cb.TimeoutSeconds) {
			_ = s.repo.UpdateState(ctx, id, tenantID, string(models.StateHalfOpen), "timeout elapsed, entering half-open")
			cb, _ = s.repo.GetByID(ctx, id, tenantID)
		} else {
			return &models.StateResponse{
				State:            cb.State,
				Proceed:          false,
				Enabled:          true,
				FailureCount:     cb.FailureCount,
				FailureThreshold: cb.FailureThreshold,
				Message:          "circuit is OPEN, requests rejected",
			}, nil
		}
	}

	var msg string
	switch cb.State {
	case models.StateClosed:
		msg = "circuit is CLOSED, requests allowed"
	case models.StateHalfOpen:
		msg = "circuit is HALF_OPEN, probe requests allowed"
	default:
		msg = "circuit is OPEN, requests rejected"
	}
	return &models.StateResponse{
		State:            cb.State,
		Proceed:          cb.State != models.StateOpen,
		Enabled:          cb.Enabled,
		FailureCount:     cb.FailureCount,
		FailureThreshold: cb.FailureThreshold,
		Message:          msg,
	}, nil
}

// ctime returns true if elapsed since ts exceeds timeoutSeconds.
func ctime(ts time.Time, timeoutSeconds int) bool {
	return time.Since(ts) > time.Duration(timeoutSeconds)*time.Second
}

// ListOpen returns all circuit breakers currently in OPEN state.
func (s *Service) ListOpen(ctx context.Context, tenantID string) ([]models.CircuitBreaker, error) {
	entities, err := s.repo.ListOpen(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return entities, nil
}

// GetRecentEvents returns recent state transition events.
func (s *Service) GetRecentEvents(ctx context.Context, id, tenantID string, limit int) ([]models.CircuitEvent, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	return s.repo.GetRecentEvents(ctx, id, tenantID, limit)
}
