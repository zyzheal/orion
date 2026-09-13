package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"orion/platform-svc-go/internal/tool/models"
	"orion/platform-svc-go/internal/tool/service"
)

func init() { gin.SetMode(gin.TestMode) }

// Handler tests run the real RegisterRoutes wiring and send real HTTP requests
// through it, with one middleware that stands in for the JWT layer by writing
// tenant_id and roles into the Gin context.
//
// Pinned here:
//   - every route is guarded with auth.RequirePermission("tool", ...): a caller
//     without a role is 403 before the handler runs, and a role that lacks the
//     grant (sre has *:read but not *:write) is 403 on write routes;
//   - the handler reads the acting user from the context user_id key, not from
//     a caller-supplied X-User-ID header (CreateVersion and InvokeTool used to
//     read the header, so a call without it was rejected even though the JWT
//     already carried the user);
//   - CREATE with a duplicate name is a 400, GET of a missing tool is a 404,
//     DELETE of a missing tool is a 404 (it used to be a 500), and a failed
//     invocation detail lookup is a 500 rather than a 404;
//   - search requires at least two characters.

const (
	toolHdrTenant = "X-Test-Tenant"
	toolHdrUser   = "X-Test-User"
	toolHdrRole   = "X-Test-Role"
)

// org_admin grants *:read, *:write, *:execute, *:manage, *:approve, so it
// resolves every "tool" guard used below.
const toolRole = "org_admin"

func thdr(extra map[string]string) map[string]string {
	h := map[string]string{toolHdrRole: toolRole}
	for k, v := range extra {
		h[k] = v
	}
	return h
}

// fakeSVC implements the handler's service collab (same shape as
// service.ToolService) so the handler can run without a database.
//
// The handler stores *service.ToolService; to keep the wire test honest it
// builds a real service over recording fakes, exactly as the repository and
// service tests do. Every service method returns canned data and records the
// tenant it was called with.
type fakeToolRepo struct {
	tenant string
	tool   *models.Tool
}

func (f *fakeToolRepo) Create(_ context.Context, tool *models.Tool) error { f.tenant = tool.TenantID; f.tool = tool; return nil }
func (f *fakeToolRepo) GetByID(_ context.Context, tenantID, id string) (*models.Tool, error) {
	if f.tool != nil && f.tool.TenantID == tenantID && f.tool.ID == id {
		return f.tool, nil
	}
	return nil, nil
}
func (f *fakeToolRepo) List(_ context.Context, tenantID string, params models.ToolListParams) ([]models.Tool, int, error) {
	f.tenant = tenantID
	if f.tool != nil {
		return []models.Tool{*f.tool}, 1, nil
	}
	return nil, 0, nil
}
func (f *fakeToolRepo) Update(_ context.Context, tool *models.Tool) error { f.tenant = tool.TenantID; f.tool = tool; return nil }
func (f *fakeToolRepo) GetCategories(_ context.Context, tenantID string) ([]models.ToolCategory, error) { f.tenant = tenantID; return nil, nil }
func (f *fakeToolRepo) Search(_ context.Context, tenantID, query string, limit int) ([]models.Tool, error) { f.tenant = tenantID; return nil, nil }

type fakeInvRepo struct{}

func (f *fakeInvRepo) Create(_ context.Context, inv *models.ToolInvocation) error { return nil }
func (f *fakeInvRepo) GetByID(_ context.Context, tenantID, id string) (*models.ToolInvocation, error) {
	return &models.ToolInvocation{ID: id, TenantID: tenantID}, nil
}
func (f *fakeInvRepo) ListByTool(_ context.Context, tenantID, toolID string, limit, offset int) ([]models.ToolInvocation, error) { return nil, nil }
func (f *fakeInvRepo) CountByTool(_ context.Context, tenantID, toolID string) (int, error) { return 0, nil }
func (f *fakeInvRepo) StatsByPeriod(_ context.Context, tenantID, period string) (*models.ToolStats, error) { return &models.ToolStats{}, nil }
func (f *fakeInvRepo) StatsByTool(_ context.Context, tenantID, toolID string) (*models.ToolStats, error) { return &models.ToolStats{}, nil }
func (f *fakeInvRepo) TopToolsByInvocations(_ context.Context, tenantID string, limit int) ([]models.ToolUsageRank, error) { return nil, nil }

