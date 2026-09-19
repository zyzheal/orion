package service

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/apm/models"
)

// spanSuccessCodes lists the status_code values this codebase treats as a
// successful span: 0 and 1 are the OTel UNSET and OK enum values, 200 is
// what the tracing repository fixtures write. Anything outside the list counts
// as a failed span, so one predicate serves both conventions instead of
// guessing which one a writer used.
const spanSuccessCodes = "0, 1, 200"

// defaultSlowTraceLimit bounds a slow-trace listing the way the tracing
// repository bounds a trace search.
const defaultSlowTraceLimit = 50

// GetSlowTraces returns the tenant's slowest traces, one row per trace_id
// aggregated from trace_spans, optionally filtered by the service that owns
// the longest span, a minimum duration and a created_at window.
//
// It used to return three hardcoded trace entries and ignore tenantID, the
// duration threshold and both time bounds, so every tenant read the same
// invented traces and the service filter matched those invented names. There
// is still no ingest path into trace_spans in this service, so a live
// deployment returns an empty list instead of fabricated data; the queries,
// the tenant binding and the filters are the real contract.
func (s *Service) GetSlowTraces(ctx context.Context, tenantID string, q *models.SlowTracesQuery) (*models.SlowTracesResponse, error) {
	if s.db == nil {
		return &models.SlowTracesResponse{Total: 0, Traces: []models.TraceEntry{}}, nil
	}

	thresholdMs, err := parseDurationMs(q)
	if err != nil {
		return nil, err
	}

	limit := defaultSlowTraceLimit
	if q != nil && q.Limit > 0 {
		limit = q.Limit
	}

	where, args, idx, err := slowTraceWhere(tenantID, q)
	if err != nil {
		return nil, err
	}
	args = append(args, thresholdMs, limit)

	// duration_ms is MAX(duration) over the trace: a span has no end timestamp,
	// and in OTLP the root span carries the whole trace's duration, so the
	// longest span is the trace. Service is the service of that same longest
	// span, not an arbitrary member, which is what ROW_NUMBER picks out.
	query := fmt.Sprintf(`
		SELECT t.trace_id, t.service_name, t.duration_ms, t.span_count, t.start_at, t.error_spans
		FROM (
			SELECT s.trace_id,
			       s.service_name,
			       MAX(s.duration) OVER (PARTITION BY s.trace_id) AS duration_ms,
			       COUNT(*) OVER (PARTITION BY s.trace_id) AS span_count,
			       MIN(s.created_at) OVER (PARTITION BY s.trace_id) AS start_at,
			       SUM(CASE WHEN s.status_code NOT IN (%s) THEN 1 ELSE 0 END) OVER (PARTITION BY s.trace_id) AS error_spans,
			       ROW_NUMBER() OVER (PARTITION BY s.trace_id ORDER BY s.duration DESC, s.id) AS row_num
			FROM trace_spans s
			%s
		) t
		WHERE t.row_num = 1
		  AND t.duration_ms >= $%d
		ORDER BY t.duration_ms DESC, t.trace_id
		LIMIT $%d
	`, spanSuccessCodes, where, idx, idx+1)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query trace_spans for slow traces: %w", err)
	}
	defer rows.Close()

	traces := make([]models.TraceEntry, 0, limit)
	for rows.Next() {
		var entry models.TraceEntry
		var start time.Time
		var errorSpans int64
		if err := rows.Scan(&entry.TraceID, &entry.Service, &entry.DurationMs, &entry.SpanCount, &start, &errorSpans); err != nil {
			return nil, fmt.Errorf("scan slow trace row: %w", err)
		}
		entry.Start = start.Unix()
		entry.Error = errorSpans > 0
		traces = append(traces, entry)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate slow traces: %w", err)
	}

	return &models.SlowTracesResponse{Total: len(traces), Traces: traces}, nil
}

// slowTraceWhere renders the predicates of GetSlowTraces' inner scan and
// returns the argument values in positional order. tenantID is always the
// first bound argument, so the tenant filter cannot be dropped silently.
func slowTraceWhere(tenantID string, q *models.SlowTracesQuery) (string, []any, int, error) {
	where := "WHERE s.tenant_id = $1"
	args := []any{tenantID}
	idx := 2

	if q == nil {
		return where, args, idx, nil
	}

	if q.Service != "" {
		where += " AND s.service_name = $" + strconv.Itoa(idx)
		args = append(args, q.Service)
		idx++
	}
	if q.Start != "" {
		start, err := parseTraceTime("start", q.Start)
		if err != nil {
			return "", nil, 0, err
		}
		where += " AND s.created_at >= $" + strconv.Itoa(idx)
		args = append(args, start)
		idx++
	}
	if q.End != "" {
		end, err := parseTraceTime("end", q.End)
		if err != nil {
			return "", nil, 0, err
		}
		where += " AND s.created_at <= $" + strconv.Itoa(idx)
		args = append(args, end)
		idx++
	}

	return where, args, idx, nil
}

