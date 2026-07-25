// ServiceEx exposes business logic for Extension Point CRUD via HTTP.
//
// The ExtensionRegistry (service/registry.go) is the lifecycle core. This file
// adds the HTTP-facing CRUD operations (list, get, create, update) on top of
// the registry so that the HTTP handler can manage extension points via the API.
package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"orion/platform-svc-go/internal/extension-point/models"
	"orion/platform-svc-go/internal/extension-point/repository"

	"github.com/google/uuid"
)

// ErrDuplicateName is returned when an extension point with the same name
// already exists in the tenant.
var ErrDuplicateName = errors.New("extension point name already exists")

// ErrInvalidCategory is returned for an unknown category value.
var ErrInvalidCategory = errors.New("invalid extension category")

// ErrInvalidHandlerType is returned for an unknown handler_type value.
var ErrInvalidHandlerType = errors.New("invalid handler_type")

// ErrExtensionNotFound is returned when a named extension does not exist.
var ErrExtensionNotFound = errors.New("extension point not found")

// ErrStartupNotFound is returned when a startup task is not found.
var ErrStartupNotFound = errors.New("startup task not found")

// ServiceEx provides HTTP-facing CRUD for extension points and startup tasks.
type ServiceEx struct {
	repo     *repository.Repository
	registry *ExtensionRegistry
	tenantID string
}

// NewServiceEx creates a new ServiceEx.
func NewServiceEx(repo *repository.Repository, registry *ExtensionRegistry, tenantID string) *ServiceEx {
	return &ServiceEx{repo: repo, registry: registry, tenantID: tenantID}
}

// ===========================================================================
// Extension CRUD
// ===========================================================================

// ListExtensions returns paginated extension points.
func (s *ServiceEx) ListExtensions(ctx context.Context, category, status string, offset, limit int) ([]models.ExtensionSummary, int, error) {
	eps, err := s.repo.ListExtensionPoints(ctx, s.tenantID, category, status, offset, limit)
	if err != nil {
		return nil, 0, fmt.Errorf("list extensions failed: %w", err)
	}
	summaries := make([]models.ExtensionSummary, len(eps))
	for i, ep := range eps {
		summaries[i] = repository.ExtensionPointToSummary(ep)
	}
	total, _ := s.repo.CountExtensionPoints(ctx, s.tenantID)
	return summaries, total, nil
}

// GetExtension returns a single extension by name.
func (s *ServiceEx) GetExtension(ctx context.Context, name string) (*models.ExtensionSummary, error) {
	ep, err := s.repo.GetExtensionPoint(ctx, s.tenantID, name)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrExtensionNotFound
		}
		return nil, fmt.Errorf("get extension failed: %w", err)
	}
	summary := repository.ExtensionPointToSummary(*ep)
return &summary, nil
}

// Register creates a new extension point.
// This is the HTTP path for registering extensions (distinct from the
// programmatic registry.Register() which also requires an ExtensionHandler).
func (s *ServiceEx) Register(ctx context.Context, req *models.CreateExtensionRequest) (*models.ExtensionSummary, error) {
	// Validate category
	req.Category = strings.ToLower(strings.TrimSpace(req.Category))
	if !models.ValidCategories[req.Category] {
		return nil, fmt.Errorf("%w: %s (allowed: %s)", ErrInvalidCategory, req.Category,
			joinNames(models.ValidCategories))
	}
	req.HandlerType = strings.TrimSpace(req.HandlerType)
	if req.HandlerType == "" {
		req.HandlerType = models.HandlerTypeBuiltin
	}
	if !models.ValidHandlerTypes[req.HandlerType] {
		return nil, fmt.Errorf("%w: %s", ErrInvalidHandlerType, req.HandlerType)
	}

	// Check for duplicate
	_, err := s.repo.GetExtensionPoint(ctx, s.tenantID, req.Name)
	if err == nil {
		return nil, ErrDuplicateName
	}
	if !errors.Is(err, repository.ErrNotFound) {
		return nil, fmt.Errorf("check duplicate failed: %w", err)
	}

	// Build config JSONB
	cfg := models.JSONB{}
	if req.Config != nil {
		for k, v := range req.Config {
			cfg[k] = v
		}
	}

	ep := &models.ExtensionPoint{
		TenantID:    s.tenantID,
		Name:        req.Name,
		Category:    req.Category,
		Description: req.Description,
		HandlerType: req.HandlerType,
		Config:      cfg,
		Enabled:     true,
		Status:      models.StatusRegistered,
	}
	if req.Enabled != nil {
		ep.Enabled = *req.Enabled
	}
	if req.Priority != nil {
		ep.Priority = *req.Priority
	}

	if err := s.repo.CreateExtensionPoint(ctx, ep); err != nil {
		return nil, fmt.Errorf("register extension failed: %w", err)
	}
	summary := repository.ExtensionPointToSummary(*ep)
	return &summary, nil
}

