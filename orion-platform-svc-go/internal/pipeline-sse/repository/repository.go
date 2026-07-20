package repository

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/pipeline-sse/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// CreateLogEvent persists an SSE log event for replay.
func (r *Repository) CreateLogEvent(ctx context.Context, tenantID string, event *models.PublishLogRequest) error {
	id := uuid.New().String()
	now := time.Now().UTC()
	level := event.Level
	if level == "" {
		level = "info"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO pipeline_sse_events
		 (id, tenant_id, pipeline_id, run_id, stage_id, stage_name, step_name, log_line, level, event_type, created_at)
		 VALUES (:id, :tenant_id, :pipeline_id, :run_id, :stage_id, :stage_name, :step_name, :log_line, :level, 'log', :created_at)`,
		map[string]interface{}{
			"id":          id,
			"tenant_id":   tenantID,
			"pipeline_id": event.PipelineID,
			"run_id":      event.RunID,
			"stage_id":    event.StageID,
			"stage_name":  event.StageName,
			"step_name":   event.StepName,
			"log_line":    event.LogLine,
			"level":       level,
			"created_at":  now,
		})
	return err
}

// CreateStatusEvent persists an SSE status event for replay.
func (r *Repository) CreateStatusEvent(ctx context.Context, tenantID string, event *models.PublishStatusRequest) error {
	id := uuid.New().String()
	now := time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO pipeline_sse_events
		 (id, tenant_id, pipeline_id, run_id, status, stage_id, stage_name, progress, event_type, created_at)
		 VALUES (:id, :tenant_id, :pipeline_id, :run_id, :status, :stage_id, :stage_name, :progress, 'status', :created_at)`,
		map[string]interface{}{
			"id":          id,
			"tenant_id":   tenantID,
			"pipeline_id": event.PipelineID,
			"run_id":      event.RunID,
			"status":      event.Status,
			"stage_id":    event.StageID,
			"stage_name":  event.StageName,
			"progress":    event.Progress,
			"created_at":  now,
		})
	return err
}

// ListEvents retrieves persisted SSE events for a given pipeline run, ordered by creation time.
func (r *Repository) ListEvents(ctx context.Context, pipelineID, runID string, limit int) ([]map[string]interface{}, error) {
	if limit <= 0 || limit > 500 {
		limit = 200
	}
	rows, err := r.db.QueryxContext(ctx,
		`SELECT id, tenant_id, pipeline_id, run_id, event_type, status, stage_id, stage_name, step_name, log_line, level, progress, created_at
		 FROM pipeline_sse_events
		 WHERE pipeline_id = $1 AND run_id = $2
		 ORDER BY created_at ASC
		 LIMIT $3`, pipelineID, runID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []map[string]interface{}
	for rows.Next() {
		row := make(map[string]interface{})
		if err := rows.MapScan(row); err != nil {
			return nil, err
		}
		events = append(events, row)
	}
	if events == nil {
		events = []map[string]interface{}{}
	}
	return events, nil
}

// DeleteEventsByRun removes all events for a given pipeline run.
func (r *Repository) DeleteEventsByRun(ctx context.Context, pipelineID, runID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM pipeline_sse_events WHERE pipeline_id = $1 AND run_id = $2`,
		pipelineID, runID)
	return err
}
