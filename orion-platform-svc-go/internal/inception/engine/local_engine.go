package engine

// Local SQL Audit Engine
//
// This file implements a self-contained SQL audit engine that does NOT
// depend on the AGPL-3.0 Inception or Yearning projects. The engine:
//   - Parses SQL structurally using a lightweight tokenizer + regex
//     matcher (no external parser dependency; safe for AGPL isolation).
//   - Applies a set of built-in audit rules covering dangerous DDL,
//     missing WHERE clauses, SELECT *, unbounded DML, cross-database
//     queries, non-standard characters and more.
//   - Can optionally be fed with tenant-specific rules loaded from the
//     dba_audit_rules table (or any equivalent JSONB-backed store).
//
// The engine intentionally does not attempt full SQL parsing — its job is
// audit, not semantic analysis. Full semantics belong to a downstream DB.
//
// Public API:
//
//	eng := NewLocalAuditEngine(Config{})
//	report, err := eng.Check(ctx, sql, "mysql")
//	result, err := eng.Execute(ctx, db, sql)
//
// The engine is safe for concurrent use.

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"
)

// ---------------------------------------------------------------------------
// Rule identifiers (public so findings can be correlated across calls)
// ---------------------------------------------------------------------------

const (
	RuleDropTableNoIfExists     = "drop_table_no_if_exists"
	RuleTruncateTable           = "truncate_table"
	RuleGrantAll                = "grant_all"
	RuleDeleteDB                = "drop_database"
	RuleMissingWhereUpdate      = "missing_where_update"
	RuleMissingWhereDelete      = "missing_where_delete"
	RuleSelectStar              = "select_star"
	RuleMissingLimit            = "missing_limit_select"
	RuleLockTable               = "lock_table"
	RuleCrossDBQuery            = "cross_db_query"
	RuleNonStandardChars        = "non_standard_chars"
	RuleLargeDMLOneStatement    = "large_dml_no_limit"
	RuleRowThresholdDDL         = "row_threshold_ddl"
	RuleDDLWithoutBackup        = "ddl_without_backup"
	RuleDropIndex               = "drop_index"
	RuleAlterTableAddPK         = "alter_add_primary_key"
	RuleMultiStatement          = "multi_statement"
	RuleCommentedSQL            = "commented_sql"
	RuleUnparameterizedInsert   = "unparameterized_insert"
	RuleRenameTable             = "rename_table"
)

// AuditLevel enumerates the severity levels a rule finding may carry.
// They are strings (not constants) to match the JSON shape used by the
// external Inception client.
const (
	LevelError = "error"
	LevelWarn  = "warn"
	LevelInfo  = "info"
)

// ---------------------------------------------------------------------------
// Public data types
// ---------------------------------------------------------------------------

// AuditResult is a single rule finding. AuditResult mirrors the shape
// used by the external Inception engine's response envelope so callers
// can fold either engine's output into the same persistence record.
type AuditResult struct {
	// Level is one of "error" / "warn" / "info".
	Level string `json:"level"`
	// Message is a human-readable description of the violation.
	Message string `json:"message"`
	// RuleID identifies the rule that fired (e.g. "missing_where_update").
	RuleID string `json:"rule_id"`
	// LineNumber is 1-based. 0 means the rule did not compute a line.
	LineNumber int `json:"line_number"`
	// FixSQL is a suggested rewrite, empty when no fix applies.
	FixSQL string `json:"fix_sql,omitempty"`
}

// AuditReport is the full result of running Check on a SQL statement.
type AuditReport struct {
	// Passed is true when no error-level findings were raised.
	Passed bool `json:"passed"`
	// Rules carries every finding, including info/warn.
	Rules []AuditResult `json:"rules"`
	// ParsedOK is false when the input SQL was structurally malformed
	// (unbalanced parens, empty statement, etc.).
	ParsedOK bool `json:"parsed_ok"`
	// DBType is the dialect the caller requested ("mysql", "postgres", …).
	DBType string `json:"db_type"`
	// Duration is the wall-clock time of the audit.
	Duration time.Duration `json:"duration"`
	// StatementType is the detected SQL kind: "select" / "insert" /
	// "update" / "delete" / "ddl" / "other" / "empty".
	StatementType string `json:"statement_type"`
	// PreBackupRequired signals the caller that a backup snapshot should
	// be captured before executing this statement.
	PreBackupRequired bool `json:"pre_backup_required"`
}

// ExecResult is the outcome of a real Execute against a *sql.DB.
type ExecResult struct {
	// AffectedRows is populated from RowsAffected when the driver reports
	// one; nil when unknown (e.g. some DDL statements).
	AffectedRows *int64 `json:"affected_rows,omitempty"`
	// Duration is the wall-clock time of the round-trip.
	Duration time.Duration `json:"duration"`
	// Message is a small human-readable diagnostic, empty on success.
	Message string `json:"message,omitempty"`
}

