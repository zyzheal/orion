package repository

import (
	"context"
	"strconv"
	"strings"
	"time"

	"orion/platform-svc-go/internal/process-step/models"

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

func (r *Repository) Create(ctx context.Context, m *models.ProcessStep) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = m.CreatedAt
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO process_steps (id, tenant_id, name, value, enabled, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :value, :enabled, :created_at, :updated_at)`, m)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.ProcessStep, error) {
	var m models.ProcessStep
	err := r.db.GetContext(ctx, &m, `SELECT * FROM process_steps WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.ProcessStep, error) {
	var items []models.ProcessStep
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM process_steps WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.ProcessStep, error) {
	if len(updates) == 0 {
		return r.GetByID(ctx, tenantID, id)
	}
	setParts := make([]string, 0, len(updates)+1)
	args := make([]interface{}, 0, len(updates)+3)
	idx := 1
	for k, v := range updates {
		setParts = append(setParts, k+" = $"+strconv.Itoa(idx))
		args = append(args, v)
		idx++
	}
	setParts = append(setParts, "updated_at = $"+strconv.Itoa(idx))
	args = append(args, time.Now().UTC())
	idx++
	args = append(args, id, tenantID)
	_, err := r.db.ExecContext(ctx,
		"UPDATE process_steps SET "+strings.Join(setParts, ", ")+
			" WHERE id = $"+strconv.Itoa(idx-2)+" AND tenant_id = $"+strconv.Itoa(idx-1),
		args...,
	)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, tenantID, id)
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM process_steps WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

func (r *Repository) GetStep(ctx context.Context, tenantID, id string) (*models.ProcessStep, error) {
	return r.GetByID(ctx, tenantID, id)
}

func (r *Repository) ListSteps(ctx context.Context, tenantID string) ([]models.ProcessStep, error) {
	return r.List(ctx, tenantID)
}

func (r *Repository) ListStepsByProcess(ctx context.Context, tenantID, processID string) ([]models.ProcessStep, error) {
	return r.List(ctx, tenantID)
}

func (r *Repository) UpdateStep(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.ProcessStep, error) {
	return r.Update(ctx, tenantID, id, updates)
}

// --- Process step lifecycle events ---

func (r *Repository) CreateEvent(ctx context.Context, event *models.ProcessStepEvent) error {
	event.ID = uuid.New().String()
	event.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO process_step_events (id, step_id, event_type, details, created_at)
		 VALUES (:id, :step_id, :event_type, :details, :created_at)`, event)
	return err
}

func (r *Repository) ListEventsByStep(ctx context.Context, stepID string) ([]models.ProcessStepEvent, error) {
	var events []models.ProcessStepEvent
	err := r.db.SelectContext(ctx, &events,
		`SELECT * FROM process_step_events WHERE step_id=$1 ORDER BY created_at DESC`, stepID)
	if err != nil {
		return nil, err
	}
	return events, nil
}

// --- Process step executions ---

func (r *Repository) CreateExecution(ctx context.Context, exec *models.ProcessStepExecution) error {
	exec.ID = uuid.New().String()
	if exec.StartedAt.IsZero() {
		exec.StartedAt = time.Now().UTC()
	}
	exec.CreatedAt = time.Now().UTC()
	if exec.Status == "" {
		exec.Status = models.ExecStatusPending
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO process_step_executions (id, step_id, instance_id, input, status, output, error, duration_ms, started_at, finished_at, created_at)
		 VALUES (:id, :step_id, :instance_id, :input, :status, :output, :error, :duration_ms, :started_at, :finished_at, :created_at)`, exec)
	return err
}

func (r *Repository) UpdateExecution(ctx context.Context, id string, updates map[string]interface{}) (int64, error) {
	if len(updates) == 0 {
		return 0, nil
	}
	setParts := make([]string, 0, len(updates)+1)
	args := make([]interface{}, 0, len(updates)+1)
	idx := 1
	for k, v := range updates {
		setParts = append(setParts, k+" = $"+strconv.Itoa(idx))
		args = append(args, v)
		idx++
	}
	args = append(args, id)
	res, err := r.db.ExecContext(ctx,
		"UPDATE process_step_executions SET "+strings.Join(setParts, ", ")+
			" WHERE id = $"+strconv.Itoa(idx), args...)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

func (r *Repository) ListExecutionsByStep(ctx context.Context, stepID string) ([]models.ProcessStepExecution, error) {
	var execs []models.ProcessStepExecution
	err := r.db.SelectContext(ctx, &execs,
		`SELECT * FROM process_step_executions WHERE step_id=$1 ORDER BY created_at DESC`, stepID)
	if err != nil {
		return nil, err
	}
	return execs, nil
}