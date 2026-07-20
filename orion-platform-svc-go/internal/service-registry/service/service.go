package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/service-registry/models"
	"orion/platform-svc-go/internal/service-registry/repository"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Deregister(ctx context.Context, tenantID, serviceID string) error
	FindByServiceID(ctx context.Context, tenantID, serviceID string) (*models.ServiceRegistry, error)
	GetByInternalID(ctx context.Context, tenantID, id string) (*models.ServiceRegistry, error)
	List(ctx context.Context, tenantID string, f *repository.ListFilters) ([]models.ServiceRegistry, error)
	RecordHeartbeat(ctx context.Context, tenantID, serviceID string) error
	Register(ctx context.Context, tenantID, serviceID, serviceName, serviceURL, protocol, version string, metadata models.JSONB) (*models.ServiceRegistry, error)
}

// Service orchestrates business logic for the service registry.
type Service struct {
	repo RepositoryInterface
}

// NewService creates a Service backed by the given Repository.
func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// Register registers a new service and returns the created entity.
func (s *Service) Register(ctx context.Context, tenantID string, req models.RegisterRequest) (*models.ServiceRegistry, error) {
	metadata, err := models.MarshalFrom(req.Metadata)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal metadata: %w", err)
	}
	m, err := s.repo.Register(ctx, tenantID, req.ServiceID, req.ServiceName, req.ServiceURL, req.Protocol, req.Version, metadata)
	if err != nil {
		return nil, err
	}
	return m, nil
}

// List retrieves tenant-scoped services with optional filters and pagination.
func (s *Service) List(ctx context.Context, tenantID string, f *repository.ListFilters) ([]models.ServiceRegistry, error) {
	return s.repo.List(ctx, tenantID, f)
}

// GetByInternalID retrieves a service by its internal database id.
func (s *Service) GetByInternalID(ctx context.Context, tenantID, id string) (*models.ServiceRegistry, error) {
	return s.repo.GetByInternalID(ctx, tenantID, id)
}

// GetByServiceID retrieves a service by its service_id.
func (s *Service) GetByServiceID(ctx context.Context, tenantID, serviceID string) (*models.ServiceRegistry, error) {
	return s.repo.FindByServiceID(ctx, tenantID, serviceID)
}

// Deregister marks a service as deregistered.
func (s *Service) Deregister(ctx context.Context, tenantID, serviceID string) error {
	return s.repo.Deregister(ctx, tenantID, serviceID)
}

// RecordHeartbeat records a heartbeat for a service.
func (s *Service) RecordHeartbeat(ctx context.Context, tenantID, serviceID string) error {
	return s.repo.RecordHeartbeat(ctx, tenantID, serviceID)
}
