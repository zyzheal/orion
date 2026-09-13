package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/build-env/models"
	"orion/platform-svc-go/internal/build-env/service"

	"github.com/gin-gonic/gin"
)

func init() { gin.SetMode(gin.TestMode) }

// Handler tests drive a real *gin.Engine through ServeHTTP so the permission
// guards, the tenant guard and the status mapping all run. The previous file
// used gin.CreateTestContext with a second return value that does not exist,
// populated c.Params by hand and asserted only that the status code was below
// 500 — a 401, a 403, a 404, a 500 and a 200 all passed.

const (
	hdrTenant = "X-Test-Tenant"
	hdrUser   = "X-Test-User"
	hdrRole   = "X-Test-Role"
)

type fakeService struct {
	calls int

	// what the fake returns
	buildID    string
	imageID    string
	configID   string
	logID      string
	cacheID    string
	pipelineID string
	req        models.RecordCacheEventRequest
	limit      int
	offset     int
	level      string
	status     string

	// injectable failures
	getErr       error
	updateErr    error
	deleteErr    error
	listErr      error
	createErr    error
	eventErr     error
	dashboardErr error
	metricsErr   error
	healthErr    error
	impactErr    error
}

func (f *fakeService) enter() { f.calls++ }

func (f *fakeService) CreateBuild(ctx context.Context, tenantID string, req models.CreateBuildRequest) (*models.Build, error) {
	f.enter()
	if f.createErr != nil {
		return nil, f.createErr
	}
	return &models.Build{ID: "b-new", TenantID: tenantID, Name: req.Name, Status: "queued"}, nil
}

func (f *fakeService) GetBuild(ctx context.Context, tenantID, id string) (*models.Build, error) {
	f.enter()
	f.buildID = id
	if f.getErr != nil {
		return nil, f.getErr
	}
	return &models.Build{ID: id, TenantID: tenantID, Name: "b", Status: "success"}, nil
}

func (f *fakeService) ListBuilds(ctx context.Context, tenantID string, limit, offset int) ([]models.Build, error) {
	f.enter()
	f.limit, f.offset = limit, offset
	if f.listErr != nil {
		return nil, f.listErr
	}
	return []models.Build{{ID: "b-1", TenantID: tenantID}, {ID: "b-2", TenantID: tenantID}}, nil
}

func (f *fakeService) UpdateBuild(ctx context.Context, tenantID, id string, req models.UpdateBuildRequest) (*models.Build, error) {
	f.enter()
	f.buildID = id
	if f.updateErr != nil {
		return nil, f.updateErr
	}
	return &models.Build{ID: id, TenantID: tenantID, Name: deref(req.Name), Status: deref(req.Status)}, nil
}

func (f *fakeService) DeleteBuild(ctx context.Context, tenantID, id string) error {
	f.enter()
	f.buildID = id
	return f.deleteErr
}

func (f *fakeService) CreateBuildImage(ctx context.Context, tenantID string, req models.CreateBuildImageRequest) (*models.BuildImage, error) {
	f.enter()
	if f.createErr != nil {
		return nil, f.createErr
	}
	return &models.BuildImage{ID: "i-new", TenantID: tenantID, Name: req.Name}, nil
}

func (f *fakeService) GetBuildImage(ctx context.Context, tenantID, id string) (*models.BuildImage, error) {
	f.enter()
	f.imageID = id
	if f.getErr != nil {
		return nil, f.getErr
	}
	return &models.BuildImage{ID: id, TenantID: tenantID}, nil
}

func (f *fakeService) ListBuildImages(ctx context.Context, tenantID string, limit, offset int) ([]models.BuildImage, error) {
	f.enter()
	f.limit, f.offset = limit, offset
	if f.listErr != nil {
		return nil, f.listErr
	}
	return []models.BuildImage{{ID: "i-1", TenantID: tenantID}}, nil
}

func (f *fakeService) UpdateBuildImage(ctx context.Context, tenantID, id string, req models.UpdateBuildImageRequest) (*models.BuildImage, error) {
	f.enter()
	f.imageID = id
	if f.updateErr != nil {
		return nil, f.updateErr
	}
	return &models.BuildImage{ID: id, TenantID: tenantID, ImageTag: deref(req.ImageTag)}, nil
}

func (f *fakeService) DeleteBuildImage(ctx context.Context, tenantID, id string) error {
	f.enter()
	f.imageID = id
	return f.deleteErr
}

