package repository

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/channel/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, channel *models.NotificationChannel) error {
	channel.ID = uuid.New().String()
	channel.CreatedAt = time.Now().UTC()
	if channel.Retry == 0 {
		channel.Retry = 3
	}
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO notification_channels (id, tenant_id, type, name, enabled, config, secret, retry, created_at)
		VALUES (:id, :tenantId, :type, :name, :enabled, :config, :secret, :retry, :createdAt)
	`, channel)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.NotificationChannel, error) {
	var channel models.NotificationChannel
	err := r.db.GetContext(ctx, &channel, `SELECT * FROM notification_channels WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return &channel, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, filter *models.ChannelFilter) ([]models.NotificationChannel, int, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.Type != nil {
			where += fmt.Sprintf(" AND type = $%d", argIdx)
			args = append(args, *filter.Type)
			argIdx++
		}
		if filter.Enabled != nil {
			where += fmt.Sprintf(" AND enabled = $%d", argIdx)
			args = append(args, *filter.Enabled)
			argIdx++
		}
		if filter.Limit > 0 {
			where += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
			args = append(args, filter.Limit, filter.Offset)
		}
	}

	var channels []models.NotificationChannel
	err := r.db.SelectContext(ctx, &channels, fmt.Sprintf(`SELECT * FROM notification_channels %s ORDER BY created_at DESC`, where), args...)
	if err != nil {
		return nil, 0, err
	}

	var total int
	err = r.db.GetContext(ctx, &total, `SELECT COUNT(*) FROM notification_channels WHERE tenant_id = $1`, tenantID)
	return channels, total, err
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.NotificationChannel, error) {
	if len(updates) == 0 {
		return nil, sentinel.NotFound
	}
	setClauses := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates)+2)
	idx := 1
	for k, v := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", k, idx))
		args = append(args, v)
		idx++
	}
	args = append(args, id, tenantID)
	_, err := r.db.ExecContext(ctx, fmt.Sprintf(`
		UPDATE notification_channels SET %s WHERE id = $%d AND tenant_id = $%d
	`, setClauses, len(args)-1, len(args)), args...)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, tenantID, id)
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx, `DELETE FROM notification_channels WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

func (r *Repository) ListEnabledByType(ctx context.Context, tenantID, channelType string) ([]models.NotificationChannel, error) {
	var channels []models.NotificationChannel
	err := r.db.SelectContext(ctx, &channels, `
		SELECT * FROM notification_channels
		WHERE tenant_id = $1 AND type = $2 AND enabled = true
		ORDER BY created_at DESC
	`, tenantID, channelType)
	return channels, err
}
