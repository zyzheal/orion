package models

import "time"

// AuditRuleDef is the persisted form of a user-configurable SQL audit rule.
//
// Rules are stored as JSONB payloads in the dba_audit_rules table so new
// rules can be added via an admin UI without a service redeploy.
//
// Field semantics:
//   - ID: stable, unique identifier referenced by audit findings.
//   - Name: human-readable label for UIs.
//   - Severity: one of "error" (block execution) / "warn" (block unless
//     AllowWarnings=true) / "info" (advisory only).
//   - Pattern: Go regexp syntax; empty when the rule is implemented as
//     custom logic (e.g. row-count threshold).
//   - Message: violation message rendered into AuditResult.Message.
//   - Fix: template string for a suggested rewrite (empty when no fix).
//   - Params: free-form JSONB for rule-specific thresholds such as
//     max_rows, max_duration, whitelist_databases.
//   - DBTypes: optional filter of database dialects (mysql/postgres/…).
//     Empty means the rule applies to all dialects.
//   - Enabled: whether the rule is active.
//   - BuiltIn: whether the rule ships with the engine (built-ins are
//     shipped as defaults and can be disabled/overridden via this table).
type AuditRuleDef struct {
	ID        string            `db:"id" json:"id"`
	Name      string            `db:"name" json:"name"`
	Severity  string            `db:"severity" json:"severity"` // error / warn / info
	Pattern   string            `db:"pattern" json:"pattern"`
	Message   string            `db:"message" json:"message"`
	Fix       string            `db:"fix" json:"fix,omitempty"`
	Params    JSONB             `db:"params" json:"params,omitempty"`
	DBTypes   []string          `db:"db_types" json:"db_types,omitempty"`
	Enabled   bool              `db:"enabled" json:"enabled"`
	BuiltIn   bool              `db:"built_in" json:"built_in"`
	CreatedAt time.Time         `db:"created_at" json:"created_at"`
	UpdatedAt time.Time         `db:"updated_at" json:"updated_at"`
}

// AuditSeverity is the enum of valid severity strings.
const (
	AuditSeverityError = "error"
	AuditSeverityWarn  = "warn"
	AuditSeverityInfo  = "info"
)

// IsErrorSeverity reports whether the rule's severity blocks execution.
func (r *AuditRuleDef) IsErrorSeverity() bool {
	return r.Severity == AuditSeverityError
}

// IsWarnSeverity reports whether the rule's severity is a warning.
func (r *AuditRuleDef) IsWarnSeverity() bool {
	return r.Severity == AuditSeverityWarn
}

// MatchesDBType returns true when the rule applies to the given dialect.
// An empty DBTypes slice means the rule applies to all dialects.
func (r *AuditRuleDef) MatchesDBType(dbType string) bool {
	if len(r.DBTypes) == 0 {
		return true
	}
	for _, t := range r.DBTypes {
		if t == "" || t == dbType {
			return true
		}
	}
	return false
}

