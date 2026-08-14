package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/pipeline-templates/models"
	"orion/platform-svc-go/internal/pipeline-templates/service"

	"github.com/gin-gonic/gin"
)

// --- mock service ---

type mockSvc struct {
	getCategoriesFn func(ctx context.Context, tenantID string) ([]models.TemplateCategorySummary, error)
	listFn          func(ctx context.Context, tenantID string, q *models.ListQuery) ([]models.PipelineTemplate, int, error)
	createFn        func(ctx context.Context, tenantID string, req models.CreateTemplateRequest, authorID string) (*models.PipelineTemplate, error)
	getFn           func(ctx context.Context, tenantID, id string) (*models.PipelineTemplate, error)
	updateFn        func(ctx context.Context, tenantID, id string, req models.UpdateTemplateRequest) (*models.PipelineTemplate, error)
	deleteFn        func(ctx context.Context, tenantID, id string) error
	publishFn       func(ctx context.Context, tenantID, id string) (*models.PipelineTemplate, error)
	deprecateFn     func(ctx context.Context, tenantID, id string) (*models.PipelineTemplate, error)
	getVersionsFn   func(ctx context.Context, tenantID, templateID string, q *models.ListQuery) ([]models.TemplateVersion, int, error)
	instantiateFn   func(ctx context.Context, tenantID, id string, req models.InstantiateTemplateRequest) (*models.InstantiateTemplateResponse, error)
	starFn          func(ctx context.Context, tenantID, id string) (*models.PipelineTemplate, error)
	unstarFn        func(ctx context.Context, tenantID, id string) (*models.PipelineTemplate, error)
}

func (m *mockSvc) GetCategories(ctx context.Context, tenantID string) ([]models.TemplateCategorySummary, error) {
	if m.getCategoriesFn != nil {
		return m.getCategoriesFn(ctx, tenantID)
	}
	return nil, nil
}

func (m *mockSvc) List(ctx context.Context, tenantID string, q *models.ListQuery) ([]models.PipelineTemplate, int, error) {
	if m.listFn != nil {
		return m.listFn(ctx, tenantID, q)
	}
	return nil, 0, nil
}

func (m *mockSvc) Create(ctx context.Context, tenantID string, req models.CreateTemplateRequest, authorID string) (*models.PipelineTemplate, error) {
	if m.createFn != nil {
		return m.createFn(ctx, tenantID, req, authorID)
	}
	return nil, nil
}

func (m *mockSvc) Get(ctx context.Context, tenantID, id string) (*models.PipelineTemplate, error) {
	if m.getFn != nil {
		return m.getFn(ctx, tenantID, id)
	}
	return nil, nil
}

func (m *mockSvc) Update(ctx context.Context, tenantID, id string, req models.UpdateTemplateRequest) (*models.PipelineTemplate, error) {
	if m.updateFn != nil {
		return m.updateFn(ctx, tenantID, id, req)
	}
	return nil, nil
}

func (m *mockSvc) Delete(ctx context.Context, tenantID, id string) error {
	if m.deleteFn != nil {
		return m.deleteFn(ctx, tenantID, id)
	}
	return nil
}

func (m *mockSvc) Publish(ctx context.Context, tenantID, id string) (*models.PipelineTemplate, error) {
	if m.publishFn != nil {
		return m.publishFn(ctx, tenantID, id)
	}
	return nil, nil
}

func (m *mockSvc) Deprecate(ctx context.Context, tenantID, id string) (*models.PipelineTemplate, error) {
	if m.deprecateFn != nil {
		return m.deprecateFn(ctx, tenantID, id)
	}
	return nil, nil
}

func (m *mockSvc) GetVersions(ctx context.Context, tenantID, templateID string, q *models.ListQuery) ([]models.TemplateVersion, int, error) {
	if m.getVersionsFn != nil {
		return m.getVersionsFn(ctx, tenantID, templateID, q)
	}
	return nil, 0, nil
}

func (m *mockSvc) Instantiate(ctx context.Context, tenantID, id string, req models.InstantiateTemplateRequest) (*models.InstantiateTemplateResponse, error) {
	if m.instantiateFn != nil {
		return m.instantiateFn(ctx, tenantID, id, req)
	}
	return nil, nil
}

func (m *mockSvc) Star(ctx context.Context, tenantID, id string) (*models.PipelineTemplate, error) {
	if m.starFn != nil {
		return m.starFn(ctx, tenantID, id)
	}
	return nil, nil
}

