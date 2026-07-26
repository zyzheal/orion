package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"orion/infra-ops-svc-go/internal/serverless/models"

	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ─── Functions ─────────────────────────────────────────────────────────────────

func (r *Repository) CreateFunction(ctx context.Context, fn *models.ServerlessFunction) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO serverless_functions (id, tenant_id, name, description, runtime, handler, memory, timeout, environment, code, replicas, status, created_by, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
		fn.ID, fn.TenantID, fn.Name, fn.Description, fn.Runtime, fn.Handler,
		fn.Memory, fn.Timeout, fn.Environment, fn.Code, fn.Replicas, fn.Status,
		fn.CreatedBy, fn.CreatedAt, fn.UpdatedAt)
	return err
}

func (r *Repository) GetFunctionByID(ctx context.Context, tenantID, id string) (*models.ServerlessFunction, error) {
	var fn models.ServerlessFunction
	err := r.db.GetContext(ctx, &fn,
		`SELECT * FROM serverless_functions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &fn, nil
}

func (r *Repository) ListFunctions(ctx context.Context, tenantID string, offset, limit int) ([]models.ServerlessFunction, error) {
	var items []models.ServerlessFunction
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM serverless_functions WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

func (r *Repository) UpdateFunction(ctx context.Context, tenantID, id string, req *models.UpdateFunctionRequest) (*models.ServerlessFunction, error) {
	setClauses := []string{}
	args := []interface{}{}
	idx := 1

	if req.Name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name=$%d", idx)); args = append(args, *req.Name); idx++
	}
	if req.Description != nil {
		setClauses = append(setClauses, fmt.Sprintf("description=$%d", idx)); args = append(args, *req.Description); idx++
	}
	if req.Runtime != nil {
		setClauses = append(setClauses, fmt.Sprintf("runtime=$%d", idx)); args = append(args, *req.Runtime); idx++
	}
	if req.Handler != nil {
		setClauses = append(setClauses, fmt.Sprintf("handler=$%d", idx)); args = append(args, *req.Handler); idx++
	}
	if req.Memory != nil {
		setClauses = append(setClauses, fmt.Sprintf("memory=$%d", idx)); args = append(args, *req.Memory); idx++
	}
	if req.Timeout != nil {
		setClauses = append(setClauses, fmt.Sprintf("timeout=$%d", idx)); args = append(args, *req.Timeout); idx++
	}
	if req.Environment != nil {
		setClauses = append(setClauses, fmt.Sprintf("environment=$%d", idx)); args = append(args, *req.Environment); idx++
	}
	if req.Code != nil {
		setClauses = append(setClauses, fmt.Sprintf("code=$%d", idx)); args = append(args, *req.Code); idx++
	}
	if req.Replicas != nil {
		setClauses = append(setClauses, fmt.Sprintf("replicas=$%d", idx)); args = append(args, *req.Replicas); idx++
	}

	if len(setClauses) == 0 {
		return r.GetFunctionByID(ctx, tenantID, id)
	}

	setClauses = append(setClauses, fmt.Sprintf("updated_at=$%d", idx))
	args = append(args, time.Now())
	idx++

	query := fmt.Sprintf("UPDATE serverless_functions SET %s WHERE id=$%d AND tenant_id=$%d RETURNING *",
		strings.Join(setClauses, ", "), idx, idx+1)
	args = append(args, id, tenantID)

	var fn models.ServerlessFunction
	err := r.db.GetContext(ctx, &fn, query, args...)
	if err != nil {
		return nil, err
	}
	return &fn, nil
}

func (r *Repository) UpdateFunctionStatus(ctx context.Context, tenantID, id, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE serverless_functions SET status=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`,
		status, time.Now(), id, tenantID)
	return err
}

func (r *Repository) DeleteFunction(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM serverless_functions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) CountFunctions(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM serverless_functions WHERE tenant_id=$1`, tenantID)
	return count, err
}

// ─── Deployments ───────────────────────────────────────────────────────────────

func (r *Repository) CreateDeployment(ctx context.Context, d *models.FunctionDeployment) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO serverless_deployments (id, function_id, tenant_id, version, status, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6)`,
		d.ID, d.FunctionID, d.TenantID, d.Version, d.Status, d.CreatedAt)
	return err
}

func (r *Repository) ListDeployments(ctx context.Context, tenantID, functionID string) ([]models.FunctionDeployment, error) {
	var items []models.FunctionDeployment
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM serverless_deployments WHERE tenant_id=$1 AND function_id=$2 ORDER BY created_at DESC`,
		tenantID, functionID)
	return items, err
}

// ─── Triggers ──────────────────────────────────────────────────────────────────

func (r *Repository) CreateTrigger(ctx context.Context, t *models.FunctionTrigger) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO serverless_triggers (id, tenant_id, function_id, name, type, config, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		t.ID, t.TenantID, t.FunctionID, t.Name, t.Type, t.Config, t.CreatedAt, t.UpdatedAt)
	return err
}

func (r *Repository) GetTriggerByID(ctx context.Context, tenantID, id string) (*models.FunctionTrigger, error) {
	var t models.FunctionTrigger
	err := r.db.GetContext(ctx, &t,
		`SELECT * FROM serverless_triggers WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *Repository) ListTriggers(ctx context.Context, tenantID string, functionID *string) ([]models.FunctionTrigger, error) {
	var items []models.FunctionTrigger
	if functionID != nil {
		err := r.db.SelectContext(ctx, &items,
			`SELECT * FROM serverless_triggers WHERE tenant_id=$1 AND function_id=$2 ORDER BY created_at DESC`,
			tenantID, *functionID)
		return items, err
	}
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM serverless_triggers WHERE tenant_id=$1 ORDER BY created_at DESC`,
		tenantID)
	return items, err
}

func (r *Repository) DeleteTrigger(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM serverless_triggers WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ─── Logs ──────────────────────────────────────────────────────────────────────

func (r *Repository) ListLogs(ctx context.Context, tenantID, functionID string, level string, limit int) ([]models.FunctionLog, error) {
	var items []models.FunctionLog
	if level != "" {
		err := r.db.SelectContext(ctx, &items,
			`SELECT * FROM serverless_logs WHERE tenant_id=$1 AND function_id=$2 AND level=$3 ORDER BY created_at DESC LIMIT $4`,
			tenantID, functionID, level, limit)
		return items, err
	}
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM serverless_logs WHERE tenant_id=$1 AND function_id=$2 ORDER BY created_at DESC LIMIT $3`,
		tenantID, functionID, limit)
	return items, err
}

// ─── Metrics ───────────────────────────────────────────────────────────────────

func (r *Repository) ListMetrics(ctx context.Context, tenantID, functionID string) ([]models.FunctionMetric, error) {
	var items []models.FunctionMetric
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM serverless_metrics WHERE tenant_id=$1 AND function_id=$2 ORDER BY recorded_at DESC LIMIT 100`,
		tenantID, functionID)
	return items, err
}

func (r *Repository) CountFunctionsByStatus(ctx context.Context, tenantID, status string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM serverless_functions WHERE tenant_id=$1 AND status=$2`, tenantID, status)
	return count, err
}