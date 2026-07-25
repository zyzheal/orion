// Package repository provides the data access layer for the Pipeline Executor.
package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/pipeline-executor/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository manages persistence for Pipeline, PipelineStep, and
// PipelineExecution records with strict tenant isolation.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository backed by the given sqlx.DB.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ---------------------------------------------------------------------------
// AutoMigrate — create tables + indexes if they do not exist
// ---------------------------------------------------------------------------

func (r *Repository) AutoMigrate(ctx context.Context) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS pipelines (
			id          VARCHAR(64) PRIMARY KEY,
			tenant_id   VARCHAR(64) NOT NULL,
			name        VARCHAR(255) NOT NULL,
			description TEXT         DEFAULT '',
			category    VARCHAR(32)  NOT NULL,
			status      VARCHAR(16)  NOT NULL DEFAULT 'active',
			created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
			updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS pipeline_steps (
			id          VARCHAR(64) PRIMARY KEY,
			tenant_id   VARCHAR(64) NOT NULL,
			pipeline_id VARCHAR(64) NOT NULL REFERENCES pipelines(id),
			name        VARCHAR(255) NOT NULL,
			type        VARCHAR(32)  NOT NULL,
			config      TEXT         DEFAULT '{}',
			priority    INT          NOT NULL DEFAULT 0,
			enabled     BOOLEAN      NOT NULL DEFAULT TRUE,
			status      VARCHAR(16)  NOT NULL DEFAULT 'ready',
			error       TEXT         DEFAULT '',
			created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
			updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS pipeline_executions (
			id            VARCHAR(64)  PRIMARY KEY,
			tenant_id     VARCHAR(64)  NOT NULL,
			pipeline_id   VARCHAR(64)  NOT NULL REFERENCES pipelines(id),
			input         TEXT         DEFAULT '',
			output        TEXT         DEFAULT '',
			status        VARCHAR(16)  NOT NULL DEFAULT 'running',
			steps_run     INT          NOT NULL DEFAULT 0,
			steps_failed  INT          NOT NULL DEFAULT 0,
			error         TEXT         DEFAULT '',
			started_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
			finished_at   TIMESTAMPTZ,
			duration_ms   BIGINT       NOT NULL DEFAULT 0,
			created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)`,
	}
	for _, s := range stmts {
		if _, err := r.db.ExecContext(ctx, s); err != nil {
			return fmt.Errorf("pipeline-executor AutoMigrate failed: %w", err)
		}
	}
	for _, s := range []string{
		`CREATE INDEX IF NOT EXISTS idx_pipelines_tenant ON pipelines(tenant_id)`,
		`CREATE INDEX IF NOT EXISTS idx_pipelines_tenant_status ON pipelines(tenant_id, status)`,
		`CREATE INDEX IF NOT EXISTS idx_pipeline_steps_tenant ON pipeline_steps(tenant_id)`,
		`CREATE INDEX IF NOT EXISTS idx_pipeline_steps_pipeline ON pipeline_steps(pipeline_id)`,
		`CREATE INDEX IF NOT EXISTS idx_pipeline_steps_order ON pipeline_steps(pipeline_id, priority)`,
		`CREATE INDEX IF NOT EXISTS idx_pipeline_executions_tenant ON pipeline_executions(tenant_id)`,
		`CREATE INDEX IF NOT EXISTS idx_pipeline_executions_pipeline ON pipeline_executions(pipeline_id)`,
		`CREATE INDEX IF NOT EXISTS idx_pipeline_executions_status ON pipeline_executions(tenant_id, status)`,
	} {
		if _, err := r.db.ExecContext(ctx, s); err != nil {
			return fmt.Errorf("pipeline-executor index migration failed: %w", err)
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// Pipeline CRUD
// ---------------------------------------------------------------------------

func (r *Repository) CreatePipeline(ctx context.Context, tenantID string, req *models.CreatePipelineRequest) (*models.Pipeline, error) {
	if req.Category == "" {
		req.Category = models.CategoryAutomation
	}
	now := time.Now().UTC()
	p := &models.Pipeline{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Category:    req.Category,
		Status:      models.PipelineStatusActive,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	q := `INSERT INTO pipelines (id, tenant_id, name, description, category, status, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :description, :category, :status, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, q, p)
	if err != nil {
		return nil, err
	}
	return p, nil
}

func (r *Repository) GetPipeline(ctx context.Context, tenantID, id string) (*models.Pipeline, error) {
	var p models.Pipeline
	err := r.db.GetContext(ctx, &p, `SELECT * FROM pipelines WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("pipeline not found: %s", id)
		}
		return nil, err
	}
	return &p, nil
}

func (r *Repository) ListPipelines(ctx context.Context, tenantID, status string, limit, offset int) (*models.PipelineListResponse, error) {
	limit = clamp(limit, 1, 100)
	resp := &models.PipelineListResponse{}
	countQ, listQ, countArgs, listArgs := pipelineQueries(status, tenantID, limit, offset)
	if err := r.db.GetContext(ctx, &resp.Total, countQ, countArgs...); err != nil {
		return nil, err
	}
	if err := r.db.SelectContext(ctx, &resp.Data, listQ, listArgs...); err != nil {
		return nil, err
	}
	return resp, nil
}

func (r *Repository) UpdatePipeline(ctx context.Context, tenantID, id string, fields map[string]interface{}) (*models.Pipeline, error) {
	if len(fields) == 0 {
		return r.GetPipeline(ctx, tenantID, id)
	}
	fields["updated_at"] = time.Now().UTC()
	delete(fields, "id")
	delete(fields, "tenant_id")
	set := buildNamedSet(fields)
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE pipelines SET `+set+` WHERE id=:id AND tenant_id=:tenant_id`,
		map[string]interface{}{
			"id":        id,
			"tenant_id": tenantID,
		},
	)
	if err != nil {
		return nil, err
	}
	return r.GetPipeline(ctx, tenantID, id)
}

func (r *Repository) DeletePipeline(ctx context.Context, tenantID, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM pipelines WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("pipeline not found: %s", id)
	}
	return nil
}

