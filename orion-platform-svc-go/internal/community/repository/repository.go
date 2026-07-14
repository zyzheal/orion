package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/community/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, entity *models.Community) error {
	entity.ID = uuid.New().String()
	now := time.Now().UTC()
	entity.CreatedAt = now
	entity.UpdatedAt = now
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO communities (id, tenant_id, name, created_at, updated_at)
		 VALUES (:id, :tenantId, :name, :createdAt, :updatedAt)`,
		entity)
	return err
}

func (r *Repository) GetByID(ctx context.Context, id, tenantID string) (*models.Community, error) {
	var entity models.Community
	err := r.db.GetContext(ctx, &entity,
		`SELECT * FROM communities WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &entity, nil
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.Community, error) {
	var entities []models.Community
	err := r.db.SelectContext(ctx, &entities,
		`SELECT * FROM communities WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	return entities, nil
}

func (r *Repository) Update(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.Community, error) {
	if len(attrs) == 0 {
		return nil, ErrNotFound
	}
	attrs["updated_at"] = time.Now().UTC()
	set := make([]string, 0, len(attrs))
	args := make([]interface{}, 0, len(attrs)+2)
	i := 1
	for k, v := range attrs {
		set = append(set, fmt.Sprintf("%s=$%d", k, i))
		args = append(args, v)
		i++
	}
	idIdx := i
	tenantIdx := i + 1
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE communities SET %s WHERE id=$%d AND tenant_id=$%d",
		strings.Join(set, ", "), idIdx, tenantIdx)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, ErrNotFound
	}
	return r.GetByID(ctx, id, tenantID)
}

func (r *Repository) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM communities WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}
