package repository

import (
	"context"
	"fmt"

	"orion/auth-svc/internal/models"
	"orion/go-common/pkg/database"

	"github.com/jmoiron/sqlx"
)

// UserRepository provides data access for user entities.
type UserRepository struct {
	database.BaseRepository
}

func NewUserRepository(db *sqlx.DB) *UserRepository {
	return &UserRepository{
		BaseRepository: database.NewBaseRepository(db),
	}
}

// Create inserts a new user into the database.
func (r *UserRepository) Create(ctx context.Context, user *models.User) error {
	query := `
		INSERT INTO users (tenant_id, username, email, password_hash, role, status)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at, updated_at
	`
	err := r.DB().QueryRowContext(ctx, query,
		user.TenantID, user.Username, user.Email, user.PasswordHash, user.Role, user.Status,
	).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)
	return err
}

// GetByEmail finds a user by email address.
func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	var user models.User
	query := `SELECT id, tenant_id, username, email, password_hash, role, status, created_at, updated_at FROM users WHERE email = $1`
	err := r.DB().GetContext(ctx, &user, query, email)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}
	return &user, nil
}

// GetByUsername finds a user by username.
func (r *UserRepository) GetByUsername(ctx context.Context, username string) (*models.User, error) {
	var user models.User
	query := `SELECT id, tenant_id, username, email, password_hash, role, status, created_at, updated_at FROM users WHERE username = $1`
	err := r.DB().GetContext(ctx, &user, query, username)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}
	return &user, nil
}

// GetByID finds a user by ID.
func (r *UserRepository) GetByID(ctx context.Context, id string) (*models.User, error) {
	var user models.User
	query := `SELECT id, tenant_id, username, email, password_hash, role, status, created_at, updated_at FROM users WHERE id = $1`
	err := r.DB().GetContext(ctx, &user, query, id)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}
	return &user, nil
}

// GetByEmailOrUsername finds a user by email or username, scoped to a tenant.
func (r *UserRepository) GetByEmailOrUsername(ctx context.Context, tenantID, emailOrUsername string) (*models.User, error) {
	var user models.User
	query := `SELECT id, tenant_id, username, email, password_hash, role, status, created_at, updated_at FROM users WHERE tenant_id = $1 AND (email = $2 OR username = $2)`
	err := r.DB().GetContext(ctx, &user, query, tenantID, emailOrUsername)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}
	return &user, nil
}

// UpdatePassword updates a user's password hash.
func (r *UserRepository) UpdatePassword(ctx context.Context, userID, passwordHash string) error {
	query := `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`
	_, err := r.DB().ExecContext(ctx, query, passwordHash, userID)
	return err
}

// Update updates user fields.
func (r *UserRepository) Update(ctx context.Context, user *models.User) error {
	query := `
		UPDATE users SET username = $1, email = $2, role = $3, status = $4, updated_at = now()
		WHERE id = $5
	`
	_, err := r.DB().ExecContext(ctx, query, user.Username, user.Email, user.Role, user.Status, user.ID)
	return err
}

// EmailExists checks if an email is already registered.
func (r *UserRepository) EmailExists(ctx context.Context, email string) (bool, error) {
	return r.BaseRepository.Exists(ctx, "users", "email = $1", email)
}
