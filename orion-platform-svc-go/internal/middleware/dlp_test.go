package middleware

import (
	"testing"
)

func TestNewDLPScanner_LoadsDefaults(t *testing.T) {
	s := NewDLPScanner(nil)
	if len(s.rules) == 0 {
		t.Fatal("expected default rules loaded")
	}
	for _, r := range s.rules {
		if r.Pattern == nil {
			t.Errorf("rule %s has nil pattern", r.ID)
		}
	}
}

func TestScan_EmailMask(t *testing.T) {
	s := NewDLPScanner(nil)
	content := `{"email":"user@example.com","name":"test"}`
	modified, results := s.Scan(content, "/api/v1/user", "GET", "tenant-1")
	if len(results) == 0 {
		t.Fatal("expected email rule to match")
	}
	if modified == content {
		t.Error("expected modified content")
	}
	if results[0].DataType != "email" {
		t.Errorf("expected email type, got %s", results[0].DataType)
	}
}

func TestScan_PhoneMask(t *testing.T) {
	s := NewDLPScanner(nil)
	content := `{"phone":"13800138000"}`
	modified, results := s.Scan(content, "/api/v1/user", "GET", "")
	if len(results) == 0 {
		t.Fatal("expected phone match")
	}
	if results[0].DataType != "phone" {
		t.Errorf("expected phone, got %s", results[0].DataType)
	}
	if modified == content {
		t.Error("expected masked content")
	}
}

func TestScan_CreditCardBlock(t *testing.T) {
	s := NewDLPScanner(nil)
	content := `{"card":"4111111111111111"}`
	modified, results := s.Scan(content, "/api/v1/payment", "POST", "tenant-1")
	if len(results) == 0 {
		t.Fatal("expected credit card match")
	}
	if modified != "" {
		t.Error("expected empty modified (block)")
	}
	if results[0].Action != DLPActionBlock {
		t.Errorf("expected block action, got %s", results[0].Action)
	}
}

func TestScan_APIKeyBlock(t *testing.T) {
	s := NewDLPScanner(nil)
	content := `{"key":"sk_abcdefghijklmnopqrstuvwxyz123456"}`
	_, results := s.Scan(content, "/api/v1/export", "GET", "")
	found := false
	for _, r := range results {
		if r.RuleID == "api_key" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected api_key rule to match")
	}
}

func TestScan_JWTBlock(t *testing.T) {
	s := NewDLPScanner(nil)
	content := `{"token":"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123"}`
	modified, results := s.Scan(content, "/api/v1/data", "GET", "")
	if modified != "" {
		t.Error("expected block (empty modified)")
	}
	if len(results) == 0 {
		t.Fatal("expected JWT match")
	}
}

func TestScan_PrivateKeyBlock(t *testing.T) {
	s := NewDLPScanner(nil)
	content := `{"key":"-----BEGIN RSA PRIVATE KEY-----MIIEpA..."}`
	modified, results := s.Scan(content, "/api/v1/key", "GET", "")
	if modified != "" {
		t.Error("expected block")
	}
	if len(results) == 0 {
		t.Fatal("expected private_key match")
	}
}

func TestScan_NoMatch(t *testing.T) {
	s := NewDLPScanner(nil)
	content := `{"message":"hello world"}`
	modified, results := s.Scan(content, "/api/v1/health", "GET", "")
	if len(results) != 0 {
		t.Errorf("expected no results, got %d", len(results))
	}
	if modified != content {
		t.Error("expected unmodified content")
	}
}

