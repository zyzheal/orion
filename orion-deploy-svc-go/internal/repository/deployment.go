package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"orion-deploy-svc-go/internal/models"
	"orion/go-common/pkg/database"
)

// DeploymentRepository handles all database operations for the deployments table.
// Every query scopes by tenant_id.
type DeploymentRepository struct {
	db *database.DB
}

func NewDeploymentRepository(db *database.DB) *DeploymentRepository {
	return &DeploymentRepository{db: db}
}

// Create inserts a new deployment record.
func (r *DeploymentRepository) Create(ctx context.Context, tenantID string, d *models.Deployment) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO deployments
			(id, tenant_id, app_name, environment, status, version, commit,
			 created_by, strategy, rollback_to, metadata, started_at, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
		d.ID, tenantID, d.AppName, d.Environment, d.Status, d.Version, d.Commit,
		d.CreatedBy, d.Strategy, d.RollbackTo, d.Metadata, d.StartedAt,
	)
	return err
}

// GetByID returns a single deployment by its UUID, scoped to tenant.
func (r *DeploymentRepository) GetByID(ctx context.Context, tenantID, id string) (*models.Deployment, error) {
	var d models.Deployment
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM deployments WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// ListByTenant returns a paginated list of deployments for a tenant.
func (r *DeploymentRepository) ListByTenant(ctx context.Context, tenantID string, q models.ListDeployQuery) ([]models.Deployment, int, error) {
	var items []models.Deployment
	var total int

	var conditions []string
	args := []any{tenantID}
	argIdx := 2

	if q.AppName != "" {
		conditions = append(conditions, fmt.Sprintf("app_name = $%d", argIdx))
		args = append(args, q.AppName)
		argIdx++
	}
	if q.Environment != "" {
		conditions = append(conditions, fmt.Sprintf("environment = $%d", argIdx))
		args = append(args, q.Environment)
		argIdx++
	}
	if q.Status != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, q.Status)
		argIdx++
	}

	where := "WHERE tenant_id = $1"
	if len(conditions) > 0 {
		where += " AND " + strings.Join(conditions, " AND ")
	}

	countQuery := "SELECT COUNT(*) FROM deployments " + where
	if err := r.db.GetContext(ctx, &total, countQuery, args...); err != nil {
		return nil, 0, err
	}

	allowedOrder := map[string]bool{
		"created_at": true, "updated_at": true, "started_at": true, "app_name": true, "status": true,
	}
	orderCol := "created_at"
	if allowedOrder[q.OrderBy] {
		orderCol = q.OrderBy
	}
	orderDir := "DESC"
	if strings.ToUpper(q.Order) == "ASC" {
		orderDir = "ASC"
	}

	offset := (q.Page - 1) * q.PageSize
	listQuery := fmt.Sprintf(
		"SELECT * FROM deployments %s ORDER BY %s %s LIMIT %d OFFSET %d",
		where, orderCol, orderDir, q.PageSize, offset,
	)
	if err := r.db.SelectContext(ctx, &items, listQuery, args...); err != nil {
		return nil, 0, err
	}

	return items, total, nil
}

// ListByAppAndEnv returns deployments filtered by app and environment, newest first.
func (r *DeploymentRepository) ListByAppAndEnv(ctx context.Context, tenantID, appName, environment string) ([]models.Deployment, error) {
	var items []models.Deployment
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM deployments
		 WHERE tenant_id = $1 AND app_name = $2 AND environment = $3
		 ORDER BY created_at DESC`, tenantID, appName, environment)
	return items, err
}

// GetLatestByAppEnv returns the most recent deployment for an app/environment pair.
func (r *DeploymentRepository) GetLatestByAppEnv(ctx context.Context, tenantID, appName, environment string) (*models.Deployment, error) {
	var d models.Deployment
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM deployments
		 WHERE tenant_id = $1 AND app_name = $2 AND environment = $3
		 ORDER BY created_at DESC LIMIT 1`, tenantID, appName, environment)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// UpdateStatus updates the status, completed_at, and updated_at for a deployment.
func (r *DeploymentRepository) UpdateStatus(ctx context.Context, tenantID, id, status string, completedAt *time.Time) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE deployments SET status = $1, completed_at = $2, updated_at = NOW()
		 WHERE id = $3 AND tenant_id = $4`, status, completedAt, id, tenantID)
	return err
}

// Metrics returns aggregate deployment metrics for a tenant.
func (r *DeploymentRepository) Metrics(ctx context.Context, tenantID string) (*models.DeployMetrics, error) {
	m := &models.DeployMetrics{
		ByEnvironment: make(map[string]int),
		ByApp:         make(map[string]int),
		Last7DaysTrend: []models.TrendPoint{},
	}

	r.db.GetContext(ctx, &m.TotalDeploys,
		`SELECT COUNT(*) FROM deployments WHERE tenant_id = $1`, tenantID)
	r.db.GetContext(ctx, &m.SuccessCount,
		`SELECT COUNT(*) FROM deployments WHERE tenant_id = $1 AND status = 'success'`, tenantID)
	r.db.GetContext(ctx, &m.FailureCount,
		`SELECT COUNT(*) FROM deployments WHERE tenant_id = $1 AND status = 'failed'`, tenantID)
	r.db.GetContext(ctx, &m.PendingCount,
		`SELECT COUNT(*) FROM deployments WHERE tenant_id = $1 AND status = 'running'`, tenantID)
	r.db.GetContext(ctx, &m.CancelledCount,
		`SELECT COUNT(*) FROM deployments WHERE tenant_id = $1 AND status = 'cancelled'`, tenantID)

	var envRows []struct{ Env string `db:"environment"`; C int `db:"c"` }
	r.db.SelectContext(ctx, &envRows,
		`SELECT environment, COUNT(*) as c FROM deployments
		 WHERE tenant_id = $1 GROUP BY environment`, tenantID)
	for _, row := range envRows {
		m.ByEnvironment[row.Env] = row.C
	}

	var appRows []struct{ App string `db:"app_name"`; C int `db:"c"` }
	r.db.SelectContext(ctx, &appRows,
		`SELECT app_name, COUNT(*) as c FROM deployments
		 WHERE tenant_id = $1 GROUP BY app_name`, tenantID)
	for _, row := range appRows {
		m.ByApp[row.App] = row.C
	}

	// Rollback count
	var rbCount int
	r.db.GetContext(ctx, &rbCount,
		`SELECT COUNT(*) FROM rollback_records WHERE tenant_id = $1`, tenantID)
	m.RollbackCount = rbCount

	// Average duration
	var avgDur float64
	r.db.GetContext(ctx, &avgDur,
		`SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - started_at))), 0)
		 FROM deployments WHERE tenant_id = $1 AND completed_at IS NOT NULL`, tenantID)
	m.AvgDurationSec = avgDur

	// Last 7 days trend
	var trendRows []struct{ Date string `db:"date"`; Success int `db:"success"`; Failure int `db:"failure"` }
	r.db.SelectContext(ctx, &trendRows,
		`SELECT DATE(created_at) as date,
				SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
				SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failure
		 FROM deployments
		 WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
		 GROUP BY DATE(created_at) ORDER BY DATE(created_at)`, tenantID)
	for _, row := range trendRows {
		m.Last7DaysTrend = append(m.Last7DaysTrend, models.TrendPoint{
			Date:    row.Date,
			Success: row.Success,
			Failure: row.Failure,
		})
	}

	return m, nil
}
