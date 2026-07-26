package repository

import (
	"context"
	"fmt"
	"orion/infra-ops-svc-go/internal/capacity/models"
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

// ---------------------------------------------------------------------------
// MetricRepository
// ---------------------------------------------------------------------------

type MetricRepository struct{ db *sqlx.DB }

func NewMetricRepository(db *sqlx.DB) *MetricRepository { return &MetricRepository{db: db} }

func (r *MetricRepository) Create(ctx context.Context, m *models.CapacityMetric) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO capacity_metrics (id, tenant_id, resource_type, resource_id, metric_name, current_value, max_value, unit, utilization_percent, recorded_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		m.ID, m.TenantID, m.ResourceType, m.ResourceID, m.MetricName,
		m.CurrentValue, m.MaxValue, m.Unit, m.UtilizationPercent, m.RecordedAt)
	return err
}

func (r *MetricRepository) List(ctx context.Context, tenantID string, resourceType, metricName string) ([]models.CapacityMetric, error) {
	query := `SELECT * FROM capacity_metrics WHERE tenant_id=$1`
	args := []interface{}{tenantID}
	idx := 2
	if resourceType != "" {
		query += ` AND resource_type=$` + itoa(idx)
		args = append(args, resourceType)
		idx++
	}
	if metricName != "" {
		query += ` AND metric_name=$` + itoa(idx)
		args = append(args, metricName)
		idx++
	}
	query += ` ORDER BY recorded_at DESC`
	var items []models.CapacityMetric
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *MetricRepository) GetLatest(ctx context.Context, tenantID string) ([]models.CapacityMetric, error) {
	var items []models.CapacityMetric
	err := r.db.SelectContext(ctx, &items,
		`SELECT DISTINCT ON (resource_type, resource_id, metric_name) *
		 FROM capacity_metrics
		 WHERE tenant_id=$1
		 ORDER BY resource_type, resource_id, metric_name, recorded_at DESC`, tenantID)
	return items, err
}

// ---------------------------------------------------------------------------
// AlertRepository
// ---------------------------------------------------------------------------

type AlertRepository struct{ db *sqlx.DB }

func NewAlertRepository(db *sqlx.DB) *AlertRepository { return &AlertRepository{db: db} }

func (r *AlertRepository) Create(ctx context.Context, a *models.CapacityAlert) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO capacity_alerts (id, tenant_id, resource_id, resource_type, metric_name, current_utilization, threshold, severity, message, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		a.ID, a.TenantID, a.ResourceID, a.ResourceType, a.MetricName,
		a.CurrentUtilization, a.Threshold, a.Severity, a.Message, a.CreatedAt)
	return err
}

func (r *AlertRepository) List(ctx context.Context, tenantID, severity string) ([]models.CapacityAlert, error) {
	query := `SELECT * FROM capacity_alerts WHERE tenant_id=$1`
	args := []interface{}{tenantID}
	if severity != "" {
		query += ` AND severity=$2`
		args = append(args, severity)
	}
	query += ` ORDER BY created_at DESC`
	var items []models.CapacityAlert
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *AlertRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM capacity_alerts WHERE id=$1`, id)
	return err
}

// ---------------------------------------------------------------------------
// ReportRepository
// ---------------------------------------------------------------------------

type ReportRepository struct{ db *sqlx.DB }

func NewReportRepository(db *sqlx.DB) *ReportRepository { return &ReportRepository{db: db} }

func (r *ReportRepository) Create(ctx context.Context, rpt *models.CapacityReport) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO capacity_reports (id, tenant_id, title, total_resources, healthy_count, warning_count, critical_count, overall_score, alerts_snapshot, forecasts_snapshot, generated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		rpt.ID, rpt.TenantID, rpt.Title, rpt.TotalResources, rpt.HealthyCount,
		rpt.WarningCount, rpt.CriticalCount, rpt.OverallScore,
		rpt.AlertsSnapshot, rpt.ForecastsSnapshot, rpt.GeneratedAt)
	return err
}

func (r *ReportRepository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.CapacityReport, error) {
	var items []models.CapacityReport
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM capacity_reports WHERE tenant_id=$1 ORDER BY generated_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

func (r *ReportRepository) GetByID(ctx context.Context, tenantID, id string) (*models.CapacityReport, error) {
	var rpt models.CapacityReport
	err := r.db.GetContext(ctx, &rpt,
		`SELECT * FROM capacity_reports WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &rpt, nil
}

// itoa converts a small int to its string representation (avoids strconv import).
func itoa(n int) string {
	return fmt.Sprintf("%d", n)
}
