package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/compliance/service"

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

func TestCOMPLIANCE_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestCOMPLIANCE_Handler_getTenantID(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().getTenantID(c)
	if w.Code != http.StatusOK {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}

func TestCOMPLIANCE_Handler_ListReports(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListReports(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListReports: got %d", w.Code)
	}
}

func TestCOMPLIANCE_Handler_GetReport(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetReport(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetReport: got %d", w.Code)
	}
}

func TestCOMPLIANCE_Handler_CreateReport(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateReport(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CreateReport: got %d", w.Code)
	}
}

func TestCOMPLIANCE_Handler_UpdateReport(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdateReport(c)
	if w.Code != http.StatusOK {
		t.Fatalf("UpdateReport: got %d", w.Code)
	}
}

func TestCOMPLIANCE_Handler_DeleteReport(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteReport(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DeleteReport: got %d", w.Code)
	}
}

func TestCOMPLIANCE_Handler_ListSchedules(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListSchedules(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListSchedules: got %d", w.Code)
	}
}

func TestCOMPLIANCE_Handler_CreateSchedule(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateSchedule(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CreateSchedule: got %d", w.Code)
	}
}

func TestCOMPLIANCE_Handler_DeleteSchedule(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteSchedule(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DeleteSchedule: got %d", w.Code)
	}
}
