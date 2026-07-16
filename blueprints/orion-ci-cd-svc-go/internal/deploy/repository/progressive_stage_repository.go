package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"orion/ci-cd-svc-go/internal/deploy/models"
	"orion/go-common/pkg/database"
)

// ProgressiveStageRepository handles PostgreSQL operations for progressive deploy stages.
type ProgressiveStageRepository struct {
	db *database.DB
}

func NewProgressiveStageRepository(db *database.DB) *ProgressiveStageRepository {
	return &ProgressiveStageRepository{db: db}
}

// GetByID retrieves a progressive stage by ID.
func (r *ProgressiveStageRepository) GetByID(ctx context.Context, id string) (*models.ProgressiveStage, error) {
	var s models.ProgressiveStage
	query := `SELECT id, tenant_id, deployment_id, stage_name, stage_order, traffic_percent, instance_count, status, started_at, completed_at, validation_result, auto_promote, created_at, updated_at
FROM deploy_progressive_stages WHERE id = $1`
	err := r.db.GetContext(ctx, &s, query, id)
	if err != nil {
		return nil, fmt.Errorf("progressive stage not found: %w", err)
	}
	return &s, nil
}

// FindByDeployment returns all stages for a deployment, ordered by stage_order.
func (r *ProgressiveStageRepository) FindByDeployment(ctx context.Context, deploymentID string) ([]models.ProgressiveStage, error) {
	var stages []models.ProgressiveStage
	query := `SELECT id, tenant_id, deployment_id, stage_name, stage_order, traffic_percent, instance_count, status, started_at, completed_at, validation_result, auto_promote, created_at, updated_at
FROM deploy_progressive_stages WHERE deployment_id = $1 ORDER BY stage_order ASC`
	err := r.db.SelectContext(ctx, &stages, query, deploymentID)
	if err != nil {
		return nil, err
	}
	return stages, nil
}

// FindCurrentStage returns the currently running stage for a deployment.
func (r *ProgressiveStageRepository) FindCurrentStage(ctx context.Context, deploymentID string) (*models.ProgressiveStage, error) {
	var s models.ProgressiveStage
	query := `SELECT id, tenant_id, deployment_id, stage_name, stage_order, traffic_percent, instance_count, status, started_at, completed_at, validation_result, auto_promote, created_at, updated_at
FROM deploy_progressive_stages WHERE deployment_id = $1 AND status = 'running'
ORDER BY stage_order ASC LIMIT 1`
	err := r.db.GetContext(ctx, &s, query, deploymentID)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// FindNextPendingStage returns the next pending stage for a deployment.
func (r *ProgressiveStageRepository) FindNextPendingStage(ctx context.Context, deploymentID string) (*models.ProgressiveStage, error) {
	var s models.ProgressiveStage
	query := `SELECT id, tenant_id, deployment_id, stage_name, stage_order, traffic_percent, instance_count, status, started_at, completed_at, validation_result, auto_promote, created_at, updated_at
FROM deploy_progressive_stages WHERE deployment_id = $1 AND status = 'pending'
ORDER BY stage_order ASC LIMIT 1`
	err := r.db.GetContext(ctx, &s, query, deploymentID)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// FindPreviousCompletedStage returns the most recent completed stage before a given order.
func (r *ProgressiveStageRepository) FindPreviousCompletedStage(ctx context.Context, deploymentID string, currentOrder int) (*models.ProgressiveStage, error) {
	var s models.ProgressiveStage
	query := `SELECT id, tenant_id, deployment_id, stage_name, stage_order, traffic_percent, instance_count, status, started_at, completed_at, validation_result, auto_promote, created_at, updated_at
FROM deploy_progressive_stages WHERE deployment_id = $1 AND stage_order < $2 AND status = 'completed'
ORDER BY stage_order DESC LIMIT 1`
	err := r.db.GetContext(ctx, &s, query, deploymentID, currentOrder)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// Create inserts a single progressive stage.
func (r *ProgressiveStageRepository) Create(ctx context.Context, s *models.ProgressiveStage) error {
	instanceCount := s.InstanceCount
	if instanceCount == 0 {
		instanceCount = 1
	}
	autoPromote := s.AutoPromote
	if !autoPromote {
		autoPromote = true // Default true if not explicitly false
	}
	query := `INSERT INTO deploy_progressive_stages (tenant_id, deployment_id, stage_name, stage_order, traffic_percent, instance_count, status, auto_promote)
VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
RETURNING id, created_at`
	err := r.db.QueryRowContext(ctx, query,
		s.TenantID, s.DeploymentID, s.StageName, s.StageOrder, s.TrafficPercent, instanceCount, autoPromote,
	).Scan(&s.ID, &s.CreatedAt)
	if err != nil {
		return err
	}
	s.Status = "pending"
	s.InstanceCount = instanceCount
	return nil
}

// Update updates stage fields.
func (r *ProgressiveStageRepository) Update(ctx context.Context, id string, status string, validationResult map[string]interface{}, startedAt sql.NullTime, completedAt sql.NullTime) error {
	sets := []string{}
	args := []interface{}{}
	argIdx := 1

	if status != "" {
		sets = append(sets, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}
	if validationResult != nil {
		data, _ := json.Marshal(validationResult)
		sets = append(sets, fmt.Sprintf("validation_result = $%d", argIdx))
		args = append(args, string(data))
		argIdx++
	}
	if startedAt.Valid {
		sets = append(sets, fmt.Sprintf("started_at = $%d", argIdx))
		sets = append(sets, fmt.Sprintf("started_at = $%d", argIdx))
		sets = sets[:len(sets)-2] // remove duplicate
		sets = append(sets, fmt.Sprintf("started_at = $%d", argIdx))
		args = append(args, startedAt.Time)
		argIdx++
	}
	if completedAt.Valid {
		sets = append(sets, fmt.Sprintf("completed_at = $%d", argIdx))
		args = append(args, completedAt.Time)
		argIdx++
	}

	sets = append(sets, fmt.Sprintf("updated_at = NOW()"))
	args = append(args, id)

	query := fmt.Sprintf(`UPDATE deploy_progressive_stages SET %s WHERE id = $%d`,
		joinStringsWithComma(sets), len(args))
	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

// CountByDeployment returns stage counts by status for a deployment.
func (r *ProgressiveStageRepository) CountByDeployment(ctx context.Context, deploymentID string) (*models.StageCount, error) {
	var sc models.StageCount
	query := `SELECT
		COUNT(*) as total,
		SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
		SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
		SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
		SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
		SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped
	FROM deploy_progressive_stages WHERE deployment_id = $1`
	err := r.db.GetContext(ctx, &sc, query, deploymentID)
	return &sc, err
}

// helper to join strings with comma (avoids importing "strings" just for this)
func joinStringsWithComma(parts []string) string {
	result := ""
	for i, p := range parts {
		if i > 0 {
			_ = p // ensure p is used for syntax
		}
		result += p
		if i < len(parts)-1 {
			result += ", "
		}
	}
	return result
}
