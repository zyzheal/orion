package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"orion/platform-svc-go/internal/user-profile/models"

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

func (r *Repository) Create(ctx context.Context, tenantID, userID string) (*models.UserProfile, error) {
	p := &models.UserProfile{
		ID:     uuid.New().String(),
		UserID: userID,
	}
	_, err := r.db.NamedExecContext(ctx,
		"INSERT INTO user_profiles (id, tenant_id, user_id, first_name, last_name, bio, timezone, avatar_url) VALUES (:id, :tenantId, :userId, :firstName, :lastName, :bio, :timezone, :avatarUrl)",
		p)
	return p, err
}

func (r *Repository) GetByUserID(ctx context.Context, tenantID, userID string) (*models.UserProfile, error) {
	var p models.UserProfile
	err := r.db.GetContext(ctx, &p, "SELECT * FROM user_profiles WHERE user_id=$1 AND tenant_id=$2", userID, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &p, err
}

func (r *Repository) Update(ctx context.Context, tenantID, userID string, attrs map[string]interface{}) (*models.UserProfile, error) {
	if len(attrs) == 0 {
		return nil, sentinel.NotFound
	}
	setParts := make([]string, 0, len(attrs))
	args := make([]interface{}, 0, len(attrs)+2)
	idx := 1
	for k, v := range attrs {
		setParts = append(setParts, k+" = $"+fmt.Sprint(idx))
		args = append(args, v)
		idx++
	}
	args = append(args, userID, tenantID)
	query := "UPDATE user_profiles SET " + strings.Join(setParts, ", ") + " WHERE user_id = $" + fmt.Sprint(idx) + " AND tenant_id = $" + fmt.Sprint(idx+1) + " RETURNING *"
	var p models.UserProfile
	err := r.db.GetContext(ctx, &p, query, args...)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &p, err
}

func (r *Repository) EnsureTable(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS user_profiles (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id VARCHAR(255) NOT NULL,
			user_id VARCHAR(255) NOT NULL UNIQUE,
			first_name VARCHAR(255),
			last_name VARCHAR(255),
			bio TEXT,
			timezone VARCHAR(50),
			avatar_url VARCHAR(255)
		)
	`)
	return err
}
