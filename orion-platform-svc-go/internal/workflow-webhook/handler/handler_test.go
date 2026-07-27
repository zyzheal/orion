package handler

import (
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/workflow-webhook/service"
	workflow_service "orion/platform-svc-go/internal/workflow/workflow/service"

	"github.com/gin-gonic/gin"
)

func newHandler() *Handler {
	return NewHandler(&service.Service{}, &workflow_service.Service{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

func TestHandler_WORKFLOW_WEBHOOK_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}
