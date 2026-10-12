package repository

import (
	"fmt"
	"strings"
	"context"

	internalrepo "orion/platform-svc-go/internal/repository"

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

func (r *Repository) Create(ctx context.Context, item *CITypeRow) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO cmdb_ci_types (id, tenant_id, name, description, category, icon, version, enabled, attributes, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
		item.ID, item.TenantID, item.Name, item.Description, item.Category,
		item.Icon, item.Version, item.Enabled, item.Attributes)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*CITypeRow, error) {
	var row CITypeRow
	err := r.TenantAwareRepository.Get(ctx, &row,
		`SELECT * FROM cmdb_ci_types WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *Repository) GetByName(ctx context.Context, tenantID, name string) (*CITypeRow, error) {
	var row CITypeRow
	err := r.TenantAwareRepository.Get(ctx, &row,
		`SELECT * FROM cmdb_ci_types WHERE name=$1`, name)
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]CITypeRow, error) {
	var rows []CITypeRow
	err := r.TenantAwareRepository.Select(ctx, &rows,
		`SELECT * FROM cmdb_ci_types ORDER BY created_at DESC`)
	return rows, err
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	sets := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates)+2)
	i := 1
	for k, v := range updates {
		sets = append(sets, fmt.Sprintf("%s=$%d", k, i))
		args = append(args, v)
		i++
	}
	args = append(args, id, tenantID)
	_, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE cmdb_ci_types SET %s, updated_at=NOW() WHERE id=$%d AND tenant_id=$%d`,
			strings.Join(sets, ", "), i, i+1),
		args...)
	return err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.TenantAwareRepository.Exec(ctx,
		`DELETE FROM cmdb_ci_types WHERE id=$1`, id)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}
