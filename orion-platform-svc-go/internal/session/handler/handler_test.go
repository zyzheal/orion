package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/session/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/session/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeSessionService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeSessionService struct{}

func (f *fakeSessionService) CleanupExpired(ctx context.Context, tenantID string) (int64, error) {
	return 0, nil
}

func (f *fakeSessionService) Create(ctx context.Context, tenantID string, req *models.CreateSessionRequest) (*models.Session, error) {
	return &models.Session{}, nil
}

func (f *fakeSessionService) GetByID(ctx context.Context, tenantID, id string) (*models.Session, error) {
	return &models.Session{}, nil
}

func (f *fakeSessionService) List(ctx context.Context, tenantID, userID string, offset, limit int) ([]models.Session, error) {
	return []models.Session{}, nil
}

func (f *fakeSessionService) Logout(ctx context.Context, tenantID, sessionID string) error {
	return nil
}

func (f *fakeSessionService) LogoutAll(ctx context.Context, tenantID, userID string) (int64, error) {
	return 0, nil
}

func (f *fakeSessionService) Verify(ctx context.Context, tenantID, token string) (*models.VerifySessionResponse, error) {
	return &models.VerifySessionResponse{}, nil
}

var _ service.ServiceInterface = (*fakeSessionService)(nil)


func TestHandler_SESSION_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SESSION_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_SESSION_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_SESSION_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_SESSION_LogoutSpecific(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().LogoutSpecific(c)
	if w.Code >= 500 {
		t.Fatalf("LogoutSpecific: got %d", w.Code)
	}
}
func TestHandler_SESSION_LogoutCurrent(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().LogoutCurrent(c)
	if w.Code >= 500 {
		t.Fatalf("LogoutCurrent: got %d", w.Code)
	}
}
func TestHandler_SESSION_LogoutAll(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().LogoutAll(c)
	if w.Code >= 500 {
		t.Fatalf("LogoutAll: got %d", w.Code)
	}
}
