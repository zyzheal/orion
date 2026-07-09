package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"orion/pipeline-svc-go/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// BatchService manages phase groups and batch run execution.
type BatchService struct {
	db *sqlx.DB
}

func NewBatchService(db *sqlx.DB) *BatchService {
	return &BatchService{db: db}
}

// ==================== Phase Group CRUD ====================

// CreatePhaseGroup creates a new phase group.
func (s *BatchService) CreatePhaseGroup(ctx context.Context, tenantID string, req models.CreatePhaseGroupRequest, createdBy string) (*models.PhaseGroup, error) {
	ctx, span := tracer.Start(ctx, "BatchService.CreatePhaseGroup",
		trace.WithAttributes(attribute.String("name", req.Name)))
	defer span.End()

	pipelineIDs, err := json.Marshal(req.PipelineIDs)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("marshal pipeline_ids: %w", err)
	}

	pg := &models.PhaseGroup{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		PipelineIDs: string(pipelineIDs),
		Status:      "active",
		CreatedBy:   createdBy,
	}

	query := `INSERT INTO phase_groups (id, tenant_id, name, description, pipeline_ids, config, status, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING created_at, updated_at`
	err = s.db.QueryRowContext(ctx, query,
		pg.ID, pg.TenantID, pg.Name, pg.Description, pg.PipelineIDs, pg.Config, pg.Status, pg.CreatedBy,
	).Scan(&pg.CreatedAt, &pg.UpdatedAt)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, fmt.Errorf("create phase group: %w", err)
	}

	span.SetAttributes(attribute.String("phase_group.id", pg.ID))
	return pg, nil
}