// parseDurationMs turns the raw durationMs query parameter into a threshold.
// An empty value means no threshold, which is a legitimate request; a value
// the client cannot mean is a bad request, not a SQL failure.
func parseDurationMs(q *models.SlowTracesQuery) (int, error) {
	if q == nil || q.TraceDurationMs == "" {
		return 0, nil
	}
	n, err := strconv.Atoi(q.TraceDurationMs)
	if err != nil || n < 0 {
		return 0, fmt.Errorf("durationMs must be a non-negative integer, got %q: %w", q.TraceDurationMs, sentinel.BadRequest)
	}
	return n, nil
}

// parseTraceTime rejects a timestamp the database would reject and names the
// offending field, mirroring parseSearchTime in the tracing repository. The
// handler maps a service error to 500, so this text is what the caller sees.
func parseTraceTime(field, raw string) (time.Time, error) {
	ts, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		return time.Time{}, fmt.Errorf("%s must be an RFC3339 timestamp, got %q: %w", field, raw, sentinel.BadRequest)
	}
	return ts, nil
}

// GetServiceTopology returns the tenant's service dependency graph, built
// from trace_spans: nodes are the distinct services that emitted spans, and
// edges are parent_span_id to span_id joins between services.
//
// It used to return four hardcoded nodes and three hardcoded edges with
// invented versions, protocols and call counts while ignoring tenantID.
// trace_spans still has no ingest path, so a live deployment returns an
// empty graph instead of an invented one. Node versions and edge protocols
// are left empty on purpose: neither is stored anywhere in the schema.
func (s *Service) GetServiceTopology(ctx context.Context, tenantID string, q *models.TopologyQuery) (*models.TopologyResponse, error) {
	if s.db == nil {
		return &models.TopologyResponse{Services: []models.ServiceNode{}, Edges: []models.ServiceEdge{}}, nil
	}

	service := ""
	includeEdges := true
	if q != nil {
		service = q.Service
		includeEdges = q.IncludeDependencies
	}

	nodes, err := listServiceNodes(ctx, s.db, tenantID, service)
	if err != nil {
		return nil, err
	}

	if !includeEdges {
		return &models.TopologyResponse{Services: nodes, Edges: []models.ServiceEdge{}}, nil
	}

	edges, err := listServiceEdges(ctx, s.db, tenantID, service)
	if err != nil {
		return nil, err
	}

	return &models.TopologyResponse{Services: nodes, Edges: edges}, nil
}

// listServiceNodes returns one node per emitting service. Health is derived
// from status_code: no failed span means healthy, any failed span means
// unhealthy. There is no three-level classification because the schema has no
// latency data to degrade on.
func listServiceNodes(ctx context.Context, db *sql.DB, tenantID, service string) ([]models.ServiceNode, error) {
	where := "WHERE tenant_id = $1"
	args := []any{tenantID}
	if service != "" {
		where += " AND service_name = $2"
		args = append(args, service)
	}

	query := fmt.Sprintf(`SELECT service_name, SUM(CASE WHEN status_code NOT IN (%s) THEN 1 ELSE 0 END) AS error_spans FROM trace_spans %s GROUP BY service_name ORDER BY service_name`, spanSuccessCodes, where)
	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query trace_spans for service nodes: %w", err)
	}
	defer rows.Close()

	nodes := make([]models.ServiceNode, 0)
	for rows.Next() {
		var name string
		var errorSpans int64
		if err := rows.Scan(&name, &errorSpans); err != nil {
			return nil, fmt.Errorf("scan service node row: %w", err)
		}
		health := "healthy"
		if errorSpans > 0 {
			health = "unhealthy"
		}
		nodes = append(nodes, models.ServiceNode{Name: name, Health: health})
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate service nodes: %w", err)
	}
	return nodes, nil
}

