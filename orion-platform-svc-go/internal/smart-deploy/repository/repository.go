package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/smart-deploy/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("deployment not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// === Deployments ===

func (r *Repository) Create(ctx context.Context, tenantID string, req models.CreateDeploymentRequest) (*models.Deployment, error) {
	now := time.Now().UTC()

	stagesJSON := "{}"
	if req.StrategyConfig != nil {
		b, err := json.Marshal(*req.StrategyConfig)
		if err != nil {
			return nil, err
		}
		stagesJSON = string(b)
	}

	strategy := models.StrategyRolling
	if req.Strategy != "" {
		strategy = req.Strategy
	}

	d := &models.Deployment{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		AppName:       req.AppName,
		Version:       req.Version,
		Environment:   req.Environment,
		Strategy:      strategy,
		Status:        models.DeploymentStatusPending,
		Image:         req.Image,
		InitiatedBy:   req.InitiatedBy,
		Notes:         req.Notes,
		ChangeRequestID: req.ChangeRequestID,
		CommitSHA:     req.CommitSHA,
		Stages:        stagesJSON,
		CreatedAt:     now,
		UpdatedAt:     now,
		StartedAt:     &now,
	}

	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO smart_deploy_deployments
			(id, tenant_id, app_name, version, environment, strategy, status,
			 image, initiated_by, notes, change_request_id, commit_sha, stages,
			 created_at, updated_at, started_at)
		VALUES (:id, :tenantId, :appName, :version, :environment, :strategy, :status,
				:image, :initiatedBy, :notes, :changeRequestId, :commitSha, :stages,
				:createdAt, :updatedAt, :startedAt)
	`, d)
	return d, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Deployment, error) {
	var d models.Deployment
	err := r.db.GetContext(ctx, &d, `SELECT * FROM smart_deploy_deployments WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &d, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, opt models.ListDeploymentsOptions) ([]models.Deployment, int, error) {
	limit := opt.Limit
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	offset := (opt.Page - 1) * limit
	if opt.Page <= 0 {
		opt.Page = 1
		offset = 0
	}

	whereParts := []string{"tenant_id = $1"}
	args := []interface{}{tenantID}
	argIdx := 2

	if opt.AppName != "" {
		whereParts = append(whereParts, fmt.Sprintf("app_name = $%d", argIdx))
		args = append(args, opt.AppName)
		argIdx++
	}
	if opt.Version != "" {
		whereParts = append(whereParts, fmt.Sprintf("version = $%d", argIdx))
		args = append(args, opt.Version)
		argIdx++
	}
	if opt.Environment != "" {
		whereParts = append(whereParts, fmt.Sprintf("environment = $%d", argIdx))
		args = append(args, opt.Environment)
		argIdx++
	}
	if opt.Status != "" {
		whereParts = append(whereParts, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, string(opt.Status))
		argIdx++
	}

	whereClause := strings.Join(whereParts, " AND ")

	var total int
	if err := r.db.GetContext(ctx, &total, "SELECT COUNT(*) FROM smart_deploy_deployments WHERE "+whereClause, args...); err != nil {
		return nil, 0, err
	}

	dataSQL := fmt.Sprintf("SELECT * FROM smart_deploy_deployments WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d",
		whereClause, argIdx, argIdx+1)
	args = append(args, limit, offset)

	var deployments []models.Deployment
	if err := r.db.SelectContext(ctx, &deployments, dataSQL, args...); err != nil {
		return nil, 0, err
	}
	return deployments, total, nil
}

// GetLatest returns the most recent deployment for a given app + environment.
func (r *Repository) GetLatest(ctx context.Context, tenantID, appName, environment string) (*models.Deployment, error) {
	var d models.Deployment
	err := r.db.GetContext(ctx, &d, `
		SELECT * FROM smart_deploy_deployments
		WHERE tenant_id=$1 AND app_name=$2 AND environment=$3
		ORDER BY created_at DESC LIMIT 1
	`, tenantID, appName, environment)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &d, nil
}

func (r *Repository) UpdateStatus(ctx context.Context, tenantID, id string, status models.DeploymentStatus) (*models.Deployment, error) {
	now := time.Now().UTC()
	updates := map[string]interface{}{
		"status":      string(status),
		"updated_at":  now,
	}

	if status == models.DeploymentStatusCompleted || status == models.DeploymentStatusFailed || status == models.DeploymentStatusCancelled {
		updates["completed_at"] = now
	}

	setParts := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates)+2)
	idx := 1
	for k, v := range updates {
		setParts = append(setParts, k+" = $"+fmt.Sprint(idx))
		args = append(args, v)
		idx++
	}
	args = append(args, id, tenantID)

	query := "UPDATE smart_deploy_deployments SET " + strings.Join(setParts, ", ") + " WHERE id = $" + fmt.Sprint(idx) + " AND tenant_id = $" + fmt.Sprint(idx+1) + " RETURNING *"
	var d models.Deployment
	err := r.db.GetContext(ctx, &d, query, args...)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// === Rollbacks ===