// UpdateExtension updates mutable fields of an extension point.
func (s *ServiceEx) UpdateExtension(ctx context.Context, name string, req *models.UpdateExtensionRequest) (*models.ExtensionSummary, error) {
	// Validate status if provided
	status := req.Status
	if status != nil {
		if !models.ValidExtensionStatuses[*status] {
			return nil, fmt.Errorf("invalid status: %s (allowed: %s)", *status,
				joinNames(models.ValidExtensionStatuses))
		}
	}

	// Convert config if provided
	var config *models.JSONB
	if req.Config != nil {
		c := models.JSONB{}
		for k, v := range *req.Config {
			c[k] = v
		}
		config = &c
	}

	errs := ""
	ep, err := s.repo.UpdateExtensionPoint(ctx, s.tenantID, name, status, req.Enabled, req.Priority, config, req.Description, &errs)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrExtensionNotFound
		}
		return nil, fmt.Errorf("update extension failed: %w", err)
	}
	summary := repository.ExtensionPointToSummary(*ep)
	return &summary, nil
}

// InitializeExtension triggers initialization of a single extension point.
func (s *ServiceEx) InitializeExtension(ctx context.Context, name string) (*models.ExtensionSummary, error) {
	// If there's a registered in-memory handler, use it; otherwise just persist.
	sm := s.registry.Get(name)
	if sm != nil {
		if err := s.registry.initializeOne(ctx, name); err != nil {
			return nil, fmt.Errorf("initialize %q failed: %w", name, err)
		}
	} else {
		_, _ = s.repo.SetInitializedTime(ctx, s.tenantID, name, models.StatusInitialized)
	}
	ep, err := s.repo.GetExtensionPoint(ctx, s.tenantID, name)
	if err != nil {
		return nil, err
	}
	summary := repository.ExtensionPointToSummary(*ep)
	return &summary, nil
}

// ShutdownExtension triggers shutdown of a single extension point.
func (s *ServiceEx) ShutdownExtension(ctx context.Context, name string) (*models.ExtensionSummary, error) {
	sm := s.registry.Get(name)
	if sm != nil {
		_ = s.registry.shutdownOne(ctx, name)
	} else {
		_, _ = s.repo.SetInitializedTime(ctx, s.tenantID, name, models.StatusDisabled)
	}
	ep, err := s.repo.GetExtensionPoint(ctx, s.tenantID, name)
	if err != nil {
		return nil, err
	}
	summary := repository.ExtensionPointToSummary(*ep)
	return &summary, nil
}

// GetExtensionStatus returns the persisted extension point status.
func (s *ServiceEx) GetExtensionStatus(ctx context.Context, name string) (*models.ExtensionSummary, error) {
	return s.GetExtension(ctx, name)
}

// ===========================================================================
// StartupTask CRUD
// ===========================================================================

// CreateStartup creates startup task(s) for the given extension names.
func (s *ServiceEx) CreateStartup(ctx context.Context, names []string) ([]models.StartupTask, error) {
	var tasks []models.StartupTask
	for _, name := range names {
		t := models.StartupTask{
			ID:          uuid.New().String(),
			ExtensionID: name,
			Name:        "init:" + name,
			Status:      models.TaskStatusPending,
		}
		if err := s.repo.CreateStartupTask(ctx, &t); err != nil {
			return nil, fmt.Errorf("create startup for %q failed: %w", name, err)
		}
		tasks = append(tasks, t)
	}
	return tasks, nil
}

// ListStartupTasks returns paginated startup tasks.
func (s *ServiceEx) ListStartupTasks(ctx context.Context, status string, offset, limit int) ([]models.StartupTask, int, error) {
	items, err := s.repo.ListStartupTasks(ctx, status, offset, limit)
	if err != nil {
		return nil, 0, fmt.Errorf("list startup tasks failed: %w", err)
	}
	var total int
	if status != "" {
		total, _ = s.repo.CountStartupTasksByStatus(ctx, status)
	} else {
		total, _ = s.repo.CountStartupTasks(ctx)
	}
	return items, total, nil
}

// GetStartupStatus returns the latest startup task for an extension.
func (s *ServiceEx) GetStartupStatus(ctx context.Context, name string) (*models.StartupTask, error) {
	t, err := s.repo.GetStartupTaskByExtension(ctx, name)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrStartupNotFound
		}
		return nil, fmt.Errorf("get startup status failed: %w", err)
	}
	return t, nil
}

// ===========================================================================
// Helpers
// ===========================================================================

func joinNames(m map[string]bool) string {
	var parts []string
	for k := range m {
		parts = append(parts, k)
	}
	return strings.Join(parts, ", ")
}