func (f *fakeService) CreateCacheConfig(ctx context.Context, tenantID string, req models.CreateBuildCacheConfigRequest) (*models.BuildCacheConfig, error) {
	f.enter()
	if f.createErr != nil {
		return nil, f.createErr
	}
	return &models.BuildCacheConfig{ID: "c-new", TenantID: tenantID, Name: req.Name, Status: "active"}, nil
}

func (f *fakeService) GetCacheConfig(ctx context.Context, tenantID, id string) (*models.BuildCacheConfig, error) {
	f.enter()
	f.configID = id
	if f.getErr != nil {
		return nil, f.getErr
	}
	return &models.BuildCacheConfig{ID: id, TenantID: tenantID}, nil
}

func (f *fakeService) ListCacheConfigs(ctx context.Context, tenantID, level, status string, limit, offset int) ([]models.BuildCacheConfig, error) {
	f.enter()
	f.level, f.status, f.limit, f.offset = level, status, limit, offset
	if f.listErr != nil {
		return nil, f.listErr
	}
	return []models.BuildCacheConfig{{ID: "c-1", TenantID: tenantID}}, nil
}

func (f *fakeService) UpdateCacheConfig(ctx context.Context, tenantID string, id string, req models.UpdateBuildCacheConfigRequest) (*models.BuildCacheConfig, error) {
	f.enter()
	f.configID = id
	if f.updateErr != nil {
		return nil, f.updateErr
	}
	return &models.BuildCacheConfig{ID: id, TenantID: tenantID, Level: deref(req.Level)}, nil
}

func (f *fakeService) DeleteCacheConfig(ctx context.Context, tenantID, id string) error {
	f.enter()
	f.configID = id
	return f.deleteErr
}

func (f *fakeService) ListBuildLogs(ctx context.Context, tenantID string, limit, offset int) ([]models.BuildLog, error) {
	f.enter()
	f.limit, f.offset = limit, offset
	if f.listErr != nil {
		return nil, f.listErr
	}
	return []models.BuildLog{{ID: "l-1", TenantID: tenantID}}, nil
}

func (f *fakeService) GetBuildLog(ctx context.Context, tenantID, id string) (*models.BuildLog, error) {
	f.enter()
	f.logID = id
	if f.getErr != nil {
		return nil, f.getErr
	}
	return &models.BuildLog{ID: id, TenantID: tenantID, BuildID: "b-1"}, nil
}

func (f *fakeService) GetDashboard(ctx context.Context, tenantID string) (*models.CacheDashboard, error) {
	f.enter()
	if f.dashboardErr != nil {
		return nil, f.dashboardErr
	}
	return &models.CacheDashboard{TotalConfigs: 2, ActiveConfigs: 1}, nil
}

func (f *fakeService) GetCacheMetrics(ctx context.Context, tenantID, cacheID string) (*models.CacheMetrics, error) {
	f.enter()
	f.cacheID = cacheID
	if f.metricsErr != nil {
		return nil, f.metricsErr
	}
	return &models.CacheMetrics{CacheID: cacheID, Hits: 9, HitRate: 0.9}, nil
}

func (f *fakeService) AssessCacheHealth(ctx context.Context, tenantID, cacheID string) (*models.CacheHealth, error) {
	f.enter()
	f.cacheID = cacheID
	return &models.CacheHealth{CacheID: cacheID, Healthy: true}, nil
}

func (f *fakeService) RecordCacheEvent(ctx context.Context, tenantID string, req models.RecordCacheEventRequest) error {
	f.enter()
	f.req = req
	f.cacheID = req.CacheID
	return f.eventErr
}

func (f *fakeService) AnalyzePerformanceImpact(ctx context.Context, tenantID, pipelineID string) (*models.CachePerformanceImpact, error) {
	f.enter()
	f.pipelineID = pipelineID
	return &models.CachePerformanceImpact{PipelineID: pipelineID, TotalBuilds: 5}, nil
}

func hasKey(m map[string]any, k string) bool {
	_, ok := m[k]
	return ok
}