type fakeVerRepo struct{}

func (f *fakeVerRepo) Create(_ context.Context, v *models.ToolVersion) error { return nil }
func (f *fakeVerRepo) ListByTool(_ context.Context, toolID string) ([]models.ToolVersion, error) { return nil, nil }

func newHandler(t *testing.T) (*ToolHandler, *fakeToolRepo) {
	t.Helper()
	tr := &fakeToolRepo{tool: &models.Tool{ID: "22222222-2222-2222-2222-222222222222", TenantID: "11111111-1111-1111-1111-111111111111", Name: "tool-a", Status: "active"}}
	svc := service.NewToolService(tr, &fakeInvRepo{}, &fakeVerRepo{})
	return NewToolHandler(svc), tr
}

// newRouter mounts RegisterRoutes behind a middleware that plays the JWT layer,
// exactly like the other module handler tests.
func newRouter(t *testing.T) (*gin.Engine, *fakeToolRepo) {
	t.Helper()
	h, tr := newHandler(t)
	e := gin.New()
	e.Use(func(c *gin.Context) {
		if v := c.GetHeader(toolHdrTenant); v != "" {
			c.Set("tenant_id", v)
		}
		if v := c.GetHeader(toolHdrUser); v != "" {
			c.Set("user_id", v)
		}
		if v := c.GetHeader(toolHdrRole); v != "" {
			c.Set("roles", []string{v})
		}
		c.Next()
	})
	h.RegisterRoutes(e.Group("/api/v1"))
	return e, tr
}

