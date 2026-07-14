package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/user/models"

	"github.com/jmoiron/sqlx"
)

var errNotFound = errors.New("user not found")

// Repository provides PostgreSQL-backed persistence for users.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository instance.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new user row.
func (r *Repository) Create(ctx context.Context, user *models.User) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO users (
			id, tenant_id, username, email, full_name, role, status,
			password, avatar_url, settings, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		user.ID, user.TenantID, user.Username, user.Email, user.FullName,
		user.Role, user.Status, user.Password, user.AvatarURL,
		user.Settings, user.CreatedAt, user.UpdatedAt,
)
	return err
}

// GetByID retrieves a single user by id and tenant_id.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.User, error) {
	var u models.User
	err := r.db.GetContext(ctx, &u,
		`SELECT * FROM users WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err == sql.ErrNoRows {
		return nil, errNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// GetByUsername retrieves a user by username (for authentication).
func (r *Repository) GetByUsername(ctx context.Context, username string) (*models.User, error) {
	var u models.User
	err := r.db.GetContext(ctx, &u,
		`SELECT * FROM users WHERE username=$1`, username)
	if err == sql.ErrNoRows {
		return nil, errNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// GetByEmail retrieves a user by email.
func (r *Repository) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	var u models.User
	err := r.db.GetContext(ctx, &u,
		`SELECT * FROM users WHERE email=$1`, email)
	if err == sql.ErrNoRows {
		return nil, errNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// List retrieves users for a tenant with optional filters and pagination.
func (r *Repository) List(ctx context.Context, tenantID string, filter *models.GetUserFilters, offset, limit int) ([]models.User, error) {
	var items []models.User

	query := "SELECT * FROM users WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.Username != nil {
			query += fmt.Sprintf(" AND username ILIKE $%d", argIdx)
			args = append(args, "%"+*filter.Username+"%")
			argIdx++
		}
		if filter.Email != nil {
			query += fmt.Sprintf(" AND email ILIKE $%d", argIdx)
			args = append(args, "%"+*filter.Email+"%")
			argIdx++
		}
		if filter.FullName != nil {
			query += fmt.Sprintf(" AND full_name ILIKE $%d", argIdx)
			args = append(args, "%"+*filter.FullName+"%")
			argIdx++
		}
		if filter.Role != nil {
			query += fmt.Sprintf(" AND role=$%d", argIdx)
			args = append(args, *filter.Role)
			argIdx++
		}
		if filter.Status != nil {
			query += fmt.Sprintf(" AND status=$%d", argIdx)
			args = append(args, *filter.Status)
			argIdx++
		}
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC OFFSET $%d LIMIT $%d", argIdx, argIdx+1)
	args = append(args, offset, limit)

	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// Count returns the total number of users for a tenant.
func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM users WHERE tenant_id=$1`, tenantID)
	return count, err
}

// Update modifies an existing user.
func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}
	fields := make([]string, 0, len(updates))
	args := []interface{}{id, tenantID}
	argIdx := 3

	for k, v := range updates {
		fields = append(fields, fmt.Sprintf("%s=$%d", k, argIdx))
		args = append(args, v)
		argIdx++
	}

	fields = append(fields, "updated_at=NOW()")
	query := fmt.Sprintf(`UPDATE users SET %s WHERE id=$1 AND tenant_id=$2`, fmt.Sprintf("%v", fields))

	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

// UpdatePassword updates the password hash for a user.
func (r *Repository) UpdatePassword(ctx context.Context, id string, newPasswordHash string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE users SET password=$1, updated_at=NOW() WHERE id=$2`,
		newPasswordHash, id)
	return err
}

// Delete removes a user by id and tenant_id.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM users WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}
