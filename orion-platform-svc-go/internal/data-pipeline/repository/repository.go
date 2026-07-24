package repository

import (
	"context"
	"database/sql"
	"time"

	"orion/go-common/pkg/sentinel"

	"orion/platform-svc-go/internal/data-pipeline/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Pipeline CRUD ---

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.Pipeline, error) {
	var pipelines []models.Pipeline
	err := r.db.SelectContext(ctx, &pipelines,
		`SELECT * FROM data_pipelines WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return pipelines, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Pipeline, error) {
	var pipeline models.Pipeline
	err := r.db.GetContext(ctx, &pipeline,
		`SELECT * FROM data_pipelines WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &pipeline, nil
}

func (r *Repository) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Pipeline, error) {
	now := time.Now().UTC()
	pipeline := &models.Pipeline{
		ID:                   uuid.New().String(),
		TenantID:             tenantID,
		Name:                 req.Name,
		Description:          req.Description,
		SourceTable:          req.SourceTable,
		TargetTable:          req.TargetTable,
		TransformationScript: req.TransformationScript,
		Schedule:             req.Schedule,
		Status:               req.Status,
		CreatedAt:            now,
		UpdatedAt:            now,
	}
	if pipeline.Status == "" {
		pipeline.Status = "active"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO data_pipelines (id, tenant_id, name, description, source_table, target_table, transformation_script, schedule, status, created_at, updated_at)
		 VALUES (:id, :tenant_id, :name, :description, :source_table, :target_table, :transformation_script, :schedule, :status, :created_at, :updated_at)`, pipeline)
	if err != nil {
		return nil, err
	}
	return pipeline, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Pipeline, error) {
	now := time.Now().UTC()
	status := req.Status
	if status == "" {
		status = "active"
	}
	result, err := r.db.ExecContext(ctx,
		`UPDATE data_pipelines SET name=$1, description=$2, source_table=$3, target_table=$4, transformation_script=$5, schedule=$6, status=$7, updated_at=$8
		 WHERE id=$9 AND tenant_id=$10`,
		req.Name, req.Description, req.SourceTable, req.TargetTable, req.TransformationScript, req.Schedule, status, now, id, tenantID)
	if err != nil {
		return nil, err
	}
	rows, _ := result.RowsAffected()
	if err != nil {
		return nil, err
	}
	if rows == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetByID(ctx, tenantID, id)
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM data_pipelines WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return sentinel.NotFound
	}
	return nil
}

func (r *Repository) UpdateStatus(ctx context.Context, tenantID, id, status string) (*models.Pipeline, error) {
	result, err := r.db.ExecContext(ctx,
		`UPDATE data_pipelines SET status=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`,
		status, time.Now().UTC(), id, tenantID)
	if err != nil {
		return nil, err
	}
	rows, _ := result.RowsAffected()
	if err != nil {
		return nil, err
	}
	if rows == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetByID(ctx, tenantID, id)
}

// --- PipelineRun CRUD ---

func (r *Repository) CreateRun(ctx context.Context, tenantID, pipelineID string) (*models.PipelineRun, error) {
	now := time.Now().UTC()
	run := &models.PipelineRun{
		ID:         uuid.New().String(),
		PipelineID: pipelineID,
		Status:     "running",
		StartedAt:  now,
		TenantID:   tenantID,
		CreatedAt:  now,
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO data_pipeline_runs (id, tenant_id, pipeline_id, status, started_at, finished_at, error_message, metrics_json, created_at)
		 VALUES (:id, :tenant_id, :pipeline_id, :status, :started_at, NULL, '', '{}', :created_at)`, run)
	if err != nil {
		return nil, err
	}
	return run, nil
}

func (r *Repository) GetRunByID(ctx context.Context, tenantID, id string) (*models.PipelineRun, error) {
	var run models.PipelineRun
	err := r.db.GetContext(ctx, &run,
		`SELECT * FROM data_pipeline_runs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &run, nil
}

func (r *Repository) ListRuns(ctx context.Context, tenantID, pipelineID string) ([]models.PipelineRun, error) {
	var runs []models.PipelineRun
	err := r.db.SelectContext(ctx, &runs,
		`SELECT * FROM data_pipeline_runs WHERE tenant_id=$1 AND pipeline_id=$2 ORDER BY created_at DESC`,
		tenantID, pipelineID)
	return runs, err
}

func (r *Repository) UpdateRunStatus(ctx context.Context, tenantID, id, status string, errMsg string, metrics string) (*models.PipelineRun, error) {
	finishedAt := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE data_pipeline_runs SET status=$1, finished_at=$2, error_message=$3, metrics_json=$4 WHERE id=$5 AND tenant_id=$6`,
		status, finishedAt, errMsg, metrics, id, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetRunByID(ctx, tenantID, id)
}

func (r *Repository) CancelRun(ctx context.Context, tenantID, id string) (*models.PipelineRun, error) {
	// Only cancel runs that are still running or pending
	result, err := r.db.ExecContext(ctx,
		`UPDATE data_pipeline_runs SET status='cancelled', finished_at=$1, error_message=$2
		 WHERE id=$3 AND tenant_id=$4 AND status IN ('running','pending')`,
		time.Now().UTC(), "cancelled by user", id, tenantID)
	if err != nil {
		return nil, err
	}
	rows, _ := result.RowsAffected()
	if err != nil {
		return nil, err
	}
	if rows == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetRunByID(ctx, tenantID, id)
}