func deref(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

// headerSource stands in for the JWT middleware. It writes the exact context
// keys orion-go-common/pkg/auth writes and reads them per request, so one router
// serves every tenant and role combination. roles is a []string because that
// is the type auth.GetRoles expects; a plain string falls back to the singular
// "role" key.
func headerSource() gin.HandlerFunc {
	return func(c *gin.Context) {
		if v := c.GetHeader(hdrTenant); v != "" {
			c.Set("tenant_id", v)
		}
		if v := c.GetHeader(hdrUser); v != "" {
			c.Set("user_id", v)
		}
		if v := c.GetHeader(hdrRole); v != "" {
			roles := make([]string, 0, 4)
			for _, r := range strings.Split(v, ",") {
				if r = strings.TrimSpace(r); r != "" {
					roles = append(roles, r)
				}
			}
			c.Set("roles", roles)
		}
		c.Next()
	}
}

func buildRouter(svc *fakeService) *gin.Engine {
	e := gin.New()
	e.Use(headerSource())
	(&Handler{svc: svc}).RegisterRoutes(e.Group("/api/v1"))
	return e
}

func doReq(t *testing.T, e *gin.Engine, method, target, body string, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	var r *http.Request
	if body == "" {
		r, _ = http.NewRequest(method, target, nil)
	} else {
		r, _ = http.NewRequest(method, target, strings.NewReader(body))
	}
	for k, v := range headers {
		r.Header.Set(k, v)
	}
	rr := httptest.NewRecorder()
	e.ServeHTTP(rr, r)
	return rr
}

func envOf(t *testing.T, rr *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	if rr.Body.Len() == 0 {
		return nil
	}
	var m map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &m); err != nil {
		t.Fatalf("response body is not JSON: %v\n%s", err, rr.Body.String())
	}
	return m
}

func authHeader(tenant, role string) map[string]string {
	h := map[string]string{hdrTenant: tenant, hdrUser: "u-1"}
	if role != "" {
		h[hdrRole] = role
	}
	return h
}

// --- Route mounting ---

func TestRegistersAllTwentyTwoRoutes(t *testing.T) {
	e := buildRouter(&fakeService{})
	mounted := 0
	for _, r := range e.Routes() {
		if strings.Contains(r.Path, "/build-env") {
			mounted++
		}
	}
	if mounted != 22 {
		t.Fatalf("RegisterRoutes mounted %d build-env routes, want 22", mounted)
	}
}

var everyRoute = []struct {
	method string
	target string
	body   string
}{
	{"GET", "/api/v1/build-env/builds", ""},
	{"GET", "/api/v1/build-env/builds/b-1", ""},
	{"POST", "/api/v1/build-env/builds", `{"name":"b"}`},
	{"PUT", "/api/v1/build-env/builds/b-1", `{"status":"success"}`},
	{"DELETE", "/api/v1/build-env/builds/b-1", ""},
	{"GET", "/api/v1/build-env/build-images", ""},
	{"GET", "/api/v1/build-env/build-images/i-1", ""},
	{"POST", "/api/v1/build-env/build-images", `{"name":"i"}`},
	{"PUT", "/api/v1/build-env/build-images/i-1", `{"image_tag":"v2"}`},
	{"DELETE", "/api/v1/build-env/build-images/i-1", ""},
	{"GET", "/api/v1/build-env/build-cache", ""},
	{"GET", "/api/v1/build-env/build-cache/c-1", ""},
	{"POST", "/api/v1/build-env/build-cache", `{"name":"c"}`},
	{"PUT", "/api/v1/build-env/build-cache/c-1", `{"level":"remote"}`},
	{"DELETE", "/api/v1/build-env/build-cache/c-1", ""},
	{"GET", "/api/v1/build-env/build-logs", ""},
	{"GET", "/api/v1/build-env/build-logs/l-1", ""},
	{"GET", "/api/v1/build-env/cache-monitor/dashboard", ""},
	{"GET", "/api/v1/build-env/cache-monitor/metrics/cache-1", ""},
	{"GET", "/api/v1/build-env/cache-monitor/health/cache-1", ""},
	{"GET", "/api/v1/build-env/cache-monitor/impact/p-1", ""},
	{"POST", "/api/v1/build-env/cache-monitor/event", `{"cache_id":"cache-1","event_type":"hit"}`},
}

