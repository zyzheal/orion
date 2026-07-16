package service

import (
	"context"
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

// GetSlowQueries returns slow SQL queries, optionally filtered by minimum duration, database, and result limit.
// TODO: replace simulated data with real DatabaseProfiler queries once tracing data is available.
func (s *Service) GetSlowQueries(ctx context.Context, tenantID string, q *models.SlowQueriesQuery) (*models.SlowQueriesResponse, error) {
	queries := []models.SlowQuery{
		{QueryID: "sql-001", SQL: "SELECT * FROM pipelines WHERE status = $1", DurationMs: 850, Calls: 230, Database: "orion-db"},
		{QueryID: "sql-002", SQL: "SELECT * FROM spans WHERE trace_id = $1 ORDER BY start DESC", DurationMs: 1200, Calls: 56, Database: "orion-db"},
		{QueryID: "sql-003", SQL: "SELECT * FROM deploy_histories WHERE app = $1 LIMIT $2", DurationMs: 640, Calls: 120, Database: "orion-db"},
	}

	if q != nil {
		if q.MinDurationMs > 0 {
			filtered := make([]models.SlowQuery, 0)
			for _, sq := range queries {
				if sq.DurationMs >= q.MinDurationMs {
					filtered = append(filtered, sq)
				}
			}
			queries = filtered
		}
		if q.Database != "" {
			filtered := make([]models.SlowQuery, 0)
			for _, sq := range queries {
				if sq.Database == q.Database {
					filtered = append(filtered, sq)
				}
			}
			queries = filtered
		}
		if q.Limit > 0 && q.Limit < len(queries) {
			queries = queries[:q.Limit]
		}
	}

	return &models.SlowQueriesResponse{
		Total:   len(queries),
		Queries: queries,
	}, nil
}
