package repository

import (
	"context"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/tracing/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/sentinel"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateSpan(ctx context.Context, span *models.TraceSpan) error {
	span.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO trace_spans (id, tenant_id, trace_id, parent_span_id, span_id,
			service_name, operation_name, status_code, duration, tags, created_at)
		VALUES (:id, :tenantId, :traceId, :parentSpanId, :spanId,
			:serviceName, :operationName, :statusCode, :duration, :tags, :createdAt)
	`, span)
	return err
}

func (r *Repository) GetTrace(ctx context.Context, tenantID, traceID string) ([]models.TraceSpan, error) {
	var spans []models.TraceSpan
	err := r.db.SelectContext(ctx, &spans, `
		SELECT * FROM trace_spans WHERE tenant_id = $1 AND trace_id = $2
		ORDER BY duration DESC
	`, tenantID, traceID)
	if err != nil {
		return nil, err
	}
	return spans, nil
}

func (r *Repository) SearchTraces(ctx context.Context, tenantID string, req *models.TraceSearchRequest) ([]models.TraceSpan, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	idx := 2
	if req.ServiceName != "" {
		where += fmt.Sprintf(" AND service_name = $%d", idx)
		args = append(args, req.ServiceName)
		idx++
	}
	if req.OperationName != "" {
		where += fmt.Sprintf(" AND operation_name = $%d", idx)
		args = append(args, req.OperationName)
		idx++
	}
	if req.MinDuration > 0 {
		where += fmt.Sprintf(" AND duration >= $%d", idx)
		args = append(args, req.MinDuration)
		idx++
	}
	if req.MaxDuration > 0 {
		where += fmt.Sprintf(" AND duration <= $%d", idx)
		args = append(args, req.MaxDuration)
		idx++
	}
	if req.StatusCode > 0 {
		where += fmt.Sprintf(" AND status_code = $%d", idx)
	args = append(args, req.StatusCode)
		idx++
	}
	if req.Limit <= 0 {
		req.Limit = 50
	}
	where += fmt.Sprintf(" LIMIT $%d OFFSET $%d", idx, idx+1)
	args = append(args, req.Limit, req.Offset)
	var spans []models.TraceSpan
	err := r.db.SelectContext(ctx, &spans, fmt.Sprintf("SELECT * FROM trace_spans %s ORDER BY created_at DESC", where), args...)
	return spans, err
}

func (r *Repository) CreateSamplingConfig(ctx context.Context, config *models.TraceSamplingConfig) error {
	config.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO trace_sampling_configs (id, tenant_id, service_name, sample_rate, max_spans_per_sec, enabled, created_at, updated_at)
		VALUES (:id, :tenantId, :serviceName, :sampleRate, :maxSpansPerSec, :enabled, :createdAt, :updatedAt)
	`, config)
	return err
}

func (r *Repository) UpsertSamplingConfig(ctx context.Context, tenantID, serviceName string, sampleRate float64, maxSpansPerSec int, enabled bool) (*models.TraceSamplingConfig, error) {
	var config models.TraceSamplingConfig
	err := r.db.GetContext(ctx, &config, `SELECT * FROM trace_sampling_configs WHERE tenant_id = $1 AND service_name = $2`, tenantID, serviceName)
	if err == nil {
		_, err = r.db.ExecContext(ctx, `UPDATE trace_sampling_configs SET sample_rate = $1, max_spans_per_sec = $2, enabled = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4`, sampleRate, maxSpansPerSec, enabled, config.ID)
		if err != nil {
			return nil, err
		}
		return &config, nil
	}
	return nil, sentinel.NotFound
}

func (r *Repository) GetAllSamplingConfigs(ctx context.Context, tenantID string) ([]models.TraceSamplingConfig, error) {
	var configs []models.TraceSamplingConfig
	err := r.db.SelectContext(ctx, &configs, `SELECT * FROM trace_sampling_configs WHERE tenant_id = $1`, tenantID)
	return configs, err
}

func (r *Repository) CreateOtelConfig(ctx context.Context, config *models.OtelCollectorConfig) error {
	config.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO otel_collector_configs (id, tenant_id, name, description, config_type, config_yaml, enabled, created_at, updated_at)
		VALUES (:id, :tenantId, :name, :description, :configType, :configYaml, :enabled, :createdAt, :updatedAt)
	`, config)
	return err
}

func (r *Repository) GetOtelConfig(ctx context.Context, tenantID, id string) (*models.OtelCollectorConfig, error) {
	var config models.OtelCollectorConfig
	err := r.db.GetContext(ctx, &config, `SELECT * FROM otel_collector_configs WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return &config, nil
}

func (r *Repository) GetOtelConfigs(ctx context.Context, tenantID string, configType string) ([]models.OtelCollectorConfig, error) {
	if configType != "" {
		var configs []models.OtelCollectorConfig
		err := r.db.SelectContext(ctx, &configs, `SELECT * FROM otel_collector_configs WHERE tenant_id = $1 AND config_type = $2`, tenantID, configType)
		return configs, err
	}
	var configs []models.OtelCollectorConfig
	err := r.db.SelectContext(ctx, &configs, `SELECT * FROM otel_collector_configs WHERE tenant_id = $1`, tenantID)
	return configs, err
}

func (r *Repository) UpdateOtelConfig(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	setClauses := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates)+2)
	idx := 1
	for k, v := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", k, idx))
		args = append(args, v)
		idx++
	}
	args = append(args, id, tenantID)
	_, err := r.db.ExecContext(ctx, fmt.Sprintf("UPDATE otel_collector_configs SET %s, updated_at = CURRENT_TIMESTAMP WHERE id = $%d AND tenant_id = $%d", setClauses, len(args)-1, len(args)), args...)
	return err
}

func (r *Repository) DeleteOtelConfig(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM otel_collector_configs WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}
