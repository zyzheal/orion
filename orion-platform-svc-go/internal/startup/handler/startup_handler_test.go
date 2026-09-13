package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/startup/models"

	"github.com/gin-gonic/gin"
)

// Sentinel values the fake service returns, classified by the fake's own
// Is* methods exactly like the real manager's classifiers do.
var (
	errNotFound  = sentinel.NotFound
	errUnhealthy = errors.New("module probe failed")
	errConflict  = errors.New("duplicate dependency")
	errOutage    = errors.New("connection refused")
)

// listArgs records the pagination arguments the handler derived from the
// request so a test can fail if a query parameter is dropped.
type listArgs struct {
	tenant string
	offset int
	limit  int
}

type fakeService struct {
	progress map[string]interface{}
	startErr error
	stopErr  error

	createResult *models.StartupModule
	createErr    error
	listItems    []models.StartupModule
	listTotal    int
	listErr      error
	getResult    *models.StartupModule
	getErr       error
	updateResult *models.StartupModule
	updateErr    error
	deleteErr    error
	initResult   *models.StartupModule
	initErr      error
	healthOK     bool
	healthErr    error
	depResult    *models.StartupDependency
	depErr       error

	listArgs    []listArgs
	tenants     []string
	ids         []string
	dependsOns  []string
	creates     []*models.CreateModuleRequest
	updates     []*models.UpdateModuleRequest
	methodCalls []string
}

func (f *fakeService) Start(ctx context.Context, tenantID string) error {
	f.methodCalls = append(f.methodCalls, "Start")
	f.tenants = append(f.tenants, tenantID)
	return f.startErr
}

func (f *fakeService) Stop(ctx context.Context) error {
	f.methodCalls = append(f.methodCalls, "Stop")
	return f.stopErr
}

func (f *fakeService) CreateModuleRow(ctx context.Context, tenantID string, req *models.CreateModuleRequest) (*models.StartupModule, error) {
	f.methodCalls = append(f.methodCalls, "CreateModuleRow")
	f.tenants = append(f.tenants, tenantID)
	f.creates = append(f.creates, req)
	return f.createResult, f.createErr
}

func (f *fakeService) ListModules(ctx context.Context, tenantID string, offset, limit int) ([]models.StartupModule, int, error) {
	f.methodCalls = append(f.methodCalls, "ListModules")
	f.listArgs = append(f.listArgs, listArgs{tenant: tenantID, offset: offset, limit: limit})
	return f.listItems, f.listTotal, f.listErr
}

func (f *fakeService) GetModuleByID(ctx context.Context, tenantID, id string) (*models.StartupModule, error) {
	f.methodCalls = append(f.methodCalls, "GetModuleByID")
	f.tenants = append(f.tenants, tenantID)
	f.ids = append(f.ids, id)
	return f.getResult, f.getErr
}

func (f *fakeService) UpdateModuleRow(ctx context.Context, tenantID, id string, req *models.UpdateModuleRequest) (*models.StartupModule, error) {
	f.methodCalls = append(f.methodCalls, "UpdateModuleRow")
	f.tenants = append(f.tenants, tenantID)
	f.ids = append(f.ids, id)
	f.updates = append(f.updates, req)
	return f.updateResult, f.updateErr
}

func (f *fakeService) DeleteModule(ctx context.Context, tenantID, id string) error {
	f.methodCalls = append(f.methodCalls, "DeleteModule")
	f.tenants = append(f.tenants, tenantID)
	f.ids = append(f.ids, id)
	return f.deleteErr
}

func (f *fakeService) InitModule(ctx context.Context, tenantID, id string) (*models.StartupModule, error) {
	f.methodCalls = append(f.methodCalls, "InitModule")
	f.tenants = append(f.tenants, tenantID)
	f.ids = append(f.ids, id)
	return f.initResult, f.initErr
}

func (f *fakeService) HealthCheckModule(ctx context.Context, tenantID, id string) (bool, error) {
	f.methodCalls = append(f.methodCalls, "HealthCheckModule")
	f.tenants = append(f.tenants, tenantID)
	f.ids = append(f.ids, id)
	return f.healthOK, f.healthErr
}

func (f *fakeService) AddDependency(ctx context.Context, tenantID, id, dependsOn string) (*models.StartupDependency, error) {
	f.methodCalls = append(f.methodCalls, "AddDependency")
	f.tenants = append(f.tenants, tenantID)
	f.ids = append(f.ids, id)
	f.dependsOns = append(f.dependsOns, dependsOn)
	return f.depResult, f.depErr
}

