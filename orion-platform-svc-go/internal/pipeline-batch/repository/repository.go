package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/pipeline-batch/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/sentinel"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Phase Groups ---

func (r *Repository) CreatePhaseGroup(ctx context.Context, group *models.PhaseGroup) error {
	group.ID = uuid.New().String()
	now := time.Now().UTC()
	group.CreatedAt = now
	group.UpdatedAt = now
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO pipeline_phase_groups (id, tenant_id, pipeline_id, name, batch_strategy, batch_config, gate_type, status, created_by, created_at, updated_at)
		 VALUES (:id, :tenantId, :pipelineId, :name, :batchStrategy, :batchConfig, :gateType, :status, :createdBy, :createdAt, :updatedAt)`,
		group)
	return err
}

func (r *Repository) GetPhaseGroupByID(ctx context.Context, id string, tenantID string) (*models.PhaseGroup, error) {
	var group models.PhaseGroup
	err := r.db.GetContext(ctx, &group,
		`SELECT * FROM pipeline_phase_groups WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &group, nil
}

func (r *Repository) ListPhaseGroups(ctx context.Context, tenantID string, pipelineID *string, status *string, limit *int, offset *int) ([]models.PhaseGroup, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2
	if pipelineID != nil && *pipelineID != "" {
		where += fmt.Sprintf(" AND pipeline_id = $%d", argIdx)
		args = append(args, *pipelineID)
		argIdx++
	}
	if status != nil && *status != "" {
		where += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, *status)
		argIdx++
	}
	var groups []models.PhaseGroup
	query := fmt.Sprintf(`SELECT * FROM pipeline_phase_groups %s ORDER BY created_at DESC`, where)
	if limit != nil {
		query += fmt.Sprintf(" LIMIT $%d", argIdx)
		args = append(args, *limit)
		argIdx++
		if offset != nil {
			query += fmt.Sprintf(" OFFSET $%d", argIdx)
			args = append(args, *offset)
		}
	}
	err := r.db.SelectContext(ctx, &groups, query, args...)
	return groups, err
}

func (r *Repository) UpdatePhaseGroup(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.PhaseGroup, error) {
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
	query := fmt.Sprintf(`UPDATE pipeline_phase_groups SET %s WHERE id=$%d AND tenant_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetPhaseGroupByID(ctx, id, tenantID)
}

func (r *Repository) DeletePhaseGroup(ctx context.Context, id string, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM pipeline_phase_groups WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// --- Batch Runs ---

func (r *Repository) CreateBatchRun(ctx context.Context, run *models.BatchRun) error {
	run.ID = uuid.New().String()
	now := time.Now().UTC()
	run.StartedAt = &now
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO pipeline_batch_runs (id, tenant_id, phase_group_id, batch_index, status, result, started_at, completed_at)
		 VALUES (:id, :tenantId, :phaseGroupId, :batchIndex, :status, :result, :startedAt, :completedAt)`,
		run)
	return err
}

func (r *Repository) GetBatchRunByID(ctx context.Context, batchID string, tenantID string) (*models.BatchRun, error) {
	var run models.BatchRun
	err := r.db.GetContext(ctx, &run,
		`SELECT * FROM pipeline_batch_runs WHERE id=$1 AND tenant_id=$2`, batchID, tenantID)
	if err != nil {
		return nil, err
	}
	return &run, nil
}

func (r *Repository) ListBatchRuns(ctx context.Context, phaseGroupID string, tenantID string) ([]models.BatchRun, error) {
	var runs []models.BatchRun
	err := r.db.SelectContext(ctx, &runs,
		`SELECT * FROM pipeline_batch_runs WHERE phase_group_id=$1 AND tenant_id=$2 ORDER BY batch_index ASC`,
		phaseGroupID, tenantID)
	return runs, err
}

func (r *Repository) UpdateBatchRun(ctx context.Context, batchID string, tenantID string, status string, result string) (*models.BatchRun, error) {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE pipeline_batch_runs SET status=$1, result=$2, completed_at=$3 WHERE id=$4 AND tenant_id=$5`,
		status, result, now, batchID, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetBatchRunByID(ctx, batchID, tenantID)
}
