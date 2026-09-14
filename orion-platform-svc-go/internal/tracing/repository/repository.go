package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"orion/platform-svc-go/internal/tracing/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// spanColumns is the canonical SELECT list for trace_spans. It is explicit
// rather than "SELECT *" for three reasons:
//
//   - Migration 572 adds created_by and updated_by to trace_spans, and 195
//     already declares metadata and deleted_at. Safe-mode sqlx fails the whole
//     read with "missing destination name created_by" as soon as a result
//     column has no matching field, so every trace endpoint died at the SQL
//     layer.
//   - tags is stored as text holding a JSON object; database/sql cannot scan
//     []byte into map[string]string, so spanRow keeps the raw bytes and
//     decodeSpan unmarshals them.
//   - updated_at is never written by this module, so selecting it would only
//     widen the surface that can break.
const spanColumns = `id, tenant_id, trace_id, parent_span_id, span_id, service_name, operation_name, status_code, duration, tags, created_at`

const samplingColumns = `id, tenant_id, service_name, sample_rate, max_spans_per_sec, enabled, created_at, updated_at`

const otelColumns = `id, tenant_id, name, description, config_type, config_yaml, enabled, created_at, updated_at`

// spanRow is the scan shape for trace_spans: models.TraceSpan with the tag
// payload held as raw bytes until decodeSpan. The db tags are mandatory, not
// optional -- sqlx's default NameMapper is strings.ToLower, which maps the
// column "tenant_id" but the field TenantID to "tenantid", so untagged reads
// fail with "missing destination name tenant_id".
type spanRow struct {
	ID            string    `db:"id"`
	TenantID      string    `db:"tenant_id"`
	TraceID       string    `db:"trace_id"`
	ParentSpanID  string    `db:"parent_span_id"`
	SpanID        string    `db:"span_id"`
	ServiceName   string    `db:"service_name"`
	OperationName string    `db:"operation_name"`
	StatusCode    int       `db:"status_code"`
	Duration      float64   `db:"duration"`
	TagsRaw       []byte    `db:"tags"`
	CreatedAt     time.Time `db:"created_at"`
}

// decodeSpan mirrors decodeRunbook in internal/runbook: a malformed payload
// should not fail the whole read, because the row is still usable with an
// empty tag set and the write path is the only place that can repair it.
func decodeSpan(row *spanRow) *models.TraceSpan {
	m := &models.TraceSpan{
		ID:            row.ID,
		TenantID:      row.TenantID,
		TraceID:       row.TraceID,
		ParentSpanID:  row.ParentSpanID,
		SpanID:        row.SpanID,
		ServiceName:   row.ServiceName,
		OperationName: row.OperationName,
		StatusCode:    row.StatusCode,
		Duration:      row.Duration,
		CreatedAt:     row.CreatedAt,
	}
	if len(row.TagsRaw) > 0 {
		_ = json.Unmarshal(row.TagsRaw, &m.Tags)
	}
	return m
}

type samplingRow struct {
	ID             string    `db:"id"`
	TenantID       string    `db:"tenant_id"`
	ServiceName    string    `db:"service_name"`
	SampleRate     float64   `db:"sample_rate"`
	MaxSpansPerSec int       `db:"max_spans_per_sec"`
	Enabled        bool      `db:"enabled"`
	CreatedAt      time.Time `db:"created_at"`
	UpdatedAt      time.Time `db:"updated_at"`
}

func decodeSampling(row *samplingRow) *models.TraceSamplingConfig {
	return &models.TraceSamplingConfig{
		ID:             row.ID,
		TenantID:       row.TenantID,
		ServiceName:    row.ServiceName,
		SampleRate:     row.SampleRate,
		MaxSpansPerSec: row.MaxSpansPerSec,
		Enabled:        row.Enabled,
		CreatedAt:      row.CreatedAt,
		UpdatedAt:      row.UpdatedAt,
	}
}

type otelRow struct {
	ID          string    `db:"id"`
	TenantID    string    `db:"tenant_id"`
	Name        string    `db:"name"`
	Description string    `db:"description"`
	ConfigType  string    `db:"config_type"`
	ConfigYaml  string    `db:"config_yaml"`
	Enabled     bool      `db:"enabled"`
	CreatedAt   time.Time `db:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"`
}

