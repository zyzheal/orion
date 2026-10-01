package service

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"go.uber.org/zap"
)

func TestNewGatewayDynamicRoutes(t *testing.T) {
	g := NewGatewayDynamicRoutes(zap.NewNop())
	if g == nil {
		t.Fatal("expected non-nil GatewayDynamicRoutes")
	}
	if g.GetActiveRouteCount() != 0 {
		t.Errorf("expected 0 active routes, got %d", g.GetActiveRouteCount())
	}
}

func TestRegisterRoute(t *testing.T) {
	g := NewGatewayDynamicRoutes(zap.NewNop())
	cfg := &DynamicRouteConfig{
		ID:         "test-route",
		ServiceName: "test-svc",
		Prefix:     "/api/test",
		Target:     "http://localhost:3001",
		Timeout:    30 * time.Second,
		StripPrefix: true,
		Status:     RouteActive,
	}
	if !g.RegisterRoute(cfg) {
		t.Error("expected registration to succeed")
	}
	if g.GetActiveRouteCount() != 1 {
		t.Errorf("expected 1 active route, got %d", g.GetActiveRouteCount())
	}
}

func TestRegisterDuplicateRoute(t *testing.T) {
	g := NewGatewayDynamicRoutes(zap.NewNop())
	cfg := &DynamicRouteConfig{
		ID: "dup-route", ServiceName: "svc", Prefix: "/api/test",
		Target: "http://localhost:3001", Timeout: 30 * time.Second, Status: RouteActive,
	}
	g.RegisterRoute(cfg)
	if g.RegisterRoute(cfg) {
		t.Error("duplicate registration should return false")
	}
}

func TestUnregisterRoute(t *testing.T) {
	g := NewGatewayDynamicRoutes(zap.NewNop())
	cfg := &DynamicRouteConfig{
		ID: "route-1", ServiceName: "svc", Prefix: "/api/test",
		Target: "http://localhost:3001", Timeout: 30 * time.Second, Status: RouteActive,
	}
	g.RegisterRoute(cfg)
	if !g.UnregisterRoute("route-1") {
		t.Error("expected unregistration to succeed")
	}
	if g.GetActiveRouteCount() != 0 {
		t.Errorf("expected 0 active routes after unregister, got %d", g.GetActiveRouteCount())
	}
	if g.UnregisterRoute("nonexistent") {
		t.Error("unregistering nonexistent route should return false")
	}
}

func TestUpdateRoute(t *testing.T) {
	g := NewGatewayDynamicRoutes(zap.NewNop())
	cfg := &DynamicRouteConfig{
		ID: "route-1", ServiceName: "svc", Prefix: "/api/test",
		Target: "http://localhost:3001", Timeout: 30 * time.Second, Status: RouteActive,
	}
	g.RegisterRoute(cfg)

	updated, ok := g.UpdateRoute("route-1", map[string]interface{}{"target": "http://localhost:9999"})
	if !ok {
		t.Fatal("expected update to succeed")
	}
	if updated.Target != "http://localhost:9999" {
		t.Errorf("expected target http://localhost:9999, got %s", updated.Target)
	}

	updated2, ok := g.UpdateRoute("route-1", map[string]interface{}{"status": RouteMaintenance})
	if !ok {
		t.Fatal("expected status update to succeed")
	}
	if updated2.Status != RouteMaintenance {
		t.Errorf("expected status maintenance, got %s", updated2.Status)
	}

	_, ok = g.UpdateRoute("nonexistent", map[string]interface{}{"target": "http://test"})
	if ok {
		t.Error("updating nonexistent route should return false")
	}
}

func TestGetRoute(t *testing.T) {
	g := NewGatewayDynamicRoutes(zap.NewNop())
	cfg := &DynamicRouteConfig{
		ID: "route-1", ServiceName: "svc", Prefix: "/api/test",
		Target: "http://localhost:3001", Timeout: 30 * time.Second, Status: RouteActive,
	}
	g.RegisterRoute(cfg)

	found, ok := g.GetRoute("route-1")
	if !ok {
		t.Fatal("expected to find route")
	}
	if found.ID != "route-1" {
		t.Errorf("expected ID route-1, got %s", found.ID)
	}
	if found.ServiceName != "svc" {
		t.Errorf("expected ServiceName svc, got %s", found.ServiceName)
	}

	_, ok = g.GetRoute("nonexistent")
	if ok {
		t.Error("expected not to find nonexistent route")
	}
}

