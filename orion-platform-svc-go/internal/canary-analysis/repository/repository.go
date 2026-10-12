package repository

import (
	internalrepo "orion/platform-svc-go/internal/repository"
	"context"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/canary-analysis/models"

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

func (r *Repository) Create(ctx context.Context, entity *models.Analysis) error {
	entity.ID = uuid.New().String()
	now := time.Now().UTC()
	entity.CreatedAt = now
	entity.UpdatedAt = now
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO canary_analyses (id, tenant_id, name, status, metadata, created_at, updated_at)
		 VALUES (:id, :tenantId, :name, :status, :metadata, :createdAt, :updatedAt)`,
		entity)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Analysis, error) {
	var entity models.Analysis
	err := r.TenantAwareRepository.Get(ctx, &entity,
		`SELECT * FROM canary_analyses WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &entity, nil
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.Analysis, error) {
	var entities []models.Analysis
	err := r.TenantAwareRepository.Select(ctx, &entities,
		`SELECT * FROM canary_analyses WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return entities, err
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, attrs map[string]interface{}) (*models.Analysis, error) {
	attrs["updated_at"] = time.Now().UTC()
	set := make([]string, 0, len(attrs))
	args := make([]interface{}, 0, len(attrs)+2)
	i := 1
	for k, v := range attrs {
		set = append(set, fmt.Sprintf("%s=$%d", k, i))
		args = append(args, v)
		i++
	}
	idIdx, tenantIdx := i, i+1
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE canary_analyses SET %s WHERE id=$%d AND tenant_id=$%d",
		strings.Join(set, ", "), idIdx, tenantIdx)
	_, err := r.TenantAwareRepository.Exec(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, tenantID, id)
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.TenantAwareRepository.Exec(ctx,
		`DELETE FROM canary_analyses WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}
