package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrRunNotFound = errors.New("pipeline run not found")

// PipelineRun is the minimal run model needed for error detail.
type PipelineRun struct {
	ID           uuid.UUID  `db:"id" json:"id"`
	Status       string     `db:"status" json:"status"`
	StartedAt    *time.Time `db:"started_at" json:"startedAt"`
	CompletedAt  *time.Time `db:"completed_at" json:"completedAt"`
}

// StageRecord is the minimal stage model for error collection.
type StageRecord struct {
	Name        string     `db:"name" json:"name"`
	Error       sql.NullString `db:"error" json:"error"`
	StartedAt   *time.Time `db:"started_at" json:"startedAt"`
	CompletedAt *time.Time `db:"completed_at" json:"completedAt"`
}

// TaskRecord is the minimal task model for error collection.
type TaskRecord struct {
	Name        string         `db:"name" json:"name"`
	Error       sql.NullString `db:"error" json:"error"`
	StartedAt   *time.Time     `db:"started_at" json:"startedAt"`
	CompletedAt *time.Time     `db:"completed_at" json:"completedAt"`
}

// RunDetail is the aggregate fetched for error classification.
type RunDetail struct {
	Run    PipelineRun
	Stages []StageRecord
	Tasks  []TaskRecord
}

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// GetRunDetail fetches a run plus its stages and tasks.
func (r *Repository) GetRunDetail(ctx context.Context, runID string) (*RunDetail, error) {
	// Parse UUID and fetch the run row
	var runIDUUID uuid.UUID
	parsed, err := uuid.Parse(runID)
	if err == nil {
		runIDUUID = parsed
	}

	var run PipelineRun
	err = r.db.GetContext(ctx, &run,
		"SELECT id, status, started_at, completed_at FROM pipeline_runs WHERE id=$1", runIDUUID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrRunNotFound
		}
		return nil, err
	}

	// Fetch stages for the run
	var stages []StageRecord
	err = r.db.SelectContext(ctx, &stages,
		"SELECT name, error, started_at, completed_at FROM pipeline_stages WHERE run_id=$1 ORDER BY sequence ASC", runIDUUID)
	if err != nil {
		return nil, err
	}

	// Fetch tasks for all stages of the run
	var tasks []TaskRecord
	err = r.db.SelectContext(ctx, &tasks, `
		SELECT t.name, t.error, t.started_at, t.completed_at
		FROM pipeline_tasks t
		JOIN pipeline_stages s ON t.stage_id = s.id
		WHERE s.run_id = $1
		ORDER BY s.sequence ASC, t.sequence ASC
	`, runIDUUID)
	if err != nil {
		return nil, err
	}

	return &RunDetail{
		Run:    run,
		Stages: stages,
		Tasks:  tasks,
	}, nil
}
