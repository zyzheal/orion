package service

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/page-registry/models"
	"orion/platform-svc-go/internal/page-registry/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// Create creates a new page registry entry. Returns conflict error if path exists.
func (s *Service) Create(ctx context.Context, tenantID string, req models.CreatePageRegistryRequest) (*models.PageRegistry, error) {
	// Check for path conflict
	exists, err := s.repo.PathExists(ctx, tenantID, req.Path)
	if err != nil {
		return nil, fmt.Errorf("failed to check path existence: %w", err)
	}
	if exists {
		return nil, fmt.Errorf("path already exists: %s", req.Path)
	}

	m := &models.PageRegistry{
		TenantID:  tenantID,
		Path:      req.Path,
		Component: req.Component,
		Protected: req.Protected,
		Permission: req.Permission,
		HideLayout: req.HideLayout,
		MicroApp:  req.MicroApp,
		SubAppKey: req.SubAppKey,
		MenuKey:   req.MenuKey,
		MenuLabel: req.MenuLabel,
		MenuIcon:  req.MenuIcon,
		Hidden:    req.Hidden,
		RedirectTo: req.RedirectTo,
		Title:     req.Title,
		Breadcrumb: req.Breadcrumb,
		SortOrder: req.SortOrder,
		Status:    defaultStatus(req.Status),
	}

	if err := s.repo.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

// GetAll returns all page registry entries for the tenant.
func (s *Service) GetAll(ctx context.Context, tenantID string) ([]models.PageRegistry, error) {
	return s.repo.GetAll(ctx, tenantID)
}

// GetEnabled returns only enabled page registry entries for the tenant.
func (s *Service) GetEnabled(ctx context.Context, tenantID string) ([]models.PageRegistry, error) {
	return s.repo.GetEnabled(ctx, tenantID)
}

// GetByPath returns a single page registry entry by its path.
func (s *Service) GetByPath(ctx context.Context, tenantID, path string) (*models.PageRegistry, error) {
	return s.repo.GetByPath(ctx, tenantID, path)
}

// Update updates a page registry entry by its path.
func (s *Service) Update(ctx context.Context, tenantID, path string, req models.UpdatePageRegistryRequest) (*models.PageRegistry, error) {
	updates := make(map[string]interface{})
	if req.Path != nil {
		// Check if new path conflicts with another entry
		exists, err := s.repo.PathExists(ctx, tenantID, *req.Path)
		if err != nil {
			return nil, fmt.Errorf("failed to check path existence: %w", err)
		}
		if exists && *req.Path != path {
			return nil, fmt.Errorf("path already exists: %s", *req.Path)
		}
		updates["path"] = *req.Path
	}
	if req.Component != nil {
		updates["component"] = *req.Component
	}
	if req.Protected != nil {
		updates["protected"] = *req.Protected
	}
	if req.Permission != nil {
		updates["permission"] = *req.Permission
	}
	if req.HideLayout != nil {
		updates["hide_layout"] = *req.HideLayout
	}
	if req.MicroApp != nil {
		updates["micro_app"] = *req.MicroApp
	}
	if req.SubAppKey != nil {
		updates["sub_app_key"] = *req.SubAppKey
	}
	if req.MenuKey != nil {
		updates["menu_key"] = *req.MenuKey
	}
	if req.MenuLabel != nil {
		updates["menu_label"] = *req.MenuLabel
	}
	if req.MenuIcon != nil {
		updates["menu_icon"] = *req.MenuIcon
	}
	if req.Hidden != nil {
		updates["hidden"] = *req.Hidden
	}
	if req.RedirectTo != nil {
		updates["redirect_to"] = *req.RedirectTo
	}
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Breadcrumb != nil {
		updates["breadcrumb"] = *req.Breadcrumb
	}
	if req.SortOrder != nil {
		updates["sort_order"] = *req.SortOrder
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}

	m, err := s.repo.Update(ctx, tenantID, path, updates)
	if err != nil {
		return nil, err
	}
	return m, nil
}

// Delete deletes a page registry entry by its path.
func (s *Service) Delete(ctx context.Context, tenantID, path string) error {
	return s.repo.Delete(ctx, tenantID, path)
}

// ToggleStatus toggles a page entry between enabled and disabled.
func (s *Service) ToggleStatus(ctx context.Context, tenantID, path string) (*models.PageRegistry, error) {
	return s.repo.ToggleStatus(ctx, tenantID, path)
}

// GetHistory returns history entries for a given page path.
func (s *Service) GetHistory(ctx context.Context, tenantID, path string) ([]models.PageRegistryHistory, error) {
	return s.repo.GetHistory(ctx, tenantID, path)
}

// defaultStatus returns "enabled" if no status provided.
func defaultStatus(status *string) string {
	if status != nil && *status == "disabled" {
		return "disabled"
	}
	return "enabled"
}