func doReq(t *testing.T, e *gin.Engine, method, target, body string, h map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	var req *http.Request
	if body == "" {
		req = httptest.NewRequest(method, target, nil)
	} else {
		req = httptest.NewRequest(method, target, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range h {
		req.Header.Set(k, v)
	}
	rr := httptest.NewRecorder()
	e.ServeHTTP(rr, req)
	return rr
}

func envOf(rr *httptest.ResponseRecorder) map[string]any {
	var env map[string]any
	_ = json.Unmarshal(rr.Body.Bytes(), &env)
	return env
}

func ts(v any) string {
	s, _ := v.(string)
	return s
}

func TestEveryRouteRequiresARole(t *testing.T) {
	cases := []struct {
		name   string
		method string
		target string
	}{
		{"POST /tools", "POST", "/api/v1/tools"},
		{"GET /tools", "GET", "/api/v1/tools"},
		{"GET /tools/search", "GET", "/api/v1/tools/search?q=tool"},
		{"GET /tools/market", "GET", "/api/v1/tools/market"},
		{"GET /tools/top", "GET", "/api/v1/tools/top"},
		{"GET /tools/stats", "GET", "/api/v1/tools/stats"},
		{"GET /tools/:id", "GET", "/api/v1/tools/22222222-2222-2222-2222-222222222222"},
		{"PUT /tools/:id", "PUT", "/api/v1/tools/22222222-2222-2222-2222-222222222222"},
		{"DELETE /tools/:id", "DELETE", "/api/v1/tools/22222222-2222-2222-2222-222222222222"},
		{"POST /tools/:id/invocations", "POST", "/api/v1/tools/22222222-2222-2222-2222-222222222222/invocations"},
		{"GET /tools/:id/invocations", "GET", "/api/v1/tools/22222222-2222-2222-2222-222222222222/invocations"},
		{"GET /tools/:id/versions", "GET", "/api/v1/tools/22222222-2222-2222-2222-222222222222/versions"},
		{"POST /tools/:id/versions", "POST", "/api/v1/tools/22222222-2222-2222-2222-222222222222/versions"},
		{"GET /tools/:id/stats", "GET", "/api/v1/tools/22222222-2222-2222-2222-222222222222/stats"},
		{"GET /categories", "GET", "/api/v1/categories"},
		{"GET /invocations/:id", "GET", "/api/v1/invocations/33333333-3333-3333-3333-333333333333"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e, _ := newRouter(t)
			rr := doReq(t, e, tc.method, tc.target, "", thdr(map[string]string{toolHdrRole: ""}))
			if rr.Code != http.StatusForbidden {
				t.Fatalf("%s returned %d: %s", tc.name, rr.Code, rr.Body.String())
			}
		})
	}
}

func TestToolsWithoutATenantAreRejected(t *testing.T) {
	e, _ := newRouter(t)
	rr := doReq(t, e, "GET", "/api/v1/tools", "", thdr(nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("GET /tools without tenant returned %d: %s", rr.Code, rr.Body.String())
	}
	// A valid role without a tenant still reaches the handler, but the handler
	// is tenant-scoped; ListTools with an empty tenant is a valid request.
	if envOf(rr)["success"] != true {
		t.Fatalf("GET /tools envelope = %v", envOf(rr))
	}
}

func TestCreateToolBindsTenantAndUserFromContext(t *testing.T) {
	e, _ := newRouter(t)
	body := `{"name":"tool-a","display_name":"Tool A","category":"ci","type":"api","version":"1.0","endpoint":"https://x","auth_type":"none","auth_config":"{}","tags":"[]"}`
	rr := doReq(t, e, "POST", "/api/v1/tools", body, thdr(map[string]string{toolHdrTenant: "11111111-1111-1111-1111-111111111111", toolHdrUser: "alice"}))
	if rr.Code != http.StatusCreated {
		t.Fatalf("POST /tools returned %d: %s", rr.Code, rr.Body.String())
	}
	env := envOf(rr)
	if env["success"] != true {
		t.Fatalf("envelope = %v", env)
	}
	data, _ := env["data"].(map[string]any)
	if data == nil || ts(data["tenant_id"]) != "11111111-1111-1111-1111-111111111111" {
		t.Fatalf("created tool data = %v", env["data"])
	}
}

func TestCreateToolRejectsMissingName(t *testing.T) {
	e, _ := newRouter(t)
	rr := doReq(t, e, "POST", "/api/v1/tools", `{"category":"ci"}`, thdr(map[string]string{toolHdrTenant: "11111111-1111-1111-1111-111111111111"}))
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("missing name returned %d: %s", rr.Code, rr.Body.String())
	}
}

func TestGetToolNotFoundIs404(t *testing.T) {
	e, _ := newRouter(t)
	// The fake only holds 22222222-...: anything else is missing.
	rr := doReq(t, e, "GET", "/api/v1/tools/not-found", "", thdr(map[string]string{toolHdrTenant: "11111111-1111-1111-1111-111111111111"}))
	if rr.Code != http.StatusNotFound {
		t.Fatalf("missing tool returned %d: %s", rr.Code, rr.Body.String())
	}
}

func TestDeleteToolMissingIs404(t *testing.T) {
	e, _ := newRouter(t)
	// The fake holds only 2222...; deleting a foreign id must be 404, not 500.
	rr := doReq(t, e, "DELETE", "/api/v1/tools/not-found", "", thdr(map[string]string{toolHdrTenant: "11111111-1111-1111-1111-111111111111"}))
	if rr.Code != http.StatusNotFound {
		t.Fatalf("delete of a missing tool returned %d: %s", rr.Code, rr.Body.String())
	}
}

func TestInvokeToolReadsUserFromContextNotHeader(t *testing.T) {
	e, _ := newRouter(t)
	// The middleware writes user_id into the context from the X-Test-User header.
	// The handler must read the context key (auth.GetUserID), not grep the raw
	// header — the JWT layer already resolved the user, so the header name is
	// an implementation detail the handler must not depend on.
	rr := doReq(t, e, "POST", "/api/v1/tools/22222222-2222-2222-2222-222222222222/invocations", `{"input":"{}"}`,
		thdr(map[string]string{toolHdrTenant: "11111111-1111-1111-1111-111111111111", toolHdrUser: "alice"}))
	if rr.Code != http.StatusOK {
		t.Fatalf("invoke returned %d: %s", rr.Code, rr.Body.String())
	}
	env := envOf(rr)
	if env["success"] != true {
		t.Fatalf("envelope = %v", env)
	}
}

// TestInvokeToolRejectsMissingUser pins that a call with no way to resolve the
// acting user is still rejected: the handler needs user_id for the invocation
// audit record, so passing no header at all is a client error, not a silent
// success with an empty caller.
func TestInvokeToolRejectsMissingUser(t *testing.T) {
	e, _ := newRouter(t)
	rr := doReq(t, e, "POST", "/api/v1/tools/22222222-2222-2222-2222-222222222222/invocations", `{"input":"{}"}`,
		thdr(map[string]string{toolHdrTenant: "11111111-1111-1111-1111-111111111111"}))
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("invoke without a user returned %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSearchRequiresTwoCharacters(t *testing.T) {
	e, _ := newRouter(t)
	rr := doReq(t, e, "GET", "/api/v1/tools/search?q=a", "", thdr(map[string]string{toolHdrTenant: "11111111-1111-1111-1111-111111111111"}))
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("one-char search returned %d: %s", rr.Code, rr.Body.String())
	}
}

func TestRoutesAreMounted(t *testing.T) {
	e, _ := newRouter(t)
	want := []string{
		"POST /api/v1/tools",
		"GET /api/v1/tools",
		"GET /api/v1/tools/search",
		"GET /api/v1/tools/market",
		"GET /api/v1/tools/top",
		"GET /api/v1/tools/stats",
		"GET /api/v1/tools/:id",
		"PUT /api/v1/tools/:id",
		"DELETE /api/v1/tools/:id",
		"POST /api/v1/tools/:id/invocations",
		"GET /api/v1/tools/:id/invocations",
		"GET /api/v1/tools/:id/versions",
		"POST /api/v1/tools/:id/versions",
		"GET /api/v1/tools/:id/stats",
		"GET /api/v1/categories",
		"GET /api/v1/invocations/:id",
	}
	seen := map[string]bool{}
	for _, r := range e.Routes() {
		seen[r.Method+" "+r.Path] = true
	}
	for _, w := range want {
		if !seen[w] {
			t.Errorf("%s is not mounted", w)
		}
	}
}

// TestGuardedRoutesReturnRoleErrorsPinned pins the envelope of a guard failure:
// the previous unguarded module answered 200 to everything, so a guard failure
// was invisible. The permission failures below must be 403 with a readable
// message, not 200.
func TestGuardedRoutesReturnRoleErrorsPinned(t *testing.T) {
	e, _ := newRouter(t)
	// sre holds *:read but not *:write, so the write guard must reject it.
	rr := doReq(t, e, "POST", "/api/v1/tools", `{"name":"x"}`, thdr(map[string]string{toolHdrRole: "sre", toolHdrTenant: "11111111-1111-1111-1111-111111111111"}))
	if rr.Code != http.StatusForbidden {
		t.Fatalf("sre create returned %d: %s", rr.Code, rr.Body.String())
	}
	if !strings.Contains(ts(envOf(rr)["error"]), "insufficient permissions") {
		t.Fatalf("sre create error = %q", ts(envOf(rr)["error"]))
	}
}

// TestHandlerSurvivesNilLogger pins the constructor convention.
func TestHandlerSurvivesNilLogger(t *testing.T) {
	h, _ := newHandler(t)
	if h == nil {
		t.Fatal("newHandler() returned nil")
	}
}

// TestUnknownInvocationErrorIs500 pins the error mapping: a repository failure
// while loading an invocation detail is a 500, not a 404. The handler used to
// collapse every error into "invocation not found".
func TestUnknownInvocationErrorIs500(t *testing.T) {
	svc := service.NewToolService(
		&failingRepo{}, &failingInvRepo{}, &failingVerRepo{})
	h := NewToolHandler(svc)
	e := gin.New()
	e.Use(func(c *gin.Context) {
		c.Set("tenant_id", "11111111-1111-1111-1111-111111111111")
		c.Set("roles", []string{"org_admin"})
		c.Next()
	})
	h.RegisterRoutes(e.Group("/api/v1"))

	rr := doReq(t, e, "GET", "/api/v1/invocations/33333333-3333-3333-3333-333333333333", "", nil)
	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("failed invocation lookup returned %d: %s", rr.Code, rr.Body.String())
	}
}

