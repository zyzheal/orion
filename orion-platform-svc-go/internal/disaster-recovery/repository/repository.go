package repository

import (
	"context"
	"errors"
	"time"

	"orion/platform-svc-go/internal/disaster-recovery/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- DisasterPlan ---

func (r *Repository) CreatePlan(ctx context.Context, p *models.DisasterPlan) error {
	p.ID = uuid.New().String()
	p.CreatedAt = time.Now().UTC()
	p.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO disaster_plan (id, tenant_id, name, description, steps, status, last_run, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :description, :steps, :status, :last_run, :created_at, :updated_at)`, p)
	return err
}

func (r *Repository) GetPlan(ctx context.Context, tenantID, id string) (*models.DisasterPlan, error) {
	var p models.DisasterPlan
	err := r.db.GetContext(ctx, &p,
		`SELECT * FROM disaster_plan WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Repository) ListPlans(ctx context.Context, tenantID string, limit, offset int) ([]models.DisasterPlan, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.DisasterPlan
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM disaster_plan WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	return items, err
}

func (r *Repository) CountPlans(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM disaster_plan WHERE tenant_id=$1`, tenantID)
	return count, err
}

func (r *Repository) UpdatePlan(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE disaster_plan SET name=:name, description=:description, steps=:steps, status=:status, updated_at=:updated_at
		WHERE id=$1 AND tenant_id=$2`,
		map[string]interface{}{"id": id, "tenant_id": tenantID, "name": updates["name"], "description": updates["description"], "steps": updates["steps"], "status": updates["status"], "updated_at": updates["updated_at"]})
	return err
}

func (r *Repository) UpdatePlanLastRun(ctx context.Context, tenantID, id string, lastRun time.Time) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE disaster_plan SET last_run=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`, lastRun, time.Now().UTC(), id, tenantID)
	return err
}

// --- RecoveryRun ---

func (r *Repository) CreateRun(ctx context.Context, run *models.RecoveryRun) error {
	run.ID = uuid.New().String()
	run.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO recovery_run (id, plan_id, status, started_at, created_at)
		VALUES (:id, :plan_id, :status, :started_at, :created_at)`, run)
	return err
}

func (r *Repository) ListRuns(ctx context.Context, tenantID, planID string) ([]models.RecoveryRun, error) {
	var items []models.RecoveryRun
	err := r.db.SelectContext(ctx, &items,
		`SELECT r.* FROM recovery_run r
		JOIN disaster_plan p ON r.plan_id = p.id
		WHERE r.plan_id=$1 AND p.tenant_id=$2 ORDER BY r.started_at DESC`, planID, tenantID)
	return items, err
}

func (r *Repository) GetRun(ctx context.Context, tenantID, planID, runID string) (*models.RecoveryRun, error) {
	var run models.RecoveryRun
	err := r.db.GetContext(ctx, &run,
		`SELECT r.* FROM recovery_run r
		JOIN disaster_plan p ON r.plan_id = p.id
		WHERE r.id=$1 AND r.plan_id=$2 AND p.tenant_id=$3`, runID, planID, tenantID)
	if err != nil {
		return nil, err
	}
	return &run, nil
}
