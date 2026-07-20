package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/alert-breaker/models"

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

func (r *Repository) Create(ctx context.Context, a *models.AlertBreaker) error {
	a.ID = uuid.New().String()
	a.CreatedAt = time.Now().UTC()
	a.UpdatedAt = time.Now().UTC()
	if a.Status == "" {
		a.Status = "active"
	}
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO alert_breakers (id, tenant_id, name, description, alert_id, rule, status, created_at, updated_at)
		VALUES (:id, :tenantId, :name, :description, :alertId, :rule, :status, :createdAt, :updatedAt)
	`, a)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.AlertBreaker, error) {
	var a models.AlertBreaker
	err := r.db.GetContext(ctx, &a, `SELECT * FROM alert_breakers WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return &a, nil
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.AlertBreaker, int, error) {
	var items []models.AlertBreaker
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM alert_breakers WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return nil, 0, err
	}
	var total int
	err = r.db.GetContext(ctx, &total, `SELECT COUNT(*) FROM alert_breakers WHERE tenant_id = $1`, tenantID)
	return items, total, err
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, fields map[string]interface{}) (*models.AlertBreaker, error) {
	if len(fields) == 0 {
		return nil, sentinel.NotFound
	}
	setClauses := make([]string, 0, len(fields)+1)
	args := make([]interface{}, 0, len(fields)+3)
	idx := 1
	for k, v := range fields {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", k, idx))
		args = append(args, v)
		idx++
	}
	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", idx))
	args = append(args, time.Now().UTC())
	idx++
	args = append(args, id, tenantID)

	result, err := r.db.ExecContext(ctx, fmt.Sprintf(`
		UPDATE alert_breakers SET %s WHERE id = $%d AND tenant_id = $%d
	`, setClauses, idx, idx+1), args...)
	if err != nil {
		return nil, err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetByID(ctx, tenantID, id)
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx, `DELETE FROM alert_breakers WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}
