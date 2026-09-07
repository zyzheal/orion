package advisor

import (
	"context"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"

	"go.uber.org/zap"
)

// IndexAdvisorService produces CREATE INDEX suggestions by combining:
//
//   - SlowQuery data (total_time_ms, call_count) as impact weight,
//   - Existing indexes as the baseline we must avoid duplicating,
//   - Column extraction from the slow query text itself.
//
// The heuristic is conservative: it only fires when a slow query
// targets a specific table and has no matching index on its filter
// columns. False positives are cheap (a wrong suggestion); false
// negatives are expensive (missed optimization).
type IndexAdvisorService struct {
	repo *Repository
	slow SlowQueryLookup
	log  *zap.Logger
}

// SlowQueryLookup pulls recent slow queries for a data source. The
// module owns a narrow interface so we can wire it to slowquery.Repository
// without a hard dependency.
type SlowQueryLookup interface {
	TopN(ctx context.Context, tenantID, dsID string, limit int) ([]SlowQueryRow, error)
}

// SlowQueryRow is the narrow shape the advisor consumes. Kept as a
// local struct to avoid importing slowquery.
type SlowQueryRow struct {
	Query      string
	DBType     string
	CallCount  int64
	TotalTime  float64
	RowsRead   int64
}

// NewIndexAdvisorService constructs an IndexAdvisorService.
func NewIndexAdvisorService(repo *Repository, slow SlowQueryLookup, log *zap.Logger) *IndexAdvisorService {
	if log == nil {
		log = zap.NewNop()
	}
	return &IndexAdvisorService{repo: repo, slow: slow, log: log}
}

// SuggestIndexes is the primary surface. Returns ranked suggestions
// (highest impact first). When tables is empty the advisor infers
// candidate tables from the slow queries. tenantID comes from the auth
// context — the caller must verify the data source belongs to it.
func (s *IndexAdvisorService) SuggestIndexes(ctx context.Context, tenantID string, req SuggestIndexesRequest) (*SuggestIndexesResult, error) {
	if s.repo == nil {
		return nil, errAdvisorNotWired
	}
	ds, err := s.repo.dsLookup.GetDataSource(ctx, req.DataSourceID)
	if err != nil {
		return nil, err
	}
	if ds.TenantID != "" && ds.TenantID != tenantID {
		return nil, fmt.Errorf("advisor: data source %q does not belong to tenant", req.DataSourceID)
	}
	dbType := strings.ToLower(strings.TrimSpace(req.DBType))
	if dbType == "" {
		dbType = "postgres"
	}

	// 1. Fetch existing indexes so we can suppress duplicates.
	existing, err := s.repo.ListExistingIndexes(ctx, ds, dbType, req.Schema)
	if err != nil {
		s.log.Warn("index advisor: failed to list existing indexes",
			zap.String("ds", req.DataSourceID),
			zap.Error(err),
		)
		existing = nil
	}

	// 2. Fetch slow queries for the data source.
	var slowRows []SlowQueryRow
	if s.slow != nil {
		if rows, err := s.slow.TopN(ctx, tenantID, req.DataSourceID, 100); err == nil {
			slowRows = rows
		}
	}

	// 3. Resolve candidate tables.
	tables := req.Tables
	if len(tables) == 0 {
		tables = inferTables(slowRows)
	}

	// 4. Build a column-usage histogram per table across all slow queries.
	colUsage := map[string]map[string]int{} // table -> column -> count
	for _, row := range slowRows {
		for _, tbl := range tables {
			if !strings.Contains(row.Query, tbl) {
				continue
			}
			cols := extractFilterColumns(row.Query, tbl)
			for _, c := range cols {
				if colUsage[tbl] == nil {
					colUsage[tbl] = map[string]int{}
				}
				colUsage[tbl][c]++
			}
		}
	}

	// 5. Emit one suggestion per table that has filter columns
	//    without an existing index covering them.
	var out []IndexSuggestion
	for _, tbl := range tables {
		cols := mapKeysSorted(colUsage[tbl])
		if len(cols) == 0 {
			continue
		}
		// Skip if there's already an index whose first column matches.
		if hasCoveringIndex(existing, tbl, cols) {
			continue
		}
		sugg := buildIndexSuggestion(tbl, cols, dbType, slowRows, colUsage[tbl])
		out = append(out, sugg)
	}

	// 6. Rank by impact (total_time_ms weighted by call_count).
	sort.SliceStable(out, func(i, j int) bool {
		return out[i].Impact > out[j].Impact
	})

	return &SuggestIndexesResult{
		DataSourceID: req.DataSourceID,
		DBType:       dbType,
		Schema:       req.Schema,
		Suggestions:  out,
		AnalyzedAt:   time.Now().UTC(),
	}, nil
}

