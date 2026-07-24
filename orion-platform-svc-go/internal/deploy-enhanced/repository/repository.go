package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/deploy-enhanced/models"

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

// --- Deploy Windows ---

func (r *Repository) CreateWindow(ctx context.Context, w *models.DeployWindow) error {
	w.ID = uuid.New().String()
	now := time.Now().UTC()
	w.CreatedAt = now
	w.UpdatedAt = now
	if w.Type == "" {
		w.Type = "scheduled"
	}
	if w.Status == "" {
		w.Status = "active"
	}
	if w.CreatedBy == "" {
		w.CreatedBy = "system"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO deploy_windows (id, tenant_id, name, environment_id, type, cron_expression,
		     start_time, end_time, duration_minutes, timezone, status, created_by, created_at, updated_at)
		 VALUES (:id, :tenantId, :name, :environmentId, :type, :cronExpression,
		     :startTime, :endTime, :durationMinutes, :timezone, :status, :createdBy, :createdAt, :updatedAt)`,
		w)
	return err
}

func (r *Repository) GetWindowByID(ctx context.Context, id string, tenantID string) (*models.DeployWindow, error) {
	var w models.DeployWindow
	err := r.db.GetContext(ctx, &w,
		`SELECT * FROM deploy_windows WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &w, nil
}

func (r *Repository) ListWindows(ctx context.Context, tenantID string, environmentID *string, status *string) ([]models.DeployWindow, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2
	if environmentID != nil && *environmentID != "" {
		where += fmt.Sprintf(" AND environment_id = $%d", argIdx)
		args = append(args, *environmentID)
		argIdx++
	}
	if status != nil && *status != "" {
		where += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, *status)
	}
	var windows []models.DeployWindow
	err := r.db.SelectContext(ctx, &windows,
		fmt.Sprintf(`SELECT * FROM deploy_windows %s ORDER BY created_at DESC`, where), args...)
	return windows, err
}

func (r *Repository) UpdateWindow(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.DeployWindow, error) {
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
	args = append(args, id, tenantID)
	query := fmt.Sprintf(`UPDATE deploy_windows SET %s WHERE id=$%d AND tenant_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetWindowByID(ctx, id, tenantID)
}

func (r *Repository) DeleteWindow(ctx context.Context, id string, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM deploy_windows WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

func (r *Repository) CheckWindowActive(ctx context.Context, tenantID string, environmentID string) (bool, error) {
	var isActive bool
	err := r.db.GetContext(ctx, &isActive,
		`SELECT COUNT(*) > 0
		 FROM deploy_windows
		 WHERE tenant_id=$1
		   AND environment_id=$2
		   AND status='active'
		   AND start_time <= NOW()
		   AND end_time >= NOW()`,
		tenantID, environmentID)
	return isActive, err
}

// --- Progressive Deploys ---

func (r *Repository) CreateProgressiveDeploy(ctx context.Context, pd *models.ProgressiveDeploy) error {
	pd.ID = uuid.New().String()
	now := time.Now().UTC()
	pd.CreatedAt = now
	pd.UpdatedAt = now
	if pd.Strategy == "" {
		pd.Strategy = "gradual"
	}
	if pd.Status == "" {
		pd.Status = "pending"
	}
	pd.CurrentStage = 0
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO progressive_deploys (id, tenant_id, deployment_id, strategy, stages,
		     current_stage, status, rollback_enabled, created_at, updated_at)
		 VALUES (:id, :tenantId, :deploymentId, :strategy, :stages,
		     :currentStage, :status, :rollbackEnabled, :createdAt, :updatedAt)`,
		pd)
	return err
}

func (r *Repository) GetProgressiveDeploy(ctx context.Context, id string, tenantID string) (*models.ProgressiveDeploy, error) {
	var pd models.ProgressiveDeploy
	err := r.db.GetContext(ctx, &pd,
		`SELECT * FROM progressive_deploys WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &pd, nil
}

func (r *Repository) UpdateProgressiveDeploy(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.ProgressiveDeploy, error) {
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
	args = append(args, id, tenantID)
	query := fmt.Sprintf(`UPDATE progressive_deploys SET %s WHERE id=$%d AND tenant_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetProgressiveDeploy(ctx, id, tenantID)
}

// --- Emergency Deploys ---

func (r *Repository) CreateEmergencyDeploy(ctx context.Context, ed *models.EmergencyDeploy) error {
	ed.ID = uuid.New().String()
	now := time.Now().UTC()
	ed.CreatedAt = now
	ed.UpdatedAt = now
	if ed.Status == "" {
		ed.Status = "pending"
	}
	if ed.Urgency == "" {
		ed.Urgency = "high"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO emergency_deploys (id, tenant_id, deployment_id, reason, requested_by,
		     approved_by, urgency, status, post_mortem, executed_at, created_at, updated_at)
		 VALUES (:id, :tenantId, :deploymentId, :reason, :requestedBy,
		     :approvedBy, :urgency, :status, :postMortem, :executedAt, :createdAt, :updatedAt)`,
		ed)
	return err
}

func (r *Repository) GetEmergencyDeploy(ctx context.Context, id string, tenantID string) (*models.EmergencyDeploy, error) {
	var ed models.EmergencyDeploy
	err := r.db.GetContext(ctx, &ed,
		`SELECT * FROM emergency_deploys WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &ed, nil
}

func (r *Repository) ListEmergencyDeploys(ctx context.Context, tenantID string, status *string) ([]models.EmergencyDeploy, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2
	if status != nil && *status != "" {
		where += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, *status)
	}
	var emergencies []models.EmergencyDeploy
	err := r.db.SelectContext(ctx, &emergencies,
		fmt.Sprintf(`SELECT * FROM emergency_deploys %s ORDER BY created_at DESC`, where), args...)
	return emergencies, err
}

func (r *Repository) UpdateEmergencyDeploy(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.EmergencyDeploy, error) {
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
	args = append(args, id, tenantID)
	query := fmt.Sprintf(`UPDATE emergency_deploys SET %s WHERE id=$%d AND tenant_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return r.GetEmergencyDeploy(ctx, id, tenantID)
}

// IsNotFound returns true for database not-found errors.
func IsNotFound(err error) bool {
	return err == sql.ErrNoRows || errors.Is(err, sentinel.NotFound)
}
