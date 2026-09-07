// Package aireview integrates deterministic local SQL audit with AI-assisted
// semantic review.
//
// The module combines two independent signals:
//   - The deterministic local audit engine (internal/inception/engine) which
//     applies a fixed rule set and never lies, but has limited semantic reach.
//   - An optional LLM review which surfaces issues the rule set cannot catch
//     (index choices, implicit conversions, NULL traps, business-logic
//     mistakes).
//
// Design principles:
//   - AI is optional. When baseURL/apiKey are not configured, or the call
//     fails, the reviewer still returns a local-only result.
//   - AI has a hard timeout (30s default) so reviews never block indefinitely.
//   - Raw SQL is never written to structured logs; only redacted metadata.
//   - Parse errors on LLM JSON return empty suggestions rather than errors,
//     so a malformed model response degrades gracefully.
package aireview

import (
	"time"

	engine "orion/platform-svc-go/internal/inception/engine"
)

// SQLReviewRequest is the input for a SQL review.
type SQLReviewRequest struct {
	// SQL is the statement under review. Required.
	SQL string `json:"sql" binding:"required"`
	// DBType is the SQL dialect (mysql, postgres, tidb, oceanbase, ...).
	// Optional; the local engine defaults to "mysql".
	DBType string `json:"db_type,omitempty"`
	// Context is an optional free-text description of the business purpose
	// of the query. Passed to the LLM to aid semantic judgement.
	Context string `json:"context,omitempty"`
	// ExplainPlan is an optional EXPLAIN output. Passed to the LLM so it can
	// reason about the actual execution plan rather than guessing.
	ExplainPlan string `json:"explain_plan,omitempty"`
}

// SQLReviewResult is the merged output of local + AI review.
type SQLReviewResult struct {
	// ID is the persisted review identifier. Empty when the service was
	// invoked without persistence (e.g. in tests).
	ID string `json:"id,omitempty"`
	// TenantID is the tenant the review belongs to (populated by the service).
	TenantID string `json:"tenant_id,omitempty"`

	// LocalAudit carries the deterministic rule findings. Populated whenever
	// the local engine is wired in; may be nil if the engine errored.
	LocalAudit *engine.AuditReport `json:"local_audit,omitempty"`

	// AISuggestions carries the LLM findings. Empty when AI was skipped or
	// returned no suggestions.
	AISuggestions []AISuggestion `json:"ai_suggestions"`

	// Verdict is one of "safe", "caution", "dangerous", "needs_review".
	Verdict string `json:"verdict"`
	// Score is a 0-100 confidence metric; higher is safer.
	Score int `json:"score"`

	// Meta information.
	ReviewedAt time.Time     `json:"reviewed_at"`
	ModelUsed  string        `json:"model_used,omitempty"`
	Duration   time.Duration `json:"duration"`

	// AIErrors records any non-fatal AI failures (e.g. timeout). Present only
	// when the AI review was attempted but did not complete successfully.
	AIErrors []string `json:"ai_errors,omitempty"`
	// AICalled is true when the AI client was actually invoked. False when
	// AI is not configured or was rate-limited.
	AICalled bool `json:"ai_called"`
}

// AISuggestion is a single LLM finding.
type AISuggestion struct {
	// Category is one of "performance", "security", "correctness", "style".
	// Values outside this set are preserved verbatim for forward compatibility.
	Category string `json:"category"`
	// Severity is one of "info", "warning", "critical".
	Severity string `json:"severity"`
	// Title is a short headline (one line).
	Title string `json:"title"`
	// Description explains the finding in more detail.
	Description string `json:"description"`
	// Suggestion describes the recommended remediation.
	Suggestion string `json:"suggestion"`
	// FixedSQL is an optional proposed rewrite of the SQL.
	FixedSQL string `json:"fixed_sql,omitempty"`
}

// Verdict constants.
const (
	VerdictSafe        = "safe"
	VerdictCaution     = "caution"
	VerdictDangerous   = "dangerous"
	VerdictNeedsReview = "needs_review"
)

// Severity constants.
const (
	SeverityInfo     = "info"
	SeverityWarning  = "warning"
	SeverityCritical = "critical"
)

// Category constants.
const (
	CategoryPerformance  = "performance"
	CategorySecurity     = "security"
	CategoryCorrectness  = "correctness"
	CategoryStyle        = "style"
)

// ReviewRecord is the persistence record for review history.
type ReviewRecord struct {
	ID           string    `json:"id" db:"id"`
	TenantID     string    `json:"tenant_id" db:"tenant_id"`
	SQL          string    `json:"sql" db:"sql_text"`
	DBType       string    `json:"db_type" db:"db_type"`
	Verdict      string    `json:"verdict" db:"verdict"`
	Score        int       `json:"score" db:"score"`
	ModelUsed    string    `json:"model_used" db:"model_used"`
	DurationMs   int64     `json:"duration_ms" db:"duration_ms"`
	LocalAudit   string    `json:"local_audit,omitempty" db:"local_audit"`
	AISuggestions string   `json:"ai_suggestions,omitempty" db:"ai_suggestions"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}