func TestScan_PathFilter(t *testing.T) {
	s := NewDLPScanner(nil)
	err := s.AddRule(DLPRule{
		ID: "custom", Name: "Custom", DataType: "email",
		PatternStr: `\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b`,
		Action:     DLPActionBlock, PathPatterns: []string{"/admin"},
		Enabled: true,
	})
	if err != nil {
		t.Fatalf("AddRule failed: %v", err)
	}

	_, results := s.Scan(`{"email":"a@b.com"}`, "/api/v1/user", "GET", "")
	blocked := false
	for _, r := range results {
		if r.RuleID == "custom" {
			blocked = true
			break
		}
	}
	if blocked {
		t.Error("expected path filter to skip /api/v1/user")
	}

	_, results = s.Scan(`{"email":"a@b.com"}`, "/admin/settings", "GET", "")
	blocked = false
	for _, r := range results {
		if r.RuleID == "custom" {
			blocked = true
			break
		}
	}
	if !blocked {
		t.Error("expected match on /admin/settings")
	}
}

func TestScan_Threshold(t *testing.T) {
	s := NewDLPScanner(nil)
	err := s.AddRule(DLPRule{
		ID: "multi", Name: "MultiEmail", DataType: "email",
		PatternStr: `\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b`,
		Action:     DLPActionLog, Threshold: 3, Enabled: true,
	})
	if err != nil {
		t.Fatalf("AddRule failed: %v", err)
	}

	content := `a@b.com and c@d.com`
	_, results := s.Scan(content, "/test", "GET", "")
	found := false
	for _, r := range results {
		if r.RuleID == "multi" {
			found = true
			break
		}
	}
	if found {
		t.Error("expected no match below threshold")
	}

	content = `a@b.com and c@d.com and e@f.com`
	_, results = s.Scan(content, "/test", "GET", "")
	found = false
	for _, r := range results {
		if r.RuleID == "multi" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected match at threshold")
	}
}

func TestAddRule_BadPattern(t *testing.T) {
	s := NewDLPScanner(nil)
	err := s.AddRule(DLPRule{PatternStr: `[invalid`, Enabled: true})
	if err == nil {
		t.Error("expected error for invalid regex")
	}
}

func TestMatchPath(t *testing.T) {
	tests := []struct {
		path     string
		patterns []string
		want     bool
	}{
		{"/api/v1/users", []string{"/api/v1"}, true},
		{"/health", []string{"/api/v1"}, false},
		{"/api/v1/users/123", []string{"/api/v1/*"}, true},
		{"/api/v1/users/123", []string{"/api/v2/*"}, false},
		{"/data/export/csv", []string{"/data/*"}, true},
	}
	for _, tt := range tests {
		got := matchPath(tt.path, tt.patterns)
		if got != tt.want {
			t.Errorf("matchPath(%q, %v) = %v, want %v", tt.path, tt.patterns, got, tt.want)
		}
	}
}

func TestShouldSkipDLP(t *testing.T) {
	skip := []string{"/swagger", "/swagger.html", "/health", "/healthz", "/metrics", "/api/v1/metrics"}
	for _, p := range skip {
		if !shouldSkipDLP(p) {
			t.Errorf("shouldSkipDLP(%q) = false, want true", p)
		}
	}
	for _, p := range []string{"/api/v1/users", "/data/export"} {
		if shouldSkipDLP(p) {
			t.Errorf("shouldSkipDLP(%q) = true, want false", p)
		}
	}
}

func TestGetStats(t *testing.T) {
	s := NewDLPScanner(nil)
	s.Scan(`{"email":"a@b.com"}`, "/test", "GET", "tenant-1")
	s.Scan(`{"card":"4111111111111111"}`, "/test", "GET", "tenant-1")

	stats := s.GetStats()
	if len(stats) == 0 {
		t.Fatal("expected stats")
	}
	ts, ok := stats["tenant-1"]
	if !ok {
		t.Fatal("expected tenant-1 stats")
	}
	if ts.TotalScanned < 2 {
		t.Errorf("expected TotalScanned >= 2, got %d", ts.TotalScanned)
	}
	if ts.TotalBlocked < 1 {
		t.Errorf("expected TotalBlocked >= 1, got %d", ts.TotalBlocked)
	}
}