func (f *fakeService) GetStartupProgress() map[string]interface{} {
	f.methodCalls = append(f.methodCalls, "GetStartupProgress")
	return f.progress
}

func (f *fakeService) IsNotFound(err error) bool  { return errors.Is(err, errNotFound) }
func (f *fakeService) IsUnhealthy(err error) bool { return errors.Is(err, errUnhealthy) }
func (f *fakeService) IsConflict(err error) bool  { return errors.Is(err, errConflict) }

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

func newRouter(svc Service, roles []string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("tenant_id", "t1")
		if len(roles) > 0 {
			c.Set("roles", roles)
		}
		c.Next()
	})
	NewHandler(svc).RegisterRoutes(r.Group("/api/v1"))
	return r
}

func doReq(r *gin.Engine, method, path string, body any) *httptest.ResponseRecorder {
	var payload []byte
	if body != nil {
		payload, _ = json.Marshal(body)
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(payload))
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec
}

// adminRole / viewerRole mirror the auth middleware's roles contract: GetRoles
// reads c.Get("roles") as []string before falling back to the legacy "role".
const adminRole = "admin"

type envelope struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data"`
	Error   string      `json:"error"`
	Code    string      `json:"code"`
}

func decode(t *testing.T, rec *httptest.ResponseRecorder) envelope {
	t.Helper()
	var env envelope
	if err := json.Unmarshal(rec.Body.Bytes(), &env); err != nil {
		t.Fatalf("response body %q is not an envelope: %v", rec.Body.String(), err)
	}
	return env
}

func dataMap(t *testing.T, env envelope) map[string]interface{} {
	t.Helper()
	m, ok := env.Data.(map[string]interface{})
	if !ok {
		t.Fatalf("envelope data = %#v, want an object", env.Data)
	}
	return m
}

func TestListModules_PassesTheCallerTenantAndDerivedPagination(t *testing.T) {
	f := &fakeService{listItems: []models.StartupModule{{ID: "m-1", Name: "web"}}, listTotal: 42}
	rec := doReq(newRouter(f, []string{adminRole}), http.MethodGet, "/api/v1/startup/modules?page=3&page_size=25", nil)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body %s", rec.Code, rec.Body.String())
	}
	if len(f.listArgs) != 1 {
		t.Fatalf("service called %d times, want 1: %v", len(f.listArgs), f.listArgs)
	}
	got := f.listArgs[0]
	if got != (listArgs{tenant: "t1", offset: 50, limit: 25}) {
		t.Fatalf("pagination = %+v, want offset 50 limit 25 from page=3 page_size=25", got)
	}

	env := decode(t, rec)
	if !env.Success || env.Error != "" {
		t.Fatalf("envelope = %+v, want a success", env)
	}
	data := dataMap(t, env)
	if data["offset"] != float64(50) || data["limit"] != float64(25) || data["total"] != float64(42) {
		t.Fatalf("page fields = offset %v limit %v total %v", data["offset"], data["limit"], data["total"])
	}
	items, ok := data["data"].([]interface{})
	if !ok || len(items) != 1 {
		t.Fatalf("data = %v, want the one row returned by the service", data["data"])
	}
}

func TestListModules_DefaultsAndClamping(t *testing.T) {
	for _, tc := range []struct {
		query string
		page  int
		limit int
	}{
		{"", 1, 20},
		{"page=2", 2, 20},
		{"page_size=5", 1, 5},
		{"page_size=100", 1, 100},
		{"page_size=101", 1, 20},
		{"page_size=500", 1, 20},
		{"page_size=0", 1, 20},
		{"page=0&page_size=1", 1, 1},
		{"page=-4", 1, 20},
		{"page=abc", 1, 20},
	} {
		t.Run("query="+tc.query, func(t *testing.T) {
			f := &fakeService{}
			path := "/api/v1/startup/modules"
			if tc.query != "" {
				path += "?" + tc.query
			}
			rec := doReq(newRouter(f, []string{adminRole}), http.MethodGet, path, nil)
			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d body %s", rec.Code, rec.Body.String())
			}
			if len(f.listArgs) != 1 {
				t.Fatalf("service called %d times", len(f.listArgs))
			}
			if f.listArgs[0].offset != (tc.page-1)*tc.limit || f.listArgs[0].limit != tc.limit {
				t.Fatalf("args = %+v, want offset %d limit %d", f.listArgs[0], (tc.page-1)*tc.limit, tc.limit)
			}
		})
	}
}

