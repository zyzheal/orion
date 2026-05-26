package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/orion-platform/orion-monitor-svc-go/internal/models"
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
