package routesync

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestNewSyncer(t *testing.T) {
	logger := zap.NewNop()
	s := NewSyncer("http://platform:3001", DomainServiceMap{
		"knowledge": "http://knowledge:8000",
	}, logger)
	if s == nil {
		t.Fatal("expected non-nil syncer")
	}
	if s.platformURL != "http://platform:3001" {
		t.Errorf("unexpected platformURL: %s", s.platformURL)
	}
	if s.httpClient == nil {
		t.Error("expected non-nil httpClient")
	}
}

func TestGetRegisteredPrefixesEmpty(t *testing.T) {
	logger := zap.NewNop()
	s := NewSyncer("http://localhost", nil, logger)
	prefixes := s.GetRegisteredPrefixes()
	if len(prefixes) != 0 {
		t.Errorf("expected 0 prefixes, got %d", len(prefixes))
	}
}

func TestIsRegisteredFalse(t *testing.T) {
	logger := zap.NewNop()
	s := NewSyncer("http://localhost", nil, logger)
	if s.IsRegistered("/api/v1/test") {
		t.Error("expected false for unregistered prefix")
	}
}

func TestIsRegisteredTrue(t *testing.T) {
	logger := zap.NewNop()
	s := NewSyncer("http://localhost", nil, logger)
	s.mu.Lock()
	s.registered["/api/v1/test"] = true
	s.mu.Unlock()
	if !s.IsRegistered("/api/v1/test") {
		t.Error("expected true for registered prefix")
	}
}

func TestDefaultAPIPathMap(t *testing.T) {
	paths := DefaultAPIPathMap["knowledge"]
	if len(paths) == 0 {
		t.Error("expected knowledge paths")
	}
	found := false
	for _, p := range paths {
		if p == "/api/v1/knowledge_base" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected /api/v1/knowledge_base in knowledge paths")
	}
}

func TestGetAPIPathsConfigured(t *testing.T) {
	logger := zap.NewNop()
	s := NewSyncer("http://localhost", nil, logger)
	subApp := SubAppConfig{APIPaths: []string{"/api/v1/custom"}}
	paths := s.getAPIPaths(subApp)
	if len(paths) != 1 || paths[0] != "/api/v1/custom" {
		t.Errorf("expected [/api/v1/custom], got %v", paths)
	}
}

func TestGetAPIPathsFallback(t *testing.T) {
	logger := zap.NewNop()
	s := NewSyncer("http://localhost", nil, logger)
	subApp := SubAppConfig{APIDomain: "knowledge"}
	paths := s.getAPIPaths(subApp)
	if len(paths) == 0 {
		t.Error("expected fallback paths for knowledge")
	}
}

func TestGetAPIPathsNone(t *testing.T) {
	logger := zap.NewNop()
	s := NewSyncer("http://localhost", nil, logger)
	subApp := SubAppConfig{APIDomain: "unknown"}
	paths := s.getAPIPaths(subApp)
	if paths != nil {
		t.Errorf("expected nil, got %v", paths)
	}
}

func TestRegisterRoutesNoDomain(t *testing.T) {
	logger := zap.NewNop()
	s := NewSyncer("http://localhost", nil, logger)
	r := gin.New()
	subApp := SubAppConfig{ID: "test", Key: "test"} // no APIDomain
	count := s.RegisterRoutes(r, subApp)
	if count != 0 {
		t.Errorf("expected 0 routes, got %d", count)
	}
}

func TestRegisterRoutesNoMapping(t *testing.T) {
	logger := zap.NewNop()
	s := NewSyncer("http://localhost", DomainServiceMap{}, logger)
	r := gin.New()
	subApp := SubAppConfig{ID: "test", Key: "test", APIDomain: "unknown", APIPaths: []string{"/api/v1/test"}}
	count := s.RegisterRoutes(r, subApp)
	if count != 0 {
		t.Errorf("expected 0 routes, got %d", count)
	}
}

func TestRegisterRoutesSuccess(t *testing.T) {
	logger := zap.NewNop()
	s := NewSyncer("http://localhost", DomainServiceMap{
		"test": "http://upstream:8080",
	}, logger)
	r := gin.New()
	subApp := SubAppConfig{ID: "test", Key: "test", APIDomain: "test", APIPaths: []string{"/api/v1/test", "/api/v1/other"}}
	count := s.RegisterRoutes(r, subApp)
	if count != 2 {
		t.Errorf("expected 2 routes, got %d", count)
	}
	if !s.IsRegistered("/api/v1/test") {
		t.Error("expected /api/v1/test to be registered")
	}
}

