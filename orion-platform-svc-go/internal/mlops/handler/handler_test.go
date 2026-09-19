package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"orion/platform-svc-go/internal/mlops/models"
	"orion/platform-svc-go/internal/mlops/service"

	"github.com/gin-gonic/gin"
)

func newHandler() *Handler {
	return NewHandler(&service.Service{})
}

func makeCtx(method string, path string, body string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	var r *http.Request
	if body != "" {
		r = httptest.NewRequest(method, path, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
	} else {
		r = httptest.NewRequest(method, path, nil)
	}
	c.Request = r
	return c, w
}

func TestNewHandler(t *testing.T) {
	h := newHandler()
	if h == nil {
		t.Fatal("newHandler returned nil")
	}
}

func TestHandler_RegisterRoutes(t *testing.T) {
	h := newHandler()
	r := gin.New().Group("")
	h.RegisterRoutes(r)
	if r == nil {
		t.Fatal("routes not registered")
	}
}

func TestHandler_ListModels_NoDB(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/mlops", "")
	newHandler().ListModels(c)
	if w.Code >= 500 {
		t.Fatalf("ListModels: got %d, body: %s", w.Code, w.Body.String())
	}
}

func TestHandler_RegisterModel_InvalidBody(t *testing.T) {
	c, w := makeCtx(http.MethodPost, "/mlops", "invalid json")
	newHandler().RegisterModel(c)
	if w.Code != 400 {
		t.Fatalf("RegisterModel invalid body: got %d, want 400", w.Code)
	}
}

func TestHandler_RegisterModel_MissingName(t *testing.T) {
	c, w := makeCtx(http.MethodPost, "/mlops", `{"framework":"pytorch"}`)
	newHandler().RegisterModel(c)
	if w.Code != 400 {
		t.Fatalf("RegisterModel missing name: got %d, want 400", w.Code)
	}
}

func TestHandler_GetMetrics_NoDB(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/mlops/m1/metrics", "")
	newHandler().GetMetrics(c)
	if w.Code >= 500 {
		t.Fatalf("GetMetrics: got %d, body: %s", w.Code, w.Body.String())
	}
}

// updatesRecordingService captures the updates map the UpdateModel handler
// passes to the service. Every other method still routes through the real
// *service.Service (which needs no DB for a nil-receiver call), so the
// pre-existing tests keep working unchanged.
type updatesRecordingService struct {
	*service.Service
	captured map[string]interface{}
}

func (f *updatesRecordingService) UpdateModel(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Model, error) {
	f.captured = updates
	return &models.Model{}, nil
}

// TestHandler_UpdateModel_PassesArtifactPath asserts the handler forwards a
// client-supplied artifactPath to the service as an "artifact_path" key. The
// mlops_models table has an artifact_path column (migrations/375) and
// RegisterModel writes it, but PUT /mlops/:id used to silently drop the field,
// so a model's artifact pointer could never be corrected after registration.
func TestHandler_UpdateModel_PassesArtifactPath(t *testing.T) {
	svc := &updatesRecordingService{}
	c, w := makeCtx(http.MethodPut, "/mlops/m1", `{"name":"m1","artifactPath":"/artifacts/m1.pt"}`)
	c.Params = gin.Params{{Key: "id", Value: "m1"}}
	NewHandler(svc).UpdateModel(c)
	if w.Code != 200 {
		t.Fatalf("UpdateModel: got %d, want 200", w.Code)
	}
	if svc.captured == nil {
		t.Fatalf("UpdateModel was not called")
	}
	if got, ok := svc.captured["artifact_path"]; !ok || got != "/artifacts/m1.pt" {
		t.Errorf("artifact_path not forwarded: got %v (present=%v), want %q", got, ok, "/artifacts/m1.pt")
	}
}

// TestHandler_UpdateModel_LeavesArtifactPathEmpty asserts an empty artifactPath
// is not written into the updates map, so a partial update that omits the
// field cannot zero out an existing artifact pointer.
func TestHandler_UpdateModel_LeavesArtifactPathEmpty(t *testing.T) {
	svc := &updatesRecordingService{}
	c, w := makeCtx(http.MethodPut, "/mlops/m1", `{"name":"m1"}`)
	c.Params = gin.Params{{Key: "id", Value: "m1"}}
	NewHandler(svc).UpdateModel(c)
	if w.Code != 200 {
		t.Fatalf("UpdateModel: got %d, want 200", w.Code)
	}
	if _, ok := svc.captured["artifact_path"]; ok {
		t.Errorf("artifact_path must be omitted when the request body leaves it empty")
	}
}
