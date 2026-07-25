package repository

import (
	"context"
	"fmt"
	"time"

	"orion/notification-svc-go/internal/notification/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// DashboardRepository provides data access for dashboard and widget records.
type DashboardRepository struct {
	db *sqlx.DB
}

// NewDashboardRepository creates a new DashboardRepository.
func NewDashboardRepository(db *sqlx.DB) *DashboardRepository {
	return &DashboardRepository{db: db}
}

// CreateDashboard inserts a new dashboard record.
func (r *DashboardRepository) CreateDashboard(ctx context.Context, d *models.Dashboard) error {
	d.ID = uuid.New().String()
	d.CreatedAt = time.Now()
	d.UpdatedAt = d.CreatedAt
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO dashboards (id, tenant_id, name, description, is_default, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		d.ID, d.TenantID, d.Name, d.Description, d.IsDefault, d.CreatedAt, d.UpdatedAt)
	return err
}

// GetDashboardByID returns a dashboard by id and tenant.
func (r *DashboardRepository) GetDashboardByID(ctx context.Context, tenantID, id string) (*models.Dashboard, error) {
	d := &models.Dashboard{}
	err := r.db.GetContext(ctx, d,
		`SELECT * FROM dashboards WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return d, nil
}

// ListDashboards returns all dashboards for a tenant.
func (r *DashboardRepository) ListDashboards(ctx context.Context, tenantID string) ([]models.Dashboard, error) {
	var items []models.Dashboard
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM dashboards WHERE tenant_id=$1 ORDER BY is_default DESC, created_at ASC`, tenantID)
	return items, err
}

// UpdateDashboard updates a dashboard record.
func (r *DashboardRepository) UpdateDashboard(ctx context.Context, d *models.Dashboard) error {
	d.UpdatedAt = time.Now()
	_, err := r.db.ExecContext(ctx,
		`UPDATE dashboards SET name=$1, description=$2, is_default=$3, updated_at=$4 WHERE id=$5 AND tenant_id=$6`,
		d.Name, d.Description, d.IsDefault, d.UpdatedAt, d.ID, d.TenantID)
	return err
}

// DeleteDashboard deletes a dashboard and its widgets by id and tenant.
func (r *DashboardRepository) DeleteDashboard(ctx context.Context, tenantID, id string) error {
	// Delete widgets first (foreign key constraint)
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM dashboard_widgets WHERE dashboard_id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx,
		`DELETE FROM dashboards WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// GetDefaultDashboard returns the default dashboard for a tenant, creating one if none exists.
func (r *DashboardRepository) GetDefaultDashboard(ctx context.Context, tenantID string) (*models.Dashboard, error) {
	var d models.Dashboard
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM dashboards WHERE tenant_id=$1 AND is_default=true LIMIT 1`, tenantID)
	if err != nil {
		// Create a default dashboard
		d = models.Dashboard{
			ID:       uuid.New().String(),
			TenantID: tenantID,
			Name:     "Default Dashboard",
			IsDefault: true,
		}
		if err := r.CreateDashboard(ctx, &d); err != nil {
			return nil, fmt.Errorf("failed to create default dashboard: %w", err)
		}
		// Seed default widgets
		now := time.Now()
		widgets := []models.DashboardWidget{
			{DashboardID: d.ID, TenantID: tenantID, Name: "Total Notifications", Type: models.WidgetTypeTotalNotifications, Position: 0, Size: "small", Enabled: true},
			{DashboardID: d.ID, TenantID: tenantID, Name: "Delivery Status", Type: models.WidgetTypeDeliveryStatus, Position: 1, Size: "medium", Enabled: true},
			{DashboardID: d.ID, TenantID: tenantID, Name: "Failure Rate", Type: models.WidgetTypeFailureRate, Position: 2, Size: "medium", Enabled: true},
			{DashboardID: d.ID, TenantID: tenantID, Name: "Recent Activity", Type: models.WidgetTypeRecentActivity, Position: 3, Size: "large", Enabled: true},
		}
		for i := range widgets {
			widgets[i].ID = uuid.New().String()
			widgets[i].CreatedAt = now
			widgets[i].UpdatedAt = now
			if err := r.CreateWidget(ctx, &widgets[i]); err != nil {
				return nil, fmt.Errorf("failed to create default widget: %w", err)
			}
		}
		return &d, nil
	}
	return &d, nil
}

