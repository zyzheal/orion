package repository

import (
	"context"
	"fmt"
	"orion/canary-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

type CanaryRepository struct {
	db *sqlx.DB
}

func NewCanaryRepository(db *sqlx.DB) *CanaryRepository {
	return &CanaryRepository{db: db}
}

func (r *CanaryRepository) Create(ctx context.Context, c *models.Canary) error {
	query := `
		INSERT INTO canaries (tenant_id, deployment_id, service_name, version, status, weight, target_weight)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at
	`
	err := r.db.QueryRowContext(ctx, query,
		c.TenantID, c.DeploymentID, c.ServiceName, c.Version,
		c.Status, c.Weight, c.TargetWeight,
	).Scan(&c.ID, &c.CreatedAt)
	return err
}

func (r *CanaryRepository) GetByID(ctx context.Context, tenantID, id string) (*models.Canary, error) {
	var c models.Canary
	query := `SELECT * FROM canaries WHERE tenant_id = $1 AND id = $2`
	err := r.db.GetContext(ctx, &c, query, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("canary not found: %w", err)
	}
	return &c, nil
}

func (r *CanaryRepository) ListByTenant(ctx context.Context, tenantID string, offset, limit int) ([]models.Canary, error) {
	var canaries []models.Canary
	query := `SELECT * FROM canaries WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	err := r.db.SelectContext(ctx, &canaries, query, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return canaries, nil
}

func (r *CanaryRepository) UpdateStatus(ctx context.Context, id string, status models.CanaryStatus) error {
	query := `UPDATE canaries SET status = $1, completed_at = NOW() WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, status, id)
	return err
}

func (r *CanaryRepository) UpdateWeight(ctx context.Context, id string, weight int) error {
	query := `UPDATE canaries SET weight = $1 WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, weight, id)
	return err
}

func (r *CanaryRepository) AddMetric(ctx context.Context, m *models.CanaryMetric) error {
	query := `
		INSERT INTO canary_metrics (canary_id, metric_name, value, source, timestamp)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`
	err := r.db.QueryRowContext(ctx, query,
		m.CanaryID, m.MetricName, m.Value, m.Source, m.Timestamp,
	).Scan(&m.ID)
	return err
}

func (r *CanaryRepository) GetMetrics(ctx context.Context, canaryID string) ([]models.CanaryMetric, error) {
	var metrics []models.CanaryMetric
	query := `SELECT * FROM canary_metrics WHERE canary_id = $1 ORDER BY timestamp`
	err := r.db.SelectContext(ctx, &metrics, query, canaryID)
	if err != nil {
		return nil, err
	}
	return metrics, nil
}
