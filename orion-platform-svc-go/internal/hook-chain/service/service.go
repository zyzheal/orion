package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/hook-chain/models"
	"orion/platform-svc-go/internal/hook-chain/repository"

	"github.com/google/uuid"
)

// Service coordinates business logic for hook management.
type Service struct {
	repo *repository.Repository
}

// ErrNotFound is returned when a hook cannot be located.
var ErrNotFound = errors.New("hook not found")

// NewService creates a new Service instance.
func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// Create creates a new hook.
func (s *Service) Create(ctx context.Context, tenantID, userID string, req *models.CreateHookRequest) (*models.Hook, error) {
	if req.Name == "" {
		return nil, fmt.Errorf("name is required")
	}

	now := time.Now()
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	hook := &models.Hook{
		ID:          uuid.New().String(),
		Name:        req.Name,
		Description: req.Description,
		Trigger:     req.Trigger,
		Action:      req.Action,
		Config:      req.Config,
		Enabled:     enabled,
		TenantID:    tenantID,
		UserID:      userID,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.repo.Create(ctx, hook); err != nil {
		return nil, fmt.Errorf("failed to create hook: %w", err)
	}
	return hook, nil
}

// GetByID retrieves a single hook by id.
func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.Hook, error) {
	hook, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrNotFound
	}
	return hook, nil
}

// List retrieves hooks with optional filters and pagination.
func (s *Service) List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.Hook, error) {
	hooks, err := s.repo.List(ctx, tenantID, filter, offset, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list hooks: %w", err)
	}
	return hooks, nil
}

// Count returns the total number of hooks for the tenant.
func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	count, err := s.repo.Count(ctx, tenantID)
	if err != nil {
		return 0, fmt.Errorf("failed to count hooks: %w", err)
	}
	return count, nil
}

// Update modifies an existing hook.
func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateHookRequest) (*models.Hook, error) {
	existing, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrNotFound
	}

	if req.Name != "" {
		existing.Name = req.Name
	}
	if req.Description != "" {
		existing.Description = req.Description
	}
	if req.Trigger != "" {
		existing.Trigger = req.Trigger
	}
	if req.Action != "" {
		existing.Action = req.Action
	}
	if req.Config != "" {
		existing.Config = req.Config
	}
	if req.Enabled != nil {
		existing.Enabled = *req.Enabled
	}
	existing.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, existing); err != nil {
		return nil, fmt.Errorf("failed to update hook: %w", err)
	}
	return existing, nil
}

// Delete removes a hook by id.
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	if err := s.repo.Delete(ctx, tenantID, id); err != nil {
		return ErrNotFound
	}
	return nil
}
