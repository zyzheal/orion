package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/pipeline-versions/models"
	"orion/platform-svc-go/internal/pipeline-versions/service"

	"github.com/gin-gonic/gin"
)

// --- mock service ---

type mockService struct {
	listVersionsFn    func(ctx context.Context, tenantID, pipelineID string, q *models.ListQuery) (*models.VersionListResult, error)
	getVersionFn      func(ctx context.Context, tenantID, versionID string) (*models.Version, error)
	createVersionFn   func(ctx context.Context, tenantID, pipelineID string, req *models.CreateVersionRequest, createdBy string) (*models.Version, error)
	updateVersionFn   func(ctx context.Context, tenantID, versionID string, req *models.UpdateVersionRequest) (*models.Version, error)
	deleteVersionFn   func(ctx context.Context, tenantID, versionID string) error
	publishVersionFn  func(ctx context.Context, tenantID, versionID string, req *models.PublishVersionRequest) (*models.Version, error)
	deprecateVersionFn func(ctx context.Context, tenantID, versionID string) (*models.Version, error)
	rollbackVersionFn func(ctx context.Context, tenantID, pipelineID string, req *models.RollbackVersionRequest) (*models.Version, error)
	compareVersionsFn func(ctx context.Context, tenantID string, req *models.CompareVersionsRequest) (*models.CompareResult, error)
}

func (m *mockService) ListVersions(ctx context.Context, tenantID, pipelineID string, q *models.ListQuery) (*models.VersionListResult, error) {
	return m.listVersionsFn(ctx, tenantID, pipelineID, q)
}
func (m *mockService) GetVersion(ctx context.Context, tenantID, versionID string) (*models.Version, error) {
	return m.getVersionFn(ctx, tenantID, versionID)
}
func (m *mockService) CreateVersion(ctx context.Context, tenantID, pipelineID string, req *models.CreateVersionRequest, createdBy string) (*models.Version, error) {
	return m.createVersionFn(ctx, tenantID, pipelineID, req, createdBy)
}
func (m *mockService) UpdateVersion(ctx context.Context, tenantID, versionID string, req *models.UpdateVersionRequest) (*models.Version, error) {
	return m.updateVersionFn(ctx, tenantID, versionID, req)
}
func (m *mockService) DeleteVersion(ctx context.Context, tenantID, versionID string) error {
	return m.deleteVersionFn(ctx, tenantID, versionID)
}
func (m *mockService) PublishVersion(ctx context.Context, tenantID, versionID string, req *models.PublishVersionRequest) (*models.Version, error) {
	return m.publishVersionFn(ctx, tenantID, versionID, req)
}
func (m *mockService) DeprecateVersion(ctx context.Context, tenantID, versionID string) (*models.Version, error) {
	return m.deprecateVersionFn(ctx, tenantID, versionID)
}
func (m *mockService) RollbackVersion(ctx context.Context, tenantID, pipelineID string, req *models.RollbackVersionRequest) (*models.Version, error) {
	return m.rollbackVersionFn(ctx, tenantID, pipelineID, req)
}
func (m *mockService) CompareVersions(ctx context.Context, tenantID string, req *models.CompareVersionsRequest) (*models.CompareResult, error) {
	return m.compareVersionsFn(ctx, tenantID, req)
}

// --- handler constructor override for tests ---

func newHandlerWithSvc(svc Service) *Handler {
	return &Handler{svc: svc}
}

// --- helpers ---

func performRequest(h *Handler, method, path string, body interface{}, headers map[string]string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	var buf bytes.Buffer
	if body != nil {
		b, _ := json.Marshal(body)
		buf = *bytes.NewBuffer(b)
	}
	c.Request = httptest.NewRequest(method, path, &buf)
	c.Request.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		c.Request.Header.Set(k, v)
	}

	// Set context params using the gin.Params
	c.Params = []gin.Param{}

	// Call the appropriate handler method based on path
	switch path {
	case "/pipelines/p1/versions":
		c.Params = append(c.Params, gin.Param{Key: "pipelineId", Value: "p1"})
		c.Set("tenant_id", getHeader(headers, "X-Tenant-ID"))
		if method == "GET" {
			h.ListVersions(c)
		} else {
			c.Set("user_id", getHeader(headers, "X-User-ID"))
			h.CreateVersion(c)
		}
	case "/pipelines/p1/versions/v-1":
		c.Params = append(c.Params, gin.Param{Key: "pipelineId", Value: "p1"}, gin.Param{Key: "versionId", Value: "v-1"})
		c.Set("tenant_id", getHeader(headers, "X-Tenant-ID"))
		switch method {
		case "GET":
			h.GetVersion(c)
		case "PUT":
			h.UpdateVersion(c)
		case "DELETE":
			h.DeleteVersion(c)
		}
	case "/pipelines/p1/versions/v-1/publish":
		c.Params = append(c.Params, gin.Param{Key: "pipelineId", Value: "p1"}, gin.Param{Key: "versionId", Value: "v-1"})
		c.Set("tenant_id", getHeader(headers, "X-Tenant-ID"))
		h.PublishVersion(c)
	case "/pipelines/p1/versions/v-1/deprecate":
		c.Params = append(c.Params, gin.Param{Key: "pipelineId", Value: "p1"}, gin.Param{Key: "versionId", Value: "v-1"})
		c.Set("tenant_id", getHeader(headers, "X-Tenant-ID"))
		h.DeprecateVersion(c)
	case "/pipelines/p1/versions/rollback":
		c.Params = append(c.Params, gin.Param{Key: "pipelineId", Value: "p1"})
		c.Set("tenant_id", getHeader(headers, "X-Tenant-ID"))
		h.RollbackVersion(c)
	case "/pipelines/p1/versions/compare":
		c.Params = append(c.Params, gin.Param{Key: "pipelineId", Value: "p1"})
		c.Set("tenant_id", getHeader(headers, "X-Tenant-ID"))
		h.CompareVersions(c)
	}

	return w
}

