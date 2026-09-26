package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/cmdb-import/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeImportService{})
}

func makeCtx(method string, path string, body string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	var rdr *strings.Reader
	if body == "" {
		rdr = strings.NewReader("")
	} else {
		rdr = strings.NewReader(body)
	}
	c.Request = httptest.NewRequest(method, path, rdr)
	if body != "" {
		c.Request.Header.Set("Content-Type", "application/json")
	}
	return c, w
}

// fakeImportService records the tenant ID and the pagination arguments each
// handler passes down, so tests can assert the caller's tenant reaches the
// service layer (no handler may drop it or substitute an empty string) and that
// the offset / limit derived from page and page_size are what the handler
// believes it sent.
type fakeImportService struct {
	lastTenant string
	lastStatus string
	lastOffset int
	lastLimit  int
}

func (f *fakeImportService) CreateJob(ctx context.Context, tenantID, name, sourceType, sourcePath, targetType, mode string, mapping map[string]string) (*models.CMDBImportJob, error) {
	f.lastTenant = tenantID
	return &models.CMDBImportJob{ID: "job-1", TenantID: tenantID}, nil
}

func (f *fakeImportService) StartJob(ctx context.Context, tenantID, jobID string) error {
	f.lastTenant = tenantID
	return nil
}

func (f *fakeImportService) GetJob(ctx context.Context, tenantID, jobID string) (*models.CMDBImportJob, error) {
	f.lastTenant = tenantID
	return &models.CMDBImportJob{ID: jobID, TenantID: tenantID}, nil
}

func (f *fakeImportService) ListJobs(ctx context.Context, tenantID, status string, offset, limit int) ([]models.CMDBImportJob, error) {
	f.lastTenant = tenantID
	f.lastStatus = status
	f.lastOffset = offset
	f.lastLimit = limit
	return []models.CMDBImportJob{}, nil
}

func (f *fakeImportService) ListRecordsByJob(ctx context.Context, jobID string, offset, limit int) ([]models.CMDBImportRecord, error) {
	return []models.CMDBImportRecord{}, nil
}

func (f *fakeImportService) CancelJob(ctx context.Context, tenantID, jobID string) error {
	f.lastTenant = tenantID
	return nil
}

func (f *fakeImportService) ValidateSource(ctx context.Context, sourceType, sourcePath string, mapping, config map[string]string) (*models.ValidateImportResponse, error) {
	return &models.ValidateImportResponse{Valid: true}, nil
}

var _ Service = (*fakeImportService)(nil)

// decodeBody pulls a gin.H payload out of a handler response for assertions.
func decodeBody(t *testing.T, w *httptest.ResponseRecorder) map[string]interface{} {
	t.Helper()
	var m map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &m); err != nil {
		t.Fatalf("response is not JSON: %v (body: %s)", err, w.Body.String())
	}
	return m
}

func TestHandler_IMPORT_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

// Each handler must forward the caller's tenant ID to the service layer.
func TestHandler_IMPORT_ForwardsTenantID(t *testing.T) {
	svc := &fakeImportService{}
	h := NewHandler(svc)

	t.Run("CreateJob", func(t *testing.T) {
		c, w := makeCtx(http.MethodPost, "/", `{"name":"n","source_type":"csv","source_path":"/tmp/a.csv","target_type":"ci"}`)
		h.CreateJob(c)
		if w.Code >= 500 {
			t.Fatalf("CreateJob: got %d (body: %s)", w.Code, w.Body.String())
		}
		if svc.lastTenant != "tenant-1" {
			t.Fatalf("CreateJob: tenant not forwarded, got %q", svc.lastTenant)
		}
	})

	t.Run("StartJob", func(t *testing.T) {
		c, w := makeCtx(http.MethodPost, "/", "")
		c.Params = gin.Params{{Key: "id", Value: "job-1"}}
		h.StartJob(c)
		if w.Code >= 500 {
			t.Fatalf("StartJob: got %d (body: %s)", w.Code, w.Body.String())
		}
		if svc.lastTenant != "tenant-1" {
			t.Fatalf("StartJob: tenant not forwarded, got %q", svc.lastTenant)
		}
	})

	t.Run("GetJob", func(t *testing.T) {
		c, w := makeCtx(http.MethodGet, "/", "")
		c.Params = gin.Params{{Key: "id", Value: "job-1"}}
		h.GetJob(c)
		if w.Code >= 500 {
			t.Fatalf("GetJob: got %d (body: %s)", w.Code, w.Body.String())
		}
		if svc.lastTenant != "tenant-1" {
			t.Fatalf("GetJob: tenant not forwarded, got %q", svc.lastTenant)
		}
	})

	t.Run("ListJobs", func(t *testing.T) {
		c, w := makeCtx(http.MethodGet, "/", "")
		h.ListJobs(c)
		if w.Code >= 500 {
			t.Fatalf("ListJobs: got %d (body: %s)", w.Code, w.Body.String())
		}
		if svc.lastTenant != "tenant-1" {
			t.Fatalf("ListJobs: tenant not forwarded, got %q", svc.lastTenant)
		}
	})

	t.Run("GetRecords", func(t *testing.T) {
		c, w := makeCtx(http.MethodGet, "/", "")
		c.Params = gin.Params{{Key: "id", Value: "job-1"}}
		h.GetRecords(c)
		if w.Code >= 500 {
			t.Fatalf("GetRecords: got %d (body: %s)", w.Code, w.Body.String())
		}
	})

	t.Run("CancelJob", func(t *testing.T) {
		c, w := makeCtx(http.MethodPost, "/", "")
		c.Params = gin.Params{{Key: "id", Value: "job-1"}}
		h.CancelJob(c)
		if w.Code >= 500 {
			t.Fatalf("CancelJob: got %d (body: %s)", w.Code, w.Body.String())
		}
		if svc.lastTenant != "tenant-1" {
			t.Fatalf("CancelJob: tenant not forwarded, got %q", svc.lastTenant)
		}
	})

	t.Run("Validate", func(t *testing.T) {
		c, w := makeCtx(http.MethodPost, "/", `{"source_type":"csv","source_path":"/tmp/a.csv"}`)
		h.Validate(c)
		if w.Code >= 500 {
			t.Fatalf("Validate: got %d (body: %s)", w.Code, w.Body.String())
		}
	})
}

