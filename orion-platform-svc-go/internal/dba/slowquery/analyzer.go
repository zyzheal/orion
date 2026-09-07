package slowquery

import (
	"fmt"
	"regexp"
	"strings"
	"time"
)

// normalizeSQL reduces a SQL string to a stable signature that ignores
// whitespace and quotes literals, so "SELECT * FROM t WHERE id = '1'"
// and "SELECT * FROM t WHERE id='2'" share the same hash. Used to
// dedupe collector output.
func normalizeSQL(sql string) string {
	s := strings.TrimSpace(sql)
	s = strings.ToLower(s)
	// Strip string literals — replace single-quoted content with ?
	s = regexp.MustCompile("'[^']*'").ReplaceAllString(s, "?")
	// Strip numeric literals
	s = regexp.MustCompile(`\b\d+(\.\d+)?\b`).ReplaceAllString(s, "?")
	// Collapse whitespace
	s = regexp.MustCompile(`\s+`).ReplaceAllString(s, " ")
	// Normalize around comparison operators so "=1" and " = 1" match
	s = regexp.MustCompile(`\s*(=|<>|!=|>=|<=|>|<)\s*`).ReplaceAllString(s, " $1 ")
	return strings.TrimSpace(s)
}

// analyzeSQL is a pure function: SQL in, suggestions + verdict out.
// It is deterministic and side-effect free so it can be unit tested
// without a DB. The rules are ordered from most impactful to least.
func analyzeSQL(sql, dbType string, rowsRead int64) *AnalysisResult {
	sqlLower := strings.ToLower(strings.TrimSpace(sql))
	hash := normalizeSQL(sqlLower)

	var suggestions []Suggestion

	// Rule 1: SELECT * — replace with explicit columns for wire size + planner benefit.
	if isSelectAll(sqlLower) {
		suggestions = append(suggestions, Suggestion{
			Category:    "projection",
			Severity:    "medium",
			Title:       "SELECT * 应显式列出列",
			Description: "SELECT * 会拉取全部列，增大网络传输并阻止 index-only scan。改用显式列名可让优化器选择更窄的索引。",
		})
	}

	// Rule 2: LIKE '%word' — leading wildcard prevents index use.
	if hasLeadingWildcardLike(sqlLower) {
		suggestions = append(suggestions, Suggestion{
			Category:    "index",
			Severity:    "high",
			Title:       "LIKE 前缀通配符导致全表扫描",
			Description: `LIKE '%x' 无法使用 B-Tree 索引。改用后缀通配符 (LIKE 'x%') 或引入全文索引 / trigram 索引。`,
		})
	}

	// Rule 3: OR with different columns — often causes scan instead of index merge.
	if hasORClause(sqlLower) {
		suggestions = append(suggestions, Suggestion{
			Category:    "structure",
			Severity:    "medium",
			Title:       "OR 子句可能阻止索引使用",
			Description: "WHERE a=? OR b=? 通常无法用单一 B-Tree 索引。改为 UNION ALL 或引入复合索引。",
		})
	}

	// Rule 4: Function applied to indexed column — breaks index.
	if hasFunctionOnColumn(sqlLower) {
		suggestions = append(suggestions, Suggestion{
			Category:    "index",
			Severity:    "high",
			Title:       "索引列上的函数调用会破坏索引",
			Description: "WHERE lower(col) = ? 或 WHERE date(col) = ? 无法使用 B-Tree 索引。改写为 sargable 形式或添加函数索引。",
		})
	}

	// NOTE: an implicit-cast rule (e.g. "WHERE varchar_col = 123") is
	// intentionally omitted — without a schema the analyzer cannot tell
	// whether the RHS is a number cast against a string column or a
	// normal int-vs-int comparison, so the rule would fire on nearly
	// every WHERE clause. Callers who have a schema can extend the
	// analyzer with a table-aware rule.

	// Rule 6: Very high rows_read — suggests scanning far more than needed.
	// 10_000 is a soft threshold: below this most scans are fine; above
	// it there is usually a composite or covering index to be had.
	if rowsRead >= 10000 {
		suggestions = append(suggestions, Suggestion{
			Category:    "index",
			Severity:    "medium",
			Title:       "扫描行数远超返回行数",
			Description: fmt.Sprintf("rows_read=%d 显著偏高，考虑复合索引或覆盖索引。", rowsRead),
		})
	}

	// Rule 7: Missing LIMIT on SELECT.
	if strings.HasPrefix(sqlLower, "select") && !strings.Contains(sqlLower, "limit") {
		suggestions = append(suggestions, Suggestion{
			Category:    "limit",
			Severity:    "low",
			Title:       "SELECT 缺少 LIMIT",
			Description: "无 LIMIT 的 SELECT 可能返回大结果集导致内存和响应时间爆炸。",
		})
	}

	// Rule 8: Cross-DB queries.
	if hasCrossDBReference(sqlLower) {
		suggestions = append(suggestions, Suggestion{
			Category:    "structure",
			Severity:    "medium",
			Title:       "跨库查询",
			Description: "SQL 引用了多个数据库/schema，可能引入网络延迟和事务边界问题。",
		})
	}

	// Verdict: pass only when zero suggestions. Any finding (even
	// low severity) means the query has a concrete optimization to
	// make; passing on that would hide the signal from dashboards.
	passed := len(suggestions) == 0

	return &AnalysisResult{
		SQL:         sql,
		QueryHash:   hash,
		DBType:      dbType,
		Suggestions: suggestions,
		Passed:      passed,
		AnalyzedAt:  time.Time{},
	}
}

// ---- Rule helpers ----

var (
	selectAllRe = regexp.MustCompile(`(?i)\bselect\s+\*`)
	leadingLikeRe = regexp.MustCompile(`(?i)\blike\s+'%`)
	// OR in WHERE/HAVING is the common case; a bare OR outside is
	// rare and typically a UNION candidate, so we restrict the search.
	orClauseRe = regexp.MustCompile(`(?i)\b(?:where|having)\b[^;]*\bor\b`)
	funcCallRe = regexp.MustCompile(`(?i)\b(?:lower|upper|substring|substr|left|right|ltrim|rtrim|trim|date|year|month|day|abs|round|coalesce|cast|now|current_date)\s*\(`)
	crossDBRe  = regexp.MustCompile(`(?i)\b[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*\.`)
)

func isSelectAll(sql string) bool {
	return selectAllRe.MatchString(sql)
}

func hasLeadingWildcardLike(sql string) bool {
	return leadingLikeRe.MatchString(sql)
}

func hasORClause(sql string) bool {
	// Only flag ORs in WHERE clauses (rough heuristic).
	return orClauseRe.MatchString(sql)
}

func hasFunctionOnColumn(sql string) bool {
	return funcCallRe.MatchString(sql)
}

func hasCrossDBReference(sql string) bool {
	return crossDBRe.MatchString(sql)
}
