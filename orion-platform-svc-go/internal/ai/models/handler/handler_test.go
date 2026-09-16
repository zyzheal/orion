package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"

	"orion/platform-svc-go/internal/ai/models/models"
	"orion/platform-svc-go/internal/ai/models/service"

	"github.com/gin-gonic/gin"
)

type fakeModelsService struct{}

func (f *fakeModelsService) ListModels(ctx context.Context, tenantID string, q models.ListModelsQuery) (*models.ModelListResponse, error) {
	return &models.ModelListResponse{Data: nil, Total: 0}, nil
}
func (f *fakeModelsService) GetModel(ctx context.Context, tenantID string, modelID string) (*models.AIModel, error) {
	return &models.AIModel{ID: modelID}, nil
}
func (f *fakeModelsService) RegisterModel(ctx context.Context, tenantID string, userID string, req models.RegisterModelRequest) (*models.AIModel, error) {
	return &models.AIModel{ID: "m-1"}, nil
}
func (f *fakeModelsService) UpdateModel(ctx context.Context, tenantID string, modelID string, req models.UpdateModelRequest) (*models.AIModel, error) {
	return &models.AIModel{ID: modelID}, nil
}
func (f *fakeModelsService) DeleteModel(ctx context.Context, tenantID string, modelID string) error {
	return nil
}
func (f *fakeModelsService) ListVersions(ctx context.Context, tenantID string, modelID string, q models.ListVersionsQuery) (*models.VersionListResponse, error) {
	return &models.VersionListResponse{}, nil
}
func (f *fakeModelsService) GetVersion(ctx context.Context, tenantID string, modelID string, versionID string) (*models.ModelVersion, error) {
	return &models.ModelVersion{ID: versionID}, nil
}
func (f *fakeModelsService) PublishVersion(ctx context.Context, tenantID string, modelID string, userID string, req models.PublishVersionRequest) (*models.ModelVersion, error) {
	return &models.ModelVersion{ID: "v-1"}, nil
}
func (f *fakeModelsService) PromoteVersion(ctx context.Context, tenantID string, modelID string, versionID string, userID string, req models.PromoteVersionRequest) (*models.ModelVersion, error) {
	return &models.ModelVersion{ID: versionID}, nil
}
func (f *fakeModelsService) RollbackVersion(ctx context.Context, tenantID string, modelID string) (*models.ModelVersion, error) {
	return &models.ModelVersion{ID: "v-1"}, nil
}
func (f *fakeModelsService) GetModelMetrics(ctx context.Context, tenantID string, modelID string) (*models.ModelMetricsResponse, error) {
	return &models.ModelMetricsResponse{}, nil
}
func (f *fakeModelsService) ConfigureCanary(ctx context.Context, tenantID string, modelID string, req models.CanaryConfigRequest) (*models.CanaryConfig, error) {
	return &models.CanaryConfig{}, nil
}
func (f *fakeModelsService) GetCanaryConfig(ctx context.Context, tenantID string, modelID string) (*models.CanaryConfig, error) {
	return &models.CanaryConfig{}, nil
}
func (f *fakeModelsService) StopCanary(ctx context.Context, tenantID string, modelID string) error {
	return nil
}

var _ service.ServiceInterface = (*fakeModelsService)(nil)

func newHandler() *Handler {
	return NewHandler(&service.Service{})
}

func makeCtx(method string, path string, body interface{}, params map[string]string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	buf := new(bytes.Buffer)
	if body != nil {
		json.NewEncoder(buf).Encode(body)
	}
	c.Request = httptest.NewRequest(method, path, buf)
	if params != nil {
		c.Params = gin.Params{}
		for k, v := range params {
			c.Params = append(c.Params, gin.Param{Key: k, Value: v})
		}
	}
	return c, w
}

// resolvedRoutes returns the registered routes as sorted "METHOD PATH" strings.
// Two registrations can share a path with different methods, so counting
// distinct paths alone would collapse them.
func resolvedRoutes(r *gin.Engine) []string {
	routes := r.Routes()
	out := make([]string, 0, len(routes))
	for _, rt := range routes {
		out = append(out, rt.Method+" "+rt.Path)
	}
	sort.Strings(out)
	return out
}