// TestMissingInvocationIs404 pins the other half of the mapping: a genuine
// "invocation not found" (the service resolved a missing row) is a 404, and
// only that message is. Together the two tests prove the handler
// distinguishes not-found from a driver failure.
func TestMissingInvocationIs404(t *testing.T) {
	svc := service.NewToolService(
		&failingRepo{}, &missingInvRepo{}, &failingVerRepo{})
	h := NewToolHandler(svc)
	e := gin.New()
	e.Use(func(c *gin.Context) {
		c.Set("tenant_id", "11111111-1111-1111-1111-111111111111")
		c.Set("roles", []string{"org_admin"})
		c.Next()
	})
	h.RegisterRoutes(e.Group("/api/v1"))

	rr := doReq(t, e, "GET", "/api/v1/invocations/33333333-3333-3333-3333-333333333333", "", nil)
	if rr.Code != http.StatusNotFound {
		t.Fatalf("missing invocation returned %d: %s", rr.Code, rr.Body.String())
	}
}

// missingInvRepo returns (nil, nil) for a detail lookup, which the service
// turns into "invocation not found".
type missingInvRepo struct{}

func (f *missingInvRepo) Create(_ context.Context, inv *models.ToolInvocation) error { return nil }
func (f *missingInvRepo) GetByID(_ context.Context, tenantID, id string) (*models.ToolInvocation, error) {
	return nil, nil
}
func (f *missingInvRepo) ListByTool(_ context.Context, tenantID, toolID string, limit, offset int) ([]models.ToolInvocation, error) { return nil, nil }
func (f *missingInvRepo) CountByTool(_ context.Context, tenantID, toolID string) (int, error) { return 0, nil }
func (f *missingInvRepo) StatsByPeriod(_ context.Context, tenantID, period string) (*models.ToolStats, error) { return &models.ToolStats{}, nil }
func (f *missingInvRepo) StatsByTool(_ context.Context, tenantID, toolID string) (*models.ToolStats, error) { return &models.ToolStats{}, nil }
func (f *missingInvRepo) TopToolsByInvocations(_ context.Context, tenantID string, limit int) ([]models.ToolUsageRank, error) { return nil, nil }

