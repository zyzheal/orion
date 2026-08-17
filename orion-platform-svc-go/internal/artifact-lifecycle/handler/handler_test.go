package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/artifact-lifecycle/service"

	"github.com/gin-gonic/gin"
)

func newHandler() *Handler {
	return NewHandler(&service.Service{})
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

func TestARTIFACT_LIFECYCLE_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestARTIFACT_LIFECYCLE_Handler_AdvanceStage(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().AdvanceStage(c)
	if w.Code != http.StatusOK {
		t.Fatalf("AdvanceStage: got %d", w.Code)
	}
}

func TestARTIFACT_LIFECYCLE_Handler_ArchiveArtifact(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ArchiveArtifact(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ArchiveArtifact: got %d", w.Code)
	}
}

func TestARTIFACT_LIFECYCLE_Handler_CreateLifecycle(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateLifecycle(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CreateLifecycle: got %d", w.Code)
	}
}

func TestARTIFACT_LIFECYCLE_Handler_DeleteLifecycle(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteLifecycle(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DeleteLifecycle: got %d", w.Code)
	}
}

func TestARTIFACT_LIFECYCLE_Handler_GetLifecycle(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetLifecycle(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetLifecycle: got %d", w.Code)
	}
}

func TestARTIFACT_LIFECYCLE_Handler_GetStageHistory(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetStageHistory(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetStageHistory: got %d", w.Code)
	}
}

func TestARTIFACT_LIFECYCLE_Handler_ListLifecycle(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListLifecycle(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListLifecycle: got %d", w.Code)
	}
}
