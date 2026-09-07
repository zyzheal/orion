package slowquery

import (
	"strings"
	"testing"
)

// ---- normalizeSQL ----

func TestNormalizeSQL_CaseInsensitive(t *testing.T) {
	a := normalizeSQL("SELECT * FROM T WHERE ID = 1")
	b := normalizeSQL("select * from t where id=2")
	if a != b {
		t.Errorf("expected same signature, got %q vs %q", a, b)
	}
}

func TestNormalizeSQL_WhitespaceCollapses(t *testing.T) {
	a := normalizeSQL("SELECT a, b FROM t")
	b := normalizeSQL("SELECT  a,\t  b FROM t")
	if a != b {
		t.Errorf("whitespace should collapse: %q vs %q", a, b)
	}
}

func TestNormalizeSQL_LiteralMasked(t *testing.T) {
	a := normalizeSQL("SELECT * FROM t WHERE name = 'alice'")
	b := normalizeSQL("SELECT * FROM t WHERE name = 'bob'")
	if a != b {
		t.Errorf("literals should mask: %q vs %q", a, b)
	}
}

// ---- Analyzer rules ----

func TestAnalyzeSQL_SelectStar(t *testing.T) {
	r := analyzeSQL("SELECT * FROM users", "postgres", 0)
	if r.Passed {
		t.Error("expected SELECT * to not pass")
	}
	if len(r.Suggestions) == 0 {
		t.Fatal("expected at least one suggestion")
	}
	found := false
	for _, s := range r.Suggestions {
		if s.Category == "projection" {
			found = true
		}
	}
	if !found {
		t.Error("expected projection suggestion")
	}
}

func TestAnalyzeSQL_LeadingWildcard(t *testing.T) {
	r := analyzeSQL("SELECT id FROM t WHERE name LIKE '%smith'", "postgres", 0)
	if r.Passed {
		t.Error("expected leading wildcard to fail")
	}
	found := false
	for _, s := range r.Suggestions {
		if s.Severity == "high" && strings.Contains(s.Title, "LIKE") {
			found = true
		}
	}
	if !found {
		t.Error("expected LIKE leading wildcard high-severity suggestion")
	}
}

func TestAnalyzeSQL_MissingLimit(t *testing.T) {
	r := analyzeSQL("SELECT id FROM t", "postgres", 0)
	found := false
	for _, s := range r.Suggestions {
		if s.Category == "limit" {
			found = true
		}
	}
	if !found {
		t.Error("expected missing-limit suggestion")
	}
}

func TestAnalyzeSQL_HighRowsRead(t *testing.T) {
	r := analyzeSQL("SELECT id FROM t WHERE x=1 LIMIT 10", "postgres", 100000)
	found := false
	for _, s := range r.Suggestions {
		if s.Category == "index" && strings.Contains(s.Title, "扫描") {
			found = true
		}
	}
	if !found {
		t.Error("expected high-rows-read index suggestion")
	}
}

func TestAnalyzeSQL_CleanSQLPasses(t *testing.T) {
	// Explicit columns, LIMIT, no wildcards, no OR, no function, no cast.
	r := analyzeSQL("SELECT id, name FROM users WHERE tenant_id = 'abc' LIMIT 100", "postgres", 100)
	if !r.Passed {
		t.Errorf("expected clean SQL to pass, got suggestions: %v", r.Suggestions)
	}
}

func TestAnalyzeSQL_FunctionOnColumn(t *testing.T) {
	r := analyzeSQL("SELECT * FROM t WHERE lower(email) = 'x@y'", "postgres", 0)
	found := false
	for _, s := range r.Suggestions {
		if s.Category == "index" && strings.Contains(s.Title, "函数") {
			found = true
		}
	}
	if !found {
		t.Error("expected function-on-column suggestion")
	}
}

func TestAnalyzeSQL_OrClause(t *testing.T) {
	r := analyzeSQL("SELECT id FROM t WHERE a = 1 OR b = 2", "postgres", 0)
	found := false
	for _, s := range r.Suggestions {
		if s.Category == "structure" && strings.Contains(s.Title, "OR") {
			found = true
		}
	}
	if !found {
		t.Error("expected OR clause suggestion")
	}
}
