package repository

import (
	"fmt"
	"strings"

	"orion-cmdb-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

type CIRepository struct {
	db *sqlx.DB
}

func NewCIRepository(db *sqlx.DB) *CIRepository {
	return &CIRepository{db: db}
}

func (r *CIRepository) Create(item *models.CIItem) error {
	query := `INSERT INTO ci_items (id, tenant_id, name, ci_type, status, owner, attributes)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`
	_, err := r.db.Exec(query,
		item.ID, item.TenantID, item.Name, item.CIType, item.Status, item.Owner, item.Attributes,
	)
	return err
}

func (r *CIRepository) GetByID(id, tenantID string) (*models.CIItem, error) {
	var item models.CIItem
	err := r.db.Get(&item, "SELECT * FROM ci_items WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *CIRepository) List(tenantID string, q models.ListQuery) ([]models.CIItem, int, error) {
	var items []models.CIItem
	var total int

	var conditions []string
	args := []any{tenantID}
	argIdx := 2

	if q.CIType != "" {
		conditions = append(conditions, fmt.Sprintf("ci_type = $%d", argIdx))
		args = append(args, q.CIType)
		argIdx++
	}
	if q.Status != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, q.Status)
		argIdx++
	}
	if q.Name != "" {
		conditions = append(conditions, fmt.Sprintf("name ILIKE $%d", argIdx))
		args = append(args, "%"+q.Name+"%")
		argIdx++
	}

	where := "WHERE tenant_id = $1"
	if len(conditions) > 0 {
		where += " AND " + strings.Join(conditions, " AND ")
	}

	countQuery := "SELECT COUNT(*) FROM ci_items " + where
	err := r.db.Get(&total, countQuery, args...)
	if err != nil {
		return nil, 0, err
	}

	offset := (q.Page - 1) * q.PageSize
	listQuery := "SELECT * FROM ci_items " + where + fmt.Sprintf(" ORDER BY created_at DESC LIMIT %d OFFSET %d", q.PageSize, offset)
	err = r.db.Select(&items, listQuery, args...)
	if err != nil {
		return nil, 0, err
	}

	return items, total, nil
}

func (r *CIRepository) Update(item *models.CIItem) error {
	query := `UPDATE ci_items SET name=$1, ci_type=$2, status=$3, owner=$4, attributes=$5, updated_at=NOW()
		WHERE id=$6 AND tenant_id=$7`
	_, err := r.db.Exec(query,
		item.Name, item.CIType, item.Status, item.Owner, item.Attributes, item.ID, item.TenantID,
	)
	return err
}

func (r *CIRepository) Delete(id, tenantID string) error {
	_, err := r.db.Exec("DELETE FROM ci_items WHERE id = $1 AND tenant_id = $2", id, tenantID)
	return err
}
