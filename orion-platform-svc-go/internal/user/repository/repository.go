package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"
	"strings"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/user/models"

	"github.com/jmoiron/sqlx"
)

// All four lookups and the zero-row Update return sentinel.NotFound, the
// platform-wide not-found sentinel, instead of a package-private error. The
// handler has to tell "no such user" from "the database failed" to answer 404
// versus 500; a private sentinel was invisible above this package, so every
// error the service returned became a 404 -- including the syntax error that
// made PUT /users/:id unreachable.
var errNotFound = sentinel.NotFound

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
// usersUpdatable whitelists the columns Update may set. Only the fields the
// request models expose are settable, and only through this table: the SET list
// is rendered from caller-supplied map keys, so the column names come from this
// constant set rather than from the map. A stray key would otherwise be spliced
// straight into the statement — a typo, or "id" / "tenant_id" / "password" /
// "created_at", each of which would either be a hard syntax error or would let a
// caller overwrite an identifier or an immutable column. Values are always bound
// as arguments.
var usersUpdatable = map[string]bool{
	"full_name": true, "email": true, "role": true,
	"status": true, "avatar_url": true, "settings": true,
}

var errNoUpdatableFields = errors.New("no updatable fields supplied")

// setClause renders an updates map as a SQL SET list, dropping keys that are not
// in allowed and sorting the rest so the rendered statement is stable across map
// iterations — an unordered SET list made every call's SQL non-reproducible.
// updated_at is appended as NOW() rather than taken from the map, so a caller
// cannot write it explicitly and the map is never mutated in place.
//
// The statement binds id as $1 and tenant_id as $2, so the SET values start at
// $3. Holding that convention in one place keeps the placeholder indexes from
// drifting out of step with the args slice.
//
// It returns (setList, boundArgs, columnCount); columnCount 0 means the caller
// asked for an update with no settable fields.
func setClause(updates map[string]interface{}, allowed map[string]bool) (string, []interface{}, int) {
	keys := make([]string, 0, len(updates))
	for k := range updates {
		if allowed[k] {
			keys = append(keys, k)
		}
	}
	if len(keys) == 0 {
		return "", nil, 0
	}
	sort.Strings(keys)

	parts := make([]string, 0, len(keys)+1)
	args := make([]interface{}, 0, len(keys))
	for i, k := range keys {
		parts = append(parts, fmt.Sprintf("%s=$%d", k, i+3))
		args = append(args, updates[k])
	}
	parts = append(parts, "updated_at=NOW()")
	return strings.Join(parts, ", "), args, len(keys)
}

// Update patches the settable fields of an existing user.
//
// The previous implementation rendered the SET list with
// fmt.Sprintf("%v", fields). %v on a []string emits "[a=$1 b=$2]", square
// brackets separated by spaces and no commas, so every call executed
// "UPDATE users SET [full_name=$3 updated_at=NOW()] WHERE ..." — a syntax
// error. PUT /users/:id was registered and permission-guarded but could never
// succeed; because the handler maps every error to 404, it reported the user as
// not found while the row sat there untouched.
func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	set, setArgs, n := setClause(updates, usersUpdatable)
	if n == 0 {
		return errNoUpdatableFields
	}
	args := append([]interface{}{id, tenantID}, setArgs...)
	query := `UPDATE users SET ` + set + ` WHERE id=$1 AND tenant_id=$2`

	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		// The statement is keyed on id AND tenant_id, so zero affected rows means
		// either "no such user" or "a user in another tenant".
		return errNotFound
	}
	return nil
}

// UpdatePassword updates the password hash for a user.
func (r *Repository) UpdatePassword(ctx context.Context, id string, tenantID string, newPasswordHash string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE users SET password=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
		newPasswordHash, id, tenantID)
	return err
}

// Delete removes a user by id and tenant_id.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM users WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}
