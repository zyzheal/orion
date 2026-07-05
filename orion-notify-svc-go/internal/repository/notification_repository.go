package repository

import (
	"context"
	"fmt"
	"strings"

	"orion/notify-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

// NotificationRepository provides access to the notifications table.
// Ported from orion-platform-service NotificationRepository.ts
type NotificationRepository struct {
	db *sqlx.DB
}

func NewNotificationRepository(db *sqlx.DB) *NotificationRepository {
	return &NotificationRepository{db: db}
}

// Create inserts a new in-app notification with status 'pending'.
func (r *NotificationRepository) Create(ctx context.Context, n *models.Notification) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO notifications (id, tenant_id, user_id, type, title, message, channel, status)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
		n.ID, n.TenantID, n.UserID, n.Type, n.Title, n.Message, n.Channel)
	return err
}

// FindByID returns a single notification by its primary key.
func (r *NotificationRepository) FindByID(ctx context.Context, id string) (*models.Notification, error) {
	var n models.Notification
	err := r.db.GetContext(ctx, &n,
		`SELECT * FROM notifications WHERE id = $1`, id)
	if err != nil {
		return nil, err
	}
	return &n, nil
}

// FindAll returns notifications matching the optional filters, ordered by
// created_at DESC with pagination.
func (r *NotificationRepository) FindAll(ctx context.Context, userID, status string, limit, offset int) ([]models.Notification, error) {
	query := "SELECT * FROM notifications"
	var conditions []string
	var args []interface{}
	argIdx := 1

	if userID != "" {
		conditions = append(conditions, fmt.Sprintf("user_id = $%d", argIdx))
		args = append(args, userID)
		argIdx++
	}
	if status != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}

	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}
	query += " ORDER BY created_at DESC"

	if limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argIdx)
		args = append(args, limit)
		argIdx++
	}
	if offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", argIdx)
		args = append(args, offset)
		argIdx++
	}

	var items []models.Notification
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// MarkAsSent sets the notification status to 'sent' and records the timestamp.
func (r *NotificationRepository) MarkAsSent(ctx context.Context, id string) (*models.Notification, error) {
	var n models.Notification
	err := r.db.GetContext(ctx, &n,
		`UPDATE notifications SET status = 'sent', sent_at = NOW() WHERE id = $1 RETURNING *`, id)
	if err != nil {
		return nil, err
	}
	return &n, nil
}

// MarkAsRead sets the notification status to 'read' and records the timestamp.
func (r *NotificationRepository) MarkAsRead(ctx context.Context, id string) (*models.Notification, error) {
	var n models.Notification
	err := r.db.GetContext(ctx, &n,
		`UPDATE notifications SET status = 'read', read_at = NOW() WHERE id = $1 RETURNING *`, id)
	if err != nil {
		return nil, err
	}
	return &n, nil
}

// GetUnreadCount returns the number of notifications with status 'sent' for a user.
func (r *NotificationRepository) GetUnreadCount(ctx context.Context, userID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND status = 'sent'`, userID)
	return count, err
}

// Count returns the total number of notifications, optionally filtered by user.
func (r *NotificationRepository) Count(ctx context.Context, userID string) (int, error) {
	if userID != "" {
		var count int
		err := r.db.GetContext(ctx, &count,
			`SELECT COUNT(*) FROM notifications WHERE user_id = $1`, userID)
		return count, err
	}
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM notifications`)
	return count, err
}
