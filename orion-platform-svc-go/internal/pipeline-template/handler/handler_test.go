package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/pipeline-template/models"
	"orion/platform-svc-go/internal/pipeline-template/service"

	"github.com/gin-gonic/gin"
)

// --- mock service ---

type mockSvc struct {
	listFn           func(ctx context.Context, tenantID string) ([]models.PipelineTemplate, int, error)
	getFn            func(ctx context.Context, id string, tenantID string) (*models.PipelineTemplate, error)
	createFn         func(ctx context.Context, req *models.CreateTemplateRequest, tenantID string) (*models.PipelineTemplate, error)
	updateFn         func(ctx context.Context, id string, req *models.UpdateTemplateRequest, tenantID string) (*models.PipelineTemplate, error)
	deleteFn         func(ctx context.Context, id string, tenantID string) (bool, error)
	instantiateFn    func(ctx context.Context, templateID string, req *models.InstantiateRequest, tenantID string) (*models.InstantiatedPipeline, error)
}

func (m *mockSvc) ListTemplates(ctx context.Context, tenantID string) ([]models.PipelineTemplate, int, error) {
	return m.listFn(ctx, tenantID)
}
func (m *mockSvc) GetTemplate(ctx context.Context, id string, tenantID string) (*models.PipelineTemplate, error) {
	return m.getFn(ctx, id, tenantID)
}
func (m *mockSvc) CreateTemplate(ctx context.Context, req *models.CreateTemplateRequest, tenantID string) (*models.PipelineTemplate, error) {
	return m.createFn(ctx, req, tenantID)
}
func (m *mockSvc) UpdateTemplate(ctx context.Context, id string, req *models.UpdateTemplateRequest, tenantID string) (*models.PipelineTemplate, error) {
	return m.updateFn(ctx, id, req, tenantID)
}
func (m *mockSvc) DeleteTemplate(ctx context.Context, id string, tenantID string) (bool, error) {
	return m.deleteFn(ctx, id, tenantID)
}
func (m *mockSvc) InstantiateTemplate(ctx context.Context, templateID string, req *models.InstantiateRequest, tenantID string) (*models.InstantiatedPipeline, error) {
	return m.instantiateFn(ctx, templateID, req, tenantID)
}

// --- test helpers ---

func newHandlerWithSvc(svc HandlerService) *Handler {
	return &Handler{svc: svc}
}

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

	// Set tenant_id from header if present
	if tenantID, ok := headers["X-Tenant-ID"]; ok {
		c.Set("tenant_id", tenantID)
	}

	// Dispatch to the correct handler method
	switch {
	case method == "GET" && path == "/pipeline-templates":
		h.ListTemplates(c)
	case method == "GET" && path == "/pipeline-templates/t1":
		c.Params = []gin.Param{{Key: "templateId", Value: "t1"}}
		h.GetTemplate(c)
	case method == "POST" && path == "/pipeline-templates":
		h.CreateTemplate(c)
	case method == "PUT" && path == "/pipeline-templates/t1":
		c.Params = []gin.Param{{Key: "templateId", Value: "t1"}}
		h.UpdateTemplate(c)
	case method == "DELETE" && path == "/pipeline-templates/t1":
		c.Params = []gin.Param{{Key: "templateId", Value: "t1"}}
		h.DeleteTemplate(c)
	case method == "POST" && path == "/pipeline-templates/t1/instantiate":
		c.Params = []gin.Param{{Key: "templateId", Value: "t1"}}
		h.InstantiateTemplate(c)
	}

	return w
}

// --- model helpers ---

func testTemplate(id, name string) *models.PipelineTemplate {
	desc := "test description"
	cat := "ci"
	ver := "1.0"
	by := "user"
	return &models.PipelineTemplate{
		ID:             id,
		TenantID:       "tenant-1",
		Name:           name,
		Description:    &desc,
		YAMLDefinition: "yaml: " + name,
		Tags:           "[]",
		Category:       &cat,
		Version:        &ver,
		CreatedBy:      &by,
	}
}

// --- ListTemplates tests ---

func TestHandler_ListTemplates_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		listFn: func(_ context.Context, tenantID string) ([]models.PipelineTemplate, int, error) {
			return []models.PipelineTemplate{*testTemplate("t1", "t1")}, 1, nil
		},
	})

	w := performRequest(h, "GET", "/pipeline-templates", nil, map[string]string{
		"X-Tenant-ID": "tenant-1",
	})

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["success"] != true {
		t.Error("expected success=true")
	}
}