func decodeOtel(row *otelRow) *models.OtelCollectorConfig {
	return &models.OtelCollectorConfig{
		ID:          row.ID,
		TenantID:    row.TenantID,
		Name:        row.Name,
		Description: row.Description,
		ConfigType:  row.ConfigType,
		ConfigYaml:  row.ConfigYaml,
		Enabled:     row.Enabled,
		CreatedAt:   row.CreatedAt,
		UpdatedAt:   row.UpdatedAt,
	}
}

// encodeTags turns the tag map into the text form the column stores. An empty
// or nil map marshals to "{}" so the NOT NULL constraint holds.
func encodeTags(tags map[string]string) string {
	if tags == nil {
		return "{}"
	}
	b, err := json.Marshal(tags)
	if err != nil {
		return "{}"
	}
	return string(b)
}

// bindSpan is the named-argument map for trace_spans. Passing an explicit map
// rather than the struct removes any dependence on sqlx's NameMapper: sqlx
// v1.4.0 keys a named argument off the raw db tag value, so CamelCase
// placeholders such as :tenantId never matched the field TenantID and every
// insert failed with "could not find name tenantId".
func bindSpan(span *models.TraceSpan) map[string]interface{} {
	if span.CreatedAt.IsZero() {
		span.CreatedAt = time.Now().UTC()
	}
	return map[string]interface{}{
		"id":             span.ID,
		"tenant_id":      span.TenantID,
		"trace_id":       span.TraceID,
		"parent_span_id": span.ParentSpanID,
		"span_id":        span.SpanID,
		"service_name":   span.ServiceName,
		"operation_name": span.OperationName,
		"status_code":    span.StatusCode,
		"duration":       span.Duration,
		"tags":           encodeTags(span.Tags),
		"created_at":     span.CreatedAt,
	}
}