// ==================== Widget CRUD ====================

// CreateWidget inserts a new widget record.
func (r *DashboardRepository) CreateWidget(ctx context.Context, w *models.DashboardWidget) error {
	w.ID = uuid.New().String()
	w.CreatedAt = time.Now()
	w.UpdatedAt = w.CreatedAt
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO dashboard_widgets (id, dashboard_id, tenant_id, name, type, position, size, config, enabled, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		w.ID, w.DashboardID, w.TenantID, w.Name, w.Type, w.Position, w.Size, w.Config, w.Enabled, w.CreatedAt, w.UpdatedAt)
	return err
}

// GetWidgetByID returns a widget by id and tenant.
func (r *DashboardRepository) GetWidgetByID(ctx context.Context, tenantID, id string) (*models.DashboardWidget, error) {
	w := &models.DashboardWidget{}
	err := r.db.GetContext(ctx, w,
		`SELECT * FROM dashboard_widgets WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return w, nil
}

// ListWidgetsByDashboard returns all widgets for a dashboard, ordered by position.
func (r *DashboardRepository) ListWidgetsByDashboard(ctx context.Context, dashboardID string) ([]models.DashboardWidget, error) {
	var items []models.DashboardWidget
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM dashboard_widgets WHERE dashboard_id=$1 ORDER BY position ASC`, dashboardID)
	return items, err
}

// UpdateWidget updates a widget record.
func (r *DashboardRepository) UpdateWidget(ctx context.Context, w *models.DashboardWidget) error {
	w.UpdatedAt = time.Now()
	_, err := r.db.ExecContext(ctx,
		`UPDATE dashboard_widgets SET name=$1, type=$2, position=$3, size=$4, config=$5, enabled=$6, updated_at=$7
		 WHERE id=$8 AND tenant_id=$9`,
		w.Name, w.Type, w.Position, w.Size, w.Config, w.Enabled, w.UpdatedAt, w.ID, w.TenantID)
	return err
}

// DeleteWidget deletes a widget by id and tenant.
func (r *DashboardRepository) DeleteWidget(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM dashboard_widgets WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ==================== Dashboard Stats ====================

// DashboardStatsCount returns aggregate counts for dashboard overview.
func (r *DashboardRepository) DashboardStatsCount(ctx context.Context, tenantID string) (*models.DashboardOverview, error) {
	var total, pending, delivered, failed, channelsEnabled, templatesActive int64

	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM notifications WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &pending,
		`SELECT COUNT(*) FROM notifications WHERE tenant_id=$1 AND status='pending'`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &delivered,
		`SELECT COUNT(*) FROM notifications WHERE tenant_id=$1 AND status='sent'`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &failed,
		`SELECT COUNT(*) FROM notifications WHERE tenant_id=$1 AND status='failed'`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &channelsEnabled,
		`SELECT COUNT(*) FROM notification_channels WHERE tenant_id=$1 AND enabled=true`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &templatesActive,
		`SELECT COUNT(*) FROM notification_templates WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}

	// Get recent deliveries
	var recentDeliveries []models.NotificationDelivery
	err = r.db.SelectContext(ctx, &recentDeliveries,
		`SELECT * FROM notification_deliveries WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 10`, tenantID)
	if err != nil {
		return nil, err
	}

	return &models.DashboardOverview{
		TotalNotifications: total,
		PendingCount:       pending,
		DeliveredCount:     delivered,
		FailedCount:        failed,
		ChannelsEnabled:    channelsEnabled,
		ActiveTemplates:    templatesActive,
		RecentDeliveries:   recentDeliveries,
	}, nil
}