func TestHandler_ListTemplates_Empty(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		listFn: func(_ context.Context, tenantID string) ([]models.PipelineTemplate, int, error) {
			return []models.PipelineTemplate{}, 0, nil
		},
	})

	w := performRequest(h, "GET", "/pipeline-templates", nil, map[string]string{
		"X-Tenant-ID": "tenant-1",
	})

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_ListTemplates_Error(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		listFn: func(_ context.Context, tenantID string) ([]models.PipelineTemplate, int, error) {
			return nil, 0, errors.New("db error")
		},
	})

	w := performRequest(h, "GET", "/pipeline-templates", nil, map[string]string{
		"X-Tenant-ID": "tenant-1",
	})

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

// --- GetTemplate tests ---

func TestHandler_GetTemplate_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getFn: func(_ context.Context, id string, tenantID string) (*models.PipelineTemplate, error) {
			return testTemplate(id, "template-1"), nil
		},
	})

	w := performRequest(h, "GET", "/pipeline-templates/t1", nil, map[string]string{
		"X-Tenant-ID": "tenant-1",
	})

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["success"] != true {
		t.Error("expected success=true")
	}
}

func TestHandler_GetTemplate_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getFn: func(_ context.Context, id string, tenantID string) (*models.PipelineTemplate, error) {
			return nil, service.ErrTemplateNotFound
		},
	})

	w := performRequest(h, "GET", "/pipeline-templates/t1", nil, map[string]string{
		"X-Tenant-ID": "tenant-1",
	})

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestHandler_GetTemplate_Error(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getFn: func(_ context.Context, id string, tenantID string) (*models.PipelineTemplate, error) {
			return nil, errors.New("db error")
		},
	})

	w := performRequest(h, "GET", "/pipeline-templates/t1", nil, map[string]string{
		"X-Tenant-ID": "tenant-1",
	})

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

// --- CreateTemplate tests ---

func TestHandler_CreateTemplate_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		createFn: func(_ context.Context, req *models.CreateTemplateRequest, tenantID string) (*models.PipelineTemplate, error) {
			return testTemplate("new-id", req.Name), nil
		},
	})

	w := performRequest(h, "POST", "/pipeline-templates", models.CreateTemplateRequest{
		Name:           "new-template",
		YAMLDefinition: "yaml: content",
	}, map[string]string{
		"X-Tenant-ID": "tenant-1",
	})

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["success"] != true {
		t.Error("expected success=true")
	}
}

func TestHandler_CreateTemplate_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})

	w := performRequest(h, "POST", "/pipeline-templates", "invalid json", map[string]string{
		"X-Tenant-ID": "tenant-1",
	})

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHandler_CreateTemplate_Error(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		createFn: func(_ context.Context, req *models.CreateTemplateRequest, tenantID string) (*models.PipelineTemplate, error) {
			return nil, errors.New("db error")
		},
	})

	w := performRequest(h, "POST", "/pipeline-templates", models.CreateTemplateRequest{
		Name:           "new-template",
		YAMLDefinition: "yaml: content",
	}, map[string]string{
		"X-Tenant-ID": "tenant-1",
	})

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

// --- UpdateTemplate tests ---

func TestHandler_UpdateTemplate_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		updateFn: func(_ context.Context, id string, req *models.UpdateTemplateRequest, tenantID string) (*models.PipelineTemplate, error) {
			return testTemplate(id, *req.Name), nil
		},
	})

	name := "updated-name"
	w := performRequest(h, "PUT", "/pipeline-templates/t1", models.UpdateTemplateRequest{
		Name: &name,
	}, map[string]string{
		"X-Tenant-ID": "tenant-1",
	})

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["success"] != true {
		t.Error("expected success=true")
	}
}