func TestEveryRouteRequiresATenant(t *testing.T) {
	for _, r := range everyRoute {
		f := &fakeService{}
		e := buildRouter(f)
		rr := doReq(t, e, r.method, r.target, r.body, authHeader("", "admin"))

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("%s %s without a tenant = %d, want 401", r.method, r.target, rr.Code)
			continue
		}
		if env := envOf(t, rr); env == nil || env["error"] != "tenant_id required" {
			t.Errorf("%s %s error = %v, want the tenant_id required message", r.method, r.target, env)
		}
		if f.calls != 0 {
			t.Errorf("%s %s reached the service %d time(s) with no tenant", r.method, r.target, f.calls)
		}
	}
}

func TestRouteWithoutARoleIsForbidden(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	rr := doReq(t, e, "GET", "/api/v1/build-env/builds", "", authHeader("t-1", ""))

	if rr.Code != http.StatusForbidden {
		t.Fatalf("a role-less caller = %d, want 403", rr.Code)
	}
	if env := envOf(t, rr); env == nil || env["error"] != "no role assigned" {
		t.Fatalf("error = %v, want no role assigned", env)
	}
	if f.calls != 0 {
		t.Fatalf("a guarded route reached the service %d time(s)", f.calls)
	}
}

func TestAdminRolePassesEveryRoute(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	for _, r := range everyRoute {
		rr := doReq(t, e, r.method, r.target, r.body, authHeader("t-1", "admin"))
		if rr.Code == http.StatusForbidden || rr.Code == http.StatusUnauthorized {
			t.Errorf("%s %s with role admin = %d, body %s", r.method, r.target, rr.Code, rr.Body.String())
		}
	}
	if f.calls == 0 {
		t.Fatalf("no request reached the service")
	}
}

// --- Reads ---

func TestGetBuildReturnsTheEnvelope(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	rr := doReq(t, e, "GET", "/api/v1/build-env/builds/b-1", "", authHeader("t-1", "admin"))

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rr.Code, rr.Body.String())
	}
	env := envOf(t, rr)
	if env["success"] != true {
		t.Fatalf("envelope success = %v", env["success"])
	}
	if data, _ := env["data"].(map[string]any); data == nil || data["id"] != "b-1" {
		t.Fatalf("envelope data = %v, want the build", env["data"])
	}
	if f.buildID != "b-1" {
		t.Fatalf("the path parameter reached the service as %q", f.buildID)
	}
}

func TestGetBuildMissingIDIs404(t *testing.T) {
	// sql.ErrNoRows used to surface as a 500 with a driver error string, so the
	// 404 branch here was dead.
	f := &fakeService{getErr: fmt.Errorf("build b-1 not found: %w", sentinel.NotFound)}
	e := buildRouter(f)
	rr := doReq(t, e, "GET", "/api/v1/build-env/builds/b-1", "", authHeader("t-1", "admin"))

	if rr.Code != http.StatusNotFound {
		t.Fatalf("status = %d, body %s", rr.Code, rr.Body.String())
	}
	if env := envOf(t, rr); env == nil || env["error"] != "build not found" {
		t.Fatalf("error = %v, want the handler's build not found message", env)
	}
}

func TestGetCacheConfigMissingIs404(t *testing.T) {
	f := &fakeService{getErr: fmt.Errorf("cache config c-1 not found: %w", sentinel.NotFound)}
	e := buildRouter(f)
	rr := doReq(t, e, "GET", "/api/v1/build-env/build-cache/c-1", "", authHeader("t-1", "admin"))
	if rr.Code != http.StatusNotFound {
		t.Fatalf("status = %d", rr.Code)
	}
	if env := envOf(t, rr); env == nil || env["error"] != "cache config not found" {
		t.Fatalf("error = %v", env)
	}
}

func TestGetBuildImageMissingIs404(t *testing.T) {
	f := &fakeService{getErr: fmt.Errorf("build image i-1 not found: %w", sentinel.NotFound)}
	e := buildRouter(f)
	rr := doReq(t, e, "GET", "/api/v1/build-env/build-images/i-1", "", authHeader("t-1", "admin"))
	if rr.Code != http.StatusNotFound {
		t.Fatalf("status = %d", rr.Code)
	}
	if env := envOf(t, rr); env == nil || env["error"] != "build image not found" {
		t.Fatalf("error = %v", env)
	}
}

func TestGetBuildLogMissingIs404(t *testing.T) {
	f := &fakeService{getErr: fmt.Errorf("build log l-1 not found: %w", sentinel.NotFound)}
	e := buildRouter(f)
	rr := doReq(t, e, "GET", "/api/v1/build-env/build-logs/l-1", "", authHeader("t-1", "admin"))
	if rr.Code != http.StatusNotFound {
		t.Fatalf("status = %d", rr.Code)
	}
	if env := envOf(t, rr); env == nil || env["error"] != "build log not found" {
		t.Fatalf("error = %v", env)
	}
}

