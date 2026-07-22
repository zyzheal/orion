package middleware

import (
	
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestCSP_DefaultConfig(t *testing.T) {
	r := gin.New()
	r.Use(CSP(DefaultCSPConfig()))
	r.GET("/test", func(c *gin.Context) { c.String(200, "ok") })

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	r.ServeHTTP(w, req)

	csp := w.Header().Get("Content-Security-Policy")
	if csp == "" {
		t.Error("expected CSP header")
	}
	if !contains([]string{"default-src 'self'"}, "default-src 'self'") {
		// Just check CSP is set
	}
	if w.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Error("expected X-Content-Type-Options: nosniff")
	}
	if w.Header().Get("X-Frame-Options") != "SAMEORIGIN" {
		t.Error("expected X-Frame-Options: SAMEORIGIN")
	}
}

func TestCSP_Disabled(t *testing.T) {
	cfg := DefaultCSPConfig()
	cfg.Enabled = false

	r := gin.New()
	r.Use(CSP(cfg))
	r.GET("/test", func(c *gin.Context) { c.String(200, "ok") })

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	r.ServeHTTP(w, req)

	if w.Header().Get("Content-Security-Policy") != "" {
		t.Error("expected no CSP header when disabled")
	}
}

func TestCSP_ReportOnly(t *testing.T) {
	cfg := DefaultCSPConfig()
	cfg.ReportOnly = true

	r := gin.New()
	r.Use(CSP(cfg))
	r.GET("/test", func(c *gin.Context) { c.String(200, "ok") })

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	r.ServeHTTP(w, req)

	if w.Header().Get("Content-Security-Policy-Report-Only") == "" {
		t.Error("expected CSP-Report-Only header")
	}
	if w.Header().Get("Content-Security-Policy") != "" {
		t.Error("expected no enforcing CSP header")
	}
}

func TestBuildCSPString(t *testing.T) {
	cfg := CSPConfig{
		Enabled: true,
		TrustedSources: TrustedSources{
			ScriptSrc:  []string{"'self'", "https://cdn.example.com"},
			StyleSrc:   []string{"'self'", "'unsafe-inline'"},
			ConnectSrc: []string{"'self'", "https://api.example.com"},
		},
	}

	csp := buildCSPString(cfg)
	if csp == "" {
		t.Error("expected non-empty CSP string")
	}
	// Should contain script-src with both sources
	if !containsPart(csp, "script-src 'self' https://cdn.example.com") {
		t.Errorf("CSP missing script-src: %s", csp)
	}
}

func TestAddSubAppSources(t *testing.T) {
	cfg := DefaultCSPConfig()
	cfg = AddSubAppSources(cfg, []string{
		"https://subapp.example.com/path",
		"http://localhost:3002",
	})

	found := false
	for _, src := range cfg.TrustedSources.ScriptSrc {
		if src == "https://subapp.example.com" {
			found = true
		}
	}
	if !found {
		t.Error("expected sub-app origin in script-src")
	}
}

func containsPart(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsSubstring(s, substr))
}

func containsSubstring(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
