package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/ci-type/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/ci-type/models"
	"orion/platform-svc-go/internal/ci-type/repository"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeHandlerService{})
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

<<<<<<< Updated upstream
type fakeHandlerService struct{}

func (f *fakeHandlerService) CreateType(ctx context.Context, req *models.CreateCITypeRequest, tenantID string) (*models.CIType, error) {
	return &models.CIType{}, nil
}

func (f *fakeHandlerService) CreateVersion(ctx context.Context, ciTypeID string, tenantID string, changeSummary *string) (*models.CITypeVersion, error) {
	return &models.CITypeVersion{}, nil
}

func (f *fakeHandlerService) DeleteType(ctx context.Context, id string, tenantID string) (bool, error) {
	return false, nil
}

func (f *fakeHandlerService) GetAttributes(ctx context.Context, ciTypeID string, tenantID string) ([]models.CIAttribute, error) {
	return []models.CIAttribute{}, nil
}

func (f *fakeHandlerService) GetTypeWithSchema(ctx context.Context, id string, tenantID string) (*models.TypeWithSchema, error) {
	return &models.TypeWithSchema{}, nil
}

func (f *fakeHandlerService) GetVersions(ctx context.Context, ciTypeID string, tenantID string) ([]models.CITypeVersion, error) {
	return []models.CITypeVersion{}, nil
}

func (f *fakeHandlerService) ListTypes(ctx context.Context, tenantID string, filter *repository.ListFilter) ([]models.CIType, int, error) {
	return []models.CIType{}, 0, nil
}

func (f *fakeHandlerService) Rollback(ctx context.Context, ciTypeID string, tenantID string, versionID string) (*models.CIType, error) {
	return &models.CIType{}, nil
}

func (f *fakeHandlerService) SetAttributes(ctx context.Context, ciTypeID string, tenantID string, attrs []models.CreateCIAttributeRequest) ([]models.CIAttribute, error) {
	return []models.CIAttribute{}, nil
}

func (f *fakeHandlerService) UpdateType(ctx context.Context, id string, req *models.UpdateCITypeRequest, tenantID string) (*models.CIType, error) {
	return &models.CIType{}, nil
}

func (f *fakeHandlerService) ValidateInstance(ctx context.Context, ciTypeID string, tenantID string, data map[string]any) (*models.ValidationResult, error) {
	return &models.ValidationResult{}, nil
}

var _ service.ServiceInterface = (*fakeHandlerService)(nil)
=======
type fakeci_typeService struct{}

func (f *fakeci_typeService) CreateType(ctx context.Context, req *models.CreateCITypeRequest, tenantID string) ((*models.CIType, error)) {
	return &models.CIType{}, nil
}

func (f *fakeci_typeService) CreateVersion(ctx context.Context, ciTypeID string, tenantID string, changeSummary *string) ((*models.CITypeVersion, error)) {
	return &models.CITypeVersion{}, nil
}

func (f *fakeci_typeService) DeleteType(ctx context.Context, id string, tenantID string) ((bool, error)) {
	return false, nil
}

func (f *fakeci_typeService) GetAttributes(ctx context.Context, ciTypeID string, tenantID string) (([]models.CIAttribute, error)) {
	return []models.CIAttribute{}, nil
}

func (f *fakeci_typeService) GetTypeWithSchema(ctx context.Context, id string, tenantID string) ((*models.TypeWithSchema, error)) {
	return &models.TypeWithSchema{}, nil
}

func (f *fakeci_typeService) GetVersions(ctx context.Context, ciTypeID string, tenantID string) (([]models.CITypeVersion, error)) {
	return []models.CITypeVersion{}, nil
}

func (f *fakeci_typeService) ListTypes(ctx context.Context, tenantID string, filter *repository.ListFilter) (([]models.CIType, int, error)) {
	return []models.CIType{}, 0, nil
}

func (f *fakeci_typeService) Rollback(ctx context.Context, ciTypeID string, tenantID string, versionID string) ((*models.CIType, error)) {
	return &models.CIType{}, nil
}

func (f *fakeci_typeService) SetAttributes(ctx context.Context, ciTypeID string, tenantID string, attrs []models.CreateCIAttributeRequest) (([]models.CIAttribute, error)) {
	return []models.CIAttribute{}, nil
}

func (f *fakeci_typeService) UpdateType(ctx context.Context, id string, req *models.UpdateCITypeRequest, tenantID string) ((*models.CIType, error)) {
	return &models.CIType{}, nil
}

func (f *fakeci_typeService) ValidateInstance(ctx context.Context, ciTypeID string, tenantID string, data map[string]any) ((*models.ValidationResult, error)) {
	return &models.ValidationResult{}, nil
}

var _ service.ServiceInterface = (*fakeci_typeService)(nil)
>>>>>>> Stashed changes


func TestCI_TYPE_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestCI_TYPE_Handler_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}

func TestCI_TYPE_Handler_ListTypes(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListTypes(c)
	if w.Code >= 500 {
		t.Fatalf("ListTypes: got %d", w.Code)
	}
}

func TestCI_TYPE_Handler_CreateType(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateType(c)
	if w.Code >= 500 {
		t.Fatalf("CreateType: got %d", w.Code)
	}
}

func TestCI_TYPE_Handler_GetType(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetType(c)
	if w.Code >= 500 {
		t.Fatalf("GetType: got %d", w.Code)
	}
}

func TestCI_TYPE_Handler_UpdateType(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdateType(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateType: got %d", w.Code)
	}
}

func TestCI_TYPE_Handler_DeleteType(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteType(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteType: got %d", w.Code)
	}
}

func TestCI_TYPE_Handler_GetAttributes(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetAttributes(c)
	if w.Code >= 500 {
		t.Fatalf("GetAttributes: got %d", w.Code)
	}
}

func TestCI_TYPE_Handler_SetAttributes(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().SetAttributes(c)
	if w.Code >= 500 {
		t.Fatalf("SetAttributes: got %d", w.Code)
	}
}

func TestCI_TYPE_Handler_ValidateInstance(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ValidateInstance(c)
	if w.Code >= 500 {
		t.Fatalf("ValidateInstance: got %d", w.Code)
	}
}

func TestCI_TYPE_Handler_CreateVersion(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateVersion(c)
	if w.Code >= 500 {
		t.Fatalf("CreateVersion: got %d", w.Code)
	}
}

func TestCI_TYPE_Handler_GetVersions(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetVersions(c)
	if w.Code >= 500 {
		t.Fatalf("GetVersions: got %d", w.Code)
	}
}

func TestCI_TYPE_Handler_Rollback(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Rollback(c)
	if w.Code >= 500 {
		t.Fatalf("Rollback: got %d", w.Code)
	}
}