func getHeader(headers map[string]string, key string) string {
	if headers == nil {
		return ""
	}
	return headers[key]
}

// --- Tests: ListVersions ---

func TestHandler_ListVersions_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		listVersionsFn: func(_ context.Context, _, _ string, _ *models.ListQuery) (*models.VersionListResult, error) {
			return &models.VersionListResult{
				Data:  []models.Version{{ID: "v-1", Name: "v1"}},
				Total: 1,
			}, nil
		},
	})

	w := performRequest(h, "GET", "/pipelines/p1/versions", nil, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["success"] != true {
		t.Error("expected success=true")
	}
}

// --- Tests: GetVersion ---

func TestHandler_GetVersion_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		getVersionFn: func(_ context.Context, _, _ string) (*models.Version, error) {
			return &models.Version{ID: "v-1", Name: "v1"}, nil
		},
	})

	w := performRequest(h, "GET", "/pipelines/p1/versions/v-1", nil, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetVersion_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		getVersionFn: func(_ context.Context, _, _ string) (*models.Version, error) {
			return nil, service.ErrNotFound
		},
	})

	w := performRequest(h, "GET", "/pipelines/p1/versions/v-1", nil, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

// --- Tests: CreateVersion ---

func TestHandler_CreateVersion_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		createVersionFn: func(_ context.Context, _, _ string, _ *models.CreateVersionRequest, _ string) (*models.Version, error) {
			return &models.Version{ID: "v-new", Name: "v1", Status: models.StatusDraft}, nil
		},
	})

	body := models.CreateVersionRequest{Name: "v1", Config: `{"key":"val"}`}
	w := performRequest(h, "POST", "/pipelines/p1/versions", body, map[string]string{
		"X-Tenant-ID": "t1",
		"X-User-ID":   "user-1",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
}

func TestHandler_CreateVersion_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockService{})

	w := performRequest(h, "POST", "/pipelines/p1/versions", "invalid json", map[string]string{
		"X-Tenant-ID": "t1",
		"X-User-ID":   "user-1",
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHandler_CreateVersion_ServiceBadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		createVersionFn: func(_ context.Context, _, _ string, _ *models.CreateVersionRequest, _ string) (*models.Version, error) {
			return nil, service.ErrBadRequest
		},
	})

	body := models.CreateVersionRequest{Name: "", Config: `{}`}
	w := performRequest(h, "POST", "/pipelines/p1/versions", body, map[string]string{
		"X-Tenant-ID": "t1",
		"X-User-ID":   "user-1",
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

// --- Tests: UpdateVersion ---

func TestHandler_UpdateVersion_Success(t *testing.T) {
	newName := "v1-updated"
	h := newHandlerWithSvc(&mockService{
		updateVersionFn: func(_ context.Context, _, _ string, req *models.UpdateVersionRequest) (*models.Version, error) {
			return &models.Version{ID: "v-1", Name: *req.Name}, nil
		},
	})

	body := models.UpdateVersionRequest{Name: &newName}
	w := performRequest(h, "PUT", "/pipelines/p1/versions/v-1", body, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_UpdateVersion_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockService{})

	w := performRequest(h, "PUT", "/pipelines/p1/versions/v-1", "invalid json", map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHandler_UpdateVersion_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		updateVersionFn: func(_ context.Context, _, _ string, _ *models.UpdateVersionRequest) (*models.Version, error) {
			return nil, service.ErrNotFound
		},
	})

	name := "new"
	w := performRequest(h, "PUT", "/pipelines/p1/versions/v-1", models.UpdateVersionRequest{Name: &name}, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestHandler_UpdateVersion_Locked(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		updateVersionFn: func(_ context.Context, _, _ string, _ *models.UpdateVersionRequest) (*models.Version, error) {
			return nil, service.ErrLocked
		},
	})

	name := "new"
	w := performRequest(h, "PUT", "/pipelines/p1/versions/v-1", models.UpdateVersionRequest{Name: &name}, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

// --- Tests: DeleteVersion ---

func TestHandler_DeleteVersion_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		deleteVersionFn: func(_ context.Context, _, _ string) error {
			return nil
		},
	})

	w := performRequest(h, "DELETE", "/pipelines/p1/versions/v-1", nil, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_DeleteVersion_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		deleteVersionFn: func(_ context.Context, _, _ string) error {
			return service.ErrNotFound
		},
	})

	w := performRequest(h, "DELETE", "/pipelines/p1/versions/v-1", nil, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

// --- Tests: PublishVersion ---

func TestHandler_PublishVersion_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		publishVersionFn: func(_ context.Context, _, _ string, _ *models.PublishVersionRequest) (*models.Version, error) {
			return &models.Version{ID: "v-1", Status: models.StatusPublished}, nil
		},
	})

	w := performRequest(h, "POST", "/pipelines/p1/versions/v-1/publish", nil, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_PublishVersion_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		publishVersionFn: func(_ context.Context, _, _ string, _ *models.PublishVersionRequest) (*models.Version, error) {
			return nil, service.ErrNotFound
		},
	})

	w := performRequest(h, "POST", "/pipelines/p1/versions/v-1/publish", nil, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestHandler_PublishVersion_AlreadyPublished(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		publishVersionFn: func(_ context.Context, _, _ string, _ *models.PublishVersionRequest) (*models.Version, error) {
			return nil, service.ErrAlreadyPublished
		},
	})

	w := performRequest(h, "POST", "/pipelines/p1/versions/v-1/publish", nil, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

// --- Tests: DeprecateVersion ---

func TestHandler_DeprecateVersion_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		deprecateVersionFn: func(_ context.Context, _, _ string) (*models.Version, error) {
			return &models.Version{ID: "v-1", Status: models.StatusDeprecated}, nil
		},
	})

	w := performRequest(h, "POST", "/pipelines/p1/versions/v-1/deprecate", nil, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_DeprecateVersion_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		deprecateVersionFn: func(_ context.Context, _, _ string) (*models.Version, error) {
			return nil, service.ErrNotFound
		},
	})

	w := performRequest(h, "POST", "/pipelines/p1/versions/v-1/deprecate", nil, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

// --- Tests: RollbackVersion ---

func TestHandler_RollbackVersion_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		rollbackVersionFn: func(_ context.Context, _, _ string, _ *models.RollbackVersionRequest) (*models.Version, error) {
			return &models.Version{ID: "target", Name: "previous"}, nil
		},
	})

	body := models.RollbackVersionRequest{Reason: "rollback"}
	w := performRequest(h, "POST", "/pipelines/p1/versions/rollback", body, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_RollbackVersion_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockService{})

	w := performRequest(h, "POST", "/pipelines/p1/versions/rollback", "invalid json", map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHandler_RollbackVersion_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		rollbackVersionFn: func(_ context.Context, _, _ string, _ *models.RollbackVersionRequest) (*models.Version, error) {
			return nil, service.ErrNotFound
		},
	})

	body := models.RollbackVersionRequest{Reason: "rollback"}
	w := performRequest(h, "POST", "/pipelines/p1/versions/rollback", body, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestHandler_RollbackVersion_NoRollbackTarget(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		rollbackVersionFn: func(_ context.Context, _, _ string, _ *models.RollbackVersionRequest) (*models.Version, error) {
			return nil, service.ErrNoRollbackTarget
		},
	})

	body := models.RollbackVersionRequest{Reason: "rollback"}
	w := performRequest(h, "POST", "/pipelines/p1/versions/rollback", body, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

// --- Tests: CompareVersions ---

func TestHandler_CompareVersions_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		compareVersionsFn: func(_ context.Context, _ string, _ *models.CompareVersionsRequest) (*models.CompareResult, error) {
			return &models.CompareResult{
				From:   models.Version{ID: "from", Name: "from"},
				To:     models.Version{ID: "to", Name: "to"},
				Diff:   map[string]any{"key": "changed"},
				Fields: []string{"key"},
			}, nil
		},
	})

	body := models.CompareVersionsRequest{FromVersionID: "from", ToVersionID: "to"}
	w := performRequest(h, "POST", "/pipelines/p1/versions/compare", body, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_CompareVersions_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockService{})

	w := performRequest(h, "POST", "/pipelines/p1/versions/compare", "invalid json", map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHandler_CompareVersions_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		compareVersionsFn: func(_ context.Context, _ string, _ *models.CompareVersionsRequest) (*models.CompareResult, error) {
			return nil, service.ErrNotFound
		},
	})

	body := models.CompareVersionsRequest{FromVersionID: "from", ToVersionID: "to"}
	w := performRequest(h, "POST", "/pipelines/p1/versions/compare", body, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestHandler_CompareVersions_BadRequestFromService(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		compareVersionsFn: func(_ context.Context, _ string, _ *models.CompareVersionsRequest) (*models.CompareResult, error) {
			return nil, service.ErrBadRequest
		},
	})

	body := models.CompareVersionsRequest{FromVersionID: "", ToVersionID: ""}
	w := performRequest(h, "POST", "/pipelines/p1/versions/compare", body, map[string]string{"X-Tenant-ID": "t1"})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}