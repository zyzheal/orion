package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"orion/platform-svc-go/internal/monitoring/internal/models"
	"go.uber.org/zap"
)

type MetricRepository struct {
	db *DB
}

func NewMetricRepository(db *DB) *MetricRepository {
	return &MetricRepository{db: db}
}

func (r *MetricRepository) Insert(ctx context.Context, m *models.Metric) error {
	query := `INSERT INTO metrics (id, tenant_id, metric_name, value, tags, timestamp) VALUES ($1, $2, $3, $4, $5, $6)`
	_, err := r.db.Pool().Exec(ctx, query, m.ID, m.TenantID, m.MetricName, m.Value, m.Tags, m.Timestamp)
	if err != nil {
		r.db.Logger().Error("failed to insert metric",
			zap.String("metricName", m.MetricName),
			zap.String("tenantId", m.TenantID.String()),
			zap.Error(err),
		)
		return fmt.Errorf("insert metric: %w", err)
	}
	return nil
}

func (r *MetricRepository) Query(ctx context.Context, tenantID uuid.UUID, req models.MetricQueryRequest) (models.MetricResponse, error) {
	var resp models.MetricResponse

	query := `SELECT id, tenant_id, metric_name, value, tags, timestamp, created_at FROM metrics WHERE tenant_id = $1`
	countQuery := `SELECT COUNT(*) FROM metrics WHERE tenant_id = $1`
	args := []any{tenantID}
	argIdx := 2

	if req.MetricName != "" {
		query += fmt.Sprintf(" AND metric_name = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND metric_name = $%d", argIdx)
		args = append(args, req.MetricName)
		argIdx++
	}

	if !req.StartTime.IsZero() {
		query += fmt.Sprintf(" AND timestamp >= $%d", argIdx)
		countQuery += fmt.Sprintf(" AND timestamp >= $%d", argIdx)
		args = append(args, req.StartTime)
		argIdx++
	}

	if !req.EndTime.IsZero() {
		query += fmt.Sprintf(" AND timestamp <= $%d", argIdx)
		countQuery += fmt.Sprintf(" AND timestamp <= $%d", argIdx)
		args = append(args, req.EndTime)
		argIdx++
	}

	query += fmt.Sprintf(" ORDER BY timestamp DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	countQuery += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)

	limit := req.Limit
	if limit <= 0 {
		limit = 50
	}
	args = append(args, limit, req.Offset)

	if err := r.db.Pool().QueryRow(ctx, countQuery, args[:len(args)-2]...).Scan(&resp.Total); err != nil {
		r.db.Logger().Error("failed to count metrics", zap.Error(err))
		return resp, fmt.Errorf("count metrics: %w", err)
	}

	rows, err := r.db.Pool().Query(ctx, query, args...)
	if err != nil {
		r.db.Logger().Error("failed to query metrics", zap.Error(err))
		return resp, fmt.Errorf("query metrics: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var m models.Metric
		if err := rows.Scan(&m.ID, &m.TenantID, &m.MetricName, &m.Value, &m.Tags, &m.Timestamp, &m.CreatedAt); err != nil {
			r.db.Logger().Error("failed to scan metric", zap.Error(err))
			continue
		}
		resp.Data = append(resp.Data, m)
	}

	return resp, nil
}

func (r *MetricRepository) GetLatest(ctx context.Context, tenantID uuid.UUID, metricName string) (*models.Metric, error) {
	query := `SELECT id, tenant_id, metric_name, value, tags, timestamp, created_at FROM metrics WHERE tenant_id = $1 AND metric_name = $2 ORDER BY timestamp DESC LIMIT 1`
	var m models.Metric
	err := r.db.Pool().QueryRow(ctx, query, tenantID, metricName).Scan(&m.ID, &m.TenantID, &m.MetricName, &m.Value, &m.Tags, &m.Timestamp, &m.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("get latest metric: %w", err)
	}
	return &m, nil
}

func (r *MetricRepository) GetSeries(ctx context.Context, tenantID uuid.UUID, metricName string, startTime, endTime time.Time) ([]models.Metric, error) {
	query := `SELECT id, tenant_id, metric_name, value, tags, timestamp, created_at FROM metrics WHERE tenant_id = $1 AND metric_name = $2 AND timestamp >= $3 AND timestamp <= $4 ORDER BY timestamp`
	var metrics []models.Metric
	rows, err := r.db.Pool().Query(ctx, query, tenantID, metricName, startTime, endTime)
	if err != nil {
		return nil, fmt.Errorf("get metric series: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var m models.Metric
		if err := rows.Scan(&m.ID, &m.TenantID, &m.MetricName, &m.Value, &m.Tags, &m.Timestamp, &m.CreatedAt); err != nil {
			continue
		}
		metrics = append(metrics, m)
	}
	return metrics, nil
}

func (r *MetricRepository) GetSummary(ctx context.Context, tenantID uuid.UUID, metricName string, windowMs int64) (*models.MetricAggregation, error) {
	var endTime time.Time
	var startTime time.Time
	if windowMs > 0 {
		endTime = time.Now()
		startTime = endTime.Add(-time.Duration(windowMs) * time.Millisecond)
	}
	return r.GetAggregation(ctx, tenantID, metricName, startTime, endTime)
}

func (r *MetricRepository) GetServiceMetrics(ctx context.Context, tenantID uuid.UUID, serviceName string) ([]models.Metric, error) {
	query := `SELECT id, tenant_id, metric_name, value, tags, timestamp, created_at FROM metrics WHERE tenant_id = $1 AND metric_name LIKE $2 ORDER BY timestamp DESC LIMIT 100`
	rows, err := r.db.Pool().Query(ctx, query, tenantID, serviceName+"_%")
	if err != nil {
		r.db.Logger().Error("failed to query service metrics", zap.Error(err))
		return nil, fmt.Errorf("query service metrics: %w", err)
	}
	defer rows.Close()

	var metrics []models.Metric
	for rows.Next() {
		var m models.Metric
		if err := rows.Scan(&m.ID, &m.TenantID, &m.MetricName, &m.Value, &m.Tags, &m.Timestamp, &m.CreatedAt); err != nil {
			continue
		}
		metrics = append(metrics, m)
	}
	return metrics, nil
}

func (r *MetricRepository) DeleteOldMetrics(ctx context.Context, tenantID uuid.UUID, before time.Time) (int64, error) {
	query := `DELETE FROM metrics WHERE tenant_id = $1 AND timestamp < $2`
	tag, err := r.db.Pool().Exec(ctx, query, tenantID, before)
	if err != nil {
		return 0, fmt.Errorf("delete old metrics: %w", err)
	}
	return tag.RowsAffected(), nil
}

// GetAggregation computes aggregate statistics for a metric within a time window.
func (r *MetricRepository) GetAggregation(ctx context.Context, tenantID uuid.UUID, metricName string, startTime, endTime time.Time) (*models.MetricAggregation, error) {
	query := `
SELECT
	COALESCE(AVG(value), 0) AS avg,
	COALESCE(MAX(value), 0) AS max,
	COALESCE(MIN(value), 0) AS min,
	COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value), 0) AS p95,
	COALESCE(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY value), 0) AS p99,
	COALESCE(COUNT(*), 0) AS count,
	COALESCE(SUM(value), 0) AS sum
FROM metrics
WHERE tenant_id = $1 AND metric_name = $2`

	args := []any{tenantID, metricName}
	argIdx := 3

	if !startTime.IsZero() {
		query += fmt.Sprintf(" AND timestamp >= $%d", argIdx)
		args = append(args, startTime)
		argIdx++
	}
	if !endTime.IsZero() {
		query += fmt.Sprintf(" AND timestamp <= $%d", argIdx)
		args = append(args, endTime)
	}

	var agg models.MetricAggregation
	err := r.db.Pool().QueryRow(ctx, query, args...).Scan(
		&agg.Avg, &agg.Max, &agg.Min, &agg.P95, &agg.P99, &agg.Count, &agg.Sum,
	)
	if err != nil {
		r.db.Logger().Error("failed to get metric aggregation",
			zap.String("metricName", metricName),
			zap.Error(err),
		)
		return nil, fmt.Errorf("get metric aggregation: %w", err)
	}
	return &agg, nil
}

// GetMetricNames returns distinct metric names for a tenant.
func (r *MetricRepository) GetMetricNames(ctx context.Context, tenantID uuid.UUID) ([]string, error) {
	query := `SELECT DISTINCT metric_name FROM metrics WHERE tenant_id = $1 ORDER BY metric_name`
	rows, err := r.db.Pool().Query(ctx, query, tenantID)
	if err != nil {
		return nil, fmt.Errorf("query metric names: %w", err)
	}
	defer rows.Close()

	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			continue
		}
		names = append(names, name)
	}
	return names, nil
}

// BulkInsert inserts multiple metrics in a single batch.
func (r *MetricRepository) BulkInsert(ctx context.Context, metrics []*models.Metric) error {
	if len(metrics) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	query := `INSERT INTO metrics (id, tenant_id, metric_name, value, tags, timestamp) VALUES ($1, $2, $3, $4, $5, $6)`
	for _, m := range metrics {
		batch.Queue(query, m.ID, m.TenantID, m.MetricName, m.Value, m.Tags, m.Timestamp)
	}

	br := r.db.Pool().SendBatch(ctx, batch)
	defer br.Close()

	for i := 0; i < len(metrics); i++ {
		if _, err := br.Exec(); err != nil {
			r.db.Logger().Error("failed to bulk insert metric", zap.Error(err))
			return fmt.Errorf("bulk insert metric at index %d: %w", i, err)
		}
	}
	return nil
}
