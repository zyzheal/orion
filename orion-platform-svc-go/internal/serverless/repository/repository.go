package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/serverless/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Functions ---

func (r *Repository) CreateFunction(ctx context.Context, f *models.Function) error {
	f.ID = uuid.New().String()
	f.CreatedAt = time.Now().UTC()
	f.UpdatedAt = time.Now().UTC()
	env, _ := json.Marshal(f.Environment)
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO serverless_functions (id, tenant_id, name, description, runtime, handler, memory, timeout, environment, code, replicas, status, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :description, :runtime, :handler, :memory, :timeout, :environment, :code, :replicas, :status, :created_at, :updated_at)`,
		map[string]interface{}{
			"id":          f.ID,
			"tenant_id":   f.TenantID,
			"name":        f.Name,
			"description": f.Description,
			"runtime":     f.Runtime,
			"handler":     f.Handler,
			"memory":      f.Memory,
			"timeout":     f.Timeout,
			"environment": string(env),
			"code":        f.Code,
			"replicas":    f.Replicas,
			"status":      models.StatusCreated,
			"created_at":  f.CreatedAt,
			"updated_at":  f.UpdatedAt,
		})
	return err
}

func (r *Repository) GetFunction(ctx context.Context, tenantID, id string) (*models.Function, error) {
	var f models.Function
	err := r.db.GetContext(ctx, &f,
		`SELECT * FROM serverless_functions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &f, nil
}

func (r *Repository) ListFunctions(ctx context.Context, tenantID string, q models.ListFunctionsQuery, limit, offset int) ([]models.Function, error) {
	if limit <= 0 {
		limit = 50
	}
	var sql string
	var args []interface{}
	if q.Status != nil && q.Runtime != nil {
		sql = `SELECT * FROM serverless_functions WHERE tenant_id=$1 AND status=$2 AND runtime=$3 ORDER BY created_at DESC LIMIT $4 OFFSET $5`
		args = []interface{}{tenantID, *q.Status, *q.Runtime, limit, offset}
	} else if q.Status != nil {
		sql = `SELECT * FROM serverless_functions WHERE tenant_id=$1 AND status=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`
		// shift: tenant_id=$1, status=$2, limit=$3, offset=$4
		args = []interface{}{tenantID, *q.Status, limit, offset}
	} else if q.Runtime != nil {
		sql = `SELECT * FROM serverless_functions WHERE tenant_id=$1 AND runtime=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`
		args = []interface{}{tenantID, *q.Runtime, limit, offset}
	} else {
		sql = `SELECT * FROM serverless_functions WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
		args = []interface{}{tenantID, limit, offset}
	}
	var items []models.Function
	err := r.db.SelectContext(ctx, &items, sql, args...)
	return items, err
}

func (r *Repository) UpdateFunction(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE serverless_functions SET updated_at=NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) DeleteFunction(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM serverless_functions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// --- Deployments ---

func (r *Repository) CreateDeployment(ctx context.Context, d *models.Deployment) error {
	d.ID = uuid.New().String()
	d.CreatedAt = time.Now().UTC()
	d.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO serverless_deployments (id, tenant_id, function_id, status, created_at, updated_at)
		VALUES (:id, :tenant_id, :function_id, :status, :created_at, :updated_at)`, d)
	return err
}

func (r *Repository) ListDeployments(ctx context.Context, tenantID, functionID string) ([]models.Deployment, error) {
	var items []models.Deployment
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM serverless_deployments WHERE tenant_id=$1 AND function_id=$2 ORDER BY created_at DESC`, tenantID, functionID)
	return items, err
}

// --- Logs ---

func (r *Repository) CreateFunctionLog(ctx context.Context, l *models.FunctionLog) error {
	l.ID = uuid.New().String()
	l.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO serverless_function_logs (id, tenant_id, function_id, level, message, created_at)
		VALUES (:id, :tenant_id, :function_id, :level, :message, :created_at)`, l)
	return err
}

func (r *Repository) GetFunctionLogs(ctx context.Context, tenantID, functionID string, q models.GetFunctionLogsQuery) ([]models.FunctionLog, error) {
	limit := 100
	if q.Limit != nil && *q.Limit > 0 {
		limit = *q.Limit
	}
	var sql string
	var args []interface{}
	if q.Level != nil && *q.Level != "" {
		sql = `SELECT * FROM serverless_function_logs WHERE tenant_id=$1 AND function_id=$2 AND level=$3 ORDER BY created_at DESC LIMIT $4`
		args = []interface{}{tenantID, functionID, *q.Level, limit}
	} else {
		sql = `SELECT * FROM serverless_function_logs WHERE tenant_id=$1 AND function_id=$2 ORDER BY created_at DESC LIMIT $3`
		args = []interface{}{tenantID, functionID, limit}
	}
	var items []models.FunctionLog
	err := r.db.SelectContext(ctx, &items, sql, args...)
	return items, err
}

// --- Metrics ---