func TestListModules_NeverReturnsANilSlice(t *testing.T) {
	f := &fakeService{listItems: []models.StartupModule{}}
	rec := doReq(newRouter(f, []string{adminRole}), http.MethodGet, "/api/v1/startup/modules", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	env := decode(t, rec)
	items, ok := env.Data.(map[string]interface{})["data"]
	if !ok {
		t.Fatalf("missing data field in %s", rec.Body.String())
	}
	if arr, ok := items.([]interface{}); !ok || len(arr) != 0 {
		t.Fatalf("data = %v (%T), want an empty array rather than null", items, items)
	}
}

func TestListModules_ServiceErrorIs500(t *testing.T) {
	f := &fakeService{listErr: errOutage}
	rec := doReq(newRouter(f, []string{adminRole}), http.MethodGet, "/api/v1/startup/modules", nil)
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d", rec.Code)
	}
	env := decode(t, rec)
	if env.Success || env.Code != "INTERNAL_ERROR" || env.Error != "connection refused" {
		t.Fatalf("envelope = %+v", env)
	}
}

func TestGetModule_ThreeOutcomes(t *testing.T) {
	cases := []struct {
		name    string
		err     error
		want    int
		wantErr string
	}{
		{"found", nil, http.StatusOK, ""},
		{"missing", errNotFound, http.StatusNotFound, "startup module not found"},
		{"outage", errOutage, http.StatusInternalServerError, "connection refused"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := &fakeService{getResult: &models.StartupModule{ID: "m-1", Name: "web"}, getErr: tc.err}
			rec := doReq(newRouter(f, []string{adminRole}), http.MethodGet, "/api/v1/startup/modules/m-1", nil)
			if rec.Code != tc.want {
				t.Fatalf("status = %d, want %d (body %s)", rec.Code, tc.want, rec.Body.String())
			}
			env := decode(t, rec)
			if tc.want == http.StatusOK {
				if !env.Success || dataMap(t, env)["name"] != "web" {
					t.Fatalf("envelope = %+v", env)
				}
			} else if env.Error != tc.wantErr {
				t.Fatalf("error = %q, want %q", env.Error, tc.wantErr)
			}
		})
	}
}

func TestDeleteModule_ThreeOutcomes(t *testing.T) {
	for _, tc := range []struct {
		name string
		err  error
		want int
	}{
		{"deleted", nil, http.StatusNoContent},
		{"missing", errNotFound, http.StatusNotFound},
		{"outage", errOutage, http.StatusInternalServerError},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := &fakeService{deleteErr: tc.err}
			rec := doReq(newRouter(f, []string{adminRole}), http.MethodDelete, "/api/v1/startup/modules/m-7", nil)
			if rec.Code != tc.want {
				t.Fatalf("status = %d, want %d (body %s)", rec.Code, tc.want, rec.Body.String())
			}
			if len(f.ids) != 1 || f.ids[0] != "m-7" || len(f.tenants) != 1 || f.tenants[0] != "t1" {
				t.Fatalf("service saw ids=%v tenants=%v", f.ids, f.tenants)
			}
		})
	}
}

