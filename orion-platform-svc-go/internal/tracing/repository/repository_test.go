package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/tracing/models"

	"orion/go-common/pkg/sentinel"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// The matcher compares statements after collapsing whitespace, so an
// expectation written against a full "SELECT ... FROM trace_spans ..." cannot
// quietly satisfy a statement that only says "WHERE tenant_id = $1 ORDER BY".
// That is the defect under test here.
var ws = regexp.MustCompile(`\s+`)

func normSQL(s string) string {
	return strings.TrimSpace(ws.ReplaceAllString(s, " "))
}

// mockDBRecording returns a repository database whose matcher rejects any
// statement that is not byte-identical to the expectation once whitespace is
// collapsed, and keeps the text of every statement that was actually sent. The
// recording half is what lets a test assert that a statement was never issued.
func mockDBRecording(t *testing.T) (*sqlx.DB, sqlmock.Sqlmock, *[]string) {
	t.Helper()
	seen := []string{}
	raw, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		seen = append(seen, normSQL(actual))
		if normSQL(expected) != normSQL(actual) {
			return fmt.Errorf("sql mismatch: want %q got %q", expected, actual)
		}
		return nil
	})))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	return sqlx.NewDb(raw, "postgres"), mock, &seen
}

func mockDB(t *testing.T) (*sqlx.DB, sqlmock.Sqlmock) {
	db, mock, _ := mockDBRecording(t)
	return db, mock
}

func nowUTC() time.Time {
	return time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
}

// spanList is a hand-transcribed copy of the SELECT list the repository emits.
// Writing it out instead of referencing spanColumns keeps this file able to
// fail when the repository's column list drifts.
const spanList = "SELECT id, tenant_id, trace_id, parent_span_id, span_id, service_name, " +
	"operation_name, status_code, duration, tags, created_at"

var spanRowNames = []string{
	"id", "tenant_id", "trace_id", "parent_span_id", "span_id", "service_name",
	"operation_name", "status_code", "duration", "tags", "created_at",
}

func oneSpanRow(tags string) *sqlmock.Rows {
	return sqlmock.NewRows(spanRowNames).AddRow(
		"sp-1", "t-1", "tr-1", "", "sp-1", "payment-api", "GET /v1/orders",
		int64(200), 12.5, tags, nowUTC())
}

const samplingList = "SELECT id, tenant_id, service_name, sample_rate, max_spans_per_sec, enabled, created_at, updated_at"

var samplingRowNames = []string{
	"id", "tenant_id", "service_name", "sample_rate", "max_spans_per_sec", "enabled", "created_at", "updated_at",
}

func oneSamplingRow(rate float64, max int, enabled bool) *sqlmock.Rows {
	return sqlmock.NewRows(samplingRowNames).AddRow(
		"sc-1", "t-1", "payment-api", rate, int64(max), enabled, nowUTC(), nowUTC())
}

const otelList = "SELECT id, tenant_id, name, description, config_type, config_yaml, enabled, created_at, updated_at"

var otelRowNames = []string{
	"id", "tenant_id", "name", "description", "config_type", "config_yaml", "enabled", "created_at", "updated_at",
}

func oneOtelRow() *sqlmock.Rows {
	return sqlmock.NewRows(otelRowNames).AddRow(
		"oc-1", "t-1", "collector-a", "edge collector", "file",
		"receivers:\n  otlp:\n    protocol:\n      grpc:\n", true, nowUTC(), nowUTC())
}

