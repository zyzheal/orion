package models

import "time"

// ApmEntry represents a apm record.
type ApmEntry struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenantId"`
	Name      string    `db:"name" json:"name"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`
}

// CreateRequest is the request body for creating a apm entry.
type CreateRequest struct {
	Name string `json:"name" binding:"required"`
}

// UpdateRequest is the request body for updating a apm entry.
type UpdateRequest struct {
	Name *string `json:"name"`
}

// PaginatedResponse is a generic paginated response.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}

// ===== Business: Slow Traces =====

// SlowTracesQuery filters slow traces.
type SlowTracesQuery struct {
	TraceDurationMs string `json:"durationMs"`
	Service         string `json:"service"`
	Start           string `json:"start"`
	End             string `json:"end"`
}

// SlowTracesResponse wraps slow trace results.
type SlowTracesResponse struct {
	Total  int          `json:"total"`
	Traces []TraceEntry `json:"traces"`
}

// TraceEntry is a single trace record.
type TraceEntry struct {
	TraceID    string `json:"traceId"`
	Service    string `json:"service"`
	DurationMs int    `json:"durationMs"`
	SpanCount  int    `json:"spanCount"`
	Start      int64  `json:"start"`
	Error      bool   `json:"error"`
}

// ===== Business: Service Topology =====

// TopologyQuery filters the service topology.
type TopologyQuery struct {
	IncludeDependencies bool   `json:"includeDependencies"`
	Service             string `json:"service"`
}

// TopologyResponse wraps service dependency topology.
type TopologyResponse struct {
	Services []ServiceNode `json:"services"`
	Edges    []ServiceEdge `json:"edges"`
}

// ServiceNode is a node in the service dependency graph.
type ServiceNode struct {
	Name    string `json:"name"`
	Version string `json:"version"`
	Health  string `json:"health"`
}

// ServiceEdge is an edge (dependency) between two services.
type ServiceEdge struct {
	From     string `json:"from"`
	To       string `json:"to"`
	Protocol string `json:"protocol"`
	Calls    int    `json:"calls"`
}

// ===== Business: Slow Queries =====

// SlowQueriesQuery filters slow SQL queries.
type SlowQueriesQuery struct {
	MinDurationMs int    `json:"minDurationMs"`
	Database      string `json:"database"`
	Limit         int    `json:"limit"`
}

// SlowQueriesResponse wraps slow query results.
type SlowQueriesResponse struct {
	Total   int         `json:"total"`
	Queries []SlowQuery `json:"queries"`
}

// SlowQuery is a single slow SQL query record.
type SlowQuery struct {
	QueryID    string `json:"queryId"`
	SQL        string `json:"sql"`
	DurationMs int    `json:"durationMs"`
	Calls      int    `json:"calls"`
	Database   string `json:"database"`
}