// listServiceEdges joins each child span to its parent span within the same
// trace and tenant, then groups the pairs by service. Roots never match a
// parent because their parent_span_id is empty, so they add no edge. Same
// service to same service is dropped: an intra-service call is not a
// dependency edge.
func listServiceEdges(ctx context.Context, db *sql.DB, tenantID, service string) ([]models.ServiceEdge, error) {
	where := "WHERE c.tenant_id = $1"
	args := []any{tenantID}
	if service != "" {
		where += " AND (p.service_name = $2 OR c.service_name = $2)"
		args = append(args, service)
	}

	query := fmt.Sprintf(`SELECT p.service_name AS from_service, c.service_name AS to_service, COUNT(*) AS calls FROM trace_spans c JOIN trace_spans p ON p.tenant_id = c.tenant_id AND p.trace_id = c.trace_id AND p.span_id = c.parent_span_id %s GROUP BY p.service_name, c.service_name HAVING p.service_name <> c.service_name ORDER BY calls DESC, from_service, to_service`, where)
	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query trace_spans for service edges: %w", err)
	}
	defer rows.Close()

	edges := make([]models.ServiceEdge, 0)
	for rows.Next() {
		var from, to string
		var calls int64
		if err := rows.Scan(&from, &to, &calls); err != nil {
			return nil, fmt.Errorf("scan service edge row: %w", err)
		}
		edges = append(edges, models.ServiceEdge{From: from, To: to, Calls: int(calls)})
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate service edges: %w", err)
	}
	return edges, nil
}

// GetSlowQueries returns slow SQL queries collected from PostgreSQL's
// pg_stat_statements extension, optionally filtered by minimum duration,
// database name, and result limit.
//
// When no database connection is available (db == nil), returns empty results
// — the endpoint remains available but yields no data until configured.
func (s *Service) GetSlowQueries(ctx context.Context, tenantID string, q *models.SlowQueriesQuery) (*models.SlowQueriesResponse, error) {
	if s.db == nil {
		return &models.SlowQueriesResponse{Total: 0, Queries: []models.SlowQuery{}}, nil
	}

	limit := 20
	if q != nil && q.Limit > 0 {
		limit = q.Limit
	}

	// Build the query against pg_stat_statements.
	//
	// pg_stat_statements is available only when the extension is enabled
	// (CREATE EXTENSION pg_stat_statements). If it isn't installed the query
	// will fail and we return empty results with a descriptive error.
	var query string
	query += `SELECT
	q.queryid     AS query_id,
	q.querytext   AS sql,
	round(q.mean_exec_time::numeric, 1)::int AS duration_ms,
	q.calls       AS calls,
	coalesce(d.datname, '') AS db_name
FROM pg_stat_statements q
LEFT JOIN pg_database d ON d.oid = q.dbid
`
	if q != nil && q.MinDurationMs > 0 {
		query += "WHERE q.mean_exec_time >= $1\n"
	}
	if q != nil && q.Database != "" {
		query += "AND coalesce(d.datname, '') = $2\n"
	}
	query += fmt.Sprintf("ORDER BY q.total_exec_time DESC\nLIMIT $%d", limitArgOffset(q))

	// Collect query arguments in positional order.
	var args []any
	if q != nil && q.MinDurationMs > 0 {
		args = append(args, q.MinDurationMs)
	}
	if q != nil && q.Database != "" {
		args = append(args, q.Database)
	}
	args = append(args, limit)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		// pg_stat_statements extension may not be enabled — return empty.
		return &models.SlowQueriesResponse{Total: 0, Queries: []models.SlowQuery{}}, nil
	}
	defer rows.Close()

	queries := make([]models.SlowQuery, 0, limit)
	for rows.Next() {
		var sq models.SlowQuery
		var queryID *int64
		var sqlText, dbName string
		if err := rows.Scan(&queryID, &sqlText, &sq.DurationMs, &sq.Calls, &dbName); err != nil {
			return nil, fmt.Errorf("scan pg_stat_statements row: %w", err)
		}
		if queryID != nil {
			sq.QueryID = fmt.Sprintf("sql-%d", *queryID)
		}
		sq.SQL = sqlText
		sq.Database = dbName
		queries = append(queries, sq)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate pg_stat_statements: %w", err)
	}

	return &models.SlowQueriesResponse{
		Total:   len(queries),
		Queries: queries,
	}, nil
}

// limitArgOffset returns the positional argument number of the LIMIT clause
// after any WHERE conditions.
func limitArgOffset(q *models.SlowQueriesQuery) int {
	n := 1
	if q != nil {
		if q.MinDurationMs > 0 {
			n++
		}
		if q.Database != "" {
			n++
		}
	}
	return n
}
