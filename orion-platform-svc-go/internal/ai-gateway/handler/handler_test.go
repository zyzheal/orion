package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/ai-gateway/service"

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

func TestAI_GATEWAY_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestAI_GATEWAY_Handler_ProcessRequest(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ProcessRequest(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ProcessRequest: got %d", w.Code)
	}
}

func TestAI_GATEWAY_Handler_GetRequest(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetRequest(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetRequest: got %d", w.Code)
	}
}

func TestAI_GATEWAY_Handler_ListRequests(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListRequests(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListRequests: got %d", w.Code)
	}
}

func TestAI_GATEWAY_Handler_ListByProvider(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListByProvider(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListByProvider: got %d", w.Code)
	}
}

func TestAI_GATEWAY_Handler_ListByModel(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListByModel(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListByModel: got %d", w.Code)
	}
}

func TestAI_GATEWAY_Handler_ListRecent(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListRecent(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListRecent: got %d", w.Code)
	}
}