func TestCreateSpanBindsSnakeCaseColumns(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectExec(normSQL(`INSERT INTO trace_spans (id, tenant_id, trace_id, parent_span_id, span_id, service_name, operation_name, status_code, duration, tags, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`)).
		WithArgs(sqlmock.AnyArg(), "t-1", "tr-1", "", "sp-1", "payment-api", "GET /v1/orders",
			200, 12.5, `{"env":"prod","zone":"eu1"}`, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	span := &models.TraceSpan{
		TenantID: "t-1", TraceID: "tr-1", SpanID: "sp-1",
		ServiceName: "payment-api", OperationName: "GET /v1/orders",
		StatusCode: 200, Duration: 12.5,
		Tags: map[string]string{"zone": "eu1", "env": "prod"},
	}
	if err := repo.CreateSpan(context.Background(), span); err != nil {
		t.Fatalf("CreateSpan: %v", err)
	}
	if span.ID == "" || span.CreatedAt.IsZero() {
		t.Fatalf("CreateSpan did not populate the new span: %+v", span)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the insert did not reach the database: %v", err)
	}
}

// The regression guard for the CamelCase placeholders. sqlx v1.4.0 looks a named
// argument up by the raw db tag value, so :tenantId never matched the field
// TenantID and every insert failed with "could not find name tenantId" before
// anything reached the database. bindSpan passes an explicit snake_case map so
// the statement no longer depends on that lookup; this test pins the exact
// failure the struct binding produced, so a reintroduction fails loudly instead
// of silently.
func TestCreateSpanFailsWhenANamedPlaceholderIsCamelCase(t *testing.T) {
	db, _ := mockDB(t)
	span := &models.TraceSpan{
		TenantID: "t-1", TraceID: "tr-1", ServiceName: "api", OperationName: "op",
	}

	_, err := db.NamedExecContext(context.Background(), `
		INSERT INTO trace_spans (id, tenant_id, trace_id, service_name, operation_name)
		VALUES (:id, :tenantId, :trace_id, :service_name, :operation_name)`, span)
	if err == nil {
		t.Fatal("a CamelCase placeholder must not succeed against a snake_case db tag")
	}
	if !strings.Contains(err.Error(), "could not find name tenantId") {
		t.Fatalf("error %q does not name the unmatched placeholder", err.Error())
	}
}

func TestEncodeTagsKeepsTheNotNullColumnNonEmpty(t *testing.T) {
	if got := encodeTags(nil); got != "{}" {
		t.Fatalf("encodeTags(nil) = %q, want {}", got)
	}
	if got := encodeTags(map[string]string{}); got != "{}" {
		t.Fatalf("encodeTags(empty) = %q, want {}", got)
	}
	if got := encodeTags(map[string]string{"a": "b"}); got != `{"a":"b"}` {
		t.Fatalf("encodeTags = %q", got)
	}
}

func TestDecodeSpanToleratesMalformedTags(t *testing.T) {
	base := &spanRow{
		ID: "sp-1", TenantID: "t-1", TraceID: "tr-1", SpanID: "sp-1",
		ServiceName: "api", OperationName: "op", StatusCode: 200, Duration: 12.5,
		CreatedAt: nowUTC(),
	}
	base.TagsRaw = []byte(`{"env":"`)
	got := decodeSpan(base)
	if got.StatusCode != 200 || len(got.Tags) != 0 {
		t.Fatalf("a malformed tag payload must not lose the rest of the row: %+v", got)
	}

	base.TagsRaw = []byte(`{"env":"prod"}`)
	got = decodeSpan(base)
	if got.Tags["env"] != "prod" {
		t.Fatalf("tags were not decoded: %+v", got)
	}

	// An empty payload leaves Tags nil rather than erroring.
	base.TagsRaw = nil
	got = decodeSpan(base)
	if len(got.Tags) != 0 {
		t.Fatalf("an empty tag payload must decode to no tags: %+v", got)
	}
}

// SELECT * is wrong in this module for the same reason it was wrong in
// internal/runbook: migration 572 adds created_by and updated_by to all three
// tracing tables, and 195 already declares metadata and deleted_at. Under
// safe-mode sqlx a result column with no matching field fails the whole read,
// so every trace endpoint died at the SQL layer. This pins the failure the old
// statement produced, so the explicit column lists cannot drift back to
// SELECT *.
func TestExplicitColumnListSurvivesTheAuditColumns(t *testing.T) {
	db, mock := mockDB(t)

	names := append(append([]string{}, spanRowNames...), "created_by")
	mock.ExpectQuery(normSQL("SELECT * FROM trace_spans WHERE tenant_id = $1 AND trace_id = $2 ORDER BY duration DESC")).
		WithArgs("t-1", "tr-1").
		WillReturnRows(sqlmock.NewRows(names).AddRow(
			"sp-1", "t-1", "tr-1", "", "sp-1", "api", "op", int64(200), 12.5, "{}", nowUTC(), "alice"))

	var rows []spanRow
	err := db.SelectContext(context.Background(), &rows,
		"SELECT * FROM trace_spans WHERE tenant_id = $1 AND trace_id = $2 ORDER BY duration DESC",
		"t-1", "tr-1")
	if err == nil {
		t.Fatal("SELECT * must fail while the audit columns are present")
	}
	if !strings.Contains(err.Error(), "missing destination name created_by") {
		t.Fatalf("error %q does not name the unscanned column", err.Error())
	}
}

func TestGetTraceUsesAnExplicitColumnListAndDecodesTags(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectQuery(normSQL(spanList+" FROM trace_spans WHERE tenant_id = $1 AND trace_id = $2 ORDER BY duration DESC")).
		WithArgs("t-1", "tr-1").
		WillReturnRows(oneSpanRow(`{"env":"prod"}`))

	items, err := repo.GetTrace(context.Background(), "t-1", "tr-1")
	if err != nil {
		t.Fatalf("GetTrace: %v", err)
	}
	if len(items) != 1 || items[0].SpanID != "sp-1" || items[0].StatusCode != 200 {
		t.Fatalf("unexpected spans: %+v", items)
	}
	if items[0].Tags["env"] != "prod" {
		t.Fatalf("tags were not decoded: %+v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("GetTrace did not issue the expected statement: %v", err)
	}
}

func TestGetTraceReturnsAStatementFailure(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	fail := errors.New("deadlock detected")

	mock.ExpectQuery(normSQL(spanList+" FROM trace_spans WHERE tenant_id = $1 AND trace_id = $2 ORDER BY duration DESC")).
		WithArgs("t-1", "tr-1").WillReturnError(fail)

	items, err := repo.GetTrace(context.Background(), "t-1", "tr-1")
	if !errors.Is(err, fail) {
		t.Fatalf("error %q is not the statement failure", err)
	}
	if err != nil && items != nil {
		t.Fatalf("a failed read must not return spans: %+v", items)
	}
}

func TestSearchTracesNumbersEveryFilterIncludingTheTimeBounds(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	start := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 1, 2, 0, 0, 0, 0, time.UTC)

	mock.ExpectQuery(normSQL(spanList+" FROM trace_spans WHERE tenant_id = $1 AND service_name = $2 AND operation_name = $3 AND duration >= $4 AND duration <= $5 AND status_code = $6 AND created_at >= $7 AND created_at <= $8 LIMIT $9 OFFSET $10 ORDER BY created_at DESC")).
		WithArgs("t-1", "payment-api", "GET /v1/orders", 1.5, 9.5, 500, start, end, 25, 5).
		WillReturnRows(oneSpanRow(`{}`))

	req := &models.TraceSearchRequest{
		ServiceName: "payment-api", OperationName: "GET /v1/orders",
		MinDuration: 1.5, MaxDuration: 9.5, StatusCode: 500,
		StartTime: "2026-01-01T00:00:00Z", EndTime: "2026-01-02T00:00:00Z",
		Limit: 25, Offset: 5,
	}
	items, err := repo.SearchTraces(context.Background(), "t-1", req)
	if err != nil {
		t.Fatalf("SearchTraces: %v", err)
	}
	if len(items) != 1 || items[0].ID != "sp-1" {
		t.Fatalf("unexpected spans: %+v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the filter placeholders were not numbered correctly: %v", err)
	}
}

// A zero limit used to page with LIMIT 0 OFFSET 0 and return nothing. The
// module documents a default page, so the test pins it.
func TestSearchTracesDefaultsThePage(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectQuery(normSQL(spanList+" FROM trace_spans WHERE tenant_id = $1 LIMIT $2 OFFSET $3 ORDER BY created_at DESC")).
		WithArgs("t-1", 50, 0).
		WillReturnRows(sqlmock.NewRows(spanRowNames))

	items, err := repo.SearchTraces(context.Background(), "t-1", &models.TraceSearchRequest{})
	if err != nil {
		t.Fatalf("SearchTraces: %v", err)
	}
	if items == nil || len(items) != 0 {
		t.Fatalf("an empty page must return an empty non-nil slice, got %v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the default page was not issued: %v", err)
	}
}

// The timestamp filters were the "unused parameters" case: the request carried
// StartTime and EndTime and neither was ever read, so a caller filtering by
// time silently got the whole history. The guard names the offending field
// because the handler maps every repository error to 500.
func TestSearchTracesRejectsATimestampItCannotParse(t *testing.T) {
	db, _, seen := mockDBRecording(t)
	repo := NewRepository(db)

	items, err := repo.SearchTraces(context.Background(), "t-1",
		&models.TraceSearchRequest{StartTime: "yesterday", Limit: 10})
	if err == nil {
		t.Fatal("an unparseable startTime must not be accepted")
	}
	if items != nil {
		t.Fatalf("a rejected search must not return spans: %+v", items)
	}
	if !strings.Contains(err.Error(), "startTime must be an RFC3339 timestamp") {
		t.Fatalf("error %q does not name the offending field", err.Error())
	}
	if !strings.Contains(err.Error(), `got "yesterday"`) {
		t.Fatalf("error %q does not echo the rejected value", err.Error())
	}
	if len(*seen) != 0 {
		t.Fatalf("a rejected timestamp must not reach the database: %v", *seen)
	}
}

func TestCreateSamplingConfigBindsEveryColumn(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectExec(normSQL(`INSERT INTO trace_sampling_configs (id, tenant_id, service_name, sample_rate, max_spans_per_sec, enabled, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`)).
		WithArgs(sqlmock.AnyArg(), "t-1", "payment-api", 0.5, 1000, true, sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	cfg := &models.TraceSamplingConfig{
		TenantID: "t-1", ServiceName: "payment-api",
		SampleRate: 0.5, MaxSpansPerSec: 1000, Enabled: true,
	}
	if err := repo.CreateSamplingConfig(context.Background(), cfg); err != nil {
		t.Fatalf("CreateSamplingConfig: %v", err)
	}
	if cfg.ID == "" || cfg.CreatedAt.IsZero() || !cfg.UpdatedAt.Equal(cfg.CreatedAt) {
		t.Fatalf("CreateSamplingConfig did not populate the new row: %+v", cfg)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the insert did not reach the database: %v", err)
	}
}

func TestUpsertSamplingConfigReturnsTheValuesItJustWrote(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectQuery(normSQL(samplingList+" FROM trace_sampling_configs WHERE tenant_id = $1 AND service_name = $2")).
		WithArgs("t-1", "payment-api").
		WillReturnRows(oneSamplingRow(0.1, 100, false))
	mock.ExpectExec(normSQL("UPDATE trace_sampling_configs SET sample_rate = $1, max_spans_per_sec = $2, enabled = $3, updated_at = NOW() WHERE id = $4 AND tenant_id = $5")).
		WithArgs(0.8, 5000, true, "sc-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	got, err := repo.UpsertSamplingConfig(context.Background(), "t-1", "payment-api", 0.8, 5000, true)
	if err != nil {
		t.Fatalf("UpsertSamplingConfig: %v", err)
	}
	if got == nil {
		t.Fatal("UpsertSamplingConfig returned nil")
	}
	if got.SampleRate != 0.8 || got.MaxSpansPerSec != 5000 || !got.Enabled {
		t.Fatalf("the returned config is stale, want 0.8/5000/true: %+v", got)
	}
	if got.ID != "sc-1" || got.ServiceName != "payment-api" || got.TenantID != "t-1" {
		t.Fatalf("the returned config lost its identity: %+v", got)
	}
	if got.UpdatedAt.Equal(nowUTC()) {
		t.Fatalf("updated_at still holds the pre-update value: %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the update did not reach the database: %v", err)
	}
}

func TestUpsertSamplingConfigReturnsNotFoundOnlyForAnAbsentRow(t *testing.T) {
	db, mock, seen := mockDBRecording(t)
	repo := NewRepository(db)

	mock.ExpectQuery(normSQL(samplingList+" FROM trace_sampling_configs WHERE tenant_id = $1 AND service_name = $2")).
		WithArgs("t-1", "batch-worker").WillReturnError(sql.ErrNoRows)

	got, err := repo.UpsertSamplingConfig(context.Background(), "t-1", "batch-worker", 0.5, 1000, true)
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("error %v is not sentinel.NotFound", err)
	}
	if got != nil {
		t.Fatalf("a missing row must return nil: %+v", got)
	}
	if len(*seen) != 1 {
		t.Fatalf("an absent row must not be UPDATEd; statements seen: %v", *seen)
	}
}

// The old code returned sentinel.NotFound for any error at all, so a statement
// failure made the service believe the row did not exist and insert a
// duplicate. The distinction is the whole fix.
func TestUpsertSamplingConfigPropagatesAStatementFailure(t *testing.T) {
	db, mock, seen := mockDBRecording(t)
	repo := NewRepository(db)
	fail := errors.New(`pq: relation "trace_sampling_configs" does not exist`)

	mock.ExpectQuery(normSQL(samplingList+" FROM trace_sampling_configs WHERE tenant_id = $1 AND service_name = $2")).
		WithArgs("t-1", "batch-worker").WillReturnError(fail)

	got, err := repo.UpsertSamplingConfig(context.Background(), "t-1", "batch-worker", 0.5, 1000, true)
	if !errors.Is(err, fail) {
		t.Fatalf("error %q is not the statement failure", err)
	}
	if errors.Is(err, sentinel.NotFound) {
		t.Fatalf("a statement failure must not be reported as a missing row")
	}
	if got != nil {
		t.Fatalf("a failed lookup must not return a config: %+v", got)
	}
	if len(*seen) != 1 {
		t.Fatalf("a failed lookup must not lead to an UPDATE; statements seen: %v", *seen)
	}
}

func TestGetAllSamplingConfigsUsesAnExplicitColumnList(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectQuery(normSQL(samplingList + " FROM trace_sampling_configs WHERE tenant_id = $1")).
		WithArgs("t-1").WillReturnRows(sqlmock.NewRows(samplingRowNames))

	items, err := repo.GetAllSamplingConfigs(context.Background(), "t-1")
	if err != nil {
		t.Fatalf("GetAllSamplingConfigs: %v", err)
	}
	if items == nil || len(items) != 0 {
		t.Fatalf("an empty page must return an empty non-nil slice, got %v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("GetAllSamplingConfigs did not issue the expected statement: %v", err)
	}
}

func TestCreateOtelConfigBindsEveryColumn(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectExec(normSQL(`INSERT INTO otel_collector_configs (id, tenant_id, name, description, config_type, config_yaml, enabled, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`)).
		WithArgs(sqlmock.AnyArg(), "t-1", "collector-a", "edge collector", "file",
			"receivers:\n  otlp:\n", true, sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	cfg := &models.OtelCollectorConfig{
		TenantID: "t-1", Name: "collector-a", Description: "edge collector",
		ConfigType: "file", ConfigYaml: "receivers:\n  otlp:\n", Enabled: true,
	}
	if err := repo.CreateOtelConfig(context.Background(), cfg); err != nil {
		t.Fatalf("CreateOtelConfig: %v", err)
	}
	if cfg.ID == "" || cfg.CreatedAt.IsZero() || !cfg.UpdatedAt.Equal(cfg.CreatedAt) {
		t.Fatalf("CreateOtelConfig did not populate the new row: %+v", cfg)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the insert did not reach the database: %v", err)
	}
}

func TestGetOtelConfigMapsAnyFailureToNotFound(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	fail := errors.New(`pq: relation "otel_collector_configs" does not exist`)

	mock.ExpectQuery(normSQL(otelList+" FROM otel_collector_configs WHERE id = $1 AND tenant_id = $2")).
		WithArgs("oc-1", "t-1").WillReturnError(fail)

	got, err := repo.GetOtelConfig(context.Background(), "t-1", "oc-1")
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("error %v is not sentinel.NotFound", err)
	}
	if got != nil {
		t.Fatalf("a failed read must not return a config: %+v", got)
	}
}

func TestGetOtelConfigDecodesARow(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectQuery(normSQL(otelList+" FROM otel_collector_configs WHERE id = $1 AND tenant_id = $2")).
		WithArgs("oc-1", "t-1").WillReturnRows(oneOtelRow())

	got, err := repo.GetOtelConfig(context.Background(), "t-1", "oc-1")
	if err != nil {
		t.Fatalf("GetOtelConfig: %v", err)
	}
	if got == nil || got.ID != "oc-1" || got.ConfigType != "file" || !got.Enabled {
		t.Fatalf("unexpected config: %+v", got)
	}
	if got.ConfigYaml == "" {
		t.Fatalf("config_yaml was not decoded: %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("GetOtelConfig did not issue the expected statement: %v", err)
	}
}

// The empty config_type used to fall through into another call to the same
// method with the same arguments, which recursed until the stack overflowed.
// Both branches must reach the database exactly once.
func TestGetOtelConfigsIssuesOneStatementEitherWay(t *testing.T) {
	db, mock, seen := mockDBRecording(t)
	repo := NewRepository(db)

	mock.ExpectQuery(normSQL(otelList+" FROM otel_collector_configs WHERE tenant_id = $1 AND config_type = $2")).
		WithArgs("t-1", "file").WillReturnRows(oneOtelRow())

	items, err := repo.GetOtelConfigs(context.Background(), "t-1", "file")
	if err != nil {
		t.Fatalf("GetOtelConfigs: %v", err)
	}
	if len(items) != 1 || items[0].ID != "oc-1" || items[0].ConfigType != "file" {
		t.Fatalf("unexpected configs: %+v", items)
	}
	if len(*seen) != 1 {
		t.Fatalf("the type filter must be one statement, saw %d: %v", len(*seen), *seen)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the type filter was not issued: %v", err)
	}

	db2, mock2, seen2 := mockDBRecording(t)
	repo2 := NewRepository(db2)
	mock2.ExpectQuery(normSQL(otelList + " FROM otel_collector_configs WHERE tenant_id = $1")).
		WithArgs("t-1").WillReturnRows(sqlmock.NewRows(otelRowNames))

	items2, err := repo2.GetOtelConfigs(context.Background(), "t-1", "")
	if err != nil {
		t.Fatalf("GetOtelConfigs without a type: %v", err)
	}
	if items2 == nil || len(items2) != 0 {
		t.Fatalf("an empty page must return an empty non-nil slice, got %v", items2)
	}
	if len(*seen2) != 1 {
		t.Fatalf("an empty type must be one statement, not a recursion: %d statements, %v", len(*seen2), *seen2)
	}
	if err := mock2.ExpectationsWereMet(); err != nil {
		t.Fatalf("the untyped list was not issued: %v", err)
	}
}

func TestUpdateOtelConfigNumbersPlaceholdersInWhitelistOrder(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectExec(normSQL("UPDATE otel_collector_configs SET name = $1, config_type = $2, enabled = $3, updated_at = NOW() WHERE id = $4 AND tenant_id = $5")).
		WithArgs("collector-b", "file", false, "oc-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Deliberately unordered: Go maps have no iteration order, so the whitelist
	// must supply it.
	err := repo.UpdateOtelConfig(context.Background(), "t-1", "oc-1", map[string]interface{}{
		"enabled":     false,
		"config_type": "file",
		"name":        "collector-b",
	})
	if err != nil {
		t.Fatalf("UpdateOtelConfig: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the update did not reach the database: %v", err)
	}
}

// A key outside the whitelist used to be interpolated into SET verbatim, which
// on PUT /tracing/otel/configs/:id was a SQL injection sink. tenant_id is the
// sharpest case: it would silently retarget another tenant's row.
func TestUpdateOtelConfigRejectsAColumnItWillNotWrite(t *testing.T) {
	db, _, seen := mockDBRecording(t)
	repo := NewRepository(db)

	err := repo.UpdateOtelConfig(context.Background(), "t-1", "oc-1", map[string]interface{}{
		"tenant_id": "other-tenant",
	})
	if err == nil {
		t.Fatal("an unknown column must not be silently dropped")
	}
	if !strings.Contains(err.Error(), `column "tenant_id" is not updatable`) {
		t.Fatalf("error %q does not name the rejected column", err.Error())
	}
	if len(*seen) != 0 {
		t.Fatalf("a rejected update must not reach the database: %v", *seen)
	}
}

// An empty update is not an update: it must not issue an UPDATE whose SET
// clause is only "updated_at = NOW()".
func TestUpdateOtelConfigWithNoColumnsIssuesNoStatement(t *testing.T) {
	db, _, seen := mockDBRecording(t)
	repo := NewRepository(db)

	if err := repo.UpdateOtelConfig(context.Background(), "t-1", "oc-1", map[string]interface{}{}); err != nil {
		t.Fatalf("UpdateOtelConfig: %v", err)
	}
	if len(*seen) != 0 {
		t.Fatalf("an empty update must not issue a statement: %v", *seen)
	}
}

func TestUpdateOtelConfigReturnsAStatementFailure(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	fail := errors.New("deadlock detected")

	mock.ExpectExec(normSQL("UPDATE otel_collector_configs SET name = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3")).
		WithArgs("x", "oc-1", "t-1").WillReturnError(fail)

	err := repo.UpdateOtelConfig(context.Background(), "t-1", "oc-1", map[string]interface{}{"name": "x"})
	if !errors.Is(err, fail) {
		t.Fatalf("error %q is not the statement failure", err)
	}
}

func TestDeleteOtelConfigIsScopedToTheTenant(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectExec(normSQL("DELETE FROM otel_collector_configs WHERE id = $1 AND tenant_id = $2")).
		WithArgs("oc-1", "t-1").WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.DeleteOtelConfig(context.Background(), "t-1", "oc-1"); err != nil {
		t.Fatalf("DeleteOtelConfig: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the delete did not reach the database: %v", err)
	}
}

func TestBuildOtelConfigSETIsNumberedAndInWhitelistOrder(t *testing.T) {
	clause, args, err := buildOtelConfigSET(map[string]interface{}{
		"enabled":     true,
		"config_yaml": "receivers:\n  otlp:\n",
		"name":        "collector-b",
	})
	if err != nil {
		t.Fatalf("buildOtelConfigSET: %v", err)
	}
	if clause != "name = $1, config_yaml = $2, enabled = $3" {
		t.Fatalf("unexpected SET clause %q", clause)
	}
	if len(args) != 3 || args[0] != "collector-b" || args[1] != "receivers:\n  otlp:\n" || args[2] != true {
		t.Fatalf("unexpected args %v", args)
	}
	if clause, args, _ = buildOtelConfigSET(map[string]interface{}{}); clause != "" || len(args) != 0 {
		t.Fatalf("an empty update must produce an empty clause, got %q %v", clause, args)
	}
}