func (m *mockSvc) Unstar(ctx context.Context, tenantID, id string) (*models.PipelineTemplate, error) {
	if m.unstarFn != nil {
		return m.unstarFn(ctx, tenantID, id)
	}
	return nil, nil
}

// --- handler constructor override for tests ---

func newHandlerWithSvc(svc Service) *Handler {
	return &Handler{svc: svc}
}

// --- helpers ---

func performRequest(h *Handler, handlerFn func(c *gin.Context), method string, body interface{}, pathParams map[string]string, queryParams map[string]string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	// Set default context values
	c.Set("tenant_id", "tenant-1")

	var buf bytes.Buffer
	if body != nil {
		b, _ := json.Marshal(body)
		buf = *bytes.NewBuffer(b)
	}
	c.Request = httptest.NewRequest(method, "/", &buf)
	c.Request.Header.Set("Content-Type", "application/json")

	// Set path params
	if pathParams != nil {
		for k, v := range pathParams {
			c.Params = append(c.Params, gin.Param{Key: k, Value: v})
		}
	}

	// Set query params
	if queryParams != nil {
		q := c.Request.URL.Query()
		for k, v := range queryParams {
			q.Set(k, v)
		}
		c.Request.URL.RawQuery = q.Encode()
	}

	handlerFn(c)
	return w
}

// --- Categories ---

func TestHandler_Categories_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getCategoriesFn: func(_ context.Context, tenantID string) ([]models.TemplateCategorySummary, error) {
			if tenantID != "tenant-1" {
				t.Errorf("expected tenant-1, got %s", tenantID)
			}
			return []models.TemplateCategorySummary{
				{Name: "ci_cd", DisplayName: "CI/CD", Count: 5},
			}, nil
		},
	})

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("GET", "/", nil)
	c.Set("tenant_id", "tenant-1")

	h.Categories(c)

	if c.Writer.Status() != http.StatusOK {
		t.Errorf("expected 200, got %d", c.Writer.Status())
	}
}

func TestHandler_Categories_InternalError(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getCategoriesFn: func(_ context.Context, _ string) ([]models.TemplateCategorySummary, error) {
			return nil, errors.New("db error")
		},
	})

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("GET", "/", nil)
	c.Set("tenant_id", "tenant-1")

	h.Categories(c)

	if c.Writer.Status() != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", c.Writer.Status())
	}
}

// --- List ---

func TestHandler_List_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		listFn: func(_ context.Context, tenantID string, q *models.ListQuery) ([]models.PipelineTemplate, int, error) {
			if tenantID != "tenant-1" {
				t.Errorf("expected tenant-1, got %s", tenantID)
			}
			return []models.PipelineTemplate{
				{ID: "tmpl-1", Name: "template1"},
			}, 1, nil
		},
	})

	w := performRequest(h, h.List, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	// The response is wrapped: {"success":true,"data":{"data":[...],"total":1}}
	data, ok := resp["data"].(map[string]interface{})
	if !ok {
		t.Fatal("expected data object in response")
	}
	if data["total"] != float64(1) {
		t.Errorf("expected total 1, got %v", data["total"])
	}
}

func TestHandler_List_WithQueryParams(t *testing.T) {
	var capturedQ *models.ListQuery
	h := newHandlerWithSvc(&mockSvc{
		listFn: func(_ context.Context, _ string, q *models.ListQuery) ([]models.PipelineTemplate, int, error) {
			capturedQ = q
			return nil, 0, nil
		},
	})

	w := performRequest(h, h.List, "GET", nil, nil, map[string]string{
		"category": "ci_cd",
		"status":   "published",
		"limit":    "10",
		"offset":   "5",
	})

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if capturedQ == nil {
		t.Fatal("expected list query to be captured")
	}
	if capturedQ.Category != "ci_cd" {
		t.Errorf("expected category ci_cd, got %s", capturedQ.Category)
	}
	if capturedQ.Status != "published" {
		t.Errorf("expected status published, got %s", capturedQ.Status)
	}
	if capturedQ.Limit != 10 {
		t.Errorf("expected limit 10, got %d", capturedQ.Limit)
	}
	if capturedQ.Offset != 5 {
		t.Errorf("expected offset 5, got %d", capturedQ.Offset)
	}
}