func TestRegisterRoutesNoDuplicate(t *testing.T) {
	logger := zap.NewNop()
	s := NewSyncer("http://localhost", DomainServiceMap{
		"test": "http://upstream:8080",
	}, logger)
	r := gin.New()
	subApp := SubAppConfig{ID: "test", Key: "test", APIDomain: "test", APIPaths: []string{"/api/v1/test"}}
	count1 := s.RegisterRoutes(r, subApp)
	count2 := s.RegisterRoutes(r, subApp) // should skip duplicates
	if count1 != 1 {
		t.Errorf("first call: expected 1, got %d", count1)
	}
	if count2 != 0 {
		t.Errorf("second call: expected 0 (no duplicates), got %d", count2)
	}
}

func TestRegisterRoutesNoPaths(t *testing.T) {
	logger := zap.NewNop()
	s := NewSyncer("http://localhost", DomainServiceMap{
		"test": "http://upstream:8080",
	}, logger)
	r := gin.New()
	subApp := SubAppConfig{ID: "test", Key: "test", APIDomain: "test", APIPaths: nil}
	count := s.RegisterRoutes(r, subApp)
	if count != 0 {
		t.Errorf("expected 0 routes for nil paths, got %d", count)
	}
}

func TestSyncOnceSuccess(t *testing.T) {
	// Mock platform service
	platform := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/subapps/enabled" {
			http.NotFound(w, r)
			return
		}
		resp := map[string]interface{}{
			"success": true,
			"data": []map[string]interface{}{
				{
					"id":         "test-app",
					"name":       "Test App",
					"key":        "test",
					"api_domain": "test",
					"api_paths":  []string{"/api/v1/test"},
					"status":     "enabled",
				},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer platform.Close()

	logger := zap.NewNop()
	s := NewSyncer(platform.URL, DomainServiceMap{
		"test": "http://upstream:8080",
	}, logger)
	r := gin.New()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	total := s.SyncOnce(ctx, r)
	if total != 1 {
		t.Errorf("expected 1 route, got %d", total)
	}
}

func TestSyncOnceDisabledSubApp(t *testing.T) {
	platform := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"success": true,
			"data": []map[string]interface{}{
				{"id": "test", "key": "test", "api_domain": "test", "api_paths": []string{"/api/v1/test"}, "status": "disabled"},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer platform.Close()

	logger := zap.NewNop()
	s := NewSyncer(platform.URL, DomainServiceMap{"test": "http://upstream:8080"}, logger)
	r := gin.New()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	total := s.SyncOnce(ctx, r)
	if total != 0 {
		t.Errorf("expected 0 routes for disabled subapp, got %d", total)
	}
}

func TestSyncOncePlatformError(t *testing.T) {
	platform := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}))
	defer platform.Close()

	logger := zap.NewNop()
	s := NewSyncer(platform.URL, DomainServiceMap{}, logger)
	r := gin.New()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	total := s.SyncOnce(ctx, r)
	if total != 0 {
		t.Errorf("expected 0 routes on error, got %d", total)
	}
}

func TestSyncOnceUnsuccessfulResponse(t *testing.T) {
	platform := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{"success": false, "data": []interface{}{}}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer platform.Close()

	logger := zap.NewNop()
	s := NewSyncer(platform.URL, DomainServiceMap{}, logger)
	r := gin.New()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	total := s.SyncOnce(ctx, r)
	if total != 0 {
		t.Errorf("expected 0 routes on unsuccessful response, got %d", total)
	}
}

func TestStartPeriodicSyncStop(t *testing.T) {
	platform := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{"success": true, "data": []interface{}{}}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer platform.Close()

	logger := zap.NewNop()
	s := NewSyncer(platform.URL, DomainServiceMap{}, logger)
	r := gin.New()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	stop := s.StartPeriodicSync(ctx, r, 100*time.Millisecond)
	// Let it run briefly
	time.Sleep(250 * time.Millisecond)
	stop() // stop the sync
	// Verify it stopped (no panic)
}
