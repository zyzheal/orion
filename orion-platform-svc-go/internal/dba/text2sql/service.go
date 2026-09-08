// Package text2sql converts natural-language questions into read-only SQL
// using an LLM. The generated SQL is validated through the same
// isReadOnlySQL gate used by ExecuteDirectQuery so an AI hallucination
// (e.g. "DELETE FROM users") is rejected before it reaches the database.
//
// Design:
//   - The service never executes the SQL itself. It returns the generated
//     SQL to the caller, who must review it and submit it through the
//     normal query/工单 path. This keeps the AI out of the execution
//     trust boundary.
//   - Schema context (table/column names) is fetched from the data source
//     and injected into the LLM prompt so the model produces dialect- and
//     schema-accurate SQL.
//   - Multi-tenant: every call carries a tenantID, used for rate-limit
//     and audit logging.
package text2sql

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// LLMClient is the narrow interface the service needs from an LLM provider.
// It mirrors assistant.LLMClient so the same concrete client can be wired
// into both.
type LLMClient interface {
	Generate(ctx context.Context, prompt string, options LLMOptions) (string, error)
}

// LLMOptions configures a single generation call.
type LLMOptions struct {
	Model       string
	Temperature float64
	MaxTokens   int
	Timeout     time.Duration
}

// SchemaFetcher retrieves table and column names for a data source so the
// LLM prompt includes real schema context. The interface is narrow so the
// dba slowquery or advisor repository can satisfy it without a hard dep.
type SchemaFetcher interface {
	TableColumns(ctx context.Context, tenantID, dataSourceID, schema string) ([]TableColumn, error)
}

// TableColumn is a row in the schema context sent to the LLM.
type TableColumn struct {
	Table       string
	Column      string
	DataType    string
	IsNullable  bool
}

// Service converts natural language to SQL.
type Service struct {
	llm     LLMClient
	schema  SchemaFetcher
	log     *zap.Logger
	timeout time.Duration
}

// NewService wires a text2sql service. A nil llm disables generation and
// returns ErrLLMNotConfigured so callers can fall back to a legacy path.
func NewService(llm LLMClient, schema SchemaFetcher, log *zap.Logger) *Service {
	if log == nil {
		log = zap.NewNop()
	}
	return &Service{
		llm:     llm,
		schema:  schema,
		log:     log,
		timeout: 30 * time.Second,
	}
}

// NLQueryRequest is the input to Convert.
type NLQueryRequest struct {
	DataSourceID string
	Schema       string // optional; empty = public/default schema
	Question     string
	TenantID     string
}

// NLQueryResult is the output of Convert.
type NLQueryResult struct {
	ID         string // request ID for audit
	SQL        string // generated SQL
	TablesUsed []string
	Warning    string // populated when the SQL was rewritten for safety
	SafeToRun  bool   // false when isReadOnlySQL rejected the output
}

// Convert translates the natural-language question into SQL. The returned
// SQL is guaranteed read-only by isReadOnlySQL; when the LLM output fails
// the read-only check, SafeToRun=false and a warning explains the rewrite.
//
// The function never connects to the target database — it only fetches
// schema metadata to ground the prompt.
func (s *Service) Convert(ctx context.Context, req NLQueryRequest) (*NLQueryResult, error) {
	if s.llm == nil {
		return nil, ErrLLMNotConfigured
	}
	req.Question = strings.TrimSpace(req.Question)
	if req.Question == "" {
		return nil, ErrEmptyQuestion
	}
	if req.DataSourceID == "" {
		return nil, ErrMissingDataSource
	}

	result := &NLQueryResult{ID: uuid.New().String()}

	// Fetch schema context to ground the LLM prompt. When the fetcher is
	// nil or returns an error, we proceed without context — the LLM may
	// still produce a reasonable query, and the read-only gate still applies.
	var columns []TableColumn
	if s.schema != nil {
		c, err := s.schema.TableColumns(ctx, req.TenantID, req.DataSourceID, req.Schema)
		if err != nil {
			s.log.Warn("text2sql: schema fetch failed; proceeding without context",
				zap.String("ds", req.DataSourceID),
				zap.Error(err))
		} else {
			columns = c
		}
	}

	// Build the prompt with schema context.
	prompt := buildPrompt(req.Question, req.Schema, columns)

	// Call the LLM with a bounded timeout so a slow model does not hang.
	genCtx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()
	raw, err := s.llm.Generate(genCtx, prompt, LLMOptions{
		Temperature: 0.1, // low temperature for deterministic SQL
		MaxTokens:   800,
	})
	if err != nil {
		return nil, fmt.Errorf("text2sql: llm generate: %w", err)
	}

	// Extract the SQL from the LLM response. The prompt instructs the
	// model to emit only a SQL statement, but we also strip markdown
	// code fences in case the model wraps the output.
	sql := extractSQL(raw)
	result.SQL = sql
	result.TablesUsed = extractTableNames(sql)

	// Hard safety gate: the generated SQL must be read-only. If the LLM
	// produced a write statement, mark unsafe and explain.
	if !isReadOnlySQL(strings.TrimSpace(strings.ToLower(sql))) {
		result.SafeToRun = false
		result.Warning = "Generated SQL failed read-only validation (non-SELECT statement). Review and rewrite as SELECT-only."
		return result, nil
	}
	result.SafeToRun = true
	return result, nil
}

