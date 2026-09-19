package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/apm/models"
)

// newTestService builds a Service whose repository is the package fake. The two
// methods under test only ever use the database, so the repository is never
// touched by them.
func newTestService(db *sql.DB) *Service { return NewService(&fakeRepo{}, db) }

// mockDB opens a sqlmock database that compares query strings exactly after
// collapsing whitespace. The default matcher compiles the expected statement as
// a regular expression and uses strings.Contains, so it would happily accept a
// statement that lost its FROM clause or its tenant predicate.
func mockDB(t *testing.T) (*sql.DB, sqlmock.Sqlmock) {
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("open sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return db, mock
}

func parseFixtureTime(t *testing.T, raw string) time.Time {
	ts, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		t.Fatalf("test fixture: %v", err)
	}
	return ts
}

// slowTracesTemplate mirrors the statement GetSlowTraces renders. %s is the
// inner WHERE and the two %d are the placeholders the threshold and the LIMIT
// claim. Asserting the statement byte for byte is what makes a dropped tenant
// predicate, a dropped threshold or a renumbered placeholder visible.
const slowTracesTemplate = `SELECT t.trace_id, t.service_name, t.duration_ms, t.span_count, t.start_at, t.error_spans
FROM (
SELECT s.trace_id, s.service_name,
MAX(s.duration) OVER (PARTITION BY s.trace_id) AS duration_ms,
COUNT(*) OVER (PARTITION BY s.trace_id) AS span_count,
MIN(s.created_at) OVER (PARTITION BY s.trace_id) AS start_at,
SUM(CASE WHEN s.status_code NOT IN (0, 1, 200) THEN 1 ELSE 0 END) OVER (PARTITION BY s.trace_id) AS error_spans,
ROW_NUMBER() OVER (PARTITION BY s.trace_id ORDER BY s.duration DESC, s.id) AS row_num
FROM trace_spans s %s
) t
WHERE t.row_num = 1
AND t.duration_ms >= $%d
ORDER BY t.duration_ms DESC, t.trace_id
LIMIT $%d`

func slowTracesSQL(where string, thresholdIdx, limitIdx int) string {
	return fmt.Sprintf(slowTracesTemplate, where, thresholdIdx, limitIdx)
}

const serviceNodesTemplate = "SELECT service_name, SUM(CASE WHEN status_code NOT IN (0, 1, 200) THEN 1 ELSE 0 END) AS error_spans FROM trace_spans %s GROUP BY service_name ORDER BY service_name"

const serviceEdgesTemplate = "SELECT p.service_name AS from_service, c.service_name AS to_service, COUNT(*) AS calls FROM trace_spans c JOIN trace_spans p ON p.tenant_id = c.tenant_id AND p.trace_id = c.trace_id AND p.span_id = c.parent_span_id %s GROUP BY p.service_name, c.service_name HAVING p.service_name <> c.service_name ORDER BY calls DESC, from_service, to_service"

func serviceNodesSQL(where string) string { return fmt.Sprintf(serviceNodesTemplate, where) }
func serviceEdgesSQL(where string) string { return fmt.Sprintf(serviceEdgesTemplate, where) }

func traceRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{"trace_id", "service_name", "duration_ms", "span_count", "start_at", "error_spans"})
}

func nodeRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{"service_name", "error_spans"})
}

func edgeRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{"from_service", "to_service", "calls"})
}

func TestGetSlowTraces_NoDB(t *testing.T) {
	got, err := newTestService(nil).GetSlowTraces(context.Background(), "tenant-1", &models.SlowTracesQuery{TraceDurationMs: "500", Limit: 3})
	if err != nil {
		t.Fatalf("GetSlowTraces with nil db: %v", err)
	}
	if got.Total != 0 || len(got.Traces) != 0 {
		t.Fatalf("Total = %d, rows = %d, want both 0", got.Total, len(got.Traces))
	}
	if got.Traces == nil {
		t.Fatal("Traces must be an empty slice, not nil")
	}
}

