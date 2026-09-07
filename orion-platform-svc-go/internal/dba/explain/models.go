// Package explain fetches and interprets database execution plans.
// It unifies PostgreSQL's text-format EXPLAIN (and EXPLAIN ANALYZE)
// with MySQL's JSON-format EXPLAIN into a single ExplainNode tree,
// then runs a small set of rule-based suggestions on top of that tree
// so DBAs get actionable hints instead of a wall of unformatted text.
package explain

import "time"

// ExplainNode is one row of a parsed plan. Children is empty for leaf
// nodes (tables, indexes, function calls). Cost is nil when the engine
// did not produce one (MySQL JSON sometimes omits it).
type ExplainNode struct {
	NodeType  string          `json:"node_type"`
	Relation  string          `json:"relation,omitempty"`
	Index     string          `json:"index,omitempty"`
	ScanType  string          `json:"scan_type,omitempty"` // "Seq" | "Index" | "Bitmap" | ""
	Cost      *PlanCost       `json:"cost,omitempty"`
	Rows      *int64          `json:"rows,omitempty"`
	TimeMs    *float64        `json:"actual_time_ms,omitempty"`
	Children  []ExplainNode   `json:"children,omitempty"`
	Raw       string          `json:"raw"`
}

// PlanCost mirrors PG's cost=... line. Total is the sum, Start is the
// startup portion, Start+Run ≈ the total.
type PlanCost struct {
	Start float64 `json:"start"`
	Run   float64 `json:"run"`
	Total float64 `json:"total"`
}

// ExplainResult is the full response of AnalyzePlan. PlanText keeps
// the raw engine output for debugging; Plan is the parsed tree.
type ExplainResult struct {
	SQL       string      `json:"sql"`
	DBType    string      `json:"db_type"`
	PlanText  string      `json:"plan_text"`
	Plan      ExplainNode `json:"plan"`
	Suggestions []Suggestion `json:"suggestions"`
	Passed    bool        `json:"passed"`
	DurationMs int64      `json:"duration_ms"`
	AnalyzedAt time.Time  `json:"analyzed_at"`
}

// Suggestion is one optimization hint. The severity set matches the
// slowquery module (critical/high/medium/low/info) so frontends can
// share the same color mapping.
type Suggestion struct {
	Category    string `json:"category"`
	Severity    string `json:"severity"`
	Title       string `json:"title"`
	Description string `json:"description"`
	NodeID      string `json:"node_id,omitempty"` // which node in Plan caused this
}

// ExplainRequest submits one SQL for EXPLAIN. Analyze (default true)
// also runs the heuristic suggestions; set false to only fetch the
// raw plan.
type ExplainRequest struct {
	SQL          string `json:"sql" binding:"required"`
	DataSourceID string `json:"data_source_id" binding:"required"`
	DBType       string `json:"db_type"`       // "postgres" | "mysql"
	Schema       string `json:"schema"`
	Analyze      bool   `json:"analyze"`       // run EXPLAIN ANALYZE instead of EXPLAIN
}

// ExplainJob is the persisted row in dba_explain_history. Kept short —
// full plans can be several KB and belong in the raw plan_text field.
type ExplainJob struct {
	ID           string    `json:"id" db:"id"`
	TenantID     string    `json:"tenant_id" db:"tenant_id"`
	DataSourceID string    `json:"data_source_id" db:"data_source_id"`
	DBType       string    `json:"db_type" db:"db_type"`
	SQL          string    `json:"sql" db:"sql"`
	PlanText     string    `json:"plan_text" db:"plan_text"`
	Passed       bool      `json:"passed" db:"passed"`
	DurationMs   int64     `json:"duration_ms" db:"duration_ms"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}
