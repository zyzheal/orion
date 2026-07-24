package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"
	"orion/platform-svc-go/internal/infrastructure/chaos/models"
)

// ChaosRepository provides data access for chaos experiments.
type ChaosRepository struct {
	db *sqlx.DB
}

func NewChaosRepository(db *sqlx.DB) *ChaosRepository {
	return &ChaosRepository{db: db}
}

// Create inserts a new chaos experiment.
func (r *ChaosRepository) Create(ctx context.Context, exp *models.ChaosExperiment) error {
	query := `
		INSERT INTO chaos_experiments (id, tenant_id, name, description, scope, faults,
			steady_state_hypothesis, auto_rollback, status, created_by, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :description, :scope, :faults,
			:steady_state_hypothesis, :auto_rollback, :status, :created_by, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, exp)
	if err != nil {
		return fmt.Errorf("failed to create experiment: %w", err)
	}
	return nil
}

// GetByID retrieves an experiment by its ID.
func (r *ChaosRepository) GetByID(ctx context.Context, tenantID, id string) (*models.ChaosExperiment, error) {
	var exp models.ChaosExperiment
	query := `SELECT * FROM chaos_experiments WHERE id = $1 AND tenant_id = $2`
	err := r.db.GetContext(ctx, &exp, query, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("experiment %s not found", id)
		}
		return nil, fmt.Errorf("failed to get experiment: %w", err)
	}
	return &exp, nil
}

// ListByTenant retrieves paginated experiments for a tenant.
func (r *ChaosRepository) ListByTenant(ctx context.Context, tenantID string, offset, limit int) ([]models.ChaosExperiment, error) {
	var exps []models.ChaosExperiment
	query := `SELECT * FROM chaos_experiments WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	err := r.db.SelectContext(ctx, &exps, query, tenantID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list experiments: %w", err)
	}
	return exps, nil
}

// UpdateStatus updates the status of an experiment.
func (r *ChaosRepository) UpdateStatus(ctx context.Context, tenantID, id string, status models.ExperimentStatus) error {
	query := `UPDATE chaos_experiments SET status = $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4`
	_, err := r.db.ExecContext(ctx, query, status, time.Now(), id, tenantID)
	if err != nil {
		return fmt.Errorf("failed to update experiment status: %w", err)
	}
	return nil
}

// Delete removes an experiment by ID.
func (r *ChaosRepository) Delete(ctx context.Context, tenantID, id string) error {
	query := `DELETE FROM chaos_experiments WHERE id = $1 AND tenant_id = $2`
	_, err := r.db.ExecContext(ctx, query, id, tenantID)
	if err != nil {
		return fmt.Errorf("failed to delete experiment: %w", err)
	}
	return nil
}