func TestListBuildsReturnsTotalAndBindsPagination(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	rr := doReq(t, e, "GET", "/api/v1/build-env/builds?limit=25&offset=10", "", authHeader("t-1", "admin"))

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rr.Code, rr.Body.String())
	}
	if data, _ := envOf(t, rr)["data"].(map[string]any); data == nil || data["total"] != float64(2) {
		t.Fatalf("total = %v, want 2", envOf(t, rr)["data"])
	}
	if f.limit != 25 || f.offset != 10 {
		t.Fatalf("the service saw limit=%d offset=%d, want 25/10", f.limit, f.offset)
	}
}

func TestPageIsAcceptedAsAnOffsetAlias(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	rr := doReq(t, e, "GET", "/api/v1/build-env/builds?page=3&limit=10", "", authHeader("t-1", "admin"))
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rr.Code, rr.Body.String())
	}
	if f.limit != 10 || f.offset != 20 {
		t.Fatalf("page=3 limit=10 gave limit=%d offset=%d, want 10/20", f.limit, f.offset)
	}
}

func TestOffsetWinsWhenBothPageAndOffsetAreGiven(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	rr := doReq(t, e, "GET", "/api/v1/build-env/builds?offset=5&page=3&limit=10", "", authHeader("t-1", "admin"))
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rr.Code, rr.Body.String())
	}
	if f.offset != 5 {
		t.Fatalf("offset given together with page gave %d, want the explicit 5", f.offset)
	}
}

func TestListUsesTheSharedDefaultLimit(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	rr := doReq(t, e, "GET", "/api/v1/build-env/build-images", "", authHeader("t-1", "admin"))
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d", rr.Code)
	}
	if f.limit != defaultListLimit {
		t.Fatalf("the default limit was %d, want %d", f.limit, defaultListLimit)
	}
}

func TestListCacheConfigFiltersReachTheService(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	rr := doReq(t, e, "GET", "/api/v1/build-env/build-cache?level=remote&status=active&limit=20&offset=0", "", authHeader("t-1", "admin"))
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rr.Code, rr.Body.String())
	}
	if f.level != "remote" || f.status != "active" {
		t.Fatalf("the service saw level=%q status=%q", f.level, f.status)
	}
}

func TestListBuildLogsUsesTheLogKey(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	rr := doReq(t, e, "GET", "/api/v1/build-env/build-logs", "", authHeader("t-1", "admin"))
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d", rr.Code)
	}
	data, _ := envOf(t, rr)["data"].(map[string]any)
	if data == nil || !hasKey(data, "logs") {
		t.Fatalf("the log list envelope = %v, want a logs key", envOf(t, rr)["data"])
	}
}

func TestListBuildsWrapsTheItemsKey(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	rr := doReq(t, e, "GET", "/api/v1/build-env/builds", "", authHeader("t-1", "admin"))
	data, _ := envOf(t, rr)["data"].(map[string]any)
	if data == nil || !hasKey(data, "builds") {
		t.Fatalf("the build list envelope = %v, want a builds key", envOf(t, rr)["data"])
	}
}

func TestListBuildImagesUsesTheImagesKey(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	rr := doReq(t, e, "GET", "/api/v1/build-env/build-images", "", authHeader("t-1", "admin"))
	data, _ := envOf(t, rr)["data"].(map[string]any)
	if data == nil || !hasKey(data, "images") {
		t.Fatalf("the image list envelope = %v, want an images key", envOf(t, rr)["data"])
	}
}

func TestListCacheConfigsUsesTheConfigsKey(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	rr := doReq(t, e, "GET", "/api/v1/build-env/build-cache", "", authHeader("t-1", "admin"))
	data, _ := envOf(t, rr)["data"].(map[string]any)
	if data == nil || !hasKey(data, "configs") {
		t.Fatalf("the config list envelope = %v, want a configs key", envOf(t, rr)["data"])
	}
}

// --- Writes ---

