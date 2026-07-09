package repository

import (
	"context"
	"fmt"
	"time"

	"orion/notification-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

// ScheduledNotificationRepository provides data access for scheduled notifications.
type ScheduledNotificationRepository struct {
	db      *sqlx.DB
	nowFunc func() time.Time // overridable for testing
}

// NewScheduledNotificationRepository creates a new ScheduledNotificationRepository.
func NewScheduledNotificationRepository(db *sqlx.DB) *ScheduledNotificationRepository {
	return &ScheduledNotificationRepository{db: db, nowFunc: time.Now}
}

// Create inserts a new scheduled notification.
func (r *ScheduledNotificationRepository) Create(ctx context.Context, n *models.ScheduledNotification) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO scheduled_notifications (
			id, tenant_id, user_id, template_id, type, title, message, channel,
			scheduled_at, status, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		n.ID, n.TenantID, n.UserID, n.TemplateID, n.Type, n.Title, n.Message,
		n.Channel, n.ScheduledAt, n.Status, n.CreatedAt, n.UpdatedAt,
	)
	return err
}

// FindByID returns a single scheduled notification by id and tenant.
func (r *ScheduledNotificationRepository) FindByID(ctx context.Context, tenantID, id string) (*models.ScheduledNotification, error) {
	var n models.ScheduledNotification
	err := r.db.GetContext(ctx, &n,
		`SELECT * FROM scheduled_notifications WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &n, nil
}

// FindAll returns scheduled notifications with optional filters.
func (r *ScheduledNotificationRepository) FindAll(ctx context.Context, tenantID string, opts models.ListNotificationsQuery) ([]models.ScheduledNotification, int, error) {
	var conditions []string
	var args []interface{}
	argIdx := 1

	conditions = append(conditions, fmt.Sprintf("tenant_id=$%d", argIdx))
	args = append(args, tenantID)
	argIdx++

	if opts.UserID != "" {
		conditions = append(conditions, fmt.Sprintf("user_id=$%d", argIdx))
		args = append(args, opts.UserID)
		argIdx++
	}
	if opts.Status != "" {
		conditions = append(conditions, fmt.Sprintf("status=$%d", argIdx))
		args = append(args, opts.Status)
		argIdx++
	}

	where := fmt.Sprintf("WHERE %s", joinConditions(conditions))

	// Count total
	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM scheduled_notifications %s", where)
	if err := r.db.GetContext(ctx, &total, countQuery, args...); err != nil {
		return nil, 0, err
	}

	// Fetch page
	offset := opts.Offset()
	limit := opts.Limit()
	args = append(args, offset, limit)
	query := fmt.Sprintf("SELECT * FROM scheduled_notifications %s ORDER BY scheduled_at ASC OFFSET $%d LIMIT $%d", where, argIdx, argIdx+1)

	var items []models.ScheduledNotification
	if err := r.db.SelectContext(ctx, &items, query, args...); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// FindPendingByTimeRange returns pending notifications scheduled between start and end.
func (r *ScheduledNotificationRepository) FindPendingByTimeRange(ctx context.Context, tenantID string, start, end time.Time) ([]models.ScheduledNotification, error) {
	var items []models.ScheduledNotification
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM scheduled_notifications
		 WHERE tenant_id=$1 AND status=$2 AND scheduled_at >= $3 AND scheduled_at <= $4
		 ORDER BY scheduled_at ASC`,
		tenantID, string(models.ScheduledStatusPending), start, end)
	return items, err
}

// Update updates mutable fields of a scheduled notification.
func (r *ScheduledNotificationRepository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.ScheduledNotification, error) {
	setParts := []string{"updated_at = $1"}
	args := []interface{}{r.nowFunc()}
	argIdx := 2

	for key, val := range updates {
		if key == "id" || key == "tenant_id" {
			continue
		}
		setParts = append(setParts, fmt.Sprintf("%s=$%d", key, argIdx))
		args = append(args, val)
		argIdx++
	}

	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE scheduled_notifications SET %s WHERE id=$%d AND tenant_id=$%d RETURNING *",
		joinSetParts(setParts), argIdx, argIdx+1)

	var n models.ScheduledNotification
	if err := r.db.GetContext(ctx, &n, query, args...); err != nil {
		return nil, err
	}
	return &n, nil
}

// MarkAsSent marks a scheduled notification as sent.
func (r *ScheduledNotificationRepository) MarkAsSent(ctx context.Context, tenantID, id string) (*models.ScheduledNotification, error) {
	var n models.ScheduledNotification
	err := r.db.GetContext(ctx, &n,
		"UPDATE scheduled_notifications SET status='sent', sent_at=NOW(), updated_at=NOW() WHERE id=$1 AND tenant_id=$2 RETURNING *",
		id, tenantID)
	if err != nil {
		return nil, err
	}
	return &n, nil
}

// Cancel cancels a pending scheduled notification.
func (r *ScheduledNotificationRepository) Cancel(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		"UPDATE scheduled_notifications SET status='cancelled', updated_at=NOW() WHERE id=$1 AND tenant_id=$2 AND status='pending'",
		id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

// Delete removes a scheduled notification.
func (r *ScheduledNotificationRepository) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		"DELETE FROM scheduled_notifications WHERE id=$1 AND tenant_id=$2", id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

// Count returns the count of scheduled notifications, optionally filtered.
func (r *ScheduledNotificationRepository) Count(ctx context.Context, tenantID string, userID string, status models.ScheduledNotificationStatus) (int, error) {
	var count int
	query := `SELECT COUNT(*) FROM scheduled_notifications WHERE tenant_id=$1`
	args := []interface{}{tenantID}
	argIdx := 2

	if userID != "" {
		query += fmt.Sprintf(" AND user_id=$%d", argIdx)
		args = append(args, userID)
		argIdx++
	}
	if status != "" {
		query += fmt.Sprintf(" AND status=$%d", argIdx)
		args = append(args, status)
	}

	if err := r.db.GetContext(ctx, &count, query, args...); err != nil {
		return 0, err
	}
	return count, nil
}

// joinConditions joins conditions with AND.
func joinConditions(conditions []string) string {
	if len(conditions) == 0 {
		return ""
	}
	result := conditions[0]
	for i := 1; i < len(conditions); i++ {
		result += fmt.Sprintf(" AND %s", conditions[i])
	}
	return result
}

// joinSetParts joins SET parts with commas.
func joinSetParts(parts []string) string {
	result := parts[0]
	for i := 1; i < len(parts); i++ {
		result += fmt.Sprintf(", %s", parts[i])
	}
	return result
}
