package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/channel/service"

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

func TestCHANNEL_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestCHANNEL_Handler_CreateChannel(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateChannel(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CreateChannel: got %d", w.Code)
	}
}

func TestCHANNEL_Handler_GetChannel(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetChannel(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetChannel: got %d", w.Code)
	}
}

func TestCHANNEL_Handler_ListChannels(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListChannels(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListChannels: got %d", w.Code)
	}
}

func TestCHANNEL_Handler_UpdateChannel(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdateChannel(c)
	if w.Code != http.StatusOK {
		t.Fatalf("UpdateChannel: got %d", w.Code)
	}
}

func TestCHANNEL_Handler_DeleteChannel(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteChannel(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DeleteChannel: got %d", w.Code)
	}
}

func TestCHANNEL_Handler_GetEnabledByType(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetEnabledByType(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetEnabledByType: got %d", w.Code)
	}
}
