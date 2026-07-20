package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/handler-registry/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, m *models.HandlerRegistry) error
	CreateEntry(ctx context.Context, entry *models.HandlerRegistryEntry) error
	Delete(ctx context.Context, tenantID, id string) error
	DeleteEntry(ctx context.Context, tenantID, domain, name string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.HandlerRegistry, error)
	GetDomains(ctx context.Context, tenantID string) ([]string, error)
	GetEntry(ctx context.Context, tenantID, domain, name string) (*models.HandlerRegistryEntry, error)
	List(ctx context.Context, tenantID string, limit, offset int) ([]models.HandlerRegistry, error)
	ListEntries(ctx context.Context, tenantID string, opts models.ListHandlerRegistryOptions) ([]models.HandlerRegistryEntry, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	UpdateEntryStatus(ctx context.Context, tenantID, domain, name, status string) error
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// ====== Legacy CRUD methods (backward compatibility) ======

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateHandlerRegistryRequest) (*models.HandlerRegistry, error) {
	m := &models.HandlerRegistry{
		TenantID: tenantID,
		Name:     req.Name,
	}
	if err := s.repo.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.HandlerRegistry, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, limit, offset int) ([]models.HandlerRegistry, error) {
	return s.repo.List(ctx, tenantID, limit, offset)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.UpdateHandlerRegistryRequest) (*models.HandlerRegistry, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if err := s.repo.Update(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// ====== Handler SPI Registry methods ======

// HealthCheck returns the health status of the handler registry service.
func (s *Service) HealthCheck(ctx context.Context) (map[string]interface{}, error) {
	return map[string]interface{}{
		"status":  "ok",
		"service": "handler-registry",
	}, nil
}

// GetDomains returns the list of distinct domains for a tenant.
func (s *Service) GetDomains(ctx context.Context, tenantID string) ([]string, error) {
	return s.repo.GetDomains(ctx, tenantID)
}

// GetEntry returns a single handler entry by domain and name for a tenant.
func (s *Service) GetEntry(ctx context.Context, tenantID, domain, name string) (*models.HandlerRegistryEntry, error) {
	return s.repo.GetEntry(ctx, tenantID, domain, name)
}

// RegisterHandler registers a new handler entry.
func (s *Service) RegisterHandler(ctx context.Context, tenantID string, req models.RegisterHandlerRequest) (*models.HandlerRegistryEntry, error) {
	// Check if entry already exists
	existing, err := s.repo.GetEntry(ctx, tenantID, req.Domain, req.Name)
	if err == nil && existing != nil {
		return nil, fmt.Errorf("Handler %s/%s already exists", req.Domain, req.Name)
	}
	entry := &models.HandlerRegistryEntry{
		TenantID:     tenantID,
		Domain:       req.Domain,
		Name:         req.Name,
		DisplayName:  req.DisplayName,
		Description:  req.Description,
		Status:       "active",
		Config:       req.Config,
		RegisteredBy: req.RegisteredBy,
	}
	if err := s.repo.CreateEntry(ctx, entry); err != nil {
		return nil, err
	}
	return entry, nil
}

// Enable enables a handler entry.
func (s *Service) Enable(ctx context.Context, tenantID, domain, name string) error {
	_, err := s.repo.GetEntry(ctx, tenantID, domain, name)
	if err != nil {
		return err
	}
	return s.repo.UpdateEntryStatus(ctx, tenantID, domain, name, "active")
}

// Disable disables a handler entry.
func (s *Service) Disable(ctx context.Context, tenantID, domain, name string) error {
	_, err := s.repo.GetEntry(ctx, tenantID, domain, name)
	if err != nil {
		return err
	}
	return s.repo.UpdateEntryStatus(ctx, tenantID, domain, name, "disabled")
}

// Unregister removes a handler entry.
func (s *Service) Unregister(ctx context.Context, tenantID, domain, name string) error {
	return s.repo.DeleteEntry(ctx, tenantID, domain, name)
}

// Invoke invokes a handler entry with the given payload.
func (s *Service) Invoke(ctx context.Context, tenantID, domain, name string, payload map[string]interface{}) (map[string]interface{}, error) {
	_, err := s.repo.GetEntry(ctx, tenantID, domain, name)
	if err != nil {
		return nil, err
	}
	// Invoke the handler (placeholder: returns payload echo for now)
	return map[string]interface{}{
		"domain":  domain,
		"name":    name,
		"payload": payload,
		"status":  "invoked",
	}, nil
}

// ListEntries returns a list of handler entries for a tenant with optional filters.
func (s *Service) ListEntries(ctx context.Context, tenantID string, opts models.ListHandlerRegistryOptions) ([]models.HandlerRegistryEntry, error) {
	return s.repo.ListEntries(ctx, tenantID, opts)
}
