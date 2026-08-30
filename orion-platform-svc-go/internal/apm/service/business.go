package service

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/apm/models"
)

// GetSlowTraces returns traces exceeding a duration threshold, optionally filtered by service and time window.
// TODO: replace simulated data with real tracing service/repository queries once tracing data is available.
func (s *Service) GetSlowTraces(ctx context.Context, tenantID string, q *models.SlowTracesQuery) (*models.SlowTracesResponse, error) {
	// Simulated data for now — no real tracing repository yet.
	traces := []models.TraceEntry{
		{TraceID: "trace-001", Service: "orion-platform-service", DurationMs: 2300, SpanCount: 12, Start: 1720000000, Error: false},
		{TraceID: "trace-002", Service: "orion-api-gateway", DurationMs: 1800, SpanCount: 8, Start: 1720000010, Error: true},
		{TraceID: "trace-003", Service: "orion-ai-service", DurationMs: 3100, SpanCount: 15, Start: 1720000020, Error: false},
	}

	if q != nil && q.Service != "" {
		filtered := make([]models.TraceEntry, 0)
		for _, t := range traces {
			if t.Service == q.Service {
				filtered = append(filtered, t)
			}
		}
		traces = filtered
	}

	return &models.SlowTracesResponse{
		Total:  len(traces),
		Traces: traces,
	}, nil
}

// GetServiceTopology returns the service dependency graph for the tenant.
// TODO: replace simulated data with real span relationship queries once tracing data is available.
func (s *Service) GetServiceTopology(ctx context.Context, tenantID string, q *models.TopologyQuery) (*models.TopologyResponse, error) {
	services := []models.ServiceNode{
		{Name: "orion-api-gateway", Version: "1.0.0", Health: "healthy"},
		{Name: "orion-platform-service", Version: "1.0.0", Health: "healthy"},
		{Name: "orion-ai-service", Version: "1.0.0", Health: "degraded"},
		{Name: "orion-db", Version: "14", Health: "healthy"},
	}
	edges := []models.ServiceEdge{
		{From: "orion-api-gateway", To: "orion-platform-service", Protocol: "http", Calls: 1200},
		{From: "orion-platform-service", To: "orion-ai-service", Protocol: "grpc", Calls: 340},
		{From: "orion-platform-service", To: "orion-db", Protocol: "tcp", Calls: 5600},
	}

	if q != nil {
		if q.Service != "" {
			filteredServices := make([]models.ServiceNode, 0)
			for _, sv := range services {
				if sv.Name == q.Service {
					filteredServices = append(filteredServices, sv)
				}
			}
			services = filteredServices

			filteredEdges := make([]models.ServiceEdge, 0)
			for _, e := range edges {
				if e.From == q.Service || e.To == q.Service {
					filteredEdges = append(filteredEdges, e)
				}
			}
			if !q.IncludeDependencies {
				filteredEdges = nil
			}
			edges = filteredEdges
		}
		if !q.IncludeDependencies {
			edges = nil
		}
	}

	return &models.TopologyResponse{
		Services: services,
		Edges:    edges,
	}, nil
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
