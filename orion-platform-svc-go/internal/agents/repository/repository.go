package repository

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/agents/models"
	internalrepo "orion/platform-svc-go/internal/repository"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	internalrepo.TenantAwareRepository[any]
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{
		TenantAwareRepository: internalrepo.NewTenantAwareRepository(db),
		db:                    db,
	}
}

func (r *Repository) Create(ctx context.Context, item *models.AgentItem) error {
	if r.db == nil {
		return nil
	}
	item.ID = uuid.New().String()
	now := time.Now().UTC()
	item.CreatedAt = now
	item.UpdatedAt = now
	_, err := r.db.NamedExecContext(ctx,
		"INSERT INTO agents (id, tenant_id, name, description, enabled, created_at, updated_at) VALUES (:id, :tenant_id, :name, :description, :enabled, :created_at, :updated_at)", item)
	return err
}

func (r *Repository) Get(ctx context.Context, tenantID, id string) (*models.AgentItem, error) {
	if r.db == nil {
		return nil, nil
	}
	item := &models.AgentItem{}
	err := r.TenantAwareRepository.Get(ctx, item, "SELECT * FROM agents WHERE id = $1", id)
	return item, err
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.AgentItem, error) {
	if r.db == nil {
		return []models.AgentItem{}, nil
	}
	var items []models.AgentItem
	err := r.TenantAwareRepository.Select(ctx, &items, "SELECT * FROM agents ORDER BY created_at DESC")
	return items, err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	if r.db == nil {
		return nil
	}
	_, err := r.TenantAwareRepository.Exec(ctx, "DELETE FROM agents WHERE id = $1", id)
	return err
}