func TestHealthCheckModule_Outcomes(t *testing.T) {
	t.Run("healthy", func(t *testing.T) {
		f := &fakeService{healthOK: true}
		rec := doReq(newRouter(f, []string{adminRole}), http.MethodPost, "/api/v1/startup/modules/m-1/health", nil)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d", rec.Code)
		}
		data := dataMap(t, decode(t, rec))
		if data["healthy"] != true || data["module"] != "m-1" {
			t.Fatalf("data = %v", data)
		}
		if _, ok := data["reason"]; ok {
			t.Fatalf("a healthy answer must not carry a reason: %v", data)
		}
	})

	// A probe that ran and reported unhealthy without raising an error is a
	// valid answer: the handler must relay the verdict, never rewrite it to
	// true. The manager currently only returns false together with an error,
	// but the bool return still allows (false, nil) and this pins it.
	t.Run("negative_verdict_without_error_stays_negative", func(t *testing.T) {
		f := &fakeService{healthOK: false}
		rec := doReq(newRouter(f, []string{adminRole}), http.MethodPost, "/api/v1/startup/modules/m-1/health", nil)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d", rec.Code)
		}
		data := dataMap(t, decode(t, rec))
		if data["healthy"] != false || data["module"] != "m-1" {
			t.Fatalf("data = %v, want healthy=false for a negative verdict", data)
		}
	})

	t.Run("unhealthy_is_a_200_with_a_reason", func(t *testing.T) {
		f := &fakeService{healthErr: errUnhealthy}
		rec := doReq(newRouter(f, []string{adminRole}), http.MethodPost, "/api/v1/startup/modules/m-1/health", nil)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200: an unhealthy probe is an answer, not a failure", rec.Code)
		}
		data := dataMap(t, decode(t, rec))
		if data["healthy"] != false || data["module"] != "m-1" || data["reason"] != "module probe failed" {
			t.Fatalf("data = %v", data)
		}
	})

	t.Run("missing_module_is_404", func(t *testing.T) {
		f := &fakeService{healthErr: errNotFound}
		rec := doReq(newRouter(f, []string{adminRole}), http.MethodPost, "/api/v1/startup/modules/nope/health", nil)
		env := decode(t, rec)
		if rec.Code != http.StatusNotFound || env.Code != "NOT_FOUND" {
			t.Fatalf("status=%d env=%+v", rec.Code, env)
		}
	})

	t.Run("outage_is_500", func(t *testing.T) {
		f := &fakeService{healthErr: errOutage}
		rec := doReq(newRouter(f, []string{adminRole}), http.MethodPost, "/api/v1/startup/modules/m-1/health", nil)
		env := decode(t, rec)
		if rec.Code != http.StatusInternalServerError || env.Code != "INTERNAL_ERROR" {
			t.Fatalf("status=%d env=%+v", rec.Code, env)
		}
	})
}

func TestAddDependency_Outcomes(t *testing.T) {
	t.Run("created", func(t *testing.T) {
		f := &fakeService{depResult: &models.StartupDependency{ID: "d-1", ModuleID: "web", DependsOn: "core"}}
		rec := doReq(newRouter(f, []string{adminRole}), http.MethodPost, "/api/v1/startup/modules/m-1/depends",
			models.CreateDependencyRequest{DependsOn: "core"})
		if rec.Code != http.StatusCreated {
			t.Fatalf("status = %d body %s", rec.Code, rec.Body.String())
		}
		if len(f.dependsOns) != 1 || f.dependsOns[0] != "core" {
			t.Fatalf("service saw depends_on=%v", f.dependsOns)
		}
		if len(f.ids) != 1 || f.ids[0] != "m-1" {
			t.Fatalf("service saw id=%v", f.ids)
		}
	})

	t.Run("duplicate_is_409", func(t *testing.T) {
		f := &fakeService{depErr: errConflict}
		rec := doReq(newRouter(f, []string{adminRole}), http.MethodPost, "/api/v1/startup/modules/m-1/depends",
			models.CreateDependencyRequest{DependsOn: "core"})
		env := decode(t, rec)
		if rec.Code != http.StatusConflict || env.Code != "CONFLICT" {
			t.Fatalf("status=%d env=%+v", rec.Code, env)
		}
	})

	t.Run("missing_target_is_404", func(t *testing.T) {
		f := &fakeService{depErr: errNotFound}
		rec := doReq(newRouter(f, []string{adminRole}), http.MethodPost, "/api/v1/startup/modules/m-1/depends",
			models.CreateDependencyRequest{DependsOn: "ghost"})
		if rec.Code != http.StatusNotFound {
			t.Fatalf("status = %d", rec.Code)
		}
	})

	t.Run("missing_depends_on_is_400", func(t *testing.T) {
		f := &fakeService{}
		rec := doReq(newRouter(f, []string{adminRole}), http.MethodPost, "/api/v1/startup/modules/m-1/depends",
			models.CreateDependencyRequest{})
		env := decode(t, rec)
		if rec.Code != http.StatusBadRequest || env.Code != "BAD_REQUEST" {
			t.Fatalf("status=%d env=%+v", rec.Code, env)
		}
		if len(f.methodCalls) != 0 {
			t.Fatalf("the service must not be called for a malformed body: %v", f.methodCalls)
		}
	})
}