func TestCreateBuildIs201WithTheQueuedDefault(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	rr := doReq(t, e, "POST", "/api/v1/build-env/builds", `{"name":"b"}`, authHeader("t-1", "admin"))

	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d, body %s", rr.Code, rr.Body.String())
	}
	data, _ := envOf(t, rr)["data"].(map[string]any)
	if data == nil || data["id"] != "b-new" || data["status"] != "queued" {
		t.Fatalf("envelope data = %v, want the created build", envOf(t, rr)["data"])
	}
}

func TestCreateBuildRequiresAName(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	rr := doReq(t, e, "POST", "/api/v1/build-env/builds", `{}`, authHeader("t-1", "admin"))
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body %s", rr.Code, rr.Body.String())
	}
	if f.calls != 0 {
		t.Fatalf("an unbound request reached the service %d time(s)", f.calls)
	}
}

func TestCreateBuildImageIs201(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	rr := doReq(t, e, "POST", "/api/v1/build-env/build-images", `{"name":"i"}`, authHeader("t-1", "admin"))
	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d, body %s", rr.Code, rr.Body.String())
	}
}

func TestCreateCacheConfigIs201(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	rr := doReq(t, e, "POST", "/api/v1/build-env/build-cache", `{"name":"c","level":"remote"}`, authHeader("t-1", "admin"))
	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d, body %s", rr.Code, rr.Body.String())
	}
}

func TestUpdateBuildIs200WithTheChangedRow(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	rr := doReq(t, e, "PUT", "/api/v1/build-env/builds/b-1", `{"status":"success"}`, authHeader("t-1", "admin"))

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rr.Code, rr.Body.String())
	}
	data, _ := envOf(t, rr)["data"].(map[string]any)
	if data == nil || data["status"] != "success" {
		t.Fatalf("envelope data = %v, want the row that was written", envOf(t, rr)["data"])
	}
}

func TestUpdateBuildImageIs200WithTheChangedRow(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	rr := doReq(t, e, "PUT", "/api/v1/build-env/build-images/i-1", `{"image_tag":"v2"}`, authHeader("t-1", "admin"))
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rr.Code, rr.Body.String())
	}
	data, _ := envOf(t, rr)["data"].(map[string]any)
	if data == nil || data["image_tag"] != "v2" {
		t.Fatalf("envelope data = %v, want the row that was written", envOf(t, rr)["data"])
	}
}

func TestUpdateCacheConfigIs200WithTheChangedRow(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	rr := doReq(t, e, "PUT", "/api/v1/build-env/build-cache/c-1", `{"level":"remote"}`, authHeader("t-1", "admin"))
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rr.Code, rr.Body.String())
	}
	data, _ := envOf(t, rr)["data"].(map[string]any)
	if data == nil || data["level"] != "remote" {
		t.Fatalf("envelope data = %v, want the row that was written", envOf(t, rr)["data"])
	}
}

func TestUpdateBuildWithAnEmptyBodyIs400(t *testing.T) {
	// The old repository ran SET updated_at = NOW() on an unmodified row and
	// reported success, so this request answered 200 and looked like a write.
	f := &fakeService{updateErr: fmt.Errorf("update build: %w", sentinel.BadRequest)}
	e := buildRouter(f)
	rr := doReq(t, e, "PUT", "/api/v1/build-env/builds/b-1", `{}`, authHeader("t-1", "admin"))
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body %s", rr.Code, rr.Body.String())
	}
}

func TestUpdateBuildImageWithAnEmptyBodyIs400(t *testing.T) {
	f := &fakeService{updateErr: fmt.Errorf("update build image: %w", sentinel.BadRequest)}
	e := buildRouter(f)
	rr := doReq(t, e, "PUT", "/api/v1/build-env/build-images/i-1", `{}`, authHeader("t-1", "admin"))
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body %s", rr.Code, rr.Body.String())
	}
}

func TestUpdateCacheConfigWithAnEmptyBodyIs400(t *testing.T) {
	f := &fakeService{updateErr: fmt.Errorf("update cache config: %w", sentinel.BadRequest)}
	e := buildRouter(f)
	rr := doReq(t, e, "PUT", "/api/v1/build-env/build-cache/c-1", `{}`, authHeader("t-1", "admin"))
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body %s", rr.Code, rr.Body.String())
	}
}

