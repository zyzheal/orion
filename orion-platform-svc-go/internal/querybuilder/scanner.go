// Static source scanning for ADR-011 §3.2.6 L2 (tenant-sql-builder
// violation detection).
//
// ScanSource detects the two patterns the ADR forbids:
//
//   1. Raw r.db.Query* or r.db.Exec calls (Repository bypassing
//      TenantAwareDB). Pattern: identifier.db.Query/Exec (case-sensitive).
//   2. SQL string literals missing "tenant_id" (unless on the allowlist
//      from docs/design-constraints/framework/allowlist/tenant-sql.ts).
//
// Scanning is deliberately conservative — false positives are OK
// (callers can suppress by adding to the allowlist); false negatives
// are the danger. The detector is not a full Go AST parser; it uses
// regex heuristics over raw source. For full fidelity, wire up the
// TypeScript detector at
// docs/design-constraints/framework/detectors/tenant-sql-builder.ts.
package querybuilder

import (
	"regexp"
	"strings"
)

// Violation is a single detection.
type Violation struct {
	Line   int    `json:"line"`
	Pattern string `json:"pattern"` // "raw-db-query" or "missing-tenant-id"
	Snippet string `json:"snippet"` // truncated source line for display
}

// defaultAllowlist covers the ADR's known-safe cases.
// Extend by adding more regex patterns to this slice.
var defaultAllowlist = []*regexp.Regexp{
	// Migration version table itself has no tenant_id.
	regexp.MustCompile(`(?i)\bschema_migrations\b`),
	// Tenant metadata table itself.
	regexp.MustCompile(`\btenants\b`),
	// System catalogs.
	regexp.MustCompile(`\binformation_schema\b`),
	regexp.MustCompile(`\bpg_catalog\b`),
	// Admin statements.
	regexp.MustCompile(`\bSHOW\b`),
	regexp.MustCompile(`\bSET\s+`),
}

// Allowlist is an optional user-supplied list of regex patterns
// that suppress matching violations.
type Allowlist []*regexp.Regexp

// ScanSource scans src for L2 violations. Returns an empty slice when
// no violations are found. Line numbers are 1-based.
func ScanSource(src string) []Violation {
	violations := ScanSourceWithAllowlist(src, nil)
	return violations
}

// ScanSourceWithAllowlist is ScanSource with an optional allowlist.
func ScanSourceWithAllowlist(src string, allowlist Allowlist) []Violation {
	if src == "" {
		return nil
	}
	lines := strings.Split(src, "\n")
	var out []Violation

	// Pattern 1: raw r.db.Query*/Exec calls.
	reRaw := regexp.MustCompile(`\b(\w+)\.db\.(Query(?:xContext|RowxContext|xContext|x)?|Exec(?:Context)?)\b`)
	// Pattern 2: SQL string literal missing tenant_id. Matched loosely
	// — long enough strings with a keyword (SELECT/INSERT/UPDATE/DELETE).
	reSQL := regexp.MustCompile(`"(?i:)(?:SELECT|INSERT INTO|UPDATE|DELETE FROM)[^"]{20,}"`)

	for i, line := range lines {
		// Skip comments.
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "//") || strings.HasPrefix(trimmed, "/*") {
			continue
		}
		// Skip allowlisted lines.
		if allowlisted(line, allowlist) {
			continue
		}

		if reRaw.MatchString(line) {
			out = append(out, Violation{
				Line:    i + 1,
				Pattern: "raw-db-query",
				Snippet: truncate(line, 120),
			})
			continue
		}
		if reSQL.MatchString(line) && !strings.Contains(line, "tenant_id") {
			out = append(out, Violation{
				Line:    i + 1,
				Pattern: "missing-tenant-id",
				Snippet: truncate(line, 120),
			})
		}
	}
	return out
}

// allowlisted returns true if any allowlist regex matches the line.
func allowlisted(line string, allowlist Allowlist) bool {
	for _, re := range allowlist {
		if re.MatchString(line) {
			return true
		}
	}
	for _, re := range defaultAllowlist {
		if re.MatchString(line) {
			return true
		}
	}
	return false
}

// truncate returns at most n bytes of s, appending "..." if truncated.
func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
