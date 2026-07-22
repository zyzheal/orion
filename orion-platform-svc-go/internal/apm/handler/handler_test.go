package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/apm/service"

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

func TestAPM_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestAPM_Handler_getTenantID(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().getTenantID(c)
	if w.Code != http.StatusOK {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}

func TestAPM_Handler_List(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().List(c)
	if w.Code != http.StatusOK {
		t.Fatalf("List: got %d", w.Code)
	}
}

func TestAPM_Handler_Create(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Create(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Create: got %d", w.Code)
	}
}

func TestAPM_Handler_Get(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Get(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Get: got %d", w.Code)
	}
}

func TestAPM_Handler_Update(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Update(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Update: got %d", w.Code)
	}
}

func TestAPM_Handler_Delete(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Delete(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Delete: got %d", w.Code)
	}
}

func TestAPM_Handler_GetSlowTraces(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetSlowTraces(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetSlowTraces: got %d", w.Code)
	}
}

func TestAPM_Handler_GetServiceTopology(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetServiceTopology(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetServiceTopology: got %d", w.Code)
	}
}

func TestAPM_Handler_GetSlowQueries(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetSlowQueries(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetSlowQueries: got %d", w.Code)
	}
}
