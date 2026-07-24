package service

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/notification/notification/models"
	"orion/platform-svc-go/internal/notification/notification/repository"

	"go.uber.org/zap"
)

// ErrDashboardNotFound is returned when a dashboard lookup fails.
var ErrDashboardNotFound = fmt.Errorf("dashboard not found")

// ErrWidgetNotFound is returned when a widget lookup fails.
var ErrWidgetNotFound = fmt.Errorf("widget not found")

// DashboardService provides business logic for dashboard management.
type DashboardService struct {
	repo   *repository.DashboardRepository
	logger *zap.Logger
}

// NewDashboardService creates a new DashboardService.
func NewDashboardService(repo *repository.DashboardRepository, logger *zap.Logger) *DashboardService {
	return &DashboardService{repo: repo, logger: logger}
}

// ==================== Dashboard Operations ====================

// CreateDashboard creates a new dashboard for a tenant.
func (s *DashboardService) CreateDashboard(ctx context.Context, tenantID string, d *models.Dashboard) error {
	d.TenantID = tenantID
	return s.repo.CreateDashboard(ctx, d)
}

// GetDashboard returns a dashboard by id for a tenant.
func (s *DashboardService) GetDashboard(ctx context.Context, tenantID, id string) (*models.Dashboard, error) {
	d, err := s.repo.GetDashboardByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrDashboardNotFound
	}
	return d, nil
}

// ListDashboards returns all dashboards for a tenant.
func (s *DashboardService) ListDashboards(ctx context.Context, tenantID string) ([]models.Dashboard, error) {
	return s.repo.ListDashboards(ctx, tenantID)
}

// GetDefaultDashboard returns the default dashboard for a tenant, creating it if needed.
func (s *DashboardService) GetDefaultDashboard(ctx context.Context, tenantID string) (*models.Dashboard, error) {
	return s.repo.GetDefaultDashboard(ctx, tenantID)
}

// UpdateDashboard updates a dashboard.
func (s *DashboardService) UpdateDashboard(ctx context.Context, tenantID, id string, d *models.Dashboard) error {
	d.ID = id
	d.TenantID = tenantID
	if err := s.repo.UpdateDashboard(ctx, d); err != nil {
		return ErrDashboardNotFound
	}
	return nil
}

// DeleteDashboard deletes a dashboard.
func (s *DashboardService) DeleteDashboard(ctx context.Context, tenantID, id string) error {
	if err := s.repo.DeleteDashboard(ctx, tenantID, id); err != nil {
		return ErrDashboardNotFound
	}
	return nil
}

// ==================== Widget Operations ====================

// CreateWidget creates a widget for a dashboard.
func (s *DashboardService) CreateWidget(ctx context.Context, tenantID, dashboardID string, w *models.DashboardWidget) error {
	// Verify dashboard exists
	dash, err := s.repo.GetDashboardByID(ctx, tenantID, dashboardID)
	if err != nil {
		return ErrDashboardNotFound
	}
	w.DashboardID = dashboardID
	w.TenantID = tenantID
	// Use dashboard's tenant for widget
	_ = dash
	return s.repo.CreateWidget(ctx, w)
}

// GetWidget returns a widget by id.
func (s *DashboardService) GetWidget(ctx context.Context, tenantID, id string) (*models.DashboardWidget, error) {
	w, err := s.repo.GetWidgetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrWidgetNotFound
	}
	return w, nil
}

// ListWidgets returns all widgets for a dashboard.
func (s *DashboardService) ListWidgets(ctx context.Context, tenantID, dashboardID string) ([]models.DashboardWidget, error) {
	// Verify dashboard exists
	if _, err := s.repo.GetDashboardByID(ctx, tenantID, dashboardID); err != nil {
		return nil, ErrDashboardNotFound
	}
	return s.repo.ListWidgetsByDashboard(ctx, dashboardID)
}

// UpdateWidget updates a widget.
func (s *DashboardService) UpdateWidget(ctx context.Context, tenantID, id string, w *models.DashboardWidget) error {
	w.ID = id
	w.TenantID = tenantID
	if err := s.repo.UpdateWidget(ctx, w); err != nil {
		return ErrWidgetNotFound
	}
	return nil
}

// DeleteWidget deletes a widget.
func (s *DashboardService) DeleteWidget(ctx context.Context, tenantID, id string) error {
	if err := s.repo.DeleteWidget(ctx, tenantID, id); err != nil {
		return ErrWidgetNotFound
	}
	return nil
}

// ==================== Overview ====================

// GetOverview returns a dashboard overview with aggregated stats.
func (s *DashboardService) GetOverview(ctx context.Context, tenantID string) (*models.DashboardOverview, error) {
	return s.repo.DashboardStatsCount(ctx, tenantID)
}
