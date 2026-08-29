package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/permission-audit/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeHandler{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeHandler struct{}

func (f *fakeHandler) ListAuditLogs(ctx context.Context, tenantID string, filter *models.AuditLogFilter) ([]models.PermissionAuditLog, int, error) {
	return []models.PermissionAuditLog{}, 0, nil
}

func (f *fakeHandler) LogPermission(ctx context.Context, tenantID string, req *models.CreateAuditLogRequest, clientIP, userAgent string) (*models.PermissionAuditLog, error) {
	return &models.PermissionAuditLog{}, nil
}

func (f *fakeHandler) GetAuditLog(ctx context.Context, tenantID, id string) (*models.PermissionAuditLog, error) {
	return &models.PermissionAuditLog{}, nil
}

func (f *fakeHandler) DeleteAuditLog(ctx context.Context, tenantID, id string) (bool, error) {
	return false, nil
}

func TestHandler_PERMISSION_AUD_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_PERMISSION_A_ListAuditLogs(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListAuditLogs(c)
	if w.Code >= 500 {
		t.Fatalf("ListAuditLogs: got %d", w.Code)
	}
}
func TestHandler_PERMISSION_A_LogPermission(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().LogPermission(c)
	if w.Code >= 500 {
		t.Fatalf("LogPermission: got %d", w.Code)
	}
}
func TestHandler_PERMISSION_A_GetAuditLog(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetAuditLog(c)
	if w.Code >= 500 {
		t.Fatalf("GetAuditLog: got %d", w.Code)
	}
}
func TestHandler_PERMISSION_A_DeleteAuditLog(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteAuditLog(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteAuditLog: got %d", w.Code)
	}
}