func TestHandler_List_DefaultLimit(t *testing.T) {
	var capturedQ *models.ListQuery
	h := newHandlerWithSvc(&mockSvc{
		listFn: func(_ context.Context, _ string, q *models.ListQuery) ([]models.PipelineTemplate, int, error) {
			capturedQ = q
			return nil, 0, nil
		},
	})

	// Limit 0 should be defaulted to 20
	w := performRequest(h, h.List, "GET", nil, nil, map[string]string{"limit": "0"})

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if capturedQ.Limit != 20 {
		t.Errorf("expected default limit 20, got %d", capturedQ.Limit)
	}
}

func TestHandler_List_ClampLimit(t *testing.T) {
	var capturedQ *models.ListQuery
	h := newHandlerWithSvc(&mockSvc{
		listFn: func(_ context.Context, _ string, q *models.ListQuery) ([]models.PipelineTemplate, int, error) {
			capturedQ = q
			return nil, 0, nil
		},
	})

	// Limit > 100 should be defaulted to 20
	w := performRequest(h, h.List, "GET", nil, nil, map[string]string{"limit": "200"})

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if capturedQ.Limit != 20 {
		t.Errorf("expected default limit 20 for overflow, got %d", capturedQ.Limit)
	}
}

func TestHandler_List_InternalError(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		listFn: func(_ context.Context, _ string, _ *models.ListQuery) ([]models.PipelineTemplate, int, error) {
			return nil, 0, errors.New("db error")
		},
	})

	w := performRequest(h, h.List, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

// --- Search ---

func TestHandler_Search_Success(t *testing.T) {
	var capturedQ *models.ListQuery
	h := newHandlerWithSvc(&mockSvc{
		listFn: func(_ context.Context, _ string, q *models.ListQuery) ([]models.PipelineTemplate, int, error) {
			capturedQ = q
			return []models.PipelineTemplate{{ID: "tmpl-1"}}, 1, nil
		},
	})

	w := performRequest(h, h.Search, "GET", nil, nil, map[string]string{"q": "deploy"})

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if capturedQ == nil {
		t.Fatal("expected query to be captured")
	}
	if capturedQ.Search != "deploy" {
		t.Errorf("expected search 'deploy', got %s", capturedQ.Search)
	}
}

func TestHandler_Search_InternalError(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		listFn: func(_ context.Context, _ string, _ *models.ListQuery) ([]models.PipelineTemplate, int, error) {
			return nil, 0, errors.New("db error")
		},
	})

	w := performRequest(h, h.Search, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

// --- Get ---

func TestHandler_Get_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getFn: func(_ context.Context, tenantID, id string) (*models.PipelineTemplate, error) {
			if tenantID != "tenant-1" {
				t.Errorf("expected tenant-1, got %s", tenantID)
			}
			return &models.PipelineTemplate{ID: id, Name: "test"}, nil
		},
	})

	w := performRequest(h, h.Get, "GET", nil, map[string]string{"id": "tmpl-1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_Get_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getFn: func(_ context.Context, _, _ string) (*models.PipelineTemplate, error) {
			return nil, errors.New("not found")
		},
	})

	w := performRequest(h, h.Get, "GET", nil, map[string]string{"id": "nonexistent"}, nil)
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

// --- Create ---

func TestHandler_Create_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		createFn: func(_ context.Context, tenantID string, req models.CreateTemplateRequest, authorID string) (*models.PipelineTemplate, error) {
			if tenantID != "tenant-1" {
				t.Errorf("expected tenant-1, got %s", tenantID)
			}
			if authorID != "user-1" {
				t.Errorf("expected authorID user-1, got %s", authorID)
			}
			return &models.PipelineTemplate{
				ID: "new-tmpl", Name: req.Name, Author: authorID,
			}, nil
		},
	})

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("tenant_id", "tenant-1")
	c.Set("user_id", "user-1")

	body := map[string]interface{}{
		"name":        "test-template",
		"displayName": "Test Template",
		"category":    "ci_cd",
		"config":      map[string]interface{}{},
	}
	b, _ := json.Marshal(body)
	c.Request = httptest.NewRequest("POST", "/", bytes.NewBuffer(b))
	c.Request.Header.Set("Content-Type", "application/json")

	h.Create(c)

	if c.Writer.Status() != http.StatusCreated {
		t.Errorf("expected 201, got %d", c.Writer.Status())
	}
}

func TestHandler_Create_MissingFields(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("tenant_id", "tenant-1")
	c.Set("user_id", "user-1")

	c.Request = httptest.NewRequest("POST", "/", bytes.NewBufferString(`{"name":"test"}`))
	c.Request.Header.Set("Content-Type", "application/json")

	h.Create(c)

	if c.Writer.Status() != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", c.Writer.Status())
	}
}