// buildPrompt constructs the LLM prompt with schema context.
func buildPrompt(question, schema string, columns []TableColumn) string {
	var b strings.Builder
	b.WriteString("You are a SQL expert. Convert the user's natural-language question into a single read-only SQL statement.\n")
	b.WriteString("Rules:\n")
	b.WriteString("- Only emit a SELECT statement. Never emit INSERT/UPDATE/DELETE/DROP/ALTER/GRANT/REVOKE/TRUNCATE.\n")
	b.WriteString("- Emit only the SQL, no explanation, no markdown fences.\n")
	b.WriteString("- Use standard SQL syntax compatible with the target database.\n")
	b.WriteString("- Limit results to 100 rows unless the question explicitly asks for more.\n")
	b.WriteString("- Use table aliases for readability.\n\n")

	if schema != "" {
		b.WriteString("Schema: " + schema + "\n")
	}
	if len(columns) > 0 {
		b.WriteString("Available tables and columns:\n")
		seen := map[string]bool{}
		for _, c := range columns {
			key := c.Table + "." + c.Column
			if seen[key] {
				continue
			}
			seen[key] = true
			nullable := ""
			if !c.IsNullable {
				nullable = " NOT NULL"
			}
			b.WriteString(fmt.Sprintf("  %s.%s (%s%s)\n", c.Table, c.Column, c.DataType, nullable))
		}
	}
	b.WriteString("\nQuestion: " + question + "\n")
	b.WriteString("SQL:")
	return b.String()
}

// extractSQL strips markdown code fences and leading/trailing whitespace
// from the LLM output. The prompt asks for raw SQL, but models sometimes
// wrap the output in ```sql ... ``` fences anyway.
func extractSQL(raw string) string {
	s := strings.TrimSpace(raw)
	// Strip leading ```sql or ``` fence.
	if strings.HasPrefix(s, "```") {
		// Drop first line (the fence).
		idx := strings.Index(s, "\n")
		if idx >= 0 {
			s = s[idx+1:]
		}
		// Strip trailing ``` fence.
		s = strings.TrimSuffix(strings.TrimSpace(s), "```")
	}
	return strings.TrimSpace(s)
}

// extractTableNames returns the table references found in the SQL. Used for
// the audit record so reviewers can see which tables the query touches
// without parsing the SQL themselves.
func extractTableNames(sql string) []string {
	// This is intentionally simple — a full parser would duplicate
	// inception/engine/local_engine.go's parseStatement. We look for
	// FROM/JOIN keywords and grab the next identifier.
	var tables []string
	upper := strings.ToUpper(sql)
	seen := map[string]bool{}
	keywords := []string{"FROM ", "JOIN "}
	for _, kw := range keywords {
		idx := 0
		for {
			pos := strings.Index(upper[idx:], kw)
			if pos < 0 {
				break
			}
			start := idx + pos + len(kw)
			rest := sql[start:]
			// Extract the first word (table name or alias).
			end := 0
			for end < len(rest) {
				c := rest[end]
				if c == ' ' || c == ',' || c == ';' || c == '(' || c == '\n' {
					break
				}
				end++
			}
			table := strings.TrimSpace(rest[:end])
			// Trim schema prefix (schema.table -> table).
			if dot := strings.LastIndex(table, "."); dot >= 0 {
				table = table[dot+1:]
			}
			// Strip quotes/backticks.
			table = strings.Trim(table, "\"`'")
			if table != "" && !seen[table] && !isSQLKeyword(table) {
				seen[table] = true
				tables = append(tables, table)
			}
			idx = start + end
		}
	}
	return tables
}

