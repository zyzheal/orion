package repository

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"orion/platform-svc-go/internal/degradation/models"

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

func (r *Repository) Create(ctx context.Context, item *models.Degradation) error {
	item.ID = uuid.New().String()
	item.CreatedAt = time.Now().UTC()
	item.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO degradations (id, tenant_id, name, created_at, updated_at) VALUES (:id, :tenantId, :name, :createdAt, :updatedAt)`,
		item)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Degradation, error) {
	var item models.Degradation
	err := r.db.GetContext(ctx, &item,
		fmt.Sprintf(`SELECT * FROM degradations WHERE id=$1 AND tenant_id=$2`), id, tenantID)
	return &item, err
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.Degradation, error) {
	var items []models.Degradation
	err := r.db.SelectContext(ctx, &items,
		fmt.Sprintf(`SELECT * FROM degradations WHERE tenant_id=$1 ORDER BY created_at DESC`), tenantID)
	return items, err
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Degradation, error) {
	if len(updates) == 0 {
		return nil, sentinel.NotFound
	}
	updates["updated_at"] = time.Now().UTC()
	clauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		clauses = append(clauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	args = append(args, id, tenantID)
	_, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE degradations SET %s WHERE id=$%d AND tenant_id=$%d`,
			strings.Join(clauses, ", "), i, i+1), args...)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, tenantID, id)
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`DELETE FROM degradations WHERE id=$1 AND tenant_id=$2`), id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

var _ = strconv.Itoa // ensure strconv imported