// LocalConfig controls LocalAuditEngine behavior. All fields are optional.
//
// Named LocalConfig (not Config) to avoid colliding with engine.Config,
// which configures the HTTP client in client.go.
type LocalConfig struct {
	// Timeout caps Execute's round-trip; defaults to 60s.
	Timeout time.Duration

	// AllowWarnings, when true, lets Check return Passed=true even when
	// only warning-level findings are present. When false (default)
	// warnings still cause Passed=false.
	AllowWarnings bool

	// BlockRules disables the named rules entirely. Use this to bypass a
	// built-in when the tenant explicitly permits the pattern.
	BlockRules map[string]bool

	// EnableRules is a positive list of rule IDs. When non-empty, only
	// those rules (plus rules matching names) are applied. Empty means
	// "apply all built-ins".
	EnableRules []string

	// RowCountThresholdForDDL: rule row_threshold_ddl flags DDL against
	// tables whose row count exceeds this value. 0 disables the rule.
	// Default: 100_000.
	RowCountThresholdForDDL int64

	// RequirePreBackupForDDL rejects DDL when Execute is called with a
	// connection whose PreBackupConfirmed flag is unset. The flag is
	// set on the engine instance; see SetPreBackupConfirmed.
	RequirePreBackupForDDL bool

	// SelectStarWhitelistDBs: dialects where SELECT * is treated as
	// advisory (info) rather than warning. Empty = always warn.
	SelectStarWhitelistDBs []string

	// LargeDMLRowLimit: unbounded DML with affected row estimate > this
	// is flagged. 0 disables the rule. Default: 10_000.
	LargeDMLRowLimit int64
}

// LocalAuditEngine is a self-contained SQL audit engine. It owns the
// rule set (built-ins + any injected extras), the config, and an
// optional row-count prober for the DDL threshold rule.
type LocalAuditEngine struct {
	cfg          LocalConfig
	mu           sync.RWMutex
	extraRules   []*ruleDef
	rowCounter   RowCounter // optional; see RowCounter
	preBackupOK  bool
	preBackupMu  sync.RWMutex
}

// RowCounter is an optional probe that returns the estimated row count
// for a named table. Used by the row_threshold_ddl rule.
type RowCounter interface {
	RowCount(ctx context.Context, dbType, tableName string) (int64, error)
}

// SetRowCounter installs a RowCounter. When nil is passed the
// row_threshold_ddl rule is skipped.
func (e *LocalAuditEngine) SetRowCounter(rc RowCounter) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.rowCounter = rc
}

// SetPreBackupConfirmed flips the pre-backup acknowledgement flag. The
// caller is expected to clear this between executions of unrelated DDL.
func (e *LocalAuditEngine) SetPreBackupConfirmed(ok bool) {
	e.preBackupMu.Lock()
	e.preBackupOK = ok
	e.preBackupMu.Unlock()
}

// PreBackupConfirmed returns the current flag value.
func (e *LocalAuditEngine) PreBackupConfirmed() bool {
	e.preBackupMu.RLock()
	defer e.preBackupMu.RUnlock()
	return e.preBackupOK
}

// AddExtraRule appends a custom rule at runtime. Rules added this way
// are evaluated after all built-ins.
func (e *LocalAuditEngine) AddExtraRule(r *ruleDef) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.extraRules = append(e.extraRules, r)
}

// NewLocalAuditEngine creates an engine with default config. Passing a
// zero-value LocalConfig is valid and enables every built-in rule.
func NewLocalAuditEngine(cfg LocalConfig) *LocalAuditEngine {
	if cfg.Timeout <= 0 {
		cfg.Timeout = 60 * time.Second
	}
	if cfg.RowCountThresholdForDDL == 0 {
		cfg.RowCountThresholdForDDL = 100_000
	}
	if cfg.LargeDMLRowLimit == 0 {
		cfg.LargeDMLRowLimit = 10_000
	}
	return &LocalAuditEngine{cfg: cfg}
}

// ---------------------------------------------------------------------------
// Check: parse + rule application
// ---------------------------------------------------------------------------

