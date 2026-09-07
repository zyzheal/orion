// Package advisor generates concrete optimization recommendations by
// combining signals from slowquery (call count, total time), explain
// (scan type, rows), and schema introspection (existing indexes).
//
// The primary surface today is IndexAdvisor — takes a target table and
// returns a list of CREATE INDEX statements, ranked by expected impact.
// Each recommendation cites the evidence that produced it.
package advisor

import "time"

// ---- Index suggestion ----

// IndexSuggestion is one proposed index. Columns is in order; where
// is optional (partial index predicate). Reason is the human-readable
// rationale; Evidence links back to the slow query / explain nodes
// that triggered the suggestion.
type IndexSuggestion struct {
	Table    string   `json:"table"`
	Columns  []string `json:"columns"`
	Where    string   `json:"where,omitempty"`
	Kind     string   `json:"kind"` // "btree" | "btree_partial" | "gin" | "gist"
	DBType   string   `json:"db_type"`
	SQL      string   `json:"sql"`
	Reason   string   `json:"reason"`
	Evidence []string `json:"evidence"`
	Impact   float64  `json:"impact"` // heuristic score, higher = better
}

// ---- Suggestion request ----

type SuggestIndexesRequest struct {
	DataSourceID string   `json:"data_source_id" binding:"required"`
	DBType       string   `json:"db_type"` // "postgres" | "mysql"
	Schema       string   `json:"schema"`  // optional; defaults to data source's database
	Tables       []string `json:"tables"`  // optional; when empty, infer from slow queries
}

// ---- Suggestion result ----

type SuggestIndexesResult struct {
	DataSourceID string           `json:"data_source_id"`
	DBType       string           `json:"db_type"`
	Schema       string           `json:"schema"`
	Suggestions  []IndexSuggestion `json:"suggestions"`
	AnalyzedAt   time.Time        `json:"analyzed_at"`
}

// ---- Existing index inventory ----

// ExistingIndex is a row from the schema introspection query.
type ExistingIndex struct {
	Name    string   `json:"name"`
	Table   string   `json:"table"`
	Columns []string `json:"columns"`
	Unique  bool     `json:"unique"`
}
