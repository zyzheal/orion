package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"orion/platform-svc-go/internal/user-status/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/sentinel"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, tenantID, userID string, status string, message string) (*models.UserStatus, error) {
	now := time.Now().UTC()
	s := &models.UserStatus{
		ID:      uuid.New().String(),
		UserID:  userID,
		Status:  status,
		Message: message,
		SetAt:   now,
	}
	_, err := r.db.NamedExecContext(ctx,
		"INSERT INTO user_statuses (id, tenant_id, user_id, status, message, set_at) VALUES (:id, :tenantId, :userId, :status, :message, :setAt)",
		s)
	return s, err
}

func (r *Repository) GetByUserID(ctx context.Context, tenantID, userID string) (*models.UserStatus, error) {
	var s models.UserStatus
	err := r.db.GetContext(ctx, &s, "SELECT * FROM user_statuses WHERE user_id=$1 AND tenant_id=$2", userID, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &s, err
}

func (r *Repository) Update(ctx context.Context, tenantID, userID string, status string, message string) (*models.UserStatus, error) {
	now := time.Now().UTC()
	var s models.UserStatus
	err := r.db.GetContext(ctx, &s,
		"UPDATE user_statuses SET status=$1, message=$2, set_at=$3 WHERE user_id=$4 AND tenant_id=$5 RETURNING *",
		status, message, now, userID, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &s, err
}

func (r *Repository) ListByStatus(ctx context.Context, tenantID string, status string) ([]models.UserStatus, error) {
	var statuses []models.UserStatus
	err := r.db.SelectContext(ctx, &statuses,
		"SELECT * FROM user_statuses WHERE tenant_id=$1 AND status=$2 ORDER BY set_at DESC", tenantID, status)
	return statuses, err
}

func (r *Repository) EnsureTable(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS user_statuses (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id VARCHAR(255) NOT NULL,
			user_id VARCHAR(255) NOT NULL UNIQUE,
			status VARCHAR(50) NOT NULL,
			message TEXT,
			set_at TIMESTAMP WITH TIME ZONE NOT NULL
		)
	`)
	return err
}
