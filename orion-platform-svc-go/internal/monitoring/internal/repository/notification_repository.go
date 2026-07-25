package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"orion/platform-svc-go/internal/monitoring/internal/models"
	"go.uber.org/zap"
)

// NotificationChannelRepository manages notification channels.
type NotificationChannelRepository struct {
	db *DB
}

func NewNotificationChannelRepository(db *DB) *NotificationChannelRepository {
	return &NotificationChannelRepository{db: db}
}

func (r *NotificationChannelRepository) CreateChannel(ctx context.Context, cfg *models.NotificationChannel) error {
	now := time.Now()
	query := `INSERT INTO notification_channels (id, tenant_id, name, type, config, is_enabled, severity_filter, created_at, updated_at)
	VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`
	_, err := r.db.Pool().Exec(ctx, query,
		cfg.ID, cfg.TenantID, cfg.Name, cfg.Type, cfg.Config, cfg.IsEnabled, cfg.SeverityFilter, now, now,
	)
	if err != nil {
		r.db.Logger().Error("failed to create notification channel",
			zap.String("name", cfg.Name),
			zap.Error(err),
		)
		return fmt.Errorf("create notification channel: %w", err)
	}
	return nil
}

func (r *NotificationChannelRepository) GetByID(ctx context.Context, tenantID, id uuid.UUID) (*models.NotificationChannel, error) {
	query := `SELECT id, tenant_id, name, type, config, is_enabled, severity_filter, created_at, updated_at
	FROM notification_channels WHERE tenant_id = $1 AND id = $2`
	var c models.NotificationChannel
	err := r.db.Pool().QueryRow(ctx, query, tenantID, id).Scan(
		&c.ID, &c.TenantID, &c.Name, &c.Type, &c.Config, &c.IsEnabled, &c.SeverityFilter, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get notification channel: %w", err)
	}
	return &c, nil
}

func (r *NotificationChannelRepository) ListChannels(ctx context.Context, tenantID uuid.UUID) (models.NotificationChannelResponse, error) {
	var resp models.NotificationChannelResponse

	countQuery := `SELECT COUNT(*) FROM notification_channels WHERE tenant_id = $1`
	if err := r.db.Pool().QueryRow(ctx, countQuery, tenantID).Scan(&resp.Total); err != nil {
		r.db.Logger().Error("failed to count notification channels", zap.Error(err))
		return resp, fmt.Errorf("count notification channels: %w", err)
	}

	query := `SELECT id, tenant_id, name, type, config, is_enabled, severity_filter, created_at, updated_at
	FROM notification_channels WHERE tenant_id = $1 ORDER BY created_at DESC`
	rows, err := r.db.Pool().Query(ctx, query, tenantID)
	if err != nil {
		r.db.Logger().Error("failed to query notification channels", zap.Error(err))
		return resp, fmt.Errorf("query notification channels: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var c models.NotificationChannel
		if err := rows.Scan(&c.ID, &c.TenantID, &c.Name, &c.Type, &c.Config, &c.IsEnabled, &c.SeverityFilter, &c.CreatedAt, &c.UpdatedAt); err != nil {
			continue
		}
		resp.Data = append(resp.Data, c)
	}
	return resp, nil
}

func (r *NotificationChannelRepository) UpdateChannel(ctx context.Context, tenantID, id uuid.UUID, enabled bool) error {
	query := `UPDATE notification_channels SET is_enabled = $3, updated_at = NOW() WHERE tenant_id = $1 AND id = $2`
	tag, err := r.db.Pool().Exec(ctx, query, tenantID, id, enabled)
	if err != nil {
		return fmt.Errorf("update notification channel: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("notification channel not found")
	}
	return nil
}

func (r *NotificationChannelRepository) DeleteChannel(ctx context.Context, tenantID, id uuid.UUID) error {
	query := `DELETE FROM notification_channels WHERE tenant_id = $1 AND id = $2`
	tag, err := r.db.Pool().Exec(ctx, query, tenantID, id)
	if err != nil {
		return fmt.Errorf("delete notification channel: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("notification channel not found")
	}
	return nil
}