func TestGetServiceTopology_NoDB(t *testing.T) {
	got, err := newTestService(nil).GetServiceTopology(context.Background(), "tenant-1", &models.TopologyQuery{IncludeDependencies: true})
	if err != nil {
		t.Fatalf("GetServiceTopology with nil db: %v", err)
	}
	if got.Services == nil || got.Edges == nil {
		t.Fatalf("Services = %v, Edges = %v: both must be empty slices", got.Services, got.Edges)
	}
	if len(got.Services) != 0 || len(got.Edges) != 0 {
		t.Fatalf("nodes = %d, edges = %d, want both 0", len(got.Services), len(got.Edges))
	}
}

func TestGetSlowTraces_BindsTenantThresholdAndLimit(t *testing.T) {
	db, mock := mockDB(t)
	start := parseFixtureTime(t, "2026-08-26T00:00:00Z")
	mock.ExpectQuery(slowTracesSQL("WHERE s.tenant_id = $1", 2, 3)).
		WithArgs("tenant-1", 0, defaultSlowTraceLimit).
		WillReturnRows(traceRows().
			AddRow("tr-slow", "api", int64(980), int64(6), start, int64(2)).
			AddRow("tr-fast", "worker", int64(120), int64(1), start, int64(0)))

	got, err := newTestService(db).GetSlowTraces(context.Background(), "tenant-1", nil)
	if err != nil {
		t.Fatalf("GetSlowTraces: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
	if got.Total != 2 || len(got.Traces) != 2 {
		t.Fatalf("Total = %d, rows = %d, want 2", got.Total, len(got.Traces))
	}
	slow, fast := got.Traces[0], got.Traces[1]
	if slow.TraceID != "tr-slow" || slow.Service != "api" || slow.DurationMs != 980 || slow.SpanCount != 6 || slow.Start != start.Unix() || !slow.Error {
		t.Errorf("slow trace = %+v", slow)
	}
	if fast.TraceID != "tr-fast" || fast.Service != "worker" || fast.DurationMs != 120 || fast.SpanCount != 1 || fast.Error {
		t.Errorf("fast trace = %+v", fast)
	}
}

func TestGetSlowTraces_ServiceFilterRenumbersPlaceholders(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(slowTracesSQL("WHERE s.tenant_id = $1 AND s.service_name = $2", 3, 4)).
		WithArgs("tenant-1", "api", 0, defaultSlowTraceLimit).
		WillReturnRows(traceRows())

	got, err := newTestService(db).GetSlowTraces(context.Background(), "tenant-1", &models.SlowTracesQuery{Service: "api"})
	if err != nil {
		t.Fatalf("GetSlowTraces: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
	if got.Total != 0 || got.Traces == nil || len(got.Traces) != 0 {
		t.Fatalf("Total = %d, Traces = %v", got.Total, got.Traces)
	}
}

func TestGetSlowTraces_AllFiltersBoundInOrder(t *testing.T) {
	db, mock := mockDB(t)
	start := parseFixtureTime(t, "2026-08-26T00:00:00Z")
	end := parseFixtureTime(t, "2026-08-26T01:00:00Z")
	where := "WHERE s.tenant_id = $1 AND s.service_name = $2 AND s.created_at >= $3 AND s.created_at <= $4"
	mock.ExpectQuery(slowTracesSQL(where, 5, 6)).
		WithArgs("tenant-1", "api", start, end, 250, 7).
		WillReturnRows(traceRows())

	got, err := newTestService(db).GetSlowTraces(context.Background(), "tenant-1", &models.SlowTracesQuery{
		TraceDurationMs: "250",
		Service:         "api",
		Start:           "2026-08-26T00:00:00Z",
		End:             "2026-08-26T01:00:00Z",
		Limit:           7,
	})
	if err != nil {
		t.Fatalf("GetSlowTraces: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
	if got.Total != 0 || got.Traces == nil || len(got.Traces) != 0 {
		t.Fatalf("Total = %d, Traces = %v", got.Total, got.Traces)
	}
}

// No expectation is registered: any database call returns an "unexpected call"
// error, which is neither sentinel.BadRequest nor a parse message. Asserting
// both is what proves a rejected request never reaches the database.
func TestGetSlowTraces_RejectsBadDurationMs(t *testing.T) {
	db, mock := mockDB(t)
	for _, raw := range []string{"fast", "-5"} {
		_, err := newTestService(db).GetSlowTraces(context.Background(), "tenant-1", &models.SlowTracesQuery{TraceDurationMs: raw})
		if err == nil {
			t.Fatalf("durationMs=%q: expected a bad request error", raw)
		}
		if !errors.Is(err, sentinel.BadRequest) {
			t.Errorf("durationMs=%q: err = %v, want sentinel.BadRequest", raw, err)
		}
		if !strings.Contains(err.Error(), "durationMs must be a non-negative integer") {
			t.Errorf("durationMs=%q: err = %q, want the offending field named", raw, err)
		}
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestGetSlowTraces_RejectsBadTimeBounds(t *testing.T) {
	db, mock := mockDB(t)
	cases := map[string]string{
		"start": "2026-08-26 00:00:00",
		"end":   "yesterday",
	}
	for field, raw := range cases {
		q := &models.SlowTracesQuery{}
		if field == "start" {
			q.Start = raw
		} else {
			q.End = raw
		}
		_, err := newTestService(db).GetSlowTraces(context.Background(), "tenant-1", q)
		if err == nil {
			t.Fatalf("%s=%q: expected a bad request error", field, raw)
		}
		if !errors.Is(err, sentinel.BadRequest) {
			t.Errorf("%s=%q: err = %v, want sentinel.BadRequest", field, raw, err)
		}
		want := field + " must be an RFC3339 timestamp"
		if !strings.Contains(err.Error(), want) {
			t.Errorf("%s=%q: err = %q, want %q", field, raw, err, want)
		}
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestGetSlowTraces_QueryErrorPropagates(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(slowTracesSQL("WHERE s.tenant_id = $1", 2, 3)).
		WithArgs("tenant-1", 0, defaultSlowTraceLimit).
		WillReturnError(fmt.Errorf("relation trace_spans does not exist"))

	_, err := newTestService(db).GetSlowTraces(context.Background(), "tenant-1", nil)
	if err == nil {
		t.Fatal("expected the query failure to propagate")
	}
	if !strings.Contains(err.Error(), "query trace_spans for slow traces") || !strings.Contains(err.Error(), "relation trace_spans does not exist") {
		t.Errorf("err = %v, want the wrapper and the driver error", err)
	}
	if errors.Is(err, sentinel.BadRequest) {
		t.Errorf("a query failure is not the caller's fault: %v", err)
	}
}

func TestGetServiceTopology_NilQueryIssuesNodesAndEdges(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(serviceNodesSQL("WHERE tenant_id = $1")).
		WithArgs("tenant-1").
		WillReturnRows(nodeRows())
	mock.ExpectQuery(serviceEdgesSQL("WHERE c.tenant_id = $1")).
		WithArgs("tenant-1").
		WillReturnRows(edgeRows())

	got, err := newTestService(db).GetServiceTopology(context.Background(), "tenant-1", nil)
	if err != nil {
		t.Fatalf("GetServiceTopology: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
	if got.Services == nil || got.Edges == nil {
		t.Fatalf("Services = %v, Edges = %v: both must be non-nil", got.Services, got.Edges)
	}
}

func TestGetServiceTopology_NodeHealthAndEdgeScan(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(serviceNodesSQL("WHERE tenant_id = $1")).
		WithArgs("tenant-1").
		WillReturnRows(nodeRows().
			AddRow("api", int64(0)).
			AddRow("billing", int64(1)).
			AddRow("worker", int64(4)))
	mock.ExpectQuery(serviceEdgesSQL("WHERE c.tenant_id = $1")).
		WithArgs("tenant-1").
		WillReturnRows(edgeRows().
			AddRow("api", "billing", int64(12)).
			AddRow("billing", "worker", int64(4)))

	got, err := newTestService(db).GetServiceTopology(context.Background(), "tenant-1", &models.TopologyQuery{IncludeDependencies: true})
	if err != nil {
		t.Fatalf("GetServiceTopology: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
	if len(got.Services) != 3 || len(got.Edges) != 2 {
		t.Fatalf("nodes = %d, edges = %d, want 3 and 2", len(got.Services), len(got.Edges))
	}
	if got.Services[0].Name != "api" || got.Services[0].Health != "healthy" {
		t.Errorf("api node = %+v, want healthy with no failed span", got.Services[0])
	}
	for _, want := range []struct{ name, health string }{{"billing", "unhealthy"}, {"worker", "unhealthy"}} {
		i := 1
		if want.name == "worker" {
			i = 2
		}
		if got.Services[i].Name != want.name || got.Services[i].Health != want.health {
			t.Errorf("%s node = %+v, want health %q", want.name, got.Services[i], want.health)
		}
	}
	for _, node := range got.Services {
		if node.Version != "" {
			t.Errorf("%s Version = %q: the schema stores no version, inventing one would be fabricated data", node.Name, node.Version)
		}
	}
	if got.Edges[0].From != "api" || got.Edges[0].To != "billing" || got.Edges[0].Calls != 12 {
		t.Errorf("edge = %+v", got.Edges[0])
	}
	if got.Edges[1].Calls != 4 {
		t.Errorf("edge calls = %d, want 4", got.Edges[1].Calls)
	}
	for _, edge := range got.Edges {
		if edge.Protocol != "" {
			t.Errorf("%s->%s Protocol = %q: no source column stores a protocol", edge.From, edge.To, edge.Protocol)
		}
	}
}

func TestGetServiceTopology_ServiceFilterBindsToBothStatements(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(serviceNodesSQL("WHERE tenant_id = $1 AND service_name = $2")).
		WithArgs("tenant-1", "api").
		WillReturnRows(nodeRows())
	mock.ExpectQuery(serviceEdgesSQL("WHERE c.tenant_id = $1 AND (p.service_name = $2 OR c.service_name = $2)")).
		WithArgs("tenant-1", "api").
		WillReturnRows(edgeRows())

	_, err := newTestService(db).GetServiceTopology(context.Background(), "tenant-1", &models.TopologyQuery{Service: "api", IncludeDependencies: true})
	if err != nil {
		t.Fatalf("GetServiceTopology: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestGetServiceTopology_ExcludingDependenciesSkipsEdgeStatement(t *testing.T) {
	db, mock := mockDB(t)
	// Exactly one expectation is registered. An edge query would fail with an
	// "unexpected call" error, so a missing IncludeDependencies branch cannot
	// hide behind an unmet expectation.
	mock.ExpectQuery(serviceNodesSQL("WHERE tenant_id = $1")).
		WithArgs("tenant-1").
		WillReturnRows(nodeRows().AddRow("api", int64(0)))

	got, err := newTestService(db).GetServiceTopology(context.Background(), "tenant-1", &models.TopologyQuery{IncludeDependencies: false})
	if err != nil {
		t.Fatalf("skipping the edge statement must not fail: %v", err)
	}
	if len(got.Services) != 1 || got.Services[0].Name != "api" || got.Services[0].Health != "healthy" {
		t.Errorf("nodes = %+v", got.Services)
	}
	if got.Edges == nil || len(got.Edges) != 0 {
		t.Errorf("Edges = %v, want an empty slice", got.Edges)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestGetServiceTopology_NodeQueryErrorPropagates(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(serviceNodesSQL("WHERE tenant_id = $1")).
		WithArgs("tenant-1").
		WillReturnError(fmt.Errorf("nodes down"))

	_, err := newTestService(db).GetServiceTopology(context.Background(), "tenant-1", &models.TopologyQuery{IncludeDependencies: true})
	if err == nil {
		t.Fatal("expected the node query failure to propagate")
	}
	if !strings.Contains(err.Error(), "query trace_spans for service nodes") || !strings.Contains(err.Error(), "nodes down") {
		t.Errorf("err = %v, want the wrapper and the driver error", err)
	}
}

func TestGetServiceTopology_EdgeQueryErrorPropagates(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(serviceNodesSQL("WHERE tenant_id = $1")).
		WithArgs("tenant-1").
		WillReturnRows(nodeRows())
	mock.ExpectQuery(serviceEdgesSQL("WHERE c.tenant_id = $1")).
		WithArgs("tenant-1").
		WillReturnError(fmt.Errorf("edges down"))

	_, err := newTestService(db).GetServiceTopology(context.Background(), "tenant-1", &models.TopologyQuery{IncludeDependencies: true})
	if err == nil {
		t.Fatal("expected the edge query failure to propagate")
	}
	if !strings.Contains(err.Error(), "query trace_spans for service edges") || !strings.Contains(err.Error(), "edges down") {
		t.Errorf("err = %v, want the wrapper and the driver error", err)
	}
}
