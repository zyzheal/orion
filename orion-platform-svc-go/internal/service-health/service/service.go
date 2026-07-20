package service

import (
	"context"
	"errors"
	"time"

	"orion/platform-svc-go/internal/service-health/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateCheck(ctx context.Context, m *models.HealthCheck) error
	DeleteCheck(ctx context.Context, tenantID, id string) error
	GetAllSummaries(ctx context.Context, tenantID string) ([]models.HealthSummary, error)
	GetCheckByID(ctx context.Context, tenantID, id string) (*models.HealthCheck, error)
	GetCheckByIDWithoutTenant(ctx context.Context, id string) (*models.HealthCheck, error)
	GetDegradedServices(ctx context.Context, tenantID string, thresholdUptime float64) ([]models.HealthSummary, error)
	GetRecentResults(ctx context.Context, checkID string, limit int) ([]models.HealthResult, error)
	GetSummary(ctx context.Context, tenantID, serviceName string) (*models.HealthSummary, error)
	ListChecks(ctx context.Context, tenantID string) ([]models.HealthCheck, error)
	RecordResult(ctx context.Context, checkID string, status models.LastStatus, responseTimeMs int64, errMsg string, checkedAt time.Time) error
	UpdateCheck(ctx context.Context, tenantID, id string, m *models.HealthCheck) (*models.HealthCheck, error)
	UpdateLastStatus(ctx context.Context, id string, status models.LastStatus, consecutiveFailures int, checkedAt time.Time) error
}

// Service wraps the service-health repository and adds business logic.
type Service struct {
	repo RepositoryInterface
}

// NewService creates a new Service backed by the given repository.
func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// Create creates a new health check.
func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateHealthCheckRequest) (*models.HealthCheck, error) {
	m := &models.HealthCheck{
		TenantID:        tenantID,
		Enabled:         req.Enabled,
		Metadata:        req.Metadata,
		TimeoutSeconds:  req.TimeoutSeconds,
		IntervalSeconds: req.IntervalSeconds,
		Endpoint:        req.Endpoint,
		CheckType:       req.CheckType,
		ServiceName:     req.ServiceName,
	}
	if err := s.repo.CreateCheck(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

// Get retrieves a health check by id within a tenant.
func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.HealthCheck, error) {
	return s.repo.GetCheckByID(ctx, tenantID, id)
}

// List returns all health checks for a tenant.
func (s *Service) List(ctx context.Context, tenantID string) ([]models.HealthCheck, error) {
	return s.repo.ListChecks(ctx, tenantID)
}

// Update updates fields on an existing health check within a tenant.
func (s *Service) Update(ctx context.Context, tenantID, id string, req models.UpdateHealthCheckRequest) (*models.HealthCheck, error) {
	current, err := s.repo.GetCheckByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	current.UpdatedAt = now

	if req.ServiceName != nil {
		current.ServiceName = *req.ServiceName
	}
	if req.CheckType != nil {
		// Keep existing check_type when caller sends nil.
		current.CheckType = *req.CheckType
	}
	if req.Endpoint != nil {
		current.Endpoint = *req.Endpoint
	}
	if req.IntervalSeconds != nil && *req.IntervalSeconds > 0 {
		current.IntervalSeconds = *req.IntervalSeconds
	} else if req.IntervalSeconds != nil {
		current.IntervalSeconds = 60
	}
	if req.TimeoutSeconds != nil && *req.TimeoutSeconds > 0 {
		current.TimeoutSeconds = *req.TimeoutSeconds
	} else if req.TimeoutSeconds != nil {
		current.TimeoutSeconds = 10
	}
	if req.Metadata != nil {
		// Ensure we store a non-nil Metadata so JSONB doesn't round-trip as null.
		if *req.Metadata == nil {
			current.Metadata = make(map[string]string)
		} else {
			current.Metadata = models.Metadata(*req.Metadata)
		}
	}
	if req.Enabled != nil {
		// We need a pointer because JSON unmarshaling always sets Enabled,
		// so this will overwrite — only set when explicitly provided by caller.
		// The handler passes a pointer only when key is present, so this is safe.
		current.Enabled = *req.Enabled
	}

	return s.repo.UpdateCheck(ctx, tenantID, id, current)
}

// Delete deletes a health check within a tenant.
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteCheck(ctx, tenantID, id)
}

// RecordHealthResult records a result for a check, updates the check's
// last_status and consecutive_failures. The handler verifies tenant ownership
// before calling this method.
//
// On UP, consecutive_failures resets to 0. On DOWN/UNKNOWN it increments by 1.
func (s *Service) RecordHealthResult(ctx context.Context, checkID string, status models.LastStatus, responseTimeMs int64, errMsg string) (*models.HealthCheck, error) {
	checkedAt := time.Now().UTC()

	// Read current state (tenant already verified by handler).
	current, err := s.repo.GetCheckByIDWithoutTenant(ctx, checkID)
	if err != nil {
		return nil, err
	}

	consecutiveFailures := current.ConsecutiveFailures
	if status == models.StatusUP {
		consecutiveFailures = 0
	} else {
		consecutiveFailures++
	}

	if err := s.repo.RecordResult(ctx, checkID, status, responseTimeMs, errMsg, checkedAt); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateLastStatus(ctx, checkID, status, consecutiveFailures, checkedAt); err != nil {
		return nil, err
	}

	updated, err := s.repo.GetCheckByIDWithoutTenant(ctx, checkID)
	if err != nil {
		return nil, err
	}
	return updated, nil
}

// GetRecentResults returns the most recent N results for a check.
func (s *Service) GetRecentResults(ctx context.Context, checkID string, limit int) ([]models.HealthResult, error) {
	return s.repo.GetRecentResults(ctx, checkID, limit)
}

// GetServiceHealth returns the aggregated health summary for a service within
// a tenant, looking at the last 24 hours of results.
func (s *Service) GetServiceHealth(ctx context.Context, tenantID, serviceName string) (*models.HealthSummary, error) {
	return s.repo.GetSummary(ctx, tenantID, serviceName)
}

// GetAllHealthSummaries returns health summaries for every service within a tenant.
func (s *Service) GetAllHealthSummaries(ctx context.Context, tenantID string) ([]models.HealthSummary, error) {
	return s.repo.GetAllSummaries(ctx, tenantID)
}

// DetectDegradedServices returns summaries for every service whose 24h uptime
// falls below the given threshold (expressed as a percentage, e.g. 99.0).
func (s *Service) DetectDegradedServices(ctx context.Context, tenantID string, thresholdUptime float64) ([]models.HealthSummary, error) {
	if thresholdUptime < 0 || thresholdUptime > 100 {
		return nil, errors.New("threshold_uptime must be between 0 and 100")
	}
	return s.repo.GetDegradedServices(ctx, tenantID, thresholdUptime)
}
