package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/config-mgmt-enhanced/service"

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

func TestCONFIG_MGMT_ENHANCED_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestCONFIG_MGMT_ENHANCED_Handler_getTenantID(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().getTenantID(c)
	if w.Code != http.StatusOK {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}

func TestCONFIG_MGMT_ENHANCED_Handler_List(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().List(c)
	if w.Code != http.StatusOK {
		t.Fatalf("List: got %d", w.Code)
	}
}

func TestCONFIG_MGMT_ENHANCED_Handler_Create(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Create(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Create: got %d", w.Code)
	}
}

func TestCONFIG_MGMT_ENHANCED_Handler_Get(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Get(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Get: got %d", w.Code)
	}
}

func TestCONFIG_MGMT_ENHANCED_Handler_Update(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Update(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Update: got %d", w.Code)
	}
}

func TestCONFIG_MGMT_ENHANCED_Handler_Delete(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Delete(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Delete: got %d", w.Code)
	}
}

func TestCONFIG_MGMT_ENHANCED_Handler_ApproveChangeRequest(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ApproveChangeRequest(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ApproveChangeRequest: got %d", w.Code)
	}
}

func TestCONFIG_MGMT_ENHANCED_Handler_ExecuteChangeRequest(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ExecuteChangeRequest(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ExecuteChangeRequest: got %d", w.Code)
	}
}

func TestCONFIG_MGMT_ENHANCED_Handler_RollbackChangeRequest(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RollbackChangeRequest(c)
	if w.Code != http.StatusOK {
		t.Fatalf("RollbackChangeRequest: got %d", w.Code)
	}
}

func TestCONFIG_MGMT_ENHANCED_Handler_GetChangeHistory(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetChangeHistory(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetChangeHistory: got %d", w.Code)
	}
}

func TestCONFIG_MGMT_ENHANCED_Handler_DriftDetect(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DriftDetect(c)
	if w.Code != http.StatusOK {
		t.Fatalf("DriftDetect: got %d", w.Code)
	}
}

func TestCONFIG_MGMT_ENHANCED_Handler_RemediateDrift(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RemediateDrift(c)
	if w.Code != http.StatusOK {
		t.Fatalf("RemediateDrift: got %d", w.Code)
	}
}