func TestHandler_UpdateTemplate_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})

	w := performRequest(h, "PUT", "/pipeline-templates/t1", "invalid json", map[string]string{
		"X-Tenant-ID": "tenant-1",
	})

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHandler_UpdateTemplate_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		updateFn: func(_ context.Context, id string, req *models.UpdateTemplateRequest, tenantID string) (*models.PipelineTemplate, error) {
			return nil, service.ErrTemplateNotFound
		},
	})

	name := "updated-name"
	w := performRequest(h, "PUT", "/pipeline-templates/t1", models.UpdateTemplateRequest{
		Name: &name,
	}, map[string]string{
		"X-Tenant-ID": "tenant-1",
	})

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestHandler_UpdateTemplate_Error(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		updateFn: func(_ context.Context, id string, req *models.UpdateTemplateRequest, tenantID string) (*models.PipelineTemplate, error) {
			return nil, errors.New("db error")
		},
	})

	name := "updated-name"
	w := performRequest(h, "PUT", "/pipeline-templates/t1", models.UpdateTemplateRequest{
		Name: &name,
	}, map[string]string{
		"X-Tenant-ID": "tenant-1",
	})

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

// --- DeleteTemplate tests ---

func TestHandler_DeleteTemplate_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		deleteFn: func(_ context.Context, id string, tenantID string) (bool, error) {
			return true, nil
		},
	})

	w := performRequest(h, "DELETE", "/pipeline-templates/t1", nil, map[string]string{
		"X-Tenant-ID": "tenant-1",
	})

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["success"] != true {
		t.Error("expected success=true")
	}
}

func TestHandler_DeleteTemplate_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		deleteFn: func(_ context.Context, id string, tenantID string) (bool, error) {
			return false, nil
		},
	})

	w := performRequest(h, "DELETE", "/pipeline-templates/t1", nil, map[string]string{
		"X-Tenant-ID": "tenant-1",
	})

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestHandler_DeleteTemplate_Error(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		deleteFn: func(_ context.Context, id string, tenantID string) (bool, error) {
			return false, errors.New("db error")
		},
	})

	w := performRequest(h, "DELETE", "/pipeline-templates/t1", nil, map[string]string{
		"X-Tenant-ID": "tenant-1",
	})

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

// --- InstantiateTemplate tests ---

func TestHandler_InstantiateTemplate_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		instantiateFn: func(_ context.Context, templateID string, req *models.InstantiateRequest, tenantID string) (*models.InstantiatedPipeline, error) {
			return &models.InstantiatedPipeline{
				ID:       "pipeline-1",
				Name:     req.Name,
				Status:   "draft",
				SourceID: templateID,
			}, nil
		},
	})

	w := performRequest(h, "POST", "/pipeline-templates/t1/instantiate", models.InstantiateRequest{
		Name: "my-pipeline",
	}, map[string]string{
		"X-Tenant-ID": "tenant-1",
	})

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["success"] != true {
		t.Error("expected success=true")
	}
}

func TestHandler_InstantiateTemplate_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})

	w := performRequest(h, "POST", "/pipeline-templates/t1/instantiate", "invalid json", map[string]string{
		"X-Tenant-ID": "tenant-1",
	})

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHandler_InstantiateTemplate_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		instantiateFn: func(_ context.Context, templateID string, req *models.InstantiateRequest, tenantID string) (*models.InstantiatedPipeline, error) {
			return nil, service.ErrTemplateNotFound
		},
	})

	w := performRequest(h, "POST", "/pipeline-templates/t1/instantiate", models.InstantiateRequest{
		Name: "my-pipeline",
	}, map[string]string{
		"X-Tenant-ID": "tenant-1",
	})

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestHandler_InstantiateTemplate_Error(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		instantiateFn: func(_ context.Context, templateID string, req *models.InstantiateRequest, tenantID string) (*models.InstantiatedPipeline, error) {
			return nil, errors.New("db error")
		},
	})

	w := performRequest(h, "POST", "/pipeline-templates/t1/instantiate", models.InstantiateRequest{
		Name: "my-pipeline",
	}, map[string]string{
		"X-Tenant-ID": "tenant-1",
	})

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

// --- Tenant fallback test ---

func TestHandler_TenantIDFallback(t *testing.T) {
	calledTenantID := ""
	h := newHandlerWithSvc(&mockSvc{
		listFn: func(_ context.Context, tenantID string) ([]models.PipelineTemplate, int, error) {
			calledTenantID = tenantID
			return nil, 0, nil
		},
	})

	// No X-Tenant-ID header should result in the zero UUID fallback
	w := performRequest(h, "GET", "/pipeline-templates", nil, nil)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if calledTenantID != "00000000-0000-0000-0000-000000000000" {
		t.Errorf("expected zero UUID fallback, got %s", calledTenantID)
	}
}