// ---------------------------------------------------------------------------
// PipelineStep CRUD
// ---------------------------------------------------------------------------

func (r *Repository) CreateStep(ctx context.Context, tenantID, pipelineID string, req *models.AddStepRequest) (*models.PipelineStep, error) {
	if !r.pipelineExists(ctx, tenantID, pipelineID) {
		return nil, fmt.Errorf("pipeline not found: %s", pipelineID)
	}
	configJSON, err := json.Marshal(req.Config)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	step := &models.PipelineStep{
		ID:         uuid.New().String(),
		TenantID:   tenantID,
		PipelineID: pipelineID,
		Name:       req.Name,
		Type:       req.Type,
		Config:     string(configJSON),
		Priority:   clamp(req.Priority, 0, 999),
		Enabled:    true,
		Status:     models.StepStatusReady,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	q := `INSERT INTO pipeline_steps (id, tenant_id, pipeline_id, name, type, config, priority, enabled, status, created_at, updated_at)
		VALUES (:id, :tenant_id, :pipeline_id, :name, :type, :config, :priority, :enabled, :status, :created_at, :updated_at)`
	_, err = r.db.NamedExecContext(ctx, q, step)
	if err != nil {
		return nil, err
	}
	return step, nil
}

func (r *Repository) GetStep(ctx context.Context, tenantID, stepID string) (*models.PipelineStep, error) {
	var s models.PipelineStep
	err := r.db.GetContext(ctx, &s, `SELECT * FROM pipeline_steps WHERE id=$1 AND tenant_id=$2`, stepID, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("step not found: %s", stepID)
		}
		return nil, err
	}
	return &s, nil
}

func (r *Repository) ListSteps(ctx context.Context, tenantID, pipelineID string, limit, offset int) (*models.StepListResponse, error) {
	// Verify pipeline ownership
	if !r.pipelineExists(ctx, tenantID, pipelineID) {
		return nil, fmt.Errorf("pipeline not found: %s", pipelineID)
	}
	limit = clamp(limit, 1, 100)
	resp := &models.StepListResponse{}
	countQ := `SELECT COUNT(*) FROM pipeline_steps WHERE tenant_id=$1 AND pipeline_id=$2`
	listQ := `SELECT * FROM pipeline_steps WHERE tenant_id=$1 AND pipeline_id=$2 ORDER BY priority, created_at ASC LIMIT $3 OFFSET $4`
	if err := r.db.GetContext(ctx, &resp.Total, countQ, tenantID, pipelineID); err != nil {
		return nil, err
	}
	if err := r.db.SelectContext(ctx, &resp.Data, listQ, tenantID, pipelineID, limit, offset); err != nil {
		return nil, err
	}
	return resp, nil
}

func (r *Repository) UpdateStep(ctx context.Context, tenantID, stepID string, fields map[string]interface{}) (*models.PipelineStep, error) {
	if len(fields) == 0 {
		return r.GetStep(ctx, tenantID, stepID)
	}
	// If config is being updated, re-serialise it
	if cfg, ok := fields["config"]; ok {
		if cfgMap, ok2 := cfg.(map[string]string); ok2 {
			b, err := json.Marshal(cfgMap)
			if err != nil {
				return nil, err
			}
			fields["config"] = string(b)
		}
	}
	fields["updated_at"] = time.Now().UTC()
	delete(fields, "id")
	// PipelineID is part of ownership, keep it out of updatable fields
	delete(fields, "pipeline_id")
	set := buildNamedSet(fields)
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE pipeline_steps SET `+set+` WHERE id=:id AND tenant_id=:tenant_id`,
		map[string]interface{}{
			"id":        stepID,
			"tenant_id": tenantID,
		},
	)
	if err != nil {
		return nil, err
	}
	return r.GetStep(ctx, tenantID, stepID)
}

func (r *Repository) DeleteStep(ctx context.Context, tenantID, stepID string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM pipeline_steps WHERE id=$1 AND tenant_id=$2`, stepID, tenantID)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("step not found: %s", stepID)
	}
	return nil
}

