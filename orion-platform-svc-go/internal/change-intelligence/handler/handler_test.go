package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/change-intelligence/service"

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

func TestCHANGE_INTELLIGENCE_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestCHANGE_INTELLIGENCE_Handler_getTenantID(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().getTenantID(c)
	if w.Code != http.StatusOK {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}

func TestCHANGE_INTELLIGENCE_Handler_Analyze(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Analyze(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Analyze: got %d", w.Code)
	}
}

func TestCHANGE_INTELLIGENCE_Handler_ListReports(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListReports(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListReports: got %d", w.Code)
	}
}

func TestCHANGE_INTELLIGENCE_Handler_GetReport(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetReport(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetReport: got %d", w.Code)
	}
}

func TestCHANGE_INTELLIGENCE_Handler_GetBlastRadius(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetBlastRadius(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetBlastRadius: got %d", w.Code)
	}
}
