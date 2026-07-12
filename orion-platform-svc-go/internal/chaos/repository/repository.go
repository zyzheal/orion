package repository

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/chaos/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Experiment CRUD ---

func (r *Repository) Create(ctx context.Context, m *models.Experiment) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	if m.Status == "" {
		m.Status = "draft"
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO chaos_experiments (id, tenant_id, name, description, scope, faults,
			steady_state_hypothesis, auto_rollback, created_by, status, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		m.ID, m.TenantID, m.Name, m.Description, m.Scope, m.Faults,
		m.SteadyStateHypothesis, m.AutoRollback, m.CreatedBy, m.Status, m.CreatedAt, m.UpdatedAt)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Experiment, error) {
	var m models.Experiment
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM chaos_experiments WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, status string, limit, offset int) ([]models.Experiment, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.Experiment
	if status != "" {
		err := r.db.SelectContext(ctx, &items,
			`SELECT * FROM chaos_experiments WHERE tenant_id=$1 AND status=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
			tenantID, status, limit, offset)
		if err != nil {
			return nil, err
		}
	} else {
		err := r.db.SelectContext(ctx, &items,
			`SELECT * FROM chaos_experiments WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
			tenantID, limit, offset)
		if err != nil {
			return nil, err
		}
	}
	return items, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE chaos_experiments SET updated_at=NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM chaos_experiments WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) UpdateStatus(ctx context.Context, tenantID, id, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE chaos_experiments SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`, status, id, tenantID)
	return err
}

func (r *Repository) ListRunning(ctx context.Context, tenantID string) ([]models.Experiment, error) {
	var items []models.Experiment
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM chaos_experiments WHERE tenant_id=$1 AND status='running' ORDER BY created_at DESC`, tenantID)
	return items, err
}

// --- Experiment Run ---

func (r *Repository) CreateRun(ctx context.Context, run *models.ExperimentRun) error {
	run.ID = uuid.New().String()
	run.CreatedAt = time.Now().UTC()
	run.UpdatedAt = time.Now().UTC()
	if run.Status == "" {
		run.Status = "running"
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO chaos_experiment_runs (id, tenant_id, experiment_id, status, reason, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		run.ID, run.TenantID, run.ExperimentID, run.Status, run.Reason, run.CreatedAt, run.UpdatedAt)
	return err
}

func (r *Repository) GetRun(ctx context.Context, tenantID, runID string) (*models.ExperimentRun, error) {
	var run models.ExperimentRun
	err := r.db.GetContext(ctx, &run,
		`SELECT * FROM chaos_experiment_runs WHERE id=$1 AND tenant_id=$2`, runID, tenantID)
	if err != nil {
		return nil, err
	}
	return &run, nil
}

func (r *Repository) UpdateRunStatus(ctx context.Context, tenantID, runID, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE chaos_experiment_runs SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`, status, runID, tenantID)
	return err
}