// StepsForPipeline returns all enabled steps ordered by priority for execution.
func (r *Repository) StepsForPipeline(ctx context.Context, tenantID, pipelineID string) ([]models.PipelineStep, error) {
	var steps []models.PipelineStep
	err := r.db.SelectContext(ctx, &steps,
		`SELECT * FROM pipeline_steps WHERE pipeline_id=$1 AND tenant_id=$2 AND enabled=$3 ORDER BY priority, created_at ASC`,
		pipelineID, tenantID, true)
	return steps, err
}

// ---------------------------------------------------------------------------
// PipelineExecution CRUD
// ---------------------------------------------------------------------------

func (r *Repository) CreateExecution(ctx context.Context, exec *models.PipelineExecution) error {
	if exec.ID == "" {
		exec.ID = uuid.New().String()
	}
	if exec.StartedAt.IsZero() {
		exec.StartedAt = time.Now().UTC()
	}
	exec.CreatedAt = exec.StartedAt
	q := `INSERT INTO pipeline_executions (id, tenant_id, pipeline_id, input, output, status, steps_run, steps_failed, error, started_at, finished_at, duration_ms, created_at)
		VALUES (:id, :tenant_id, :pipeline_id, :input, :output, :status, :steps_run, :steps_failed, :error, :started_at, :finished_at, :duration_ms, :created_at)`
	_, err := r.db.NamedExecContext(ctx, q, exec)
	return err
}

func (r *Repository) GetExecution(ctx context.Context, tenantID, id string) (*models.PipelineExecution, error) {
	var e models.PipelineExecution
	err := r.db.GetContext(ctx, &e, `SELECT * FROM pipeline_executions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("execution not found: %s", id)
		}
		return nil, err
	}
	return &e, nil
}

func (r *Repository) ListExecutions(ctx context.Context, tenantID, pipelineID string, limit, offset int) (*models.ExecutionListResponse, error) {
	limit = clamp(limit, 1, 100)
	resp := &models.ExecutionListResponse{}
	countQ := `SELECT COUNT(*) FROM pipeline_executions WHERE tenant_id=$1 AND pipeline_id=$2`
	listQ := `SELECT * FROM pipeline_executions WHERE tenant_id=$1 AND pipeline_id=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`
	if err := r.db.GetContext(ctx, &resp.Total, countQ, tenantID, pipelineID); err != nil {
		return nil, err
	}
	if err := r.db.SelectContext(ctx, &resp.Data, listQ, tenantID, pipelineID, limit, offset); err != nil {
		return nil, err
	}
	return resp, nil
}

func (r *Repository) FinishExecution(ctx context.Context, id string, status string, output, errStr string, durationMs int64, finishedAt *time.Time) error {
	q := `UPDATE pipeline_executions SET status=$1, output=$2, error=$3, duration_ms=$4, finished_at=$5 WHERE id=$6`
	_, err := r.db.ExecContext(ctx, q, status, output, errStr, durationMs, finishedAt, id)
	return err
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func pipelineQueries(status, tenantID string, limit, offset int) (countQ, listQ string, countArgs, listArgs []interface{}) {
	if status != "" {
		countQ = `SELECT COUNT(*) FROM pipelines WHERE tenant_id=$1 AND status=$2`
		listQ = `SELECT * FROM pipelines WHERE tenant_id=$1 AND status=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`
		countArgs = []interface{}{tenantID, status}
		listArgs = []interface{}{tenantID, status, limit, offset}
		return
	}
	countQ = `SELECT COUNT(*) FROM pipelines WHERE tenant_id=$1`
	listQ = `SELECT * FROM pipelines WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	countArgs = []interface{}{tenantID}
	listArgs = []interface{}{tenantID, limit, offset}
	return
}

func (r *Repository) pipelineExists(ctx context.Context, tenantID, pipelineID string) bool {
	var exists bool
	_ = r.db.GetContext(ctx, &exists, `SELECT EXISTS(SELECT 1 FROM pipelines WHERE id=$1 AND tenant_id=$2)`, pipelineID, tenantID)
	return exists
}

func buildNamedSet(fields map[string]interface{}) string {
	var parts []string
	for k := range fields {
		parts = append(parts, fmt.Sprintf("%s=:%s", k, k))
	}
	return joinStrings(parts, ", ")
}

func joinStrings(parts []string, sep string) string {
	return strings.Join(parts, sep)
}

func clamp(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}
