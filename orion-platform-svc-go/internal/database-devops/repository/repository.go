package repository

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/database-devops/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new database DevOps operation
func (r *Repository) Create(ctx context.Context, item *models.DatabaseDevopsItem) error {
	if r.db == nil {
		return nil
	}
	item.ID = uuid.New().String()
	now := time.Now().UTC()
	item.CreatedAt = now
	item.UpdatedAt = now
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO database_devops (id, tenant_id, name, description, type, status, database_id, config, result, enabled, created_at, updated_at)
		 VALUES (:id, :tenant_id, :name, :description, :type, :status, :database_id, :config, :result, :enabled, :created_at, :updated_at)`, item)
	return err
}

// Get retrieves a single operation by ID and tenant
func (r *Repository) Get(ctx context.Context, tenantID, id string) (*models.DatabaseDevopsItem, error) {
	if r.db == nil {
		return nil, nil
	}
	item := &models.DatabaseDevopsItem{}
	err := r.db.GetContext(ctx, item,
		`SELECT id, tenant_id, name, description, type, status, database_id, config, result, enabled, created_at, updated_at
		 FROM database_devops WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return item, nil
}

// List returns all operations for a tenant
func (r *Repository) List(ctx context.Context, tenantID string) ([]models.DatabaseDevopsItem, error) {
	if r.db == nil {
		return []models.DatabaseDevopsItem{}, nil
	}
	var items []models.DatabaseDevopsItem
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, name, description, type, status, database_id, config, result, enabled, created_at, updated_at
		 FROM database_devops WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

// Update updates an existing operation
func (r *Repository) Update(ctx context.Context, item *models.DatabaseDevopsItem) error {
	if r.db == nil {
		return nil
	}
	item.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE database_devops SET name = :name, description = :description, status = :status,
		 config = :config, result = :result, enabled = :enabled, updated_at = :updated_at
		 WHERE id = :id AND tenant_id = :tenant_id`, item)
	return err
}

// UpdateStatus updates just the status field
func (r *Repository) UpdateStatus(ctx context.Context, tenantID, id, status string) error {
	if r.db == nil {
		return nil
	}
	_, err := r.db.ExecContext(ctx,
		`UPDATE database_devops SET status = $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4`,
		status, time.Now().UTC(), id, tenantID)
	return err
}

// UpdateResult updates just the result field
func (r *Repository) UpdateResult(ctx context.Context, tenantID, id, result string) error {
	if r.db == nil {
		return nil
	}
	_, err := r.db.ExecContext(ctx,
		`UPDATE database_devops SET result = $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4`,
		result, time.Now().UTC(), id, tenantID)
	return err
}

// Delete removes an operation
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	if r.db == nil {
		return nil
	}
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM database_devops WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// CreateDataSource inserts a new data source
func (r *Repository) CreateDataSource(ctx context.Context, ds *models.DatabaseSource) error {
	if r.db == nil {
		return nil
	}
	ds.ID = uuid.New().String()
	now := time.Now().UTC()
	ds.CreatedAt = now
	ds.UpdatedAt = now
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO database_sources (id, tenant_id, name, type, host, port, database, username, password, ssl_mode, status, created_at, updated_at)
		 VALUES (:id, :tenant_id, :name, :type, :host, :port, :database, :username, :password, :ssl_mode, :status, :created_at, :updated_at)`, ds)
	return err
}

// ListDataSources returns all data sources for a tenant
func (r *Repository) ListDataSources(ctx context.Context, tenantID string) ([]models.DatabaseSource, error) {
	if r.db == nil {
		return []models.DatabaseSource{}, nil
	}
	var items []models.DatabaseSource
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, name, type, host, port, database, username, ssl_mode, status, created_at, updated_at
		 FROM database_sources WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

// DeleteDataSource removes a data source
func (r *Repository) DeleteDataSource(ctx context.Context, tenantID, id string) error {
	if r.db == nil {
		return nil
	}
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM database_sources WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}