func TestStartAll_EchoesRealProgress(t *testing.T) {
	f := &fakeService{progress: map[string]interface{}{"status": "ready", "total": 2}}
	rec := doReq(newRouter(f, []string{adminRole}), http.MethodPost, "/api/v1/startup/start", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body %s", rec.Code, rec.Body.String())
	}
	data := dataMap(t, decode(t, rec))
	if data["message"] != "all modules started" {
		t.Fatalf("message = %v", data["message"])
	}
	progress, ok := data["progress"].(map[string]interface{})
	if !ok || progress["total"] != float64(2) {
		t.Fatalf("progress = %v, want the state returned by the service", data["progress"])
	}
	if len(f.tenants) != 1 || f.tenants[0] != "t1" {
		t.Fatalf("Start was called with tenant %v, want t1 from the request context", f.tenants)
	}
	if !contains(f.methodCalls, "GetStartupProgress") {
		t.Fatalf("progress was not read: %v", f.methodCalls)
	}
}

func TestStartAll_FailureIs500(t *testing.T) {
	f := &fakeService{startErr: errors.New("dependency cycle: web -> core -> web")}
	rec := doReq(newRouter(f, []string{adminRole}), http.MethodPost, "/api/v1/startup/start", nil)
	env := decode(t, rec)
	if rec.Code != http.StatusInternalServerError || env.Code != "INTERNAL_ERROR" {
		t.Fatalf("status=%d env=%+v", rec.Code, env)
	}
}

func TestStopAll_EchoesRealProgress(t *testing.T) {
	f := &fakeService{progress: map[string]interface{}{"status": "stopped"}}
	rec := doReq(newRouter(f, []string{adminRole}), http.MethodPost, "/api/v1/startup/stop", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	data := dataMap(t, decode(t, rec))
	if data["message"] != "all modules stopped" || data["progress"] == nil {
		t.Fatalf("data = %v", data)
	}
	if _, ok := data["progress"].(map[string]interface{})["status"]; !ok {
		t.Fatalf("progress = %v", data["progress"])
	}
}

func TestStopAll_FailureIs500(t *testing.T) {
	f := &fakeService{stopErr: errOutage}
	rec := doReq(newRouter(f, []string{adminRole}), http.MethodPost, "/api/v1/startup/stop", nil)
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d", rec.Code)
	}
}

func TestCreateModule_Outcomes(t *testing.T) {
	t.Run("created", func(t *testing.T) {
		f := &fakeService{createResult: &models.StartupModule{ID: "m-9", Name: "web", Type: models.ModuleTypeLazy}}
		rec := doReq(newRouter(f, []string{adminRole}), http.MethodPost, "/api/v1/startup/modules",
			models.CreateModuleRequest{Name: "web", Type: "lazy", Priority: 7})
		if rec.Code != http.StatusCreated {
			t.Fatalf("status = %d body %s", rec.Code, rec.Body.String())
		}
		if len(f.creates) != 1 || f.creates[0].Priority != 7 || f.creates[0].Name != "web" {
			t.Fatalf("service saw %v", f.creates)
		}
	})

	t.Run("missing_name_is_400", func(t *testing.T) {
		f := &fakeService{}
		rec := doReq(newRouter(f, []string{adminRole}), http.MethodPost, "/api/v1/startup/modules",
			models.CreateModuleRequest{Type: "lazy"})
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("status = %d", rec.Code)
		}
		if len(f.creates) != 0 {
			t.Fatalf("the service must not be called for a malformed body: %v", f.creates)
		}
	})

}

func TestCreateModule_ServiceErrorIs500(t *testing.T) {
	f := &fakeService{createErr: errOutage}
	rec := doReq(newRouter(f, []string{adminRole}), http.MethodPost, "/api/v1/startup/modules",
		models.CreateModuleRequest{Name: "web", Type: "lazy"})
	env := decode(t, rec)
	if rec.Code != http.StatusInternalServerError || env.Code != "INTERNAL_ERROR" {
		t.Fatalf("status=%d env=%+v", rec.Code, env)
	}
}

