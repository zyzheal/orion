package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/alert-breaker/service"

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

func TestALERT_BREAKER_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestALERT_BREAKER_Handler_ListAlertBreakers(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListAlertBreakers(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListAlertBreakers: got %d", w.Code)
	}
}

func TestALERT_BREAKER_Handler_GetAlertBreaker(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetAlertBreaker(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetAlertBreaker: got %d", w.Code)
	}
}

func TestALERT_BREAKER_Handler_CreateAlertBreaker(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateAlertBreaker(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CreateAlertBreaker: got %d", w.Code)
	}
}

func TestALERT_BREAKER_Handler_UpdateAlertBreaker(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdateAlertBreaker(c)
	if w.Code != http.StatusOK {
		t.Fatalf("UpdateAlertBreaker: got %d", w.Code)
	}
}

func TestALERT_BREAKER_Handler_DeleteAlertBreaker(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteAlertBreaker(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DeleteAlertBreaker: got %d", w.Code)
	}
}
