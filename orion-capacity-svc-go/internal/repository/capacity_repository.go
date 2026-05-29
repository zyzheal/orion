package repository

import (
	"context"
	"orion/capacity-svc-go/internal/models"
	"github.com/jmoiron/sqlx"
)

type PoolRepository struct { db *sqlx.DB }
func NewPoolRepository(db *sqlx.DB) *PoolRepository { return &PoolRepository{db: db} }

func (r *PoolRepository) Create(ctx context.Context, d *models.ResourcePool) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO resource_pools (id, tenant_id, name, resource_type, total_cpu, total_memory, used_cpu, used_memory, node_count, labels) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, d.ID, d.TenantID, d.Name, d.ResourceType, d.TotalCPU, d.TotalMemory, d.UsedCPU, d.UsedMemory, d.NodeCount, d.Labels)
	return err
}

func (r *PoolRepository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.ResourcePool, error) {
	var items []models.ResourcePool
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM resource_pools WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`, tenantID, offset, limit)
	return items, err
}

func (r *PoolRepository) GetByID(ctx context.Context, tenantID, id string) (*models.ResourcePool, error) {
	var d models.ResourcePool
	err := r.db.GetContext(ctx, &d, `SELECT * FROM resource_pools WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil { return nil, err }
	return &d, nil
}

func (r *PoolRepository) Update(ctx context.Context, d *models.ResourcePool) error {
	_, err := r.db.ExecContext(ctx, `UPDATE resource_pools SET name=$1, resource_type=$2, total_cpu=$3, total_memory=$4, used_cpu=$5, used_memory=$6, node_count=$7, labels=$8, updated_at=NOW() WHERE id=$9 AND tenant_id=$10`, d.Name, d.ResourceType, d.TotalCPU, d.TotalMemory, d.UsedCPU, d.UsedMemory, d.NodeCount, d.Labels, d.ID, d.TenantID)
	return err
}

type ForecastRepository struct { db *sqlx.DB }
func NewForecastRepository(db *sqlx.DB) *ForecastRepository { return &ForecastRepository{db: db} }

func (r *ForecastRepository) Create(ctx context.Context, d *models.CapacityForecast) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO capacity_forecasts (id, tenant_id, resource_type, current_usage, predicted, threshold, days_until_full, recommendation, forecast_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, d.ID, d.TenantID, d.ResourceType, d.CurrentUsage, d.Predicted, d.Threshold, d.DaysUntilFull, d.Recommendation, d.ForecastDate)
	return err
}

func (r *ForecastRepository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.CapacityForecast, error) {
	var items []models.CapacityForecast
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM capacity_forecasts WHERE tenant_id=$1 ORDER BY forecast_date DESC OFFSET $2 LIMIT $3`, tenantID, offset, limit)
	return items, err
}

type PolicyRepository struct { db *sqlx.DB }
func NewPolicyRepository(db *sqlx.DB) *PolicyRepository { return &PolicyRepository{db: db} }

func (r *PolicyRepository) Create(ctx context.Context, d *models.ScalingPolicy) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO scaling_policies (id, tenant_id, name, resource_type, min_replicas, max_replicas, scale_up_threshold, scale_down_threshold, cooldown_sec, enabled) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, d.ID, d.TenantID, d.Name, d.ResourceType, d.MinReplicas, d.MaxReplicas, d.ScaleUpThreshold, d.ScaleDownThreshold, d.CooldownSec, d.Enabled)
	return err
}

func (r *PolicyRepository) List(ctx context.Context, tenantID string) ([]models.ScalingPolicy, error) {
	var items []models.ScalingPolicy
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM scaling_policies WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *PoolRepository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM resource_pools WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *PoolRepository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM resource_pools WHERE tenant_id=$1`, tenantID)
	return count, err
}