var errAdvisorNotWired = errNotWired{}

type errNotWired struct{}

func (errNotWired) Error() string { return "advisor: dependencies not wired" }

// ---- Helpers ----

// inferTables extracts distinct table names from slow queries using a
// loose regex. Not exhaustive — misses aliased/quoted names — but
// good enough to bootstrap the advisor when the caller hasn't pinned
// a table list.
var inferTablesRe = regexp.MustCompile(`(?i)\b(?:from|join|update|into)\s+([a-z_][a-z0-9_.]*)`)

func inferTables(rows []SlowQueryRow) []string {
	seen := map[string]bool{}
	var out []string
	for _, r := range rows {
		for _, m := range inferTablesRe.FindAllStringSubmatch(r.Query, -1) {
			if len(m) < 2 {
				continue
			}
			tbl := m[1]
			// Strip schema prefix — the advisor works per-table.
			if dot := strings.Index(tbl, "."); dot >= 0 {
				tbl = tbl[dot+1:]
			}
			if tbl == "" || strings.EqualFold(tbl, "select") || strings.EqualFold(tbl, "set") {
				continue
			}
			if !seen[tbl] {
				seen[tbl] = true
				out = append(out, tbl)
			}
		}
	}
	return out
}

// extractFilterColumns pulls columns referenced in WHERE/ON clauses
// of a query that involve the given table. Strategy: split on WHERE
// or ON keywords, then find each "identifier <comparison operator>"
// pair — the column is the identifier to the left of =, <, >, <=, >=,
// !=, LIKE, IN, BETWEEN, IS.
func extractFilterColumns(query, table string) []string {
	if !strings.Contains(strings.ToLower(query), strings.ToLower(table)) {
		return nil
	}

	// Find the start of the WHERE or ON clause (last occurrence wins —
	// a nested subquery's WHERE takes precedence over an outer one).
	lower := strings.ToLower(query)
	start := -1
	for _, kw := range []string{" where ", " on ", " where(", " on ("} {
		if idx := strings.LastIndex(lower, kw); idx > start {
			start = idx
		}
	}
	if start < 0 {
		return nil
	}
	clause := query[start:]

	// Walk the clause, picking up identifier followed by an operator.
	colRe := regexp.MustCompile(`([a-z_][a-z0-9_]*)\s*(?:=|!=|<>|<=|>=|>|<)\s`)
	matches := colRe.FindAllStringSubmatchIndex(clause, -1)
	seen := map[string]bool{}
	var outColumns []string
	for _, m := range matches {
		if len(m) < 4 {
			continue
		}
		candidate := clause[m[2]:m[3]]
		if isSQLKeyword(strings.ToLower(candidate)) {
			continue
		}
		// Skip prefixed columns that don't belong to our table.
		if strings.HasPrefix(candidate, table+"_") ||
			strings.EqualFold(candidate, table) ||
			strings.HasPrefix(candidate, strings.ToLower(table)+".") {
			continue
		}
		if seen[candidate] {
			continue
		}
		seen[candidate] = true
		outColumns = append(outColumns, candidate)
	}
	return outColumns
}

func isOperator(r rune) bool {
	return r == '=' || r == '!' || r == '<' || r == '>'
}

