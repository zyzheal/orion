package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/notification-policy/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Policies ---

func (r *Repository) Create(ctx context.Context, policy *models.Policy) error {
	policy.ID = uuid.New().String()
	policy.CreatedAt = time.Now().UTC()
	policy.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO notification_policies (id, tenant_id, user_id, name, description, conditions, actions, priority, "order", enabled, created_at, updated_at)
		 VALUES (:id, :tenantId, :userId, :name, :description, :conditions, :actions, :priority, :order, :enabled, :createdAt, :updatedAt)`,
		policy)
	return err
}

func (r *Repository) GetByID(ctx context.Context, id string, tenantID string) (*models.Policy, error) {
	var policy models.Policy
	err := r.db.GetContext(ctx, &policy,
		`SELECT * FROM notification_policies WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &policy, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, filter *models.ListFilter, limit, offset int) ([]models.Policy, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.Enabled != nil {
			where += fmt.Sprintf(" AND enabled = $%d", argIdx)
			args = append(args, *filter.Enabled)
			argIdx++
		}
		if filter.Priority != nil {
			where += fmt.Sprintf(" AND priority = $%d", argIdx)
			args = append(args, *filter.Priority)
			argIdx++
		}
	}

	query := fmt.Sprintf(`SELECT * FROM notification_policies %s ORDER BY priority DESC, "order" ASC`, where)
	if limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argIdx)
		args = append(args, limit)
		argIdx++
	}
	if offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", argIdx)
		args = append(args, offset)
	}

	var policies []models.Policy
	err := r.db.SelectContext(ctx, &policies, query, args...)
	return policies, err
}

func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM notification_policies WHERE tenant_id=$1`, tenantID)
	return count, err
}

func (r *Repository) Update(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.Policy, error) {
	if len(updates) == 0 {
		return nil, sentinel.NotFound
	}
	updates["updated_at"] = time.Now().UTC()
	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		// Quote the "order" column since it is a reserved word in PostgreSQL
		if key == "order" {
			setClauses = append(setClauses, fmt.Sprintf(`"order" = $%d`, i))
		} else {
			setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		}
		args = append(args, val)
		i++
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf(`UPDATE notification_policies SET %s WHERE id=$%d AND tenant_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetByID(ctx, id, tenantID)
}

func (r *Repository) Delete(ctx context.Context, id string, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM notification_policies WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// --- Workflows ---

func (r *Repository) CreateWorkflow(ctx context.Context, workflow *models.PolicyWorkflow) error {
	workflow.ID = uuid.New().String()
	workflow.CreatedAt = time.Now().UTC()
	workflow.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO notification_policy_workflows (id, tenant_id, user_id, policy_id, name, description, steps, enabled, created_at, updated_at)
		 VALUES (:id, :tenantId, :userId, :policyId, :name, :description, :steps, :enabled, :createdAt, :updatedAt)`,
		workflow)
	return err
}

func (r *Repository) GetWorkflowByPolicyID(ctx context.Context, policyID string) ([]models.PolicyWorkflow, error) {
	var workflows []models.PolicyWorkflow
	err := r.db.SelectContext(ctx, &workflows,
		`SELECT * FROM notification_policy_workflows WHERE policy_id=$1 ORDER BY created_at DESC`, policyID)
	return workflows, err
}

func (r *Repository) GetWorkflowByID(ctx context.Context, policyID string, id string) (*models.PolicyWorkflow, error) {
	var workflow models.PolicyWorkflow
	err := r.db.GetContext(ctx, &workflow,
		`SELECT * FROM notification_policy_workflows WHERE id=$1 AND policy_id=$2`, id, policyID)
	if err != nil {
		return nil, err
	}
	return &workflow, nil
}

func (r *Repository) ListWorkflowsByPolicyID(ctx context.Context, policyID string) ([]models.PolicyWorkflow, error) {
	var workflows []models.PolicyWorkflow
	err := r.db.SelectContext(ctx, &workflows,
		`SELECT * FROM notification_policy_workflows WHERE policy_id=$1 ORDER BY created_at DESC`, policyID)
	return workflows, err
}

func (r *Repository) UpdateWorkflow(ctx context.Context, policyID string, id string, updates map[string]interface{}) (*models.PolicyWorkflow, error) {
	if len(updates) == 0 {
		return nil, sentinel.NotFound
	}
	updates["updated_at"] = time.Now().UTC()
	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	args = append(args, id, policyID)
	query := fmt.Sprintf(`UPDATE notification_policy_workflows SET %s WHERE id=$%d AND policy_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetWorkflowByID(ctx, policyID, id)
}

func (r *Repository) DeleteWorkflow(ctx context.Context, policyID string, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM notification_policy_workflows WHERE id=$1 AND policy_id=$2`, id, policyID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}
