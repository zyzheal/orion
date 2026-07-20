package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/progressive/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// sentinel.NotFound indicates a requested resource could not be found.

// ErrStageNotFound indicates a requested stage could not be found.
var ErrStageNotFound = errors.New("rollout stage not found")

// Repository provides data access for the progressive deployment module.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository backed by the given sqlx DB.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ---------------------------------------------------------------------------
// Table initialization
// ---------------------------------------------------------------------------

// CreateTables creates the module tables if they do not already exist.
func (r *Repository) CreateTables(ctx context.Context) error {
	deploySQL := `CREATE TABLE IF NOT EXISTS progressive_deployments (
		id                        UUID PRIMARY KEY,
		tenant_id                 TEXT NOT NULL,
		name                      TEXT NOT NULL,
		service_name              TEXT NOT NULL,
		strategy                  TEXT NOT NULL DEFAULT 'canary',
		current_stage             INT NOT NULL DEFAULT 0,
		total_stages              INT NOT NULL DEFAULT 1,
		status                    TEXT NOT NULL DEFAULT 'PENDING',
		health_check_endpoint     TEXT,
		health_check_interval_seconds INT,
		rollback_threshold        FLOAT,
		rollback_reason           TEXT,
		last_health_check_at      TIMESTAMPTZ,
		rollback_at               TIMESTAMPTZ,
		created_at                TIMESTAMPTZ NOT NULL,
		updated_at                TIMESTAMPTZ NOT NULL
	)`

	stageSQL := `CREATE TABLE IF NOT EXISTS rollout_stages (
		id               UUID PRIMARY KEY,
		deployment_id    UUID NOT NULL REFERENCES progressive_deployments(id) ON DELETE CASCADE,
		stage_number     INT NOT NULL,
		traffic_percent  INT NOT NULL DEFAULT 0,
		status           TEXT NOT NULL DEFAULT 'PENDING',
		health_metrics   JSONB,
		"error"          TEXT,
		started_at       TIMESTAMPTZ,
		completed_at     TIMESTAMPTZ,
		created_at       TIMESTAMPTZ NOT NULL,
		updated_at       TIMESTAMPTZ NOT NULL
	)`

	_, err := r.db.ExecContext(ctx, deploySQL)
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx, stageSQL)
	if err != nil {
		return err
	}

	// Index for fast tenant+status lookups
	_, err = r.db.ExecContext(ctx,
		`CREATE INDEX IF NOT EXISTS idx_progressive_deployments_tenant ON progressive_deployments(tenant_id)`)
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx,
		`CREATE INDEX IF NOT EXISTS idx_rollout_stages_deployment ON rollout_stages(deployment_id, stage_number)`)
	return err
}

// ---------------------------------------------------------------------------
// Deployment CRUD
// ---------------------------------------------------------------------------

// Create inserts a new progressive deployment.
func (r *Repository) Create(ctx context.Context, tenantID string, d *models.ProgressiveDeployment) error {
	d.ID = uuid.New().String()
	d.TenantID = tenantID
	now := time.Now().UTC()
	d.CreatedAt = now
	d.UpdatedAt = now

	query := `INSERT INTO progressive_deployments (
		id, tenant_id, name, service_name, strategy, current_stage, total_stages,
		status, health_check_endpoint, health_check_interval_seconds,
		rollback_threshold, created_at, updated_at
	) VALUES (
		:id, :tenant_id, :name, :service_name, :strategy, :current_stage, :total_stages,
		:status, :health_check_endpoint, :health_check_interval_seconds,
		:rollback_threshold, :created_at, :updated_at
	)`

	_, err := r.db.NamedExecContext(ctx, query, d)
	return err
}

// GetByID retrieves a deployment by ID, filtered by tenant.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.ProgressiveDeployment, error) {
	var d models.ProgressiveDeployment
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM progressive_deployments WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return &d, nil
}

// List returns all deployments for a tenant, ordered by creation date.
func (r *Repository) List(ctx context.Context, tenantID string) ([]models.ProgressiveDeployment, int, error) {
	var items []models.ProgressiveDeployment
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM progressive_deployments WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return nil, 0, err
	}
	return items, len(items), err
}

