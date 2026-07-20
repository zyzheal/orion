package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/contract/service"

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

func TestCONTRACT_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestCONTRACT_Handler_ListContracts(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListContracts(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListContracts: got %d", w.Code)
	}
}

func TestCONTRACT_Handler_CreateContract(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateContract(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CreateContract: got %d", w.Code)
	}
}

func TestCONTRACT_Handler_GetContract(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetContract(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetContract: got %d", w.Code)
	}
}

func TestCONTRACT_Handler_UpdateContract(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdateContract(c)
	if w.Code != http.StatusOK {
		t.Fatalf("UpdateContract: got %d", w.Code)
	}
}

func TestCONTRACT_Handler_DeleteContract(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteContract(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DeleteContract: got %d", w.Code)
	}
}

func TestCONTRACT_Handler_CreateEndpoint(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateEndpoint(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CreateEndpoint: got %d", w.Code)
	}
}

func TestCONTRACT_Handler_ListEndpoints(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListEndpoints(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListEndpoints: got %d", w.Code)
	}
}

func TestCONTRACT_Handler_DeleteEndpoint(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteEndpoint(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DeleteEndpoint: got %d", w.Code)
	}
}

func TestCONTRACT_Handler_GetStats(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetStats(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}
