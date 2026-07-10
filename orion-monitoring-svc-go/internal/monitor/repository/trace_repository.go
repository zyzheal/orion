package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"orion/monitoring-svc-go/internal/monitor/models"
	"go.uber.org/zap"
)

type TraceRepository struct {
	db *DB
}

func NewTraceRepository(db *DB) *TraceRepository {
	return &TraceRepository{db: db}
}

func (r *TraceRepository) Query(ctx context.Context, tenantID uuid.UUID, req models.TraceQueryRequest) (models.TraceResponse, error) {
	var resp models.TraceResponse

	query := `SELECT id, tenant_id, trace_id, span_id, parent_span_id, service_name, operation_name, status, duration_ms, attributes, created_at FROM traces WHERE tenant_id = $1`
	countQuery := `SELECT COUNT(*) FROM traces WHERE tenant_id = $1`
	args := []any{tenantID}
	argIdx := 2

	if req.ServiceName != "" {
		query += fmt.Sprintf(" AND service_name = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND service_name = $%d", argIdx)
		args = append(args, req.ServiceName)
		argIdx++
	}

	if req.OperationName != "" {
		query += fmt.Sprintf(" AND operation_name = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND operation_name = $%d", argIdx)
		args = append(args, req.OperationName)
		argIdx++
	}

	if req.Status != "" {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, req.Status)
		argIdx++
	}

	if req.MinDurationMs > 0 {
		query += fmt.Sprintf(" AND duration_ms >= $%d", argIdx)
		countQuery += fmt.Sprintf(" AND duration_ms >= $%d", argIdx)
		args = append(args, req.MinDurationMs)
		argIdx++
	}

	if req.MaxDurationMs > 0 {
		query += fmt.Sprintf(" AND duration_ms <= $%d", argIdx)
		countQuery += fmt.Sprintf(" AND duration_ms <= $%d", argIdx)
		args = append(args, req.MaxDurationMs)
		argIdx++
	}

	if !req.StartTime.IsZero() {
		query += fmt.Sprintf(" AND created_at >= $%d", argIdx)
		countQuery += fmt.Sprintf(" AND created_at >= $%d", argIdx)
		args = append(args, req.StartTime)
		argIdx++
	}

	if !req.EndTime.IsZero() {
		query += fmt.Sprintf(" AND created_at <= $%d", argIdx)
		countQuery += fmt.Sprintf(" AND created_at <= $%d", argIdx)
		args = append(args, req.EndTime)
		argIdx++
	}

	limit := req.Limit
	if limit <= 0 {
		limit = 50
	}
	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, req.Offset)

	if err := r.db.Pool().QueryRow(ctx, countQuery, args[:len(args)-2]...).Scan(&resp.Total); err != nil {
		r.db.Logger().Error("failed to count traces", zap.Error(err))
		return resp, fmt.Errorf("count traces: %w", err)
	}

	rows, err := r.db.Pool().Query(ctx, query, args...)
	if err != nil {
		r.db.Logger().Error("failed to query traces", zap.Error(err))
		return resp, fmt.Errorf("query traces: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var t models.Trace
		if err := rows.Scan(&t.ID, &t.TenantID, &t.TraceID, &t.SpanID, &t.ParentSpanID, &t.ServiceName, &t.OperationName, &t.Status, &t.DurationMs, &t.Attributes, &t.CreatedAt); err != nil {
			r.db.Logger().Error("failed to scan trace", zap.Error(err))
			continue
		}
		resp.Data = append(resp.Data, t)
	}

	return resp, nil
}

func (r *TraceRepository) GetByTraceID(ctx context.Context, tenantID uuid.UUID, traceID string) ([]models.Trace, error) {
	query := `SELECT id, tenant_id, trace_id, span_id, parent_span_id, service_name, operation_name, status, duration_ms, attributes, created_at FROM traces WHERE tenant_id = $1 AND trace_id = $2 ORDER BY created_at`
	rows, err := r.db.Pool().Query(ctx, query, tenantID, traceID)
	if err != nil {
		r.db.Logger().Error("failed to query trace by ID", zap.String("traceID", traceID), zap.Error(err))
		return nil, fmt.Errorf("query trace by ID: %w", err)
	}
	defer rows.Close()

	var traces []models.Trace
	for rows.Next() {
		var t models.Trace
		if err := rows.Scan(&t.ID, &t.TenantID, &t.TraceID, &t.SpanID, &t.ParentSpanID, &t.ServiceName, &t.OperationName, &t.Status, &t.DurationMs, &t.Attributes, &t.CreatedAt); err != nil {
			continue
		}
		traces = append(traces, t)
	}
	return traces, nil
}

func (r *TraceRepository) GetServiceNames(ctx context.Context, tenantID uuid.UUID) ([]string, error) {
	query := `SELECT DISTINCT service_name FROM traces WHERE tenant_id = $1 AND service_name != '' ORDER BY service_name`
	rows, err := r.db.Pool().Query(ctx, query, tenantID)
	if err != nil {
		r.db.Logger().Error("failed to query service names", zap.Error(err))
		return nil, fmt.Errorf("query service names: %w", err)
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

func (r *TraceRepository) GetServiceOverview(ctx context.Context, tenantID uuid.UUID, serviceName string) (*models.ServiceOverview, error) {
	query := `
SELECT
	COUNT(*) as request_count,
	COALESCE(AVG(duration_ms), 0) as avg_duration_ms,
	COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms), 0) as p95_duration_ms,
	COALESCE(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms), 0) as p99_duration_ms,
	COALESCE(SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0), 0) as error_rate,
	COALESCE(MAX(created_at), NOW()) as last_seen
FROM traces
WHERE tenant_id = $1 AND service_name = $2`

	var overview models.ServiceOverview
	err := r.db.Pool().QueryRow(ctx, query, tenantID, serviceName).Scan(
		&overview.RequestCount,
		&overview.AvgDurationMs,
		&overview.P95DurationMs,
		&overview.P99DurationMs,
		&overview.ErrorRate,
		&overview.LastSeen,
	)
	if err != nil {
		r.db.Logger().Error("failed to get service overview", zap.String("serviceName", serviceName), zap.Error(err))
		return nil, fmt.Errorf("get service overview: %w", err)
	}

	// Query active traces count
	activeQuery := `SELECT COUNT(*) FROM traces WHERE tenant_id = $1 AND service_name = $2 AND status = 'error'`
	if err := r.db.Pool().QueryRow(ctx, activeQuery, tenantID, serviceName).Scan(&overview.ActiveTraces); err != nil {
		r.db.Logger().Error("failed to count active traces", zap.Error(err))
	}

	overview.ServiceName = serviceName
	return &overview, nil
}