// GetPhaseGroup returns a phase group by ID.
func (s *BatchService) GetPhaseGroup(ctx context.Context, tenantID, id string) (*models.PhaseGroup, error) {
	ctx, span := tracer.Start(ctx, "BatchService.GetPhaseGroup",
		trace.WithAttributes(attribute.String("phase_group.id", id)))
	defer span.End()

	var pg models.PhaseGroup
	err := s.db.GetContext(ctx, &pg,
		`SELECT id, tenant_id, name, description, pipeline_ids, config, status, created_by, created_at, updated_at
		 FROM phase_groups WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("phase group not found: %w", err)
	}
	return &pg, nil
}

// ListPhaseGroups returns phase groups for a tenant.
func (s *BatchService) ListPhaseGroups(ctx context.Context, tenantID string, offset, limit int) ([]models.PhaseGroup, error) {
	ctx, span := tracer.Start(ctx, "BatchService.ListPhaseGroups",
		trace.WithAttributes(attribute.String("tenant.id", tenantID)))
	defer span.End()

	var groups []models.PhaseGroup
	err := s.db.SelectContext(ctx, &groups,
		`SELECT id, tenant_id, name, description, pipeline_ids, config, status, created_by, created_at, updated_at
		 FROM phase_groups WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	return groups, err
}

// UpdatePhaseGroup updates a phase group.
func (s *BatchService) UpdatePhaseGroup(ctx context.Context, tenantID, id string, req models.UpdatePhaseGroupRequest) (*models.PhaseGroup, error) {
	ctx, span := tracer.Start(ctx, "BatchService.UpdatePhaseGroup",
		trace.WithAttributes(attribute.String("phase_group.id", id)))
	defer span.End()

	// Fetch existing
	pg, err := s.GetPhaseGroup(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}

	if req.Name != nil {
		pg.Name = *req.Name
	}
	if req.Description != nil {
		pg.Description = *req.Description
	}
	if req.PipelineIDs != nil {
		b, _ := json.Marshal(req.PipelineIDs)
		pg.PipelineIDs = string(b)
	}
	if req.Config != nil {
		pg.Config = *req.Config
	}

	_, err = s.db.ExecContext(ctx,
		`UPDATE phase_groups SET name = $1, description = $2, pipeline_ids = $3, config = $4, updated_at = NOW()
		 WHERE id = $5 AND tenant_id = $6`,
		pg.Name, pg.Description, pg.PipelineIDs, pg.Config, id, tenantID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, fmt.Errorf("update phase group: %w", err)
	}
	return s.GetPhaseGroup(ctx, tenantID, id)
}

// DeletePhaseGroup deletes a phase group.
func (s *BatchService) DeletePhaseGroup(ctx context.Context, tenantID, id string) error {
	ctx, span := tracer.Start(ctx, "BatchService.DeletePhaseGroup",
		trace.WithAttributes(attribute.String("phase_group.id", id)))
	defer span.End()

	result, err := s.db.ExecContext(ctx,
		`DELETE FROM phase_groups WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		span.RecordError(err)
		return fmt.Errorf("delete phase group: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("phase group not found")
	}
	return nil
}

// ==================== Phase Group Execution ====================

// StartPhaseGroup starts a phase group execution.
func (s *BatchService) StartPhaseGroup(ctx context.Context, tenantID, groupID string) (*models.PhaseGroupRun, error) {
	ctx, span := tracer.Start(ctx, "BatchService.StartPhaseGroup",
		trace.WithAttributes(attribute.String("phase_group.id", groupID)))
	defer span.End()

	pg, err := s.GetPhaseGroup(ctx, tenantID, groupID)
	if err != nil {
		return nil, err
	}

	run := &models.PhaseGroupRun{
		ID:           uuid.New().String(),
		PhaseGroupID: groupID,
		TenantID:     tenantID,
		PipelineIDs:  pg.PipelineIDs,
		Status:       "running",
		StartedAt:    timePtr(time.Now()),
	}

	query := `INSERT INTO phase_group_runs (id, phase_group_id, tenant_id, pipeline_ids, status, started_at)
		VALUES ($1, $2, $3, $4, $5, $6)`
	_, err = s.db.ExecContext(ctx, query,
		run.ID, run.PhaseGroupID, run.TenantID, run.PipelineIDs, run.Status, run.StartedAt)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, fmt.Errorf("start phase group run: %w", err)
	}

	span.SetAttributes(attribute.String("run.id", run.ID))
	return run, nil
}

// StopPhaseGroup stops a running phase group execution.
func (s *BatchService) StopPhaseGroup(ctx context.Context, tenantID, groupID string) (*models.PhaseGroupRun, error) {
	ctx, span := tracer.Start(ctx, "BatchService.StopPhaseGroup",
		trace.WithAttributes(attribute.String("phase_group.id", groupID)))
	defer span.End()

	// Find the latest running run for this phase group
	var run models.PhaseGroupRun
	err := s.db.GetContext(ctx, &run,
		`SELECT * FROM phase_group_runs WHERE phase_group_id = $1 AND status = 'running' ORDER BY created_at DESC LIMIT 1`,
		groupID)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("no running phase group run found: %w", err)
	}

	now := time.Now()
	durationMs := now.Sub(*run.StartedAt).Milliseconds()

	_, err = s.db.ExecContext(ctx,
		`UPDATE phase_group_runs SET status = 'cancelled', completed_at = $1, duration_ms = $2 WHERE id = $3`,
		now, durationMs, run.ID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, fmt.Errorf("stop phase group run: %w", err)
	}

	run.Status = "cancelled"
	run.CompletedAt = &now
	run.DurationMs = durationMs
	return &run, nil
}

// GetPhaseGroupStatus returns the latest run status for a phase group.
func (s *BatchService) GetPhaseGroupStatus(ctx context.Context, tenantID, groupID string) (*models.PhaseGroupRun, error) {
	ctx, span := tracer.Start(ctx, "BatchService.GetPhaseGroupStatus",
		trace.WithAttributes(attribute.String("phase_group.id", groupID)))
	defer span.End()

	var run models.PhaseGroupRun
	err := s.db.GetContext(ctx, &run,
		`SELECT * FROM phase_group_runs WHERE phase_group_id = $1 ORDER BY created_at DESC LIMIT 1`,
		groupID)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("phase group run not found: %w", err)
	}
	return &run, nil
}

// ListPhaseGroupRuns lists execution records for a phase group.
func (s *BatchService) ListPhaseGroupRuns(ctx context.Context, tenantID, groupID string, offset, limit int) ([]models.PhaseGroupRun, error) {
	ctx, span := tracer.Start(ctx, "BatchService.ListPhaseGroupRuns",
		trace.WithAttributes(attribute.String("phase_group.id", groupID)))
	defer span.End()

	var runs []models.PhaseGroupRun
	err := s.db.SelectContext(ctx, &runs,
		`SELECT * FROM phase_group_runs WHERE phase_group_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		groupID, limit, offset)
	return runs, err
}

// ==================== Batch Run ====================

// CreateBatchRun creates a new batch run.
func (s *BatchService) CreateBatchRun(ctx context.Context, tenantID string, req models.CreateBatchRunRequest) (*models.BatchRun, error) {
	ctx, span := tracer.Start(ctx, "BatchService.CreateBatchRun",
		trace.WithAttributes(attribute.Int("count", len(req.PipelineIDs))))
	defer span.End()

	pipelineIDs, err := json.Marshal(req.PipelineIDs)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("marshal pipeline_ids: %w", err)
	}

	run := &models.BatchRun{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		PipelineIDs: string(pipelineIDs),
		Count:       len(req.PipelineIDs),
		Status:      "pending",
	}

	query := `INSERT INTO batch_runs (id, tenant_id, pipeline_ids, count, status)
		VALUES ($1, $2, $3, $4, $5)`
	_, err = s.db.ExecContext(ctx, query,
		run.ID, run.TenantID, run.PipelineIDs, run.Count, run.Status)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, fmt.Errorf("create batch run: %w", err)
	}

	span.SetAttributes(attribute.String("batch_run.id", run.ID))
	return run, nil
}