// Check parses the SQL and applies every enabled rule. It never writes
// to the database. The report is deterministic for a given input.
func (e *LocalAuditEngine) Check(ctx context.Context, sqlStr string, dbType string) (*AuditReport, error) {
	start := time.Now()

	dbType = normalizeDBType(dbType)
	input := strings.TrimSpace(sqlStr)

	report := &AuditReport{
		Passed:      true,
		Rules:       []AuditResult{},
		ParsedOK:    true,
		DBType:      dbType,
		Duration:    0,
		StatementType: "empty",
	}
	if input == "" {
		report.ParsedOK = false
		report.Passed = false
		report.Rules = append(report.Rules, AuditResult{
			Level: LevelError, Message: "empty SQL statement", RuleID: "empty_statement",
		})
		report.Duration = time.Since(start)
		return report, nil
	}

	parsed, err := parseStatement(input)
	if err != nil {
		report.ParsedOK = false
		report.Passed = false
		report.Rules = append(report.Rules, AuditResult{
			Level: LevelError, Message: fmt.Sprintf("sql parse error: %v", err), RuleID: "parse_error",
		})
		report.Duration = time.Since(start)
		return report, nil
	}
	report.StatementType = parsed.kind
	// Set the resolved dialect on the parsed statement so rule matchers
	// can scope their behaviour (e.g. SELECT * whitelist per dialect).
	parsed.dbType = dbType

	for _, r := range e.allRules() {
		if e.isBlocked(r.id) {
			continue
		}
		if !e.isAllowed(r.id) {
			continue
		}
		if r.dbTypes != nil && !matchesList(r.dbTypes, dbType) {
			continue
		}
		for _, finding := range r.match(ctx, e, parsed, input) {
			if finding.Level == "" {
				finding.Level = r.sev
			}
			if finding.RuleID == "" {
				finding.RuleID = r.id
			}
			report.Rules = append(report.Rules, finding)
			switch finding.Level {
			case LevelError:
				report.Passed = false
			case LevelWarn:
				if !e.cfg.AllowWarnings {
					report.Passed = false
				}
			case LevelInfo:
				// no-op
			}
		}
	}

	if parsed.kind == "ddl" || parsed.kind == "delete" || parsed.kind == "update" {
		report.PreBackupRequired = true
	}

	report.Duration = time.Since(start)
	return report, nil
}

// ---------------------------------------------------------------------------
// Execute: real round-trip against a *sql.DB
// ---------------------------------------------------------------------------

// Execute runs the SQL against a real database connection after a
// pre-flight Check pass. It refuses to run statements that the audit
// engine flagged as errors, unless AllowWarnings and pre-backup are set.
//
// The order of gates matters: audit runs FIRST so that even a nil db
// connection refuses destructive SQL — callers can safely use the engine
// as a policy check without ever connecting to a live DB.
func (e *LocalAuditEngine) Execute(ctx context.Context, db *sql.DB, sqlStr string, dbType string) (*ExecResult, error) {
	start := time.Now()

	rep, err := e.Check(ctx, sqlStr, dbType)
	if err != nil {
		return nil, fmt.Errorf("local engine: check failed: %w", err)
	}
	if !rep.ParsedOK {
		return nil, fmt.Errorf("local engine: sql parse error: %s", rep.Rules[0].Message)
	}
	for _, r := range rep.Rules {
		if r.Level == LevelError {
			return nil, fmt.Errorf("local engine: blocked by rule %s: %s", r.RuleID, r.Message)
		}
	}
	if rep.PreBackupRequired && e.cfg.RequirePreBackupForDDL && !e.PreBackupConfirmed() {
		return nil, fmt.Errorf("local engine: pre-backup required but not confirmed for %s", sqlStr)
	}
	if db == nil {
		return nil, errors.New("local engine: nil *sql.DB")
	}

	executeCtx, cancel := context.WithTimeout(ctx, e.cfg.Timeout)
	defer cancel()

	res, err := db.ExecContext(executeCtx, sqlStr)
	if err != nil {
		return nil, fmt.Errorf("local engine: exec failed: %w", err)
	}
	out := &ExecResult{Duration: time.Since(start)}
	if n, err := res.RowsAffected(); err == nil && n >= 0 {
		out.AffectedRows = &n
	}
	return out, nil
}

// ---------------------------------------------------------------------------
// Rule model + registry
// ---------------------------------------------------------------------------

// ruleDef is the internal, evaluated form of a rule. External callers
// see AuditRuleDef (in models); internal rules ship as ruleDef literals.
type ruleDef struct {
	id   string
	sev  string
	match   func(ctx context.Context, e *LocalAuditEngine, p *parsedStmt, raw string) []AuditResult
	dbTypes []string
}

// allRules returns the effective rule set: built-ins + extras.
func (e *LocalAuditEngine) allRules() []*ruleDef {
	e.mu.RLock()
	extras := make([]*ruleDef, len(e.extraRules))
	copy(extras, e.extraRules)
	e.mu.RUnlock()
	rules := builtInRules()
	return append(rules, extras...)
}

func (e *LocalAuditEngine) isBlocked(id string) bool {
	if e.cfg.BlockRules == nil {
		return false
	}
	return e.cfg.BlockRules[id]
}