func (r *Repository) UpsertFunctionMetric(ctx context.Context, tenantID, functionID string, invocations int64, avgDurationMs float64, errorCount int64, errorRate float64, memoryUsageMB float64) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO serverless_function_metrics (tenant_id, function_id, invocations, avg_duration_ms, error_count, error_rate, memory_usage_mb, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
		ON CONFLICT (tenant_id, function_id) DO UPDATE SET invocations=EXCLUDED.invocations, avg_duration_ms=EXCLUDED.avg_duration_ms, error_count=EXCLUDED.error_count, error_rate=EXCLUDED.error_rate, memory_usage_mb=EXCLUDED.memory_usage_mb`,
		tenantID, functionID, invocations, avgDurationMs, errorCount, errorRate, memoryUsageMB)
	return err
}

func (r *Repository) GetFunctionMetrics(ctx context.Context, tenantID, functionID string) (*models.FunctionMetric, error) {
	var m models.FunctionMetric
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM serverless_function_metrics WHERE tenant_id=$1 AND function_id=$2`, tenantID, functionID)
	return &m, err
}

func (r *Repository) GetAggregateMetrics(ctx context.Context, tenantID string) (*models.AggregateMetrics, error) {
	var agg models.AggregateMetrics
	agg.TenantID = tenantID
	err := r.db.GetContext(ctx, &agg,
		`SELECT COUNT(*) AS total_functions, SUM(invocations) AS total_invocations, AVG(error_rate) AS avg_error_rate
		FROM serverless_function_metrics WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	var top []models.FunctionMetric
	err = r.db.SelectContext(ctx, &top,
		`SELECT * FROM serverless_function_metrics WHERE tenant_id=$1 ORDER BY invocations DESC LIMIT 10`, tenantID)
	if err != nil {
		return nil, err
	}
	agg.TopFunctions = top
	return &agg, nil
}

// --- Triggers ---

func (r *Repository) CreateTrigger(ctx context.Context, t *models.Trigger) error {
	t.ID = uuid.New().String()
	t.CreatedAt = time.Now().UTC()
	t.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO serverless_triggers (id, tenant_id, function_id, type, name, config, created_at, updated_at)
		VALUES (:id, :tenant_id, :function_id, :type, :name, :config, :created_at, :updated_at)`, t)
	return err
}

func (r *Repository) GetTrigger(ctx context.Context, tenantID, id string) (*models.Trigger, error) {
	var t models.Trigger
	err := r.db.GetContext(ctx, &t,
		`SELECT * FROM serverless_triggers WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return &t, err
}

func (r *Repository) ListTriggers(ctx context.Context, tenantID string, q models.ListTriggersQuery) ([]models.Trigger, error) {
	var sql string
	var args []interface{}
	if q.FunctionID != nil && q.Type != nil {
		sql = `SELECT * FROM serverless_triggers WHERE tenant_id=$1 AND function_id=$2 AND type=$3 ORDER BY created_at`
		args = []interface{}{tenantID, *q.FunctionID, *q.Type}
	} else if q.FunctionID != nil {
		sql = `SELECT * FROM serverless_triggers WHERE tenant_id=$1 AND function_id=$2 ORDER BY created_at`
		// shift
		args = []interface{}{tenantID, *q.FunctionID}
	} else if q.Type != nil {
		sql = `SELECT * FROM serverless_triggers WHERE tenant_id=$1 AND type=$2 ORDER BY created_at`
		args = []interface{}{tenantID, *q.Type}
	} else {
		sql = `SELECT * FROM serverless_triggers WHERE tenant_id=$1 ORDER BY created_at`
		args = []interface{}{tenantID}
	}
	var items []models.Trigger
	err := r.db.SelectContext(ctx, &items, sql, args...)
	return items, err
}

func (r *Repository) DeleteTrigger(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM serverless_triggers WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// --- Auto-scaling ---

func (r *Repository) EvaluateAutoScaling(ctx context.Context, tenantID string) ([]models.AutoScalingRecommendation, error) {
	// Simulate evaluation: recommend +1 replica for functions above 80% error rate.
	var recs []models.AutoScalingRecommendation
	err := r.db.SelectContext(ctx, &recs,
		`SELECT f.id AS function_id, f.name AS function_name, f.replicas AS current_replicas, fm.error_rate, fm.invocations
		FROM serverless_functions f
		LEFT JOIN serverless_function_metrics fm ON f.id = fm.function_id AND f.tenant_id = fm.tenant_id
		WHERE f.tenant_id=$1 AND fm.error_rate > 0.8`, tenantID)
	return recs, err
}

func (r *Repository) GetFunctionsForAutoScaling(ctx context.Context, tenantID string) ([]models.Function, error) {
	var items []models.Function
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM serverless_functions WHERE tenant_id=$1 AND status=$2`, tenantID, models.StatusDeployed)
	return items, err
}

// --- Helpers ---

func (r *Repository) FunctionExists(ctx context.Context, tenantID, functionID string) (bool, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM serverless_functions WHERE id=$1 AND tenant_id=$2`, functionID, tenantID)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func NotYetImplemented(msg string) error {
	return fmt.Errorf("%s", msg)
}