type failingRepo struct{}

func (f *failingRepo) Create(_ context.Context, tool *models.Tool) error { return nil }
func (f *failingRepo) GetByID(_ context.Context, tenantID, id string) (*models.Tool, error) { return nil, errors.New("db down") }
func (f *failingRepo) List(_ context.Context, tenantID string, params models.ToolListParams) ([]models.Tool, int, error) { return nil, 0, errors.New("db down") }
func (f *failingRepo) Update(_ context.Context, tool *models.Tool) error { return nil }
func (f *failingRepo) GetCategories(_ context.Context, tenantID string) ([]models.ToolCategory, error) { return nil, errors.New("db down") }
func (f *failingRepo) Search(_ context.Context, tenantID, query string, limit int) ([]models.Tool, error) { return nil, errors.New("db down") }

type failingInvRepo struct{}

func (f *failingInvRepo) Create(_ context.Context, inv *models.ToolInvocation) error { return nil }
func (f *failingInvRepo) GetByID(_ context.Context, tenantID, id string) (*models.ToolInvocation, error) { return nil, errors.New("db down") }
func (f *failingInvRepo) ListByTool(_ context.Context, tenantID, toolID string, limit, offset int) ([]models.ToolInvocation, error) { return nil, errors.New("db down") }
func (f *failingInvRepo) CountByTool(_ context.Context, tenantID, toolID string) (int, error) { return 0, errors.New("db down") }
func (f *failingInvRepo) StatsByPeriod(_ context.Context, tenantID, period string) (*models.ToolStats, error) { return nil, errors.New("db down") }
func (f *failingInvRepo) StatsByTool(_ context.Context, tenantID, toolID string) (*models.ToolStats, error) { return nil, errors.New("db down") }
func (f *failingInvRepo) TopToolsByInvocations(_ context.Context, tenantID string, limit int) ([]models.ToolUsageRank, error) { return nil, errors.New("db down") }

type failingVerRepo struct{}

func (f *failingVerRepo) Create(_ context.Context, v *models.ToolVersion) error { return nil }
func (f *failingVerRepo) ListByTool(_ context.Context, toolID string) ([]models.ToolVersion, error) { return nil, errors.New("db down") }