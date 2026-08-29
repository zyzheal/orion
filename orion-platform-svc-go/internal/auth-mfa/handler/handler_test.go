package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/auth-mfa/models"
	"orion/platform-svc-go/internal/auth-mfa/service"

	"context"
	"github.com/gin-gonic/gin"
)

func makeMFAHandler() *Handler {
	return NewHandler(&fakeHandlerService{})
}

type fakeHandlerService struct{}

func (f *fakeHandlerService) ActivateDevice(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeHandlerService) CreateDevice(ctx context.Context, tenantID, userID string, req *models.CreateMFADeviceRequest) (*models.MFADevice, error) {
	return &models.MFADevice{}, nil
}

func (f *fakeHandlerService) DeleteDevice(ctx context.Context, tenantID, id string) (bool, error) {
	return false, nil
}

func (f *fakeHandlerService) DisableDevice(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeHandlerService) GenerateBackupCodes(ctx context.Context, tenantID, userID string) ([]string, error) {
	return []string{}, nil
}

func (f *fakeHandlerService) GetDevice(ctx context.Context, tenantID, id string) (*models.MFADevice, error) {
	return &models.MFADevice{}, nil
}

func (f *fakeHandlerService) ListDevices(ctx context.Context, tenantID, userID string, filter *models.MFADeviceFilter) ([]models.MFADevice, error) {
	return []models.MFADevice{}, nil
}

func (f *fakeHandlerService) VerifyCode(ctx context.Context, tenantID, userID, code string) (bool, error) {
	return false, nil
}

var _ service.ServiceInterface = (*fakeHandlerService)(nil)

func mfaCtx(method string, pathParams map[string]string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Set("user_id", "user-1")
	c.Params = gin.Params{}
	for k, v := range pathParams {
		c.Params = append(c.Params, gin.Param{Key: k, Value: v})
	}
	c.Request = httptest.NewRequest(method, "/", nil)
	return c, w
}

// ==================== RegisterRoutes ====================

func TestMFAHandler_RegisterRoutes(t *testing.T) {
	makeMFAHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

// ==================== CreateDevice ====================

func TestMFAHandler_CreateDevice_BadRequest(t *testing.T) {
	c, w := mfaCtx(http.MethodPost, nil)
	makeMFAHandler().CreateDevice(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("CreateDevice badreq: got %d", w.Code)
	}
}

// ==================== ListDevices ====================

func TestMFAHandler_ListDevices(t *testing.T) {
	c, w := mfaCtx(http.MethodGet, nil)
	makeMFAHandler().ListDevices(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListDevices: got %d", w.Code)
	}
}

// ==================== GetDevice ====================

func TestMFAHandler_GetDevice(t *testing.T) {
	c, w := mfaCtx(http.MethodGet, map[string]string{"id": "d1"})
	makeMFAHandler().GetDevice(c)
	if w.Code < 200 || w.Code >= 500 {
		t.Fatalf("GetDevice: got %d", w.Code)
	}
}

// ==================== ActivateDevice ====================

func TestMFAHandler_ActivateDevice(t *testing.T) {
	c, w := mfaCtx(http.MethodPut, map[string]string{"id": "d1"})
	makeMFAHandler().ActivateDevice(c)
	if w.Code >= 500 {
		t.Fatalf("ActivateDevice: got server error %d", w.Code)
	}
}

// ==================== DisableDevice ====================

func TestMFAHandler_DisableDevice(t *testing.T) {
	c, w := mfaCtx(http.MethodPut, map[string]string{"id": "d1"})
	makeMFAHandler().DisableDevice(c)
	if w.Code >= 500 {
		t.Fatalf("DisableDevice: got server error %d", w.Code)
	}
}

// ==================== DeleteDevice ====================

func TestMFAHandler_DeleteDevice(t *testing.T) {
	c, w := mfaCtx(http.MethodDelete, map[string]string{"id": "d1"})
	makeMFAHandler().DeleteDevice(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteDevice: got server error %d", w.Code)
	}
}

// ==================== VerifyCode ====================

func TestMFAHandler_VerifyCode_BadRequest(t *testing.T) {
	c, w := mfaCtx(http.MethodPost, nil)
	makeMFAHandler().VerifyCode(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("VerifyCode badreq: got %d", w.Code)
	}
}

// ==================== GenerateBackupCodes ====================

func TestMFAHandler_GenerateBackupCodes(t *testing.T) {
	c, w := mfaCtx(http.MethodPost, nil)
	makeMFAHandler().GenerateBackupCodes(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GenerateBackupCodes: got %d", w.Code)
	}
}

// ensure mockSvc type is referenced (not exported)
var _ = models.MFADevice{}
