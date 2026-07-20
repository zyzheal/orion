package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/event-trigger/models"

	"github.com/google/uuid"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Count(ctx context.Context, tenantID string) (int, error)
	Create(ctx context.Context, t *models.EventTrigger) error
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.EventTrigger, error)
	List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.EventTrigger, error)
	Update(ctx context.Context, t *models.EventTrigger) error
}

// Service provides business logic for event triggers.
type Service struct {
	repo RepositoryInterface
}

// NewService creates a new Service.
func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// Create validates a create request and persists a new trigger.
func (s *Service) Create(ctx context.Context, tenantID, userID string, req *models.CreateTriggerRequest) (*models.EventTrigger, error) {
	enabled := req.Enabled != nil && *req.Enabled
	t := &models.EventTrigger{
		ID:          uuid.New().String(),
		Name:        req.Name,
		EventType:   req.EventType,
		Action:      req.Action,
		Target:      req.Target,
		Enabled:     enabled,
		Description: req.Description,
		TenantID:    tenantID,
		UserID:      userID,
	}
	if err := s.repo.Create(ctx, t); err != nil {
		return nil, fmt.Errorf("create trigger failed: %w", err)
	}
	return t, nil
}

// GetByID returns a single trigger by id.
func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.EventTrigger, error) {
	t, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("%w: trigger %s", sentinel.NotFound, id)
	}
	return t, nil
}

// List returns paginated triggers for a tenant.
func (s *Service) List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.EventTrigger, error) {
	return s.repo.List(ctx, tenantID, filter, offset, limit)
}

// Count returns total trigger count for a tenant.
func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}

// Update modifies an existing trigger's mutable fields.
func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateTriggerRequest) (*models.EventTrigger, error) {
	existing, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("%w: trigger %s", sentinel.NotFound, id)
	}

	// Apply non-empty request fields over existing values.
	name := req.Name
	if name == "" {
		name = existing.Name
	}
	eventType := req.EventType
	if eventType == "" {
		eventType = existing.EventType
	}
	action := req.Action
	if action == "" {
		action = existing.Action
	}
	target := req.Target
	if target == "" {
		target = existing.Target
	}
	enabled := req.Enabled
	if enabled == nil {
		enabled = &existing.Enabled
	}
	description := req.Description
	if req.Description == "" {
		description = existing.Description
	}

	updated := &models.EventTrigger{
		ID:          existing.ID,
		Name:        name,
		EventType:   eventType,
		Action:      action,
		Target:      target,
		Enabled:     *enabled,
		Description: description,
		TenantID:    tenantID,
		UserID:      existing.UserID,
	}
	if err := s.repo.Update(ctx, updated); err != nil {
		return nil, fmt.Errorf("update trigger failed: %w", err)
	}
	return updated, nil
}

// Delete removes a trigger by id.
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}
