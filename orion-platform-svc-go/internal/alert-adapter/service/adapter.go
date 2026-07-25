// Package service (adapter) provides the service layer that bridges the
// AlertAdapterFactory SPI with the handler's Service interface.
//
// This adapter wraps the factory and adds adapter CRUD operations (update,
// delete) that the factory defers to the repository.
package service

import (
	"context"
	"encoding/json"
	"errors"

	"orion/platform-svc-go/internal/alert-adapter/models"
	"orion/platform-svc-go/internal/alert-adapter/repository"

	"github.com/google/uuid"
)

// AdapterService implements the handler Service interface on top of Factory + repo.
type AdapterService struct {
	factory *AlertAdapterFactory
	repo    *repository.Repository
}

// NewAdapterService creates a new AdapterService.
func NewAdapterService(factory *AlertAdapterFactory, repo *repository.Repository) *AdapterService {
	return &AdapterService{factory: factory, repo: repo}
}

// AdapterHealth returns the service health.
func (s *AdapterService) AdapterHealth(ctx context.Context) (string, error) {
	return "ok", nil
}

// CreateAdapter delegates to the factory.
func (s *AdapterService) CreateAdapter(ctx context.Context, tenantID, name, atype, category string, config map[string]string) (*models.AlertAdapter, error) {
	return s.factory.CreateAdapter(ctx, tenantID, name, atype, category, config)
}

// ListAdapters delegates to the factory.
func (s *AdapterService) ListAdapters(ctx context.Context, tenantID string) ([]models.AlertAdapter, error) {
	return s.factory.ListAdapters(ctx, tenantID)
}

// GetAdapter delegates to the factory.
func (s *AdapterService) GetAdapter(ctx context.Context, tenantID, id string) (*models.AlertAdapter, error) {
	return s.factory.GetAdapter(ctx, tenantID, id)
}

// UpdateAdapter updates an adapter's mutable fields.
func (s *AdapterService) UpdateAdapter(ctx context.Context, tenantID, id string, req *models.UpdateAdapterRequest) (*models.AlertAdapter, error) {
	a, err := s.repo.GetAdapterByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrAdapterNotFound
		}
		return nil, err
	}
	if tenantID != "" && a.TenantID != tenantID {
		return nil, ErrAdapterNotFound
	}

	// Validate status if provided
	if req.Status != nil {
		if !models.ValidAdapterStatuses[*req.Status] {
			return nil, ErrInvalidStatus
		}
	}

	// Marshal config if provided
	var cfgJSON *string
	if req.Config != nil {
		b, err := json.Marshal(*req.Config)
		if err != nil {
			return nil, ErrInvalidConfig
		}
		s := string(b)
		cfgJSON = &s
	}

	if err := s.repo.UpdateAdapter(ctx, id, req.Name, req.Type, req.Category, cfgJSON, req.Enabled, req.Status, req.Error); err != nil {
		return nil, err
	}

	updated, err := s.repo.GetAdapterByID(ctx, id)
	return updated, err
}

// DeleteAdapter deletes an adapter after tenant verification.
func (s *AdapterService) DeleteAdapter(ctx context.Context, tenantID, id string) error {
	a, err := s.repo.GetAdapterByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return ErrAdapterNotFound
		}
		return err
	}
	if tenantID != "" && a.TenantID != tenantID {
		return ErrAdapterNotFound
	}
	return s.repo.DeleteAdapter(ctx, id)
}

// SendToAdapter delegates to the factory.
func (s *AdapterService) SendToAdapter(ctx context.Context, adapterID string, alert map[string]interface{}) (*models.AlertEvent, error) {
	return s.factory.SendToAdapter(ctx, adapterID, alert)
}

// ReceiveFromAdapter delegates to the factory.
func (s *AdapterService) ReceiveFromAdapter(ctx context.Context, adapterID string) ([]models.AlertEvent, error) {
	return s.factory.ReceiveFromAdapter(ctx, adapterID)
}

// ListEvents delegates to the factory.
func (s *AdapterService) ListEvents(ctx context.Context, tenantID, adapterID, status string, offset, limit int) ([]models.AlertEvent, error) {
	return s.factory.ListEvents(ctx, tenantID, adapterID, status, offset, limit)
}

// ---------------------------------------------------------------------------
// Helper: validate adapter name uniqueness for registration
// ---------------------------------------------------------------------------

// IsAdapterNameTaken checks if a name is already used within a tenant.
func IsAdapterNameTaken(repo *repository.Repository, ctx context.Context, tenantID, name string) (bool, error) {
	items, err := repo.ListAdapters(ctx, tenantID, "", "", 0, 10)
	if err != nil {
		return false, err
	}
	for _, a := range items {
		if a.Name == name {
			return true, nil
		}
	}
	return false, nil
}

// EnsureID sets a UUID if empty.
func EnsureID(s *string) {
	if *s == "" {
		*s = uuid.New().String()
	}
}
