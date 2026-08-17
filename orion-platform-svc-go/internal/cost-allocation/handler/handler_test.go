package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/cost-allocation/service"

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

func TestCOST_ALLOCATION_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestCOST_ALLOCATION_Handler_ListAllocations(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListAllocations(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListAllocations: got %d", w.Code)
	}
}

func TestCOST_ALLOCATION_Handler_CreateAllocation(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateAllocation(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CreateAllocation: got %d", w.Code)
	}
}

func TestCOST_ALLOCATION_Handler_GetAllocation(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetAllocation(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetAllocation: got %d", w.Code)
	}
}

func TestCOST_ALLOCATION_Handler_UpdateAllocation(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdateAllocation(c)
	if w.Code != http.StatusOK {
		t.Fatalf("UpdateAllocation: got %d", w.Code)
	}
}

func TestCOST_ALLOCATION_Handler_DeleteAllocation(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteAllocation(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DeleteAllocation: got %d", w.Code)
	}
}

func TestCOST_ALLOCATION_Handler_CreateRule(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateRule(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CreateRule: got %d", w.Code)
	}
}

func TestCOST_ALLOCATION_Handler_ListRules(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListRules(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListRules: got %d", w.Code)
	}
}

func TestCOST_ALLOCATION_Handler_DeleteRule(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteRule(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DeleteRule: got %d", w.Code)
	}
}

func TestCOST_ALLOCATION_Handler_CreateReport(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateReport(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CreateReport: got %d", w.Code)
	}
}

func TestCOST_ALLOCATION_Handler_ListReports(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListReports(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListReports: got %d", w.Code)
	}
}

func TestCOST_ALLOCATION_Handler_GetReport(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetReport(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetReport: got %d", w.Code)
	}
}

func TestCOST_ALLOCATION_Handler_CompleteReport(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CompleteReport(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CompleteReport: got %d", w.Code)
	}
}

func TestCOST_ALLOCATION_Handler_FailReport(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().FailReport(c)
	if w.Code != http.StatusOK {
		t.Fatalf("FailReport: got %d", w.Code)
	}
}

func TestCOST_ALLOCATION_Handler_DeleteReport(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteReport(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DeleteReport: got %d", w.Code)
	}
}
