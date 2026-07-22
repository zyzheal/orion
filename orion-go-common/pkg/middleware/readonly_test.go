package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() {
	// Ensure test mode so no log noise
	gin.SetMode(gin.TestMode)
}

func TestWriteAuthorityGuard_DisabledAllMethodsPass(t *testing.T) {
	// MIGRATION_READONLY unset -> guard disabled
	os.Unsetenv("MIGRATION_READONLY")

	router := gin.New()
	router.Use(WriteAuthorityGuard())
	// Register a handler for all methods so we test the guard, not route matching
	router.Any("/items", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	for _, method := range []string{"GET", "POST", "PUT", "PATCH", "DELETE"} {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(method, "/items", nil)
		router.ServeHTTP(w, req)

		if w.Code != 200 {
			t.Errorf("method=%s: expected 200 (guard disabled), got %d", method, w.Code)
		}
	}
}

func TestWriteAuthorityGuard_EnabledBlocksWriteMethods(t *testing.T) {
	os.Setenv("MIGRATION_READONLY", "true")
	defer os.Unsetenv("MIGRATION_READONLY")

	for _, method := range []string{"POST", "PUT", "PATCH", "DELETE"} {
		router := gin.New()
		router.Use(WriteAuthorityGuard())
		router.POST("/items", func(c *gin.Context) {
			c.JSON(200, gin.H{"ok": true})
		})

		w := httptest.NewRecorder()
		req := httptest.NewRequest(method, "/items", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusMethodNotAllowed {
			t.Errorf("method=%s: expected 405, got %d", method, w.Code)
		}

		var resp struct {
			Success bool   `json:"success"`
			Code    string `json:"code"`
			Message string `json:"message"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("method=%s: failed to parse JSON: %v", method, err)
		}
		if resp.Success != false {
			t.Errorf("method=%s: expected success=false", method)
		}
		if resp.Code != "METHOD_NOT_ALLOWED" {
			t.Errorf("method=%s: expected code=METHOD_NOT_ALLOWED, got %q", method, resp.Code)
		}
		if resp.Message == "" {
			t.Errorf("method=%s: expected non-empty message", method)
		}

		allow := w.Header().Get("Allow")
		if allow == "" {
			t.Errorf("method=%s: expected Allow header", method)
		}
	}
}

func TestWriteAuthorityGuard_EnabledAllowsGet(t *testing.T) {
	os.Setenv("MIGRATION_READONLY", "true")
	defer os.Unsetenv("MIGRATION_READONLY")

	router := gin.New()
	router.Use(WriteAuthorityGuard())
	router.GET("/items", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	for _, method := range []string{"GET", "HEAD", "OPTIONS"} {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(method, "/items", nil)
		router.ServeHTTP(w, req)

		// GET/HEAD/OPTIONS are allowed
		if w.Code == 405 {
			t.Errorf("method=%s: expected not 405, got %d", method, w.Code)
		}
	}
}

func TestWriteAuthorityGuard_WhitelistPaths(t *testing.T) {
	os.Setenv("MIGRATION_READONLY", "true")
	defer os.Unsetenv("MIGRATION_READONLY")

	router := gin.New()
	router.Use(WriteAuthorityGuard())
	router.POST("/healthz", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})
	router.POST("/metrics", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})
	router.POST("/health/details", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	for _, path := range []string{"/healthz", "/metrics", "/health/details"} {
		w := httptest.NewRecorder()
		req := httptest.NewRequest("POST", path, nil)
		router.ServeHTTP(w, req)

		if w.Code == 405 {
			t.Errorf("path=%s: whitelist should bypass guard, got 405", path)
		}
	}

	// Non-whitelisted path should still be blocked
	w := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/items", nil)
	router.ServeHTTP(w, req)
	if w.Code != 405 {
		t.Errorf("path=/items: expected 405, got %d", w.Code)
	}
}

func TestWriteAuthorityGuard_CustomWhitelist(t *testing.T) {
	os.Setenv("MIGRATION_READONLY", "true")
	defer os.Unsetenv("MIGRATION_READONLY")

	router := gin.New()
	router.Use(WriteAuthorityGuard(
		WithReadOnlyPaths([]string{"/status", "/api/v2/health"}),
	))
	router.POST("/status", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	// Custom whitelist path allowed
	w := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/status", nil)
	router.ServeHTTP(w, req)
	if w.Code == 405 {
		t.Errorf("expected custom whitelist /status to bypass, got 405")
	}

	// Default whitelist path should now be blocked (custom replaces default)
	w = httptest.NewRecorder()
	req = httptest.NewRequest("POST", "/healthz", nil)
	router.ServeHTTP(w, req)
	if w.Code != 405 {
		t.Errorf("expected default /healthz blocked under custom whitelist, got %d", w.Code)
	}
}

func TestWriteAuthorityGuard_ForceEnableOverride(t *testing.T) {
	// MIGRATION_READONLY=false but forceEnabled=true -> should block
	os.Setenv("MIGRATION_READONLY", "false")
	defer os.Unsetenv("MIGRATION_READONLY")

	router := gin.New()
	router.Use(WriteAuthorityGuard(WithReadOnlyForceEnabled(true)))
	router.POST("/items", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/items", nil)
	router.ServeHTTP(w, req)
	if w.Code != 405 {
		t.Errorf("expected 405 (force enabled), got %d", w.Code)
	}
}

func TestWriteAuthorityGuard_ForceDisableOverride(t *testing.T) {
	os.Setenv("MIGRATION_READONLY", "true")
	defer os.Unsetenv("MIGRATION_READONLY")

	router := gin.New()
	router.Use(WriteAuthorityGuard(WithReadOnlyForceEnabled(false)))
	router.POST("/items", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/items", nil)
	router.ServeHTTP(w, req)
	if w.Code != 200 {
		t.Errorf("expected 200 (force disabled), got %d", w.Code)
	}
}

func TestWriteAuthorityGuard_EnvCaseInsensitive(t *testing.T) {
	for _, val := range []string{"TRUE", "True", "true", "  true  "} {
		os.Setenv("MIGRATION_READONLY", val)
		router := gin.New()
		router.Use(WriteAuthorityGuard())
		router.POST("/items", func(c *gin.Context) {
			c.JSON(200, gin.H{"ok": true})
		})

		w := httptest.NewRecorder()
		req := httptest.NewRequest("POST", "/items", nil)
		router.ServeHTTP(w, req)
		if w.Code != 405 {
			t.Errorf("MIGRATION_READONLY=%q: expected 405, got %d", val, w.Code)
		}
	}
	os.Unsetenv("MIGRATION_READONLY")

	// Non-true values should not enable
	for _, val := range []string{"false", "0", "yes", ""} {
		os.Setenv("MIGRATION_READONLY", val)
		router := gin.New()
		router.Use(WriteAuthorityGuard())
		router.POST("/items", func(c *gin.Context) {
			c.JSON(200, gin.H{"ok": true})
		})

		w := httptest.NewRecorder()
		req := httptest.NewRequest("POST", "/items", nil)
		router.ServeHTTP(w, req)
		// We don't check exact 200 here because POST route is registered as POST only;
		// just verify it didn't get 405 from the guard
		if w.Code == 405 {
			t.Errorf("MIGRATION_READONLY=%q: expected not 405, got %d", val, w.Code)
		}
	}
	os.Unsetenv("MIGRATION_READONLY")
}

func TestWriteAuthorityGuard_WhitelistPrefix(t *testing.T) {
	os.Setenv("MIGRATION_READONLY", "true")
	defer os.Unsetenv("MIGRATION_READONLY")

	router := gin.New()
	router.Use(WriteAuthorityGuard())

	// /metrics/foo should be whitelisted (prefix match)
	router.POST("/metrics/foo", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/metrics/foo", nil)
	router.ServeHTTP(w, req)
	if w.Code == 405 {
		t.Errorf("expected /metrics/foo to be whitelisted (prefix), got 405")
	}
}
