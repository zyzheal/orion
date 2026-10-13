package repository

import (
	"context"
	"fmt"
	"strings"

	internalrepo "orion/platform-svc-go/internal/repository"
	"orion/platform-svc-go/internal/inspection-template/models"

	"github.com/jmoiron/sqlx"
)

var allowedTemplateColumns = map[string]bool{
	"name": true, "description": true, "category": true,
	"target_type": true, "rules": true, "enabled": true,
}

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

func (r *Repository) Create(ctx context.Context, item *models.InspectionTemplate) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO inspection_templates (id, tenant_id, name, description, category, target_type, rules, enabled, version, created_by, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())`,
		item.ID, item.TenantID, item.Name, item.Description, item.Category,
		item.TargetType, item.Rules, item.Enabled, item.Version, item.CreatedBy)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.InspectionTemplate, error) {
	var row models.InspectionTemplate
	err := r.TenantAwareRepository.Get(ctx, &row,
		`SELECT * FROM inspection_templates WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.InspectionTemplate, error) {
	var rows []models.InspectionTemplate
	err := r.TenantAwareRepository.Select(ctx, &rows,
		`SELECT * FROM inspection_templates ORDER BY created_at DESC`)
	return rows, err
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return fmt.Errorf("no fields to update")
	}
	sets := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates)+2)
	i := 1
	for k, v := range updates {
		if !allowedTemplateColumns[k] {
			return fmt.Errorf("column %q is not allowed in update", k)
		}
		sets = append(sets, fmt.Sprintf("%s=$%d", k, i))
		args = append(args, v)
		i++
	}
	args = append(args, id, tenantID)
	_, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE inspection_templates SET %s, updated_at=NOW() WHERE id=$%d AND tenant_id=$%d`,
			strings.Join(sets, ", "), i, i+1), args...)
	return err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.TenantAwareRepository.Exec(ctx,
		`DELETE FROM inspection_templates WHERE id=$1`, id)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}
