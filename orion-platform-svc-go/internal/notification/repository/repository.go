package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/notification/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// ErrNotFound indicates the requested resource does not exist.
var ErrNotFound = errors.New("not found")

// Repository provides data access for notifications.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new notification.
func (r *Repository) Create(ctx context.Context, n *models.Notification) error {
	n.ID = uuid.New().String()
	now := time.Now().UTC()
	n.CreatedAt = now
	n.UpdatedAt = now
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO notifications (id, tenant_id, user_id, title, body, notification_type, channel, status, priority, read, source_id, source_type, metadata, sent_at, read_at, created_at, updated_at)
		 VALUES (:id, :tenantId, :userId, :title, :body, :notificationType, :channel, :status, :priority, :read, :sourceId, :sourceType, :metadata, :sentAt, :readAt, :createdAt, :updatedAt)`,
		n)
	return err
}

// GetByID retrieves a notification by ID and tenant.
func (r *Repository) GetByID(ctx context.Context, id string, tenantID string) (*models.Notification, error) {
	var n models.Notification
	err := r.db.GetContext(ctx, &n,
		`SELECT * FROM notifications WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &n, nil
}

// List retrieves notifications for a tenant with optional filtering and pagination.
func (r *Repository) List(ctx context.Context, tenantID string, filter *models.ListFilter, limit int, offset int) ([]models.Notification, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.NotificationType != nil && *filter.NotificationType != "" {
			where += fmt.Sprintf(" AND notification_type = $%d", argIdx)
			args = append(args, *filter.NotificationType)
			argIdx++
		}
		if filter.Channel != nil && *filter.Channel != "" {
			where += fmt.Sprintf(" AND channel = $%d", argIdx)
			args = append(args, *filter.Channel)
			argIdx++
		}
		if filter.Status != nil && *filter.Status != "" {
			where += fmt.Sprintf(" AND status = $%d", argIdx)
			args = append(args, *filter.Status)
			argIdx++
		}
		if filter.Priority != nil && *filter.Priority != "" {
			where += fmt.Sprintf(" AND priority = $%d", argIdx)
			args = append(args, *filter.Priority)
			argIdx++
		}
		if filter.Read != nil {
			where += fmt.Sprintf(" AND read = $%d", argIdx)
			args = append(args, *filter.Read)
			argIdx++
		}
		if filter.UserID != nil && *filter.UserID != "" {
			where += fmt.Sprintf(" AND user_id = $%d", argIdx)
			args = append(args, *filter.UserID)
			argIdx++
		}
	}

	var notifications []models.Notification
	err := r.db.SelectContext(ctx, &notifications,
		fmt.Sprintf(`SELECT * FROM notifications %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, where, argIdx, argIdx+1),
		append(args, limit, offset)...)
	return notifications, err
}

// Count returns the total count of notifications for a tenant.
func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM notifications WHERE tenant_id=$1`, tenantID)
	return count, err
}

// ListByUser retrieves notifications for a specific user within a tenant.
func (r *Repository) ListByUser(ctx context.Context, tenantID string, userID string) ([]models.Notification, error) {
	var notifications []models.Notification
	err := r.db.SelectContext(ctx, &notifications,
		`SELECT * FROM notifications WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC`, tenantID, userID)
	return notifications, err
}

// Update modifies an existing notification with the given field updates.
func (r *Repository) Update(ctx context.Context, n *models.Notification) error {
	n.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE notifications SET status=:status, read=:read, updated_at=:updatedAt WHERE id=:id AND tenant_id=:tenantId`,
		n)
	return err
}

// Delete removes a notification by ID and tenant.
func (r *Repository) Delete(ctx context.Context, id string, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM notifications WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// MarkRead sets the read flag to true for a specific notification.
func (r *Repository) MarkRead(ctx context.Context, id string, tenantID string) error {
	now := time.Now().UTC()
	result, err := r.db.ExecContext(ctx,
		`UPDATE notifications SET read=true, read_at=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`,
		now, now, id, tenantID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// MarkAllRead sets the read flag to true for all notifications of a user.
func (r *Repository) MarkAllRead(ctx context.Context, tenantID string, userID string) error {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE notifications SET read=true, read_at=$1, updated_at=$2 WHERE tenant_id=$3 AND user_id=$4 AND read=false`,
		now, now, tenantID, userID)
	return err
}

// GetStats returns aggregate notification statistics for a tenant.
func (r *Repository) GetStats(ctx context.Context, tenantID string) (*models.NotificationStats, error) {
	var stats models.NotificationStats
	err := r.db.GetContext(ctx, &stats,
		`SELECT
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE NOT read) AS unread,
			COUNT(*) FILTER (WHERE status = 'sent') AS sent,
			COUNT(*) FILTER (WHERE status = 'failed') AS failed
		 FROM notifications WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	return &stats, nil
}

// UpdateFields performs a partial update using a map of column names to values.
func (r *Repository) UpdateFields(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.Notification, error) {
	if len(updates) == 0 {
		return nil, ErrNotFound
	}
	updates["updated_at"] = time.Now().UTC()
	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf(`UPDATE notifications SET %s WHERE id=$%d AND tenant_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, ErrNotFound
	}
	return r.GetByID(ctx, id, tenantID)
}
