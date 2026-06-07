package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/orion-platform/orion-monitor-svc-go/internal/models"
	"go.uber.org/zap"
)

// DashboardRepository manages dashboard widget configurations.
type DashboardRepository struct {
	db *DB
}

func NewDashboardRepository(db *DB) *DashboardRepository {
	return &DashboardRepository{db: db}
}

// CreateWidgetConfig inserts a new widget configuration.
func (r *DashboardRepository) CreateWidgetConfig(ctx context.Context, cfg *models.DashboardWidgetConfig) error {
	query := `INSERT INTO dashboard_widgets (id, tenant_id, title, metrics, time_window, tags, sort_order, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
	_, err := r.db.Pool().Exec(ctx, query,
		cfg.ID, cfg.TenantID, cfg.Title, cfg.Metrics, cfg.TimeWindow, cfg.Tags, cfg.SortOrder, cfg.CreatedAt,
	)
	if err != nil {
		r.db.Logger().Error("failed to create widget config",
			zap.String("title", cfg.Title),
			zap.Error(err),
		)
		return fmt.Errorf("create widget config: %w", err)
	}
	return nil
}

// GetWidgetConfigs returns all widget configs for a tenant.
func (r *DashboardRepository) GetWidgetConfigs(ctx context.Context, tenantID uuid.UUID) ([]models.DashboardWidgetConfig, error) {
	query := `SELECT id, tenant_id, title, metrics, time_window, tags, sort_order, created_at
FROM dashboard_widgets WHERE tenant_id = $1 ORDER BY sort_order`
	rows, err := r.db.Pool().Query(ctx, query, tenantID)
	if err != nil {
		return nil, fmt.Errorf("query widget configs: %w", err)
	}
	defer rows.Close()

	var configs []models.DashboardWidgetConfig
	for rows.Next() {
		var c models.DashboardWidgetConfig
		if err := rows.Scan(&c.ID, &c.TenantID, &c.Title, &c.Metrics, &c.TimeWindow, &c.Tags, &c.SortOrder, &c.CreatedAt); err != nil {
			r.db.Logger().Error("failed to scan widget config", zap.Error(err))
			continue
		}
		configs = append(configs, c)
	}
	return configs, nil
}

// DeleteWidgetConfig removes a widget config by ID.
func (r *DashboardRepository) DeleteWidgetConfig(ctx context.Context, tenantID, id uuid.UUID) error {
	query := `DELETE FROM dashboard_widgets WHERE tenant_id = $1 AND id = $2`
	tag, err := r.db.Pool().Exec(ctx, query, tenantID, id)
	if err != nil {
		return fmt.Errorf("delete widget config: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("widget config not found")
	}
	return nil
}

// DeleteAllWidgetConfigs removes all widget configs for a tenant.
func (r *DashboardRepository) DeleteAllWidgetConfigs(ctx context.Context, tenantID uuid.UUID) error {
	query := `DELETE FROM dashboard_widgets WHERE tenant_id = $1`
	_, err := r.db.Pool().Exec(ctx, query, tenantID)
	if err != nil {
		return fmt.Errorf("delete all widget configs: %w", err)
	}
	return nil
}

// WidgetMetrics extracts metric names from a widget config's JSON field.
func WidgetMetrics(metricsJSON json.RawMessage) []string {
	var names []string
	if err := json.Unmarshal(metricsJSON, &names); err != nil {
		return nil
	}
	return names
}
