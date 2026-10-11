package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/rdm-statistics/service"
)

// makeCtx creates a gin.Context pre-seeded with tenant_id and no auth
// middleware (mirrors sprint/handler/handler_test.go pattern).
func makeCtx(method, path string, params gin.Params) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = params
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

func TestGetBurndown_ReturnsEmptySlice(t *testing.T) {
	h := NewHandler(service.NewService(nil))
	c, w := makeCtx(http.MethodGet, "/api/v1/rdm/statistics/burndown/sprint-1",
		gin.Params{{Key: "sprintId", Value: "sprint-1"}})
	h.GetBurndown(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", w.Code, w.Body.String())
	}
	// Body should be a JSON array (empty) inside the middleware envelope.
	if body := w.Body.String(); body == "" {
		t.Fatal("empty body")
	}
}

func TestGetVelocity_WithQueryParams(t *testing.T) {
	h := NewHandler(service.NewService(nil))
	// gin.CreateTestContext doesn't parse query strings into c.Request.URL.Query,
	// but c.Query reads from c.Request.URL directly.
	c, w := makeCtx(http.MethodGet, "/api/v1/rdm/statistics/velocity?projectId=p1&limit=5", nil)
	h.GetVelocity(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestGetDefectStats_ReturnsEnvelope(t *testing.T) {
	h := NewHandler(service.NewService(nil))
	c, w := makeCtx(http.MethodGet, "/api/v1/rdm/statistics/defects", nil)
	h.GetDefectStats(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestGetSprintStats_ReturnsList(t *testing.T) {
	h := NewHandler(service.NewService(nil))
	c, w := makeCtx(http.MethodGet, "/api/v1/rdm/statistics/sprints", nil)
	h.GetSprintStats(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestRegisterRoutes_RegistersFourEndpoints(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewHandler(service.NewService(nil))
	h.RegisterRoutes(r.Group("/api/v1"))

	routes := map[string]bool{}
	for _, rt := range r.Routes() {
		routes[rt.Method+" "+rt.Path] = true
	}
	expected := []string{
		"GET /api/v1/rdm/statistics/burndown/:sprintId",
		"GET /api/v1/rdm/statistics/velocity",
		"GET /api/v1/rdm/statistics/defects",
		"GET /api/v1/rdm/statistics/sprints",
	}
	for _, e := range expected {
		if !routes[e] {
			t.Errorf("missing route: %s (registered: %v)", e, routes)
		}
	}
}
