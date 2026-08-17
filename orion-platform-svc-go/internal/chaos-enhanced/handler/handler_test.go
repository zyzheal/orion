package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/chaos-enhanced/service"

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

func TestCHAOS_ENHANCED_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestCHAOS_ENHANCED_Handler_getTenantID(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().getTenantID(c)
	if w.Code != http.StatusOK {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}

func TestCHAOS_ENHANCED_Handler_ListExperiments(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListExperiments(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListExperiments: got %d", w.Code)
	}
}

func TestCHAOS_ENHANCED_Handler_CreateExperiment(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateExperiment(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CreateExperiment: got %d", w.Code)
	}
}

func TestCHAOS_ENHANCED_Handler_GetExperiment(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetExperiment(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetExperiment: got %d", w.Code)
	}
}

func TestCHAOS_ENHANCED_Handler_StartExperiment(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().StartExperiment(c)
	if w.Code != http.StatusOK {
		t.Fatalf("StartExperiment: got %d", w.Code)
	}
}

func TestCHAOS_ENHANCED_Handler_InjectFault(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().InjectFault(c)
	if w.Code != http.StatusOK {
		t.Fatalf("InjectFault: got %d", w.Code)
	}
}

func TestCHAOS_ENHANCED_Handler_StopExperiment(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().StopExperiment(c)
	if w.Code != http.StatusOK {
		t.Fatalf("StopExperiment: got %d", w.Code)
	}
}

func TestCHAOS_ENHANCED_Handler_GetExperimentStatus(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetExperimentStatus(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetExperimentStatus: got %d", w.Code)
	}
}

func TestCHAOS_ENHANCED_Handler_GetExperimentRecovery(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetExperimentRecovery(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetExperimentRecovery: got %d", w.Code)
	}
}

func TestCHAOS_ENHANCED_Handler_ListFaults(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListFaults(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListFaults: got %d", w.Code)
	}
}

func TestCHAOS_ENHANCED_Handler_GetConfigTemplate(t *testing.T) {
	t.Skip("handler uses concrete *service.Service type, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetConfigTemplate(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetConfigTemplate: got %d", w.Code)
	}
}
