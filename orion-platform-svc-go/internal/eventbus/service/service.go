package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"orion/platform-svc-go/internal/eventbus/models"

	"github.com/google/uuid"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Count(ctx context.Context, tenantID string) (int, error)
	Create(ctx context.Context, event *models.Event) error
	List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.Event, error)
}

// ErrEventNotFound indicates no event matched the query.
var ErrEventNotFound = errors.New("event not found")

// Service provides business logic for the event bus.
type Service struct {
	repo    RepositoryInterface
	busConn *busConn
}

// NewService creates a new event bus service.
func NewService(repo RepositoryInterface) *Service {
	return &Service{
		repo:    repo,
		busConn: newBusConn(),
	}
}

// Publish publishes a new event and returns it.
func (s *Service) Publish(ctx context.Context, tenantID string, userID string, req *models.PublishRequest) (*models.Event, error) {
	event := &models.Event{
		Type:          req.Type,
		Payload:       req.Payload,
		Source:        req.Source,
		TenantID:      tenantID,
		UserID:        userID,
		CorrelationID: req.CorrelationID,
		CausationID:   req.CausationID,
		OccurredAt:    time.Now().UTC(),
	}
	if userID == "" {
		event.UserID = uuid.New().String()
	}
	if err := s.repo.Create(ctx, event); err != nil {
		return nil, err
	}
	return event, nil
}

// List returns paginated events for a tenant with an optional type filter.
func (s *Service) List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.Event, error) {
	events, err := s.repo.List(ctx, tenantID, filter, offset, limit)
	if err != nil {
		if err == sql.ErrNoRows {
			return []models.Event{}, nil
		}
		return nil, err
	}
	if events == nil {
		events = []models.Event{}
	}
	return events, nil
}

// Count returns the total number of events for a tenant.
func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}
