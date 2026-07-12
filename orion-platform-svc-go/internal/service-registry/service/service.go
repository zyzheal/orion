package service

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/service-registry/models"
	"orion/platform-svc-go/internal/service-registry/repository"
)

// Service orchestrates business logic for the service registry.
type Service struct {
	repo *repository.Repository
}

// NewService creates a Service backed by the given Repository.
func NewService(repo *repository.Repository) *Service {
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