// assertRouteSet fails on the first mismatch and reports both counts, so a
// dropped registration is visible instead of masquerading as a subset match.
func assertRouteSet(t *testing.T, got []string, want []string) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("registered %d routes, want %d; got %v", len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("route %d = %q, want %q; full set: %v", i, got[i], want[i], got)
		}
	}
}

// assertNoReusedSegment fails when a path repeats one of its own segments, e.g.
// /api/v1/docs/docs/tags. That shape means the handler re-added a prefix its
// injected group already carries.
func assertNoReusedSegment(t *testing.T, got []string) {
	t.Helper()
	for _, line := range got {
		fields := strings.Fields(line)
		if len(fields) != 2 {
			t.Fatalf("unparsable route line %q", line)
		}
		parts := strings.Split(strings.Trim(fields[1], "/"), "/")
		for i := 0; i+2 < len(parts); i++ {
			if parts[i] == parts[i+1] {
				t.Errorf("%s repeats segment %q", line, parts[i])
			}
		}
	}
}

// TestAI_MODELS_Handler_RegisterRoutes pins all fourteen registrations to the
// paths they resolve to under the group setupRouter actually passes in.
//
// The handler used to build rg.Group("/api/v1/ai/models") while router.go
// already mounts it on /api/v1, so all fourteen endpoints resolved to
// /api/v1/api/v1/ai/models/... and none was reachable. The old body of this
// test was a bare RegisterRoutes call with no assertion, so the doubling
// passed for a long time: build, vet and the route-conflict scan all stay
// green when a handler merely writes a path nobody can reach.
func TestAI_MODELS_Handler_RegisterRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	newHandler().RegisterRoutes(r.Group("/api/v1"))

	got := resolvedRoutes(r)
	want := []string{
		"DELETE /api/v1/ai/models/:id",
		"DELETE /api/v1/ai/models/:id/canary",
		"GET /api/v1/ai/models",
		"GET /api/v1/ai/models/:id",
		"GET /api/v1/ai/models/:id/canary",
		"GET /api/v1/ai/models/:id/metrics",
		"GET /api/v1/ai/models/:id/versions",
		"GET /api/v1/ai/models/:id/versions/:versionId",
		"POST /api/v1/ai/models",
		"POST /api/v1/ai/models/:id/canary",
		"POST /api/v1/ai/models/:id/versions",
		"POST /api/v1/ai/models/:id/versions/:versionId/promote",
		"POST /api/v1/ai/models/:id/versions/:versionId/rollback",
		"PUT /api/v1/ai/models/:id",
	}
	assertRouteSet(t, got, want)
	assertNoReusedSegment(t, got)
	for _, line := range got {
		if strings.Contains(line, "/api/v1/api/v1") {
			t.Errorf("%s re-adds the /api/v1 prefix its group already carries", line)
		}
	}
}

func TestAI_MODELS_Handler_ListModels(t *testing.T) {
	h := NewHandler(&fakeModelsService{})
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	h.ListModels(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListModels: got %d", w.Code)
	}
}

func TestAI_MODELS_Handler_RegisterModel(t *testing.T) {
	h := NewHandler(&fakeModelsService{})
	c, w := makeCtx(http.MethodPost, "/", models.RegisterModelRequest{Name: "gpt-4", DisplayName: "GPT-4", Type: "llm", Framework: "openai"}, nil)
	h.RegisterModel(c)
	if w.Code != http.StatusOK && w.Code != http.StatusCreated {
		t.Fatalf("RegisterModel: got %d", w.Code)
	}
}

func TestAI_MODELS_Handler_GetModel(t *testing.T) {
	h := NewHandler(&fakeModelsService{})
	c, w := makeCtx(http.MethodGet, "/", nil, map[string]string{"id": "m-1"})
	h.GetModel(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetModel: got %d", w.Code)
	}
}

