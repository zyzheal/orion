package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/webhook/store/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// sentinel.NotFound is returned when a requested config entry is not found.

// Repository provides CRUD operations for domain-scoped config entries.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new config entry.
func (r *Repository) Create(ctx context.Context, e *models.ConfigEntry) error {
	e.ID = uuid.New().String()
	now := time.Now().UTC()
	e.CreatedAt = now
	e.UpdatedAt = now
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO webhook_config (id, tenant_id, domain, name, value, enabled, created_at, updated_at)
		VALUES (:id, :tenant_id, :domain, :name, :value, :enabled, :created_at, :updated_at)`, e)
	return err
}

// GetByID retrieves a config entry by its ID and tenant ID.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.ConfigEntry, error) {
	var e models.ConfigEntry
	err := r.db.GetContext(ctx, &e,
		`SELECT * FROM webhook_config WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err == sql.ErrNoRows {
		return nil, sentinel.NotFound
	}
	if err != nil {
		return nil, err
	}
	return &e, nil
}

// ListByDomain returns all config entries for a tenant and domain.
func (r *Repository) ListByDomain(ctx context.Context, tenantID, domain string) ([]models.ConfigEntry, error) {
	var entries []models.ConfigEntry
	err := r.db.SelectContext(ctx, &entries,
		`SELECT * FROM webhook_config WHERE tenant_id = $1 AND domain = $2 ORDER BY created_at DESC`,
		tenantID, domain)
	if err != nil {
		return nil, err
	}
	return entries, nil
}

// ListAll returns all config entries for a tenant across all domains.
func (r *Repository) ListAll(ctx context.Context, tenantID string) ([]models.ConfigEntry, error) {
	var entries []models.ConfigEntry
	err := r.db.SelectContext(ctx, &entries,
		`SELECT * FROM webhook_config WHERE tenant_id = $1 ORDER BY domain, created_at DESC`,
		tenantID)
	if err != nil {
		return nil, err
	}
	return entries, nil
}

// Update applies partial updates to a config entry.
func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.ConfigEntry, error) {
	if len(updates) == 0 {
		return r.GetByID(ctx, tenantID, id)
	}
	updates["updated_at"] = time.Now().UTC()

	setParts := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates)+2)
	idx := 1
	for k, v := range updates {
		setParts = append(setParts, fmt.Sprintf("%s = $%d", k, idx))
		args = append(args, v)
		idx++
	}
	args = append(args, id, tenantID)
	_, err := r.db.ExecContext(ctx,
		`UPDATE webhook_config SET `+strings.Join(setParts, ", ")+
			` WHERE id = $`+fmt.Sprintf("%d", idx-2)+
			` AND tenant_id = $`+fmt.Sprintf("%d", idx-1), args...)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, tenantID, id)
}

// Delete removes a config entry by ID and tenant ID.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM webhook_config WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sentinel.NotFound
	}
	return nil
}
