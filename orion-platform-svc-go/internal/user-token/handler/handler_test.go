package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/user-token/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/user-token/models"
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

type fakeHandlerService struct{}

func (f *fakeHandlerService) CreateToken(ctx context.Context, tenantID string, req models.CreateTokenRequest) (models.CreateTokenResponse, error) {
	return models.CreateTokenResponse{}, nil
}

func (f *fakeHandlerService) DeleteToken(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeHandlerService) GetTokens(ctx context.Context, tenantID, userID string) ([]models.Token, error) {
	return []models.Token{}, nil
}

var _ service.ServiceInterface = (*fakeHandlerService)(nil)

func TestHandler_USER_TOKEN_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_USER_TOKEN_GetTokens(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTokens(c)
	if w.Code >= 500 {
		t.Fatalf("GetTokens: got %d", w.Code)
	}
}
func TestHandler_USER_TOKEN_CreateToken(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateToken(c)
	if w.Code >= 500 {
		t.Fatalf("CreateToken: got %d", w.Code)
	}
}
func TestHandler_USER_TOKEN_DeleteToken(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteToken(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteToken: got %d", w.Code)
	}
}