// isReadOnlySQL is the read-only check shared with dba/service. It is
// duplicated here to avoid an import cycle (dba/service imports models,
// not a standalone checker). The two implementations must stay in sync.
//
// The check: only SELECT or WITH...SELECT allowed, no semicolons (no
// statement stacking), no write keywords anywhere in the body. Comments
// are stripped before keyword scanning so a caller cannot hide a write
// keyword behind "-- DROP ..." or "/* DROP */".
func isReadOnlySQL(sql string) bool {
	if strings.Contains(sql, ";") {
		return false
	}
	// Strip comments and string literals before keyword scanning — same
	// logic as dba/service.stripSQLComments. Without this a prompt like
	// "/* DROP TABLE */ SELECT 1" would pass the keyword scan.
	s := stripSQLComments(sql)
	s = strings.ToLower(strings.TrimSpace(s))
	if s == "" {
		return false
	}
	if !strings.HasPrefix(s, "select") && !strings.HasPrefix(s, "with") {
		return false
	}
	for _, bad := range blockedSQLKeywords {
		if containsSQLKeyword(s, bad) {
			return false
		}
	}
	return true
}

// stripSQLComments removes -- single-line and /* */ block comments, and
// replaces string literals with '' so their contents never trigger the
// keyword scan. This mirrors dba/service.stripSQLComments — kept in sync
// so both paths apply the same defense-in-depth.
func stripSQLComments(sql string) string {
	var out strings.Builder
	for i := 0; i < len(sql); {
		// String literal: replace with '' so contents do not trigger scan.
		if sql[i] == '\'' {
			end := i + 1
			for end < len(sql) {
				if sql[end] == '\'' {
					if end+1 < len(sql) && sql[end+1] == '\'' {
						end += 2
						continue
					}
					break
				}
				end++
			}
			out.WriteString("''")
			if end < len(sql) {
				i = end + 1
			} else {
				break
			}
			continue
		}
		// Single-line comment: skip to end of line.
		if i+1 < len(sql) && sql[i] == '-' && sql[i+1] == '-' {
			j := strings.IndexByte(sql[i:], '\n')
			if j < 0 {
				break
			}
			i += j + 1
			continue
		}
		// Block comment: skip to closing */.
		if i+1 < len(sql) && sql[i] == '/' && sql[i+1] == '*' {
			end := strings.Index(sql[i+2:], "*/")
			if end < 0 {
				break
			}
			i += 2 + end + 2
			continue
		}
		out.WriteByte(sql[i])
		i++
	}
	return out.String()
}

var blockedSQLKeywords = []string{
	"create", "alter", "drop", "truncate", "insert", "update", "delete",
	"grant", "revoke", "call", "exec", "execute", "set", "reset",
	"vacuum", "analyze", "refresh", "listen", "notify", "load",
	"copy", "fetch", "prepare", "deallocate", "comment",
}

// containsSQLKeyword uses word-boundary matching so "update_time" does
// not match "update".
func containsSQLKeyword(sql, keyword string) bool {
	// Simple word-boundary check without regexp for zero-alloc hot path.
	idx := 0
	for {
		pos := strings.Index(strings.ToLower(sql[idx:]), keyword)
		if pos < 0 {
			return false
		}
		start := idx + pos
		end := start + len(keyword)
		// Check left boundary.
		leftOK := start == 0 || !isWordChar(sql[start-1])
		// Check right boundary.
		rightOK := end >= len(sql) || !isWordChar(sql[end])
		if leftOK && rightOK {
			return true
		}
		idx = end
	}
}

func isWordChar(b byte) bool {
	return (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z') || (b >= '0' && b <= '9') || b == '_'
}

var sqlKeywordSet = map[string]bool{
	"select": true, "from": true, "where": true, "and": true, "or": true,
	"not": true, "join": true, "inner": true, "outer": true, "left": true,
	"right": true, "full": true, "on": true, "as": true, "in": true,
	"is": true, "null": true, "like": true, "between": true, "order": true,
	"by": true, "group": true, "having": true, "limit": true, "offset": true,
	"set": true, "values": true, "into": true, "update": true, "delete": true,
	"insert": true, "case": true, "when": true, "then": true, "else": true,
	"end": true, "distinct": true, "exists": true, "true": true, "false": true,
}

func isSQLKeyword(w string) bool {
	return sqlKeywordSet[strings.ToLower(w)]
}

// Sentinel errors.
var (
	ErrLLMNotConfigured = errors.New("text2sql: LLM client not configured")
	ErrEmptyQuestion    = errors.New("text2sql: question is empty")
	ErrMissingDataSource = errors.New("text2sql: data source id is required")
)
