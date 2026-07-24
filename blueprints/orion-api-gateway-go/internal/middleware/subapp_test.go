package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestSubAppAuth_InjectsHeaders(t *testing.T) {
	r := gin.New()
	r.Use(func(c *gin.Context) {
		// Simulate JWTAuth setting user info
		c.Set("user_id", "user-123")
		c.Set("user_email", "test@example.com")
		c.Set("user_roles", []interface{}{"admin", "developer"})
		c.Set("user_permissions", []interface{}{"pipeline:create", "pipeline:read"})
		c.Set("tenant_id", "tenant-abc")
		c.Next()
	})
	r.Use(SubAppAuth(SubAppAuthConfig{}))
	r.GET("/test", func(c *gin.Context) {
		c.String(200, "ok")
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	r.ServeHTTP(w, req)

	if req.Header.Get("X-User-Id") != "user-123" {
		t.Errorf("expected X-User-Id=user-123, got %s", req.Header.Get("X-User-Id"))
	}
	if req.Header.Get("X-Username") != "test@example.com" {
		t.Errorf("expected X-Username=test@example.com, got %s", req.Header.Get("X-Username"))
	}
	if req.Header.Get("X-User-Roles") != "admin,developer" {
		t.Errorf("expected X-User-Roles=admin,developer, got %s", req.Header.Get("X-User-Roles"))
	}
	if req.Header.Get("X-User-Permissions") != "pipeline:create,pipeline:read" {
		t.Errorf("expected X-User-Permissions, got %s", req.Header.Get("X-User-Permissions"))
	}
	if req.Header.Get("X-Tenant-Id") != "tenant-abc" {
		t.Errorf("expected X-Tenant-Id=tenant-abc, got %s", req.Header.Get("X-Tenant-Id"))
	}
}

func TestSubAppAuth_SkipsWhenNotAuthenticated(t *testing.T) {
	r := gin.New()
	r.Use(SubAppAuth(SubAppAuthConfig{}))
	r.GET("/test", func(c *gin.Context) {
		c.String(200, "ok")
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	r.ServeHTTP(w, req)

	if req.Header.Get("X-User-Id") != "" {
		t.Error("expected no X-User-Id when not authenticated")
	}
}

func TestSubAppAuth_PrefixFilter(t *testing.T) {
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("user_id", "user-123")
		c.Next()
	})
	r.Use(SubAppAuth(SubAppAuthConfig{
		Prefixes: []string{"/api/v1/knowledge"},
	}))
	r.GET("/api/v1/other/test", func(c *gin.Context) { c.String(200, "ok") })
	r.GET("/api/v1/knowledge/test", func(c *gin.Context) { c.String(200, "ok") })

	// Non-matching prefix
	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/api/v1/other/test", nil)
	r.ServeHTTP(w, req)
	if req.Header.Get("X-User-Id") != "" {
		t.Error("expected no injection for non-matching prefix")
	}

	// Matching prefix
	w = httptest.NewRecorder()
	req = httptest.NewRequest("GET", "/api/v1/knowledge/test", nil)
	r.ServeHTTP(w, req)
	if req.Header.Get("X-User-Id") != "user-123" {
		t.Error("expected injection for matching prefix")
	}
}

func TestVerifySubAppUser(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("GET", "/", nil)
	c.Request.Header.Set("X-User-Id", "user-123")
	c.Request.Header.Set("X-Username", "test@example.com")
	c.Request.Header.Set("X-User-Roles", "admin,developer")
	c.Request.Header.Set("X-Tenant-Id", "tenant-abc")

	user := VerifySubAppUser(c)
	if user == nil {
		t.Fatal("expected user, got nil")
	}
	if user.UserID != "user-123" {
		t.Errorf("expected user-123, got %s", user.UserID)
	}
	if len(user.Roles) != 2 {
		t.Errorf("expected 2 roles, got %d", len(user.Roles))
	}
	if user.TenantID != "tenant-abc" {
		t.Errorf("expected tenant-abc, got %s", user.TenantID)
	}
}

func TestVerifySubAppUser_Nil(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("GET", "/", nil)

	user := VerifySubAppUser(c)
	if user != nil {
		t.Error("expected nil when no headers present")
	}
}

func TestRequireSubAppAuth(t *testing.T) {
	r := gin.New()
	r.Use(RequireSubAppAuth())
	r.GET("/test", func(c *gin.Context) { c.String(200, "ok") })

	// Without headers - should 401
	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}

	// With headers - should pass
	w = httptest.NewRecorder()
	req = httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-User-Id", "user-123")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}