func TestHandler_Create_DefaultAuthor(t *testing.T) {
	var capturedAuthor string
	h := newHandlerWithSvc(&mockSvc{
		createFn: func(_ context.Context, _ string, _ models.CreateTemplateRequest, authorID string) (*models.PipelineTemplate, error) {
			capturedAuthor = authorID
			return &models.PipelineTemplate{ID: "new-tmpl"}, nil
		},
	})

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("tenant_id", "tenant-1")
	// user_id not set -> should default to "system"

	body := map[string]interface{}{
		"name":        "test",
		"displayName": "Test",
		"category":    "ci_cd",
		"config":      map[string]interface{}{},
	}
	b, _ := json.Marshal(body)
	c.Request = httptest.NewRequest("POST", "/", bytes.NewBuffer(b))
	c.Request.Header.Set("Content-Type", "application/json")

	h.Create(c)

	if c.Writer.Status() != http.StatusCreated {
		t.Errorf("expected 201, got %d", c.Writer.Status())
	}
	if capturedAuthor != "system" {
		t.Errorf("expected author 'system', got %s", capturedAuthor)
	}
}

func TestHandler_Create_ServiceError(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		createFn: func(_ context.Context, _ string, _ models.CreateTemplateRequest, _ string) (*models.PipelineTemplate, error) {
			return nil, errors.New("db error")
		},
	})

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("tenant_id", "tenant-1")
	c.Set("user_id", "user-1")

	body := map[string]interface{}{
		"name":        "test",
		"displayName": "Test",
		"category":    "ci_cd",
		"config":      map[string]interface{}{},
	}
	b, _ := json.Marshal(body)
	c.Request = httptest.NewRequest("POST", "/", bytes.NewBuffer(b))
	c.Request.Header.Set("Content-Type", "application/json")

	h.Create(c)

	if c.Writer.Status() != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", c.Writer.Status())
	}
}

// --- Update ---

func TestHandler_Update_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		updateFn: func(_ context.Context, tenantID, id string, req models.UpdateTemplateRequest) (*models.PipelineTemplate, error) {
			if tenantID != "tenant-1" {
				t.Errorf("expected tenant-1, got %s", tenantID)
			}
			if id != "tmpl-1" {
				t.Errorf("expected id tmpl-1, got %s", id)
			}
			if req.Name == nil || *req.Name != "updated" {
				t.Errorf("expected name 'updated', got %v", req.Name)
			}
			return &models.PipelineTemplate{ID: "tmpl-1", Name: "updated"}, nil
		},
	})

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("tenant_id", "tenant-1")
	c.Params = append(c.Params, gin.Param{Key: "id", Value: "tmpl-1"})

	body := map[string]interface{}{"name": "updated"}
	b, _ := json.Marshal(body)
	c.Request = httptest.NewRequest("PUT", "/", bytes.NewBuffer(b))
	c.Request.Header.Set("Content-Type", "application/json")

	h.Update(c)

	if c.Writer.Status() != http.StatusOK {
		t.Errorf("expected 200, got %d", c.Writer.Status())
	}
}

func TestHandler_Update_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})

	w := performRequest(h, h.Update, "PUT", "invalid json", map[string]string{"id": "tmpl-1"}, nil)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestHandler_Update_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		updateFn: func(_ context.Context, _, _ string, _ models.UpdateTemplateRequest) (*models.PipelineTemplate, error) {
			return nil, errors.New("not found")
		},
	})

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("tenant_id", "tenant-1")
	c.Params = append(c.Params, gin.Param{Key: "id", Value: "nonexistent"})

	body := map[string]interface{}{"name": "updated"}
	b, _ := json.Marshal(body)
	c.Request = httptest.NewRequest("PUT", "/", bytes.NewBuffer(b))
	c.Request.Header.Set("Content-Type", "application/json")

	h.Update(c)

	if c.Writer.Status() != http.StatusNotFound {
		t.Errorf("expected 404, got %d", c.Writer.Status())
	}
}

// --- Delete ---

func TestHandler_Delete_Success(t *testing.T) {
	var called bool
	h := newHandlerWithSvc(&mockSvc{
		deleteFn: func(_ context.Context, tenantID, id string) error {
			called = true
			if tenantID != "tenant-1" {
				t.Errorf("expected tenant-1, got %s", tenantID)
			}
			if id != "tmpl-1" {
				t.Errorf("expected id tmpl-1, got %s", id)
			}
			return nil
		},
	})

	// Use direct context setup for 204 responses to work correctly with gin test mode
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = append(c.Params, gin.Param{Key: "id", Value: "tmpl-1"})
	c.Request = httptest.NewRequest("DELETE", "/", nil)

	h.Delete(c)

	if c.Writer.Status() != http.StatusNoContent {
		t.Errorf("expected 204, got %d", c.Writer.Status())
	}
	if !called {
		t.Error("expected delete to be called")
	}
}