func TestUpdateModule_Outcomes(t *testing.T) {
	t.Run("updated", func(t *testing.T) {
		desc := "rewritten"
		f := &fakeService{updateResult: &models.StartupModule{ID: "m-1", Name: "web", Description: desc}}
		rec := doReq(newRouter(f, []string{adminRole}), http.MethodPut, "/api/v1/startup/modules/m-1",
			models.UpdateModuleRequest{Description: &desc})
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d body %s", rec.Code, rec.Body.String())
		}
		if len(f.updates) != 1 || f.updates[0].Description == nil || *f.updates[0].Description != "rewritten" {
			t.Fatalf("service saw %v", f.updates)
		}
		if len(f.ids) != 1 || f.ids[0] != "m-1" {
			t.Fatalf("service saw id=%v", f.ids)
		}
	})

	t.Run("service_error_is_500", func(t *testing.T) {
		f := &fakeService{updateErr: errOutage}
		rec := doReq(newRouter(f, []string{adminRole}), http.MethodPut, "/api/v1/startup/modules/m-1",
			models.UpdateModuleRequest{})
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d", rec.Code)
		}
	})

	t.Run("malformed_body_is_400", func(t *testing.T) {
		f := &fakeService{}
		req := httptest.NewRequest(http.MethodPut, "/api/v1/startup/modules/m-1",
			bytes.NewBufferString(`{"description": }`))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		newRouter(f, []string{adminRole}).ServeHTTP(rec, req)
		env := decode(t, rec)
		if rec.Code != http.StatusBadRequest || env.Code != "BAD_REQUEST" {
			t.Fatalf("status=%d env=%+v", rec.Code, env)
		}
		if len(f.updates) != 0 {
			t.Fatalf("the service must not be called for a malformed body: %v", f.updates)
		}
	})
}

func TestInitModule_Outcomes(t *testing.T) {
	t.Run("initialised", func(t *testing.T) {
		f := &fakeService{initResult: &models.StartupModule{ID: "m-1", Name: "web", Status: models.StatusActive}}
		rec := doReq(newRouter(f, []string{adminRole}), http.MethodPost, "/api/v1/startup/modules/m-1/init", nil)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d body %s", rec.Code, rec.Body.String())
		}
		if dataMap(t, decode(t, rec))["status"] != string(models.StatusActive) {
			t.Fatalf("envelope data = %v", dataMap(t, decode(t, rec)))
		}
		if len(f.ids) != 1 || f.ids[0] != "m-1" {
			t.Fatalf("service saw id=%v", f.ids)
		}
	})

	t.Run("missing_is_404", func(t *testing.T) {
		f := &fakeService{initErr: errNotFound}
		rec := doReq(newRouter(f, []string{adminRole}), http.MethodPost, "/api/v1/startup/modules/nope/init", nil)
		if rec.Code != http.StatusNotFound {
			t.Fatalf("status = %d", rec.Code)
		}
	})

	t.Run("outage_is_500", func(t *testing.T) {
		f := &fakeService{initErr: errOutage}
		rec := doReq(newRouter(f, []string{adminRole}), http.MethodPost, "/api/v1/startup/modules/m-1/init", nil)
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d", rec.Code)
		}
	})
}

