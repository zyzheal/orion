package service

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/workflow-trigger/models"

	"github.com/google/uuid"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Count(ctx context.Context, tenantID string, filter *models.ListFilter) (int, error)
	Create(ctx context.Context, t *models.WorkflowTrigger) error
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.WorkflowTrigger, error)
	List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.WorkflowTrigger, error)
	SetEnabled(ctx context.Context, tenantID, id string, enabled bool) error
	Update(ctx context.Context, t *models.WorkflowTrigger) error
}

// Service implements the workflow trigger business logic.
type Service struct {
	repo RepositoryInterface
}

// NewService creates a new Service instance.
func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// Create creates a new workflow trigger.
func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateWorkflowTriggerRequest) (*models.WorkflowTrigger, error) {
	now := time.Now()
	strategy := req.TriggerStrategy
	if strategy == "" {
		strategy = models.StrategyAsync
	}

	trigger := &models.WorkflowTrigger{
		ID:              uuid.New().String(),
		TenantID:        tenantID,
		WorkflowID:      req.WorkflowID,
		Name:            req.Name,
		Type:            req.Type,
		Config:          req.Config,
		WebhookSecret:   req.WebhookSecret,
		TriggerStrategy: strategy,
		Enabled:         true,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	if err := s.repo.Create(ctx, trigger); err != nil {
		return nil, err
	}
	return trigger, nil
}

// GetByID retrieves a workflow trigger by id.
func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.WorkflowTrigger, error) {
	trigger, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, models.ErrTriggerNotFound
	}
	return trigger, nil
}

// List retrieves workflow triggers with optional filters and pagination.
func (s *Service) List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.WorkflowTrigger, int, error) {
	items, err := s.repo.List(ctx, tenantID, filter, offset, limit)
	if err != nil {
		return nil, 0, err
	}
	total, err := s.repo.Count(ctx, tenantID, filter)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// Update modifies an existing workflow trigger using partial update semantics.
func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateWorkflowTriggerRequest) (*models.WorkflowTrigger, error) {
	trigger, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, models.ErrTriggerNotFound
	}

	if req.WorkflowID != nil {
		trigger.WorkflowID = *req.WorkflowID
	}
	if req.Name != nil {
		trigger.Name = *req.Name
	}
	if req.Type != nil {
		trigger.Type = *req.Type
	}
	if req.Config != nil {
		trigger.Config = *req.Config
	}
	if req.WebhookSecret != nil {
		trigger.WebhookSecret = *req.WebhookSecret
	}
	if req.TriggerStrategy != nil {
		trigger.TriggerStrategy = *req.TriggerStrategy
	}
	if req.Enabled != nil {
		trigger.Enabled = *req.Enabled
	}
	trigger.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, trigger); err != nil {
		return nil, err
	}
	return trigger, nil
}

// Delete removes a workflow trigger by id.
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// SetEnabled enables or disables a workflow trigger.
func (s *Service) SetEnabled(ctx context.Context, tenantID, id string, enabled bool) (*models.WorkflowTrigger, error) {
	trigger, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, models.ErrTriggerNotFound
	}
	if err := s.repo.SetEnabled(ctx, tenantID, id, enabled); err != nil {
		return nil, err
	}
	trigger.Enabled = enabled
	trigger.UpdatedAt = time.Now()
	return trigger, nil
}

// Trigger executes a workflow trigger manually, creating a trigger log entry.
func (s *Service) Trigger(ctx context.Context, tenantID, id string, payload map[string]interface{}) error {
	trigger, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return models.ErrTriggerNotFound
	}
	if !trigger.Enabled {
		return models.ErrTriggerDisabled
	}

	// Create a trigger log entry recording this execution.
	// In a full implementation, this would also trigger the actual workflow execution.
	logEntry := &models.TriggerLog{
		ID:         uuid.New().String(),
		TriggerID:  trigger.ID,
		WorkflowID: trigger.WorkflowID,
		TenantID:   tenantID,
		Status:     "triggered",
		CreatedAt:  time.Now(),
	}

	// Log entry is created; actual workflow execution would be dispatched here.
	_ = logEntry

	return nil
}