// Update patches a deployment's fields. Map keys are DB column names.
func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}
	updates["updated_at"] = time.Now().UTC()

	setParts := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates)+2)
	argIdx := 1
	for key := range updates {
		setParts = append(setParts, fmt.Sprintf("%s=$%d", key, argIdx))
		args = append(args, updates[key])
		argIdx++
	}
	idIdx := len(args) + 1
	tenantIdx := len(args) + 2
	args = append(args, id, tenantID)

	query := "UPDATE progressive_deployments SET " + strings.Join(setParts, ", ") +
		fmt.Sprintf(" WHERE id=$%d AND tenant_id=$%d", idIdx, tenantIdx)

	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// Delete removes a deployment and its stages (cascade via FK).
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM progressive_deployments WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// UpdateStatus atomically updates a deployment's status.
func (r *Repository) UpdateStatus(ctx context.Context, tenantID, id string, status models.DeploymentStatus) error {
	result, err := r.db.ExecContext(ctx,
		`UPDATE progressive_deployments SET status=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`,
		string(status), time.Now().UTC(), id, tenantID)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// IncrementStage atomically increments current_stage by one.
func (r *Repository) IncrementStage(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE progressive_deployments SET current_stage = current_stage + 1, updated_at=$1 WHERE id=$2 AND tenant_id=$3`,
		time.Now().UTC(), id, tenantID)
	return err
}

// ---------------------------------------------------------------------------
// Stage CRUD
// ---------------------------------------------------------------------------

// CreateStage inserts a stage for a deployment.
func (r *Repository) CreateStage(ctx context.Context, tenantID, deploymentID string, s *models.RolloutStage) error {
	s.ID = uuid.New().String()
	now := time.Now().UTC()
	s.CreatedAt = now
	s.UpdatedAt = now
	s.DeploymentID = deploymentID

	// Verify the deployment belongs to this tenant
	_, err := r.GetByID(ctx, tenantID, deploymentID)
	if err != nil {
		return err
	}

	// Serialize health metrics to JSON
	var metricsJSON string
	if s.HealthMetrics != nil && len(s.HealthMetrics) > 0 {
		b, err := json.Marshal(s.HealthMetrics)
		if err != nil {
			return err
		}
		metricsJSON = string(b)
	}

	query := `INSERT INTO rollout_stages (
		id, deployment_id, stage_number, traffic_percent, status, health_metrics, error,
		started_at, completed_at, created_at, updated_at
	) VALUES (
		:id, :deployment_id, :stage_number, :traffic_percent, :status, :health_metrics, :error,
		:started_at, :completed_at, :created_at, :updated_at
	)`

	args := map[string]interface{}{
		"id":              s.ID,
		"deployment_id":   s.DeploymentID,
		"stage_number":    s.StageNumber,
		"traffic_percent": s.TrafficPercent,
		"status":          string(s.Status),
		"health_metrics":  metricsJSON,
		"error":           sql.NullString{String: s.Error, Valid: s.Error != ""},
		"started_at":      s.StartedAt,
		"completed_at":    s.CompletedAt,
		"created_at":      now,
		"updated_at":      now,
	}

	_, err = r.db.NamedExecContext(ctx, query, args)
	return err
}

// GetStages returns all stages for a deployment, ordered by stage_number.
func (r *Repository) GetStages(ctx context.Context, tenantID, deploymentID string) ([]models.RolloutStage, error) {
	var items []models.RolloutStage
	err := r.db.SelectContext(ctx, &items,
		`SELECT s.*, d.id as deployment_id FROM rollout_stages s
		 JOIN progressive_deployments d ON s.deployment_id = d.id
		 WHERE s.deployment_id=$1 AND d.tenant_id=$2
		 ORDER BY s.stage_number ASC`, deploymentID, tenantID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// GetStage returns a specific stage by number for a deployment.
func (r *Repository) GetStage(ctx context.Context, tenantID, deploymentID string, stageNumber int) (*models.RolloutStage, error) {
	var s models.RolloutStage
	err := r.db.GetContext(ctx, &s,
		`SELECT s.*, d.id as deployment_id FROM rollout_stages s
		 JOIN progressive_deployments d ON s.deployment_id = d.id
		 WHERE s.deployment_id=$1 AND s.stage_number=$2 AND d.tenant_id=$3`,
		deploymentID, stageNumber, tenantID)
	if err != nil {
		return nil, ErrStageNotFound
	}
	return &s, nil
}

// UpdateStageStatus updates a stage's status, error, metrics, and timestamps.
func (r *Repository) UpdateStageStatus(ctx context.Context, tenantID, deploymentID string, stageNumber int,
	status models.StageStatus, metrics map[string]string, errStr string) error {

	// Verify deployment belongs to tenant
	_, err := r.GetByID(ctx, tenantID, deploymentID)
	if err != nil {
		return err
	}

	var metricsJSON string
	if metrics != nil && len(metrics) > 0 {
		b, err := json.Marshal(metrics)
		if err != nil {
			return err
		}
		metricsJSON = string(b)
	}

	now := time.Now().UTC()
	_, err = r.db.ExecContext(ctx,
		`UPDATE rollout_stages SET status=$1, health_metrics=$2, error=$3, updated_at=$4,
		 completed_at=CASE WHEN $1 IN ('COMPLETED','FAILED') THEN $5 ELSE completed_at END
		 WHERE deployment_id=$6 AND stage_number=$7`,
		string(status), metricsJSON, errStr, now, now, deploymentID, stageNumber)
	return err
}

// ListStages returns all stages ordered by stage_number (alias for GetStages).
func (r *Repository) ListStages(ctx context.Context, tenantID, deploymentID string) ([]models.RolloutStage, error) {
	return r.GetStages(ctx, tenantID, deploymentID)
}