func TestListRoutes(t *testing.T) {
	g := NewGatewayDynamicRoutes(zap.NewNop())
	for i, prefix := range []string{"/api/a", "/api/b", "/api/c"} {
		g.RegisterRoute(&DynamicRouteConfig{
			ID: fmt.Sprintf("route-%d", i), ServiceName: "svc",
			Prefix: prefix, Target: "http://localhost:3001",
			Timeout: 30 * time.Second, Status: RouteActive,
		})
	}
	all := g.ListRoutes(ListRoutesOptions{})
	if len(all) != 3 {
		t.Errorf("expected 3 routes, got %d", len(all))
	}

	activeOnly := g.ListRoutes(ListRoutesOptions{Status: RouteActive})
	if len(activeOnly) != 3 {
		t.Errorf("expected 3 active routes, got %d", len(activeOnly))
	}

	// Set one to inactive
	g.UpdateRoute("route-0", map[string]interface{}{"status": RouteInactive})
	inactiveOnly := g.ListRoutes(ListRoutesOptions{Status: RouteInactive})
	if len(inactiveOnly) != 1 {
		t.Errorf("expected 1 inactive route, got %d", len(inactiveOnly))
	}
}

func TestSyncWithServiceRegistry(t *testing.T) {
	g := NewGatewayDynamicRoutes(zap.NewNop())
	services := []ServiceInfoLite{
		{Name: "platform", URL: "http://localhost:3001"},
		{Name: "pipeline", URL: "http://localhost:3002"},
	}
	urlMap := map[string]string{
		"platform": "http://localhost:3001",
		"pipeline": "http://localhost:3002",
	}
	count := g.SyncWithServiceRegistry(services, urlMap)
	if count == 0 {
		t.Error("expected at least one route to be synced")
	}
	if g.GetActiveRouteCount() == 0 {
		t.Error("expected active routes after sync")
	}
}

func TestDiscoverFromServiceRegistry(t *testing.T) {
	g := NewGatewayDynamicRoutes(zap.NewNop())
	services := []ServiceInfoLite{
		{
			Name:     "user-service",
			URL:      "http://localhost:3001",
			Metadata: map[string]interface{}{"api_paths": []string{"/api/users", "/api/users/health"}},
		},
	}
	urlMap := map[string]string{"user-service": "http://localhost:3001"}
	count := g.DiscoverFromServiceRegistry(services, urlMap)
	if count != 2 {
		t.Errorf("expected 2 routes discovered, got %d", count)
	}
}

func TestCheckServiceHealth(t *testing.T) {
	g := NewGatewayDynamicRoutes(zap.NewNop())

	healthy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer healthy.Close()
	if !g.checkServiceHealth(healthy.URL) {
		t.Error("expected healthy check to pass")
	}

	unhealthy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer unhealthy.Close()
	if g.checkServiceHealth(unhealthy.URL) {
		t.Error("expected unhealthy check to fail")
	}
}

func TestHealthCheckIntegration(t *testing.T) {
	g := NewGatewayDynamicRoutes(zap.NewNop())
	cfg := &DynamicRouteConfig{
		ID: "health-route", ServiceName: "svc", Prefix: "/api/test",
		Target: "http://localhost:9999", Timeout: 30 * time.Second, Status: RouteActive,
	}
	g.RegisterRoute(cfg)

	g.StartHealthCheckIntegration(100 * time.Millisecond)
	time.Sleep(300 * time.Millisecond)
	g.StopHealthCheckIntegration()

	// After health check on unreachable target, route should still exist
	_, ok := g.GetRoute("health-route")
	if !ok {
		t.Error("route should still exist after health check")
	}
}

func TestDefaultServiceRouteMappings(t *testing.T) {
	mappings := DefaultServiceRouteMappings()
	if len(mappings) == 0 {
		t.Error("expected non-empty default mappings")
	}
	// Verify each mapping has required fields
	for i, m := range mappings {
		if m.ServiceName == "" {
			t.Errorf("mapping %d has empty ServiceName", i)
		}
		if len(m.APIPaths) == 0 {
			t.Errorf("mapping %d has empty APIPaths", i)
		}
	}
}
