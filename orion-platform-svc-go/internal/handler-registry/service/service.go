package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"fmt"
	"strings"

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
	entry, err := s.repo.GetEntry(ctx, tenantID, domain, name)
	if err != nil {
		return nil, err
	}
	if entry.Status != "active" {
		return nil, fmt.Errorf("handler %s/%s is not active (status=%q)", domain, name, entry.Status)
	}
	if entry.Config == nil {
		return nil, fmt.Errorf("handler %s/%s has no configuration", domain, name)
	}
	cfg := entry.Config

	handlerType := getString(cfg, "type")
	if handlerType == "" {
		return nil, fmt.Errorf("handler %s/%s config missing required field 'type'", domain, name)
	}
	switch handlerType {
	case "function":
		target := getString(cfg, "target")
		if target == "" {
			return nil, fmt.Errorf("handler %s/%s of type %q is missing required field 'target'", domain, name, handlerType)
		}
		return map[string]interface{}{
			"status":       "invoked",
			"type":         handlerType,
			"target":       target,
			"targetMethod": getString(cfg, "method"),
			"tenant":       tenantID,
			"domain":       domain,
			"name":         name,
			"input":        payload,
		}, nil
	case "webhook":
		url := getString(cfg, "url")
		if url == "" {
			return nil, fmt.Errorf("handler %s/%s of type %q is missing required field 'url'", domain, name, handlerType)
		}
		return map[string]interface{}{
			"status": "invoked",
			"type":   handlerType,
			"url":    url,
			"tenant": tenantID,
			"domain": domain,
			"name":   name,
			"input":  payload,
		}, nil
	default:
		allowed := make([]string, 0, len(allKnownTypes))
		for t := range allKnownTypes {
			allowed = append(allowed, t)
		}
		return nil, fmt.Errorf("handler %s/%s has unsupported type %q (supported: %s)", domain, name, handlerType, strings.Join(allowed, ", "))
	}
}

// sentinel errors for Invoke
var ErrHandlerNotActive = errors.New("handler is not active")

// Helper: read a string value from the entry config map.
func getString(cfg map[string]interface{}, key string) string {
	v, ok := cfg[key]
	if !ok {
		return ""
	}
	switch t := v.(type) {
	case string:
		return t
	case float64: // JSON numbers decode as float64
		return fmt.Sprintf("%v", t)
	}
	return ""
}

// allKnownTypes lists the handler types recognized by Invoke.
var allKnownTypes = map[string]struct{}{
	"function": {},
	"webhook":  {},
}

// ListEntries returns a list of handler entries for a tenant with optional filters.
func (s *Service) ListEntries(ctx context.Context, tenantID string, opts models.ListHandlerRegistryOptions) ([]models.HandlerRegistryEntry, error) {
	return s.repo.ListEntries(ctx, tenantID, opts)
}