func (r *Repository) CreateSpan(ctx context.Context, span *models.TraceSpan) error {
	span.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO trace_spans (id, tenant_id, trace_id, parent_span_id, span_id,
			service_name, operation_name, status_code, duration, tags, created_at)
		VALUES (:id, :tenant_id, :trace_id, :parent_span_id, :span_id,
			:service_name, :operation_name, :status_code, :duration, :tags, :created_at)`,
		bindSpan(span))
	return err
}

func (r *Repository) GetTrace(ctx context.Context, tenantID, traceID string) ([]models.TraceSpan, error) {
	var rows []spanRow
	err := r.db.SelectContext(ctx, &rows,
		"SELECT "+spanColumns+" FROM trace_spans WHERE tenant_id = $1 AND trace_id = $2 ORDER BY duration DESC",
		tenantID, traceID)
	if err != nil {
		return nil, err
	}
	items := make([]models.TraceSpan, 0, len(rows))
	for i := range rows {
		items = append(items, *decodeSpan(&rows[i]))
	}
	return items, nil
}

// parseSearchTime rejects a timestamp the database would reject, and names the
// offending field so the error is actionable. The handler maps every
// repository error to 500, so this message is all the caller gets.
func parseSearchTime(field, raw string) (time.Time, error) {
	ts, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		return time.Time{}, fmt.Errorf("%s must be an RFC3339 timestamp, got %q", field, raw)
	}
	return ts, nil
}

func (r *Repository) SearchTraces(ctx context.Context, tenantID string, req *models.TraceSearchRequest) ([]models.TraceSpan, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	idx := 2

	if req.ServiceName != "" {
		where += " AND service_name = $" + strconv.Itoa(idx)
		args = append(args, req.ServiceName)
		idx++
	}
	if req.OperationName != "" {
		where += " AND operation_name = $" + strconv.Itoa(idx)
		args = append(args, req.OperationName)
		idx++
	}
	if req.MinDuration > 0 {
		where += " AND duration >= $" + strconv.Itoa(idx)
		args = append(args, req.MinDuration)
		idx++
	}
	if req.MaxDuration > 0 {
		where += " AND duration <= $" + strconv.Itoa(idx)
		args = append(args, req.MaxDuration)
		idx++
	}
	if req.StatusCode > 0 {
		where += " AND status_code = $" + strconv.Itoa(idx)
		args = append(args, req.StatusCode)
		idx++
	}
	if req.StartTime != "" {
		start, err := parseSearchTime("startTime", req.StartTime)
		if err != nil {
			return nil, err
		}
		where += " AND created_at >= $" + strconv.Itoa(idx)
		args = append(args, start)
		idx++
	}
	if req.EndTime != "" {
		end, err := parseSearchTime("endTime", req.EndTime)
		if err != nil {
			return nil, err
		}
		where += " AND created_at <= $" + strconv.Itoa(idx)
		args = append(args, end)
		idx++
	}
	if req.Limit <= 0 {
		req.Limit = 50
	}

	args = append(args, req.Limit, req.Offset)
	where += " LIMIT $" + strconv.Itoa(idx) + " OFFSET $" + strconv.Itoa(idx+1)

	var rows []spanRow
	// where starts with "WHERE", so the statement must supply its own
	// "SELECT ... FROM trace_spans": building it as spanColumns+" "+where
	// sent
	//   SELECT id, ... , created_at WHERE tenant_id = $1 ORDER BY ...
	// with no FROM clause, a syntax error on every search.
	err := r.db.SelectContext(ctx, &rows, "SELECT "+spanColumns+" FROM trace_spans "+where+" ORDER BY created_at DESC", args...)
	if err != nil {
		return nil, err
	}
	items := make([]models.TraceSpan, 0, len(rows))
	for i := range rows {
		items = append(items, *decodeSpan(&rows[i]))
	}
	return items, nil
}

func (r *Repository) CreateSamplingConfig(ctx context.Context, config *models.TraceSamplingConfig) error {
	config.ID = uuid.New().String()
	if config.CreatedAt.IsZero() {
		config.CreatedAt = time.Now().UTC()
	}
	config.UpdatedAt = config.CreatedAt
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO trace_sampling_configs (id, tenant_id, service_name, sample_rate, max_spans_per_sec, enabled, created_at, updated_at)
		VALUES (:id, :tenant_id, :service_name, :sample_rate, :max_spans_per_sec, :enabled, :created_at, :updated_at)`,
		map[string]interface{}{
			"id": config.ID, "tenant_id": config.TenantID,
			"service_name": config.ServiceName, "sample_rate": config.SampleRate,
			"max_spans_per_sec": config.MaxSpansPerSec, "enabled": config.Enabled,
			"created_at": config.CreatedAt, "updated_at": config.UpdatedAt,
		})
	return err
}

// UpsertSamplingConfig updates the row for serviceName when one exists and
// returns the values that were just written. Two earlier behaviours are gone:
// it returned the row as it was before the UPDATE, so the caller saw stale
// rates; and it folded every lookup error into sentinel.NotFound, so a
// statement failure made the service try to CREATE a row that already existed.
func (r *Repository) UpsertSamplingConfig(ctx context.Context, tenantID, serviceName string, sampleRate float64, maxSpansPerSec int, enabled bool) (*models.TraceSamplingConfig, error) {
	var row samplingRow
	err := r.db.GetContext(ctx, &row,
		"SELECT "+samplingColumns+" FROM trace_sampling_configs WHERE tenant_id = $1 AND service_name = $2",
		tenantID, serviceName)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	if err != nil {
		return nil, err
	}

	_, err = r.db.ExecContext(ctx,
		"UPDATE trace_sampling_configs SET sample_rate = $1, max_spans_per_sec = $2, enabled = $3, updated_at = NOW() WHERE id = $4 AND tenant_id = $5",
		sampleRate, maxSpansPerSec, enabled, row.ID, tenantID)
	if err != nil {
		return nil, err
	}

	row.SampleRate = sampleRate
	row.MaxSpansPerSec = maxSpansPerSec
	row.Enabled = enabled
	row.UpdatedAt = time.Now().UTC()
	return decodeSampling(&row), nil
}

func (r *Repository) GetAllSamplingConfigs(ctx context.Context, tenantID string) ([]models.TraceSamplingConfig, error) {
	var rows []samplingRow
	err := r.db.SelectContext(ctx, &rows,
		"SELECT "+samplingColumns+" FROM trace_sampling_configs WHERE tenant_id = $1", tenantID)
	if err != nil {
		return nil, err
	}
	items := make([]models.TraceSamplingConfig, 0, len(rows))
	for i := range rows {
		items = append(items, *decodeSampling(&rows[i]))
	}
	return items, nil
}

