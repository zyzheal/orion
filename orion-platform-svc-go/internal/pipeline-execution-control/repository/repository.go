package repository

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/pipeline-execution-control/models"

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

// --- Execution Control Logs ---

func (r *Repository) CreateLog(ctx context.Context, log *models.ExecutionControlLog) error {
	log.ID = uuid.New().String()
	log.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO pipeline_execution_control_logs
		 (id, tenant_id, run_id, action, reason, operator, metadata, created_at)
		 VALUES (:id, :tenantId, :runId, :action, :reason, :operator, :metadata, :createdAt)`,
		log)
	return err
}

func (r *Repository) ListLogsByRunID(ctx context.Context, runID string, tenantID string) ([]models.ExecutionControlLog, error) {
	var logs []models.ExecutionControlLog
	err := r.db.SelectContext(ctx, &logs,
		`SELECT * FROM pipeline_execution_control_logs
		 WHERE run_id=$1 AND tenant_id=$2
		 ORDER BY created_at DESC`, runID, tenantID)
	return logs, err
}

// --- Checkpoints ---

func (r *Repository) CreateCheckpoint(ctx context.Context, cp *models.Checkpoint) error {
	cp.ID = uuid.New().String()
	cp.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO pipeline_checkpoints
		 (id, tenant_id, run_id, stage_id, stage_name, data, created_at)
		 VALUES (:id, :tenantId, :runId, :stageId, :stageName, :data, :createdAt)`,
		cp)
	return err
}

func (r *Repository) ListCheckpoints(ctx context.Context, runID string, tenantID string) ([]models.Checkpoint, error) {
	var cps []models.Checkpoint
	err := r.db.SelectContext(ctx, &cps,
		`SELECT * FROM pipeline_checkpoints
		 WHERE run_id=$1 AND tenant_id=$2
		 ORDER BY created_at DESC`, runID, tenantID)
	return cps, err
}

func (r *Repository) DeleteCheckpoint(ctx context.Context, id string, tenantID string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM pipeline_checkpoints WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sentinel.NotFound
	}
	return nil
}

// --- Pipeline Runs ---

func (r *Repository) GetRunByID(ctx context.Context, id string, tenantID string) (*models.Run, error) {
	var run models.Run
	err := r.db.GetContext(ctx, &run,
		`SELECT id, tenant_id, status, started_at, completed_at, created_at, updated_at
		 FROM pipeline_runs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &run, nil
}

func (r *Repository) UpdateRunStatus(ctx context.Context, id string, tenantID, oldStatus, newStatus string) error {
	now := time.Now().UTC()
	result, err := r.db.ExecContext(ctx,
		`UPDATE pipeline_runs SET status=$1, updated_at=$2
		 WHERE id=$3 AND tenant_id=$4 AND status=$5`,
		newStatus, now, id, tenantID, oldStatus)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sentinel.NotFound
	}
	return nil
}
