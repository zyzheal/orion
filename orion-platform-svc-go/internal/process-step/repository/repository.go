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
		INSERT INTO process-step (id, tenant_id, name, value, enabled, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :value, :enabled, :created_at, :updated_at)`, m)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.ProcessStep, error) {
	var m models.ProcessStep
	err := r.db.GetContext(ctx, &m, `SELECT * FROM process-step WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.ProcessStep, error) {
	var items []models.ProcessStep
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM process-step WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantID)
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
		"UPDATE process-step SET "+strings.Join(setParts, ", ")+
			" WHERE id = $"+strconv.Itoa(idx-2)+" AND tenant_id = $"+strconv.Itoa(idx-1),
		args...,
	)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, tenantID, id)
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM process-step WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// GetStep is an alias for GetByID, matching the service-layer signature.
func (r *Repository) GetStep(ctx context.Context, tenantID, id string) (*models.ProcessStep, error) {
	return r.GetByID(ctx, tenantID, id)
}

// ListSteps is an alias for List.
func (r *Repository) ListSteps(ctx context.Context, tenantID string) ([]models.ProcessStep, error) {
	return r.List(ctx, tenantID)
}

// ListStepsByProcess lists steps filtered by process ID. (Stub: no process_id column yet.)
func (r *Repository) ListStepsByProcess(ctx context.Context, tenantID, processID string) ([]models.ProcessStep, error) {
	return r.List(ctx, tenantID)
}

// UpdateStep is an alias for Update.
func (r *Repository) UpdateStep(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.ProcessStep, error) {
	return r.Update(ctx, tenantID, id, updates)
}

// CreateEvent records a lifecycle event for a step. (Stub: no backing table yet.)
func (r *Repository) CreateEvent(ctx context.Context, event *models.ProcessStepEvent) error {
	return nil
}

// ListEventsByStep returns lifecycle events for a step. (Stub: no backing table yet.)
func (r *Repository) ListEventsByStep(ctx context.Context, stepID string) ([]models.ProcessStepEvent, error) {
	return []models.ProcessStepEvent{}, nil
}

// CreateExecution records a step execution. (Stub: no backing table yet.)
func (r *Repository) CreateExecution(ctx context.Context, exec *models.ProcessStepExecution) error {
	return nil
}

// UpdateExecution updates a step execution record. (Stub: no backing table yet.)
func (r *Repository) UpdateExecution(ctx context.Context, id string, updates map[string]interface{}) (int64, error) {
	return 0, nil
}

// ListExecutionsByStep returns executions for a step. (Stub: no backing table yet.)
func (r *Repository) ListExecutionsByStep(ctx context.Context, stepID string) ([]models.ProcessStepExecution, error) {
	return []models.ProcessStepExecution{}, nil
}