func (r *Repository) CreateRollback(ctx context.Context, tenantID string, req models.CreateRollbackRequest, deploymentID string) (*models.Rollback, error) {
	now := time.Now().UTC()
	rb := &models.Rollback{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		DeploymentID:  deploymentID,
		TargetVersion: req.TargetVersion,
		Reason:        req.Reason,
		TriggeredBy:   req.TriggeredBy,
		Status:        "running",
		StartedAt:     &now,
		CreatedAt:     now,
	}
	_, err := r.db.NamedExecContext(ctx,
		"INSERT INTO rollbacks (id, tenant_id, deployment_id, target_version, reason, triggered_by, status, started_at, created_at) VALUES (:id, :tenantId, :deploymentId, :targetVersion, :reason, :triggeredBy, :status, :startedAt, :createdAt)",
		rb)
	return rb, err
}

func (r *Repository) ListRollbacks(ctx context.Context, tenantID, deploymentID string) ([]models.Rollback, error) {
	var rollbacks []models.Rollback
	err := r.db.SelectContext(ctx, &rollbacks,
		"SELECT * FROM rollbacks WHERE tenant_id=$1 AND deployment_id=$2 ORDER BY created_at DESC", tenantID, deploymentID)
	return rollbacks, err
}

func (r *Repository) UpdateRollbackStatus(ctx context.Context, tenantID, id string, status string) (*models.Rollback, error) {
	now := time.Now().UTC()
	completedAt := sql.NullTime{}
	if status == "completed" {
		completedAt = sql.NullTime{Time: now, Valid: true}
	}
	var rb models.Rollback
	err := r.db.GetContext(ctx, &rb,
		"UPDATE rollbacks SET status=$1, completed_at=$2, updated_at=$3 WHERE id=$4 AND tenant_id=$5 RETURNING *",
		status, completedAt, now, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &rb, nil
}

func (r *Repository) SetRollbackCompleted(ctx context.Context, tenantID, id string) error {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		"UPDATE rollbacks SET status='completed', completed_at=$1, updated_at=$1 WHERE id=$2 AND tenant_id=$3",
		now, id, tenantID)
	return err
}

// === Metrics ===

func (r *Repository) GetMetrics(ctx context.Context, tenantID string) (*models.DeploymentMetrics, error) {
	m := &models.DeploymentMetrics{}
	err := r.db.GetContext(ctx, m,
		"SELECT COUNT(*) as total_deployments, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as successful_deployments, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed_deployments, SUM(CASE WHEN status='rolled_back' THEN 1 ELSE 0 END) as rolled_back_deployments, SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) as cancelled_deployments FROM smart_deploy_deployments WHERE tenant_id=$1",
		tenantID)
	if err != nil {
		return nil, err
	}
	if m.TotalDeployments > 0 {
		m.SuccessRate = m.SuccessfulDeployments * 100 / m.TotalDeployments
		m.RollbackRate = m.RolledBackDeployments * 100 / m.TotalDeployments
	}
	m.ByStrategy = make(map[string]int)
	m.ByEnvironment = make(map[string]int)
	m.ByStatus = make(map[string]int)
	var byStrategy []struct {
		Strategy string `db:"strategy"`
		Count    int    `db:"count"`
	}
	if err := r.db.SelectContext(ctx, &byStrategy, "SELECT strategy, COUNT(*) as count FROM smart_deploy_deployments WHERE tenant_id=$1 GROUP BY strategy", tenantID); err != nil {
		return nil, err
	}
	for _, s := range byStrategy {
		m.ByStrategy[s.Strategy] = s.Count
	}
	var byEnv []struct {
		Env   string `db:"environment"`
		Count int    `db:"count"`
	}
	if err := r.db.SelectContext(ctx, &byEnv, "SELECT environment, COUNT(*) as count FROM smart_deploy_deployments WHERE tenant_id=$1 GROUP BY environment", tenantID); err != nil {
		return nil, err
	}
	for _, e := range byEnv {
		m.ByEnvironment[e.Env] = e.Count
	}
	var byStatus []struct {
		Status string `db:"status"`
		Count  int    `db:"count"`
	}
	if err := r.db.SelectContext(ctx, &byStatus, "SELECT status, COUNT(*) as count FROM smart_deploy_deployments WHERE tenant_id=$1 GROUP BY status", tenantID); err != nil {
		return nil, err
	}
	for _, s := range byStatus {
		m.ByStatus[s.Status] = s.Count
	}
	return m, nil
}

// === Audit ===

func (r *Repository) CreateAuditEntry(ctx context.Context, tenantID string, entry models.AuditEntry) error {
	entry.ID = uuid.New().String()
	entry.TenantID = tenantID
	entry.Timestamp = time.Now().UTC()
	detailsJSON := "{}"
	if entry.Details != "" {
		detailsJSON = entry.Details
	}
	_, err := r.db.NamedExecContext(ctx,
		"INSERT INTO deployment_audit_log (id, tenant_id, deployment_id, action, performed_by, details, timestamp) VALUES (:id, :tenantId, :deploymentId, :action, :performedBy, :details, :timestamp)",
		map[string]interface{}{
			"id":           entry.ID,
			"tenantId":     tenantID,
			"deploymentId": entry.DeploymentID,
			"action":       entry.Action,
			"performedBy":  entry.PerformedBy,
			"details":      detailsJSON,
			"timestamp":    entry.Timestamp,
		})
	return err
}

func (r *Repository) ListAuditEntries(ctx context.Context, tenantID, deploymentID string) ([]models.AuditEntry, error) {
	var entries []models.AuditEntry
	err := r.db.SelectContext(ctx, &entries,
		"SELECT * FROM deployment_audit_log WHERE tenant_id=$1 AND deployment_id=$2 ORDER BY timestamp DESC", tenantID, deploymentID)
	return entries, err
}