func TestHandler_Delete_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		deleteFn: func(_ context.Context, _, _ string) error {
			return errors.New("not found")
		},
	})

	w := performRequest(h, h.Delete, "DELETE", nil, map[string]string{"id": "nonexistent"}, nil)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

// --- Publish ---

func TestHandler_Publish_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		publishFn: func(_ context.Context, tenantID, id string) (*models.PipelineTemplate, error) {
			if tenantID != "tenant-1" {
				t.Errorf("expected tenant-1, got %s", tenantID)
			}
			if id != "tmpl-1" {
				t.Errorf("expected id tmpl-1, got %s", id)
			}
			return &models.PipelineTemplate{ID: "tmpl-1", Status: models.StatusPublished}, nil
		},
	})

	w := performRequest(h, h.Publish, "POST", nil, map[string]string{"id": "tmpl-1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_Publish_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		publishFn: func(_ context.Context, _, _ string) (*models.PipelineTemplate, error) {
			return nil, errors.New("not found")
		},
	})

	w := performRequest(h, h.Publish, "POST", nil, map[string]string{"id": "nonexistent"}, nil)
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

// --- Deprecate ---

func TestHandler_Deprecate_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		deprecateFn: func(_ context.Context, tenantID, id string) (*models.PipelineTemplate, error) {
			if tenantID != "tenant-1" {
				t.Errorf("expected tenant-1, got %s", tenantID)
			}
			if id != "tmpl-1" {
				t.Errorf("expected id tmpl-1, got %s", id)
			}
			return &models.PipelineTemplate{ID: "tmpl-1", Status: models.StatusDeprecated}, nil
		},
	})

	w := performRequest(h, h.Deprecate, "POST", nil, map[string]string{"id": "tmpl-1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_Deprecate_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		deprecateFn: func(_ context.Context, _, _ string) (*models.PipelineTemplate, error) {
			return nil, errors.New("not found")
		},
	})

	w := performRequest(h, h.Deprecate, "POST", nil, map[string]string{"id": "nonexistent"}, nil)
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

// --- Versions ---

func TestHandler_Versions_Success(t *testing.T) {
	var capturedQ *models.ListQuery
	h := newHandlerWithSvc(&mockSvc{
		getVersionsFn: func(_ context.Context, tenantID, templateID string, q *models.ListQuery) ([]models.TemplateVersion, int, error) {
			if tenantID != "tenant-1" {
				t.Errorf("expected tenant-1, got %s", tenantID)
			}
			if templateID != "tmpl-1" {
				t.Errorf("expected templateID tmpl-1, got %s", templateID)
			}
			capturedQ = q
			return []models.TemplateVersion{{ID: "ver-1", Version: "1.0.0"}}, 1, nil
		},
	})

	w := performRequest(h, h.Versions, "GET", nil, map[string]string{"id": "tmpl-1"}, map[string]string{"limit": "5"})
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if capturedQ == nil {
		t.Fatal("expected query to be captured")
	}
	if capturedQ.Limit != 5 {
		t.Errorf("expected limit 5, got %d", capturedQ.Limit)
	}
}

func TestHandler_Versions_DefaultLimit(t *testing.T) {
	var capturedQ *models.ListQuery
	h := newHandlerWithSvc(&mockSvc{
		getVersionsFn: func(_ context.Context, _, _ string, q *models.ListQuery) ([]models.TemplateVersion, int, error) {
			capturedQ = q
			return nil, 0, nil
		},
	})

	w := performRequest(h, h.Versions, "GET", nil, map[string]string{"id": "tmpl-1"}, map[string]string{"limit": "0"})
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if capturedQ.Limit != 20 {
		t.Errorf("expected default limit 20, got %d", capturedQ.Limit)
	}
}

func TestHandler_Versions_InternalError(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getVersionsFn: func(_ context.Context, _, _ string, _ *models.ListQuery) ([]models.TemplateVersion, int, error) {
			return nil, 0, errors.New("db error")
		},
	})

	w := performRequest(h, h.Versions, "GET", nil, map[string]string{"id": "tmpl-1"}, nil)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

