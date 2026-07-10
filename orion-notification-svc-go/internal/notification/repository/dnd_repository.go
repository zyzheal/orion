package repository

import (
	"context"
	"time"

	"orion/notification-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

// DNDRepository provides data access for do-not-disturb settings.
type DNDRepository struct {
	db *sqlx.DB
}

// NewDNDRepository creates a new DNDRepository.
func NewDNDRepository(db *sqlx.DB) *DNDRepository {
	return &DNDRepository{db: db}
}

// FindByUser returns DND settings for a user.
func (r *DNDRepository) FindByUser(ctx context.Context, tenantID, userID string) (*models.DoNotDisturb, error) {
	var dnd models.DoNotDisturb
	err := r.db.GetContext(ctx, &dnd,
		`SELECT * FROM do_not_disturb WHERE user_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT 1`,
		userID, tenantID)
	if err != nil {
		return nil, err
	}
	return &dnd, nil
}

// Upsert creates or updates DND settings for a user.
func (r *DNDRepository) Upsert(ctx context.Context, tenantID, userID string, startTime, endTime time.Time, reason *string) (*models.DoNotDisturb, error) {
	var dnd models.DoNotDisturb
	err := r.db.GetContext(ctx, &dnd,
		`INSERT INTO do_not_disturb (tenant_id, user_id, start_time, end_time, reason)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (user_id, tenant_id) DO UPDATE SET
		   start_time = EXCLUDED.start_time,
		   end_time = EXCLUDED.end_time,
		   reason = EXCLUDED.reason,
		   updated_at = NOW()
		 RETURNING *`,
		tenantID, userID, startTime, endTime, reason)
	if err != nil {
		return nil, err
	}
	return &dnd, nil
}

// DeleteByUser removes DND settings for a user.
func (r *DNDRepository) DeleteByUser(ctx context.Context, tenantID, userID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM do_not_disturb WHERE user_id=$1 AND tenant_id=$2`,
		userID, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

// FindActiveUsers returns user IDs with currently active DND settings.
func (r *DNDRepository) FindActiveUsers(ctx context.Context, tenantID string, at time.Time) ([]string, error) {
	var userIDs []string
	err := r.db.SelectContext(ctx, &userIDs,
		`SELECT user_id FROM do_not_disturb
		 WHERE tenant_id=$1 AND start_time <= $2 AND end_time >= $2`,
		tenantID, at)
	if err != nil {
		return nil, err
	}
	return userIDs, nil
}
