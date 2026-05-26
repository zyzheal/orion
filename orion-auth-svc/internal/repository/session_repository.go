package repository

import (
	"context"
	"fmt"

	"orion/auth-svc/internal/models"

	"github.com/jmoiron/sqlx"
)

// SessionRepository provides data access for session entities.
type SessionRepository struct {
	db *sqlx.DB
}

func NewSessionRepository(db *sqlx.DB) *SessionRepository {
	return &SessionRepository{db: db}
}

func (r *SessionRepository) Create(ctx context.Context, session *models.Session) error {
	query := `
		INSERT INTO sessions (user_id, tenant_id, token, ip_address, user_agent, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at
	`
	err := r.db.QueryRowContext(ctx, query,
		session.UserID, session.TenantID, session.Token,
		session.IP, session.UserAgent, session.ExpiresAt,
	).Scan(&session.ID, &session.CreatedAt)
	return err
}

func (r *SessionRepository) GetByToken(ctx context.Context, token string) (*models.Session, error) {
	var session models.Session
	query := `SELECT id, user_id, tenant_id, token, ip_address, user_agent, expires_at, created_at FROM sessions WHERE token = $1`
	err := r.db.GetContext(ctx, &session, query, token)
	if err != nil {
		return nil, fmt.Errorf("session not found: %w", err)
	}
	return &session, nil
}

func (r *SessionRepository) GetByUserID(ctx context.Context, userID string) ([]models.Session, error) {
	var sessions []models.Session
	query := `SELECT id, user_id, tenant_id, token, ip_address, user_agent, expires_at, created_at FROM sessions WHERE user_id = $1 AND expires_at > now() ORDER BY created_at DESC`
	err := r.db.SelectContext(ctx, &sessions, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get sessions: %w", err)
	}
	return sessions, nil
}

func (r *SessionRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM sessions WHERE id = $1", id)
	return err
}

func (r *SessionRepository) DeleteByUserID(ctx context.Context, userID string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM sessions WHERE user_id = $1", userID)
	return err
}

func (r *SessionRepository) CleanupExpired(ctx context.Context) (int64, error) {
	result, err := r.db.ExecContext(ctx, "DELETE FROM sessions WHERE expires_at < now()")
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}