// --- Instantiate ---

func TestHandler_Instantiate_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		instantiateFn: func(_ context.Context, tenantID, id string, req models.InstantiateTemplateRequest) (*models.InstantiateTemplateResponse, error) {
			if tenantID != "tenant-1" {
				t.Errorf("expected tenant-1, got %s", tenantID)
			}
			if id != "tmpl-1" {
				t.Errorf("expected id tmpl-1, got %s", id)
			}
			return &models.InstantiateTemplateResponse{
				PipelineID: "pipeline_xxx",
				Config:     map[string]interface{}{"key": "val"},
			}, nil
		},
	})

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("tenant_id", "tenant-1")
	c.Params = append(c.Params, gin.Param{Key: "id", Value: "tmpl-1"})

	body := map[string]interface{}{
		"name":       "my-pipeline",
		"parameters": map[string]interface{}{},
	}
	b, _ := json.Marshal(body)
	c.Request = httptest.NewRequest("POST", "/", bytes.NewBuffer(b))
	c.Request.Header.Set("Content-Type", "application/json")

	h.Instantiate(c)

	if c.Writer.Status() != http.StatusCreated {
		t.Errorf("expected 201, got %d", c.Writer.Status())
	}
}

func TestHandler_Instantiate_BadBody(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})

	w := performRequest(h, h.Instantiate, "POST", "invalid json", map[string]string{"id": "tmpl-1"}, nil)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestHandler_Instantiate_ServiceError(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		instantiateFn: func(_ context.Context, _, _ string, _ models.InstantiateTemplateRequest) (*models.InstantiateTemplateResponse, error) {
			return nil, service.ErrTemplateNotPublished
		},
	})

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("tenant_id", "tenant-1")
	c.Params = append(c.Params, gin.Param{Key: "id", Value: "tmpl-1"})

	body := map[string]interface{}{
		"name":       "my-pipeline",
		"parameters": map[string]interface{}{},
	}
	b, _ := json.Marshal(body)
	c.Request = httptest.NewRequest("POST", "/", bytes.NewBuffer(b))
	c.Request.Header.Set("Content-Type", "application/json")

	h.Instantiate(c)

	if c.Writer.Status() != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", c.Writer.Status())
	}
}

// --- Star ---

func TestHandler_Star_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		starFn: func(_ context.Context, tenantID, id string) (*models.PipelineTemplate, error) {
			if tenantID != "tenant-1" {
				t.Errorf("expected tenant-1, got %s", tenantID)
			}
			if id != "tmpl-1" {
				t.Errorf("expected id tmpl-1, got %s", id)
			}
			return &models.PipelineTemplate{ID: "tmpl-1", StarCount: 1}, nil
		},
	})

	w := performRequest(h, h.Star, "POST", nil, map[string]string{"id": "tmpl-1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_Star_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		starFn: func(_ context.Context, _, _ string) (*models.PipelineTemplate, error) {
			return nil, errors.New("not found")
		},
	})

	w := performRequest(h, h.Star, "POST", nil, map[string]string{"id": "nonexistent"}, nil)
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

// --- Unstar ---

func TestHandler_Unstar_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		unstarFn: func(_ context.Context, tenantID, id string) (*models.PipelineTemplate, error) {
			if tenantID != "tenant-1" {
				t.Errorf("expected tenant-1, got %s", tenantID)
			}
			if id != "tmpl-1" {
				t.Errorf("expected id tmpl-1, got %s", id)
			}
			return &models.PipelineTemplate{ID: "tmpl-1", StarCount: 0}, nil
		},
	})

	w := performRequest(h, h.Unstar, "DELETE", nil, map[string]string{"id": "tmpl-1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_Unstar_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		unstarFn: func(_ context.Context, _, _ string) (*models.PipelineTemplate, error) {
			return nil, errors.New("not found")
		},
	})

	w := performRequest(h, h.Unstar, "DELETE", nil, map[string]string{"id": "nonexistent"}, nil)
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

// --- response body parsing helpers ---

func TestHandler_List_ResponseStructure(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		listFn: func(_ context.Context, _ string, _ *models.ListQuery) ([]models.PipelineTemplate, int, error) {
			return []models.PipelineTemplate{
				{ID: "tmpl-1", Name: "test"},
			}, 1, nil
		},
	})

	w := performRequest(h, h.List, "GET", nil, nil, nil)

	var resp struct {
		Success bool        `json:"success"`
		Data    interface{} `json:"data"`
		Total   int         `json:"total"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}