func TestStartupProgress_ReturnsRuntimeState(t *testing.T) {
	f := &fakeService{progress: map[string]interface{}{"status": "ready", "total": 2}}
	rec := doReq(newRouter(f, []string{adminRole}), http.MethodGet, "/api/v1/startup/status", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	env := decode(t, rec)
	if !env.Success {
		t.Fatalf("envelope = %+v", env)
	}
	data := dataMap(t, env)
	if data["status"] != "ready" || data["total"] != float64(2) {
		t.Fatalf("data = %v, want the live progress map", data)
	}
}

// RegisterRoutes guards five routes. Every guarded route must reject a caller
// with no role, and every unguarded route must keep serving that caller — the
// health endpoint in particular has to stay readable so an operator can probe a
// module without a write grant.
func TestRegisterRoutes_GuardsWriteRoutesOnly(t *testing.T) {
	newCase := func() (*fakeService, *gin.Engine) {
		f := &fakeService{
			progress:  map[string]interface{}{"status": "ready"},
			listItems: []models.StartupModule{},
			getResult: &models.StartupModule{ID: "m-1", Name: "web"},
			healthOK:  true,
			depResult: &models.StartupDependency{ID: "d-1"},
		}
		return f, newRouter(f, nil)
	}

	guarded := map[string]string{
		"POST /api/v1/startup/modules":             `{"name":"web","type":"lazy"}`,
		"PUT /api/v1/startup/modules/m-1":          `{"description":"x"}`,
		"DELETE /api/v1/startup/modules/m-1":       ``,
		"POST /api/v1/startup/modules/m-1/init":    ``,
		"POST /api/v1/startup/modules/m-1/depends": `{"depends_on":"core"}`,
	}
	for spec, body := range guarded {
		method, path := splitSpec(spec)
		f, r := newCase()
		var payload []byte
		if body != "" {
			payload = []byte(body)
		}
		req := httptest.NewRequest(method, path, bytes.NewReader(payload))
		if body != "" {
			req.Header.Set("Content-Type", "application/json")
		}
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		if rec.Code != http.StatusForbidden {
			t.Errorf("%s without a role: status = %d, want 403", spec, rec.Code)
		}
		env := decode(t, rec)
		if env.Code != "FORBIDDEN" {
			t.Errorf("%s without a role: code = %q", spec, env.Code)
		}
		if len(f.methodCalls) != 0 {
			t.Errorf("%s without a role reached the service: %v", spec, f.methodCalls)
		}
	}

	// A reader role passes the guard on reads but still cannot write.
	viewerSvc, viewerRouter := newCase()
	_ = viewerRouter
	viewer := newRouter(viewerSvc, []string{"viewer"})
	for _, spec := range []string{
		"POST /api/v1/startup/modules",
		"DELETE /api/v1/startup/modules/m-1",
		"POST /api/v1/startup/modules/m-1/depends",
	} {
		method, path := splitSpec(spec)
		req := httptest.NewRequest(method, path, nil)
		rec := httptest.NewRecorder()
		viewer.ServeHTTP(rec, req)
		if rec.Code != http.StatusForbidden {
			t.Errorf("%s as viewer: status = %d, want 403", spec, rec.Code)
		}
	}

	f, r := newCase()
	unguarded := map[string]string{
		"GET /api/v1/startup/status":              "",
		"GET /api/v1/startup/modules":             "",
		"GET /api/v1/startup/modules/m-1":         "",
		"POST /api/v1/startup/modules/m-1/health": "",
		"POST /api/v1/startup/start":              "",
		"POST /api/v1/startup/stop":               "",
	}
	for spec := range unguarded {
		method, path := splitSpec(spec)
		req := httptest.NewRequest(method, path, nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Errorf("%s without a role: status = %d, want 200", spec, rec.Code)
		}
	}
	// Each lifecycle endpoint also reads the progress map, so the six routes
	// account for eight service calls.
	want := []string{
		"GetStartupProgress", "ListModules", "GetModuleByID", "HealthCheckModule",
		"Start", "GetStartupProgress", "Stop", "GetStartupProgress",
	}
	// The route map iterates in random order, so compare as multisets.
	got := make(map[string]int)
	for _, c := range f.methodCalls {
		got[c]++
	}
	wantCount := make(map[string]int)
	for _, c := range want {
		wantCount[c]++
	}
	if len(got) != len(wantCount) || len(f.methodCalls) != len(want) {
		t.Fatalf("the six unguarded routes made calls %v, want %v", f.methodCalls, want)
	}
	for call, n := range wantCount {
		if got[call] != n {
			t.Fatalf("unguarded calls: %s seen %d times, want %d (all: %v)", call, got[call], n, f.methodCalls)
		}
	}
}

func TestParsePagination(t *testing.T) {
	for _, tc := range []struct {
		query string
		page  int
		limit int
	}{
		{"", 1, 20},
		{"page=3&page_size=25", 3, 25},
		{"page_size=100", 1, 100},
		{"page_size=101", 1, 20},
		{"page_size=500", 1, 20},
		{"page_size=0", 1, 20},
		{"page_size=-1", 1, 20},
		{"page=0&page_size=1", 1, 1},
		{"page=-4", 1, 20},
		{"page=abc&page_size=xyz", 1, 20},
	} {
		gin.SetMode(gin.TestMode)
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodGet, "/x?"+tc.query, nil)
		page, limit := parsePagination(c)
		if page != tc.page || limit != tc.limit {
			t.Errorf("parsePagination(%q) = (%d, %d), want (%d, %d)", tc.query, page, limit, tc.page, tc.limit)
		}
	}
}

// -------------------------------------------------------
// Small helpers
// -------------------------------------------------------

func splitSpec(spec string) (method, path string) {
	parts := strings.SplitN(spec, " ", 2)
	if len(parts) != 2 {
		panic("missing space in " + spec)
	}
	return parts[0], parts[1]
}

func contains(list []string, want string) bool {
	for _, s := range list {
		if s == want {
			return true
		}
	}
	return false
}
