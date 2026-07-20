package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/abac-policy/models"

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

func (r *Repository) Create(ctx context.Context, policy *models.ABACPolicy) error {
	policy.ID = uuid.New().String()
	policy.CreatedAt = time.Now().UTC()
	policy.UpdatedAt = time.Now().UTC()

	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO abac_policies (id, tenant_id, name, description, resource_type, action, effect, conditions, status, created_at, updated_at)
		VALUES (:id, :tenantId, :name, :description, :resourceType, :action, :effect, :conditions, :status, :createdAt, :updatedAt)
	`, policy)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.ABACPolicy, error) {
	var policy models.ABACPolicy
	err := r.db.GetContext(ctx, &policy, `
		SELECT * FROM abac_policies WHERE id = $1 AND tenant_id = $2
	`, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return &policy, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, filter *models.ABACPolicyFilter) ([]models.ABACPolicy, int, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.ResourceType != nil {
			where += fmt.Sprintf(" AND resource_type = $%d", argIdx)
			args = append(args, *filter.ResourceType)
			argIdx++
		}
		if filter.Status != nil {
			where += fmt.Sprintf(" AND status = $%d", argIdx)
			args = append(args, *filter.Status)
			argIdx++
		}
		if filter.Action != nil {
			where += fmt.Sprintf(" AND action = $%d", argIdx)
			args = append(args, *filter.Action)
			argIdx++
		}
		if filter.Limit > 0 {
			where += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
			args = append(args, filter.Limit, filter.Offset)
		}
	}

	var policies []models.ABACPolicy
	err := r.db.SelectContext(ctx, &policies, fmt.Sprintf(`SELECT * FROM abac_policies %s ORDER BY created_at DESC`, where), args...)
	if err != nil {
		return nil, 0, err
	}

	var total int
	err = r.db.GetContext(ctx, &total, `SELECT COUNT(*) FROM abac_policies WHERE tenant_id = $1`, tenantID)
	return policies, total, err
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, name, status *string, conditions map[string]string) (*models.ABACPolicy, error) {
	updates := make(map[string]interface{})
	if name != nil {
		updates["name"] = *name
	}
	if status != nil {
		updates["status"] = *status
	}
	if conditions != nil {
		updates["conditions"] = conditions
	}

	if len(updates) == 0 {
		return nil, sentinel.NotFound
	}

	setClauses := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates)+3)
	idx := 1
	for k, v := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", k, idx))
		args = append(args, v)
		idx++
	}
	args = append(args, time.Now().UTC(), id, tenantID)

	result, err := r.db.ExecContext(ctx, fmt.Sprintf(`
		UPDATE abac_policies SET %s, updated_at = $%d WHERE id = $%d AND tenant_id = $%d
	`, setClauses, len(args)-2, len(args)-1, len(args)), args...)
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
	result, err := r.db.ExecContext(ctx, `DELETE FROM abac_policies WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}