func TestUpdateBuildOfAMissingRowIs404(t *testing.T) {
	f := &fakeService{updateErr: fmt.Errorf("build not found: %w", sentinel.NotFound)}
	e := buildRouter(f)
	rr := doReq(t, e, "PUT", "/api/v1/build-env/builds/b-1", `{"status":"success"}`, authHeader("t-1", "admin"))
	if rr.Code != http.StatusNotFound {
		t.Fatalf("status = %d, body %s", rr.Code, rr.Body.String())
	}
}

func TestDeleteBuildOfARowThatExistedIs204(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	rr := doReq(t, e, "DELETE", "/api/v1/build-env/builds/b-1", "", authHeader("t-1", "admin"))

	if rr.Code != http.StatusNoContent {
		t.Fatalf("status = %d", rr.Code)
	}
	if rr.Body.Len() != 0 {
		t.Fatalf("a 204 must have no body, got %q", rr.Body.String())
	}
	if f.buildID != "b-1" {
		t.Fatalf("the service saw id %q", f.buildID)
	}
}

func TestDeleteBuildOfAMissingRowIs404(t *testing.T) {
	// Zero rows affected means the id was guessed or belongs to another tenant.
	// Both used to answer 204, so a caller could confirm a delete it did not make.
	f := &fakeService{deleteErr: fmt.Errorf("build not found: %w", sentinel.NotFound)}
	e := buildRouter(f)
	rr := doReq(t, e, "DELETE", "/api/v1/build-env/builds/b-1", "", authHeader("t-1", "admin"))
	if rr.Code != http.StatusNotFound {
		t.Fatalf("status = %d, body %s", rr.Code, rr.Body.String())
	}
}

func TestDeleteBuildImageOfAMissingRowIs404(t *testing.T) {
	f := &fakeService{deleteErr: fmt.Errorf("build image not found: %w", sentinel.NotFound)}
	e := buildRouter(f)
	rr := doReq(t, e, "DELETE", "/api/v1/build-env/build-images/i-1", "", authHeader("t-1", "admin"))
	if rr.Code != http.StatusNotFound {
		t.Fatalf("status = %d", rr.Code)
	}
}

func TestDeleteCacheConfigOfARowThatExistedIs204(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	rr := doReq(t, e, "DELETE", "/api/v1/build-env/build-cache/c-1", "", authHeader("t-1", "admin"))
	if rr.Code != http.StatusNoContent {
		t.Fatalf("status = %d", rr.Code)
	}
	if f.configID != "c-1" {
		t.Fatalf("the service saw id %q", f.configID)
	}
}

func TestDeleteCacheConfigOfAMissingRowIs404(t *testing.T) {
	f := &fakeService{deleteErr: fmt.Errorf("cache config not found: %w", sentinel.NotFound)}
	e := buildRouter(f)
	rr := doReq(t, e, "DELETE", "/api/v1/build-env/build-cache/c-1", "", authHeader("t-1", "admin"))
	if rr.Code != http.StatusNotFound {
		t.Fatalf("status = %d", rr.Code)
	}
}

// --- Cache monitor ---

func TestCacheDashboardIs200(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	rr := doReq(t, e, "GET", "/api/v1/build-env/cache-monitor/dashboard", "", authHeader("t-1", "admin"))
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rr.Code, rr.Body.String())
	}
	data, _ := envOf(t, rr)["data"].(map[string]any)
	if data == nil || data["total_configs"] != float64(2) {
		t.Fatalf("envelope data = %v", envOf(t, rr)["data"])
	}
}

func TestCacheMetricsPassesTheCacheID(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	rr := doReq(t, e, "GET", "/api/v1/build-env/cache-monitor/metrics/cache-remote-1", "", authHeader("t-1", "admin"))
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rr.Code, rr.Body.String())
	}
	if f.cacheID != "cache-remote-1" {
		t.Fatalf("the service saw cache id %q, want cache-remote-1", f.cacheID)
	}
}

func TestCacheHealthPassesTheCacheID(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	rr := doReq(t, e, "GET", "/api/v1/build-env/cache-monitor/health/cache-1", "", authHeader("t-1", "admin"))
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d", rr.Code)
	}
	if f.cacheID != "cache-1" {
		t.Fatalf("the service saw cache id %q", f.cacheID)
	}
}

func TestPerformanceImpactPassesThePipelineID(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	rr := doReq(t, e, "GET", "/api/v1/build-env/cache-monitor/impact/pipeline-9", "", authHeader("t-1", "admin"))
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rr.Code, rr.Body.String())
	}
	if f.pipelineID != "pipeline-9" {
		t.Fatalf("the service saw pipeline %q, want pipeline-9", f.pipelineID)
	}
}