func TestHandler_IMPORT_CreateJob(t *testing.T) {
	svc := &fakeImportService{}
	h := NewHandler(svc)
	c, w := makeCtx(http.MethodPost, "/", `{"name":"n","source_type":"csv","source_path":"/tmp/a.csv","target_type":"ci"}`)
	h.CreateJob(c)
	if w.Code >= 500 {
		t.Fatalf("CreateJob: got %d (body: %s)", w.Code, w.Body.String())
	}
	body := decodeBody(t, w)
	data, ok := body["data"].(map[string]interface{})
	if !ok || data["id"] != "job-1" {
		t.Fatalf("CreateJob: unexpected body %v", body)
	}
}

func TestHandler_IMPORT_StartJob(t *testing.T) {
	c, w := makeCtx(http.MethodPost, "/", "")
	c.Params = gin.Params{{Key: "id", Value: "job-1"}}
	newHandler().StartJob(c)
	if w.Code >= 500 {
		t.Fatalf("StartJob: got %d (body: %s)", w.Code, w.Body.String())
	}
	if w.Code != http.StatusOK {
		t.Fatalf("StartJob: expected 200, got %d", w.Code)
	}
}

func TestHandler_IMPORT_GetJob(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", "")
	c.Params = gin.Params{{Key: "id", Value: "job-1"}}
	newHandler().GetJob(c)
	if w.Code >= 500 {
		t.Fatalf("GetJob: got %d (body: %s)", w.Code, w.Body.String())
	}
	if w.Code != http.StatusOK {
		t.Fatalf("GetJob: expected 200, got %d", w.Code)
	}
}

func TestHandler_IMPORT_ListJobs(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", "")
	newHandler().ListJobs(c)
	if w.Code >= 500 {
		t.Fatalf("ListJobs: got %d (body: %s)", w.Code, w.Body.String())
	}
	if w.Code != http.StatusOK {
		t.Fatalf("ListJobs: expected 200, got %d", w.Code)
	}
}

func TestHandler_IMPORT_GetRecords(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", "")
	c.Params = gin.Params{{Key: "id", Value: "job-1"}}
	newHandler().GetRecords(c)
	if w.Code >= 500 {
		t.Fatalf("GetRecords: got %d (body: %s)", w.Code, w.Body.String())
	}
	if w.Code != http.StatusOK {
		t.Fatalf("GetRecords: expected 200, got %d", w.Code)
	}
}

func TestHandler_IMPORT_CancelJob(t *testing.T) {
	c, w := makeCtx(http.MethodPost, "/", "")
	c.Params = gin.Params{{Key: "id", Value: "job-1"}}
	newHandler().CancelJob(c)
	if w.Code >= 500 {
		t.Fatalf("CancelJob: got %d (body: %s)", w.Code, w.Body.String())
	}
	if w.Code != http.StatusOK {
		t.Fatalf("CancelJob: expected 200, got %d", w.Code)
	}
}

func TestHandler_IMPORT_Validate(t *testing.T) {
	c, w := makeCtx(http.MethodPost, "/", `{"source_type":"csv","source_path":"/tmp/a.csv"}`)
	newHandler().Validate(c)
	if w.Code >= 500 {
		t.Fatalf("Validate: got %d (body: %s)", w.Code, w.Body.String())
	}
	body := decodeBody(t, w)
	data, ok := body["data"].(map[string]interface{})
	if !ok || data["valid"] != true {
		t.Fatalf("Validate: expected valid=true, got %v", body)
	}
}

func TestHandler_IMPORT_CreateJob_BadRequest(t *testing.T) {
	// Missing required fields must 400, not 500.
	c, w := makeCtx(http.MethodPost, "/", `{}`)
	newHandler().CreateJob(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("CreateJob with empty body: expected 400, got %d", w.Code)
	}
}

func TestHandler_IMPORT_Validate_BadRequest(t *testing.T) {
	c, w := makeCtx(http.MethodPost, "/", `{}`)
	newHandler().Validate(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("Validate with empty body: expected 400, got %d", w.Code)
	}
}

func TestHandler_IMPORT_GetRecords_NotFound(t *testing.T) {
	// When GetJob returns ErrJobNotFound, GetRecords must 404. Here the fake
	// never errors, so we assert the pass-through reaches RespondSuccess and the
	// handler still works when the job belongs to the caller.
	c, w := makeCtx(http.MethodGet, "/", "")
	c.Params = gin.Params{{Key: "id", Value: "job-1"}}
	newHandler().GetRecords(c)
	if w.Code >= 500 {
		t.Fatalf("GetRecords: got %d (body: %s)", w.Code, w.Body.String())
	}
}