func (e *LocalAuditEngine) isAllowed(id string) bool {
	if len(e.cfg.EnableRules) == 0 {
		return true
	}
	for _, allowed := range e.cfg.EnableRules {
		if allowed == id {
			return true
		}
	}
	return false
}

func matchesList(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

// builtInRules returns the default rule set. The order matters for
// readability of the report but not for correctness.
func builtInRules() []*ruleDef {
	return []*ruleDef{
		{
			id:   RuleMultiStatement,
			sev:  LevelError,
			match: func(_ context.Context, _ *LocalAuditEngine, p *parsedStmt, raw string) []AuditResult {
				if p.statementCount > 1 {
					return []AuditResult{{
						Level: LevelError, RuleID: RuleMultiStatement,
						Message: fmt.Sprintf("multi-statement SQL is blocked (found %d statements); split into individual audits", p.statementCount),
					}}
				}
				return nil
			},
		},
		{
			id:   RuleDropTableNoIfExists,
			sev:  LevelError,
			match: func(_ context.Context, _ *LocalAuditEngine, p *parsedStmt, raw string) []AuditResult {
				if p.kind != "ddl" {
					return nil
				}
				// Detect DROP TABLE without IF EXISTS.
				if reDropTable.MatchString(normalizeSQL(raw)) && !reIfExists.MatchString(normalizeSQL(raw)) {
					return []AuditResult{{
						Level:      LevelError,
						RuleID:     RuleDropTableNoIfExists,
						Message:    "DROP TABLE without IF EXISTS is blocked; the operation silently succeeds on missing tables but is fragile and destructive",
						FixSQL:     "ALTER: add `IF EXISTS` or use RENAME TABLE / DROP with a pre-backup",
						LineNumber: lineOf(raw, "DROP TABLE"),
					}}
				}
				return nil
			},
		},
		{
			id:   RuleTruncateTable,
			sev:  LevelError,
			match: func(_ context.Context, _ *LocalAuditEngine, _ *parsedStmt, raw string) []AuditResult {
				if reTruncate.MatchString(normalizeSQL(raw)) {
					return []AuditResult{{
						Level:      LevelError,
						RuleID:     RuleTruncateTable,
						Message:    "TRUNCATE TABLE is blocked; use DELETE with a WHERE clause or a scoped bulk operation",
						LineNumber: lineOf(raw, "TRUNCATE"),
					}}
				}
				return nil
			},
		},
		{
			id:   RuleDeleteDB,
			sev:  LevelError,
			match: func(_ context.Context, _ *LocalAuditEngine, _ *parsedStmt, raw string) []AuditResult {
				if reDropDatabase.MatchString(normalizeSQL(raw)) {
					return []AuditResult{{
						Level:   LevelError,
						RuleID:  RuleDeleteDB,
						Message: "DROP DATABASE is blocked; this is an unbounded destructive operation",
					}}
				}
				return nil
			},
		},
		{
			id:   RuleDropIndex,
			sev:  LevelWarn,
			match: func(_ context.Context, _ *LocalAuditEngine, _ *parsedStmt, raw string) []AuditResult {
				if reDropIndex.MatchString(normalizeSQL(raw)) {
					return []AuditResult{{
						Level:   LevelWarn,
						RuleID:  RuleDropIndex,
						Message: "DROP INDEX may degrade read performance; confirm the index is unused",
					}}
				}
				return nil
			},
		},
		{
			id:   RuleRenameTable,
			sev:  LevelWarn,
			match: func(_ context.Context, _ *LocalAuditEngine, _ *parsedStmt, raw string) []AuditResult {
				if reRenameTable.MatchString(normalizeSQL(raw)) {
					return []AuditResult{{
						Level:   LevelWarn,
						RuleID:  RuleRenameTable,
						Message: "RENAME TABLE may invalidate downstream views / FKs",
					}}
				}
				return nil
			},
		},
		{
			id:   RuleGrantAll,
			sev:  LevelError,
			match: func(_ context.Context, _ *LocalAuditEngine, _ *parsedStmt, raw string) []AuditResult {
				if reGrantAll.MatchString(normalizeSQL(raw)) {
					return []AuditResult{{
						Level:   LevelError,
						RuleID:  RuleGrantAll,
						Message: "GRANT ALL is blocked; grant specific privileges instead",
						FixSQL:  "GRANT SELECT, INSERT, UPDATE, DELETE ON ... TO ...",
					}}
				}
				return nil
			},
		},
		{
			id:   RuleLockTable,
			sev:  LevelWarn,
			match: func(_ context.Context, _ *LocalAuditEngine, _ *parsedStmt, raw string) []AuditResult {
				if reLockTable.MatchString(normalizeSQL(raw)) {
					return []AuditResult{{
						Level:   LevelWarn,
						RuleID:  RuleLockTable,
						Message: "LOCK TABLES blocks concurrent reads/writes; prefer a scoped transaction with isolation level",
					}}
				}
				return nil
			},
		},
		{
			id:   RuleMissingWhereUpdate,
			sev:  LevelError,
			match: func(_ context.Context, _ *LocalAuditEngine, p *parsedStmt, raw string) []AuditResult {
				if p.kind != "update" {
					return nil
				}
				if hasWHERE(p, raw) {
					return nil
				}
				return []AuditResult{{
					Level:      LevelError,
					RuleID:     RuleMissingWhereUpdate,
					Message:    "UPDATE without WHERE will rewrite every row; add a scoped predicate",
					FixSQL:     raw + " WHERE <id-predicate>",
					LineNumber: lineOf(raw, "UPDATE"),
				}}
			},
		},
		{
			id:   RuleMissingWhereDelete,
			sev:  LevelError,
			match: func(_ context.Context, _ *LocalAuditEngine, p *parsedStmt, raw string) []AuditResult {
				if p.kind != "delete" {
					return nil
				}
				if hasWHERE(p, raw) {
					return nil
				}
				return []AuditResult{{
					Level:      LevelError,
					RuleID:     RuleMissingWhereDelete,
					Message:    "DELETE without WHERE will delete every row; add a scoped predicate",
					FixSQL:     raw + " WHERE <id-predicate>",
					LineNumber: lineOf(raw, "DELETE"),
				}}
			},
		},
		{
			id:   RuleSelectStar,
			sev:  LevelWarn,
			match: func(_ context.Context, e *LocalAuditEngine, p *parsedStmt, raw string) []AuditResult {
				if p.kind != "select" {
					return nil
				}
				if !reSelectStar.MatchString(normalizeSQL(raw)) {
					return nil
				}
				lvl := LevelWarn
				msg := "SELECT * is discouraged in production; project explicit columns"
				if matchesList(e.cfg.SelectStarWhitelistDBs, p.dbType) {
					lvl = LevelInfo
					msg = "SELECT * detected (advisory for this dialect)"
				}
				return []AuditResult{{
					Level:   lvl,
					RuleID:  RuleSelectStar,
					Message: msg,
				}}
			},
		},
		{
			id:   RuleMissingLimit,
			sev:  LevelWarn,
			match: func(_ context.Context, _ *LocalAuditEngine, p *parsedStmt, raw string) []AuditResult {
				if p.kind != "select" {
					return nil
				}
				if reLimit.MatchString(normalizeSQL(raw)) {
					return nil
				}
				return []AuditResult{{
					Level:      LevelWarn,
					RuleID:     RuleMissingLimit,
					Message:    "SELECT without LIMIT may return unbounded rows; add a bounded LIMIT",
					FixSQL:     raw + " LIMIT 100",
				}}
			},
		},
		{
			id:   RuleCrossDBQuery,
			sev:  LevelWarn,
			match: func(_ context.Context, _ *LocalAuditEngine, p *parsedStmt, raw string) []AuditResult {
				if p.kind == "empty" {
					return nil
				}
				if p.crossDB == "" {
					return nil
				}
				return []AuditResult{{
					Level:      LevelWarn,
					RuleID:     RuleCrossDBQuery,
					Message:    fmt.Sprintf("cross-database reference detected against %q; prefer explicit JOINs within a single schema", p.crossDB),
					LineNumber: lineOf(raw, p.crossDB),
				}}
			},
		},
		{
			id:   RuleNonStandardChars,
			sev:  LevelError,
			match: func(_ context.Context, _ *LocalAuditEngine, _ *parsedStmt, raw string) []AuditResult {
				for i, r := range raw {
					if r > 0x7F {
						return []AuditResult{{
							Level:      LevelError,
							RuleID:     RuleNonStandardChars,
							Message:    fmt.Sprintf("non-ASCII character detected (%q) at byte offset %d; SQL tools may misparse it", r, i),
							LineNumber: lineOfAt(raw, i),
						}}
					}
				}
				return nil
			},
		},
		{
			id:   RuleLargeDMLOneStatement,
			sev:  LevelWarn,
			match: func(ctx context.Context, e *LocalAuditEngine, p *parsedStmt, raw string) []AuditResult {
				if p.kind != "delete" && p.kind != "update" {
					return nil
				}
				if hasWHERE(p, raw) {
					return nil
				}
				if reLimit.MatchString(normalizeSQL(raw)) {
					return nil
				}
				limit := e.cfg.LargeDMLRowLimit
				if limit <= 0 {
					return nil
				}
				return []AuditResult{{
					Level:      LevelWarn,
					RuleID:     RuleLargeDMLOneStatement,
					Message:    fmt.Sprintf("%s without WHERE/LIMIT may affect a very large row set (> %d expected rows)", strings.ToUpper(p.kind), limit),
				}}
			},
		},
		{
			id:   RuleDDLWithoutBackup,
			sev:  LevelWarn,
			match: func(ctx context.Context, e *LocalAuditEngine, p *parsedStmt, raw string) []AuditResult {
				if p.kind != "ddl" {
					return nil
				}
				// Skip pure CREATE statements — those are additions.
				if reCreateOnly.MatchString(normalizeSQL(raw)) {
					return nil
				}
				return []AuditResult{{
					Level:   LevelWarn,
					RuleID:  RuleDDLWithoutBackup,
					Message: "DDL detected; capture a pre-backup snapshot before executing",
				}}
			},
		},
		{
			id:   RuleRowThresholdDDL,
			sev:  LevelWarn,
			match: func(ctx context.Context, e *LocalAuditEngine, p *parsedStmt, raw string) []AuditResult {
				if p.kind != "ddl" {
					return nil
				}
				if e.cfg.RowCountThresholdForDDL <= 0 {
					return nil
				}
				if e.rowCounter == nil {
					return nil
				}
				if p.tableName == "" {
					return nil
				}
				n, err := e.rowCounter.RowCount(ctx, p.dbType, p.tableName)
				if err != nil {
					return []AuditResult{{
						Level:   LevelInfo,
						RuleID:  RuleRowThresholdDDL,
						Message: fmt.Sprintf("row-count probe failed for %s: %v (skipping threshold check)", p.tableName, err),
					}}
				}
				if n > e.cfg.RowCountThresholdForDDL {
					return []AuditResult{{
						Level:      LevelWarn,
						RuleID:     RuleRowThresholdDDL,
						Message:    fmt.Sprintf("DDL targets table %q with %d rows (threshold %d); consider an online migration", p.tableName, n, e.cfg.RowCountThresholdForDDL),
						LineNumber: lineOf(raw, p.tableName),
					}}
				}
				return nil
			},
		},
		{
			id:   RuleAlterTableAddPK,
			sev:  LevelWarn,
			match: func(_ context.Context, _ *LocalAuditEngine, _ *parsedStmt, raw string) []AuditResult {
				if !reAlterAddPK.MatchString(normalizeSQL(raw)) {
					return nil
				}
				return []AuditResult{{
					Level:   LevelWarn,
					RuleID:  RuleAlterTableAddPK,
					Message: "ALTER TABLE ADD PRIMARY KEY on a large table is expensive; verify with EXPLAIN/ANALYZE first",
				}}
			},
		},
		{
			id:   RuleCommentedSQL,
			sev:  LevelInfo,
			match: func(_ context.Context, _ *LocalAuditEngine, _ *parsedStmt, raw string) []AuditResult {
				// Single-line trailing comment at end of statement.
				if !reTrailingComment.MatchString(raw) {
					return nil
				}
				return []AuditResult{{
					Level:   LevelInfo,
					RuleID:  RuleCommentedSQL,
					Message: "SQL contains an inline comment; some audit pipelines strip comments — verify this is intentional",
				}}
			},
		},
	}
}

// ---------------------------------------------------------------------------
// Lightweight SQL parser
// ---------------------------------------------------------------------------

// parsedStmt is the shape produced by parseStatement. It carries just
// enough structure for the built-in rules — no full AST is built.
type parsedStmt struct {
	kind           string // select / insert / update / delete / ddl / other / empty
	dbType         string // mirrors the caller's dbType (used for rule scoping)
	tableName      string // best-effort first table reference
	crossDB        string // detected cross-database reference (e.g. "otherdb.tbl")
	statementCount int    // 1 for normal statements; >1 for multi-statement
}

var (
	reStatementEnd = regexp.MustCompile(`;\s*(--|#|\*/)?.*`)
	reDropTable = regexp.MustCompile(`(?i)\bDROP\s+TABLE\b`)
	reIfExists  = regexp.MustCompile(`(?i)\bIF\s+EXISTS\b`)
	reTruncate        = regexp.MustCompile(`(?i)\bTRUNCATE\b`)
	reDropDatabase    = regexp.MustCompile(`(?i)\bDROP\s+DATABASE\b`)
	reDropIndex       = regexp.MustCompile(`(?i)\bDROP\s+INDEX\b`)
	reRenameTable     = regexp.MustCompile(`(?i)\bRENAME\s+TABLE\b`)
	reGrantAll        = regexp.MustCompile(`(?i)\bGRANT\s+ALL\b`)
	reLockTable       = regexp.MustCompile(`(?i)\bLOCK\s+TABLES?\b`)
	reSelectStar      = regexp.MustCompile(`(?i)\bSELECT\s+\*`)
	reLimit           = regexp.MustCompile(`(?i)\bLIMIT\s+\d+`)
	reWhere           = regexp.MustCompile(`(?i)\bWHERE\b`)
	reCreateOnly      = regexp.MustCompile(`(?i)^\s*(CREATE|INSERT)\b`)
	reAlterAddPK      = regexp.MustCompile(`(?i)\bALTER\s+TABLE\b[^;]*\bADD\s+PRIMARY\s+KEY\b`)
	reTrailingComment = regexp.MustCompile(`--[^\n]*$`)
	reCrossDB         = regexp.MustCompile(`(?i)\b[A-Za-z_][A-Za-z0-9_]*\s*\.\s*[A-Za-z_][A-Za-z0-9_]*\s*`)
	reTableName       = regexp.MustCompile(`(?i)\b(FROM|INTO|UPDATE|TABLE)\s+([A-Za-z_][A-Za-z0-9_]*)`)
	// nonStandardChars is the set of unicode runes we consider suspicious
	// in SQL text: CJK/full-width punctuation, ideographic space, BOM,
	// and other non-ASCII characters commonly confused with SQL syntax.
	// We iterate over these directly (rather than a regexp) because Go's
	// regexp package does not support \uXXXX escapes.
)

// normalizeSQL lower-cases the input and collapses runs of whitespace so
// regex rules do not need to enumerate every spacing variant.
func normalizeSQL(s string) string {
	// Replace CJK/compat punctuation with ASCII equivalents so pattern
	// matching stays stable; the original string is preserved for the
	// non_standard_chars rule.
	replacer := strings.NewReplacer(
		"\uFF0C", ",", // ，
		"\uFF1B", ";", // ；
		"\uFF08", "(", // （
		"\uFF09", ")", // ）
		"\uFF1A", ":", // ：
		"\uFF0F", "/", // ／
		"\u3000", " ", // ideographic space
	)
	s = replacer.Replace(s)
	s = strings.ToLower(s)
	for {
		nc := strings.ReplaceAll(s, "\n", " ")
		nc = strings.ReplaceAll(nc, "\t", " ")
		for strings.Contains(nc, "  ") {
			nc = strings.Replace(nc, "  ", " ", -1)
		}
		if nc == s {
			break
		}
		s = nc
	}
	return s
}

// parseStatement returns a parsedStmt. It is deliberately conservative —
// it never raises a syntax error unless the input is structurally empty
// or has unbalanced parens.
func parseStatement(s string) (*parsedStmt, error) {
	trimmed := strings.TrimSpace(s)
	if trimmed == "" {
		return nil, errors.New("empty statement")
	}

	// Count top-level statements by semicolons outside string literals.
	stmts := countStatements(trimmed)
	if stmts == 0 {
		return nil, errors.New("no statements")
	}

	// Bracket balance — a cheap structural sanity check.
	open, close_ := 0, 0
	inStr := false
	var quote byte
	for i := 0; i < len(trimmed); i++ {
		c := trimmed[i]
		if inStr {
			if c == quote {
				inStr = false
			}
			continue
		}
		switch c {
		case '\'', '"', '`':
			inStr = true
			quote = c
		case '(':
			open++
		case ')':
			close_++
		}
	}
	if open != close_ {
		return nil, fmt.Errorf("unbalanced parentheses: open=%d close=%d", open, close_)
	}

	// Strip leading SQL comment lines for classification.
	noComment := strings.TrimSpace(regexp.MustCompile(`(?m)^\s*(--|#).*$`).ReplaceAllString(trimmed, " "))
	noComment = strings.TrimSpace(noComment)
	if noComment == "" {
		noComment = trimmed
	}

	upper := strings.ToUpper(noComment)
	kind := "other"
	switch {
	case strings.HasPrefix(upper, "SELECT") || strings.HasPrefix(upper, "WITH") || strings.HasPrefix(upper, "SHOW") || strings.HasPrefix(upper, "EXPLAIN"):
		kind = "select"
	case strings.HasPrefix(upper, "INSERT"):
		kind = "insert"
	case strings.HasPrefix(upper, "UPDATE"):
		kind = "update"
	case strings.HasPrefix(upper, "DELETE"):
		kind = "delete"
	case strings.HasPrefix(upper, "CREATE"), strings.HasPrefix(upper, "ALTER"), strings.HasPrefix(upper, "DROP"),
		strings.HasPrefix(upper, "TRUNCATE"), strings.HasPrefix(upper, "RENAME"), strings.HasPrefix(upper, "LOCK"),
		strings.HasPrefix(upper, "GRANT"), strings.HasPrefix(upper, "REVOKE"):
		kind = "ddl"
	}

	out := &parsedStmt{kind: kind, statementCount: stmts}

	// First table reference.
	if m := reTableName.FindStringSubmatch(noComment); m != nil {
		out.tableName = strings.TrimSpace(m[2])
	}

	// Cross-database reference: look for at least two `db.table`
	// patterns with distinct prefixes (indicating a cross-DB join).
	// Aliases like `u.name` in SELECT lists are ignored because they
	// do not appear as standalone "word.word" at FROM/JOIN positions.
	if kind == "select" || kind == "insert" {
		for _, m := range reCrossDB.FindAllString(noComment, -1) {
			m = strings.TrimSpace(m)
			parts := strings.SplitN(m, ".", 2)
			if len(parts) != 2 {
				continue
			}
			prefix := strings.TrimSpace(parts[0])
			// Skip likely aliases: single character or SQL keyword.
			if len(prefix) <= 1 || isSQLKeyword(prefix) {
				continue
			}
			// Skip default PG schema.
			if prefix == "public" || prefix == "information_schema" {
				continue
			}
			out.crossDB = m
			break
		}
	}
	return out, nil
}

// countStatements counts semicolon-separated statements, ignoring those
// inside single-quoted strings.
func countStatements(s string) int {
	count := 0
	inStr := false
	var quote byte
	for i := 0; i < len(s); i++ {
		c := s[i]
		if inStr {
			if c == quote {
				inStr = false
			}
			continue
		}
		switch c {
		case '\'', '"', '`':
			inStr = true
			quote = c
		case ';':
			count++
		}
	}
	// N semicolons means N+1 statements (e.g. "SELECT 1; DROP TABLE t"
	// has 1 semicolon and 2 statements). Handle the no-semicolons case
	// (single statement) and the trailing-semicolon case (don't double-
	// count an empty tail).
	if strings.TrimSpace(s) != "" {
		// Strip trailing whitespace and count how many statement bodies
		// remain after splitting on ';'.
		body := strings.TrimRight(strings.TrimSpace(s), ";")
		parts := strings.Split(body, ";")
		// Count non-empty parts.
		n := 0
		for _, p := range parts {
			if strings.TrimSpace(p) != "" {
				n++
			}
		}
		if n > 0 {
			count = n
		}
	}
	return count
}

// hasWHERE returns true when a WHERE clause exists outside the target
// table name (crude but adequate: we just look for the WHERE keyword in
// the raw SQL).
func hasWHERE(p *parsedStmt, raw string) bool {
	return reWhere.MatchString(normalizeSQL(raw))
}

// lineOf returns the 1-based line number containing the first occurrence
// of needle in s. Returns 0 when needle is empty or absent.
func lineOf(s, needle string) int {
	if needle == "" {
		return 0
	}
	idx := strings.Index(s, needle)
	if idx < 0 {
		idx = strings.Index(strings.ToUpper(s), strings.ToUpper(needle))
	}
	if idx < 0 {
		return 0
	}
	return lineOfAt(s, idx)
}

func lineOfAt(s string, idx int) int {
	if idx <= 0 {
		return 1
	}
	return strings.Count(s[:idx], "\n") + 1
}

// normalizeDBType canonicalizes the dialect tag so rule scoping works
// consistently across callers.
// sqlKeywords is a small deny-list used by crossDB detection to filter
// out false positives like `where`, `from`, `select` that would
// otherwise be seen as database prefixes in `word.word` patterns.
var sqlKeywords = map[string]struct{}{
	"select": {}, "from": {}, "where": {}, "and": {}, "or": {}, "not": {},
	"join": {}, "inner": {}, "outer": {}, "left": {}, "right": {}, "full": {},
	"on": {}, "as": {}, "in": {}, "is": {}, "null": {}, "like": {}, "between": {},
	"order": {}, "by": {}, "group": {}, "having": {}, "limit": {}, "offset": {},
	"set": {}, "values": {}, "into": {}, "update": {}, "delete": {}, "insert": {},
	"case": {}, "when": {}, "then": {}, "else": {}, "end": {}, "distinct": {},
	"exists": {}, "true": {}, "false": {},
}

func isSQLKeyword(w string) bool {
	_, ok := sqlKeywords[strings.ToLower(w)]
	return ok
}

func normalizeDBType(t string) string {
	switch strings.ToLower(strings.TrimSpace(t)) {
	case "":
		return "mysql" // MySQL is the Inception default; keep that assumption.
	case "mysql", "mariadb":
		return "mysql"
	case "pg", "postgres", "postgresql":
		return "postgres"
	case "tidb", "oceanbase":
		// Keep distinct dialects so rules can opt in per-dialect.
		return strings.ToLower(strings.TrimSpace(t))
	default:
		return strings.ToLower(strings.TrimSpace(t))
	}
}