func TestRecordCacheEventIs201AndForwardsAttribution(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	rr := doReq(t, e, "POST", "/api/v1/build-env/cache-monitor/event",
		`{"cache_id":"cache-1","event_type":"hit","latency_saved_ms":128.5,"pipeline_id":"pipeline-9","build_id":"build-42"}`,
		authHeader("t-1", "admin"))
	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d, body %s", rr.Code, rr.Body.String())
	}
	if f.req.CacheID != "cache-1" || f.req.EventType != "hit" {
		t.Fatalf("the service saw %+v", f.req)
	}
	if f.req.PipelineID == nil || *f.req.PipelineID != "pipeline-9" {
		t.Fatalf("pipeline_id did not reach the service: %v", f.req.PipelineID)
	}
	if f.req.BuildID == nil || *f.req.BuildID != "build-42" {
		t.Fatalf("build_id did not reach the service: %v", f.req.BuildID)
	}
	if f.req.LatencySavedMs == nil || *f.req.LatencySavedMs != 128.5 {
		t.Fatalf("latency_saved_ms did not reach the service: %v", f.req.LatencySavedMs)
	}
	data, _ := envOf(t, rr)["data"].(map[string]any)
	if data == nil || data["message"] != "cache event recorded" {
		t.Fatalf("envelope data = %v", envOf(t, rr)["data"])
	}
}

func TestRecordCacheEventRejectsAnUnknownEventType(t *testing.T) {
	// The table's aggregates count only hit, miss and evict, so any other value
	// would insert and then be invisible to every metric — a silent no-op write.
	f := &fakeService{eventErr: fmt.Errorf("invalid event type %q: %w", "probe", sentinel.BadRequest)}
	e := buildRouter(f)
	rr := doReq(t, e, "POST", "/api/v1/build-env/cache-monitor/event",
		`{"cache_id":"cache-1","event_type":"probe"}`, authHeader("t-1", "admin"))
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body %s", rr.Code, rr.Body.String())
	}
}

func TestRecordCacheEventRequiresACacheID(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	rr := doReq(t, e, "POST", "/api/v1/build-env/cache-monitor/event", `{"event_type":"hit"}`, authHeader("t-1", "admin"))
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", rr.Code)
	}
	if f.calls != 0 {
		t.Fatalf("an unbound request reached the service %d time(s)", f.calls)
	}
}

// --- Non-domain service errors stay 500s ---

func TestCreateBuildSurfacesAServiceErrorAs500(t *testing.T) {
	e := buildRouter(&fakeService{createErr: errors.New("boom")})
	rr := doReq(t, e, "POST", "/api/v1/build-env/builds", `{"name":"b"}`, authHeader("t-1", "admin"))
	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, body %s", rr.Code, rr.Body.String())
	}
	if env := envOf(t, rr); env == nil || env["success"] != false {
		t.Fatalf("envelope = %v, want success false", env)
	}
}

func TestListBuildsSurfacesAServiceErrorAs500(t *testing.T) {
	e := buildRouter(&fakeService{listErr: errors.New("boom")})
	rr := doReq(t, e, "GET", "/api/v1/build-env/builds", "", authHeader("t-1", "admin"))
	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d", rr.Code)
	}
}

func TestCacheDashboardSurfacesAServiceErrorAs500(t *testing.T) {
	e := buildRouter(&fakeService{dashboardErr: errors.New("boom")})
	rr := doReq(t, e, "GET", "/api/v1/build-env/cache-monitor/dashboard", "", authHeader("t-1", "admin"))
	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d", rr.Code)
	}
}

func TestCacheMetricsSurfacesAServiceErrorAs500(t *testing.T) {
	e := buildRouter(&fakeService{metricsErr: errors.New("boom")})
	rr := doReq(t, e, "GET", "/api/v1/build-env/cache-monitor/metrics/cache-1", "", authHeader("t-1", "admin"))
	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d", rr.Code)
	}
}

// --- The guard order is tenant then permission ---

func TestHandlerCanBeBuiltFromTheInterface(t *testing.T) {
	var svc service.ServiceInterface = &fakeService{}
	h := NewHandler(svc)
	if h == nil {
		t.Fatalf("NewHandler returned nil")
	}
}
