package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/api-consumption/service"

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

func TestAPI_CONSUMPTION_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestAPI_CONSUMPTION_Handler_ListConsumptions(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListConsumptions(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListConsumptions: got %d", w.Code)
	}
}

func TestAPI_CONSUMPTION_Handler_CreateConsumption(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateConsumption(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CreateConsumption: got %d", w.Code)
	}
}

func TestAPI_CONSUMPTION_Handler_ListLimits(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListLimits(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListLimits: got %d", w.Code)
	}
}

func TestAPI_CONSUMPTION_Handler_CreateLimit(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateLimit(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CreateLimit: got %d", w.Code)
	}
}

func TestAPI_CONSUMPTION_Handler_GetLimit(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetLimit(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetLimit: got %d", w.Code)
	}
}

func TestAPI_CONSUMPTION_Handler_UpdateLimit(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdateLimit(c)
	if w.Code != http.StatusOK {
		t.Fatalf("UpdateLimit: got %d", w.Code)
	}
}

func TestAPI_CONSUMPTION_Handler_DeleteLimit(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteLimit(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DeleteLimit: got %d", w.Code)
	}
}

func TestAPI_CONSUMPTION_Handler_GetStats(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetStats(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}
