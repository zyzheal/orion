package repository

import (
	"context"
	"fmt"
	"time"

	"orion/notification-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

// DeliveryRepository provides data access for notification delivery records.
type DeliveryRepository struct {
	db *sqlx.DB
}

// NewDeliveryRepository creates a new DeliveryRepository.
func NewDeliveryRepository(db *sqlx.DB) *DeliveryRepository {
	return &DeliveryRepository{db: db}
}

// CreateDelivery inserts a new delivery record.
func (r *DeliveryRepository) CreateDelivery(ctx context.Context, d *models.NotificationDelivery) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO notification_deliveries (
			id, tenant_id, notification_id, channel, recipient, subject, body,
			status, attempt_number, max_attempts, fallback_channel, metadata,
			next_retry_at, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
		d.ID, d.TenantID, d.NotificationID, d.Channel, d.Recipient, d.Subject, d.Body,
		d.Status, d.AttemptNumber, d.MaxAttempts, d.FallbackChannel, d.Metadata,
		d.NextRetryAt, d.CreatedAt, d.UpdatedAt,
	)
	return err
}

// FindByID returns a single delivery by id and tenant.
func (r *DeliveryRepository) FindByID(ctx context.Context, tenantID, id string) (*models.NotificationDelivery, error) {
	var d models.NotificationDelivery
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM notification_deliveries WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// FindByNotificationID returns all deliveries for a notification.
func (r *DeliveryRepository) FindByNotificationID(ctx context.Context, tenantID, notificationID string) ([]models.NotificationDelivery, error) {
	var items []models.NotificationDelivery
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM notification_deliveries WHERE notification_id=$1 AND tenant_id=$2 ORDER BY created_at ASC`,
		notificationID, tenantID)
	return items, err
}

// FindPendingForRetry returns deliveries due for retry.
func (r *DeliveryRepository) FindPendingForRetry(ctx context.Context, tenantID string, limit int) ([]models.NotificationDelivery, error) {
	var items []models.NotificationDelivery
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM notification_deliveries
		 WHERE tenant_id=$1
		   AND status IN ('pending','retrying')
		   AND next_retry_at IS NOT NULL
		   AND next_retry_at <= $2
		   AND attempt_number <= max_attempts
		 ORDER BY next_retry_at ASC
		 LIMIT $3`,
		tenantID, time.Now(), limit)
	return items, err
}

// UpdateStatus updates mutable delivery fields.
func (r *DeliveryRepository) UpdateStatus(ctx context.Context, d *models.NotificationDelivery) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE notification_deliveries SET
			status=$1, attempt_number=$2, error_message=$3, response_body=$4,
			response_status=$5, sent_at=$6, next_retry_at=$7, metadata=$8, updated_at=$9
		 WHERE id=$10 AND tenant_id=$11`,
		d.Status, d.AttemptNumber, d.ErrorMessage, d.ResponseBody,
		d.ResponseStatus, d.SentAt, d.NextRetryAt, d.Metadata, d.UpdatedAt,
		d.ID, d.TenantID,
	)
	return err
}

// IncrementAttempt increments attempt_number and sets status to retrying.
func (r *DeliveryRepository) IncrementAttempt(ctx context.Context, tenantID, id string) (*models.NotificationDelivery, error) {
	var d models.NotificationDelivery
	err := r.db.GetContext(ctx, &d,
		`UPDATE notification_deliveries
		 SET attempt_number = attempt_number + 1,
		     status = 'retrying',
		     updated_at = $1
		 WHERE id=$2 AND tenant_id=$3
		 RETURNING *`,
		time.Now(), id, tenantID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// MarkExhausted sets status to exhausted with optional last error.
func (r *DeliveryRepository) MarkExhausted(ctx context.Context, tenantID, id, lastError string) (*models.NotificationDelivery, error) {
	var d models.NotificationDelivery
	err := r.db.GetContext(ctx, &d,
		`UPDATE notification_deliveries
		 SET status = 'exhausted',
		     error_message = COALESCE($3, error_message),
		     updated_at = $4
		 WHERE id=$1 AND tenant_id=$2
		 RETURNING *`,
		id, tenantID, lastError, time.Now())
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// Count returns delivery count, optionally filtered by notificationId and/or status.
func (r *DeliveryRepository) Count(ctx context.Context, tenantID string, notificationID string, status models.DeliveryStatus) (int, error) {
	var count int
	query := `SELECT COUNT(*) FROM notification_deliveries WHERE tenant_id=$1`
	args := []interface{}{tenantID}
	argIdx := 2

	if notificationID != "" {
		query += fmt.Sprintf(" AND notification_id=$%d", argIdx)
		args = append(args, notificationID)
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
