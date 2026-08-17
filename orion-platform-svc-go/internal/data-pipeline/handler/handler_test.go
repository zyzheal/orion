package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/data-pipeline/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/data-pipeline/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeHandlerService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

<<<<<<< Updated upstream
type fakeHandlerService struct{}

func (f *fakeHandlerService) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Pipeline, error) {
	return &models.Pipeline{}, nil
}

func (f *fakeHandlerService) Delete(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakeHandlerService) Get(ctx context.Context, tenantID, id string) (*models.Pipeline, error) {
	return &models.Pipeline{}, nil
}

func (f *fakeHandlerService) GetLineage(ctx context.Context, tenantID, id string) (map[string]any, error) {
	return map[string]any{}, nil
}

func (f *fakeHandlerService) GetLogs(ctx context.Context, tenantID, id string) ([]string, error) {
	return []string{}, nil
}

func (f *fakeHandlerService) GetStatus(ctx context.Context, tenantID, id string) (string, error) {
	return "", nil
}

func (f *fakeHandlerService) List(ctx context.Context, tenantID string) ([]models.Pipeline, error) {
	return []models.Pipeline{}, nil
}

func (f *fakeHandlerService) ListSchemas(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (f *fakeHandlerService) Pause(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakeHandlerService) Resume(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakeHandlerService) RunPipeline(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakeHandlerService) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Pipeline, error) {
	return &models.Pipeline{}, nil
}

var _ service.ServiceInterface = (*fakeHandlerService)(nil)
=======
type fakedata_pipelineService struct{}

func (f *fakedata_pipelineService) Create(ctx context.Context, tenantID string, req models.CreateRequest) ((*models.Pipeline, error)) {
	return &models.Pipeline{}, nil
}

func (f *fakedata_pipelineService) Delete(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakedata_pipelineService) Get(ctx context.Context, tenantID, id string) ((*models.Pipeline, error)) {
	return &models.Pipeline{}, nil
}

func (f *fakedata_pipelineService) GetLineage(ctx context.Context, tenantID, id string) ((map[string]any, error)) {
	return map[string]any{}, nil
}

func (f *fakedata_pipelineService) GetLogs(ctx context.Context, tenantID, id string) (([]string, error)) {
	return []string{}, nil
}

func (f *fakedata_pipelineService) GetStatus(ctx context.Context, tenantID, id string) ((string, error)) {
	return "", nil
}

func (f *fakedata_pipelineService) List(ctx context.Context, tenantID string) (([]models.Pipeline, error)) {
	return []models.Pipeline{}, nil
}

func (f *fakedata_pipelineService) ListSchemas(ctx context.Context, tenantID string) (([]string, error)) {
	return []string{}, nil
}

func (f *fakedata_pipelineService) Pause(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakedata_pipelineService) Resume(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakedata_pipelineService) RunPipeline(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakedata_pipelineService) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) ((*models.Pipeline, error)) {
	return &models.Pipeline{}, nil
}

var _ service.ServiceInterface = (*fakedata_pipelineService)(nil)
>>>>>>> Stashed changes


func TestHandler_DATA_PIPELINE_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_DATA_PIPELIN_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_DATA_PIPELIN_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_DATA_PIPELIN_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_DATA_PIPELIN_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_DATA_PIPELIN_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_DATA_PIPELIN_RunPipeline(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RunPipeline(c)
	if w.Code >= 500 {
		t.Fatalf("RunPipeline: got %d", w.Code)
	}
}
func TestHandler_DATA_PIPELIN_GetStatus(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStatus(c)
	if w.Code >= 500 {
		t.Fatalf("GetStatus: got %d", w.Code)
	}
}
func TestHandler_DATA_PIPELIN_Pause(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Pause(c)
	if w.Code >= 500 {
		t.Fatalf("Pause: got %d", w.Code)
	}
}
func TestHandler_DATA_PIPELIN_Resume(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Resume(c)
	if w.Code >= 500 {
		t.Fatalf("Resume: got %d", w.Code)
	}
}
func TestHandler_DATA_PIPELIN_GetLogs(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetLogs(c)
	if w.Code >= 500 {
		t.Fatalf("GetLogs: got %d", w.Code)
	}
}
func TestHandler_DATA_PIPELIN_ListSchemas(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListSchemas(c)
	if w.Code >= 500 {
		t.Fatalf("ListSchemas: got %d", w.Code)
	}
}
func TestHandler_DATA_PIPELIN_GetLineage(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetLineage(c)
	if w.Code >= 500 {
		t.Fatalf("GetLineage: got %d", w.Code)
	}
}