// isSQLKeyword returns true for tokens that look like SQL keywords
// rather than column identifiers. Kept short — the list is
// intentionally minimal; missing a keyword just yields a spurious
// suggestion, which the advisor's Impact score will downrank.
func isSQLKeyword(s string) bool {
	switch strings.ToLower(s) {
	case "and", "or", "not", "is", "null", "in", "like", "between",
		"exists", "select", "from", "where", "on", "join", "inner",
		"outer", "left", "right", "full", "cross", "using", "group",
		"order", "by", "having", "limit", "offset", "union", "all",
		"distinct", "as", "set", "values", "when", "then", "else",
		"end", "case", "true", "false", "now", "current_date", "cast",
		"interval":
		return true
	}
	return false
}

func isIdentChar(r rune) bool {
	return r == '_' ||
		(r >= 'a' && r <= 'z') ||
		(r >= 'A' && r <= 'Z') ||
		(r >= '0' && r <= '9')
}

func mapKeysSorted(m map[string]int) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

// hasCoveringIndex returns true when an existing index already covers
// the requested columns in order (first-column match is sufficient).
func hasCoveringIndex(existing []ExistingIndex, table string, cols []string) bool {
	if len(cols) == 0 {
		return false
	}
	first := strings.ToLower(cols[0])
	for _, e := range existing {
		if !strings.EqualFold(e.Table, table) {
			continue
		}
		if len(e.Columns) > 0 && strings.ToLower(e.Columns[0]) == first {
			return true
		}
	}
	return false
}

// buildIndexSuggestion builds the CREATE INDEX statement and impact
// score for a candidate table+columns pair.
func buildIndexSuggestion(table string, cols []string, dbType string, slowRows []SlowQueryRow, colUsage map[string]int) IndexSuggestion {
	// Pick the highest-usage column first, then fall back to sorted.
	if len(cols) > 0 {
		best := cols[0]
		bestCount := colUsage[best]
		for _, c := range cols[1:] {
			if colUsage[c] > bestCount {
				best, bestCount = c, colUsage[c]
			}
		}
		// Move best to front.
		reordered := []string{best}
		for _, c := range cols {
			if c != best {
				reordered = append(reordered, c)
			}
		}
		cols = reordered
	}

	// Compute impact: sum of total_time_ms * call_count for slow
	// queries that mention this table.
	var impact float64
	var evidence []string
	for _, r := range slowRows {
		if strings.Contains(r.Query, table) {
			score := r.TotalTime * float64(r.CallCount) / 1000.0
			if score <= 0 {
				score = r.TotalTime / 1000.0
			}
			impact += score
			evidence = append(evidence, shortSQL(r.Query))
		}
	}

	// Build SQL.
	quoted := quoteIdent(dbType, table)
	colsSQL := make([]string, 0, len(cols))
	for _, c := range cols {
		colsSQL = append(colsSQL, quoteIdent(dbType, c))
	}
	sql := "CREATE INDEX IF NOT EXISTS " +
		quoteIdent(dbType, "idx_"+table+"_"+strings.Join(cols, "_")) +
		" ON " + quoted + " (" + strings.Join(colsSQL, ", ") + ")"

	return IndexSuggestion{
		Table:    table,
		Columns:  cols,
		Kind:     "btree",
		DBType:   dbType,
		SQL:      sql,
		Reason:   "Slow queries on " + table + " without a covering index on " + strings.Join(cols, ", ") + ".",
		Evidence: evidence,
		Impact:   impact,
	}
}

func shortSQL(q string) string {
	q = strings.TrimSpace(q)
	if len(q) > 120 {
		return q[:117] + "..."
	}
	return q
}

// quoteIdent wraps an identifier in the correct quoting for dbType.
// SQL standard uses double quotes; MySQL uses backticks.
func quoteIdent(dbType, name string) string {
	if dbType == "mysql" {
		return "`" + strings.ReplaceAll(name, "`", "``") + "`"
	}
	return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
}
