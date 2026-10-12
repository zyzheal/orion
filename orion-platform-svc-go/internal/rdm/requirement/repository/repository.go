package repository

import (
	"context"
	"fmt"
	"strings"

	internalrepo "orion/platform-svc-go/internal/repository"
	"orion/platform-svc-go/internal/rdm/requirement/models"

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

func (r *Repository) Create(ctx context.Context, item *models.Requirement) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO rdm_requirements (id, tenant_id, title, description, status, priority, type, effort_points, sprint_id, project_id, parent_id, repo_ref, labels, severity, estimated_hours, assignee_id, created_by, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())`,
		item.ID, item.TenantID, item.Title, item.Description, item.Status,
		item.Priority, item.Type, item.EffortPoints, item.SprintID, item.ProjectID,
		item.ParentID, item.RepoRef, item.Labels, item.Severity, item.EstimatedHours,
		item.AssigneeID, item.CreatedBy)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Requirement, error) {
	var row models.Requirement
	err := r.TenantAwareRepository.Get(ctx, &row,
		`SELECT * FROM rdm_requirements WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, q *models.ListRequirementsRequest) ([]models.Requirement, int, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	idx := 1

	if q.Status != "" {
		where = append(where, fmt.Sprintf("status=$%d", idx))
		args = append(args, q.Status)
		idx++
	}
	if q.Priority != "" {
		where = append(where, fmt.Sprintf("priority=$%d", idx))
		args = append(args, q.Priority)
		idx++
	}
	if q.Type != "" {
		where = append(where, fmt.Sprintf("type=$%d", idx))
		args = append(args, q.Type)
		idx++
	}
	if q.SprintID != "" {
		where = append(where, fmt.Sprintf("sprint_id=$%d", idx))
		args = append(args, q.SprintID)
		idx++
	}

	whereStr := strings.Join(where, " AND ")
	page := q.Page
	if page < 1 {
		page = 1
	}
	pageSize := q.PageSize
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	var total int
	countArgs := append([]interface{}{}, args...)
	err := r.TenantAwareRepository.Get(ctx, &total,
		fmt.Sprintf(`SELECT COUNT(*) FROM rdm_requirements WHERE %s`, whereStr), countArgs...)
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	listArgs := append([]interface{}{}, args...)
	listArgs = append(listArgs, pageSize, offset)

	var rows []models.Requirement
	err = r.TenantAwareRepository.Select(ctx, &rows,
		fmt.Sprintf(`SELECT * FROM rdm_requirements WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
			whereStr, len(args)+1, len(args)+2), listArgs...)
	return rows, total, err
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return fmt.Errorf("no fields to update")
	}
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
		fmt.Sprintf(`UPDATE rdm_requirements SET %s, updated_at=NOW() WHERE id=$%d AND tenant_id=$%d`,
			strings.Join(sets, ", "), i, i+1), args...)
	return err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.TenantAwareRepository.Exec(ctx,
		`DELETE FROM rdm_requirements WHERE id=$1`, id)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}