func (r *Repository) CreateOtelConfig(ctx context.Context, config *models.OtelCollectorConfig) error {
	config.ID = uuid.New().String()
	if config.CreatedAt.IsZero() {
		config.CreatedAt = time.Now().UTC()
	}
	config.UpdatedAt = config.CreatedAt
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO otel_collector_configs (id, tenant_id, name, description, config_type, config_yaml, enabled, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :description, :config_type, :config_yaml, :enabled, :created_at, :updated_at)`,
		map[string]interface{}{
			"id": config.ID, "tenant_id": config.TenantID,
			"name": config.Name, "description": config.Description,
			"config_type": config.ConfigType, "config_yaml": config.ConfigYaml,
			"enabled": config.Enabled, "created_at": config.CreatedAt,
			"updated_at": config.UpdatedAt,
		})
	return err
}

func (r *Repository) GetOtelConfig(ctx context.Context, tenantID, id string) (*models.OtelCollectorConfig, error) {
	var row otelRow
	err := r.db.GetContext(ctx, &row,
		"SELECT "+otelColumns+" FROM otel_collector_configs WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return decodeOtel(&row), nil
}

func (r *Repository) GetOtelConfigs(ctx context.Context, tenantID string, configType string) ([]models.OtelCollectorConfig, error) {
	var rows []otelRow
	var err error
	if configType != "" {
		err = r.db.SelectContext(ctx, &rows,
			"SELECT "+otelColumns+" FROM otel_collector_configs WHERE tenant_id = $1 AND config_type = $2", tenantID, configType)
	} else {
		err = r.db.SelectContext(ctx, &rows,
			"SELECT "+otelColumns+" FROM otel_collector_configs WHERE tenant_id = $1", tenantID)
	}
	if err != nil {
		return nil, err
	}
	return decodeOtelRows(rows), nil
}

func decodeOtelRows(rows []otelRow) []models.OtelCollectorConfig {
	items := make([]models.OtelCollectorConfig, 0, len(rows))
	for i := range rows {
		items = append(items, *decodeOtel(&rows[i]))
	}
	return items
}

// otelConfigUpdatable lists the columns a partial update may touch, in a fixed
// order. updated_at is deliberately absent: the UPDATE sets it itself.
var otelConfigUpdatable = []string{
	"name", "description", "config_type", "config_yaml", "enabled",
}

// buildOtelConfigSET renders "col = $1, col = $2, ..." for the entries of
// updates that are allowed, in allowed's order, and returns the values to
// bind. Walking the whitelist rather than the map keeps the generated SQL
// deterministic, because Go maps have no iteration order. A key outside the
// whitelist is an error instead of being interpolated into the SQL as a column
// name: the previous code took the caller's map keys verbatim into SET, which
// on PUT /tracing/otel/configs/:id was a SQL injection sink.
func buildOtelConfigSET(updates map[string]interface{}) (string, []interface{}, error) {
	ok := make(map[string]bool, len(otelConfigUpdatable))
	for _, col := range otelConfigUpdatable {
		ok[col] = true
	}
	for k := range updates {
		if !ok[k] {
			return "", nil, fmt.Errorf("column %q is not updatable", k)
		}
	}
	clauses := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates))
	for _, col := range otelConfigUpdatable {
		v, exists := updates[col]
		if !exists {
			continue
		}
		args = append(args, v)
		clauses = append(clauses, fmt.Sprintf("%s = $%d", col, len(args)))
	}
	return strings.Join(clauses, ", "), args, nil
}

func (r *Repository) UpdateOtelConfig(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}
	setClause, args, err := buildOtelConfigSET(updates)
	if err != nil {
		return err
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE otel_collector_configs SET %s, updated_at = NOW() WHERE id = $%d AND tenant_id = $%d",
		setClause, len(args)-1, len(args))
	_, err = r.db.ExecContext(ctx, query, args...)
	return err
}

func (r *Repository) DeleteOtelConfig(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		"DELETE FROM otel_collector_configs WHERE id = $1 AND tenant_id = $2", id, tenantID)
	return err
}