// ListBatchRuns lists batch runs for a tenant.
func (s *BatchService) ListBatchRuns(ctx context.Context, tenantID string, offset, limit int) ([]models.BatchRun, error) {
	ctx, span := tracer.Start(ctx, "BatchService.ListBatchRuns",
		trace.WithAttributes(attribute.String("tenant.id", tenantID)))
	defer span.End()

	var runs []models.BatchRun
	err := s.db.SelectContext(ctx, &runs,
		`SELECT * FROM batch_runs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	return runs, err
}

// StartBatchRun starts a batch run execution.
func (s *BatchService) StartBatchRun(ctx context.Context, tenantID, runID string) (*models.BatchRun, error) {
	ctx, span := tracer.Start(ctx, "BatchService.StartBatchRun",
		trace.WithAttributes(attribute.String("batch_run.id", runID)))
	defer span.End()

	now := time.Now()
	result, err := s.db.ExecContext(ctx,
		`UPDATE batch_runs SET status = 'running', started_at = $1 WHERE id = $2 AND tenant_id = $3 AND status = 'pending'`,
		now, runID, tenantID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, fmt.Errorf("start batch run: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return nil, fmt.Errorf("batch run not found or not in pending state")
	}

	var run models.BatchRun
	err = s.db.GetContext(ctx, &run, `SELECT * FROM batch_runs WHERE id = $1`, runID)
	return &run, err
}

// StopBatchRun stops a running batch run.
func (s *BatchService) StopBatchRun(ctx context.Context, tenantID, runID string) (*models.BatchRun, error) {
	ctx, span := tracer.Start(ctx, "BatchService.StopBatchRun",
		trace.WithAttributes(attribute.String("batch_run.id", runID)))
	defer span.End()

	// Fetch current run to calculate duration
	var run models.BatchRun
	err := s.db.GetContext(ctx, &run, `SELECT * FROM batch_runs WHERE id = $1 AND tenant_id = $2`, runID, tenantID)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("batch run not found: %w", err)
	}

	if run.Status != "running" && run.Status != "pending" {
		return nil, fmt.Errorf("batch run is not in a stoppable state (status: %s)", run.Status)
	}

	now := time.Now()
	if run.StartedAt != nil {
		run.DurationMs = now.Sub(*run.StartedAt).Milliseconds()
	}

	_, err = s.db.ExecContext(ctx,
		`UPDATE batch_runs SET status = 'cancelled', completed_at = $1, duration_ms = $2 WHERE id = $3`,
		now, run.DurationMs, runID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, fmt.Errorf("stop batch run: %w", err)
	}

	run.Status = "cancelled"
	run.CompletedAt = &now
	return &run, nil
}

// ==================== Helpers ====================

func timePtr(t time.Time) *time.Time {
	return &t
}