func TestAI_MODELS_Handler_UpdateModel(t *testing.T) {
	h := NewHandler(&fakeModelsService{})
	c, w := makeCtx(http.MethodPut, "/", models.UpdateModelRequest{}, map[string]string{"id": "m-1"})
	h.UpdateModel(c)
	if w.Code != http.StatusOK {
		t.Fatalf("UpdateModel: got %d", w.Code)
	}
}

func TestAI_MODELS_Handler_DeleteModel(t *testing.T) {
	h := NewHandler(&fakeModelsService{})
	c, w := makeCtx(http.MethodDelete, "/", nil, map[string]string{"id": "m-1"})
	h.DeleteModel(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DeleteModel: got %d", w.Code)
	}
}

func TestAI_MODELS_Handler_ListVersions(t *testing.T) {
	h := NewHandler(&fakeModelsService{})
	c, w := makeCtx(http.MethodGet, "/", nil, map[string]string{"id": "m-1"})
	h.ListVersions(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListVersions: got %d", w.Code)
	}
}

func TestAI_MODELS_Handler_PublishVersion(t *testing.T) {
	h := NewHandler(&fakeModelsService{})
	c, w := makeCtx(http.MethodPost, "/", models.PublishVersionRequest{ArtifactUri: "s3://bucket/v1"}, map[string]string{"id": "m-1"})
	h.PublishVersion(c)
	if w.Code != http.StatusOK && w.Code != http.StatusCreated {
		t.Fatalf("PublishVersion: got %d", w.Code)
	}
}

func TestAI_MODELS_Handler_GetVersion(t *testing.T) {
	h := NewHandler(&fakeModelsService{})
	c, w := makeCtx(http.MethodGet, "/", nil, map[string]string{"id": "m-1", "versionId": "v-1"})
	h.GetVersion(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetVersion: got %d", w.Code)
	}
}

func TestAI_MODELS_Handler_PromoteVersion(t *testing.T) {
	h := NewHandler(&fakeModelsService{})
	c, w := makeCtx(http.MethodPost, "/", models.PromoteVersionRequest{TargetEnvironment: "production"}, map[string]string{"id": "m-1", "versionId": "v-1"})
	h.PromoteVersion(c)
	if w.Code != http.StatusOK {
		t.Fatalf("PromoteVersion: got %d", w.Code)
	}
}

func TestAI_MODELS_Handler_RollbackVersion(t *testing.T) {
	h := NewHandler(&fakeModelsService{})
	c, w := makeCtx(http.MethodPost, "/", nil, map[string]string{"id": "m-1"})
	h.RollbackVersion(c)
	if w.Code != http.StatusOK {
		t.Fatalf("RollbackVersion: got %d", w.Code)
	}
}

func TestAI_MODELS_Handler_GetModelMetrics(t *testing.T) {
	h := NewHandler(&fakeModelsService{})
	c, w := makeCtx(http.MethodGet, "/", nil, map[string]string{"id": "m-1"})
	h.GetModelMetrics(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetModelMetrics: got %d", w.Code)
	}
}

func TestAI_MODELS_Handler_ConfigureCanary(t *testing.T) {
	h := NewHandler(&fakeModelsService{})
	c, w := makeCtx(http.MethodPost, "/", models.CanaryConfigRequest{TargetVersion: "v2", TrafficPercent: 10, Duration: 3600}, map[string]string{"id": "m-1"})
	h.ConfigureCanary(c)
	if w.Code != http.StatusOK && w.Code != http.StatusCreated {
		t.Fatalf("ConfigureCanary: got %d", w.Code)
	}
}

func TestAI_MODELS_Handler_GetCanaryConfig(t *testing.T) {
	h := NewHandler(&fakeModelsService{})
	c, w := makeCtx(http.MethodGet, "/", nil, map[string]string{"id": "m-1"})
	h.GetCanaryConfig(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetCanaryConfig: got %d", w.Code)
	}
}

func TestAI_MODELS_Handler_StopCanary(t *testing.T) {
	h := NewHandler(&fakeModelsService{})
	c, w := makeCtx(http.MethodPost, "/", nil, map[string]string{"id": "m-1"})
	h.StopCanary(c)
	if w.Code != http.StatusOK {
		t.Fatalf("StopCanary: got %d", w.Code)
	}
}
