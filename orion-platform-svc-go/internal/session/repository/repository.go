package repository

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/session/models"

	"github.com/jmoiron/sqlx"
)

// Repository provides PostgreSQL-backed persistence for sessions.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository instance.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new session row.
// SQL Call #1
func (r *Repository) Create(ctx context.Context, s *models.Session) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO sessions (
			id, user_id, token, device_info, ip, last_active_at, expires_at,
			tenant_id, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		s.ID, s.UserID, s.Token, s.DeviceInfo, s.IP,
		s.LastActiveAt, s.ExpiresAt,
		s.TenantID, s.CreatedAt, s.UpdatedAt,
	)
	return err
}

// GetByID retrieves a single session by id and tenant_id.
// SQL Call #2
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Session, error) {
	var s models.Session
	err := r.db.GetContext(ctx, &s,
		`SELECT * FROM sessions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// GetByToken retrieves a session by token.
// SQL Call #3
func (r *Repository) GetByToken(ctx context.Context, tenantID, token string) (*models.Session, error) {
	var s models.Session
	err := r.db.GetContext(ctx, &s,
		`SELECT * FROM sessions WHERE token=$1 AND tenant_id=$2`, token, tenantID)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// List retrieves sessions for a tenant with optional user_id filter, pagination.
// SQL Call #4
func (r *Repository) List(ctx context.Context, tenantID string, userID *string, offset, limit int) ([]models.Session, error) {
	var items []models.Session

	query := "SELECT * FROM sessions WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2

	if userID != nil {
		query += " AND user_id=$2"
		args = append(args, *userID)
		argIdx++
	}

	query += " ORDER BY created_at DESC OFFSET $2 LIMIT $3"
	// Rebind args with offset and limit at correct positions.
	if userID != nil {
		query = "SELECT * FROM sessions WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC OFFSET $3 LIMIT $4"
		args = []interface{}{tenantID, *userID, offset, limit}
	} else {
		args = []interface{}{tenantID, offset, limit}
	}

	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// ListByTenant retrieves all active sessions for a given tenant.
// SQL Call #5
func (r *Repository) ListByTenant(ctx context.Context, tenantID string, now time.Time) ([]models.Session, error) {
	var items []models.Session
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM sessions WHERE tenant_id=$1 AND expires_at > $2 ORDER BY created_at DESC`,
		tenantID, now)
	return items, err
}

// UpdateLastActive updates the last_active_at timestamp for a session.
// SQL Call #6
func (r *Repository) UpdateLastActive(ctx context.Context, id, tenantID string, lastActiveAt time.Time) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE sessions SET last_active_at=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
		lastActiveAt, id, tenantID)
	return err
}

// Delete removes a session by id and tenant_id.
// SQL Call #7
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM sessions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// DeleteByUserID removes all sessions for a given user within the tenant.
// SQL Call #8
func (r *Repository) DeleteByUserID(ctx context.Context, tenantID, userID string) (int64, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM sessions WHERE tenant_id=$1 AND user_id=$2`, tenantID, userID)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// DeleteExpired removes all expired sessions for a given tenant.
// SQL Call #9
func (r *Repository) DeleteExpired(ctx context.Context, tenantID string, now time.Time) (int64, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM sessions WHERE tenant_id=$1 AND expires_at <= $2`, tenantID, now)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}
