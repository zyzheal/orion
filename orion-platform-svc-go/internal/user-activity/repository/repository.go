package repository

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/user-activity/models"

	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// GetActivities returns paginated activities for a user.
func (r *Repository) GetActivities(ctx context.Context, userID string, limit, offset int) ([]models.UserActivity, error) {
	if limit <= 0 {
		limit = 20
	}
	var items []models.UserActivity
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, user_id as "userId", action, resource_type as "resourceType", resource_id as "resourceId", details, ip_address as "ipAddress", user_agent as "userAgent", created_at as "createdAt" FROM user_activities WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		userID, limit, offset)
	return items, err
}

// GetActivityCount returns the total number of activities for a user.
func (r *Repository) GetActivityCount(ctx context.Context, userID string) (int, error) {
	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT count(*) FROM user_activities WHERE user_id=$1`,
		userID)
	if err != nil {
		return 0, err
	}
	return total, nil
}

// CreateActivity inserts a new activity record.
func (r *Repository) CreateActivity(ctx context.Context, a *models.UserActivity) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO user_activities (id, user_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at) VALUES (:id, :userId, :action, :resourceType, :resourceId, :details, :ipAddress, :userAgent, :createdAt)`,
		a)
	return err
}

// EnsureTable creates the user_activities table if it does not exist.
func (r *Repository) EnsureTable(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS user_activities (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id TEXT NOT NULL,
			action TEXT NOT NULL,
			resource_type TEXT,
			resource_id TEXT,
			details JSONB,
			ip_address TEXT,
			user_agent TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	return err
}

// GetActivityByID returns a single activity by its ID.
func (r *Repository) GetActivityByID(ctx context.Context, userID, activityID string) (*models.UserActivity, error) {
	var a models.UserActivity
	err := r.db.GetContext(ctx, &a,
		`SELECT id, user_id as "userId", action, resource_type as "resourceType", resource_id as "resourceId", details, ip_address as "ipAddress", user_agent as "userAgent", created_at as "createdAt" FROM user_activities WHERE id=$1 AND user_id=$2`,
		activityID, userID)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// DeleteActivity removes an activity by ID.
func (r *Repository) DeleteActivity(ctx context.Context, userID, activityID string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM user_activities WHERE id=$1 AND user_id=$2`,
		activityID, userID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("activity %s not found", activityID)
	}
	return nil
}
