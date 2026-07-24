// Package models defines data structures for the global search service.
package models

import "time"

// SearchRequest is the unified search query sent to the global search API.
type SearchRequest struct {
	// Query is the full-text search term.
	Query string `json:"query" binding:"required"`
	// Modules filters results to specific modules (empty means all registered).
	Modules []string `json:"modules,omitempty"`
	// Filters are module-agnostic key-value filters (e.g. "status=open").
	Filters map[string]string `json:"filters,omitempty"`
	// ModuleFilters are per-module filters (key = module name).
	ModuleFilters map[string]map[string]string `json:"module_filters,omitempty"`
	// From is the zero-based offset for pagination.
	From int `json:"from"`
	// Size is the number of results per page (default 20, max 100).
	Size int `json:"size"`
	// SortBy field to sort results by (e.g. "created_at", "score").
	SortBy string `json:"sort_by,omitempty"`
	// SortOrder is "asc" or "desc" (default "desc").
	SortOrder string `json:"sort_order,omitempty"`
}

// SearchResponse is the unified response grouped by module.
type SearchResponse struct {
	// Total is the total number of matched documents across all modules.
	Total int64 `json:"total"`
	// TookMs is the query duration in milliseconds.
	TookMs int64 `json:"took_ms"`
	// Query echoes the original query.
	Query string `json:"query"`
	// Results maps module name to its search results.
	Results map[string]*SearchResultGroup `json:"results"`
}

// SearchResultGroup holds results for a single module.
type SearchResultGroup struct {
	// Total is the total matched count for this module.
	Total int64 `json:"total"`
	// Hits is the list of matched documents.
	Hits []SearchHit `json:"hits"`
}

// SearchHit is a single matched document.
type SearchHit struct {
	// ID is the document ID.
	ID string `json:"id"`
	// Type is the document type within the module.
	Type string `json:"type"`
	// Module is the source module name.
	Module string `json:"module"`
	// Score is the relevance score from the search engine.
	Score float64 `json:"score"`
	// Title is the human-readable title/snippet.
	Title string `json:"title"`
	// Snippet is a highlighted excerpt from the matched text.
	Snippet string `json:"snippet"`
	// Fields contains all extracted fields from the indexed document.
	Fields map[string]interface{} `json:"fields"`
	// Highlighted contains highlighted field fragments.
	Highlighted map[string]string `json:"highlighted"`
	// CreatedAt is the document creation timestamp.
	CreatedAt time.Time `json:"created_at,omitempty"`
}

// Aggregation holds aggregated statistics for a search.
type Aggregation struct {
	// ModuleCounts maps module name to document count.
	ModuleCounts map[string]int64 `json:"module_counts"`
	// TypeCounts maps document type to count.
	TypeCounts map[string]int64 `json:"type_counts"`
}

// ReindexRequest triggers a full reindex for a module.
type ReindexRequest struct {
	// Module is the module to reindex (empty for all).
	Module string `json:"module"`
}

// ReindexResponse reports reindex progress.
type ReindexResponse struct {
	Module     string `json:"module"`
	TotalDocs  int64  `json:"total_docs"`
	Indexed    int64  `json:"indexed"`
	Failed     int64  `json:"failed"`
	DurationMs int64  `json:"duration_ms"`
	Success    bool   `json:"success"`
	Error      string `json:"error,omitempty"`
}

// IndexerStatus describes the status of a registered indexer.
type IndexerStatus struct {
	Module    string `json:"module"`
	IndexName string `json:"index_name"`
	DocCount  int64  `json:"doc_count"`
	Healthy   bool   `json:"healthy"`
	Error     string `json:"error,omitempty"`
}

// SearchResultStats aggregates search result statistics.
type SearchResultStats struct {
	TotalResults int                 `json:"total_results"`
	ModuleCounts map[string]int      `json:"module_counts"`
	SearchTimeMs int64               `json:"search_time_ms"`
}
